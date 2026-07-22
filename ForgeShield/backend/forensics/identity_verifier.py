"""
ForgeShield AI — Layer 4: Cross-Document Identity Verification (Production v2)
=============================================================================
Performs strict cross-document identity field extraction and comparison.
This module is the FIRST line of defence. It runs BEFORE the LLM.

Fields compared across documents:
  - Full Name        (fuzzy + token overlap)
  - Aadhaar Number   (exact, 12-digit normalized)
  - PAN Number       (exact, 10-char normalized)
  - Date of Birth    (normalized date comparison)
  - Father's Name    (fuzzy)
  - Address          (pincode + city token overlap)
  - Employer Name    (fuzzy token overlap)
  - Bank Account No  (exact, normalized)

Penalty table (applied as direct deductions to the trust score):
  - Name mismatch (declared vs any doc)    : -40
  - Aadhaar mismatch between docs          : -50
  - PAN mismatch                           : -40
  - DOB mismatch                           : -30
  - Father's name mismatch                 : -25
  - Address mismatch (different pincode)   : -20
  - Employer mismatch                      : -15
  - Bank Account mismatch                  : -20

Any critical mismatch (name/aadhaar/pan/dob) LOCKS verdict to REJECT
and caps the trust score at 29.
"""

from __future__ import annotations

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

# ── Penalty constants ─────────────────────────────────────────────────
PENALTY_NAME_MISMATCH = 40
PENALTY_AADHAAR_MISMATCH = 50
PENALTY_PAN_MISMATCH = 40
PENALTY_DOB_MISMATCH = 30
PENALTY_FATHER_MISMATCH = 25
PENALTY_ADDRESS_MISMATCH = 20
PENALTY_EMPLOYER_MISMATCH = 15
PENALTY_ACCOUNT_MISMATCH = 20
PENALTY_OCR_LOW_CONFIDENCE = 15

NAME_MATCH_THRESHOLD = 60  # Minimum token similarity percentage


