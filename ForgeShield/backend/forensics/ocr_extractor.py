"""
ForgeShield AI — Layer 1: OCR Text Extractor
===============================================
Extracts structured text from PDFs and images using pytesseract.
Uses regex patterns to pull key financial fields:
  - Income amounts (salary, credits)
  - Dates (issue date, period)
  - Names, employer, PAN
  - Account numbers
"""

from __future__ import annotations

import logging
import re
import os
import shutil
import pytesseract
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


def _configure_tesseract():
    # 1. If it's already in PATH, let pytesseract handle it
    if shutil.which("tesseract"):
        return

    # 2. Check local AppData paths
    local_appdata = os.environ.get("LOCALAPPDATA")
    candidates = []
    if local_appdata:
        candidates.append(os.path.join(local_appdata, "Programs", "Tesseract-OCR", "tesseract.exe"))

    user_profile = os.environ.get("USERPROFILE") or os.path.expanduser("~")
    if user_profile:
        candidates.append(os.path.join(user_profile, "AppData", "Local", "Programs", "Tesseract-OCR", "tesseract.exe"))

    # 3. Check Program Files paths
    candidates.append(r"C:\Program Files\Tesseract-OCR\tesseract.exe")
    candidates.append(r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe")

    for candidate in candidates:
        if os.path.exists(candidate):
            # Test if this candidate can execute without DLL crashes (exit code 0 on --version)
            try:
                import subprocess
                res = subprocess.run([candidate, "--version"], capture_output=True, text=True)
                if res.returncode == 0:
                    pytesseract.pytesseract.tesseract_cmd = candidate
                    logger.info(f"Configured Tesseract path to: {candidate}")
                    return
                else:
                    logger.warning(f"Candidate Tesseract at {candidate} failed to execute with exit code {res.returncode}")
            except Exception as e:
                logger.warning(f"Failed to test Tesseract at {candidate}: {e}")



# ── Regex patterns for financial field extraction ─────────────────────

AMOUNT_PATTERN = re.compile(
    r"(?:₹|Rs\.?|INR)\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?)|\b(\d{1,3}(?:,\d{2,3})+(?:\.\d{2})?)\b|\b(\d{4,9}(?:\.\d{2})?)\b",
    re.IGNORECASE,
)

DATE_PATTERN = re.compile(
    r"\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{2}[-/]\d{2}|"
    r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*[\s,]+\d{4})\b",
    re.IGNORECASE,
)

PAN_PATTERN = re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b")

ACCOUNT_PATTERN = re.compile(r"\b\d{9,18}\b")

IFSC_PATTERN = re.compile(r"\b[A-Z]{4}0[A-Z0-9]{6}\b")

INCOME_KEYWORDS = [
    "gross salary", "net salary", "basic pay", "total earnings",
    "net pay", "take home", "monthly income", "gross pay",
    "net amount", "salary", "wages",
]

CREDIT_KEYWORDS = ["credit", "cr", "deposit", "salary cr", "salary credit"]
DEBIT_KEYWORDS = ["debit", "dr", "withdrawal", "emi", "loan emi"]


def extract_text_from_pdf(pdf_path: Path, original_name: str = "") -> str:
    """Extract all text from a PDF using pdfminer, falling back to OCR if scanned."""
    try:
        from pdfminer.high_level import extract_text
        text = extract_text(str(pdf_path))
        # If the extracted text is empty or very short, it's likely a scanned PDF.
        # Fall back to page-by-page OCR.
        if not text or len(text.strip()) < 50:
            logger.info(f"Digital text extraction returned very little content for {pdf_path.name}. Falling back to OCR.")
            return _ocr_pdf_pages(pdf_path, original_name)
        return text or ""
    except Exception as e:
        logger.warning(f"pdfminer extraction failed ({pdf_path.name}): {e}")
        return _ocr_pdf_pages(pdf_path, original_name)


def _get_best_psm(filename: str) -> str:
    """Choose the best Page Segmentation Mode depending on the file name/type."""
    fn = filename.lower()
    if any(k in fn for k in ["aadhar", "addhar", "pan", "license", "licence", "dl"]):
        return "6"  # Single block of uniform text, works best for card layouts
    return "3"      # Fully automatic page segmentation, works best for tables/multi-columns


