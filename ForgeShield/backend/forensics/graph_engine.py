"""
ForgeShield AI — Layer 3: Graph Relationship Engine
=====================================================
Uses NetworkX to build an in-memory relationship graph and detect:
  • Double pledging: same asset used as collateral in 2+ loans
  • Guarantor loops: A guarantees B who guarantees A (circular guarantor chains)
  • Shell company signals: company and applicant share the same address
  • Cross-branch asset reuse: same land survey number in multiple applications
"""

from __future__ import annotations

import logging
from typing import Any

import networkx as nx

logger = logging.getLogger(__name__)


# ── Graph singleton (in-memory across all cases) ──────────────────────
_GRAPH: nx.MultiDiGraph = nx.MultiDiGraph()


def add_case_to_graph(case_id: str, entities: dict[str, Any]) -> None:
    """
    Add all entities from a case to the global relationship graph.

    entities structure:
    {
        "applicant": {"name": str, "pan": str, "address": str},
        "employer":  {"name": str, "address": str},
        "asset":     {"survey_no": str, "address": str, "value": float},
        "guarantors": [{"name": str, "pan": str}],
        "existing_loans": [{"case_id": str, "asset_survey_no": str}],
    }
    """
    applicant = entities.get("applicant", {})
    employer = entities.get("employer", {})
    asset = entities.get("asset", {})
    guarantors = entities.get("guarantors", [])

    pan = applicant.get("pan", f"UNK-{case_id}")
    applicant_node = f"APPLICANT:{pan}"

    # ── Applicant node ────────────────────────────────────────────────
    _GRAPH.add_node(applicant_node, type="applicant", **applicant, case_id=case_id)

    # ── Employer node ─────────────────────────────────────────────────
    if employer.get("name"):
        emp_node = f"EMPLOYER:{employer['name'].upper()}"
        _GRAPH.add_node(emp_node, type="employer", **employer)
        _GRAPH.add_edge(applicant_node, emp_node, rel="EMPLOYED_BY", case_id=case_id)

        # Shell company check: same address as applicant
        if (employer.get("address") and applicant.get("address") and
                _addresses_match(employer["address"], applicant["address"])):
            _GRAPH.nodes[emp_node]["shell_company_signal"] = True
            logger.warning(f"Shell company signal: {employer['name']} and applicant share address")

    # ── Asset node ────────────────────────────────────────────────────
    if asset.get("survey_no"):
        asset_node = f"ASSET:{asset['survey_no']}"
        _GRAPH.add_node(asset_node, type="asset", **asset)
        _GRAPH.add_edge(applicant_node, asset_node, rel="PLEDGES", case_id=case_id)

    # ── Guarantor nodes ───────────────────────────────────────────────
    for guar in guarantors:
        guar_pan = guar.get("pan", guar.get("name", "UNK"))
        guar_node = f"APPLICANT:{guar_pan}"
        _GRAPH.add_node(guar_node, type="applicant", **guar)
        _GRAPH.add_edge(applicant_node, guar_node, rel="GUARANTEED_BY", case_id=case_id)

    # ── Conflict nodes (identity mismatches) ──────────────────────────
    conflicts = entities.get("conflicts", [])
    for conf in conflicts:
        conf_name = conf.get("name", "UNK")
        conf_node = f"APPLICANT:{conf_name.upper()}"
        _GRAPH.add_node(conf_node, type="applicant", name=conf_name)
        _GRAPH.add_edge(applicant_node, conf_node, rel="IDENTITY_MISMATCH", case_id=case_id)

    logger.info(f"Graph updated for case {case_id}. Nodes: {_GRAPH.number_of_nodes()}, Edges: {_GRAPH.number_of_edges()}")


