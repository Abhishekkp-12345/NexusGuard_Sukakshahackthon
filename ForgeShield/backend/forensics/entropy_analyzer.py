"""
ForgeShield AI — Numeric Entropy & Anomaly Analyzer
===================================================
Analyzes numerical distributions to detect pattern anomalies:
  1. High frequency repetition (template copy-paste replication).
  2. Round-number concentration (manually fabricated statements).
  3. Computational mathematical inconsistencies.
"""

from __future__ import annotations

import re
import collections
import logging

logger = logging.getLogger(__name__)

# Regex pattern to match amounts
AMOUNT_PATTERN = re.compile(r'(?:Rs\.?|₹|INR)?\s*([\d,]+(?:\.\d{2})?)', re.IGNORECASE)

def check_numeric_entropy(text: str) -> list[dict]:
    """
    Scans document text for suspicious numeric entropy and amount patterns.
    """
    signals = []
    if not text:
        return signals

    raw_matches = AMOUNT_PATTERN.findall(text)
    amounts = []
    
    for raw in raw_matches:
        try:
            val_str = raw.replace(',', '')
            if '.' in val_str:
                val = float(val_str)
            else:
                val = int(val_str)
            
            # Focus on values >= 1000 to analyze actual transaction amounts
            if val >= 1000:
                amounts.append(val)
        except ValueError:
            continue

    if not amounts:
        return signals

    # 1. High frequency repetition check
    freq = collections.Counter(amounts)
    duplicates = [(amt, cnt) for amt, cnt in freq.items() if cnt >= 3 and amt > 10000]
    
    if duplicates:
        worst = max(duplicates, key=lambda x: x[1])
        signals.append({
            "type": "REPEATED_AMOUNT_ANOMALY",
            "severity": "HIGH",
            "confidence": min(0.95, 0.60 + worst[1] * 0.05),
            "description": (
                f"Numeric anomaly: Amount ₹{worst[0]:,} appears {worst[1]} times. "
                "Unusual repetitions of identical high-value amounts suggests template-based fabrication."
            ),
            "value": f"Amount: ₹{worst[0]:,}, count: {worst[1]}"
        })

    # 2. Round-number concentration check
    if len(amounts) >= 5:
        # Check if more than 60% of values are multiples of 5000
        round_count = sum(1 for a in amounts if a % 5000 == 0)
        round_ratio = round_count / len(amounts)
        
        if round_ratio > 0.60:
            signals.append({
                "type": "ROUND_NUMBER_CONCENTRATION",
                "severity": "MEDIUM",
                "confidence": min(0.90, 0.55 + round_ratio * 0.35),
                "description": (
                    f"Statistical alert: {round_count}/{len(amounts)} ({round_ratio*100:.0f}%) of monetary amounts "
                    "are exact multiples of ₹5,000. Genuine financial flows contain irregular numbers; "
                    "this concentration indicates manually fabricated values."
                ),
                "value": f"ratio: {round_ratio:.2f}"
            })

    # 3. Arithmetic totals sanity check (if it's a tax return or salary slip)
    gti_match = re.search(r'(?:gross|total)\s+(?:income|salary)\s+(?:is|of|Rs\.?|₹)?\s*([\d,]+)', text, re.IGNORECASE)
    ded_match = re.search(r'(?:deduction|exempt|sec\s*80)\s+(?:is|of|Rs\.?|₹)?\s*([\d,]+)', text, re.IGNORECASE)
    
    if gti_match and ded_match:
        try:
            gti = float(gti_match.group(1).replace(',', ''))
            ded = float(ded_match.group(1).replace(',', ''))
            
            if ded > gti:
                signals.append({
                    "type": "ARITHMETIC_CONTRADICTION",
                    "severity": "HIGH",
                    "confidence": 0.99,
                    "description": (
                        f"Arithmetic conflict: Declared deductions (₹{ded:,.2f}) exceed gross total income "
                        f"(₹{gti:,.2f}). Computational math check failed."
                    ),
                    "value": f"Deductions {ded} > Income {gti}"
                })
        except ValueError:
            pass

    return signals
