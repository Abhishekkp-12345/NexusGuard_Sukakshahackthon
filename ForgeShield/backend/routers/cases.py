"""
ForgeShield AI — Cases Router
==============================
CRUD endpoints for loan underwriting cases.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()


# ── Pydantic Models ───────────────────────────────────────────────────

class CaseCreate(BaseModel):
    applicant_name: str
    applicant_pan: str | None = None
    loan_type: str = "Home Loan"
    loan_amount: float
    branch: str = "Bengaluru Main"


class VerdictUpdate(BaseModel):
    verdict: str          # APPROVE / HOLD / REJECT
    notes: str | None = None
    reviewed_by: str | None = None


# ── Helpers ───────────────────────────────────────────────────────────

def get_cases(request: Request) -> dict[str, Any]:
    return request.app.state.cases


# ── Endpoints ─────────────────────────────────────────────────────────

@router.post("/", status_code=201)
async def create_case(payload: CaseCreate, request: Request):
    """Create a new underwriting case."""
    cases = get_cases(request)
    case_id = f"CB-HML-2026-BLR-{str(uuid.uuid4())[:8].upper()}"
    case = {
        "case_id": case_id,
        "applicant_name": payload.applicant_name,
        "applicant_pan": payload.applicant_pan,
        "loan_type": payload.loan_type,
        "loan_amount": payload.loan_amount,
        "branch": payload.branch,
        "status": "PENDING",
        "verdict": None,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "documents": [],
        "analysis": None,
    }
    cases[case_id] = case
    return case


@router.get("/")
async def list_cases(request: Request):
    """List all underwriting cases, newest first."""
    cases = get_cases(request)
    return sorted(cases.values(), key=lambda c: c["created_at"], reverse=True)


@router.get("/{case_id}")
async def get_case(case_id: str, request: Request):
    """Get a single case by ID."""
    cases = get_cases(request)
    if case_id not in cases:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")
    return cases[case_id]


@router.patch("/{case_id}/verdict")
async def update_verdict(case_id: str, payload: VerdictUpdate, request: Request):
    """Update the underwriter's final verdict on a case."""
    cases = get_cases(request)
    if case_id not in cases:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")
    case = cases[case_id]
    case["verdict"] = payload.verdict
    case["status"] = "REVIEWED"
    case["verdict_notes"] = payload.notes
    case["reviewed_by"] = payload.reviewed_by
    case["updated_at"] = datetime.utcnow().isoformat()
    return case


@router.delete("/{case_id}", status_code=204)
async def delete_case(case_id: str, request: Request):
    """Delete a case."""
    cases = get_cases(request)
    if case_id not in cases:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")
    del cases[case_id]


@router.get("/stats/summary")
async def case_stats(request: Request):
    """Aggregate stats for executive dashboard."""
    cases = list(get_cases(request).values())
    total = len(cases)
    approved = sum(1 for c in cases if c.get("verdict") == "APPROVE")
    held = sum(1 for c in cases if c.get("verdict") == "HOLD")
    rejected = sum(1 for c in cases if c.get("verdict") == "REJECT")
    pending = sum(1 for c in cases if c.get("status") == "PENDING")
    total_loan_at_risk = sum(
        c["loan_amount"] for c in cases if c.get("verdict") in ("HOLD", "REJECT")
    )
    return {
        "total_cases": total,
        "approved": approved,
        "held": held,
        "rejected": rejected,
        "pending": pending,
        "total_loan_at_risk": total_loan_at_risk,
        "fraud_detection_rate": round((held + rejected) / total * 100, 1) if total else 0,
    }
