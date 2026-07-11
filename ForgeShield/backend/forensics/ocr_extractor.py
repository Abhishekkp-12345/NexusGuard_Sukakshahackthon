"""
ForgeShield AI — Layer 1: OCR Text Extractor
===============================================
Extracts structured text from PDFs and images using pytesseract.
Uses regex patterns to pull key financial fields:
  - Income amounts (salary, credits)
  - Dates (issue date, period)
  - Names, employer, PAN
  - Account numbers
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


# ── Regex patterns for financial field extraction ─────────────────────

AMOUNT_PATTERN = re.compile(
    r"(?:₹|Rs\.?|INR)?\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?)",
    re.IGNORECASE,
)

DATE_PATTERN = re.compile(
    r"\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{2}[-/]\d{2}|"
    r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*[\s,]+\d{4})\b",
    re.IGNORECASE,
)

PAN_PATTERN = re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b")

ACCOUNT_PATTERN = re.compile(r"\b\d{9,18}\b")

IFSC_PATTERN = re.compile(r"\b[A-Z]{4}0[A-Z0-9]{6}\b")

INCOME_KEYWORDS = [
    "gross salary", "net salary", "basic pay", "total earnings",
    "net pay", "take home", "monthly income", "gross pay",
    "net amount", "salary", "wages",
]

CREDIT_KEYWORDS = ["credit", "cr", "deposit", "salary cr", "salary credit"]
DEBIT_KEYWORDS = ["debit", "dr", "withdrawal", "emi", "loan emi"]


def extract_text_from_pdf(pdf_path: Path) -> str:
    """Extract all text from a PDF using pdfminer."""
    try:
        from pdfminer.high_level import extract_text
        text = extract_text(str(pdf_path))
        return text or ""
    except Exception as e:
        logger.warning(f"pdfminer extraction failed ({pdf_path.name}): {e}")
        return _fallback_ocr(pdf_path)


def extract_text_from_image(image_path: Path) -> str:
    """Extract text from an image using pytesseract."""
    try:
        import pytesseract
        from PIL import Image
        img = Image.open(image_path)
        text = pytesseract.image_to_string(img, config="--oem 3 --psm 6")
        return text or ""
    except Exception as e:
        logger.warning(f"Tesseract OCR failed ({image_path.name}): {e}")
        return ""


def _fallback_ocr(pdf_path: Path) -> str:
    """Fallback: convert PDF pages to images, then OCR each page."""
    try:
        import pypdf
        reader = pypdf.PdfReader(str(pdf_path))
        texts = []
        for page in reader.pages:
            texts.append(page.extract_text() or "")
        return "\n".join(texts)
    except Exception as e:
        logger.error(f"PDF text extraction fallback failed: {e}")
        return ""


def extract_key_fields(text: str, doc_type: str = "unknown") -> dict[str, Any]:
    """
    Extract structured financial fields from raw OCR text.

    Returns:
        {
            "amounts": list[float],
            "dates": list[str],
            "pans": list[str],
            "income": float | None,
            "employer": str | None,
            "account_numbers": list[str],
            "ifsc_codes": list[str],
            "raw_lines": list[str],
        }
    """
    lines = [l.strip() for l in text.splitlines() if l.strip()]

    # Extract all amounts
    raw_amounts = AMOUNT_PATTERN.findall(text)
    amounts = sorted(set(_parse_amount(a) for a in raw_amounts if _parse_amount(a) > 100), reverse=True)

    # Extract dates
    dates = DATE_PATTERN.findall(text)

    # Extract PANs
    pans = PAN_PATTERN.findall(text.upper())

    # Extract account numbers
    accounts = ACCOUNT_PATTERN.findall(text)
    accounts = [a for a in accounts if len(a) >= 9]

    # Extract IFSC
    ifsc = IFSC_PATTERN.findall(text.upper())

    # Try to find income/salary figure
    income = _extract_income(text, amounts)

    # Try to extract employer name
    employer = _extract_employer(text)

    return {
        "amounts": amounts[:20],        # top 20 amounts
        "dates": dates[:10],
        "pans": list(set(pans))[:5],
        "income": income,
        "employer": employer,
        "account_numbers": list(set(accounts))[:5],
        "ifsc_codes": list(set(ifsc))[:3],
        "raw_lines": lines[:50],        # first 50 lines for display
        "full_text": text[:3000],       # first 3k chars
    }


def _extract_income(text: str, amounts: list[float]) -> float | None:
    """Attempt to find the primary income/salary figure."""
    text_lower = text.lower()
    for keyword in INCOME_KEYWORDS:
        # Look for the keyword on a line and grab the first large number on that line
        for line in text.splitlines():
            if keyword in line.lower():
                found = AMOUNT_PATTERN.findall(line)
                for f in found:
                    val = _parse_amount(f)
                    if 5000 < val < 10_000_000:  # plausible monthly salary range
                        return val
    # Fallback: return largest amount that looks like a salary
    for amt in amounts:
        if 5000 < amt < 1_000_000:
            return amt
    return None


def _extract_employer(text: str) -> str | None:
    """Heuristic: employer name usually appears near 'Employer:', 'Company:', 'Payslip of'."""
    patterns = [
        r"(?:employer|company|organisation|organization)\s*[:\-]?\s*([A-Za-z][^\n]{3,50})",
        r"(?:payslip of|salary slip of)\s+([A-Za-z][^\n]{3,50})",
        r"(?:dear employee of)\s+([A-Za-z][^\n]{3,50})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            candidate = match.group(1).strip()
            if len(candidate) > 3:
                return candidate[:80]
    return None


def _parse_amount(raw: str) -> float:
    """Parse a matched amount string (with commas) to float."""
    try:
        return float(raw.replace(",", ""))
    except ValueError:
        return 0.0
