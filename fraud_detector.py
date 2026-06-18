"""
NexusGuard — Fraud Detection Engine
=====================================
Executes graph traversal algorithms against the local Neo4j
database, or falls back to local in-memory NetworkX matching if Neo4j
is offline, to surface structural anomalies.

Detection categories
────────────────────
  1. ADDRESS_REUSE        — Multiple entities share one physical address
  2. COLLATERAL_CONFLICT  — Same asset pledged across ≥ 2 loan applications
  3. NETWORK_CYCLE        — Hidden multi-hop guarantor / director loop
  4. SHELL_COMPANY        — Director doubles as guarantor + shared address
  5. OWNERSHIP_CONFLICT   — Asset transferred while under active bank lien
"""

from __future__ import annotations

import logging
import uuid
import networkx as nx
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from config import fraud_config
from graph_engine import GraphConnection

logger = logging.getLogger(__name__)


# ════════════════════════════════════════════════════════════════════
#  FraudAlert data-class
# ════════════════════════════════════════════════════════════════════

@dataclass
class FraudAlert:
    alert_id: str              = field(default_factory=lambda: str(uuid.uuid4())[:8].upper())
    alert_type: str            = ""
    severity: str              = "MEDIUM"
    risk_score: float          = 0.5
    title: str                 = ""
    description: str           = ""
    involved_entities: List[Dict[str, str]] = field(default_factory=list)
    evidence_path: List[str]   = field(default_factory=list)
    cypher_query: str          = ""
    timestamp: str             = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    recommendations: List[str] = field(default_factory=list)
    
    # Canara Bank / RBI additions
    rbi_risk_category: str     = ""
    evidence_nodes: List[str]  = field(default_factory=list)
    underwriter_recommendation: List[str] = field(default_factory=list)


# ════════════════════════════════════════════════════════════════════
#  FraudDetector
# ════════════════════════════════════════════════════════════════════

