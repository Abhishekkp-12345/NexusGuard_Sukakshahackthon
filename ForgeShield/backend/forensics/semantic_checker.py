"""
ForgeShield AI — Layer 2: Cross-Document Semantic Checker
===========================================================
Validates consistency ACROSS all submitted documents.

Checks:
  1. Income Consistency: Salary Slip ↔ Bank Statement monthly credits ↔ ITR annual
  2. Date Logic: Employment date before loan date, statement covers recent months
  3. Balance Math: Bank statement running totals add up correctly
  4. Land Valuation: Declared value vs. market stamp duty rates
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from config import settings

logger = logging.getLogger(__name__)


def check_cross_document_consistency(documents: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Run all cross-document validation checks.

    Args:
        documents: List of processed document dicts, each with:
            {
                "type": "salary_slip" | "bank_statement" | "itr" | "land_record",
                "fields": { ... extracted fields ... }
            }

    Returns:
        {
            "consistency_score": float (0–100),
            "findings": list[Finding],
            "income_analysis": dict,
            "date_analysis": dict,
        }
    """
    findings = []
    flags = []
    income_analysis = {}
    date_analysis = {}

    # Organise by type
    doc_map: dict[str, dict] = {}
    for doc in documents:
        doc_type = doc.get("type", "unknown")
        doc_map[doc_type] = doc.get("fields", {})

    # ── Check 1: Income Consistency ──────────────────────────────────
    income_result = _check_income_consistency(doc_map)
    findings.extend(income_result["findings"])
    flags.extend(income_result["flags"])
    income_analysis = income_result

    # ── Check 2: Date Logic ──────────────────────────────────────────
    date_result = _check_date_logic(doc_map)
    findings.extend(date_result["findings"])
    flags.extend(date_result["flags"])
    date_analysis = date_result

    # ── Check 3: Balance Math (bank statement) ───────────────────────
    if "bank_statement" in doc_map:
        balance_result = _check_balance_math(doc_map["bank_statement"])
        findings.extend(balance_result["findings"])
        flags.extend(balance_result["flags"])

    # ── Check 4: Land Valuation ──────────────────────────────────────
    if "land_record" in doc_map:
        land_result = _check_land_valuation(doc_map["land_record"])
        findings.extend(land_result["findings"])
        flags.extend(land_result["flags"])

    # ── Compute Score ────────────────────────────────────────────────
    score = _compute_consistency_score(flags)

    return {
        "consistency_score": score,
        "flags": flags,
        "findings": findings,
        "income_analysis": income_analysis,
        "date_analysis": date_analysis,
    }


def _check_income_consistency(doc_map: dict) -> dict:
    """Compare income figures across salary slip, bank statement, and ITR."""
    findings = []
    flags = []

    salary_income = None
    bank_avg_credit = None
    itr_monthly = None

    if "salary_slip" in doc_map:
        salary_income = doc_map["salary_slip"].get("monthly_income") or doc_map["salary_slip"].get("income")

    if "bank_statement" in doc_map:
        bank_avg_credit = doc_map["bank_statement"].get("avg_monthly_credit")
        # If not pre-computed, try to derive from total_credits
        if not bank_avg_credit:
            total = doc_map["bank_statement"].get("total_credits", 0)
            months = doc_map["bank_statement"].get("months_covered", 6)
            if total and months:
                bank_avg_credit = total / months

    if "itr" in doc_map:
        annual = doc_map["itr"].get("annual_income")
        if annual:
            itr_monthly = annual / 12

    incomes = {k: v for k, v in {
        "Salary Slip": salary_income,
        "Bank Credits (avg/month)": bank_avg_credit,
        "ITR (monthly equivalent)": itr_monthly,
    }.items() if v}

    if len(incomes) < 2:
        return {
            "findings": [{
                "type": "INSUFFICIENT_INCOME_DATA",
                "severity": "LOW",
                "detail": "Only one income source available; cross-validation skipped."
            }],
            "flags": [],
            "incomes": incomes,
        }

    # Compare each pair
    income_values = list(incomes.values())
    max_income = max(income_values)
    min_income = min(income_values)

    if max_income > 0:
        deviation = (max_income - min_income) / max_income

        if deviation > settings.INCOME_DEVIATION_THRESHOLD:
            severity = "HIGH" if deviation > 0.5 else "MEDIUM"
            pct = round(deviation * 100, 1)

            # Describe which direction the inflation is
            detail_parts = [f"Income mismatch across {len(incomes)} sources ({pct}% deviation):"]
            for name, val in incomes.items():
                detail_parts.append(f"  • {name}: ₹{val:,.0f}/month")
            if salary_income and bank_avg_credit and salary_income > bank_avg_credit * (1 + settings.INCOME_DEVIATION_THRESHOLD):
                detail_parts.append(
                    f"  → Declared salary is {round(salary_income/bank_avg_credit, 1)}x higher than actual bank credits. "
                    "Strong income inflation signal."
                )

            flags.append("income_mismatch")
            findings.append({
                "type": "INCOME_INCONSISTENCY",
                "severity": severity,
                "detail": "\n".join(detail_parts),
                "deviation_pct": pct,
                "sources": incomes,
            })
        else:
            findings.append({
                "type": "INCOME_CONSISTENT",
                "severity": "INFO",
                "detail": f"Income figures across {len(incomes)} sources are consistent (within {round(deviation*100,1)}%).",
                "sources": incomes,
            })

    return {"findings": findings, "flags": flags, "incomes": incomes}


