"""
ForgeShield AI — FastAPI Application Entry Point
=================================================
Runs the 5-layer underwriting intelligence platform.
Start with:  uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import settings

# ── Logging ───────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("forgeshield")

from mock_data.prepopulated_cases import get_prepopulated_cases

# ── In-memory case store (replace with DB in production) ──────────────
# Structure: { case_id: { ...case data... } }
CASES: dict[str, dict[str, Any]] = get_prepopulated_cases()


# ── Application lifespan ──────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=" * 60)
    logger.info(f"  {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"  Ollama model : {settings.OLLAMA_MODEL}")
    logger.info(f"  Upload dir   : {settings.UPLOAD_DIR}")
    logger.info("=" * 60)
    yield
    logger.info("ForgeShield AI shutting down.")


# ── FastAPI App ───────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=settings.APP_DESCRIPTION,
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Serve uploaded files (for ELA heatmaps etc.) ─────────────────────
app.mount("/uploads", StaticFiles(directory=str(settings.UPLOAD_DIR)), name="uploads")
app.mount("/output", StaticFiles(directory=str(settings.OUTPUT_DIR)), name="output")


# ── Routers ───────────────────────────────────────────────────────────
from routers import cases, forensics, reports, intelligence  # noqa: E402

app.include_router(cases.router, prefix="/api/cases", tags=["Cases"])
app.include_router(forensics.router, prefix="/api/forensics", tags=["Forensics"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(intelligence.router, prefix="/api/intelligence", tags=["Intelligence"])


# ── Health check ──────────────────────────────────────────────────────
@app.get("/api/health", tags=["Health"])
async def health():
    return {
        "status": "online",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "timestamp": datetime.utcnow().isoformat(),
        "ollama_model": settings.OLLAMA_MODEL,
    }


# ── Make CASES accessible from routers ───────────────────────────────
app.state.cases = CASES
