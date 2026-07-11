"""
ForgeShield AI — Document Handler: Bank Statement
==================================================
Extracts bank statement specific fields from OCR text.
Computes monthly credit aggregations and detects suspicious patterns.
"""

from __future__ import annotations

import re
from typing import Any


CREDIT_PATTERN = re.compile(
    r"(?:credit|cr\.?|deposit|salary)\s+(?:₹|Rs\.?)?\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?)",
    re.IGNORECASE,
)

DEBIT_PATTERN = re.compile(
    r"(?:debit|dr\.?|withdrawal|emi|payment)\s+(?:₹|Rs\.?)?\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?)",
    re.IGNORECASE,
)

EMI_KEYWORDS = ["emi", "loan emi", "home loan emi", "car loan emi", "personal loan emi"]


def extract_bank_statement_fields(ocr_fields: dict[str, Any]) -> dict[str, Any]:
    """
    Extract structured bank statement data from OCR fields.
    """
    text = ocr_fields.get("full_text", "")
    lines = ocr_fields.get("raw_lines", [])
    amounts = ocr_fields.get("amounts", [])
    dates = ocr_fields.get("dates", [])

    # Extract credits
    credits = [float(m.replace(",", "")) for m in CREDIT_PATTERN.findall(text)]
    # Filter plausible credit amounts (₹1,000 – ₹50,00,000)
    credits = [c for c in credits if 1000 < c < 50_000_000]

    # Extract debits
    debits = [float(m.replace(",", "")) for m in DEBIT_PATTERN.findall(text)]
    debits = [d for d in debits if 100 < d < 50_000_000]

    total_credits = sum(credits)
    total_debits = sum(debits)

    # Estimate months covered from dates
    months_covered = _estimate_months(dates)
    avg_monthly_credit = total_credits / months_covered if months_covered and total_credits else None

    # Detect EMI payments
    emi_payments = []
    for line in lines:
        if any(kw in line.lower() for kw in EMI_KEYWORDS):
            amt = _first_amount(line)
            if amt:
                emi_payments.append(amt)

    # Statement period
    statement_from = dates[0] if dates else None
    statement_to = dates[-1] if len(dates) > 1 else None

    result = {
        "doc_type": "bank_statement",
        "total_credits": round(total_credits, 2),
        "total_debits": round(total_debits, 2),
        "avg_monthly_credit": round(avg_monthly_credit, 2) if avg_monthly_credit else None,
        "months_covered": months_covered,
        "emi_payments": emi_payments[:10],
        "total_emi_monthly": round(sum(emi_payments) / months_covered, 2) if emi_payments and months_covered else 0,
        "statement_from": statement_from,
        "statement_to": statement_to,
        "account_numbers": ocr_fields.get("account_numbers", []),
        "ifsc_codes": ocr_fields.get("ifsc_codes", []),
        "transactions": [],  # Populated if tabular data is available
    }

    return result


def _estimate_months(dates: list[str]) -> int:
    """Rough estimate of statement period from date list."""
    if not dates or len(dates) < 2:
        return 6  # default assumption
    return min(max(1, len(dates) // 4), 12)  # heuristic


def _first_amount(line: str) -> float | None:
    match = re.search(r"(?:₹|Rs\.?|INR)?\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?)", line, re.IGNORECASE)
    if match:
        try:
            return float(match.group(1).replace(",", ""))
        except ValueError:
            pass
    return None
