"""
ForgeShield AI — Ollama LLM Client with Graceful Fallback (Production v2)
==========================================================================
Handles asynchronous requests to local Ollama instance for explainable AI narratives.
Includes robust error handling and rule-based fallback if Ollama is offline or un-downloaded.
"""

from __future__ import annotations

import logging
import urllib.request
import json
from typing import Any

from config import settings

logger = logging.getLogger(__name__)


def generate_text(prompt: str) -> str:
    """
    Send prompt to local Ollama API. Fall back to rule-based summary if unavailable.
    """
    url = f"{settings.OLLAMA_HOST}/api/generate"
    payload = {
        "model": settings.OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.2,  # Low temperature for analytical consistency
            "num_predict": 512,
        },
    }

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=settings.OLLAMA_TIMEOUT) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("response", "").strip()
    except Exception as e:
        logger.warning(f"Ollama generation failed/offline ({e}). Using deterministic fallback narrative.")
        return _fallback_narrative(prompt)


def classify_document(text_sample: str, filename: str) -> str:
    """Classify document type using keyword rules."""
    text = (text_sample + " " + filename).lower()

    if any(k in text for k in ["pan", "permanent account number"]):
        return "pan_card"
    elif any(k in text for k in ["aadhaar", "uidai", "unique identification"]):
        return "aadhaar_card"
    elif any(k in text for k in ["salary", "payslip", "pay slip", "earnings", "deductions"]):
        return "salary_slip"
    elif any(k in text for k in ["bank statement", "account statement", "closing balance", "ifsc", "passbook"]):
        return "bank_statement"
    elif any(k in text for k in ["form 16", "itr", "income tax return", "acknowledgement"]):
        return "itr"
    elif any(k in text for k in ["gst", "gstin", "taxpayer"]):
        return "gst"
    elif any(k in text for k in ["driving license", "dl no"]):
        return "driving_license"
    elif any(k in text for k in ["land", "pahani", "rtc", "khasra", "mutation"]):
        return "land_record"
    return "unknown"


def check_availability() -> dict[str, Any]:
    """Check if Ollama host is reachable."""
    try:
        req = urllib.request.Request(f"{settings.OLLAMA_HOST}/api/tags")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            models = [m.get("name") for m in data.get("models", [])]
            return {
                "status": "online",
                "host": settings.OLLAMA_HOST,
                "configured_model": settings.OLLAMA_MODEL,
                "available_models": models,
                "model_ready": any(settings.OLLAMA_MODEL in m for m in models),
            }
    except Exception as e:
        return {
            "status": "offline",
            "host": settings.OLLAMA_HOST,
            "error": str(e),
            "note": "ForgeShield will use rule-based Explainable AI fallback.",
        }


def _fallback_narrative(prompt: str) -> str:
    """Generate a structured rule-based narrative when LLM is offline."""
    lines = prompt.splitlines()
    verdict = "HOLD"
    score = "100.0"

    for line in lines:
        if "DETERMINISTIC ENGINE VERDICT :" in line:
            verdict = line.split(":")[-1].strip()
        if "FINAL AUTHENTICITY SCORE     :" in line:
            score = line.split(":")[-1].strip()

    if verdict == "APPROVE":
        return (
            f"FORENSIC DOSSIER SUMMARY: The document package has passed all deterministic forensic checks with a final authenticity score of {score}. "
            "No pixel-level Error Level Analysis (ELA) anomalies, copy-move cloning keypoints, or identity field discrepancies were detected. "
            "Underwriter Recommendation: Proceed with loan processing subject to standard policy checks."
        )
    elif verdict == "REJECT":
        return (
            f"FORENSIC DOSSIER SUMMARY: The document package has been REJECTED by the deterministic forensic engine with a final authenticity score of {score}. "
            "Severe forensic anomalies were identified during processing, including potential image tampering, structural PDF modifications, or critical identity mismatches across documents. "
            "Underwriter Recommendation: Immediately REJECT application and flag for anti-fraud investigation."
        )
    else:
        return (
            f"FORENSIC DOSSIER SUMMARY: The document package requires MANUAL REVIEW (HOLD) with a final authenticity score of {score}. "
            "Forensic evidence shows moderate anomalies or field inconsistencies that warrant physical verification. "
            "Underwriter Recommendation: Request original physical documents and verify applicant credentials with issuing authorities."
        )