def extract_text_from_image(image_path: Path, original_name: str = "") -> str:
    """Extract text from an image using pytesseract."""
    try:
        from PIL import Image

        _configure_tesseract()

        img = Image.open(image_path)
        psm = _get_best_psm(original_name or image_path.name)
        text = pytesseract.image_to_string(img, config=f"--oem 3 --psm {psm}")
        return text or ""
    except Exception as e:
        logger.warning(f"Tesseract OCR failed ({image_path.name}): {e}")
        return ""


def _ocr_pdf_pages(pdf_path: Path, original_name: str = "") -> str:
    """OCR scanned PDF pages by extracting images and running pytesseract OCR."""
    try:
        import io
        import pypdf
        from PIL import Image

        _configure_tesseract()

        reader = pypdf.PdfReader(str(pdf_path))
        texts = []
        psm = _get_best_psm(original_name or pdf_path.name)
        for page_num, page in enumerate(reader.pages):
            page_has_images = False
            for img_idx, image_file_object in enumerate(page.images):
                page_has_images = True
                try:
                    img = Image.open(io.BytesIO(image_file_object.data))
                    ocr_text = pytesseract.image_to_string(img, config=f"--oem 3 --psm {psm}")
                    if ocr_text.strip():
                        texts.append(ocr_text.strip())
                except Exception as img_err:
                    logger.warning(f"Failed to OCR image {img_idx} on page {page_num} of {pdf_path.name}: {img_err}")
            
            if not page_has_images:
                # Fallback to standard digital text extraction for this page
                page_text = page.extract_text()
                if page_text:
                    texts.append(page_text.strip())

        return "\n\n".join(texts)
    except Exception as e:
        logger.error(f"Scanned PDF OCR failed for {pdf_path.name}: {e}")
        return _fallback_ocr(pdf_path)


def _fallback_ocr(pdf_path: Path) -> str:
    """Fallback: convert PDF pages to text using pypdf reader."""
    try:
        import pypdf
        reader = pypdf.PdfReader(str(pdf_path))
        texts = []
        for page in reader.pages:
            texts.append(page.extract_text() or "")
        return "\n".join(texts)
    except Exception as e:
        logger.error(f"PDF text extraction fallback failed: {e}")
        return ""


def _is_valid_extracted_name(name: str) -> bool:
    """Validate if the extracted text looks like a clean name to filter out OCR garbage."""
    name_clean = name.strip()
    # Length check
    if not (5 <= len(name_clean) <= 35):
        return False
    # Digit check
    if any(c.isdigit() for c in name_clean):
        return False
    # Word count check
    words = name_clean.split()
    if len(words) < 2:
        return False
    # Ensure words are not extremely short
    for w in words[:-1]:
        if len(w) <= 2:
            return False
    # Stopwords filter
    stopwords = {"enrolment", "authority", "unique", "government", "india", "father", "signature", "date", "year", "birth", "dob", "gender", "male", "female", "card", "permanent", "account", "tax", "income", "licence", "license", "driving", "customer", "holder", "bank", "canara", "branch"}
    if any(w.lower() in stopwords for w in words):
        return False
    # Ensure it's properly capitalized
    if not all(w[0].isupper() for w in words if w.isalpha()):
        return False
    return True


