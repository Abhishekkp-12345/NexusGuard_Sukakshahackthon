"""
ForgeShield AI — Layer 2: Cross-Document Consistency Engine
===========================================================
Deterministic verification engine that validates information across all
submitted documents and declared details.

Detects Name, PAN, Aadhaar, DOB, Address, Salary, Employer, Bank Account,
IFSC, and GSTIN mismatches without relying on the LLM.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any

from config import settings

logger = logging.getLogger(__name__)


def compare_names(n1: str, n2: str) -> tuple[bool, float]:
    """
    Compare two names for overlap and similarity.
    Returns (is_match, similarity_percentage).
    """
    if not n1 or not n2:
        return False, 0.0
    
    # Normalize strings (remove punctuation, lowercase)
    clean1 = re.sub(r"[^a-zA-Z0-9\s]", "", str(n1)).lower().strip()
    clean2 = re.sub(r"[^a-zA-Z0-9\s]", "", str(n2)).lower().strip()
    
    if not clean1 or not clean2:
        return False, 0.0
        
    words1 = [w for w in clean1.split() if len(w) >= 3]
    words2 = [w for w in clean2.split() if len(w) >= 3]
    
    # Fallback to simple substring checks if name has short tokens (e.g. initials)
    if not words1 or not words2:
        if clean1 in clean2 or clean2 in clean1:
            return True, 100.0
        return False, 0.0
        
    set1 = set(words1)
    set2 = set(words2)
    
    intersection = set1.intersection(set2)
    union = set1.union(set2)
    similarity = len(intersection) / max(len(set1), len(set2))
    
    # Match if similarity is high or there is perfect subset overlap
    is_match = similarity >= 0.6 or len(intersection) >= min(len(set1), len(set2))
    return is_match, round(similarity * 100, 2)


def check_cross_document_consistency(
    documents: list[dict[str, Any]],
    case_data: dict[str, Any] = None
) -> dict[str, Any]:
    """
    Orchestrate deterministic cross-document field validation.
    """
    findings = []
    flags = []
    cells = []
    
    # Gather declared details
    declared = {}
    applicant_name = None
    applicant_pan = None
    applicant_type = "corporate"
    
    if case_data:
        applicant_name = case_data.get("applicant_name")
        applicant_pan = case_data.get("applicant_pan")
        applicant_type = case_data.get("applicant_type", "corporate")
        declared = case_data.get("declared_details", {})
    
    # Document mapping
    doc_map: dict[str, dict] = {}
    for doc in documents:
        doc_type = doc.get("type", "unknown")
        doc_map[doc_type] = doc
        
    # Helper to map doc types to friendly labels
    friendly_names = {
        "declared": "Application Form",
        "aadhaar_card": "Aadhaar Card",
        "pan_card": "PAN Card",
        "salary_slip": "Salary Slip",
        "bank_statement": "Bank Statement",
        "itr": "ITR (Form 16)",
        "land_record": "Land Record",
        "driving_license": "Driving License",
        "bank_passbook": "Bank Passbook",
        "gst": "GST Certificate",
    }
    
    # Collect all field values from sources
    sources: dict[str, dict[str, Any]] = {}
    
    # Add declared source
    declared_source = {}
    if applicant_name:
        declared_source["name"] = applicant_name
    if applicant_pan:
        declared_source["pan"] = applicant_pan
    if declared.get("aadhaar_promoter"):
        declared_source["aadhaar"] = declared.get("aadhaar_promoter")
    if declared.get("dob"):
        declared_source["dob"] = declared.get("dob")
    if declared.get("registered_address"):
        declared_source["address"] = declared.get("registered_address")
    if declared.get("monthly_salary"):
        declared_source["salary"] = _parse_float(declared.get("monthly_salary"))
    if declared.get("employer_name"):
        declared_source["employer"] = declared.get("employer_name")
    if declared.get("gst_number"):
        declared_source["gstin"] = declared.get("gst_number")
        
    if declared_source:
        sources["declared"] = {
            "label": "Application Form",
            "fields": declared_source,
            "metadata": {}
        }
        
    # Add document sources
    for doc_type, doc in doc_map.items():
        fields = doc.get("fields", {})
        doc_source = {}
        
        # Name
        name_val = fields.get("owner_name") or fields.get("employee_name") or fields.get("account_holder_name") or fields.get("owner")
        if name_val:
            doc_source["name"] = name_val
            
        # PAN
        pan_val = None
        if fields.get("pan_number"):
            pan_val = fields["pan_number"]
        elif fields.get("pans"):
            pan_val = fields["pans"][0] if fields["pans"] else None
        elif fields.get("pan"):
            pan_val = fields["pan"]
        if pan_val:
            doc_source["pan"] = pan_val
            
        # Aadhaar
        if fields.get("aadhaar_number"):
            doc_source["aadhaar"] = fields["aadhaar_number"]
            
        # DOB
        if fields.get("dob"):
            doc_source["dob"] = fields["dob"]
            
        # Address
        addr_val = fields.get("address") or fields.get("location")
        if addr_val:
            doc_source["address"] = addr_val
            
        # Salary / Income
        sal_val = fields.get("monthly_income") or fields.get("income") or fields.get("gross_salary") or fields.get("net_salary") or fields.get("avg_monthly_credit")
        if sal_val:
            doc_source["salary"] = _parse_float(sal_val)
            
        # Employer
        if fields.get("employer"):
            doc_source["employer"] = fields["employer"]
            
        # Bank Account
        acc_val = fields.get("account_number") or (fields.get("account_numbers")[0] if fields.get("account_numbers") else None)
        if acc_val:
            doc_source["account_number"] = acc_val
            
        # IFSC
        ifsc_val = fields.get("ifsc_code") or (fields.get("ifsc_codes")[0] if fields.get("ifsc_codes") else None)
        if ifsc_val:
            doc_source["ifsc"] = ifsc_val
            
        # GSTIN
        if fields.get("gstin"):
            doc_source["gstin"] = fields["gstin"]
            
        sources[doc_type] = {
            "label": friendly_names.get(doc_type, doc_type.replace("_", " ").title()),
            "fields": doc_source,
            "metadata": fields.get("field_metadata", {})
        }

    # Deterministic comparisons for each field
    field_configs = [
        ("Full Name", "name", "identity"),
        ("Aadhaar Number", "aadhaar", "identity"),
        ("PAN Number", "pan", "identity"),
        ("Date of Birth", "dob", "identity"),
        ("Registered Address", "address", "identity"),
        ("Bank Account Holder", "name", "identity"),  # Used for comparing Bank statement name vs declared name
        ("Salary Amount", "salary", "financial"),
        ("Employer Name", "employer", "identity"),
        ("Bank Account Number", "account_number", "financial"),
        ("IFSC Code", "ifsc", "financial"),
        ("GSTIN", "gstin", "identity"),
    ]

    critical_mismatch_triggered = False
    identity_mismatches_count = 0
    financial_mismatches_count = 0
    ocr_confidence_scores = []
    
    # Perform all comparisons
    for field_label, field_key, field_cat in field_configs:
        # Get all sources containing this field
        field_sources = []
        for src_key, src_data in sources.items():
            # For Bank Account Holder, only look at bank statement/passbook compared to application form
            if field_label == "Bank Account Holder":
                if src_key not in ("declared", "bank_statement", "bank_passbook"):
                    continue
            # For Employer Name, compare salary slip/declared
            if field_label == "Employer Name":
                if src_key not in ("declared", "salary_slip"):
                    continue
            
            val = src_data["fields"].get(field_key)
            if val is not None and str(val).strip() != "":
                field_sources.append((src_key, src_data["label"], val, src_data["metadata"].get(field_key, {})))
                
        # Compare all pairs of sources
        for i in range(len(field_sources)):
            for j in range(i + 1, len(field_sources)):
                src_key_a, label_a, val_a, meta_a = field_sources[i]
                src_key_b, label_b, val_b, meta_b = field_sources[j]
                
                # Confidence determination
                conf_a = meta_a.get("confidence", 100.0) if src_key_a != "declared" else 100.0
                conf_b = meta_b.get("confidence", 100.0) if src_key_b != "declared" else 100.0
                avg_conf = (conf_a + conf_b) / 2
                ocr_confidence_scores.append(avg_conf)
                
                # Check low confidence
                low_conf = meta_a.get("status") == "Needs Manual Review" or meta_b.get("status") == "Needs Manual Review"
                
                # Matching logic
                is_match = False
                reason = ""
                
                if low_conf:
                    is_match = False
                    match_status = "MISMATCH"
                    reason = f"OCR confidence is below threshold on {label_a if meta_a.get('status') == 'Needs Manual Review' else label_b}."
                else:
                    # Type-specific comparison
                    if field_key == "name" or field_key == "employer" or field_key == "address":
                        # String overlap matching
                        is_match, sim = compare_names(str(val_a), str(val_b))
                        if not is_match:
                            reason = f"Value '{val_a}' in {label_a} does not match '{val_b}' in {label_b} (similarity {sim}%)."
                    elif field_key == "salary":
                        # Value deviation
                        v_a = float(val_a)
                        v_b = float(val_b)
                        max_val = max(v_a, v_b)
                        deviation = abs(v_a - v_b) / max_val if max_val > 0 else 0.0
                        is_match = deviation <= settings.INCOME_DEVIATION_THRESHOLD
                        if not is_match:
                            reason = f"Salary ₹{v_a:,.0f} in {label_a} deviates from ₹{v_b:,.0f} in {label_b} by {deviation*100:.1f}%."
                    else:
                        # Exact matching for numbers (PAN, Aadhaar, Account numbers, DOB, IFSC, GSTIN)
                        clean_a = re.sub(r"\s+", "", str(val_a)).upper()
                        clean_b = re.sub(r"\s+", "", str(val_b)).upper()
                        is_match = clean_a == clean_b
                        if not is_match:
                            reason = f"Value '{val_a}' in {label_a} does not match '{val_b}' in {label_b}."
                            
                    match_status = "MATCH" if is_match else "MISMATCH"
                    
                cells.append({
                    "field": field_label,
                    "docA": label_a,
                    "docB": label_b,
                    "match": match_status,
                    "confidence": round(avg_conf, 1),
                    "valA": str(val_a),
                    "valB": str(val_b),
                    "reason": reason
                })
                
                if not is_match:
                    # Handle Mismatch Findings and critical triggers
                    if field_cat == "identity" or field_label == "Employer Name":
                        identity_mismatches_count += 1
                        
                        # Check critical safeguards
                        is_critical = False
                        if field_label == "Full Name" and (src_key_a == "declared" or src_key_b == "declared"):
                            is_critical = True
                        elif field_label == "PAN Number":
                            is_critical = True
                        elif field_label == "Date of Birth":
                            is_critical = True
                        elif field_label == "Aadhaar Number":
                            is_critical = True
                        elif field_label == "Bank Account Holder" and (src_key_a == "declared" or src_key_b == "declared" or "bank" in src_key_a or "bank" in src_key_b):
                            is_critical = True
                        elif field_label == "Employer Name" and (src_key_a == "declared" or src_key_b == "declared"):
                            is_critical = True
                            
                        if is_critical:
                            critical_mismatch_triggered = True
                            
                        severity = "HIGH" if is_critical else "MEDIUM"
                        finding_type = "CRITICAL_IDENTITY_MISMATCH" if is_critical else "IDENTITY_MISMATCH"
                        
                        findings.append({
                            "type": finding_type,
                            "severity": severity,
                            "detail": f"{field_label} mismatch: {reason}",
                            "document": label_b if src_key_b != "declared" else label_a
                        })
                    else:
                        financial_mismatches_count += 1
                        findings.append({
                            "type": "FINANCIAL_INCONSISTENCY",
                            "severity": "HIGH" if field_label == "Salary Amount" else "MEDIUM",
                            "detail": f"{field_label} discrepancy: {reason}",
                            "document": label_b if src_key_b != "declared" else label_a
                        })

    # Missing mandatory documents checks
    doc_types_uploaded = {doc["type"] for doc in documents}
    missing_docs = []
    
    if applicant_type == "salaried":
        if "salary_slip" not in doc_types_uploaded:
            missing_docs.append("Salary Slip")
        if "bank_statement" not in doc_types_uploaded:
            missing_docs.append("Bank Statement")
    elif applicant_type == "farmer":
        if "land_record" not in doc_types_uploaded:
            missing_docs.append("Land Record")
    elif applicant_type == "corporate":
        if "bank_statement" not in doc_types_uploaded:
            missing_docs.append("Bank Statement")
        if "gst" not in doc_types_uploaded and "itr" not in doc_types_uploaded:
            missing_docs.append("GST Certificate or ITR")
            
    for missing in missing_docs:
        findings.append({
            "type": "MISSING_MANDATORY_DOCUMENT",
            "severity": "HIGH",
            "detail": f"Mandatory document for {applicant_type.upper()} applicant is missing: {missing}."
        })
        flags.append("missing_document")

    # Duplicate Collateral or Conflicting Identities check
    # Check if multiple land records were uploaded with identical survey numbers
    survey_numbers = {}
    for doc in documents:
        if doc["type"] == "land_record":
            survey = doc["fields"].get("survey_no")
            if survey:
                if survey in survey_numbers:
                    findings.append({
                        "type": "DUPLICATE_COLLATERAL",
                        "severity": "HIGH",
                        "detail": f"Duplicate collateral detected: Land Record '{doc['filename']}' references survey no '{survey}', which is already pledged in '{survey_numbers[survey]}'."
                    })
                    flags.append("duplicate_collateral")
                else:
                    survey_numbers[survey] = doc["filename"]

    # Compute separate scores for Identity and Financial consistency
    identity_score = 100.0
    if critical_mismatch_triggered:
        identity_score = 0.0
        flags.append("critical_identity_mismatch")
    elif identity_mismatches_count > 0:
        identity_score = max(30.0, 100.0 - (identity_mismatches_count * 25.0))
        flags.append("identity_mismatch")

    # Financial score calculation
    financial_score = 100.0
    if financial_mismatches_count > 0:
        financial_score = max(40.0, 100.0 - (financial_mismatches_count * 20.0))
        flags.append("financial_mismatch")

    # Bank statement balance checking
    balance_math_checked = False
    for doc in documents:
        if doc["type"] == "bank_statement":
            # Verify transaction math
            balance_result = _check_statement_balance_math(doc["fields"])
            if balance_result.get("flags"):
                financial_score = max(20.0, financial_score - 30.0)
                findings.extend(balance_result["findings"])
                flags.extend(balance_result["flags"])
                balance_math_checked = True

    # Land record valuation checking
    for doc in documents:
        if doc["type"] == "land_record":
            land_result = _check_property_valuation(doc["fields"])
            if land_result.get("flags"):
                financial_score = max(20.0, financial_score - 20.0)
                findings.extend(land_result["findings"])
                flags.extend(land_result["flags"])

    # Average OCR confidence
    avg_ocr_conf = sum(ocr_confidence_scores) / len(ocr_confidence_scores) if ocr_confidence_scores else 100.0

    # Consistency score (average of Identity and Financial scores)
    consistency_score = round((identity_score + financial_score) / 2.0, 2)

    return {
        "consistency_score": consistency_score,
        "identity_score": identity_score,
        "financial_score": financial_score,
        "ocr_confidence": round(avg_ocr_conf, 2),
        "critical_identity_mismatch": critical_mismatch_triggered,
        "flags": flags,
        "findings": findings,
        "consistency_matrix": cells,
    }


def _check_statement_balance_math(bank_fields: dict) -> dict:
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
                f"Balance arithmetic errors found in {len(errors)} transactions. "
                f"Expected balance ₹{errors[0]['expected']:,.2f}, found ₹{errors[0]['actual']:,.2f}."
            ),
        })

    return {"findings": findings, "flags": flags}


def _check_property_valuation(land_fields: dict) -> dict:
    findings = []
    flags = []
    declared = land_fields.get("declared_value")
    area_sqft = land_fields.get("area_sqft")
    location = land_fields.get("location", "")

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
                "detail": f"Pledged land value is {direction} by {deviation*100:.1f}% vs. market estimate of ₹{market_value:,.0f}."
            })

    return {"findings": findings, "flags": flags}


def _parse_float(val: Any) -> float:
    try:
        return float(str(val).replace(",", "").strip())
    except (ValueError, TypeError):
        return 0.0