class FraudDetector:
    """
    Runs a battery of graph traversal queries (via Neo4j/Cypher or fallback NetworkX)
    and packages the results as structured FraudAlert objects.
    """

    def __init__(self, graph_connection: Optional[GraphConnection], extraction_result: Optional[Any] = None):
        self._conn = graph_connection
        self._alerts: List[FraudAlert] = []
        self._local_g = None
        
        # Build local NetworkX graph if extraction_result is provided
        if extraction_result:
            self._build_local_graph(extraction_result)

    def _build_local_graph(self, result: Any) -> None:
        """Construct an in-memory NetworkX DiGraph matching the Neo4j schema."""
        self._local_g = nx.DiGraph()
        
        for e in result.entities:
            attrs = {
                "entity_id": e.id,
                "name": e.name,
                "canonical_name": e.canonical_name,
                "entity_type": e.entity_type,
            }
            if e.entity_type == "PERSON":
                attrs["pan"] = e.attributes.get("pan", "")
                attrs["aadhaar"] = e.attributes.get("aadhaar", "")
                attrs["din"] = e.attributes.get("din", "")
            elif e.entity_type == "ASSET":
                attrs["survey_number"] = e.attributes.get("survey_number", e.name)
                attrs["composite_key"] = e.attributes.get("composite_key", e.name)
                attrs["asset_type"] = e.attributes.get("type", "land")
                attrs["village_code"] = e.attributes.get("village_code", "")
                attrs["sro_code"] = e.attributes.get("sro_code", "")
                attrs["plot_number"] = e.attributes.get("plot_number", "")
            elif e.entity_type == "ADDRESS":
                attrs["full_address"] = e.attributes.get("full_address", e.name)
                attrs["pincode"] = e.attributes.get("pincode", "")
            elif e.entity_type == "ORGANIZATION":
                attrs["cin"] = e.attributes.get("cin", "")
                
            self._local_g.add_node(e.id, labels=[e.entity_type], **attrs)
            
        for r in result.relationships:
            self._local_g.add_edge(
                r.source_entity_id,
                r.target_entity_id,
                rel_type=r.rel_type.upper(),
                confidence=r.confidence,
                source_document=r.source_document
            )

    # ── Internal query helper ─────────────────────────────────────

    def _q(self, cypher: str, params: Optional[Dict] = None) -> List[Dict]:
        if not self._conn or not self._conn.connected:
            return []
        try:
            with self._conn.session() as s:
                result = s.run(cypher, params or {})
                return [dict(record) for record in result]
        except Exception as exc:
            logger.error("Fraud query error: %s\n%s", exc, cypher[:200])
            return []

    # ── Severity helper ───────────────────────────────────────────

    def _severity(self, score: float) -> str:
        thresholds = fraud_config.severity_thresholds
        if score >= thresholds["CRITICAL"]:
            return "CRITICAL"
        if score >= thresholds["HIGH"]:
            return "HIGH"
        if score >= thresholds["MEDIUM"]:
            return "MEDIUM"
        return "LOW"

    # ────────────────────────────────────────────────────────────────
    # Detection 1 — Address Reuse
    # ────────────────────────────────────────────────────────────────

    def detect_address_reuse(self) -> List[FraudAlert]:
        cypher = """
        MATCH (addr:Address)<-[:REGISTERED_AT|RESIDES_AT]-(entity)
        WITH addr,
             collect(DISTINCT entity.name) AS entity_names,
             count(DISTINCT entity)        AS entity_count
        WHERE entity_count >= $min_entities
        RETURN addr.full_address AS address,
               entity_names,
               entity_count
        ORDER BY entity_count DESC
        """
        
        alerts: List[FraudAlert] = []

        if self._conn and self._conn.connected:
            rows = self._q(cypher, {"min_entities": fraud_config.address_overlap_min_entities})
            for row in rows:
                names = row.get("entity_names", [])
                count = row.get("entity_count", 0)
                addr  = row.get("address", "Unknown")
                score = min(0.40 + count * 0.15, 1.0)
                sev   = self._severity(score)
                alerts.append(self._create_address_reuse_alert(addr, names, count, score, sev, cypher))
        else:
            # Local NetworkX fallback
            if not self._local_g:
                return []
            min_ent = fraud_config.address_overlap_min_entities
            for node_id, data in self._local_g.nodes(data=True):
                if data.get("entity_type") == "ADDRESS":
                    entities_linked = []
                    for src, tgt, edge_data in self._local_g.in_edges(node_id, data=True):
                        if edge_data.get("rel_type") in ("REGISTERED_AT", "RESIDES_AT"):
                            entities_linked.append(self._local_g.nodes[src])
                    # Deduplicate by entity_id
                    unique_ents = {e["entity_id"]: e for e in entities_linked}.values()
                    if len(unique_ents) >= min_ent:
                        names = [e["name"] for e in unique_ents]
                        count = len(unique_ents)
                        addr  = data.get("full_address", data.get("name", "Unknown"))
                        score = min(0.40 + count * 0.15, 1.0)
                        sev   = self._severity(score)
                        alerts.append(self._create_address_reuse_alert(addr, names, count, score, sev, cypher))

        return alerts

    def _create_address_reuse_alert(self, addr: str, names: List[str], count: int, score: float, sev: str, cypher: str) -> FraudAlert:
        bank_sev = "HIGH" if sev in ("CRITICAL", "HIGH") else ("MEDIUM" if sev == "MEDIUM" else "LOW")
        return FraudAlert(
            alert_type="ADDRESS_REUSE",
            severity=bank_sev,
            risk_score=round(score, 2),
            title=f"Shared Address: {count} Entities at One Location",
            description=(
                f"{count} distinct entities ({', '.join(names)}) share the same "
                f"physical address: '{addr}'. This is a strong indicator of a "
                f"shell company or address fabrication scheme, where different "
                f"loan applicants and corporate filings use the same residential "
                f"address to create fictitious legitimacy."
            ),
            involved_entities=[{"name": n, "role": "entity_at_address"} for n in names],
            evidence_path=[
                f"Address node: {addr}",
                f"Connected entities: {', '.join(names)}",
                f"Shared via: REGISTERED_AT / RESIDES_AT relationships",
            ],
            cypher_query=cypher.replace(
                "$min_entities",
                str(fraud_config.address_overlap_min_entities),
            ).strip(),
            recommendations=[
                "Dispatch a physical verification team to the address.",
                "Verify that each entity independently occupies this address.",
                "Cross-reference with utility bills and property tax records.",
                "Flag all loans associated with entities at this address for manual review.",
                "Escalate to the Fraud Investigation Unit (FIU) if verification fails.",
            ],
            rbi_risk_category="[RBI: Fictitious Entities / Address Misrepresentation]",
            evidence_nodes=[addr] + names,
            underwriter_recommendation=[
                "HOLD / AUDIT: Unexplained address reuse between distinct applicants.",
                "Dispatch field verification officers to inspect physical premises.",
                "Verify rent agreements, utility bills, or property tax records."
            ]
        )

    # ────────────────────────────────────────────────────────────────
    # Detection 2 — Collateral Conflict
    # ────────────────────────────────────────────────────────────────

    def detect_collateral_conflicts(self) -> List[FraudAlert]:
        cypher_pledge = """
        MATCH (p1:Person)-[:APPLIED_FOR_LOAN_WITH]->(asset:Asset)
        MATCH (p2:Person)-[:APPLIED_FOR_LOAN_WITH]->(asset)
        WHERE p1.entity_id <> p2.entity_id
        RETURN asset.name           AS asset_name,
               asset.survey_number  AS survey_number,
               p1.name              AS applicant_1,
               p2.name              AS applicant_2
        """
        cypher_transfer = """
        MATCH (applicant:Person)-[:APPLIED_FOR_LOAN_WITH]->(asset:Asset)
        MATCH (new_owner)-[:OWNS_ASSET]->(asset)
        WHERE applicant.entity_id <> new_owner.entity_id
        RETURN asset.name          AS asset_name,
               asset.survey_number AS survey_number,
               applicant.name      AS loan_applicant,
               new_owner.name      AS actual_owner
        """

        alerts: List[FraudAlert] = []

        if self._conn and self._conn.connected:
            rows_pledge = self._q(cypher_pledge)
            rows_transfer = self._q(cypher_transfer)
            for row in rows_pledge:
                alerts.append(self._create_double_pledge_alert(row, cypher_pledge))
            for row in rows_transfer:
                alerts.append(self._create_owner_mismatch_alert(row, cypher_transfer))
        else:
            # Local NetworkX fallback
            if not self._local_g:
                return []
            for node_id, data in self._local_g.nodes(data=True):
                if data.get("entity_type") == "ASSET":
                    # Check 1: Double-Pledge
                    applicants = []
                    # Check 2: Owner mismatch
                    owners = []
                    for src, tgt, edge_data in self._local_g.in_edges(node_id, data=True):
                        rel = edge_data.get("rel_type")
                        src_data = self._local_g.nodes[src]
                        if rel == "APPLIED_FOR_LOAN_WITH":
                            applicants.append(src_data)
                        elif rel == "OWNS_ASSET":
                            owners.append(src_data)
                            
                    # Trigger Double Pledge
                    unique_applicants = {a["entity_id"]: a for a in applicants}.values()
                    if len(unique_applicants) >= 2:
                        list_applicants = list(unique_applicants)
                        for i in range(len(list_applicants)):
                            for j in range(i + 1, len(list_applicants)):
                                row = {
                                    "asset_name": data.get("name", "Asset"),
                                    "survey_number": data.get("survey_number", ""),
                                    "applicant_1": list_applicants[i]["name"],
                                    "applicant_2": list_applicants[j]["name"]
                                }
                                alerts.append(self._create_double_pledge_alert(row, cypher_pledge))
                                
                    # Trigger Owner Mismatch
                    for app in unique_applicants:
                        for owner in owners:
                            if app["entity_id"] != owner["entity_id"]:
                                row = {
                                    "asset_name": data.get("name", "Asset"),
                                    "survey_number": data.get("survey_number", ""),
                                    "loan_applicant": app["name"],
                                    "actual_owner": owner["name"]
                                }
                                alerts.append(self._create_owner_mismatch_alert(row, cypher_transfer))

        return alerts

    def _create_double_pledge_alert(self, row: Dict[str, str], cypher: str) -> FraudAlert:
        score = 0.85
        return FraudAlert(
            alert_type="COLLATERAL_CONFLICT",
            severity="HIGH",
            risk_score=score,
            title=f"Collateral Double-Pledge: {row.get('asset_name','')}",
            description=(
                f"Land Survey Number {row.get('survey_number', '')} has been "
                f"pledged as collateral by BOTH '{row.get('applicant_1','')}' AND "
                f"'{row.get('applicant_2','')}' in separate loan applications. "
                f"This constitutes a fraudulent double-pledge of the same immovable "
                f"property and is a criminal offence under Section 420 IPC."
            ),
            involved_entities=[
                {"name": row.get("applicant_1", ""), "role": "first_pledger"},
                {"name": row.get("applicant_2", ""), "role": "second_pledger"},
                {"name": row.get("asset_name", ""), "role": "disputed_asset"},
            ],
            evidence_path=[
                f"Asset: {row.get('asset_name','')} (Survey No: {row.get('survey_number','')})",
                f"Loan Application 1: Pledged by {row.get('applicant_1','')}",
                f"Loan Application 2: Pledged by {row.get('applicant_2','')}",
                "Graph path: (Person1)-[:APPLIED_FOR_LOAN_WITH]->(Asset)<-[:APPLIED_FOR_LOAN_WITH]-(Person2)",
            ],
            cypher_query=cypher.strip(),
            recommendations=[
                "Immediately freeze all loan disbursements linked to this asset.",
                "Obtain certified copies of both loan applications.",
                "Conduct an emergency title search at the Sub-Registrar office.",
                "File a report with the local police and RBI Fraud Monitoring Cell.",
                "Place a caveat on the property title at the Revenue Department.",
            ],
            rbi_risk_category="[RBI: Multiple Mortgaging Fraud] / Credit Discipline Disregard",
            evidence_nodes=[row.get("applicant_1", ""), row.get("applicant_2", ""), row.get("asset_name", "")],
            underwriter_recommendation=[
                "CRITICAL REJECT: Immediate loan freeze and RBI reporting mandated.",
                "Initiate title verification search with Sub-Registrar office.",
                "File FIR under Sections 420/467/471 of IPC."
            ]
        )

    def _create_owner_mismatch_alert(self, row: Dict[str, str], cypher: str) -> FraudAlert:
        score = 0.92
        return FraudAlert(
            alert_type="COLLATERAL_CONFLICT",
            severity="HIGH",
            risk_score=score,
            title=f"Fraudulent Mortgage: {row.get('asset_name','')} Not Owned by Mortgagor",
            description=(
                f"'{row.get('loan_applicant','')}' pledged {row.get('asset_name','')} "
                f"(Survey No. {row.get('survey_number','')}) as bank collateral, but "
                f"the property is actually registered under '{row.get('actual_owner','')}'. "
                f"The mortgagor does not hold valid title at the time of mortgage creation — "
                f"this constitutes fraudulent misrepresentation to a financial institution."
            ),
            involved_entities=[
                {"name": row.get("loan_applicant", ""), "role": "fraudulent_mortgagor"},
                {"name": row.get("actual_owner", ""),   "role": "actual_registered_owner"},
                {"name": row.get("asset_name", ""),     "role": "disputed_asset"},
            ],
            evidence_path=[
                f"Asset: {row.get('asset_name','')}",
                f"Pledged as collateral by: {row.get('loan_applicant','')}",
                f"Actual owner (OWNS_ASSET edge): {row.get('actual_owner','')}",
                "Title mismatch confirmed by graph traversal.",
            ],
            cypher_query=cypher.strip(),
            recommendations=[
                "IMMEDIATELY suspend the loan account.",
                "Escalate to bank's Chief Vigilance Officer (CVO).",
                "File FIR under Section 420, 467, 471 IPC.",
                "Engage legal counsel to seek injunction on property.",
                "Notify Credit Information Bureau (CIBIL) to flag accounts.",
            ],
            rbi_risk_category="[RBI: Multiple Mortgaging Fraud] / Credit Discipline Disregard",
            evidence_nodes=[row.get("loan_applicant", ""), row.get("actual_owner", ""), row.get("asset_name", "")],
            underwriter_recommendation=[
                "CRITICAL REJECT: Immediate loan freeze and RBI reporting mandated.",
                "Initiate title verification search with Sub-Registrar office.",
                "File FIR under Sections 420/467/471 of IPC."
            ]
        )

    # ────────────────────────────────────────────────────────────────
    # Detection 3 — Network Cycle / Hidden Connection
    # ────────────────────────────────────────────────────────────────

    def detect_network_cycles(self) -> List[FraudAlert]:
        cypher = f"""
        MATCH (b:Person)-[:APPLIED_FOR_LOAN_WITH]->(asset_b:Asset)
        MATCH (guarantor:Person)-[:GUARANTOR_FOR]->(b)
        MATCH (guarantor)-[:GUARANTOR_FOR]->(a:Person)
        WHERE a.entity_id <> b.entity_id
        MATCH (a)-[:APPLIED_FOR_LOAN_WITH]->(asset_a:Asset)
        RETURN a.name        AS applicant_a,
               b.name        AS applicant_b,
               guarantor.name AS shared_guarantor,
               asset_a.name  AS collateral_a,
               asset_b.name  AS collateral_b
        LIMIT 20
        """
        cypher_dir = """
        MATCH (p:Person)-[:DIRECTOR_OF]->(c:Company)
        MATCH (p)-[:GUARANTOR_FOR]->(borrower:Person)
        MATCH (borrower)-[:APPLIED_FOR_LOAN_WITH]->(asset:Asset)
        RETURN p.name       AS suspect,
               c.name       AS company,
               borrower.name AS borrower,
               asset.name   AS asset
        """

        alerts: List[FraudAlert] = []

        if self._conn and self._conn.connected:
            rows_cycle = self._q(cypher)
            rows_dir = self._q(cypher_dir)
            for row in rows_cycle:
                alerts.append(self._create_guarantor_loop_alert(row, cypher))
            for row in rows_dir:
                alerts.append(self._create_director_guarantor_alert(row, cypher_dir))
        else:
            # Local NetworkX fallback
            if not self._local_g:
                return []
            
            # Check 1: Simple cycles (directed) of length <= 3 (RBI: Fund Round-Tripping / Evergreen Loans)
            try:
                cycles = list(nx.simple_cycles(self._local_g))
                seen_cycle_sets = set()
                for c in cycles:
                    if len(c) <= 3:
                        cycle_nodes_sorted = tuple(sorted(c))
                        if cycle_nodes_sorted in seen_cycle_sets:
                            continue
                        seen_cycle_sets.add(cycle_nodes_sorted)
                        
                        names = [self._local_g.nodes[node_id].get("name", node_id) for node_id in c]
                        evidence = []
                        for idx in range(len(c)):
                            src = c[idx]
                            tgt = c[(idx + 1) % len(c)]
                            edge_data = self._local_g.get_edge_data(src, tgt)
                            rel_type = edge_data.get("rel_type", "CONNECTED_TO") if edge_data else "CONNECTED_TO"
                            src_name = self._local_g.nodes[src].get("name", src)
                            tgt_name = self._local_g.nodes[tgt].get("name", tgt)
                            evidence.append(f"{src_name} → [{rel_type}] → {tgt_name}")
                            
                        alert = FraudAlert(
                            alert_type="NETWORK_CYCLE",
                            severity="HIGH",
                            risk_score=0.85,
                            title=f"Directed Financial Loop: { ' ↔ '.join(names) }",
                            description=(
                                f"A closed loop of transactions/guarantees of length {len(c)} has been identified "
                                f"between: {', '.join(names)}. This circular path constitutes potential "
                                f"fund round-tripping or evergreen loan structures prohibited by the Reserve "
                                f"Bank of India (RBI) credit monitoring directives."
                            ),
                            involved_entities=[{"name": name, "role": "loop_participant"} for name in names],
                            evidence_path=evidence,
                            cypher_query="MATCH (n)-[r*1..3]->(n) RETURN n",
                            rbi_risk_category="[RBI: Fund Round-Tripping / Evergreen Loans]",
                            evidence_nodes=names,
                            underwriter_recommendation=[
                                "CRITICAL REJECT: Immediate RBI reporting mandated due to circular fund/guarantee flows.",
                                "Audit corporate bank statement transactions for circular flow.",
                                "Verify the genuine business purpose of guarantees."
                            ]
                        )
                        alerts.append(alert)
            except Exception as exc:
                logger.error("Cycle detection error: %s", exc)

            # Check 2: Guarantor loop
            for g_id, g_data in self._local_g.nodes(data=True):
                if g_data.get("entity_type") == "PERSON":
                    # Find all outgoing GUARANTOR_FOR relations
                    guaranteed = []
                    for src, tgt, edge_data in self._local_g.out_edges(g_id, data=True):
                        if edge_data.get("rel_type") == "GUARANTOR_FOR":
                            tgt_data = self._local_g.nodes[tgt]
                            if tgt_data.get("entity_type") == "PERSON":
                                guaranteed.append(tgt_data)
                    
                    # Deduplicate
                    unique_guaranteed = {p["entity_id"]: p for p in guaranteed}.values()
                    list_guaranteed = list(unique_guaranteed)
                    if len(list_guaranteed) >= 2:
                        for i in range(len(list_guaranteed)):
                            for j in range(i + 1, len(list_guaranteed)):
                                a = list_guaranteed[i]
                                b = list_guaranteed[j]
                                # Check if both applied for loan with asset
                                asset_a = self._get_applied_asset(a["entity_id"])
                                asset_b = self._get_applied_asset(b["entity_id"])
                                if asset_a and asset_b:
                                    row = {
                                        "applicant_a": a["name"],
                                        "applicant_b": b["name"],
                                        "shared_guarantor": g_data["name"],
                                        "collateral_a": asset_a["name"],
                                        "collateral_b": asset_b["name"]
                                    }
                                    alerts.append(self._create_guarantor_loop_alert(row, cypher))
                                    
            # Check 3: Director-Guarantor overlap
            for p_id, p_data in self._local_g.nodes(data=True):
                if p_data.get("entity_type") == "PERSON":
                    companies = []
                    borrowers = []
                    for src, tgt, edge_data in self._local_g.out_edges(p_id, data=True):
                        rel = edge_data.get("rel_type")
                        tgt_data = self._local_g.nodes[tgt]
                        if rel == "DIRECTOR_OF":
                            companies.append(tgt_data)
                        elif rel == "GUARANTOR_FOR":
                            borrowers.append(tgt_data)
                    for company in companies:
                        for borrower in borrowers:
                            asset = self._get_applied_asset(borrower["entity_id"])
                            if asset:
                                row = {
                                    "suspect": p_data["name"],
                                    "company": company["name"],
                                    "borrower": borrower["name"],
                                    "asset": asset["name"]
                                }
                                alerts.append(self._create_director_guarantor_alert(row, cypher_dir))

        return alerts

    def _get_applied_asset(self, person_id: str) -> Optional[Dict[str, Any]]:
        if not self._local_g:
            return None
        for src, tgt, edge_data in self._local_g.out_edges(person_id, data=True):
            if edge_data.get("rel_type") == "APPLIED_FOR_LOAN_WITH":
                return self._local_g.nodes[tgt]
        return None

    def _create_guarantor_loop_alert(self, row: Dict[str, str], cypher: str) -> FraudAlert:
        score = 0.78
        return FraudAlert(
            alert_type="NETWORK_CYCLE",
            severity="HIGH",
            risk_score=score,
            title="Guarantor Loop: Hidden Network Between Applicants",
            description=(
                f"'{row.get('shared_guarantor','')}' is the guarantor for BOTH "
                f"'{row.get('applicant_a','')}' (pledging {row.get('collateral_a','')}) "
                f"AND '{row.get('applicant_b','')}' (pledging {row.get('collateral_b','')}). "
                f"This creates a hidden financial interdependency where the guarantor's "
                f"insolvency would trigger simultaneous defaults on both loans. This "
                f"pattern is characteristic of organised loan fraud rings."
            ),
            involved_entities=[
                {"name": row.get("applicant_a", ""),      "role": "loan_applicant_a"},
                {"name": row.get("applicant_b", ""),      "role": "loan_applicant_b"},
                {"name": row.get("shared_guarantor", ""), "role": "shared_guarantor"},
            ],
            evidence_path=[
                f"{row.get('shared_guarantor','')} → [GUARANTOR_FOR] → {row.get('applicant_a','')}",
                f"{row.get('applicant_a','')} → [APPLIED_FOR_LOAN_WITH] → {row.get('collateral_a','')}",
                f"{row.get('shared_guarantor','')} → [GUARANTOR_FOR] → {row.get('applicant_b','')}",
                f"{row.get('applicant_b','')} → [APPLIED_FOR_LOAN_WITH] → {row.get('collateral_b','')}",
            ],
            cypher_query=cypher.strip(),
            recommendations=[
                "Reject any loan where the guarantor is already a guarantor on another open loan.",
                "Review guarantor's net worth against total guaranteed obligations.",
                "Conduct background check on guarantor for directorship in shell companies.",
                "Flag all three accounts in the bank's internal watch-list.",
            ],
            rbi_risk_category="[RBI: Fund Round-Tripping / Evergreen Loans]",
            evidence_nodes=[row.get("applicant_a", ""), row.get("applicant_b", ""), row.get("shared_guarantor", "")],
            underwriter_recommendation=[
                "CRITICAL REJECT: Immediate RBI reporting mandated due to circular fund/guarantee flows.",
                "Reject guarantor due to shared guarantor exposure loop.",
                "Audit guarantor outstanding credit limit exposure."
            ]
        )

    def _create_director_guarantor_alert(self, row: Dict[str, str], cypher: str) -> FraudAlert:
        score = 0.70
        return FraudAlert(
            alert_type="NETWORK_CYCLE",
            severity="HIGH",
            risk_score=score,
            title=f"Director-Guarantor Overlap: {row.get('suspect','')}",
            description=(
                f"'{row.get('suspect','')}' is simultaneously a director of "
                f"'{row.get('company','')}' AND acting as guarantor for "
                f"'{row.get('borrower','')}', who has pledged '{row.get('asset','')}' "
                f"as loan collateral. If the company acquires the asset, this creates "
                f"a conflict of interest and a potential asset-stripping scheme."
            ),
            involved_entities=[
                {"name": row.get("suspect", ""),   "role": "director_and_guarantor"},
                {"name": row.get("company", ""),   "role": "company"},
                {"name": row.get("borrower", ""),  "role": "borrower"},
                {"name": row.get("asset", ""),     "role": "contested_asset"},
            ],
            evidence_path=[
                f"{row.get('suspect','')} → [DIRECTOR_OF] → {row.get('company','')}",
                f"{row.get('suspect','')} → [GUARANTOR_FOR] → {row.get('borrower','')}",
                f"{row.get('borrower','')} → [APPLIED_FOR_LOAN_WITH] → {row.get('asset','')}",
            ],
            cypher_query=cypher.strip(),
            recommendations=[
                "Require director to disclose all directorships on guarantor declaration form.",
                "Verify that the company has no financial interest in the collateral asset.",
                "Obtain independent legal opinion on conflict of interest.",
            ],
            rbi_risk_category="[RBI: Credit Diversion & Siphoning]",
            evidence_nodes=[row.get("suspect", ""), row.get("company", ""), row.get("borrower", ""), row.get("asset", "")],
            underwriter_recommendation=[
                "HOLD / AUDIT: Suspected credit diversion or asset stripping through director-guarantor link.",
                "Conduct corporate shareholding verification.",
                "Examine borrower connection to company operations."
            ]
        )

    # ────────────────────────────────────────────────────────────────
    # Detection 4 — Shell Company Pattern
    # ────────────────────────────────────────────────────────────────

    def detect_shell_company_patterns(self) -> List[FraudAlert]:
        cypher = """
        MATCH (company:Company)-[:REGISTERED_AT]->(addr:Address)
        MATCH (person:Person)-[:RESIDES_AT]->(addr)
        MATCH (person2:Person)-[:DIRECTOR_OF]->(company)
        WHERE person.entity_id <> person2.entity_id
        RETURN company.name   AS company,
               addr.full_address AS shared_address,
               person.name    AS resident,
               person2.name   AS director
        """
        
        alerts: List[FraudAlert] = []

        if self._conn and self._conn.connected:
            rows = self._q(cypher)
            for row in rows:
                alerts.append(self._create_shell_company_alert(row, cypher))
        else:
            # Local NetworkX fallback
            if not self._local_g:
                return []
            for c_id, c_data in self._local_g.nodes(data=True):
                # Is it a company? Label checks:
                labels = c_data.get("labels", [])
                is_company = "Company" in labels or c_data.get("entity_type") == "ORGANIZATION" and any(
                    kw in c_data.get("name", "").lower() for kw in ("holdings", "pvt", "ltd", "llp")
                )
                if is_company:
                    # Find REGISTERED_AT address
                    addr_nodes = []
                    for src, tgt, edge_data in self._local_g.out_edges(c_id, data=True):
                        if edge_data.get("rel_type") == "REGISTERED_AT":
                            addr_nodes.append((tgt, self._local_g.nodes[tgt]))
                    
                    # Find directors of this company
                    directors = []
                    for src, tgt, edge_data in self._local_g.in_edges(c_id, data=True):
                        if edge_data.get("rel_type") == "DIRECTOR_OF":
                            directors.append(self._local_g.nodes[src])
                            
                    for addr_id, addr_data in addr_nodes:
                        # Find residents at this address
                        residents = []
                        for src, tgt, edge_data in self._local_g.in_edges(addr_id, data=True):
                            if edge_data.get("rel_type") == "RESIDES_AT":
                                residents.append(self._local_g.nodes[src])
                        
                        # Match residents and directors
                        for res in residents:
                            for d in directors:
                                if res["entity_id"] != d["entity_id"]:
                                    row = {
                                        "company": c_data["name"],
                                        "shared_address": addr_data.get("full_address", addr_data.get("name")),
                                        "resident": res["name"],
                                        "director": d["name"]
                                    }
                                    alerts.append(self._create_shell_company_alert(row, cypher))

        return alerts

    def _create_shell_company_alert(self, row: Dict[str, str], cypher: str) -> FraudAlert:
        score = 0.75
        return FraudAlert(
            alert_type="SHELL_COMPANY",
            severity="HIGH",
            risk_score=score,
            title=f"Shell Company Flag: {row.get('company','')}",
            description=(
                f"'{row.get('company','')}' is registered at the same address "
                f"('{row.get('shared_address','')}') as the personal residence of "
                f"'{row.get('resident','')}'. The company's director is "
                f"'{row.get('director','')}'. This pattern — a company registered "
                f"at a private residence, with directors having financial dealings "
                f"with the resident — is a textbook shell company structure."
            ),
            involved_entities=[
                {"name": row.get("company", ""),        "role": "suspected_shell_company"},
                {"name": row.get("resident", ""),       "role": "address_owner"},
                {"name": row.get("director", ""),       "role": "company_director"},
                {"name": row.get("shared_address", ""), "role": "shared_address"},
            ],
            evidence_path=[
                f"Company: {row.get('company','')} → [REGISTERED_AT] → {row.get('shared_address','')}",
                f"Person: {row.get('resident','')} → [RESIDES_AT] → {row.get('shared_address','')}",
                f"Director: {row.get('director','')} → [DIRECTOR_OF] → {row.get('company','')}",
            ],
            cypher_query=cypher.strip(),
            recommendations=[
                "Verify the company's physical operational existence at the address.",
                "Check MCA21 portal for company's annual filing compliance.",
                "Verify GST registration and ITR filings of the company.",
                "Cross-check company's bank statement for actual business transactions.",
                "Report to SFIO (Serious Fraud Investigation Office) if shell company confirmed.",
            ],
            rbi_risk_category="[RBI: Credit Diversion & Siphoning]",
            evidence_nodes=[row.get("company", ""), row.get("resident", ""), row.get("director", ""), row.get("shared_address", "")],
            underwriter_recommendation=[
                "HOLD / AUDIT: Shell company signature detected.",
                "Verify company registration filings on MCA21 portal.",
                "Request audited balance sheet and GST tax returns.",
                "Verify physical office presence."
            ]
        )

    # ────────────────────────────────────────────────────────────────
    # Detection 5 — Ownership Conflict (Lien vs Transfer)
    # ────────────────────────────────────────────────────────────────

    def detect_ownership_conflicts(self) -> List[FraudAlert]:
        cypher = """
        MATCH (asset:Asset)-[:HAS_LIEN_BY]->(bank)
        MATCH (new_owner)-[:OWNS_ASSET]->(asset)
        OPTIONAL MATCH (old_owner:Person)-[:APPLIED_FOR_LOAN_WITH]->(asset)
        RETURN asset.name      AS asset_name,
               asset.survey_number AS survey_no,
               bank.name      AS lien_holder,
               new_owner.name AS current_owner,
               old_owner.name AS loan_applicant
        """
        
        alerts: List[FraudAlert] = []

        if self._conn and self._conn.connected:
            rows = self._q(cypher)
            for row in rows:
                alerts.append(self._create_ownership_conflict_alert(row, cypher))
        else:
            # Local NetworkX fallback
            if not self._local_g:
                return []
            for a_id, a_data in self._local_g.nodes(data=True):
                if a_data.get("entity_type") == "ASSET":
                    # Find HAS_LIEN_BY relationship
                    banks = []
                    for src, tgt, edge_data in self._local_g.out_edges(a_id, data=True):
                        if edge_data.get("rel_type") == "HAS_LIEN_BY":
                            banks.append(self._local_g.nodes[tgt])
                            
                    # Find OWNS_ASSET (incoming relationship)
                    new_owners = []
                    for src, tgt, edge_data in self._local_g.in_edges(a_id, data=True):
                        if edge_data.get("rel_type") == "OWNS_ASSET":
                            new_owners.append(self._local_g.nodes[src])
                            
                    # Find APPLIED_FOR_LOAN_WITH (incoming from PERSON)
                    old_owners = []
                    for src, tgt, edge_data in self._local_g.in_edges(a_id, data=True):
                        if edge_data.get("rel_type") == "APPLIED_FOR_LOAN_WITH":
                            src_data = self._local_g.nodes[src]
                            if src_data.get("entity_type") == "PERSON":
                                old_owners.append(src_data)
                                
                    for bank in banks:
                        for owner in new_owners:
                            # If we have a lien and a registered owner, conflict alert!
                            # Find matching original applicant if any
                            loan_app = old_owners[0]["name"] if old_owners else "Unknown Applicant"
                            row = {
                                "asset_name": a_data.get("name", "Asset"),
                                "survey_no": a_data.get("survey_number", ""),
                                "lien_holder": bank["name"],
                                "current_owner": owner["name"],
                                "loan_applicant": loan_app
                            }
                            alerts.append(self._create_ownership_conflict_alert(row, cypher))

        return alerts

    def _create_ownership_conflict_alert(self, row: Dict[str, str], cypher: str) -> FraudAlert:
        score = 0.95
        return FraudAlert(
            alert_type="OWNERSHIP_CONFLICT",
            severity="CRITICAL",
            risk_score=score,
            title=f"Active Lien on Transferred Property: {row.get('asset_name','')}",
            description=(
                f"CRITICAL: {row.get('asset_name','')} (Survey No. {row.get('survey_no','')}) "
                f"has an active mortgage lien held by '{row.get('lien_holder','')}' created "
                f"by '{row.get('loan_applicant','')}', but ownership has been transferred to "
                f"'{row.get('current_owner','')}'. The bank's security interest in the "
                f"property is now against a non-borrower, and the mortgagor has effectively "
                f"disposed of mortgaged property — a criminal offence under Section 58(d) of "
                f"the Transfer of Property Act and Section 406/420 IPC."
            ),
            involved_entities=[
                {"name": row.get("loan_applicant", ""), "role": "original_mortgagor"},
                {"name": row.get("current_owner", ""),  "role": "current_property_owner"},
                {"name": row.get("lien_holder", ""),    "role": "lien_holding_bank"},
                {"name": row.get("asset_name", ""),     "role": "disputed_property"},
            ],
            evidence_path=[
                f"Asset: {row.get('asset_name','')} (SR-No: {row.get('survey_no','')})",
                f"Active Lien: {row.get('asset_name','')} → [HAS_LIEN_BY] → {row.get('lien_holder','')}",
                f"Ownership transfer: {row.get('current_owner','')} → [OWNS_ASSET] → {row.get('asset_name','')}",
                f"Original mortgagor: {row.get('loan_applicant','')} no longer holds title.",
            ],
            cypher_query=cypher.strip(),
            recommendations=[
                "EMERGENCY: Engage bank's legal team immediately.",
                "File complaint under Section 58(d) Transfer of Property Act.",
                "Seek court injunction to freeze property from further transfers.",
                "Notify the Sub-Registrar to annotate fraud flag on title records.",
                "Initiate recovery proceedings against original borrower's other assets.",
                "Report to RBI's Financial Intelligence Unit.",
            ],
            rbi_risk_category="[RBI: Multiple Mortgaging Fraud] / Credit Discipline Disregard",
            evidence_nodes=[row.get("loan_applicant", ""), row.get("current_owner", ""), row.get("lien_holder", ""), row.get("asset_name", "")],
            underwriter_recommendation=[
                "CRITICAL REJECT: Immediate loan freeze and RBI reporting mandated.",
                "Initiate title verification search with Sub-Registrar office.",
                "File FIR under Sections 420/467/471 of IPC."
            ]
        )

    # ────────────────────────────────────────────────────────────────
    # Aggregate run
    def calculate_overall_risk(self, alerts: List[FraudAlert]) -> float:
        if not alerts:
            return 0.0
        weights = fraud_config.risk_score_weights
        type_map = {
            "ADDRESS_REUSE":       "address_reuse",
            "COLLATERAL_CONFLICT": "collateral_conflict",
            "NETWORK_CYCLE":       "network_cycle",
            "SHELL_COMPANY":       "network_cycle",
            "OWNERSHIP_CONFLICT":  "ownership_conflict",
        }
        weighted_sum = 0.0
        for alert in alerts:
            wt_key = type_map.get(alert.alert_type, "address_reuse")
            weighted_sum += alert.risk_score * weights.get(wt_key, 0.25)
        # Scale risk score relative to variety of fraud patterns encountered
        pattern_count = len(set(a.alert_type for a in alerts))
        return round(min(weighted_sum / len(alerts) * pattern_count, 1.0), 3)

    def run_all_detections(self) -> Dict[str, Any]:
        """Execute all detectors and return a unified result dict."""
        logger.info("Starting full fraud detection sweep…")
        all_alerts: List[FraudAlert] = []

        detections = [
            ("Address Reuse",       self.detect_address_reuse),
            ("Collateral Conflict", self.detect_collateral_conflicts),
            ("Network Cycles",      self.detect_network_cycles),
            ("Shell Company",       self.detect_shell_company_patterns),
            ("Ownership Conflict",  self.detect_ownership_conflicts),
        ]

        for name, fn in detections:
            logger.info("  Running: %s", name)
            try:
                alerts = fn()
                all_alerts.extend(alerts)
                logger.info("    → %d alert(s) found.", len(alerts))
            except Exception as exc:
                logger.error("  Detection '%s' failed: %s", name, exc, exc_info=True)

        # Deduplicate alerts based on type and title
        unique_alerts = []
        seen_keys = set()
        for alert in all_alerts:
            key = (alert.alert_type, alert.title)
            if key not in seen_keys:
                seen_keys.add(key)
                unique_alerts.append(alert)
        all_alerts = unique_alerts

        overall_score = self.calculate_overall_risk(all_alerts)
        overall_sev   = self._severity(overall_score) if all_alerts else "NONE"

        summary: Dict[str, int] = {}
        for a in all_alerts:
            summary[a.alert_type] = summary.get(a.alert_type, 0) + 1

        stats = {}
        if self._conn and self._conn.connected:
            stats = self._conn.get_stats()
        elif self._local_g:
            # Generate local stats matching Neo4j get_stats format
            labels_count = {}
            for n, d in self._local_g.nodes(data=True):
                for l in d.get("labels", []):
                    labels_count[l] = labels_count.get(l, 0) + 1
            stats = {
                "node_count": self._local_g.number_of_nodes(),
                "relationship_count": self._local_g.number_of_edges(),
                "labels": labels_count
            }

        result: Dict[str, Any] = {
            "alerts":            all_alerts,
            "overall_risk_score": overall_score,
            "overall_severity":  overall_sev,
            "detection_summary": summary,
            "timestamp":         datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "graph_stats":       stats,
        }
        logger.info(
            "Detection complete — %d alerts, overall risk %.2f (%s).",
            len(all_alerts), overall_score, overall_sev,
        )
        return result

    # ── Visualization query list ──────────────────────────────────

    def get_visualization_queries(self) -> List[Dict[str, str]]:
        """Return labelled Cypher queries for the Cypher Lab UI panel."""
        return [
            {
                "title": "Full Fraud Graph",
                "description": "Show all nodes and relationships in the knowledge graph.",
                "cypher": "MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 100",
            },
            {
                "title": "Address Overlap Detection",
                "description": "Find entities sharing the same physical address.",
                "cypher": (
                    "MATCH (addr:Address)<-[:REGISTERED_AT|RESIDES_AT]-(entity)\n"
                    "WITH addr, collect(DISTINCT entity.name) AS names, count(DISTINCT entity) AS cnt\n"
                    "WHERE cnt >= 2\n"
                    "RETURN addr.full_address AS address, names, cnt\n"
                    "ORDER BY cnt DESC"
                ),
            },
            {
                "title": "Collateral Double-Pledge",
                "description": "Find assets pledged by multiple loan applicants.",
                "cypher": (
                    "MATCH (p1:Person)-[:APPLIED_FOR_LOAN_WITH]->(a:Asset)\n"
                    "MATCH (p2:Person)-[:APPLIED_FOR_LOAN_WITH]->(a)\n"
                    "WHERE p1.entity_id <> p2.entity_id\n"
                    "RETURN a.name AS asset, p1.name AS applicant_1, p2.name AS applicant_2"
                ),
            },
            {
                "title": "Guarantor Loop Detection",
                "description": "Find persons acting as guarantor for multiple competing applicants.",
                "cypher": (
                    "MATCH (g:Person)-[:GUARANTOR_FOR]->(a1:Person)\n"
                    "MATCH (g)-[:GUARANTOR_FOR]->(a2:Person)\n"
                    "WHERE a1.entity_id <> a2.entity_id\n"
                    "RETURN g.name AS guarantor, a1.name AS applicant_1, a2.name AS applicant_2"
                ),
            },
            {
                "title": "Shell Company Flag",
                "description": "Company registered at same address as a loan applicant.",
                "cypher": (
                    "MATCH (c:Company)-[:REGISTERED_AT]->(addr:Address)\n"
                    "MATCH (p:Person)-[:RESIDES_AT]->(addr)\n"
                    "RETURN c.name AS company, p.name AS resident, addr.full_address AS address"
                ),
            },
            {
                "title": "Lien vs Ownership Conflict",
                "description": "Assets under active bank lien but transferred to new owner.",
                "cypher": (
                    "MATCH (a:Asset)-[:HAS_LIEN_BY]->(bank)\n"
                    "MATCH (owner)-[:OWNS_ASSET]->(a)\n"
                    "RETURN a.name AS asset, bank.name AS bank, owner.name AS current_owner"
                ),
            },
            {
                "title": "Shortest Path: Rajesh ↔ Apex Holdings",
                "description": "Reveal hidden connection path between Rajesh Kumar and Apex Holdings.",
                "cypher": (
                    "MATCH p=shortestPath(\n"
                    "  (a:Person {canonical_name: 'rajesh kumar'})-[*1..6]-\n"
                    "  (b:Company)\n"
                    ")\n"
                    "WHERE toLower(b.name) CONTAINS 'apex'\n"
                    "RETURN p"
                ),
            },
        ]

    def generate_report(self, detection_result: Dict[str, Any]) -> str:
        """Generate a formatted plain-text investigation report."""
        alerts = detection_result.get("alerts", [])
        lines  = [
            "═" * 68,
            "  NEXUSGUARD — FRAUD INVESTIGATION REPORT",
            f"  Generated: {detection_result.get('timestamp','')}",
            "═" * 68,
            f"  Overall Risk Score : {detection_result['overall_risk_score']:.2%}",
            f"  Overall Severity   : {detection_result['overall_severity']}",
            f"  Total Alerts       : {len(alerts)}",
            "",
        ]
        for i, a in enumerate(alerts, 1):
            lines += [
                f"{'─'*68}",
                f"  Alert #{i} [{a.severity}] — {a.alert_type}",
                f"  {a.title}",
                f"  Risk Score: {a.risk_score:.0%}",
                "",
                f"  Description:",
                *[f"    {line}" for line in a.description.split(". ") if line],
                "",
                f"  Evidence:",
                *[f"    • {e}" for e in a.evidence_path],
                "",
                f"  Recommendations:",
                *[f"    ✓ {r}" for r in a.recommendations],
                "",
            ]
        lines.append("═" * 68)
        return "\n".join(lines)
