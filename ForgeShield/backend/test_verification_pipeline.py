import sys
from pathlib import Path

# Add backend directory to python path
sys.path.append(str(Path(__file__).parent))

import unittest
from config import settings
from forensics.semantic_checker import check_cross_document_consistency, compare_names
from ai_engine.risk_scorer import compute_overall_risk

class TestVerificationPipeline(unittest.TestCase):
    def test_compare_names(self):
        # Matching names
        self.assertTrue(compare_names("Rajesh Kumar", "Rajesh Kumar")[0])
        self.assertTrue(compare_names("Rajesh Kumar", "Kumar Rajesh")[0])
        self.assertTrue(compare_names("Rajesh Kumar Sharma", "Rajesh Kumar")[0])
        # Mismatching names
        self.assertFalse(compare_names("Rajesh Kumar", "Suresh Kumar")[0])
        
    def test_genuine_case_consistency(self):
        case_data = {
            "applicant_name": "Rajesh Kumar",
            "applicant_pan": "ABCDE1234F",
            "applicant_type": "salaried",
            "declared_details": {
                "aadhaar_promoter": "1234 5678 9012",
                "dob": "15/08/1990",
                "employer_name": "Greentech Solutions",
                "monthly_salary": "85000",
                "registered_address": "Flat 101, Green Meadows, Bengaluru"
            }
        }
        
        documents = [
            {
                "type": "aadhaar_card",
                "filename": "aadhaar.pdf",
                "fields": {
                    "owner_name": "Rajesh Kumar",
                    "aadhaar_number": "1234 5678 9012",
                    "dob": "15/08/1990",
                    "address": "Flat 101, Green Meadows, Bengaluru",
                    "field_metadata": {
                        "owner_name": {"confidence": 95.0, "status": "VERIFIED"},
                        "aadhaar_number": {"confidence": 98.0, "status": "VERIFIED"},
                        "dob": {"confidence": 92.0, "status": "VERIFIED"},
                        "address": {"confidence": 90.0, "status": "VERIFIED"}
                    }
                }
            },
            {
                "type": "pan_card",
                "filename": "pan.pdf",
                "fields": {
                    "owner_name": "Rajesh Kumar",
                    "pan_number": "ABCDE1234F",
                    "dob": "15/08/1990",
                    "field_metadata": {
                        "owner_name": {"confidence": 94.0, "status": "VERIFIED"},
                        "pan_number": {"confidence": 96.0, "status": "VERIFIED"},
                        "dob": {"confidence": 91.0, "status": "VERIFIED"}
                    }
                }
            },
            {
                "type": "salary_slip",
                "filename": "salary.pdf",
                "fields": {
                    "owner_name": "Rajesh Kumar",
                    "employer": "Greentech Solutions",
                    "monthly_income": 85000.0,
                    "field_metadata": {
                        "owner_name": {"confidence": 93.0, "status": "VERIFIED"},
                        "employer": {"confidence": 95.0, "status": "VERIFIED"},
                        "monthly_income": {"confidence": 97.0, "status": "VERIFIED"}
                    }
                }
            },
            {
                "type": "bank_statement",
                "filename": "bank.pdf",
                "fields": {
                    "owner_name": "Rajesh Kumar",
                    "avg_monthly_credit": 85000.0,
                    "account_numbers": ["9876543210"],
                    "ifsc_codes": ["KKBK0008000"],
                    "field_metadata": {
                        "owner_name": {"confidence": 92.0, "status": "VERIFIED"},
                        "avg_monthly_credit": {"confidence": 94.0, "status": "VERIFIED"}
                    }
                }
            }
        ]
        
        res = check_cross_document_consistency(documents, case_data)
        
        self.assertFalse(res["critical_identity_mismatch"])
        self.assertEqual(res["identity_score"], 100.0)
        self.assertEqual(res["financial_score"], 100.0)
        self.assertEqual(res["consistency_score"], 100.0)
        
    def test_mismatched_identity_safeguard(self):
        # Case created for Rajesh Kumar, but uploads Suresh Kumar's Aadhaar Card
        case_data = {
            "applicant_name": "Rajesh Kumar",
            "applicant_pan": "ABCDE1234F",
            "applicant_type": "salaried",
            "declared_details": {
                "aadhaar_promoter": "1234 5678 9012",
                "dob": "15/08/1990",
                "employer_name": "Greentech Solutions",
                "monthly_salary": "85000"
            }
        }
        
        documents = [
            {
                "type": "aadhaar_card",
                "filename": "suresh_aadhaar.pdf",
                "fields": {
                    "owner_name": "Suresh Kumar",
                    "aadhaar_number": "9999 8888 7777",
                    "dob": "15/08/1990",
                    "field_metadata": {
                        "owner_name": {"confidence": 95.0, "status": "VERIFIED"},
                        "aadhaar_number": {"confidence": 98.0, "status": "VERIFIED"},
                        "dob": {"confidence": 92.0, "status": "VERIFIED"}
                    }
                }
            }
        ]
        
        res = check_cross_document_consistency(documents, case_data)
        self.assertTrue(res["critical_identity_mismatch"])
        self.assertEqual(res["identity_score"], 0.0)
        
        # Test risk scoring
        risk = compute_overall_risk(
            authenticity_score=90.0,
            consistency_score=res["consistency_score"],
            identity_score=res["identity_score"],
            financial_score=res["financial_score"],
            relationship_risk_score=0.0,
            ocr_confidence=res["ocr_confidence"],
            critical_identity_mismatch=res["critical_identity_mismatch"]
        )
        
        self.assertEqual(risk["verdict"], "REJECT")
        self.assertLessEqual(risk["overall_score"], 30.0)

    def test_employer_conflict_safeguard(self):
        # Employer differs between declared and Salary Slip
        case_data = {
            "applicant_name": "Rajesh Kumar",
            "applicant_pan": "ABCDE1234F",
            "applicant_type": "salaried",
            "declared_details": {
                "employer_name": "Greentech Solutions"
            }
        }
        
        documents = [
            {
                "type": "salary_slip",
                "filename": "salary_slip.pdf",
                "fields": {
                    "owner_name": "Rajesh Kumar",
                    "employer": "Fake Shell Corporation",
                    "field_metadata": {
                        "owner_name": {"confidence": 95.0, "status": "VERIFIED"},
                        "employer": {"confidence": 95.0, "status": "VERIFIED"}
                    }
                }
            }
        ]
        
        res = check_cross_document_consistency(documents, case_data)
        self.assertTrue(res["critical_identity_mismatch"])
        self.assertEqual(res["identity_score"], 0.0)

if __name__ == "__main__":
    unittest.main()
