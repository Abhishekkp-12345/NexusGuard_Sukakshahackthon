"""
ForgeShield AI — Layer 5: Pure Penalty-Based Risk Scoring Engine (Production v2)
================================================================================
Completely replaces the old weighted-average scoring architecture.

Core Principles:
  1. Base score starts at 100.0 (perfect authenticity baseline).
  2. All forensic anomalies and document mismatches apply direct, un-diluted penalties.
  3. Every forensic detector contributes independently to penalty calculations.
  4. Hard Floor Rules enforce non-negotiable rejection policies:
     - Critical identity mismatch (name, aadhaar, PAN, DOB) → score hard-capped at 29, verdict = REJECT.
     - Copy-move forgery + ELA tamper → score hard-capped at 40.
     - PDF incremental update / JS injection → score hard-capped at 45.
     - Low OCR confidence (< 50%) → score hard-capped at 60.

Verdict Thresholds:
  • APPROVE: overall_score >= 75.0 (and 0 critical mismatches)
  • HOLD   : 45.0 <= overall_score < 75.0
  • REJECT : overall_score < 45.0 (or critical mismatch)
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
    identity_score: float,
    financial_score: float,
    relationship_risk_score: float,
    ocr_confidence: float,
    critical_identity_mismatch: bool = False,
    identity_penalty: float = 0.0,
    tamper_penalty: float = 0.0,
    face_penalty: float = 0.0,
    clone_detected: bool = False,
    low_ocr_confidence: bool = False,
    pdf_penalty: float = 0.0,
    gst_penalty: float = 0.0,
    benford_penalty: float = 0.0,
    entropy_penalty: float = 0.0,
) -> dict[str, Any]:
    """
    Compute overall risk score using pure penalty-from-100 architecture.

    Returns full breakdown of deductions and final verdict.
    """
    base_score = 100.0
    deductions: list[dict[str, Any]] = []

    # ── 1. Image Tamper Penalty ───────────────────────────────────────
    if tamper_penalty > 0:
        deductions.append({
            "category": "TAMPER",
            "reason": "Image forensic evidence detected localized tampering (ELA/Noise/Copy-Move)",
            "penalty": round(tamper_penalty, 2),
        })

    # ── 1.1. Benford's Law Deviation Penalty ──────────────────────────
    if benford_penalty > 0:
        deductions.append({
            "category": "BENFORD_ANOMALY",
            "reason": "Numerical distribution deviates significantly from Benford's Law (possible fabrication)",
            "penalty": round(benford_penalty, 2),
        })

    # ── 1.2. Numeric Entropy Penalty ──────────────────────────────────
    if entropy_penalty > 0:
        deductions.append({
            "category": "NUMERIC_ENTROPY",
            "reason": "Anomalous numerical patterns detected (repeated amounts / round numbers concentration)",
            "penalty": round(entropy_penalty, 2),
        })

    # ── 2. PDF Structure Penalty ──────────────────────────────────────
    if pdf_penalty > 0:
        deductions.append({
            "category": "PDF_STRUCTURE",
            "reason": "PDF structural anomalies detected (incremental updates / suspicious creator / overlays)",
            "penalty": round(pdf_penalty, 2),
        })

    # ── 3. Identity Mismatch Penalty ─────────────────────────────────
    if identity_penalty > 0:
        deductions.append({
            "category": "IDENTITY",
            "reason": "Cross-document identity field discrepancy",
            "penalty": round(identity_penalty, 2),
        })

    # ── 4. Face Verification Penalty ─────────────────────────────────
    if face_penalty > 0:
        deductions.append({
            "category": "FACE",
            "reason": "Biometric face verification discrepancy across photo IDs",
            "penalty": round(face_penalty, 2),
        })

    # ── 5. Consistency & Financial Deductions ─────────────────────────
    if consistency_score < 100.0:
        cons_pen = round((100.0 - consistency_score) * 0.35, 2)
        if cons_pen > 0:
            deductions.append({
                "category": "CONSISTENCY",
                "reason": "Cross-document financial or date inconsistency",
                "penalty": cons_pen,
            })

    if financial_score < 100.0:
        fin_pen = round((100.0 - financial_score) * 0.25, 2)
        if fin_pen > 0:
            deductions.append({
                "category": "FINANCIAL",
                "reason": "Financial cash flow or bank balance calculation anomaly",
                "penalty": fin_pen,
            })

    # ── 6. Relationship Risk Penalty ──────────────────────────────────
    if relationship_risk_score > 0:
        rel_pen = round(relationship_risk_score * 0.30, 2)
        if rel_pen > 0:
            deductions.append({
                "category": "RELATIONSHIP",
                "reason": "High network relationship risk (shared address / shell entity connection)",
                "penalty": rel_pen,
            })

    # ── 7. OCR Confidence Penalty ─────────────────────────────────────
    if ocr_confidence < 60.0 and ocr_confidence > 0:
        ocr_pen = 15.0
        deductions.append({
            "category": "OCR",
            "reason": f"Low OCR extraction confidence ({ocr_confidence:.0f}%)",
            "penalty": ocr_pen,
        })

    # Total accumulated penalty
    total_penalty = sum(d["penalty"] for d in deductions)
    raw_score = max(0.0, base_score - total_penalty)
    adjusted_score = raw_score

    # ── 8. Hard Floor Rules & Hard-Caps ──────────────────────────────
    verdict_override = None
    floor_applied = None

    if critical_identity_mismatch:
        adjusted_score = min(adjusted_score, 29.0)
        verdict_override = "REJECT"
        floor_applied = "CRITICAL IDENTITY MISMATCH — Hard-capped at 29 (REJECT)"
        deductions.append({
            "category": "HARD_CAP",
            "reason": "Critical Identity Mismatch Override: Hard-capped score at 29",
            "penalty": max(0.0, round(raw_score - 29.0, 2)),
        })

    elif clone_detected:
        adjusted_score = min(adjusted_score, 40.0)
        floor_applied = "COPY-MOVE FORGERY DETECTED — Hard-capped score at 40"

    elif benford_penalty >= 20.0:
        adjusted_score = min(adjusted_score, 45.0)
        floor_applied = "CRITICAL BENFORD'S LAW ANOMALY — Hard-capped score at 45"

    elif pdf_penalty >= 35.0:
        adjusted_score = min(adjusted_score, 45.0)
        floor_applied = "SERIOUS PDF STRUCTURAL ANOMALY — Hard-capped score at 45"

    elif low_ocr_confidence:
        adjusted_score = min(adjusted_score, 60.0)
        floor_applied = "LOW OCR CONFIDENCE — Hard-capped score at 60"

    final_score = round(max(0.0, adjusted_score), 2)

    # ── Verdict Determination ─────────────────────────────────────────
    if verdict_override:
        verdict = verdict_override
    elif final_score >= settings.THRESHOLD_APPROVE:
        verdict = "APPROVE"
    elif final_score >= settings.THRESHOLD_HOLD:
        verdict = "HOLD"
    else:
        verdict = "REJECT"

    # ── Confidence Rating ─────────────────────────────────────────────
    confidence = _determine_confidence(critical_identity_mismatch, total_penalty)

    logger.info(
        f"Pure Penalty Risk Scoring — Base=100.0 | Penalties={total_penalty:.1f} "
        f"| Raw={raw_score:.1f} → Final={final_score:.1f}% [{verdict}]"
    )

    return {
        "overall_score": final_score,
        "verdict": verdict,
        "verdict_color": VERDICT_COLORS[verdict],
        "confidence": confidence,
        "floor_applied": floor_applied,
        "score_breakdown": {
            "base_score": 100.0,
            "total_penalty": round(total_penalty, 2),
            "final_score": final_score,
        },
        "score_deductions": deductions,
        "breakdown": {
            "authenticity": {"score": authenticity_score, "weight": 0.20, "contribution": round(authenticity_score * 0.2, 2)},
            "consistency": {"score": consistency_score, "weight": 0.20, "contribution": round(consistency_score * 0.2, 2)},
            "identity": {"score": identity_score, "weight": 0.25, "contribution": round(identity_score * 0.25, 2)},
            "financial": {"score": financial_score, "weight": 0.15, "contribution": round(financial_score * 0.15, 2)},
            "relationship": {"risk_score": relationship_risk_score, "safety_score": 100 - relationship_risk_score, "weight": 0.10, "contribution": round((100 - relationship_risk_score) * 0.1, 2)},
            "ocr": {"score": ocr_confidence, "weight": 0.10, "contribution": round(ocr_confidence * 0.1, 2)},
            "identity_penalty": identity_penalty,
            "tamper_penalty": tamper_penalty,
            "face_penalty": face_penalty,
            "pdf_penalty": pdf_penalty,
            "benford_penalty": benford_penalty,
            "entropy_penalty": entropy_penalty,
        },
    }


def generate_ai_recommendation(
    case_data: dict[str, Any],
    all_findings: list[dict],
    scores: dict[str, Any],
    identity_verification: dict | None = None,
    face_verification: dict | None = None,
) -> str:
    """
    Generate a natural-language underwriting narrative using Ollama/LLM.
    Strict Guardrail: LLM ONLY explains the deterministic score and evidence.
    """
    from ai_engine.ollama_client import generate_text
    from ai_engine.prompt_templates import UNDERWRITER_RECOMMENDATION_TEMPLATE

    priority_findings = [f for f in all_findings if f.get("severity") in ("HIGH", "MEDIUM")][:10]
    if not priority_findings:
        priority_findings = all_findings[:5]

    findings_text = "\n".join(
        f"  [{f.get('severity', 'INFO')}] {f.get('type', 'FINDING')}: {f.get('detail', '')}"
        for f in priority_findings
    ) or "  No specific forensic anomalies detected."

    id_summary = ""
    if identity_verification:
        id_summary = identity_verification.get("identity_summary", "")
        mismatched = identity_verification.get("mismatched_fields", [])
        if mismatched:
            id_summary += "\nMismatched fields: " + ", ".join(
                f"{m['field']} ({m['sourceA']} vs {m['sourceB']})" for m in mismatched[:5]
            )

    deductions = scores.get("score_deductions", [])
    deductions_text = "\n".join(
        f"  Score -{d['penalty']:.0f}: {d['reason']}"
        for d in deductions if d.get("category") != "HARD_CAP"
    ) or "  No deductions applied."

    prompt = UNDERWRITER_RECOMMENDATION_TEMPLATE.format(
        applicant_name=case_data.get("applicant_name", "Unknown"),
        loan_type=case_data.get("loan_type", "Home Loan"),
        loan_amount=case_data.get("loan_amount", 0),
        branch=case_data.get("branch", "Unknown Branch"),
        verdict=scores.get("verdict", "HOLD"),
        authenticity_score=scores.get("breakdown", {}).get("authenticity", {}).get("score", 100),
        consistency_score=scores.get("breakdown", {}).get("consistency", {}).get("score", 100),
        relationship_risk_score=scores.get("breakdown", {}).get("relationship", {}).get("risk_score", 0),
        overall_score=scores.get("overall_score", 100),
        findings_text=findings_text,
        identity_summary=id_summary,
        deductions_text=deductions_text,
    )

    return generate_text(prompt)


def _determine_confidence(critical_mismatch: bool, total_penalty: float) -> str:
    if critical_mismatch or total_penalty > 50:
        return "HIGH"
    elif total_penalty > 20:
        return "MEDIUM"
    return "HIGH"
