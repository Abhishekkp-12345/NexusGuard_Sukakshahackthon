"""
ForgeShield AI — Layer 4: Ollama Client
=========================================
Wrapper around the Ollama Python SDK for local LLM inference.
Model: gemma4:latest (configured in config.py)

100% offline — data never leaves the bank server.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from config import settings

logger = logging.getLogger(__name__)


def _get_ollama():
    """Lazy import of ollama to avoid hard dependency at startup."""
    try:
        import ollama
        return ollama
    except ImportError:
        raise RuntimeError(
            "The 'ollama' Python package is not installed. "
            "Run: pip install ollama"
        )


def generate_text(prompt: str, model: str | None = None, timeout: int | None = None) -> str:
    """
    Generate text from the local Ollama LLM.

    Args:
        prompt: The full prompt string to send.
        model: Override model name (defaults to settings.OLLAMA_MODEL).
        timeout: Override timeout in seconds.

    Returns:
        Generated text as a string.
    """
    model = model or settings.OLLAMA_MODEL
    timeout = timeout or settings.OLLAMA_TIMEOUT

    logger.info(f"Ollama request — model={model}, prompt_len={len(prompt)}")
    t0 = time.time()

    try:
        ollama = _get_ollama()
        response = ollama.chat(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            options={
                "temperature": 0.3,     # Low temp for consistent, factual outputs
                "num_predict": 512,     # Max tokens for recommendation
                "top_p": 0.9,
            },
        )
        elapsed = time.time() - t0
        text = response["message"]["content"].strip()
        logger.info(f"Ollama response received in {elapsed:.1f}s — {len(text)} chars")
        return text

    except Exception as e:
        elapsed = time.time() - t0
        logger.error(f"Ollama inference failed after {elapsed:.1f}s: {e}")
        return _fallback_recommendation(str(e))


def classify_document(text_sample: str, filename: str = "") -> str:
    """
    Classify document type using filename and text heuristics first, falling back to Ollama if needed.
    """
    # 1. Filename Heuristic Check
    if filename:
        fn = filename.lower()
        if any(k in fn for k in ["aadhar", "addhar", "uidai"]):
            return "aadhaar_card"
        if "pan" in fn and "panti" not in fn:
            return "pan_card"
        if any(k in fn for k in ["license", "licence", "dl"]):
            return "driving_license"
        if "passbook" in fn:
            return "bank_passbook"
        if any(k in fn for k in ["salary", "payslip", "pay_slip"]):
            return "salary_slip"
        if any(k in fn for k in ["statement", "bank_stmt"]):
            return "bank_statement"
        if any(k in fn for k in ["itr", "tax", "form_16", "form16"]):
            return "itr"
        if any(k in fn for k in ["land", "deed", "property", "patta"]):
            return "land_record"

    text_lower = text_sample.lower()

    # 2. Text Content Heuristic Checks
    if any(k in text_lower for k in ["unique identification", "authority of india", "aadhaar", "aadhar"]):
        return "aadhaar_card"
    if any(k in text_lower for k in ["permanent account number", "income tax department", "pan card"]):
        return "pan_card"
    if any(k in text_lower for k in ["driving licence", "driving license", "dl no", "licence no"]):
        return "driving_license"
    if "passbook" in text_lower:
        return "bank_passbook"
    if any(k in text_lower for k in ["salary slip", "payslip", "pay slip"]):
        return "salary_slip"
    if any(k in text_lower for k in ["bank statement", "account statement", "statement of account"]):
        return "bank_statement"
    if any(k in text_lower for k in ["form 16", "income tax return", "itr-v"]):
        return "itr"
    if any(k in text_lower for k in ["land record", "survey number", "survey no"]):
        return "land_record"

    # 3. LLM Fallback
    from ai_engine.prompt_templates import DOCUMENT_CLASSIFICATION_TEMPLATE
    prompt = DOCUMENT_CLASSIFICATION_TEMPLATE.format(text_sample=text_sample[:500])
    result = generate_text(prompt, timeout=30)
    # Normalise
    valid_types = ["salary_slip", "bank_statement", "itr", "land_record", "legal_document", "aadhaar_card", "pan_card", "driving_license", "bank_passbook", "unknown"]
    result_clean = result.strip().lower().replace(" ", "_")
    for vt in valid_types:
        if vt in result_clean:
            return vt
    return "unknown"


def check_availability() -> dict[str, Any]:
    """Check if Ollama is running and the configured model is available."""
    try:
        ollama = _get_ollama()
        models_response = ollama.list()
        models = [m["name"] for m in models_response.get("models", [])]
        configured = settings.OLLAMA_MODEL
        available = any(configured in m or m.startswith(configured.split(":")[0]) for m in models)
        return {
            "ollama_running": True,
            "configured_model": configured,
            "model_available": available,
            "available_models": models,
        }
    except Exception as e:
        return {
            "ollama_running": False,
            "configured_model": settings.OLLAMA_MODEL,
            "model_available": False,
            "error": str(e),
        }


def _fallback_recommendation(error: str) -> str:
    """Return a safe fallback recommendation when Ollama is unavailable."""
    return (
        "AI recommendation unavailable (Ollama service not responding). "
        "Please review the forensic scores and findings manually. "
        f"Technical detail: {error[:200]}"
    )
