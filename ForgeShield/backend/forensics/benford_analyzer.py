"""
ForgeShield AI — Benford's Law Statistical Analyzer
===================================================
Mathematically analyzes first-digit distributions of monetary values in documents.
Fabricated financial records usually deviate from Benford's natural distribution.
"""

from __future__ import annotations

import re
import collections
import logging

logger = logging.getLogger(__name__)

# Expected frequencies of first digits according to Benford's Law
BENFORDS_EXPECTED = {
    1: 0.301, 2: 0.176, 3: 0.125, 4: 0.097,
    5: 0.079, 6: 0.067, 7: 0.058, 8: 0.051, 9: 0.046
}

# Regex to pull potential monetary values / large numbers
NUMERIC_PATTERN = re.compile(r'(?:Rs\.?|₹|INR)?\s*([\d,]+(?:\.\d{2})?)', re.IGNORECASE)

def run_benfords_analysis(text: str) -> dict | None:
    """
    Perform Benford's Law statistical analysis on numerical values in the text.
    Returns:
        {
            "triggered": bool,
            "chi_sq": float,
            "observed_distribution": dict[int, float],
            "expected_distribution": dict[int, float],
            "severity": str ("HIGH" | "MEDIUM" | "LOW"),
            "confidence": float (0.0 - 1.0),
            "description": str,
            "total_samples": int
        }
    """
    if not text:
        return None

    raw_matches = NUMERIC_PATTERN.findall(text)
    amounts = []
    
    for raw in raw_matches:
        try:
            # Strip commas and convert to float/int
            val_str = raw.replace(',', '')
            if '.' in val_str:
                val = float(val_str)
            else:
                val = int(val_str)
            
            # Look at values >= 100 to avoid small formatting counts/index numbers
            if val >= 100:
                amounts.append(val)
        except ValueError:
            continue

    if len(amounts) < 7:
        # Too few numeric values to perform a valid statistical chi-sq test
        return {
            "triggered": False,
            "chi_sq": 0.0,
            "observed_distribution": {},
            "expected_distribution": {str(k): v for k, v in BENFORDS_EXPECTED.items()},
            "severity": "LOW",
            "confidence": 0.50,
            "description": f"Insufficient numerical samples ({len(amounts)}) to run Benford's Law analysis.",
            "total_samples": len(amounts)
        }

    # Count observed leading digits
    observed_counts = collections.Counter()
    for amt in amounts:
        first_digit = int(str(amt).replace('.', '').lstrip('0')[0])
        if 1 <= first_digit <= 9:
            observed_counts[first_digit] += 1

    total = sum(observed_counts.values())
    if total < 5:
         return {
            "triggered": False,
            "chi_sq": 0.0,
            "observed_distribution": {},
            "expected_distribution": {str(k): v for k, v in BENFORDS_EXPECTED.items()},
            "severity": "LOW",
            "confidence": 0.50,
            "description": "Insufficient valid leading digits to run Benford's Law analysis.",
            "total_samples": total
        }

    observed_distribution = {}
    for d in range(1, 10):
        observed_distribution[str(d)] = round(observed_counts.get(d, 0) / total, 3)

    # Chi-Square goodness-of-fit calculation
    chi_sq = 0.0
    for d in range(1, 10):
        expected_count = total * BENFORDS_EXPECTED[d]
        observed = observed_counts.get(d, 0)
        chi_sq += ((observed - expected_count) ** 2) / expected_count

    # Critical values for 8 degrees of freedom:
    # χ² > 15.51 (p < 0.05) -> high warning
    # χ² > 20.09 (p < 0.01) -> critical warning
    triggered = chi_sq > 15.51
    severity = "INFO"
    confidence = 0.80
    description = f"Benford's Law check passed (χ² = {chi_sq:.2f}). Numerical frequencies match natural patterns."

    if chi_sq > 20.09:
        severity = "HIGH"
        confidence = min(0.99, 0.70 + (chi_sq - 20.09) / 50)
        description = (
            f"Benford's Law violation: Distribution of {total} monetary amounts deviates critically "
            f"from natural financial data (χ² = {chi_sq:.2f}, threshold = 20.09). "
            "This is a statistical signature of fabricated or manually-entered numbers."
        )
    elif chi_sq > 15.51:
        severity = "MEDIUM"
        confidence = 0.75
        description = (
            f"Benford's Law warning: Moderate deviation in {total} monetary numbers "
            f"(χ² = {chi_sq:.2f}, threshold = 15.51). May indicate partially manipulated or templated financial data."
        )

    return {
        "triggered": triggered,
        "chi_sq": round(chi_sq, 2),
        "observed_distribution": observed_distribution,
        "expected_distribution": {str(k): v for k, v in BENFORDS_EXPECTED.items()},
        "severity": severity,
        "confidence": round(confidence, 2),
        "description": description,
        "total_samples": total
    }
