"""
ForgeShield AI — Document Handler: Land Record
================================================
Extracts land record specific fields from OCR text.
"""

from __future__ import annotations

import re
from typing import Any


SURVEY_PATTERN = re.compile(
    r"(?:survey\s*(?:no|number|#)\.?\s*[:\-]?\s*)(\w+[\s/\-]\w*|\w+)",
    re.IGNORECASE,
)

AREA_PATTERN = re.compile(
    r"(\d+(?:\.\d+)?)\s*(?:sq\.?\s*(?:ft|feet|meter|m|yard|yd)|acres?|guntha|cents?)",
    re.IGNORECASE,
)

VALUE_PATTERN = re.compile(
    r"(?:value|consideration|market\s*value|stamp\s*duty\s*value|sale\s*(?:price|value))\s*[:\-]?\s*(?:₹|Rs\.?)?\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?)",
    re.IGNORECASE,
)

OWNER_PATTERN = re.compile(
    r"(?:owner|vendor|seller|khata\s*holder|pattadar)\s*[:\-]?\s*([A-Za-z][^\n]{3,60})",
    re.IGNORECASE,
)


def extract_land_record_fields(ocr_fields: dict[str, Any]) -> dict[str, Any]:
    """Extract structured land record data from OCR fields."""
    text = ocr_fields.get("full_text", "")

    # Survey number
    survey_match = SURVEY_PATTERN.search(text)
    survey_no = survey_match.group(1).strip() if survey_match else None

    # Area
    area_match = AREA_PATTERN.search(text)
    area_sqft = None
    area_raw = None
    if area_match:
        area_raw = f"{area_match.group(1)} {area_match.group(0).split(area_match.group(1))[-1].strip()}"
        area_val = float(area_match.group(1))
        # Convert to sqft
        unit = area_match.group(0).lower()
        if "acre" in unit:
            area_sqft = area_val * 43560
        elif "guntha" in unit:
            area_sqft = area_val * 1089
        elif "meter" in unit or " m" in unit:
            area_sqft = area_val * 10.764
        else:
            area_sqft = area_val  # assume sqft

    # Declared value
    value_match = VALUE_PATTERN.search(text)
    declared_value = None
    if value_match:
        try:
            declared_value = float(value_match.group(1).replace(",", ""))
        except ValueError:
            pass

    # Fallback to largest amount from OCR
    if not declared_value:
        amounts = ocr_fields.get("amounts", [])
        declared_value = amounts[0] if amounts else None

    # Owner
    owner_match = OWNER_PATTERN.search(text)
    owner = owner_match.group(1).strip()[:60] if owner_match else None

    # Location / address (take first 200 chars of text as proxy)
    location = text[:200]

    return {
        "doc_type": "land_record",
        "survey_no": survey_no,
        "area_sqft": round(area_sqft, 2) if area_sqft else None,
        "area_raw": area_raw,
        "declared_value": declared_value,
        "owner": owner,
        "location": location,
        "pans": ocr_fields.get("pans", []),
        "dates": ocr_fields.get("dates", []),
    }
