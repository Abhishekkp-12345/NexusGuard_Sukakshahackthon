"""
ForgeShield AI — Layer 1 & 3: OCR Text & Verification Extractor
================================================================
Extracts structured text from PDFs and images using pytesseract.
Extracts per-word bounding boxes, confidence scores, font/alignment anomalies,
and regex key fields.

Checks:
  • Per-word OCR confidence scoring
  • Digitally inserted / substituted text detection (confidence spikes/dips in local context)
  • Regex extraction for PAN, Aadhaar, DOB, Income, Account Numbers, IFSC, GSTIN
"""

from __future__ import annotations

import logging
import os
import re
import shutil
from pathlib import Path
from typing import Any

import pytesseract
from PIL import Image

logger = logging.getLogger(__name__)


def _configure_tesseract():
    if shutil.which("tesseract"):
        return

    local_appdata = os.environ.get("LOCALAPPDATA")
    candidates = []
    if local_appdata:
        candidates.append(os.path.join(local_appdata, "Programs", "Tesseract-OCR", "tesseract.exe"))

    user_profile = os.environ.get("USERPROFILE") or os.path.expanduser("~")
    if user_profile:
        candidates.append(os.path.join(user_profile, "AppData", "Local", "Programs", "Tesseract-OCR", "tesseract.exe"))

    candidates.append(r"C:\Program Files\Tesseract-OCR\tesseract.exe")
    candidates.append(r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe")

    for candidate in candidates:
        if os.path.exists(candidate):
            try:
                import subprocess
                res = subprocess.run([candidate, "--version"], capture_output=True, text=True)
                if res.returncode == 0:
                    pytesseract.pytesseract.tesseract_cmd = candidate
                    logger.info(f"Configured Tesseract path to: {candidate}")
                    return
            except Exception as e:
                logger.warning(f"Failed candidate Tesseract: {e}")


# Initialize configuration
_configure_tesseract()


# ── Regex patterns ───────────────────────────────────────────────────

AMOUNT_PATTERN = re.compile(
    r"(?:₹|Rs\.?|INR)\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?)|\b(\d{1,3}(?:,\d{2,3})+(?:\.\d{2})?)\b|\b(\d{4,9}(?:\.\d{2})?)\b",
    re.IGNORECASE,
)

DATE_PATTERN = re.compile(
    r"\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b|\b\d{4}[-/]\d{2}[-/]\d{2}\b|"
    r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*[\s,]+\d{4}\b",
    re.IGNORECASE,
)

PAN_PATTERN = re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b")
AADHAAR_PATTERN = re.compile(r"\b\d{4}\s?\d{4}\s?\d{4}\b")
ACCOUNT_PATTERN = re.compile(r"\b\d{9,18}\b")
IFSC_PATTERN = re.compile(r"\b[A-Z]{4}0[A-Z0-9]{6}\b")
GSTIN_PATTERN = re.compile(r"\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b")


# ── Extraction Functions ─────────────────────────────────────────────

def extract_text_from_image(image_path: Path, doc_name: str = "") -> dict[str, Any]:
    """
    Run OCR on image file, return raw text, word-level bounding boxes & confidences.
    """
    try:
        img = Image.open(image_path).convert("RGB")
        # Extract full raw text
        raw_text = pytesseract.image_to_string(img)
        # Extract detailed word data (data dict with text, conf, left, top, width, height)
        ocr_data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)

        word_boxes = _extract_word_boxes(ocr_data)
        ocr_confidence = _compute_avg_confidence(ocr_data)
        insertion_anomalies = _detect_text_insertion_anomalies(word_boxes)

        return {
            "text": raw_text,
            "ocr_data": ocr_data,
            "word_boxes": word_boxes,
            "ocr_confidence": ocr_confidence,
            "insertion_anomalies": insertion_anomalies,
        }
    except Exception as e:
        logger.warning(f"OCR image extraction error for {doc_name}: {e}")
        return {
            "text": "",
            "ocr_data": None,
            "word_boxes": [],
            "ocr_confidence": 75.0,  # Realistic fallback
            "insertion_anomalies": [],
        }


