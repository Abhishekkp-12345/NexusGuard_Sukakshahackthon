"""
ForgeShield AI — Reports Router
=================================
Generates downloadable PDF forensic audit reports using fpdf2.
"""

from __future__ import annotations

import io
import logging
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/{case_id}/pdf")
async def download_pdf_report(case_id: str, request: Request):
    """Generate and return a PDF forensic audit report for a case."""
    cases = request.app.state.cases
    if case_id not in cases:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")

    case = cases[case_id]
    analysis = case.get("analysis")
    if not analysis:
        raise HTTPException(status_code=400, detail="Case has not been analyzed yet.")

    try:
        pdf_bytes = _generate_pdf(case, analysis)
    except Exception as e:
        logger.error(f"PDF generation failed for {case_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"PDF generation error: {e}")

    filename = f"ForgeShield_Report_{case_id.replace('/', '_')}_{datetime.utcnow().strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _generate_pdf(case: dict, analysis: dict) -> bytes:
    """Build the forensic PDF report using fpdf2."""
    from fpdf import FPDF

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_margins(15, 15, 15)

    # ── Header ───────────────────────────────────────────────────────
    pdf.set_fill_color(15, 23, 42)       # Dark navy
    pdf.rect(0, 0, 210, 40, "F")
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_y(8)
    pdf.cell(0, 10, "FORGESHIELD AI", ln=True, align="C")
    pdf.set_font("Helvetica", "", 11)
    pdf.cell(0, 8, "Underwriting Intelligence Report", ln=True, align="C")
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 7, "Canara Bank | Team Sukaksha | Confidential", ln=True, align="C")
    pdf.set_y(45)
    pdf.set_text_color(0, 0, 0)

    # ── Case Info ────────────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_fill_color(241, 245, 249)
    pdf.cell(0, 8, " Case Information", ln=True, fill=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.ln(2)

    info_rows = [
        ("Case ID", case.get("case_id", "—")),
        ("Applicant", case.get("applicant_name", "—")),
        ("Loan Type", case.get("loan_type", "—")),
        ("Loan Amount", f"Rs. {case.get('loan_amount', 0):,.0f}"),
        ("Branch", case.get("branch", "—")),
        ("Analysis Date", analysis.get("analyzed_at", datetime.utcnow().isoformat())[:19]),
        ("Processing Time", f"{analysis.get('elapsed_ms', 0):,} ms"),
    ]
    for label, value in info_rows:
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(55, 7, f"  {label}:", border=0)
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 7, str(value), ln=True)

    pdf.ln(5)

    # ── Verdict Banner ───────────────────────────────────────────────
    verdict = analysis.get("verdict", "HOLD")
    verdict_colors = {
        "APPROVE": (16, 185, 129),
        "HOLD": (245, 158, 11),
        "REJECT": (239, 68, 68),
    }
    r, g, b = verdict_colors.get(verdict, (107, 114, 128))
    pdf.set_fill_color(r, g, b)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 12, f"  VERDICT: {verdict}  |  Confidence: {analysis.get('confidence', '—')}  |  Overall Score: {analysis.get('overall_score', 0):.1f}%", ln=True, fill=True)
    pdf.set_text_color(0, 0, 0)
    pdf.ln(5)

    # ── Score Breakdown ──────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_fill_color(241, 245, 249)
    pdf.cell(0, 8, " Forensic Score Breakdown", ln=True, fill=True)
    pdf.ln(2)

    scores = [
        ("Document Authenticity", analysis.get("authenticity_score", 0), "%", "35%"),
        ("Cross-Document Consistency", analysis.get("consistency_score", 0), "%", "40%"),
        ("Relationship Risk (inverted)", 100 - analysis.get("relationship_risk_score", 0), "%", "25%"),
    ]
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(90, 7, "Layer", border=1)
    pdf.cell(35, 7, "Score", border=1, align="C")
    pdf.cell(35, 7, "Weight", border=1, align="C")
    pdf.cell(30, 7, "Status", border=1, align="C", ln=True)

    for name, score, unit, weight in scores:
        status = "PASS" if score >= 70 else ("WARN" if score >= 50 else "FAIL")
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(90, 7, f"  {name}", border=1)
        pdf.cell(35, 7, f"{score:.1f}{unit}", border=1, align="C")
        pdf.cell(35, 7, weight, border=1, align="C")
        pdf.cell(30, 7, status, border=1, align="C", ln=True)

    pdf.ln(5)

    # ── AI Recommendation ────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_fill_color(241, 245, 249)
    pdf.cell(0, 8, " AI Recommendation (Generated by Ollama gemma4 — Local LLM)", ln=True, fill=True)
    pdf.ln(2)
    pdf.set_font("Helvetica", "I", 10)
    ai_text = analysis.get("ai_recommendation", "No recommendation generated.")
    # Sanitize for Latin-1
    ai_text_safe = ai_text.encode("latin-1", errors="replace").decode("latin-1")
    pdf.multi_cell(0, 6, ai_text_safe)
    pdf.ln(3)

    # ── Key Findings ─────────────────────────────────────────────────
    findings = [f for f in analysis.get("all_findings", []) if f.get("severity") in ("HIGH", "MEDIUM")]
    if findings:
        pdf.set_font("Helvetica", "B", 12)
        pdf.set_fill_color(241, 245, 249)
        pdf.cell(0, 8, f" Key Findings ({len(findings)} HIGH/MEDIUM severity)", ln=True, fill=True)
        pdf.ln(2)

        for finding in findings[:15]:  # Max 15 in PDF
            severity = finding.get("severity", "INFO")
            f_type = finding.get("type", "FINDING")
            detail = finding.get("detail", "")

            # Severity color indicator
            pdf.set_font("Helvetica", "B", 9)
            pdf.set_fill_color(239, 68, 68) if severity == "HIGH" else pdf.set_fill_color(245, 158, 11)
            pdf.set_text_color(255, 255, 255)
            pdf.cell(20, 6, f" {severity}", fill=True)
            pdf.set_text_color(0, 0, 0)
            pdf.set_font("Helvetica", "B", 9)
            pdf.cell(0, 6, f"  {f_type}", ln=True)

            pdf.set_font("Helvetica", "", 9)
            detail_safe = detail.encode("latin-1", errors="replace").decode("latin-1")
            pdf.multi_cell(0, 5, f"       {detail_safe}")
            pdf.ln(1)

    # ── Documents Analyzed ───────────────────────────────────────────
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_fill_color(241, 245, 249)
    pdf.cell(0, 8, " Documents Analyzed", ln=True, fill=True)
    pdf.ln(2)

    for i, doc in enumerate(analysis.get("document_reports", []), 1):
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(0, 7, f"  {i}. {doc.get('filename', 'Unknown')} [{doc.get('type', 'unknown').upper()}]", ln=True)
        pdf.set_font("Helvetica", "", 9)
        pdf.cell(0, 6, f"     Authenticity Score: {doc.get('authenticity_score', 0):.1f}%", ln=True)
        if doc.get("pdf_forensics"):
            meta = doc["pdf_forensics"].get("metadata", {})
            if meta.get("producer"):
                pdf.cell(0, 6, f"     PDF Producer: {meta['producer']}", ln=True)
            if meta.get("creation_date"):
                pdf.cell(0, 6, f"     Created: {str(meta['creation_date'])[:19]}", ln=True)
            if meta.get("mod_date"):
                pdf.cell(0, 6, f"     Modified: {str(meta['mod_date'])[:19]}", ln=True)
        pdf.ln(2)

    # ── Footer ───────────────────────────────────────────────────────
    pdf.set_y(-20)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(107, 114, 128)
    pdf.cell(0, 5, f"ForgeShield AI | Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')} | 100% Offline | RBI Compliant", align="C")

    return bytes(pdf.output())
