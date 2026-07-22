"""
ForgeShield AI — Regulatory Compliance & Guideline Engine
=========================================================
Maps detected forensic findings and document inconsistencies to specific Indian banking 
regulations (RBI Master Directions, DPDP Act 2023, PMLA 2002).
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

# Core compliance mapping rules
REGULATORY_MAP = [
    {
        "trigger_type": "IDENTITY_MISMATCH",
        "regulation": "RBI Master Direction on KYC (Section 9 & 38)",
        "details": "Requires banks to verify customer identity using official valid documents (OVDs). Any mismatch requires immediate verification suspension and enhanced due diligence (EDD).",
        "mandated_action": "Freeze verification, request secondary physical verification or video KYC.",
        "act": "PMLA 2002"
    },
    {
        "trigger_type": "ELA_TAMPER_REGION",
        "regulation": "RBI Guidelines on Cyber Security Framework in Banks (Section 3)",
        "details": "Documents showing digital splicing or metadata discrepancies indicate a security breach of electronic data submission channels.",
        "mandated_action": "Flag document as forged, report to branch risk management committee.",
        "act": "Information Technology Act 2000 (Section 66C/66D)"
    },
    {
        "trigger_type": "BENFORDS_LAW_ANOMALY",
        "regulation": "RBI Master Circular on Frauds - Classification and Reporting (Section 3)",
        "details": "Statistically fabricated figures in bank statements indicate intent to defraud. Underwriters must perform forensic inspections of bank entries.",
        "mandated_action": "Initiate mandatory bank verification, request original certified statement.",
        "act": "Indian Penal Code Section 468 (Forgery for Purpose of Cheating)"
    },
    {
        "trigger_type": "REPEATED_AMOUNT_ANOMALY",
        "regulation": "RBI Guidelines on Prevention of Money Laundering (PMLA) Standards",
        "details": "Repeated high-value transaction amounts indicate artificial cash flow inflation or circular transactions.",
        "mandated_action": "Perform transaction velocity check, verify counterparty details.",
        "act": "PMLA 2002"
    },
    {
        "trigger_type": "PDF_TAMPER",
        "regulation": "RBI Directions on Digital Lending (Section 4)",
        "details": "Unauthorized modification layers in digitally submitted PDFs indicate document tampering by third-party agents.",
        "mandated_action": "Reject document, verify details directly with issuing authority (e.g. Income Tax Department / UIDAI).",
        "act": "IT Act 2000 (Section 43)"
    }
]

def check_regulatory_compliance(findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Scans forensic findings and maps them to specific Indian banking regulations.
    Returns:
        list[dict] of compliance violations.
    """
    violations = []
    triggered_types = set()

    for finding in findings:
        check_type = finding.get("check_type") or finding.get("category") or ""
        
        # Determine trigger categories
        trigger = None
        if "MISMATCH" in check_type or "IDENTITY" in check_type:
            trigger = "IDENTITY_MISMATCH"
        elif "ELA" in check_type or "TAMPER" in check_type or "CLONE" in check_type or "COPY_MOVE" in check_type:
            trigger = "ELA_TAMPER_REGION"
        elif "BENFORD" in check_type:
            trigger = "BENFORDS_LAW_ANOMALY"
        elif "REPEATED" in check_type or "ENTROPY" in check_type:
            trigger = "REPEATED_AMOUNT_ANOMALY"
        elif "PDF" in check_type:
            trigger = "PDF_TAMPER"
            
        if trigger and trigger not in triggered_types:
            triggered_types.add(trigger)
            # Find matching rule
            for rule in REGULATORY_MAP:
                if rule["trigger_type"] == trigger:
                    violations.append({
                        "finding_type": trigger,
                        "regulation": rule["regulation"],
                        "details": rule["details"],
                        "mandated_action": rule["mandated_action"],
                        "act": rule["act"]
                    })
                    break

    return violations