def extract_key_fields(text: str, doc_type: str = "unknown") -> dict[str, Any]:
    """
    Extract structured financial fields from raw OCR text.
    """
    lines = [l.strip() for l in text.splitlines() if l.strip()]

    # Extract all amounts
    raw_amounts = AMOUNT_PATTERN.findall(text)
    parsed_amounts = []
    for r in raw_amounts:
        # Find which capturing group matched in the multi-group pattern
        val_str = next((g for g in r if g), "")
        if val_str:
            val = _parse_amount(val_str)
            # Filter out common false positives (like year numbers and pin codes)
            if 1900 <= val <= 2099:
                continue
            if len(val_str) == 6 and val_str.isdigit():
                continue
            if val > 100:
                parsed_amounts.append(val)
    amounts = sorted(set(parsed_amounts), reverse=True)

    # Extract dates
    dates = DATE_PATTERN.findall(text)

    # Extract PANs
    pans = PAN_PATTERN.findall(text.upper())

    # Extract account numbers
    accounts = ACCOUNT_PATTERN.findall(text)
    accounts = [a for a in accounts if len(a) >= 9]

    # Extract IFSC
    ifsc = IFSC_PATTERN.findall(text.upper())

    # Try to find income/salary figure
    income = _extract_income(text, amounts)

    # Try to extract employer name
    employer = _extract_employer(text)

    # Filter/clean fields based on document type to reduce false positives
    aadhaar_no = None
    dl_no = None
    passbook_name = None
    passbook_acc = None
    passbook_ifsc = None
    owner_name = None
    
    if doc_type == "aadhaar_card":
        amounts = []
        pans = []
        accounts = []
        ifsc = []
        income = None
        employer = None
        # Extract Aadhaar Number (12 digits, often spaced in 4s)
        aadhaar_match = re.search(r"\b\d{4}\s\d{4}\s\d{4}\b", text)
        if aadhaar_match:
            aadhaar_no = aadhaar_match.group(0)
        else:
            aadhaar_match = re.search(r"\b\d{12}\b", text)
            if aadhaar_match:
                aadhaar_no = aadhaar_match.group(0)
        
        # Extract Aadhaar Name
        name_match = re.search(r"To\s*\n\s*([A-Za-z\t ]+)", text, re.IGNORECASE)
        if name_match:
            owner_name = name_match.group(1).strip()
        else:
            for line in lines:
                if any(k in line.lower() for k in ["enrolment", "unique", "authority", "india", "government", "year", "dob", "birth", "gender"]):
                    continue
                words = line.strip().split()
                if len(words) >= 2 and all(w.isalpha() for w in words):
                    owner_name = line.strip()
                    break
                
    elif doc_type == "pan_card":
        amounts = []
        accounts = []
        ifsc = []
        income = None
        employer = None
        
        # Extract PAN Name
        name_match = re.search(r"Name\s*\n\s*([A-Za-z\t ]+)", text, re.IGNORECASE)
        if name_match:
            owner_name = name_match.group(1).strip()
        else:
            name_match = re.search(r"Name\s*[:\-]?\s*([A-Za-z\t ]+)", text, re.IGNORECASE)
            if name_match:
                owner_name = name_match.group(1).strip()
            else:
                found_tax = False
                for line in lines:
                    if "tax" in line.lower() or "department" in line.lower():
                        found_tax = True
                        continue
                    if found_tax:
                        words = line.strip().split()
                        if len(words) >= 2 and all(w.isalpha() for w in words) and not any(k in line.lower() for k in ["father", "card", "permanent", "account"]):
                            owner_name = line.strip()
                            break
        
    elif doc_type == "driving_license":
        amounts = []
        pans = []
        accounts = []
        ifsc = []
        income = None
        employer = None
        # Extract DL Number
        dl_match = re.search(r"\b[A-Z]{2}\d{2}\s\d{11}\b|\b[A-Z]{2}-\d{13}\b|\b[A-Z]{2}\d{13}\b|\b[A-Z]{2}\d{2}\s\d{9,11}\b", text.upper())
        if dl_match:
            dl_no = dl_match.group(0)
        else:
            dl_match = re.search(r"DL\s*(?:No\.?|Number)?\s*[:\-]?\s*([A-Z0-9\s\-]{8,20})", text, re.IGNORECASE)
            if dl_match:
                dl_no = dl_match.group(1).strip()
                
        # Extract DL Name
        name_match = re.search(r"NAME\s*[:\-]?\s*([A-Za-z\t ]+)", text, re.IGNORECASE)
        if name_match:
            owner_name = name_match.group(1).strip()
                
    elif doc_type == "bank_passbook":
        amounts = []
        pans = []
        income = None
        employer = None
        
        # Name
        name_match = re.search(r"NAME(?:\(S\})?\s+([A-Za-z\t ]+)", text, re.IGNORECASE)
        if name_match:
            passbook_name = name_match.group(1).strip()
        else:
            name_match = re.search(r"(?:customer|holder|name)\s*[:\-]?\s*([A-Za-z\t ]{3,30})", text, re.IGNORECASE)
            if name_match:
                passbook_name = name_match.group(1).strip()
                
        # Account Number
        acc_match = re.search(r"(?:account|accowmt|acc)\s*(?:no\.?|number)?\s*[:\-]?\s*([a-zA-Z0-9]{9,18})", text, re.IGNORECASE)
        if acc_match:
            passbook_acc = acc_match.group(1).strip()
            
        # IFSC Code
        ifsc_match = re.search(r"(?:ifsc|tesc|ifs)\s*(?:code)?\s*[:\-]?\s*([a-zA-Z0-9]{11})", text, re.IGNORECASE)
        if ifsc_match:
            passbook_ifsc = ifsc_match.group(1).strip().upper()
            
        # LLM Fallback if still missing critical details
        if not passbook_name or not passbook_acc or not passbook_ifsc:
            from ai_engine.ollama_client import generate_text
            import json
            prompt = f"""You are a bank document parser.
Extract the Account Holder Name, Account Number, and IFSC Code from the following bank passbook OCR text.

=== OCR TEXT ===
{text[:1500]}

=== OUTPUT ===
Return ONLY a JSON object with keys: "name", "account_number", "ifsc_code". Do not add any explanation or markdown formatting.
"""
            try:
                res_text = generate_text(prompt, timeout=15)
                if "```json" in res_text:
                    res_text = res_text.split("```json")[1].split("```")[0]
                elif "```" in res_text:
                    res_text = res_text.split("```")[1].split("```")[0]
                parsed = json.loads(res_text.strip())
                if not passbook_name and parsed.get("name"):
                    passbook_name = parsed["name"].strip()
                if not passbook_acc and parsed.get("account_number"):
                    passbook_acc = str(parsed["account_number"]).strip()
                if not passbook_ifsc and parsed.get("ifsc_code"):
                    passbook_ifsc = str(parsed["ifsc_code"]).strip().upper()
            except Exception as e:
                logger.warning(f"LLM passbook fallback failed: {e}")

    if owner_name and not _is_valid_extracted_name(owner_name):
        owner_name = None
    if passbook_name and not _is_valid_extracted_name(passbook_name):
        passbook_name = None

    res = {
        "amounts": amounts[:20],        # top 20 amounts
        "dates": dates[:10],
        "pans": list(set(pans))[:5],
        "income": income,
        "employer": employer,
        "account_numbers": list(set(accounts))[:5],
        "ifsc_codes": list(set(ifsc))[:3],
        "raw_lines": lines[:50],        # first 50 lines for display
        "full_text": text[:3000],       # first 3k chars
    }
    
    if aadhaar_no:
        res["aadhaar_number"] = aadhaar_no
    if dl_no:
        res["driving_license_number"] = dl_no
    if passbook_name:
        res["account_holder_name"] = passbook_name
    if passbook_acc:
        res["account_number"] = passbook_acc
    if passbook_ifsc:
        res["ifsc_code"] = passbook_ifsc
    if owner_name:
        res["owner_name"] = owner_name
        
    return res


