"""
ForgeShield AI — Document Handler: Salary Slip
================================================
Extracts salary-specific fields from OCR text.
"""

from __future__ import annotations

import re
from typing import Any


GROSS_KEYWORDS = ["gross salary", "gross pay", "gross earnings", "total earnings", "ctc"]
NET_KEYWORDS = ["net salary", "net pay", "take home", "net amount", "in hand"]
BASIC_KEYWORDS = ["basic pay", "basic salary", "basic"]
PF_KEYWORDS = ["pf", "provident fund", "epf"]
TDS_KEYWORDS = ["tds", "income tax", "tax deducted"]
EMPLOYER_KEYWORDS = ["company", "employer", "organisation", "organization", "firm"]
EMPLOYEE_KEYWORDS = ["employee name", "name of employee", "employee"]
PERIOD_KEYWORDS = ["pay period", "salary for", "month", "pay date", "payslip for"]


def extract_salary_fields(ocr_fields: dict[str, Any]) -> dict[str, Any]:
    """
    Map generic OCR output to salary-slip-specific structured fields.

    Args:
        ocr_fields: Output of ocr_extractor.extract_key_fields()

    Returns structured salary slip data.
    """
    text = ocr_fields.get("full_text", "")
    lines = ocr_fields.get("raw_lines", [])
    amounts = ocr_fields.get("amounts", [])

    result = {
        "doc_type": "salary_slip",
        "monthly_income": None,        # Gross or Net salary
        "gross_salary": None,
        "net_salary": None,
        "basic_pay": None,
        "pf_deduction": None,
        "tds_deduction": None,
        "employer": ocr_fields.get("employer"),
        "employee_name": None,
        "pan": ocr_fields.get("pans", [None])[0],
        "pay_period": None,
        "employment_date": None,
    }

    text_lower = text.lower()
    for line in lines:
        line_lower = line.lower()
        amount_in_line = _first_amount(line)

        # Gross salary
        if any(kw in line_lower for kw in GROSS_KEYWORDS) and amount_in_line:
            result["gross_salary"] = result["gross_salary"] or amount_in_line

        # Net salary
        if any(kw in line_lower for kw in NET_KEYWORDS) and amount_in_line:
            result["net_salary"] = result["net_salary"] or amount_in_line

        # Basic pay
        if any(kw in line_lower for kw in BASIC_KEYWORDS) and amount_in_line:
            result["basic_pay"] = result["basic_pay"] or amount_in_line

        # PF deduction
        if any(kw in line_lower for kw in PF_KEYWORDS) and amount_in_line:
            result["pf_deduction"] = result["pf_deduction"] or amount_in_line

        # TDS deduction
        if any(kw in line_lower for kw in TDS_KEYWORDS) and amount_in_line:
            result["tds_deduction"] = result["tds_deduction"] or amount_in_line

    # Primary income = gross, fallback to net, fallback to largest amount
    result["monthly_income"] = (
        result["gross_salary"] or
        result["net_salary"] or
        ocr_fields.get("income") or
        (amounts[0] if amounts else None)
    )

    return result


def _first_amount(line: str) -> float | None:
    """Extract the first INR amount from a line."""
    match = re.search(r"(?:₹|Rs\.?|INR)?\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?)", line, re.IGNORECASE)
    if match:
        try:
            return float(match.group(1).replace(",", ""))
        except ValueError:
            pass
    return None
