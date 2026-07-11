"""
ForgeShield AI — Configuration
================================
All settings in one place. Override via environment variables if needed.
"""

from __future__ import annotations

import os
from pathlib import Path
from pydantic_settings import BaseSettings


BASE_DIR = Path(__file__).parent


class Settings(BaseSettings):
    # ── Project identity ──────────────────────────────────────────────
    APP_NAME: str = "ForgeShield AI"
    APP_VERSION: str = "1.0.0"
    APP_DESCRIPTION: str = "Real-Time Underwriting Intelligence Platform — Canara Bank"

    # ── Paths ─────────────────────────────────────────────────────────
    UPLOAD_DIR: Path = BASE_DIR / "uploads"
    OUTPUT_DIR: Path = BASE_DIR / "output"
    MOCK_DATA_DIR: Path = BASE_DIR / "mock_data" / "samples"

    # ── Ollama (Local LLM) ────────────────────────────────────────────
    OLLAMA_MODEL: str = "qwen2.5-coder:1.5b"
    OLLAMA_HOST: str = "http://localhost:11434"
    OLLAMA_TIMEOUT: int = 120  # seconds

    # ── Risk Score Weights (must sum to 1.0) ─────────────────────────
    WEIGHT_AUTHENTICITY: float = 0.35
    WEIGHT_CONSISTENCY: float = 0.40
    WEIGHT_RELATIONSHIP: float = 0.25

    # ── Verdict Thresholds ────────────────────────────────────────────
    THRESHOLD_APPROVE: float = 75.0   # overall >= this → APPROVE
    THRESHOLD_HOLD: float = 45.0      # between HOLD and APPROVE → HOLD
    # below THRESHOLD_HOLD → REJECT

    # ── Forensics Thresholds ─────────────────────────────────────────
    ELA_TAMPER_THRESHOLD: float = 25.0          # ELA mean pixel diff > this → suspect
    METADATA_DATE_GAP_DAYS: int = 30            # ModDate - CreationDate > this → flag
    INCOME_DEVIATION_THRESHOLD: float = 0.20   # >20% income difference → flag
    BALANCE_MATH_TOLERANCE: float = 50.0       # INR tolerance in balance check
    LAND_VALUATION_DEVIATION: float = 0.30     # >30% from market rate → flag

    # ── CORS ──────────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

# Ensure directories exist
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
settings.MOCK_DATA_DIR.mkdir(parents=True, exist_ok=True)
