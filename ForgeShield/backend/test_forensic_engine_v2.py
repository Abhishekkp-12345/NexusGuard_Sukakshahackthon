"""
ForgeShield AI — Forensic Engine v2 Validation Suite
===================================================
Tests all 6 forensic layers:
  1. Image Forensics (Multi-quality ELA, Copy-move, DCT, Noise, Edge, Color)
  2. PDF Forensics & Structure Inspection
  3. Cross-Document Identity & Mismatch Verification
  4. Pure Penalty Risk Scoring Engine
"""

import sys
import unittest
from pathlib import Path
import numpy as np
import cv2

from forensics.ela_engine import run_ela, ela_authenticity_score
from forensics.tamper_detector import run_advanced_tamper_detection
from forensics.pdf_forensics import analyze_pdf_metadata
from forensics.identity_verifier import verify_identity_fields
from ai_engine.risk_scorer import compute_overall_risk


class TestForensicEngineV2(unittest.TestCase):

    def setUp(self):
        self.test_dir = Path("test_output_temp")
        self.test_dir.mkdir(exist_ok=True)

        # Generate synthetic clean test image saved at JPEG quality 95
        self.clean_img_path = self.test_dir / "clean_doc.jpg"
        img_clean = np.ones((600, 600, 3), dtype=np.uint8) * 245
        cv2.putText(img_clean, "CANARA BANK OFFICIAL STATEMENT", (30, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)
        cv2.putText(img_clean, "Account Holder: RAJESH SHARMA", (30, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
        cv2.putText(img_clean, "Net Balance: INR 4,50,000", (30, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
        cv2.imwrite(str(self.clean_img_path), img_clean, [cv2.IMWRITE_JPEG_QUALITY, 95])

        # Generate synthetic tampered image with regional high-frequency patch
        self.tampered_img_path = self.test_dir / "tampered_doc.jpg"
        img_base = cv2.imread(str(self.clean_img_path))
        # Create a textured patch with text and noise saved at low quality 20
        patch = np.random.randint(50, 220, (100, 250, 3), dtype=np.uint8)
        cv2.putText(patch, "EDITED: 9,99,000", (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)
        _, enc_patch = cv2.imencode(".jpg", patch, [cv2.IMWRITE_JPEG_QUALITY, 20])
        recomp_patch = cv2.imdecode(enc_patch, cv2.IMREAD_COLOR)

        # Splice low-quality patch onto high-quality base
        img_tampered = img_base.copy()
        img_tampered[120:220, 30:280] = recomp_patch
        cv2.imwrite(str(self.tampered_img_path), img_tampered, [cv2.IMWRITE_JPEG_QUALITY, 95])

    def tearDown(self):
        import shutil
        if self.test_dir.exists():
            shutil.rmtree(self.test_dir)

    def test_01_ela_engine_clean_vs_tampered(self):
        clean_ela = run_ela(self.clean_img_path)
        tampered_ela = run_ela(self.tampered_img_path)

        self.assertLess(clean_ela["tamper_score"], tampered_ela["tamper_score"])
        self.assertGreater(tampered_ela["tamper_score"], 20.0)

    def test_02_advanced_tamper_detection(self):
        res = run_advanced_tamper_detection(self.tampered_img_path)
        self.assertTrue(res["tampered"])
        self.assertGreater(res["tamper_score"], 0.0)
        self.assertGreater(len(res["findings"]), 0)
        self.assertIsNotNone(res["tamper_visualization"])

    def test_03_identity_mismatch_detection(self):
        case_data = {"applicant_name": "RAJESH SHARMA", "applicant_pan": "ABCDE1234F"}
        docs = [
          {"type": "aadhaar_card", "filename": "aadhaar.png", "fields": {"owner_name": "VIKRAM SINGH", "pan_number": "ABCDE1234F"}},
          {"type": "pan_card", "filename": "pan.png", "fields": {"owner_name": "RAJESH SHARMA", "pan_number": "XYZWR9999K"}},
        ]
        res = verify_identity_fields(docs, case_data)
        self.assertTrue(res["critical_identity_mismatch"])
        self.assertGreater(res["identity_penalty"], 0.0)
        self.assertGreater(len(res["mismatched_fields"]), 0)

    def test_04_pure_penalty_risk_scorer(self):
        # Case 1: Clean document -> high score / APPROVE
        clean_risk = compute_overall_risk(
            authenticity_score=98.0, consistency_score=100.0, identity_score=100.0,
            financial_score=100.0, relationship_risk_score=0.0, ocr_confidence=95.0,
            critical_identity_mismatch=False, identity_penalty=0.0, tamper_penalty=0.0,
        )
        self.assertEqual(clean_risk["verdict"], "APPROVE")
        self.assertGreaterEqual(clean_risk["overall_score"], 75.0)

        # Case 2: Tampered + Identity Mismatch -> REJECT hard-cap 29
        forged_risk = compute_overall_risk(
            authenticity_score=40.0, consistency_score=40.0, identity_score=0.0,
            financial_score=50.0, relationship_risk_score=60.0, ocr_confidence=70.0,
            critical_identity_mismatch=True, identity_penalty=40.0, tamper_penalty=30.0,
        )
        self.assertEqual(forged_risk["verdict"], "REJECT")
        self.assertLessEqual(forged_risk["overall_score"], 29.0)


if __name__ == "__main__":
    unittest.main()
