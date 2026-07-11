"""
ForgeShield AI — Forensics Router
====================================
The core analysis endpoint. Receives uploaded documents, runs all 5 layers,
and returns the complete forensic report for a case.

POST /api/forensics/analyze/{case_id}
  • Accepts: multipart/form-data with one or more document files
  • Returns: Full 5-layer analysis result
"""

from __future__ import annotations

import logging
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Supported file types ──────────────────────────────────────────────
PDF_EXTENSIONS = {".pdf"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tiff", ".bmp"}
ALL_EXTENSIONS = PDF_EXTENSIONS | IMAGE_EXTENSIONS


@router.post("/analyze/{case_id}")
async def analyze_documents(
    case_id: str,
    request: Request,
    files: list[UploadFile] = File(...),
    doc_types: str = Form(default=""),  # comma-separated, e.g. "salary_slip,bank_statement"
):
    """
    Run the full 5-layer ForgeShield AI analysis on uploaded documents.

    Returns a comprehensive forensic report dict.
    """
    cases = request.app.state.cases
    if case_id not in cases:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")

    case = cases[case_id]
    case["status"] = "ANALYZING"

    # ── Save uploaded files ───────────────────────────────────────────
    case_upload_dir = settings.UPLOAD_DIR / case_id
    case_upload_dir.mkdir(parents=True, exist_ok=True)

    saved_files = []
    for upload in files:
        ext = Path(upload.filename or "doc").suffix.lower()
        if ext not in ALL_EXTENSIONS:
            logger.warning(f"Unsupported file type: {upload.filename}")
            continue
        safe_name = f"{uuid.uuid4().hex}{ext}"
        dest = case_upload_dir / safe_name
        with open(dest, "wb") as f:
            shutil.copyfileobj(upload.file, f)
        saved_files.append({
            "original_name": upload.filename,
            "saved_path": dest,
            "ext": ext,
        })

    if not saved_files:
        raise HTTPException(status_code=400, detail="No valid documents uploaded.")

    # Parse doc_types hint
    doc_type_hints = [t.strip() for t in doc_types.split(",") if t.strip()]

    # ── Run analysis ──────────────────────────────────────────────────
    try:
        result = await _run_full_analysis(case, saved_files, doc_type_hints)
    except Exception as e:
        logger.error(f"Analysis failed for case {case_id}: {e}", exc_info=True)
        case["status"] = "ERROR"
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")

    # ── Store results in case ─────────────────────────────────────────
    case["analysis"] = result
    case["status"] = "ANALYZED"
    case["verdict"] = result["verdict"]
    case["updated_at"] = datetime.utcnow().isoformat()
    case["documents"] = [f["original_name"] for f in saved_files]

    return result


@router.get("/ollama-status")
async def ollama_status():
    """Check if Ollama is running and the configured model is available."""
    from ai_engine.ollama_client import check_availability
    return check_availability()


# ── Core Analysis Pipeline ────────────────────────────────────────────

async def _run_full_analysis(
    case: dict[str, Any],
    saved_files: list[dict],
    doc_type_hints: list[str],
) -> dict[str, Any]:
    """
    Orchestrate all 5 layers for a set of uploaded documents.
    """
    from forensics.ela_engine import run_ela, ela_authenticity_score
    from forensics.pdf_forensics import analyze_pdf_metadata
    from forensics.ocr_extractor import extract_text_from_pdf, extract_text_from_image, extract_key_fields
    from forensics.semantic_checker import check_cross_document_consistency
    from forensics.graph_engine import analyze_relationships
    from ai_engine.risk_scorer import compute_overall_risk, generate_ai_recommendation
    from ai_engine.ollama_client import classify_document
    from document_handlers.salary_slip import extract_salary_fields
    from document_handlers.bank_statement import extract_bank_statement_fields
    from document_handlers.land_record import extract_land_record_fields

    start_time = datetime.utcnow()
    all_findings: list[dict] = []
    document_reports: list[dict] = []

    # Authenticity tracking
    auth_scores: list[float] = []

    # ══════════════════════════════════════════════════════════════════
    # LAYER 1 + OCR: Per-document forensics
    # ══════════════════════════════════════════════════════════════════
    processed_docs: list[dict] = []

    for i, file_info in enumerate(saved_files):
        path: Path = file_info["saved_path"]
        ext: str = file_info["ext"]
        original_name: str = file_info["original_name"]

        doc_report: dict[str, Any] = {
            "filename": original_name,
            "type": doc_type_hints[i] if i < len(doc_type_hints) else "unknown",
            "ela_result": None,
            "pdf_forensics": None,
            "authenticity_score": 100.0,
            "extracted_fields": {},
        }

        # ── ELA (images only, or converted PDF) ──────────────────────
        ela_score = 100.0
        if ext in IMAGE_EXTENSIONS:
            ela_result = run_ela(path)
            ela_score = ela_authenticity_score(ela_result)
            doc_report["ela_result"] = {
                "tamper_score": ela_result["tamper_score"],
                "mean_diff": ela_result["mean_diff"],
                "heatmap_b64": ela_result["heatmap_b64"],
                "suspicious_regions": ela_result["suspicious_regions"],
            }
            if ela_result.get("suspicious_regions"):
                all_findings.append({
                    "type": "ELA_TAMPER_DETECTED",
                    "severity": "HIGH" if ela_result["tamper_score"] > 40 else "MEDIUM",
                    "detail": (
                        f"ELA analysis of '{original_name}' detected potential tampering in: "
                        f"{', '.join(ela_result['suspicious_regions'])}. "
                        f"Tamper probability: {ela_result['tamper_score']:.1f}%"
                    ),
                    "document": original_name,
                })

        # ── PDF Forensics ─────────────────────────────────────────────
        pdf_score = 100.0
        if ext in PDF_EXTENSIONS:
            pdf_result = analyze_pdf_metadata(path)
            pdf_score = pdf_result["authenticity_score"]
            doc_report["pdf_forensics"] = pdf_result
            all_findings.extend([
                {**f, "document": original_name}
                for f in pdf_result.get("findings", [])
                if f.get("severity") in ("HIGH", "MEDIUM")
            ])

        # Per-document authenticity: average of ELA + PDF scores
        doc_auth = (ela_score + pdf_score) / 2 if ext in PDF_EXTENSIONS else ela_score
        doc_report["authenticity_score"] = round(doc_auth, 2)
        auth_scores.append(doc_auth)

        # ── OCR / Text Extraction ─────────────────────────────────────
        if ext in PDF_EXTENSIONS:
            raw_text = extract_text_from_pdf(path, original_name)
        else:
            raw_text = extract_text_from_image(path, original_name)

        # ── Auto-classify if type unknown ─────────────────────────────
        if doc_report["type"] == "unknown" and raw_text.strip():
            doc_report["type"] = classify_document(raw_text[:500], original_name)

        ocr_fields = extract_key_fields(raw_text, doc_report["type"])

        # ── Type-specific field extraction ────────────────────────────
        doc_type = doc_report["type"]
        if doc_type == "salary_slip":
            fields = extract_salary_fields(ocr_fields)
        elif doc_type == "bank_statement":
            fields = extract_bank_statement_fields(ocr_fields)
        elif doc_type == "land_record":
            fields = extract_land_record_fields(ocr_fields)
        else:
            fields = ocr_fields

        doc_report["extracted_fields"] = fields
        
        # Name matching check
        applicant_name = case.get("applicant_name", "").strip()
        if applicant_name and doc_type in {"salary_slip", "bank_statement", "itr", "land_record", "aadhaar_card", "pan_card", "driving_license", "bank_passbook"}:
            import re
            name_tokens = [w.lower() for w in re.findall(r"\w+", applicant_name) if len(w) >= 3]
            text_content = raw_text.lower()
            if name_tokens and len(text_content) > 50:
                matches = [token for token in name_tokens if token in text_content]
                if not matches:
                    doc_report["authenticity_score"] = 10.0
                    auth_scores[-1] = 10.0
                    all_findings.append({
                        "type": "IDENTITY_MISMATCH",
                        "severity": "HIGH",
                        "detail": (
                            f"Identity mismatch in '{original_name}': "
                            f"The document does not contain the applicant's name '{applicant_name}'. "
                            f"This indicates the document may belong to another individual or is forged/stolen."
                        ),
                        "document": original_name,
                    })

        processed_docs.append({"type": doc_type, "fields": fields, "filename": original_name})
        document_reports.append(doc_report)

    # ══════════════════════════════════════════════════════════════════
    # LAYER 2: Cross-Document Validation
    # ══════════════════════════════════════════════════════════════════
    consistency_result = check_cross_document_consistency(processed_docs)
    
    # Check if there are any recognized underwriting documents
    underwriting_types = {"salary_slip", "bank_statement", "itr", "land_record"}
    underwriting_count = sum(1 for doc in processed_docs if doc["type"] in underwriting_types)
    
    if underwriting_count == 0:
        consistency_result["consistency_score"] = 0.0
        all_findings.append({
            "type": "NO_UNDERWRITING_DOCUMENTS",
            "severity": "HIGH",
            "detail": "No recognized underwriting documents (Salary Slip, Bank Statement, ITR, or Land Record) were found. Automated consistency checks cannot be verified, resulting in a zero consistency rating.",
        })
    
    all_findings.extend(consistency_result.get("findings", []))

    # ── LAYER 2.5: Chronology & Date Anomaly Checker ──────────────────
    from forensics.chronology_checker import check_chronology
    chronology_result = check_chronology(processed_docs, case.get("created_at"))
    all_findings.extend(chronology_result.get("findings", []))

    # ══════════════════════════════════════════════════════════════════
    # LAYER 3: Relationship Graph Analysis
    # ══════════════════════════════════════════════════════════════════
    # Build entities from extracted fields
    entities = _build_entities_from_docs(case, processed_docs)
    graph_result = analyze_relationships(case["case_id"], entities)
    all_findings.extend(graph_result.get("findings", []))

    # ══════════════════════════════════════════════════════════════════
    # LAYER 4: AI Risk Scoring
    # ══════════════════════════════════════════════════════════════════
    overall_auth = sum(auth_scores) / len(auth_scores) if auth_scores else 100.0
    risk_scores = compute_overall_risk(
        authenticity_score=overall_auth,
        consistency_score=consistency_result["consistency_score"],
        relationship_risk_score=graph_result["relationship_risk_score"],
    )

    # Force REJECT on identity mismatch
    if any(f.get("type") == "IDENTITY_MISMATCH" for f in all_findings):
        risk_scores["verdict"] = "REJECT"
        risk_scores["verdict_color"] = "#EF4444"
        risk_scores["overall_score"] = min(risk_scores["overall_score"], 30.0)

    # Generate AI recommendation (may take 10-30s with Ollama)
    ai_recommendation = generate_ai_recommendation(case, all_findings, risk_scores)

    # ══════════════════════════════════════════════════════════════════
    # LAYER 5: Assemble Final Report
    # ══════════════════════════════════════════════════════════════════
    elapsed_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)

    report = {
        "case_id": case["case_id"],
        "analyzed_at": start_time.isoformat(),
        "elapsed_ms": elapsed_ms,
        "applicant_name": case.get("applicant_name"),
        "loan_amount": case.get("loan_amount"),
        "loan_type": case.get("loan_type"),
        "branch": case.get("branch"),

        # Scores
        "authenticity_score": round(overall_auth, 2),
        "consistency_score": consistency_result["consistency_score"],
        "relationship_risk_score": graph_result["relationship_risk_score"],
        "overall_score": risk_scores["overall_score"],
        "verdict": risk_scores["verdict"],
        "verdict_color": risk_scores["verdict_color"],
        "confidence": risk_scores["confidence"],
        "score_breakdown": risk_scores["breakdown"],

        # Findings
        "all_findings": all_findings,
        "high_severity_count": sum(1 for f in all_findings if f.get("severity") == "HIGH"),
        "medium_severity_count": sum(1 for f in all_findings if f.get("severity") == "MEDIUM"),

        # AI Recommendation
        "ai_recommendation": ai_recommendation,

        # Per-document reports
        "document_reports": document_reports,

        # Graph data
        "graph_data": graph_result.get("graph_data", {"nodes": [], "links": []}),

        # Income analysis
        "income_analysis": consistency_result.get("income_analysis", {}),
        
        # Chronological timeline
        "timeline": chronology_result.get("timeline", []),
    }

    logger.info(
        f"Analysis complete for {case['case_id']} in {elapsed_ms}ms — "
        f"Verdict: {risk_scores['verdict']} | Overall: {risk_scores['overall_score']:.1f}%"
    )
    return report


