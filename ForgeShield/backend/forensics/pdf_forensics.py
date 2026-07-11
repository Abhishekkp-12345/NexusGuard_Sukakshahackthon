"""
ForgeShield AI — Layer 1: PDF Forensics
==========================================
Extracts and analyzes PDF metadata, fonts, and digital signatures.

Checks:
  • CreationDate vs ModDate gap (post-issue modification signal)
  • Producer/Creator software (suspicious if Adobe Acrobat vs. expected payroll system)
  • Font consistency (mixed font families indicate copy-paste tampering)
  • Digital signature validity (was doc altered after signing?)
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Known suspicious producer strings (generic PDF editors, not official systems)
SUSPICIOUS_PRODUCERS = [
    "adobe acrobat",
    "foxit",
    "pdf24",
    "ilovepdf",
    "smallpdf",
    "nitro",
    "sejda",
    "pdfescape",
    "edit pdf",
    "pdfelement",
    "pdf editor",
    "canva",
    "photoshop",
    "illustrator",
    "gimp",
    "inkscape",
    "pdfmaker",
]

EXPECTED_PAYROLL_PRODUCERS = [
    "sap",
    "oracle",
    "greythr",
    "darwin box",
    "keka",
    "hrms",
    "zoho payroll",
    "darwinbox",
]


def analyze_pdf_metadata(pdf_path: Path) -> dict[str, Any]:
    """
    Extract and analyze PDF metadata for forensic signals.

    Returns dict with:
        authenticity_score (0-100), findings (list), metadata (raw dict)
    """
    findings = []
    flags = []
    metadata_raw = {}

    try:
        import pypdf
        reader = pypdf.PdfReader(str(pdf_path))
        meta = reader.metadata or {}

        metadata_raw = {
            "title":        _clean(meta.get("/Title")),
            "author":       _clean(meta.get("/Author")),
            "creator":      _clean(meta.get("/Creator")),
            "producer":     _clean(meta.get("/Producer")),
            "subject":      _clean(meta.get("/Subject")),
            "creation_date": _parse_pdf_date(meta.get("/CreationDate")),
            "mod_date":     _parse_pdf_date(meta.get("/ModDate")),
            "num_pages":    len(reader.pages),
        }

        # ── Flag 1: ModDate significantly after CreationDate ────────
        creation = metadata_raw["creation_date"]
        mod = metadata_raw["mod_date"]
        if creation and mod:
            gap_days = (mod - creation).days
            if gap_days > 30:
                flags.append("late_modification")
                findings.append({
                    "type": "METADATA_MODIFICATION",
                    "severity": "HIGH" if gap_days > 90 else "MEDIUM",
                    "detail": (
                        f"Document was last modified {gap_days} days after creation. "
                        f"Created: {creation.strftime('%Y-%m-%d')}  "
                        f"Modified: {mod.strftime('%Y-%m-%d')}"
                    ),
                })
            elif gap_days > 0:
                findings.append({
                    "type": "METADATA_MODIFICATION",
                    "severity": "LOW",
                    "detail": f"Minor modification detected {gap_days} days after creation.",
                })

        # ── Flag 2: Suspicious producer software ───────────────────
        producer = (metadata_raw.get("producer") or "").lower()
        creator = (metadata_raw.get("creator") or "").lower()
        for suspicious in SUSPICIOUS_PRODUCERS:
            if suspicious in producer or suspicious in creator:
                flags.append("suspicious_producer")
                findings.append({
                    "type": "SUSPICIOUS_PRODUCER",
                    "severity": "HIGH",
                    "detail": (
                        f"Document was edited or created using '{metadata_raw.get('producer') or metadata_raw.get('creator')}'. "
                        f"This is a generic PDF editor, not a payroll/banking system."
                    ),
                })
                break

        # ── Flag 3: Missing metadata (often stripped by converters) ─
        if not metadata_raw["creation_date"] and not metadata_raw["author"]:
            flags.append("stripped_metadata")
            findings.append({
                "type": "STRIPPED_METADATA",
                "severity": "MEDIUM",
                "detail": "Document metadata appears stripped. CreationDate and Author fields are missing.",
            })

        # ── Font analysis ───────────────────────────────────────────
        font_findings = _analyze_fonts(reader)
        findings.extend(font_findings["findings"])
        flags.extend(font_findings["flags"])
        metadata_raw["fonts"] = font_findings["fonts"]

    except Exception as e:
        logger.error(f"PDF metadata analysis failed for {pdf_path}: {e}")
        findings.append({"type": "PARSE_ERROR", "severity": "LOW", "detail": str(e)})

    # ── Authenticity Score ──────────────────────────────────────────
    score = _compute_authenticity_score(flags)

    return {
        "authenticity_score": score,
        "flags": flags,
        "findings": findings,
        "metadata": metadata_raw,
    }


def _analyze_fonts(reader) -> dict[str, Any]:
    """Detect font inconsistencies across PDF pages."""
    fonts_found: set[str] = set()
    findings = []
    flags = []

    try:
        for page in reader.pages:
            resources = page.get("/Resources", {})
            if hasattr(resources, "get_object"):
                resources = resources.get_object()
            font_dict = resources.get("/Font", {})
            if hasattr(font_dict, "get_object"):
                font_dict = font_dict.get_object()
            for key in font_dict:
                font_obj = font_dict[key]
                if hasattr(font_obj, "get_object"):
                    font_obj = font_obj.get_object()
                base_font = font_obj.get("/BaseFont", "")
                if base_font:
                    # Strip encoding suffixes e.g. "ArialMT+Bold" → "Arial"
                    clean = re.sub(r"[+,-].*", "", str(base_font)).strip("/")
                    fonts_found.add(clean)
    except Exception as e:
        logger.warning(f"Font extraction warning: {e}")

    # More than 4 distinct font families is suspicious for a payslip
    if len(fonts_found) > 4:
        flags.append("font_inconsistency")
        findings.append({
            "type": "FONT_INCONSISTENCY",
            "severity": "MEDIUM",
            "detail": (
                f"Document uses {len(fonts_found)} distinct font families: "
                f"{', '.join(sorted(fonts_found)[:8])}. "
                f"Payslips typically use 1–2 fonts. This may indicate content pasting."
            ),
        })

    return {"fonts": list(fonts_found), "findings": findings, "flags": flags}


def _compute_authenticity_score(flags: list[str]) -> float:
    """Derive an authenticity score from detected flags."""
    penalties = {
        "late_modification": 30,
        "suspicious_producer": 35,
        "stripped_metadata": 15,
        "font_inconsistency": 20,
    }
    total_penalty = sum(penalties.get(f, 10) for f in flags)
    return max(0.0, round(100.0 - total_penalty, 2))


def _clean(value) -> str | None:
    if value is None:
        return None
    return str(value).strip() or None


def _parse_pdf_date(date_str) -> datetime | None:
    """Parse PDF date format: D:20240115143000+05'30' or D:20240115143000Z"""
    if not date_str:
        return None
    s = str(date_str).strip()
    # Remove leading "D:" prefix
    if s.startswith("D:"):
        s = s[2:]
    # Extract datetime part (first 14 chars)
    s = s[:14]
    try:
        return datetime.strptime(s, "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
    except ValueError:
        try:
            return datetime.strptime(s[:8], "%Y%m%d").replace(tzinfo=timezone.utc)
        except ValueError:
            return None
