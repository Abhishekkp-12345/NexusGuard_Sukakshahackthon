"""
ForgeShield AI — Forensics Router (Production v2)
=================================================
The core analysis API endpoint. Receives uploaded documents, runs all 6 forensic layers,
and returns the complete forensic report with evidence, heatmap visualizations,
bounding boxes, cross-document mismatch tables, and deterministic verdict.

Pipeline order (deterministic first, LLM last):
  LAYER 1:  Image & Document Forensics (Multi-quality ELA, DCT, Noise, Edge, PDF Binary)
  LAYER 2:  AI Region Localization (Labeled bounding boxes per detected tamper hotspot)
  LAYER 3:  OCR Verification (Word confidence, character spacing, insertion anomalies)
  LAYER 4:  Cross-Document Identity & Consistency Verification
  LAYER 5:  Pure Penalty Risk Scoring Engine
  LAYER 6:  Explainable AI (LLM explanation narrative — explain-only guardrail)
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

PDF_EXTENSIONS = {".pdf"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tiff", ".bmp"}
ALL_EXTENSIONS = PDF_EXTENSIONS | IMAGE_EXTENSIONS

PHOTO_ID_TYPES = {"aadhaar_card", "pan_card", "driving_license"}


@router.post("/analyze/{case_id}")
async def analyze_documents(
    case_id: str,
    request: Request,
    files: list[UploadFile] = File(...),
    doc_types: str = Form(default=""),
):
    """
    Run the full 6-layer ForgeShield forensic analysis on uploaded documents.
    Returns comprehensive forensic report with deterministic verdict.
    """
    cases = request.app.state.cases
    if case_id not in cases:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")

    case = cases[case_id]
    case["status"] = "ANALYZING"

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

    doc_type_hints = [t.strip() for t in doc_types.split(",") if t.strip()]

    try:
        result = await _run_full_analysis(case, saved_files, doc_type_hints, cases)
    except Exception as e:
        logger.error(f"Analysis failed for case {case_id}: {e}", exc_info=True)
        case["status"] = "ERROR"
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")

    case["analysis"] = result
    case["status"] = "ANALYZED"
    case["verdict"] = result["verdict"]
    case["updated_at"] = datetime.utcnow().isoformat()
    case["documents"] = [f["original_name"] for f in saved_files]

    return result


@router.get("/ollama-status")
async def ollama_status():
    from ai_engine.ollama_client import check_availability
    return check_availability()


# ══════════════════════════════════════════════════════════════════════
# Core Pipeline Execution
# ══════════════════════════════════════════════════════════════════════

async def _run_full_analysis(
    case: dict[str, Any],
    saved_files: list[dict],
    doc_type_hints: list[str],
    cases_db: dict[str, Any],
) -> dict[str, Any]:
    from forensics.ela_engine import run_ela, ela_authenticity_score
    from forensics.pdf_forensics import analyze_pdf_metadata
    from forensics.ocr_extractor import (
        extract_text_from_pdf, extract_text_from_image, extract_key_fields
    )
    from forensics.tamper_detector import run_advanced_tamper_detection
    from forensics.face_verifier import compare_faces_across_docs
    from forensics.identity_verifier import verify_identity_fields
    from forensics.semantic_checker import check_cross_document_consistency
    from forensics.graph_engine import analyze_relationships
    from ai_engine.risk_scorer import compute_overall_risk, generate_ai_recommendation
    from ai_engine.ollama_client import classify_document
    from forensics.benford_analyzer import run_benfords_analysis
    from forensics.entropy_analyzer import check_numeric_entropy
    from forensics.fraud_dna import generate_document_dna, match_fraud_dna

    start_time = datetime.utcnow()
    all_findings: list[dict] = []
    document_reports: list[dict] = []
    auth_scores: list[float] = []

    total_tamper_penalty = 0.0
    total_pdf_penalty = 0.0
    total_benford_penalty = 0.0
    total_entropy_penalty = 0.0
    clone_detected_any = False
    tamper_visualizations: list[dict] = []
    identity_doc_paths: list[tuple[str, Path]] = []
    processed_docs: list[dict] = []

    # ── LAYER 1 & 3: Per-Document Forensics & OCR ─────────────────────
    for i, file_info in enumerate(saved_files):
        path: Path = file_info["saved_path"]
        ext: str = file_info["ext"]
        original_name: str = file_info["original_name"]

        doc_report: dict[str, Any] = {
            "filename": original_name,
            "type": doc_type_hints[i] if i < len(doc_type_hints) else "unknown",
            "ela_result": None,
            "pdf_forensics": None,
            "tamper_result": None,
            "benford_result": None,
            "entropy_result": [],
            "dna_result": None,
            "authenticity_score": 100.0,
            "extracted_fields": {},
        }

        # Image ELA Check
        ela_score = 100.0
        if ext in IMAGE_EXTENSIONS:
            ela_res = run_ela(path)
            ela_score = ela_authenticity_score(ela_res)
            doc_report["ela_result"] = ela_res

        # PDF Forensics Check
        pdf_score = 100.0
        if ext in PDF_EXTENSIONS:
            pdf_res = analyze_pdf_metadata(path)
            pdf_score = pdf_res["authenticity_score"]
            doc_report["pdf_forensics"] = pdf_res
            pdf_pen = 100.0 - pdf_score
            total_pdf_penalty = max(total_pdf_penalty, pdf_pen)

        doc_auth = (ela_score + pdf_score) / 2 if ext in PDF_EXTENSIONS else ela_score
        doc_report["authenticity_score"] = round(doc_auth, 2)
        auth_scores.append(doc_auth)

        # OCR Extraction
        if ext in PDF_EXTENSIONS:
            ocr_res = extract_text_from_pdf(path, original_name)
        else:
            ocr_res = extract_text_from_image(path, original_name)

        raw_text = ocr_res.get("text", "")
        ocr_data = ocr_res.get("ocr_data")

        if doc_report["type"] == "unknown" and raw_text.strip():
            doc_report["type"] = classify_document(raw_text[:500], original_name)

        ocr_fields = extract_key_fields(raw_text, doc_report["type"], ocr_data)
        doc_ocr_conf = ocr_res.get("ocr_confidence", 75.0)
        ocr_fields["ocr_confidence"] = doc_ocr_conf

        doc_report["extracted_fields"] = ocr_fields
        doc_report["raw_text_preview"] = raw_text[:500]

        # ── Run Benford's Law Check ──
        benford_res = run_benfords_analysis(raw_text)
        doc_report["benford_result"] = benford_res
        if benford_res and benford_res["triggered"]:
            all_findings.append({
                "check_type": "BENFORDS_LAW_ANOMALY",
                "severity": benford_res["severity"],
                "confidence": benford_res["confidence"],
                "detail": benford_res["description"],
                "document": original_name,
            })
            if benford_res["severity"] == "HIGH":
                total_benford_penalty += 25.0
            elif benford_res["severity"] == "MEDIUM":
                total_benford_penalty += 15.0

        # ── Run Numeric Entropy Check ──
        entropy_res = check_numeric_entropy(raw_text)
        doc_report["entropy_result"] = entropy_res
        for signal in entropy_res:
            all_findings.append({
                "check_type": signal["type"],
                "severity": signal["severity"],
                "confidence": signal["confidence"],
                "detail": signal["description"],
                "document": original_name,
            })
            if signal["severity"] == "HIGH":
                total_entropy_penalty += 20.0
            elif signal["severity"] == "MEDIUM":
                total_entropy_penalty += 10.0

        # ── Run Fraud DNA Fingerprinting ──
        ela_val = doc_report["ela_result"].get("tamper_score", 0.0) if doc_report["ela_result"] else 0.0
        ins_count = len(ocr_res.get("insertion_anomalies", []))
        dna_sig = generate_document_dna(doc_report["type"], raw_text, ela_val, ins_count)
        dna_res = match_fraud_dna(dna_sig, case["case_id"], cases_db)
        doc_report["dna_result"] = dna_res
        
        # Inject DNA signature into tamper_result for cross-case matching next time
        if doc_report.get("tamper_result") is None:
            doc_report["tamper_result"] = {"dna_signature": dna_sig}
        else:
            doc_report["tamper_result"]["dna_signature"] = dna_sig
            
        if dna_res["suspicious"]:
            for match in dna_res["matches"]:
                all_findings.append({
                    "check_type": "FRAUD_DNA_MATCH",
                    "severity": "HIGH",
                    "confidence": match["similarity_score"] / 100.0,
                    "detail": f"Fraud DNA Match ({match['match_type']}): {match['pattern_name']}. {match['description']}",
                    "document": original_name,
                })
                total_entropy_penalty += 25.0

        if doc_report["type"] in PHOTO_ID_TYPES and ext in IMAGE_EXTENSIONS:
            identity_doc_paths.append((original_name, path))

        processed_docs.append({
            "type": doc_report["type"],
            "fields": ocr_fields,
            "filename": original_name,
        })
        document_reports.append(doc_report)

    # ── LAYER 1.5 & 2: Advanced Multi-Detector Forensics & Region Localization ──
    for i, file_info in enumerate(saved_files):
        path = file_info["saved_path"]
        ext = file_info["ext"]
        original_name = file_info["original_name"]

        if ext not in IMAGE_EXTENSIONS:
            continue

        doc_report = document_reports[i]
        ocr_text = doc_report.get("extracted_fields", {}).get("full_text", "")

        tamper_res = run_advanced_tamper_detection(
            image_path=path,
            ocr_text=ocr_text if ocr_text else None,
        )

        doc_report["tamper_result"] = tamper_res

        if tamper_res["tampered"]:
            total_tamper_penalty += tamper_res["tamper_penalty"]
            all_findings.extend([{**f, "document": original_name} for f in tamper_res["findings"]])

        if tamper_res["clone_detected"]:
            clone_detected_any = True

        if tamper_res.get("tamper_visualization"):
            tamper_visualizations.append({
                "filename": original_name,
                "visualization_b64": tamper_res["tamper_visualization"],
                "region_annotations": tamper_res["region_annotations"],
                "tamper_score": tamper_res["tamper_score"],
            })

    total_tamper_penalty = min(total_tamper_penalty, 40.0)

    # ── LAYER 1.6: Face Verification ───────────────────────────────────
    face_verification: dict = {}
    face_penalty = 0.0
    if len(identity_doc_paths) >= 2:
        face_verification = compare_faces_across_docs(identity_doc_paths)
        face_penalty = face_verification.get("face_penalty", 0.0)
        all_findings.extend(face_verification.get("findings", []))
    else:
        face_verification = {
            "overall_face_verdict": "NOT_DETECTED",
            "face_penalty": 0.0,
            "comparisons": [],
        }

    # ── LAYER 4: Cross-Document Verification ──────────────────────────
    identity_verification = verify_identity_fields(processed_docs, case)
    all_findings.extend(identity_verification.get("findings", []))
    identity_penalty = identity_verification.get("identity_penalty", 0.0)
    critical_identity_mismatch = identity_verification.get("critical_identity_mismatch", False)

    consistency_result = check_cross_document_consistency(processed_docs, case)
    all_findings.extend(consistency_result.get("findings", []))
    if consistency_result.get("critical_identity_mismatch"):
        critical_identity_mismatch = True

    entities = _build_entities_from_docs(case, processed_docs)
    graph_result = analyze_relationships(case["case_id"], entities)

    # ── Compliance Check ──
    from forensics.compliance_checker import check_regulatory_compliance
    compliance_violations = check_regulatory_compliance(all_findings)

    # ── LAYER 5: Pure Penalty Risk Scoring ────────────────────────────
    overall_auth = sum(auth_scores) / len(auth_scores) if auth_scores else 100.0
    avg_ocr_conf = consistency_result.get("ocr_confidence", 75.0)

    risk_scores = compute_overall_risk(
        authenticity_score=overall_auth,
        consistency_score=consistency_result["consistency_score"],
        identity_score=consistency_result["identity_score"],
        financial_score=consistency_result["financial_score"],
        relationship_risk_score=graph_result["relationship_risk_score"],
        ocr_confidence=avg_ocr_conf,
        critical_identity_mismatch=critical_identity_mismatch,
        identity_penalty=identity_penalty,
        tamper_penalty=total_tamper_penalty,
        face_penalty=face_penalty,
        clone_detected=clone_detected_any,
        low_ocr_confidence=avg_ocr_conf < 50.0,
        pdf_penalty=total_pdf_penalty,
        benford_penalty=total_benford_penalty,
        entropy_penalty=total_entropy_penalty,
    )

    # ── LAYER 6: Explainable AI Narrative ─────────────────────────────
    ai_recommendation = generate_ai_recommendation(
        case, all_findings, risk_scores,
        identity_verification=identity_verification,
        face_verification=face_verification,
    )

    elapsed_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)

    # Build manipulation summary for UI
    manipulations = []
    for dr in document_reports:
        tr = dr.get("tamper_result")
        if tr and tr.get("tampered"):
            for ann in tr.get("region_annotations", []):
                manipulations.append({
                    "document": dr["filename"],
                    "label": ann.get("label", "Tampered Region"),
                    "method": ann.get("method", "ELA"),
                    "confidence": ann.get("confidence", 0.5),
                    "coordinates": {"x": ann["x"], "y": ann["y"], "w": ann["w"], "h": ann["h"]},
                })

    report = {
        "case_id": case["case_id"],
        "analyzed_at": start_time.isoformat(),
        "elapsed_ms": elapsed_ms,
        "applicant_name": case.get("applicant_name"),
        "loan_amount": case.get("loan_amount"),
        "loan_type": case.get("loan_type"),
        "branch": case.get("branch"),

        "authenticity_score": round(overall_auth, 2),
        "consistency_score": consistency_result["consistency_score"],
        "identity_score": consistency_result["identity_score"],
        "financial_score": consistency_result["financial_score"],
        "ocr_confidence": avg_ocr_conf,
        "relationship_risk_score": graph_result["relationship_risk_score"],
        "overall_score": risk_scores["overall_score"],
        "verdict": risk_scores["verdict"],
        "verdict_color": risk_scores["verdict_color"],
        "confidence": risk_scores["confidence"],
        "score_breakdown": risk_scores["breakdown"],

        "trust_score_audit": {
            "base_score": 100.0,
            "deductions": risk_scores.get("score_deductions", []),
            "total_penalty": risk_scores["score_breakdown"]["total_penalty"],
            "final_score": risk_scores["overall_score"],
            "verdict": risk_scores["verdict"],
            "verdict_reason": risk_scores.get("floor_applied") or "Score derived via pure penalty engine.",
        },

        "all_findings": all_findings,
        "high_severity_count": sum(1 for f in all_findings if f.get("severity") == "HIGH"),
        "medium_severity_count": sum(1 for f in all_findings if f.get("severity") == "MEDIUM"),
        "manipulation_summary": manipulations,

        "identity_verification": identity_verification,
        "face_verification": face_verification,
        "tamper_detection": {
            "any_tampered": any((dr.get("tamper_result") or {}).get("tampered", False) for dr in document_reports),
            "total_tamper_penalty": total_tamper_penalty,
            "clone_detected": clone_detected_any,
            "tamper_visualizations": tamper_visualizations,
        },

        "ai_recommendation": ai_recommendation,
        "document_reports": document_reports,
        "graph_data": graph_result.get("graph_data", {"nodes": [], "links": []}),
        "consistency_matrix": consistency_result["consistency_matrix"],
        "compliance_violations": compliance_violations,
    }

    return report


def _build_entities_from_docs(case: dict, processed_docs: list[dict]) -> dict:
    entities = {
        "applicant": {"name": case.get("applicant_name", "Unknown"), "pan": case.get("applicant_pan", "")},
        "employer": {}, "asset": {}, "guarantors": [], "conflicts": [],
    }
    return entities