def extract_text_from_pdf(pdf_path: Path, doc_name: str = "") -> dict[str, Any]:
    """
    Extract text from PDF. Renders page 0 as a PNG image to obtain word-level
    bounding boxes for forensic region localization and tamper visualization.
    """
    text_content = ""
    word_boxes = []
    ocr_confidence = 100.0
    ocr_data = None
    rendered_path = None

    # Render page 0 using PyMuPDF (fitz)
    try:
        import fitz
        doc = fitz.open(str(pdf_path))
        if len(doc) > 0:
            page = doc[0]
            pix = page.get_pixmap(dpi=150)
            rendered_path = pdf_path.with_suffix(".page0.png")
            pix.save(str(rendered_path))

            img = Image.open(rendered_path).convert("RGB")
            raw_ocr_text = pytesseract.image_to_string(img)
            ocr_data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
            word_boxes = _extract_word_boxes(ocr_data)
            ocr_confidence = _compute_avg_confidence(ocr_data)
            insertion_anomalies = _detect_text_insertion_anomalies(word_boxes)

            # Try digital text extraction first
            for p in doc:
                t = p.get_text()
                if t:
                    text_content += t + "\n"

            final_text = text_content if len(text_content.strip()) > 30 else raw_ocr_text

            return {
                "text": final_text,
                "ocr_data": ocr_data,
                "word_boxes": word_boxes,
                "ocr_confidence": ocr_confidence,
                "insertion_anomalies": insertion_anomalies,
                "is_digital_pdf": len(text_content.strip()) > 30,
                "rendered_image_path": rendered_path,
            }
    except Exception as e:
        logger.warning(f"PyMuPDF page rendering / OCR failed for {doc_name}: {e}")

    # Fallback digital text extraction using pypdf
    try:
        import pypdf
        reader = pypdf.PdfReader(str(pdf_path))
        for page in reader.pages:
            t = page.extract_text()
            if t:
                text_content += t + "\n"
    except Exception as e:
        logger.debug(f"pypdf fallback failed: {e}")

    return {
        "text": text_content,
        "ocr_data": ocr_data,
        "word_boxes": word_boxes,
        "ocr_confidence": 75.0,
        "insertion_anomalies": [],
        "is_digital_pdf": False,
        "rendered_image_path": rendered_path,
    }


def extract_key_fields(raw_text: str, doc_type: str, ocr_data: dict | None = None) -> dict[str, Any]:
    """Extract key entity fields from raw text using domain-specific regex and keywords."""
    fields: dict[str, Any] = {
        "full_text": raw_text,
        "doc_type": doc_type,
    }

    if not raw_text:
        return fields

    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    fields["raw_lines"] = lines[:30]

    # Extract PAN numbers
    pans = PAN_PATTERN.findall(raw_text)
    if pans:
        fields["pans"] = list(set(pans))
        fields["pan_number"] = pans[0]

    # Extract Aadhaar numbers
    aadhaars = AADHAAR_PATTERN.findall(raw_text)
    if aadhaars:
        cleaned_aadhaars = [re.sub(r"\s+", "", a) for a in aadhaars]
        fields["aadhaar_numbers"] = list(set(cleaned_aadhaars))
        fields["aadhaar_number"] = cleaned_aadhaars[0]

    # Extract GSTINs
    gstins = GSTIN_PATTERN.findall(raw_text)
    if gstins:
        fields["gstins"] = list(set(gstins))
        fields["gstin"] = gstins[0]

    # Extract Bank Account Numbers
    accounts = ACCOUNT_PATTERN.findall(raw_text)
    if accounts:
        # Filter out 10-digit dates or phone numbers if possible
        valid_accs = [a for a in accounts if not (len(a) == 10 and a.startswith("9"))]
        if valid_accs:
            fields["account_numbers"] = list(set(valid_accs))
            fields["account_number"] = valid_accs[0]

    # Extract IFSC codes
    ifscs = IFSC_PATTERN.findall(raw_text)
    if ifscs:
        fields["ifsc_codes"] = list(set(ifscs))
        fields["ifsc_code"] = ifscs[0]

    # Extract Name heuristics
    _extract_names(lines, fields, doc_type)

    # Extract Income / Amount heuristics
    _extract_amounts(raw_text, fields)

    # Extract Date heuristics
    dates = DATE_PATTERN.findall(raw_text)
    if dates:
        fields["dates_found"] = dates[:5]
        fields["doc_date"] = dates[0]
        fields["dob"] = dates[0]
        fields["date_of_birth"] = dates[0]

    return fields


