"""
ForgeShield AI — Layer 4: Risk Scorer
=======================================
Aggregates scores from all 3 forensic layers into a single weighted overall score
and determines the underwriting verdict.

Weights (from config.py):
  • Authenticity  35%
  • Consistency   40%
  • Relationship  25% (relationship_risk_score is INVERTED — higher risk = lower authenticity)
"""

from __future__ import annotations

import logging
from typing import Any

from config import settings

logger = logging.getLogger(__name__)


VERDICT_COLORS = {
    "APPROVE": "#10B981",
    "HOLD":    "#F59E0B",
    "REJECT":  "#EF4444",
}


def compute_overall_risk(
    authenticity_score: float,
    consistency_score: float,
    relationship_risk_score: float,
) -> dict[str, Any]:
    """
    Compute the weighted overall score and verdict.

    Args:
        authenticity_score: 0–100, higher = more authentic
        consistency_score: 0–100, higher = more consistent
        relationship_risk_score: 0–100, higher = MORE risk (inverted for weighting)

    Returns:
        {
            "overall_score": float (0–100, higher = safer to approve),
            "verdict": "APPROVE" | "HOLD" | "REJECT",
            "confidence": "HIGH" | "MEDIUM" | "LOW",
            "breakdown": { ... },
        }
    """
    # Invert relationship risk: high risk → low score
    relationship_safety = 100.0 - relationship_risk_score

    overall = (
        authenticity_score     * settings.WEIGHT_AUTHENTICITY +
        consistency_score      * settings.WEIGHT_CONSISTENCY +
        relationship_safety    * settings.WEIGHT_RELATIONSHIP
    )
    overall = round(overall, 2)

    verdict = _determine_verdict(overall)
    confidence = _determine_confidence(authenticity_score, consistency_score, relationship_risk_score)

    logger.info(
        f"Risk scoring — Auth={authenticity_score:.1f}% Cons={consistency_score:.1f}% "
        f"Rel={relationship_risk_score:.1f}% → Overall={overall:.1f}% [{verdict}]"
    )

    return {
        "overall_score": overall,
        "verdict": verdict,
        "verdict_color": VERDICT_COLORS[verdict],
        "confidence": confidence,
        "breakdown": {
            "authenticity":  {
                "score": authenticity_score,
                "weight": settings.WEIGHT_AUTHENTICITY,
                "contribution": round(authenticity_score * settings.WEIGHT_AUTHENTICITY, 2),
            },
            "consistency": {
                "score": consistency_score,
                "weight": settings.WEIGHT_CONSISTENCY,
                "contribution": round(consistency_score * settings.WEIGHT_CONSISTENCY, 2),
            },
            "relationship": {
                "risk_score": relationship_risk_score,
                "safety_score": relationship_safety,
                "weight": settings.WEIGHT_RELATIONSHIP,
                "contribution": round(relationship_safety * settings.WEIGHT_RELATIONSHIP, 2),
            },
        },
    }


def generate_ai_recommendation(
    case_data: dict[str, Any],
    all_findings: list[dict],
    scores: dict[str, Any],
) -> str:
    """
    Generate a natural-language underwriting recommendation using Ollama.

    Args:
        case_data: Case metadata (applicant name, loan amount, etc.)
        all_findings: Combined findings from all layers.
        scores: Output of compute_overall_risk().

    Returns:
        Generated recommendation text string.
    """
    from ai_engine.ollama_client import generate_text
    from ai_engine.prompt_templates import UNDERWRITER_RECOMMENDATION_TEMPLATE

    # Build findings text — only HIGH and MEDIUM severity, max 8
    priority_findings = [
        f for f in all_findings
        if f.get("severity") in ("HIGH", "MEDIUM")
    ][:8]

    if not priority_findings:
        priority_findings = all_findings[:5]

    findings_text = "\n".join(
        f"  [{f.get('severity', 'INFO')}] {f.get('type', 'FINDING')}: {f.get('detail', '')}"
        for f in priority_findings
    )
    if not findings_text:
        findings_text = "  No specific forensic issues detected."

    prompt = UNDERWRITER_RECOMMENDATION_TEMPLATE.format(
        applicant_name=case_data.get("applicant_name", "Unknown"),
        loan_type=case_data.get("loan_type", "Home Loan"),
        loan_amount=case_data.get("loan_amount", 0),
        branch=case_data.get("branch", "Unknown Branch"),
        authenticity_score=scores.get("breakdown", {}).get("authenticity", {}).get("score", 0),
        consistency_score=scores.get("breakdown", {}).get("consistency", {}).get("score", 0),
        relationship_risk_score=scores.get("breakdown", {}).get("relationship", {}).get("risk_score", 0),
        overall_score=scores.get("overall_score", 0),
        findings_text=findings_text,
    )

    return generate_text(prompt)


def _determine_verdict(overall_score: float) -> str:
    if overall_score >= settings.THRESHOLD_APPROVE:
        return "APPROVE"
    elif overall_score >= settings.THRESHOLD_HOLD:
        return "HOLD"
    else:
        return "REJECT"


def _determine_confidence(auth: float, cons: float, rel_risk: float) -> str:
    """
    Confidence is HIGH when scores are strongly polarized (clearly good or bad).
    MEDIUM when borderline. LOW when mixed signals.
    """
    scores = [auth, cons, 100 - rel_risk]
    spread = max(scores) - min(scores)

    # All scores agree
    if spread < 20:
        return "HIGH"
    # Mixed signals
    elif spread < 40:
        return "MEDIUM"
    else:
        return "LOW"