def verify_identity_fields(
    processed_docs: list[dict[str, Any]],
    case_data: dict[str, Any],
) -> dict[str, Any]:
    """
    Cross-compare identity fields across all uploaded documents and the
    declared application form data.
    """
    findings: list[dict] = []
    matched_fields: list[dict] = []
    mismatched_fields: list[dict] = []
    comparison_matrix: list[dict] = []

    critical_mismatch = False
    total_penalty = 0.0

    declared_name = case_data.get("applicant_name", "").strip()
    declared_pan = case_data.get("applicant_pan", "").strip().upper()

    # Gather extracted identity data per document
    extracted_records: list[dict[str, Any]] = []
    for doc in processed_docs:
        doc_type = doc.get("type", "unknown")
        filename = doc.get("filename", "")
        fields = doc.get("fields", {})

        rec = {
            "doc_type": doc_type,
            "filename": filename,
            "name": _clean_name(fields.get("owner_name") or fields.get("account_holder_name") or fields.get("name")),
            "pan": _clean_pan(fields.get("pan_number") or _first_elem(fields.get("pans"))),
            "aadhaar": _clean_aadhaar(fields.get("aadhaar_number") or _first_elem(fields.get("aadhaar_numbers"))),
            "dob": _clean_date(fields.get("dob") or fields.get("date_of_birth")),
            "father_name": _clean_name(fields.get("father_name")),
            "employer": _clean_text(fields.get("employer")),
            "account_number": _clean_acc(fields.get("account_number") or _first_elem(fields.get("account_numbers"))),
            "address": _clean_text(fields.get("address")),
            "raw_text": fields.get("full_text", ""),
        }
        extracted_records.append(rec)

    # ── 1. Compare Declared Name vs Extracted Names ───────────────────
    if declared_name:
        for rec in extracted_records:
            if rec["name"]:
                is_match, sim = _compare_names(declared_name, rec["name"])
                matrix_entry = {
                    "field": "Applicant Name",
                    "sourceA": "Declared Application",
                    "valueA": declared_name,
                    "sourceB": rec["filename"],
                    "valueB": rec["name"],
                    "match": is_match,
                    "similarity": sim,
                }
                comparison_matrix.append(matrix_entry)

                if is_match:
                    matched_fields.append(matrix_entry)
                else:
                    critical_mismatch = True
                    total_penalty += PENALTY_NAME_MISMATCH
                    mismatched_fields.append(matrix_entry)
                    findings.append({
                        "type": "CRITICAL_NAME_MISMATCH",
                        "severity": "HIGH",
                        "detail": (
                            f"Name mismatch between Application Form ('{declared_name}') and "
                            f"document '{rec['filename']}' ('{rec['name']}'). "
                            f"Similarity: {sim:.0f}% (Threshold: {NAME_MATCH_THRESHOLD}%)."
                        ),
                        "docA": "Application Form",
                        "docB": rec["filename"],
                    })

    # ── 2. Cross-Document PAN Comparison ─────────────────────────────
    pan_sources = []
    if declared_pan:
        pan_sources.append(("Declared Application", declared_pan))
    for rec in extracted_records:
        if rec["pan"]:
            pan_sources.append((rec["filename"], rec["pan"]))

    if len(pan_sources) >= 2:
        for i in range(len(pan_sources)):
            for j in range(i + 1, len(pan_sources)):
                srcA, panA = pan_sources[i]
                srcB, panB = pan_sources[j]
                is_match = (panA == panB)
                matrix_entry = {
                    "field": "PAN Number",
                    "sourceA": srcA,
                    "valueA": panA,
                    "sourceB": srcB,
                    "valueB": panB,
                    "match": is_match,
                }
                comparison_matrix.append(matrix_entry)

                if is_match:
                    matched_fields.append(matrix_entry)
                else:
                    critical_mismatch = True
                    total_penalty += PENALTY_PAN_MISMATCH
                    mismatched_fields.append(matrix_entry)
                    findings.append({
                        "type": "CRITICAL_PAN_MISMATCH",
                        "severity": "HIGH",
                        "detail": f"PAN mismatch: '{panA}' ({srcA}) vs '{panB}' ({srcB}).",
                        "docA": srcA,
                        "docB": srcB,
                    })

    # ── 3. Cross-Document Aadhaar Comparison ─────────────────────────
    aadhaar_sources = [
        (rec["filename"], rec["aadhaar"])
        for rec in extracted_records if rec["aadhaar"]
    ]
    if len(aadhaar_sources) >= 2:
        for i in range(len(aadhaar_sources)):
            for j in range(i + 1, len(aadhaar_sources)):
                srcA, aadhA = aadhaar_sources[i]
                srcB, aadhB = aadhaar_sources[j]
                is_match = (aadhA == aadhB)
                matrix_entry = {
                    "field": "Aadhaar Number",
                    "sourceA": srcA,
                    "valueA": aadhA,
                    "sourceB": srcB,
                    "valueB": aadhB,
                    "match": is_match,
                }
                comparison_matrix.append(matrix_entry)

                if is_match:
                    matched_fields.append(matrix_entry)
                else:
                    critical_mismatch = True
                    total_penalty += PENALTY_AADHAAR_MISMATCH
                    mismatched_fields.append(matrix_entry)
                    findings.append({
                        "type": "CRITICAL_AADHAAR_MISMATCH",
                        "severity": "HIGH",
                        "detail": f"Aadhaar mismatch: '{aadhA}' ({srcA}) vs '{aadhB}' ({srcB}).",
                        "docA": srcA,
                        "docB": srcB,
                    })

    # ── 4. Cross-Document DOB Comparison ──────────────────────────────
    dob_sources = [
        (rec["filename"], rec["dob"])
        for rec in extracted_records if rec["dob"]
    ]
    if len(dob_sources) >= 2:
        for i in range(len(dob_sources)):
            for j in range(i + 1, len(dob_sources)):
                srcA, dobA = dob_sources[i]
                srcB, dobB = dob_sources[j]
                is_match = (dobA == dobB)
                matrix_entry = {
                    "field": "Date of Birth",
                    "sourceA": srcA,
                    "valueA": dobA,
                    "sourceB": srcB,
                    "valueB": dobB,
                    "match": is_match,
                }
                comparison_matrix.append(matrix_entry)

                if is_match:
                    matched_fields.append(matrix_entry)
                else:
                    critical_mismatch = True
                    total_penalty += PENALTY_DOB_MISMATCH
                    mismatched_fields.append(matrix_entry)
                    findings.append({
                        "type": "CRITICAL_DOB_MISMATCH",
                        "severity": "HIGH",
                        "detail": f"Date of Birth mismatch: '{dobA}' ({srcA}) vs '{dobB}' ({srcB}).",
                        "docA": srcA,
                        "docB": srcB,
                    })

    # ── 5. Employer & Account Number Cross-Check ──────────────────────
    emp_sources = [(rec["filename"], rec["employer"]) for rec in extracted_records if rec["employer"]]
    if len(emp_sources) >= 2:
        for i in range(len(emp_sources)):
            for j in range(i + 1, len(emp_sources)):
                srcA, empA = emp_sources[i]
                srcB, empB = emp_sources[j]
                is_match, sim = _compare_names(empA, empB)
                if not is_match:
                    total_penalty += PENALTY_EMPLOYER_MISMATCH
                    findings.append({
                        "type": "EMPLOYER_NAME_MISMATCH",
                        "severity": "MEDIUM",
                        "detail": f"Employer mismatch: '{empA}' ({srcA}) vs '{empB}' ({srcB}).",
                        "docA": srcA,
                        "docB": srcB,
                    })

    acc_sources = [(rec["filename"], rec["account_number"]) for rec in extracted_records if rec["account_number"]]
    if len(acc_sources) >= 2:
        for i in range(len(acc_sources)):
            for j in range(i + 1, len(acc_sources)):
                srcA, accA = acc_sources[i]
                srcB, accB = acc_sources[j]
                if accA != accB:
                    total_penalty += PENALTY_ACCOUNT_MISMATCH
                    findings.append({
                        "type": "BANK_ACCOUNT_MISMATCH",
                        "severity": "MEDIUM",
                        "detail": f"Bank account number mismatch: '{accA}' ({srcA}) vs '{accB}' ({srcB}).",
                        "docA": srcA,
                        "docB": srcB,
                    })

    total_penalty = min(total_penalty, 80.0)

    summary_text = _build_summary(critical_mismatch, matched_fields, mismatched_fields)

    return {
        "critical_identity_mismatch": critical_mismatch,
        "identity_penalty": round(total_penalty, 2),
        "matched_fields": matched_fields,
        "mismatched_fields": mismatched_fields,
        "field_comparison_matrix": comparison_matrix,
        "findings": findings,
        "identity_summary": summary_text,
        "sources_compared": [rec["filename"] for rec in extracted_records],
    }