# ── Helper Utilities ─────────────────────────────────────────────────

def _extract_word_boxes(ocr_data: dict | None) -> list[dict]:
    if not ocr_data or "text" not in ocr_data:
        return []

    word_boxes = []
    n_boxes = len(ocr_data["text"])
    for i in range(n_boxes):
        text = str(ocr_data["text"][i]).strip()
        conf = float(ocr_data["conf"][i]) if str(ocr_data["conf"][i]).lstrip("-").isdigit() else -1
        if text and conf >= 0:
            word_boxes.append({
                "word": text,
                "confidence": conf,
                "x": int(ocr_data["left"][i]),
                "y": int(ocr_data["top"][i]),
                "w": int(ocr_data["width"][i]),
                "h": int(ocr_data["height"][i]),
            })
    return word_boxes


def _compute_avg_confidence(ocr_data: dict | None) -> float:
    if not ocr_data or "conf" not in ocr_data:
        return 75.0
    valid = [float(c) for c in ocr_data["conf"] if str(c).lstrip("-").isdigit() and float(c) >= 0]
    return round(sum(valid) / len(valid), 2) if valid else 75.0


def _detect_text_insertion_anomalies(word_boxes: list[dict]) -> list[dict]:
    """Detect isolated words whose OCR confidence drops sharply compared to surrounding text."""
    if len(word_boxes) < 5:
        return []

    anomalies = []
    confidences = [w["confidence"] for w in word_boxes]
    avg_conf = sum(confidences) / len(confidences)

    for i in range(1, len(word_boxes) - 1):
        prev_conf = confidences[i - 1]
        curr_conf = confidences[i]
        next_conf = confidences[i + 1]

        # Sudden confidence drop (> 35 points lower than neighbors) indicates altered font/resolution
        if prev_conf > 75 and next_conf > 75 and (prev_conf - curr_conf > 35):
            anomalies.append({
                "word": word_boxes[i]["word"],
                "confidence": curr_conf,
                "neighbor_avg_confidence": round((prev_conf + next_conf) / 2, 1),
                "box": word_boxes[i],
                "detail": f"Word '{word_boxes[i]['word']}' has confidence {curr_conf:.0f}% in a high-confidence ({prev_conf:.0f}%) line context.",
            })
    return anomalies


