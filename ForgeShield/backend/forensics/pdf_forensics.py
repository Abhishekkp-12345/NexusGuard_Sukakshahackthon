"""
ForgeShield AI — Layer 1: PDF Forensics (Production v2)
======================================================
Extracts and analyzes PDF metadata, fonts, digital signatures, object structure,
incremental updates, XObject overlays, and hidden JavaScript.

Checks:
  • CreationDate vs ModDate gap (post-issue modification signal)
  • Producer/Creator software (suspicious generic PDF editors vs payroll/banking systems)
  • Font consistency & embedding (mixed font families indicate copy-paste tampering)
  • PDF Object Structure Analysis:
      - Multi-stage incremental updates (%%EOF count > 1 = modified post-creation)
      - Suspicious form XObject overlays (hidden text/image patches)
      - Embedded JavaScript or launch actions (malicious or tampering scripts)
      - Stripped or sanitized metadata dictionary
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Known suspicious producer strings (generic PDF editors, not official system outputs)
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
    "pdf-xchange",
    "master pdf",
    "wps office",
    "libreoffice",
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
    "canara",
    "sbi",
    "hdfc",
    "icici",
    "axis",
    "cbs",
]


def analyze_pdf_metadata(pdf_path: Path) -> dict[str, Any]:
    """
    Extract and analyze PDF metadata & internal structure for forensic signals.

    Returns dict with:
        authenticity_score (0-100), findings (list), metadata (raw dict), pdf_structure (dict)
    """
    findings = []
    flags = []
    metadata_raw = {}
    structure_info = {}

    try:
        import pypdf
        reader = pypdf.PdfReader(str(pdf_path))
        meta = reader.metadata or {}

        metadata_raw = {
            "title": _clean(meta.get("/Title")),
            "author": _clean(meta.get("/Author")),
            "creator": _clean(meta.get("/Creator")),
            "producer": _clean(meta.get("/Producer")),
            "subject": _clean(meta.get("/Subject")),
            "creation_date": _parse_pdf_date(meta.get("/CreationDate")),
            "mod_date": _parse_pdf_date(meta.get("/ModDate")),
            "num_pages": len(reader.pages),
        }

        # ── 1. ModDate vs CreationDate Gap ──────────────────────────
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
                        f"Created: {creation.strftime('%Y-%m-%d')} | "
                        f"Modified: {mod.strftime('%Y-%m-%d')}"
                    ),
                })
            elif gap_days > 0:
                findings.append({
                    "type": "METADATA_MODIFICATION",
                    "severity": "LOW",
                    "detail": f"Minor modification detected {gap_days} days after creation.",
                })

        # ── 2. Producer Software Analysis ───────────────────────────
        producer = (metadata_raw.get("producer") or "").lower()
        creator = (metadata_raw.get("creator") or "").lower()
        for suspicious in SUSPICIOUS_PRODUCERS:
            if suspicious in producer or suspicious in creator:
                flags.append("suspicious_producer")
                findings.append({
                    "type": "SUSPICIOUS_PRODUCER",
                    "severity": "HIGH",
                    "detail": (
                        f"Document was edited or generated using generic PDF software: "
                        f"'{metadata_raw.get('producer') or metadata_raw.get('creator')}'. "
                        f"Official banking or payroll documents originate directly from enterprise core systems."
                    ),
                })
                break

        # ── 3. Missing / Stripped Metadata ──────────────────────────
        if not metadata_raw["creation_date"] and not metadata_raw["author"]:
            flags.append("stripped_metadata")
            findings.append({
                "type": "STRIPPED_METADATA",
                "severity": "MEDIUM",
                "detail": "Document metadata dictionary is incomplete or stripped. CreationDate and Author tags are absent.",
            })

        # ── 4. Font Consistency Analysis ────────────────────────────
        font_findings = _analyze_fonts(reader)
        findings.extend(font_findings["findings"])
        flags.extend(font_findings["flags"])
        metadata_raw["fonts"] = font_findings["fonts"]

        # ── 5. PDF Binary / Object Structure Analysis ───────────────
        structure_info = _analyze_pdf_binary_structure(pdf_path, reader)
        findings.extend(structure_info.get("findings", []))
        flags.extend(structure_info.get("flags", []))

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
        "pdf_structure": structure_info,
    }


def _analyze_fonts(reader) -> dict[str, Any]:
    """Detect font inconsistencies and un-embedded fonts across PDF pages."""
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
                    clean = re.sub(r"[+,-].*", "", str(base_font)).strip("/")
                    fonts_found.add(clean)
    except Exception as e:
        logger.warning(f"Font extraction warning: {e}")

    if len(fonts_found) > 4:
        flags.append("font_inconsistency")
        findings.append({
            "type": "FONT_INCONSISTENCY",
            "severity": "MEDIUM",
            "detail": (
                f"Document uses {len(fonts_found)} distinct font families: "
                f"{', '.join(sorted(fonts_found)[:8])}. "
                f"Authentic financial statements typically use 1–2 consistent typefaces."
            ),
        })

    return {"fonts": list(fonts_found), "findings": findings, "flags": flags}


def _analyze_pdf_binary_structure(pdf_path: Path, reader) -> dict[str, Any]:
    """
    Low-level binary & object structure scan:
      - Incremental updates (%%EOF count)
      - Form XObject overlays
      - Embedded JS / Action triggers
    """
    findings = []
    flags = []

    eof_count = 0
    js_count = 0
    xobject_count = 0

    try:
        content = pdf_path.read_bytes()
        # Count EOF markers to detect incremental modifications
        eof_matches = re.findall(rb"%%EOF", content)
        eof_count = len(eof_matches)

        if eof_count > 1:
            flags.append("incremental_update")
            findings.append({
                "type": "INCREMENTAL_UPDATE_DETECTED",
                "severity": "HIGH",
                "detail": (
                    f"PDF contains {eof_count} incremental update sections (%%EOF). "
                    f"This proves the document was modified after initial compilation or signing."
                ),
            })

        # Scan raw bytes for suspicious keys
        if b"/JavaScript" in content or b"/JS" in content:
            js_count += 1
            flags.append("embedded_javascript")
            findings.append({
                "type": "EMBEDDED_JAVASCRIPT",
                "severity": "HIGH",
                "detail": "Document contains embedded JavaScript objects or action scripts.",
            })

        if b"/Form" in content and b"/XObject" in content:
            xobject_count += 1
            # Check pages for XObject forms (often used for patching text over original areas)
            for page in reader.pages:
                res = page.get("/Resources", {})
                if hasattr(res, "get_object"):
                    res = res.get_object()
                xobjs = res.get("/XObject", {})
                if hasattr(xobjs, "get_object"):
                    xobjs = xobjs.get_object()
                if xobjs:
                    for xk in xobjs:
                        xo = xobjs[xk]
                        if hasattr(xo, "get_object"):
                            xo = xo.get_object()
                        if xo.get("/Subtype") == "/Form":
                            flags.append("xobject_overlay")
                            findings.append({
                                "type": "XOBJECT_TEXT_OVERLAY",
                                "severity": "HIGH",
                                "detail": (
                                    "Detected Form XObject visual overlay element. "
                                    "Used in document tampering to mask original text with fake values."
                                ),
                            })
                            break

    except Exception as e:
        logger.warning(f"Binary PDF structure scan error: {e}")

    return {
        "eof_count": eof_count,
        "js_count": js_count,
        "xobject_count": xobject_count,
        "findings": findings,
        "flags": flags,
    }


def _compute_authenticity_score(flags: list[str]) -> float:
    """Derive an authenticity score from detected structural flags."""
    penalties = {
        "late_modification": 30,
        "suspicious_producer": 35,
        "stripped_metadata": 15,
        "font_inconsistency": 20,
        "incremental_update": 35,
        "embedded_javascript": 40,
        "xobject_overlay": 35,
    }
    total_penalty = sum(penalties.get(f, 10) for f in flags)
    return max(0.0, round(100.0 - total_penalty, 2))


def _clean(value) -> str | None:
    if value is None:
        return None
    return str(value).strip() or None


def _parse_pdf_date(date_str) -> datetime | None:
    if not date_str:
        return None
    s = str(date_str).strip()
    if s.startswith("D:"):
        s = s[2:]
    s = s[:14]
    try:
        return datetime.strptime(s, "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
    except ValueError:
        try:
            return datetime.strptime(s[:8], "%Y%m%d").replace(tzinfo=timezone.utc)
        except ValueError:
            return None