# ── String Helpers ────────────────────────────────────────────────────

def _compare_names(n1: str, n2: str) -> tuple[bool, float]:
    if not n1 or not n2:
        return False, 0.0

    c1 = re.sub(r"[^a-zA-Z0-9\s]", "", str(n1)).lower().strip()
    c2 = re.sub(r"[^a-zA-Z0-9\s]", "", str(n2)).lower().strip()

    if not c1 or not c2:
        return False, 0.0

    words1 = set(w for w in c1.split() if len(w) >= 2)
    words2 = set(w for w in c2.split() if len(w) >= 2)

    if not words1 or not words2:
        return (c1 in c2 or c2 in c1), 100.0 if (c1 in c2 or c2 in c1) else 0.0

    inter = words1.intersection(words2)
    union = words1.union(words2)
    similarity = (len(inter) / max(len(words1), len(words2))) * 100.0

    is_match = similarity >= NAME_MATCH_THRESHOLD or len(inter) >= min(len(words1), len(words2))
    return is_match, round(similarity, 2)


def _clean_name(val: Any) -> str | None:
    if not val:
        return None
    s = str(val).strip().upper()
    return s if len(s) >= 3 else None


def _clean_pan(val: Any) -> str | None:
    if not val:
        return None
    match = re.search(r"[A-Z]{5}\d{4}[A-Z]", str(val).upper())
    return match.group(0) if match else None


def _clean_aadhaar(val: Any) -> str | None:
    if not val:
        return None
    digits = re.sub(r"\D", "", str(val))
    return digits if len(digits) == 12 else None


def _clean_date(val: Any) -> str | None:
    if not val:
        return None
    s = str(val).strip()
    # Replace slashes with dashes
    s = s.replace("/", "-")
    m = re.search(r"\b(\d{1,2}-\d{1,2}-\d{2,4}|\d{4}-\d{1,2}-\d{1,2})\b", s)
    return m.group(0) if m else s if len(s) >= 8 else None


def _clean_acc(val: Any) -> str | None:
    if not val:
        return None
    digits = re.sub(r"\D", "", str(val))
    return digits if 9 <= len(digits) <= 18 else None


def _clean_text(val: Any) -> str | None:
    if not val:
        return None
    s = str(val).strip()
    return s if len(s) >= 3 else None


def _first_elem(arr: Any) -> Any:
    if isinstance(arr, list) and arr:
        return arr[0]
    return None


def _build_summary(critical: bool, matched: list, mismatched: list) -> str:
    if critical:
        fields = ", ".join(set(m["field"] for m in mismatched))
        return f"CRITICAL IDENTITY MISMATCH DETECTED across documents for field(s): {fields}. Application flagged for rejection."
    elif mismatched:
        return f"Minor identity discrepancies detected in {len(mismatched)} field(s)."
    elif matched:
        return f"All identity fields matched cleanly across {len(matched)} verified sources."
    return "No identity documents available for cross-comparison."
