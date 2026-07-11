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


def classify_document(text_sample: str) -> str:
    """
    Use Ollama to classify a document type from extracted text.
    Returns one of: salary_slip, bank_statement, itr, land_record, legal_document, unknown
    """
    from ai_engine.prompt_templates import DOCUMENT_CLASSIFICATION_TEMPLATE
    prompt = DOCUMENT_CLASSIFICATION_TEMPLATE.format(text_sample=text_sample[:500])
    result = generate_text(prompt, timeout=30)
    # Normalise
    valid_types = ["salary_slip", "bank_statement", "itr", "land_record", "legal_document", "unknown"]
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