def analyze_relationships(case_id: str, entities: dict[str, Any]) -> dict[str, Any]:
    """
    Run all relationship risk checks for a case.

    Returns:
        {
            "relationship_risk_score": float (0–100, higher = more risk),
            "flags": list[str],
            "findings": list[Finding],
            "graph_data": { "nodes": [...], "links": [...] }  ← for frontend
        }
    """
    findings = []
    flags = []

    applicant = entities.get("applicant", {})
    pan = applicant.get("pan", f"UNK-{case_id}")
    applicant_node = f"APPLICANT:{pan}"

    # Add to graph first
    add_case_to_graph(case_id, entities)

    # ── Check 1: Double pledging ──────────────────────────────────────
    asset = entities.get("asset", {})
    if asset.get("survey_no"):
        asset_node = f"ASSET:{asset['survey_no']}"
        if asset_node in _GRAPH:
            # How many different cases pledge this asset?
            pledging_edges = [
                (u, v, d) for u, v, d in _GRAPH.in_edges(asset_node, data=True)
                if d.get("rel") == "PLEDGES"
            ]
            pledging_cases = set(d.get("case_id") for _, _, d in pledging_edges)
            if len(pledging_cases) > 1:
                other_cases = pledging_cases - {case_id}
                flags.append("double_pledging")
                findings.append({
                    "type": "DOUBLE_PLEDGING",
                    "severity": "HIGH",
                    "detail": (
                        f"Asset (Survey No: {asset['survey_no']}) has been pledged as collateral "
                        f"in {len(pledging_cases)} loan applications: {', '.join(other_cases)}. "
                        f"This is a strong fraud signal."
                    ),
                    "other_cases": list(other_cases),
                })

    # ── Check 2: Guarantor loops ──────────────────────────────────────
    if applicant_node in _GRAPH:
        try:
            cycles = list(nx.simple_cycles(_GRAPH.to_undirected()))
            guarantor_cycles = [
                c for c in cycles
                if applicant_node in c and any("APPLICANT:" in n for n in c)
            ]
            if guarantor_cycles:
                flags.append("guarantor_loop")
                findings.append({
                    "type": "GUARANTOR_LOOP",
                    "severity": "HIGH",
                    "detail": (
                        f"Circular guarantor relationship detected. "
                        f"Loop involves: {' → '.join(guarantor_cycles[0][:5])}. "
                        f"This pattern is common in coordinated fraud."
                    ),
                })
        except Exception as e:
            logger.warning(f"Cycle detection error: {e}")

    # ── Check 3: Applicant is guarantor in other active cases ─────────
    if applicant_node in _GRAPH:
        guaranteed_cases = [
            d.get("case_id") for u, v, d in _GRAPH.out_edges(applicant_node, data=True)
            if d.get("rel") == "GUARANTEED_BY" and d.get("case_id") != case_id
        ]
        if guaranteed_cases:
            flags.append("active_guarantor")
            findings.append({
                "type": "ACTIVE_GUARANTOR",
                "severity": "MEDIUM",
                "detail": (
                    f"Applicant is acting as guarantor in {len(guaranteed_cases)} other active case(s): "
                    f"{', '.join(guaranteed_cases[:3])}. This increases total liability exposure."
                ),
                "other_cases": guaranteed_cases[:5],
            })
        else:
            findings.append({
                "type": "NO_GUARANTOR_CONFLICT",
                "severity": "INFO",
                "detail": "No active guarantor conflicts found for this applicant.",
            })

    # ── Check 4: Shell company signal ────────────────────────────────
    employer = entities.get("employer", {})
    if employer.get("name"):
        emp_node = f"EMPLOYER:{employer['name'].upper()}"
        if _GRAPH.nodes.get(emp_node, {}).get("shell_company_signal"):
            flags.append("shell_company")
            findings.append({
                "type": "SHELL_COMPANY_SIGNAL",
                "severity": "HIGH",
                "detail": (
                    f"Employer '{employer['name']}' shares the same address as the applicant. "
                    f"This is a common shell company / self-employment disguise pattern."
                ),
            })

    # ── Compute score ─────────────────────────────────────────────────
    risk_score = _compute_risk_score(flags)

    # ── Build graph data for frontend visualization ───────────────────
    graph_data = _build_graph_data(applicant_node)

    return {
        "relationship_risk_score": risk_score,
        "flags": flags,
        "findings": findings,
        "graph_data": graph_data,
    }


def get_full_graph_data() -> dict[str, Any]:
    """Return the entire graph for the graph view page."""
    return _build_graph_data(None)


def _build_graph_data(focus_node: str | None) -> dict[str, Any]:
    """Serialize NetworkX graph to a format react-force-graph understands."""
    if focus_node and focus_node in _GRAPH:
        # Get ego graph (2 hops) around the focus node
        ego = nx.ego_graph(_GRAPH, focus_node, radius=2, undirected=True)
        G = ego
    else:
        G = _GRAPH

    nodes = []
    for node_id, data in G.nodes(data=True):
        node_type = data.get("type", "unknown")
        nodes.append({
            "id": node_id,
            "label": _node_label(node_id, data),
            "type": node_type,
            "color": _node_color(node_type),
            "data": {k: v for k, v in data.items() if k not in ("type",)},
        })

    links = []
    for u, v, data in G.edges(data=True):
        links.append({
            "source": u,
            "target": v,
            "label": data.get("rel", "RELATED"),
            "case_id": data.get("case_id"),
        })

    return {"nodes": nodes, "links": links}


def _node_label(node_id: str, data: dict) -> str:
    if "name" in data:
        return data["name"]
    if ":" in node_id:
        return node_id.split(":", 1)[1][:30]
    return node_id[:30]


def _node_color(node_type: str) -> str:
    colors = {
        "applicant": "#3B82F6",   # blue
        "employer":  "#10B981",   # green
        "asset":     "#F59E0B",   # amber
        "guarantor": "#8B5CF6",   # purple
    }
    return colors.get(node_type, "#6B7280")


def _compute_risk_score(flags: list[str]) -> float:
    """Higher score = more risk."""
    penalties = {
        "double_pledging": 60,
        "guarantor_loop": 50,
        "shell_company": 45,
        "active_guarantor": 20,
    }
    total = sum(penalties.get(f, 10) for f in flags)
    return min(100.0, round(total, 2))


def _addresses_match(addr1: str, addr2: str) -> bool:
    """Simple heuristic address similarity check."""
    a1 = addr1.lower().strip()
    a2 = addr2.lower().strip()
    if a1 == a2:
        return True
    # Check if 70% of words overlap
    words1 = set(a1.split())
    words2 = set(a2.split())
    if not words1 or not words2:
        return False
    overlap = len(words1 & words2) / min(len(words1), len(words2))
    return overlap > 0.7


def reset_graph() -> None:
    """Reset the graph (for testing)."""
    global _GRAPH
    _GRAPH = nx.MultiDiGraph()