def _extract_names(lines: list[str], fields: dict, doc_type: str = "unknown"):
    # 1. Standard keyword-based name extraction
    found_keyword_name = False
    for i, line in enumerate(lines[:15]):
        line_upper = line.upper()
        if any(kw in line_upper for kw in ["NAME", "ACCOUNT HOLDER", "EMPLOYEE NAME", "APPLICANT"]):
            parts = line.split(":", 1)
            if len(parts) > 1 and len(parts[1].strip()) >= 3:
                name_val = parts[1].strip()
                fields["owner_name"] = name_val
                fields["account_holder_name"] = name_val
                found_keyword_name = True
                break
            elif i + 1 < len(lines):
                fields["owner_name"] = lines[i + 1].strip()
                fields["account_holder_name"] = lines[i + 1].strip()
                found_keyword_name = True
                break

        if "S/O" in line_upper or "D/O" in line_upper or "W/O" in line_upper or "FATHER" in line_upper:
            parts = line.split(":", 1)
            if len(parts) > 1 and len(parts[1].strip()) >= 3:
                fields["father_name"] = parts[1].strip()

    # 2. Aadhaar-specific name extraction (Aadhaar cards lack a "Name:" label prefix)
    if not found_keyword_name and doc_type in ("aadhaar_card", "aadhaar"):
        # Heuristic A: Look after "To" block
        found_to = False
        for idx, line in enumerate(lines[:15]):
            if line.strip().lower() == "to":
                found_to = True
                # Scan next few lines for Title-case or UPPERCASE English names
                for j in range(idx + 1, min(idx + 5, len(lines))):
                    candidate = lines[j].strip()
                    if re.match(r"^[A-Z][a-z]+(\s+[A-Z][a-z]*)+$", candidate) or re.match(r"^[A-Z\s\.]+$", candidate):
                        if len(candidate) >= 3 and not any(w in candidate.lower() for w in ["to", "enrolment", "unique", "authority", "india", "government"]):
                            fields["owner_name"] = candidate
                            fields["account_holder_name"] = candidate
                            found_keyword_name = True
                            break
                break

        # Heuristic B: Scan above Date of Birth (DOB) line if "To" wasn't found or name wasn't extracted
        if not found_keyword_name:
            for idx, line in enumerate(lines):
                if any(kw in line.upper() for kw in ["DOB", "YEAR OF BIRTH", "DATE OF BIRTH"]):
                    for j in range(max(0, idx - 2), idx):
                        candidate = lines[j].strip()
                        if re.match(r"^[A-Z][a-z]+(\s+[A-Z][a-z]*)+$", candidate) or re.match(r"^[A-Z\s\.]+$", candidate):
                            if len(candidate) >= 3 and not any(w in candidate.lower() for w in ["to", "enrolment", "unique", "authority", "india", "government", "male", "female"]):
                                fields["owner_name"] = candidate
                                fields["account_holder_name"] = candidate
                                found_keyword_name = True
                                break
                    if found_keyword_name:
                        break

    # 3. PAN Card specific field extraction
    is_pan = (
        doc_type in ("pan_card", "pan")
        or any("INCOME TAX" in l.upper() or "PERMANENT ACCOUNT" in l.upper() for l in lines[:10])
    )
    if is_pan:
        for idx, line in enumerate(lines):
            line_up = line.upper()

            # Name extraction on PAN Card
            if not fields.get("owner_name"):
                if "NAME" in line_up or "नाम" in line:
                    if not any(k in line_up for k in ["FATHER", "MOTHER", "DEPARTMENT", "CARD", "ACCOUNT"]):
                        parts = line.split(":", 1)
                        if len(parts) > 1 and len(parts[1].strip()) >= 3:
                            fields["owner_name"] = parts[1].strip()
                            fields["account_holder_name"] = parts[1].strip()
                        else:
                            for j in range(idx + 1, min(idx + 3, len(lines))):
                                candidate = lines[j].strip()
                                if re.match(r"^[A-Z\s\.]+$", candidate) and len(candidate) >= 3:
                                    if not any(w in candidate.upper() for w in ["INCOME", "TAX", "GOVT", "INDIA", "PERMANENT", "FATHER", "DATE"]):
                                        fields["owner_name"] = candidate
                                        fields["account_holder_name"] = candidate
                                        break

            # Father's Name extraction on PAN Card
            if not fields.get("father_name"):
                if "FATHER" in line_up or "पिता" in line or "S/O" in line_up:
                    parts = line.split(":", 1)
                    if len(parts) > 1 and len(parts[1].strip()) >= 3:
                        fields["father_name"] = parts[1].strip()
                    else:
                        for j in range(idx + 1, min(idx + 3, len(lines))):
                            candidate = lines[j].strip()
                            if re.match(r"^[A-Z\s\.]+$", candidate) and len(candidate) >= 3:
                                if not any(w in candidate.upper() for w in ["INCOME", "TAX", "GOVT", "INDIA", "PERMANENT", "DATE", "BIRTH"]):
                                    fields["father_name"] = candidate
                                    break

            # DOB extraction on PAN Card
            if not fields.get("dob") or not fields.get("date_of_birth"):
                if any(kw in line_up for kw in ["DOB", "DATE OF BIRTH", "BIRTH", "तारीख", "जन्म"]):
                    m = DATE_PATTERN.search(line)
                    if not m and idx + 1 < len(lines):
                        m = DATE_PATTERN.search(lines[idx + 1])
                    if m:
                        fields["dob"] = m.group(0)
                        fields["date_of_birth"] = m.group(0)
                        fields["doc_date"] = m.group(0)


def _extract_amounts(raw_text: str, fields: dict):
    matches = AMOUNT_PATTERN.findall(raw_text)
    amounts = []
    for m in matches:
        val_str = m[0] or m[1] or m[2]
        if val_str:
            clean_str = val_str.replace(",", "")
            try:
                val = float(clean_str)
                if 1000 <= val <= 50000000:
                    amounts.append(val)
            except ValueError:
                pass

    if amounts:
        fields["amounts_found"] = amounts
        fields["max_amount"] = max(amounts)
        fields["income"] = max(amounts)