def _build_entities_from_docs(case: dict, processed_docs: list[dict]) -> dict:
    """Extract entity data for graph engine from all processed documents."""
    entities = {
        "applicant": {
            "name": case.get("applicant_name", "Unknown"),
            "pan": case.get("applicant_pan", ""),
            "address": "",
        },
        "employer": {},
        "asset": {},
        "guarantors": [],
        "conflicts": [],
    }

    for doc in processed_docs:
        fields = doc.get("fields", {})
        if doc["type"] == "salary_slip":
            if fields.get("employer"):
                entities["employer"]["name"] = fields["employer"]
        elif doc["type"] == "land_record":
            if fields.get("survey_no"):
                entities["asset"]["survey_no"] = fields["survey_no"]
            if fields.get("declared_value"):
                entities["asset"]["value"] = fields["declared_value"]
            if fields.get("location"):
                entities["asset"]["address"] = fields["location"][:100]

    # Find mismatched document owners to show in the relationship graph
    applicant_name = case.get("applicant_name", "Unknown").lower()
    import re
    app_tokens = [w for w in re.findall(r"\w+", applicant_name) if len(w) >= 3]
    
    seen_mismatches = set()
    for doc in processed_docs:
        fields = doc.get("fields", {})
        owner = fields.get("owner_name") or fields.get("account_holder_name")
        if owner:
            owner_clean = owner.strip()
            owner_lower = owner_clean.lower()
            if app_tokens and not any(t in owner_lower for t in app_tokens):
                if owner_clean.upper() not in seen_mismatches:
                    seen_mismatches.add(owner_clean.upper())
                    entities["conflicts"].append({"name": owner_clean})

    return entities