def _check_date_logic(doc_map: dict) -> dict:
    """Validate date relationships across documents."""
    findings = []
    flags = []

    loan_date = None
    employment_date = None
    statement_start = None
    statement_end = None

    if "salary_slip" in doc_map:
        employment_date_str = doc_map["salary_slip"].get("employment_date") or doc_map["salary_slip"].get("joining_date")
        employment_date = _safe_parse_date(employment_date_str)

    if "bank_statement" in doc_map:
        statement_start = _safe_parse_date(doc_map["bank_statement"].get("statement_from"))
        statement_end = _safe_parse_date(doc_map["bank_statement"].get("statement_to"))

    # Check: bank statement should cover last 6 months
    if statement_end:
        now = datetime.utcnow()
        gap_months = (now.year - statement_end.year) * 12 + (now.month - statement_end.month)
        if gap_months > 3:
            flags.append("outdated_statement")
            findings.append({
                "type": "OUTDATED_BANK_STATEMENT",
                "severity": "MEDIUM",
                "detail": (
                    f"Bank statement ends on {statement_end.strftime('%Y-%m-%d')}, "
                    f"which is {gap_months} months ago. Banks typically require last 6 months."
                ),
            })

    # Check: employment date before loan application
    if employment_date and employment_date > datetime.utcnow():
        flags.append("future_employment_date")
        findings.append({
            "type": "INVALID_DATE",
            "severity": "HIGH",
            "detail": f"Employment start date {employment_date.strftime('%Y-%m-%d')} is in the future.",
        })

    if not findings:
        findings.append({
            "type": "DATE_LOGIC_OK",
            "severity": "INFO",
            "detail": "Date relationships are consistent across submitted documents.",
        })

    return {"findings": findings, "flags": flags}


def _check_balance_math(bank_fields: dict) -> dict:
    """Verify bank statement running balance arithmetic."""
    findings = []
    flags = []

    transactions = bank_fields.get("transactions", [])
    if not transactions or len(transactions) < 3:
        return {"findings": [], "flags": []}

    errors = []
    for i in range(1, len(transactions)):
        prev = transactions[i - 1]
        curr = transactions[i]
        expected_balance = prev.get("balance", 0) + curr.get("credit", 0) - curr.get("debit", 0)
        actual_balance = curr.get("balance", expected_balance)
        diff = abs(expected_balance - actual_balance)
        if diff > settings.BALANCE_MATH_TOLERANCE:
            errors.append({
                "row": i + 1,
                "expected": expected_balance,
                "actual": actual_balance,
                "diff": diff,
            })

    if errors:
        flags.append("balance_math_error")
        findings.append({
            "type": "BALANCE_MATH_ERROR",
            "severity": "HIGH",
            "detail": (
                f"Balance arithmetic errors found in {len(errors)} transaction rows. "
                f"First error at row {errors[0]['row']}: expected ₹{errors[0]['expected']:,.2f}, "
                f"found ₹{errors[0]['actual']:,.2f} (diff: ₹{errors[0]['diff']:,.2f})."
            ),
            "error_count": len(errors),
        })

    return {"findings": findings, "flags": flags}


def _check_land_valuation(land_fields: dict) -> dict:
    """Compare declared land value against market stamp duty rates."""
    findings = []
    flags = []

    declared = land_fields.get("declared_value")
    area_sqft = land_fields.get("area_sqft")
    location = land_fields.get("location", "")

    # Simple market rate lookup (INR per sqft by city tier)
    MARKET_RATES = {
        "bangalore": 6000, "bengaluru": 6000,
        "mumbai": 15000, "delhi": 10000,
        "chennai": 5500, "hyderabad": 5000,
        "pune": 6500, "kolkata": 4500,
        "default": 4000,
    }

    if declared and area_sqft:
        rate_key = "default"
        for city in MARKET_RATES:
            if city in location.lower():
                rate_key = city
                break
        market_rate = MARKET_RATES[rate_key]
        market_value = area_sqft * market_rate
        deviation = abs(declared - market_value) / market_value if market_value else 0

        if deviation > settings.LAND_VALUATION_DEVIATION:
            flags.append("land_valuation_outlier")
            direction = "overvalued" if declared > market_value else "undervalued"
            findings.append({
                "type": "LAND_VALUATION_OUTLIER",
                "severity": "HIGH" if deviation > 0.5 else "MEDIUM",
                "detail": (
                    f"Declared land value ₹{declared:,.0f} is {direction} by "
                    f"{round(deviation*100,1)}% vs. market rate "
                    f"(₹{market_rate:,}/sqft × {area_sqft} sqft = ₹{market_value:,.0f})."
                ),
                "declared_value": declared,
                "market_estimate": market_value,
            })

    return {"findings": findings, "flags": flags}


def _compute_consistency_score(flags: list[str]) -> float:
    penalties = {
        "income_mismatch": 30,
        "balance_math_error": 25,
        "land_valuation_outlier": 20,
        "outdated_statement": 10,
        "future_employment_date": 25,
    }
    total_penalty = sum(penalties.get(f, 10) for f in flags)
    return max(0.0, round(100.0 - total_penalty, 2))


def _safe_parse_date(date_str: str | None) -> datetime | None:
    if not date_str:
        return None
    formats = ["%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%d %b %Y", "%b %Y"]
    for fmt in formats:
        try:
            return datetime.strptime(str(date_str).strip()[:20], fmt)
        except ValueError:
            continue
    return None
