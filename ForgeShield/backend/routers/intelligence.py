"""
ForgeShield AI — Intelligence Router
======================================
New endpoints for cross-case fraud ring detection and geographic intelligence.

GET /api/intelligence/fraud-rings   — all detected fraud rings across all cases
GET /api/intelligence/geo-heatmap   — state-level fraud aggregation for India map
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Request

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/fraud-rings")
async def get_fraud_rings(request: Request):
    """
    Detect and return all fraud rings across all cases.
    A fraud ring is when the same employer / address / phone appears
    in 2+ different loan applications.
    """
    cases: dict[str, Any] = request.app.state.cases

    # ── Aggregate entities across all analyzed cases ───────────────────
    employer_map: dict[str, list[dict]] = {}   # employer_name → [cases]
    address_map:  dict[str, list[dict]] = {}   # normalized_address → [cases]
    pan_map:      dict[str, list[dict]] = {}   # PAN → [cases] (loan stacking)

    for case_id, case in cases.items():
        analysis = case.get("analysis")
        if not analysis:
            continue

        # Use graph_data from analysis — look at employer nodes
        graph_data = analysis.get("graph_data", {})
        nodes = graph_data.get("nodes", [])
        links = graph_data.get("links", [])

        applicant_name = case.get("applicant_name", "Unknown")
        loan_amount = case.get("loan_amount", 0)
        verdict = case.get("verdict", "PENDING")
        loan_type = case.get("loan_type", "")

        case_summary = {
            "case_id": case_id,
            "applicant_name": applicant_name,
            "loan_amount": loan_amount,
            "loan_type": loan_type,
            "verdict": verdict,
        }

        for node in nodes:
            if node.get("type") == "employer":
                emp_name = node.get("label", "").strip().upper()
                if emp_name and len(emp_name) > 3:
                    if emp_name not in employer_map:
                        employer_map[emp_name] = []
                    # Avoid duplicate case entries
                    if not any(c["case_id"] == case_id for c in employer_map[emp_name]):
                        employer_map[emp_name].append(case_summary)

            if node.get("type") == "applicant":
                node_id = node.get("id", "")
                if node_id.startswith("APPLICANT:") and len(node_id) > 15:
                    pan = node_id.replace("APPLICANT:", "")
                    if pan and not pan.startswith("UNK"):
                        if pan not in pan_map:
                            pan_map[pan] = []
                        if not any(c["case_id"] == case_id for c in pan_map[pan]):
                            pan_map[pan].append(case_summary)

        # Pull address from extracted fields in document_reports
        doc_reports = analysis.get("document_reports", [])
        for doc in doc_reports:
            fields = doc.get("extracted_fields", {})
            address = fields.get("address") or fields.get("location", "")
            if address and len(str(address)) > 10:
                norm = _normalize_address(str(address))
                if norm not in address_map:
                    address_map[norm] = []
                if not any(c["case_id"] == case_id for c in address_map[norm]):
                    address_map[norm].append(case_summary)

    # ── Detect rings: entities appearing in 2+ cases ──────────────────
    rings: list[dict] = []

    for emp_name, case_list in employer_map.items():
        if len(case_list) >= 2:
            total_exposure = sum(c["loan_amount"] for c in case_list)
            rings.append({
                "ring_id": f"EMP-{emp_name[:20]}",
                "ring_type": "SHARED_EMPLOYER",
                "ring_type_label": "Shared Employer",
                "shared_entity": emp_name,
                "description": (
                    f"Employer '{emp_name}' appears in {len(case_list)} separate loan applications. "
                    f"This may indicate a shell employer, salary slip factory, or coordinated fraud ring."
                ),
                "severity": "HIGH" if len(case_list) >= 4 else "MEDIUM",
                "case_count": len(case_list),
                "cases": case_list[:10],
                "total_loan_exposure": total_exposure,
                "detected_at": datetime.utcnow().isoformat(),
            })

    for pan, case_list in pan_map.items():
        if len(case_list) >= 2:
            total_exposure = sum(c["loan_amount"] for c in case_list)
            rings.append({
                "ring_id": f"PAN-{pan[:15]}",
                "ring_type": "LOAN_STACKING",
                "ring_type_label": "Loan Stacking",
                "shared_entity": pan,
                "description": (
                    f"Applicant/guarantor PAN '{pan}' appears in {len(case_list)} loan applications. "
                    f"Loan stacking — taking multiple simultaneous loans across branches — "
                    f"is a top RBI-flagged fraud pattern."
                ),
                "severity": "HIGH",
                "case_count": len(case_list),
                "cases": case_list[:10],
                "total_loan_exposure": total_exposure,
                "detected_at": datetime.utcnow().isoformat(),
            })

    for address, case_list in address_map.items():
        if len(case_list) >= 2:
            total_exposure = sum(c["loan_amount"] for c in case_list)
            rings.append({
                "ring_id": f"ADDR-{address[:20]}",
                "ring_type": "SHARED_ADDRESS",
                "ring_type_label": "Shared Address",
                "shared_entity": address,
                "description": (
                    f"Same address found in {len(case_list)} loan applications. "
                    f"Multiple unrelated applicants sharing an address may indicate "
                    f"an address farming operation or identity ring."
                ),
                "severity": "MEDIUM",
                "case_count": len(case_list),
                "cases": case_list[:10],
                "total_loan_exposure": total_exposure,
                "detected_at": datetime.utcnow().isoformat(),
            })

    # Sort by severity + case count
    rings.sort(key=lambda r: (r["severity"] == "HIGH", r["case_count"]), reverse=True)

    return {
        "fraud_rings": rings,
        "total_rings_detected": len(rings),
        "high_severity": sum(1 for r in rings if r["severity"] == "HIGH"),
        "medium_severity": sum(1 for r in rings if r["severity"] == "MEDIUM"),
        "generated_at": datetime.utcnow().isoformat(),
    }


@router.get("/geo-heatmap")
async def get_geo_heatmap(request: Request):
    """
    Return state-level fraud aggregation data for the India heatmap.
    Derives state from branch name in each case.
    """
    cases: dict[str, Any] = request.app.state.cases

    # Branch → State mapping (common Indian bank branch naming)
    BRANCH_STATE_MAP: dict[str, str] = {
        "mumbai": "Maharashtra", "pune": "Maharashtra", "nagpur": "Maharashtra",
        "delhi": "Delhi", "new delhi": "Delhi", "gurugram": "Delhi", "noida": "Delhi",
        "bangalore": "Karnataka", "bengaluru": "Karnataka", "mysuru": "Karnataka",
        "chennai": "Tamil Nadu", "coimbatore": "Tamil Nadu", "madurai": "Tamil Nadu",
        "hyderabad": "Telangana", "secunderabad": "Telangana",
        "kolkata": "West Bengal", "howrah": "West Bengal",
        "ahmedabad": "Gujarat", "surat": "Gujarat", "vadodara": "Gujarat",
        "jaipur": "Rajasthan", "jodhpur": "Rajasthan", "udaipur": "Rajasthan",
        "lucknow": "Uttar Pradesh", "kanpur": "Uttar Pradesh", "agra": "Uttar Pradesh",
        "patna": "Bihar", "gaya": "Bihar",
        "bhopal": "Madhya Pradesh", "indore": "Madhya Pradesh",
        "chandigarh": "Punjab", "ludhiana": "Punjab", "amritsar": "Punjab",
        "kochi": "Kerala", "thiruvananthapuram": "Kerala", "kozhikode": "Kerala",
        "bhubaneswar": "Odisha", "cuttack": "Odisha",
        "ranchi": "Jharkhand", "jamshedpur": "Jharkhand",
        "guwahati": "Assam", "silchar": "Assam",
        "shimla": "Himachal Pradesh", "dehradun": "Uttarakhand",
        "raipur": "Chhattisgarh", "goa": "Goa", "panaji": "Goa",
        "srinagar": "Jammu & Kashmir", "jammu": "Jammu & Kashmir",
    }

    state_data: dict[str, dict] = {}

    for case_id, case in cases.items():
        branch = (case.get("branch") or "").lower()
        state = None
        for key, val in BRANCH_STATE_MAP.items():
            if key in branch:
                state = val
                break
        if not state:
            state = "Other"

        if state not in state_data:
            state_data[state] = {
                "state": state,
                "total_cases": 0,
                "approved": 0,
                "hold": 0,
                "rejected": 0,
                "pending": 0,
                "high_severity_findings": 0,
                "total_loan_amount": 0,
                "fraud_types": {},
            }

        sd = state_data[state]
        sd["total_cases"] += 1
        sd["total_loan_amount"] += case.get("loan_amount", 0)

        verdict = (case.get("verdict") or "PENDING").upper()
        if verdict == "APPROVE":
            sd["approved"] += 1
        elif verdict == "HOLD":
            sd["hold"] += 1
        elif verdict == "REJECT":
            sd["rejected"] += 1
        else:
            sd["pending"] += 1

        analysis = case.get("analysis")
        if analysis:
            sd["high_severity_findings"] += analysis.get("high_severity_count", 0)
            for finding in analysis.get("all_findings", []):
                ftype = finding.get("type", "")
                if finding.get("severity") in ("HIGH", "MEDIUM") and ftype:
                    sd["fraud_types"][ftype] = sd["fraud_types"].get(ftype, 0) + 1

    # Compute risk score for each state
    result_states = []
    for state, sd in state_data.items():
        total = sd["total_cases"] or 1
        fraud_cases = sd["hold"] + sd["rejected"]
        fraud_rate = fraud_cases / total
        risk_score = min(100, round(
            (fraud_rate * 60) +
            (min(sd["high_severity_findings"], 20) / 20 * 40),
            1
        ))
        top_frauds = sorted(sd["fraud_types"].items(), key=lambda x: x[1], reverse=True)[:3]
        result_states.append({
            **sd,
            "fraud_rate_pct": round(fraud_rate * 100, 1),
            "risk_score": risk_score,
            "risk_level": "HIGH" if risk_score >= 60 else "MEDIUM" if risk_score >= 30 else "LOW",
            "top_fraud_types": [{"type": t, "count": c} for t, c in top_frauds],
            "loan_at_risk": sd["hold"] * (sd["total_loan_amount"] / total) + sd["rejected"] * (sd["total_loan_amount"] / total),
        })

    result_states.sort(key=lambda x: x["risk_score"], reverse=True)

    return {
        "states": result_states,
        "total_states": len(result_states),
        "national_fraud_rate": round(
            sum(s["hold"] + s["rejected"] for s in result_states) /
            max(sum(s["total_cases"] for s in result_states), 1) * 100, 1
        ),
        "total_loan_at_risk": sum(s["loan_at_risk"] for s in result_states),
        "generated_at": datetime.utcnow().isoformat(),
    }


def _normalize_address(address: str) -> str:
    """Normalize an address for comparison (lowercase, remove common noise words)."""
    noise = {"flat", "floor", "road", "street", "nagar", "colony", "near", "plot", "no", "house"}
    tokens = [w.lower() for w in address.split() if len(w) >= 3]
    core = [t for t in tokens if t not in noise]
    return " ".join(sorted(core)[:6])  # Sort + take 6 key tokens for fuzzy match