def _extract_income(text: str, amounts: list[float]) -> float | None:
    """Attempt to find the primary income/salary figure."""
    text_lower = text.lower()
    for keyword in INCOME_KEYWORDS:
        # Look for the keyword on a line and grab the first large number on that line
        for line in text.splitlines():
            if keyword in line.lower():
                found = AMOUNT_PATTERN.findall(line)
                for f in found:
                    val = _parse_amount(f)
                    if 5000 < val < 10_000_000:  # plausible monthly salary range
                        return val
    # Fallback: return largest amount that looks like a salary
    for amt in amounts:
        if 5000 < amt < 1_000_000:
            return amt
    return None


def _extract_employer(text: str) -> str | None:
    """Heuristic: employer name usually appears near 'Employer:', 'Company:', 'Payslip of'."""
    patterns = [
        r"(?:employer|company|organisation|organization)\s*[:\-]?\s*([A-Za-z][^\n]{3,50})",
        r"(?:payslip of|salary slip of)\s+([A-Za-z][^\n]{3,50})",
        r"(?:dear employee of)\s+([A-Za-z][^\n]{3,50})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            candidate = match.group(1).strip()
            if len(candidate) > 3:
                return candidate[:80]
    return None


def _parse_amount(raw: str) -> float:
    """Parse a matched amount string (with commas) to float."""
    try:
        return float(raw.replace(",", ""))
    except ValueError:
        return 0.0
