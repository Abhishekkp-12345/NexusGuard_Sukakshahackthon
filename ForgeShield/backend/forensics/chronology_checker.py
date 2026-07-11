"""
ForgeShield AI — Layer 2.5: Chronology & Date Anomaly Checker
=============================================================
Analyzes dates extracted from applicant documents to detect:
  • Age eligibility (< 18 or > 100 years old)
  • Conflicting DOBs across identity documents
  • Timeline loops (e.g. document issue date before Date of Birth)
  • Future dated documents (issue date after current date)
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any
import dateutil.parser

logger = logging.getLogger(__name__)

def check_chronology(processed_docs: list[dict], case_created_at: str | None) -> dict[str, Any]:
    findings = []
    timeline = []
    
    # Parse case creation date
    now = datetime.utcnow()
    case_date = now
    if case_created_at:
        try:
            case_date = dateutil.parser.parse(case_created_at).replace(tzinfo=None)
        except Exception:
            pass

    # Step 1: Gather DOBs and document dates
    dobs: dict[str, tuple[str, str]] = {}  # doc_filename -> (dob_str, parsed_date)
    doc_dates: list[dict[str, Any]] = []

    for doc in processed_docs:
        fields = doc.get("fields", {})
        filename = doc.get("filename", "Unknown Document")
        doc_type = doc.get("type", "unknown")

        # Extract DOB if present
        raw_dob = fields.get("dob")
        if raw_dob:
            parsed = _parse_date_safe(raw_dob)
            if parsed:
                dobs[filename] = (raw_dob, parsed)
                timeline.append({
                    "date": parsed.strftime("%Y-%m-%d"),
                    "label": f"Date of Birth (from {doc_type.upper().replace('_', ' ')})",
                    "type": "dob",
                    "filename": filename
                })

        # Extract Document Date if present
        raw_doc_date = fields.get("doc_date")
        if raw_doc_date:
            parsed = _parse_date_safe(raw_doc_date)
            if parsed:
                doc_dates.append({
                    "filename": filename,
                    "type": doc_type,
                    "raw": raw_doc_date,
                    "parsed": parsed
                })
                timeline.append({
                    "date": parsed.strftime("%Y-%m-%d"),
                    "label": f"{doc_type.upper().replace('_', ' ')} Issue/Activity Date",
                    "type": "document",
                    "filename": filename
                })

    # Timeline event for case creation
    timeline.append({
        "date": case_date.strftime("%Y-%m-%d"),
        "label": "Loan Case Submitted",
        "type": "case_created",
        "filename": "System Log"
    })

    # Step 2: Validate DOB conflicts
    if dobs:
        unique_parsed_dobs = set(val[1] for val in dobs.values())
        if len(unique_parsed_dobs) > 1:
            conflict_details = ", ".join(f"'{fn}': {str_val}" for fn, (str_val, _) in dobs.items())
            findings.append({
                "type": "CHRONOLOGY_CONFLICT",
                "severity": "HIGH",
                "detail": f"Conflicting Dates of Birth found across identity documents: {conflict_details}. This is a strong tampering/identity fraud indicator."
            })
        
        # Check age at submission using the first parsed DOB
        dob_filename, (dob_str, parsed_dob) = list(dobs.items())[0]
        age_at_submission = (case_date - parsed_dob).days / 365.25
        
        if age_at_submission < 18:
            findings.append({
                "type": "CHRONOLOGY_AGE_LIMIT",
                "severity": "HIGH",
                "detail": f"Applicant age is under 18 (computed age: {age_at_submission:.1f} years) based on DOB '{dob_str}' in '{dob_filename}'."
            })
        elif age_at_submission > 100:
            findings.append({
                "type": "CHRONOLOGY_AGE_LIMIT",
                "severity": "MEDIUM",
                "detail": f"Applicant age is suspiciously high (computed age: {age_at_submission:.1f} years) based on DOB '{dob_str}' in '{dob_filename}'."
            })

    # Step 3: Validate Issue Date anomalies
    # Check if any document date is before the DOB
    if dobs and doc_dates:
        _, (_, parsed_dob) = list(dobs.items())[0]
        for dd in doc_dates:
            if dd["parsed"] < parsed_dob:
                findings.append({
                    "type": "CHRONOLOGY_IMPOSSIBILITY",
                    "severity": "HIGH",
                    "detail": f"Document '{dd['filename']}' activity/issue date ({dd['raw']}) is before the applicant's Date of Birth ({parsed_dob.strftime('%d/%m/%Y')})."
                })

    # Check if any document date is in the future
    for dd in doc_dates:
        if dd["parsed"] > case_date:
            days_future = (dd["parsed"] - case_date).days
            if days_future > 1: # Allow timezone buffer
                findings.append({
                    "type": "CHRONOLOGY_FUTURE_DATE",
                    "severity": "HIGH",
                    "detail": f"Document '{dd['filename']}' activity date ({dd['raw']}) is in the future relative to the loan submission date."
                })

    # Sort timeline chronologically
    timeline = sorted(timeline, key=lambda x: x["date"])

    return {
        "findings": findings,
        "timeline": timeline
    }

def _parse_date_safe(date_str: str) -> datetime | None:
    if not date_str:
        return None
    try:
        # Standard parsing with dayfirst=True since Indian format is typically DD/MM/YYYY
        return dateutil.parser.parse(date_str.strip(), dayfirst=True).replace(tzinfo=None)
    except Exception:
        # Fallback regex search for DD/MM/YYYY or DD-MM-YYYY
        match = re.search(r"\b(\d{2})[/\-](\d{2})[/\-](\d{4})\b", date_str)
        if match:
            try:
                d, m, y = map(int, match.groups())
                return datetime(y, m, d)
            except ValueError:
                pass
        return None
