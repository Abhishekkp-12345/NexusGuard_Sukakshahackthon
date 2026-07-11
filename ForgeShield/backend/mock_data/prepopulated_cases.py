"""
ForgeShield AI — Prepopulated Cases for Live Demo
===================================================
Contains 10 high-fidelity underwriting cases representing different risk profiles.
Loaded on startup by FastAPI to provide a rich dashboard.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta

def get_prepopulated_cases() -> dict[str, dict]:
    now = datetime.utcnow()
    
    cases = {}
    
    # ── CASE 1: Rajesh Kumar (HOLD) ──────────────────────────────────
    c1_id = "CB-HML-2026-BLR-CCE5DB1B"
    cases[c1_id] = {
        "case_id": c1_id,
        "applicant_name": "Rajesh Kumar",
        "applicant_pan": "ABCDE1234F",
        "loan_type": "Home Loan",
        "loan_amount": 4500000.0,
        "branch": "Bengaluru Main",
        "status": "ANALYZED",
        "verdict": "HOLD",
        "verdict_notes": "Salary slip shows post-dated modifications and income inflation compared to bank credits. Awaiting HR direct confirmation.",
        "reviewed_by": "Senior Underwriter",
        "created_at": (now - timedelta(days=2)).isoformat(),
        "updated_at": (now - timedelta(days=2)).isoformat(),
        "documents": ["genuine_salary_slip.pdf", "bank_statement.pdf", "land_record.pdf"],
        "analysis": {
            "case_id": c1_id,
            "analyzed_at": (now - timedelta(days=2)).isoformat(),
            "elapsed_ms": 14200,
            "applicant_name": "Rajesh Kumar",
            "loan_amount": 4500000.0,
            "loan_type": "Home Loan",
            "branch": "Bengaluru Main",
            "authenticity_score": 70.0,
            "consistency_score": 61.0,
            "relationship_risk_score": 22.0,
            "overall_score": 68.4,
            "verdict": "HOLD",
            "verdict_color": "#f59e0b",
            "confidence": "HIGH",
            "score_breakdown": {
                "authenticity": {"score": 70.0, "weight": 0.35, "contribution": 24.5},
                "consistency": {"score": 61.0, "weight": 0.40, "contribution": 24.4},
                "relationship": {"risk_score": 22.0, "safety_score": 78.0, "weight": 0.25, "contribution": 19.5}
            },
            "all_findings": [
                {
                    "type": "INCOME_INCONSISTENCY",
                    "severity": "HIGH",
                    "detail": "Income mismatch across sources (118% deviation):\n  • Salary Slip: ₹1,85,000/month\n  • Bank Credits (avg/month): ₹85,133/month\n  → Declared salary is 2.1x higher than actual bank credits.",
                    "sources": {"Salary Slip": 185000.0, "Bank Credits (avg/month)": 85133.0}
                },
                {
                    "type": "METADATA_MODIFICATION",
                    "severity": "HIGH",
                    "detail": "Document was last modified 62 days after creation.\n  Created: 2025-07-01\n  Modified: 2025-09-01 using Adobe Acrobat 23.0 (generic editor).",
                    "document": "tampered_salary_slip.pdf"
                },
                {
                    "type": "ACTIVE_GUARANTOR",
                    "severity": "MEDIUM",
                    "detail": "Applicant is acting as guarantor in 1 other active case (CB-HML-2026-BLR-8921A). This increases total liability exposure."
                }
            ],
            "high_severity_count": 2,
            "medium_severity_count": 1,
            "ai_recommendation": "The declared monthly income of ₹1,85,000 is inconsistent with the average bank credit of ₹85,133 seen across 6 months. Additionally, salary slip metadata shows it was last edited using Adobe Acrobat 2 months after its stated issue date. Recommend: HOLD. Request employer verification directly from HR.",
            "document_reports": [
                {
                    "filename": "tampered_salary_slip.pdf",
                    "type": "salary_slip",
                    "authenticity_score": 65.0,
                    "extracted_fields": {
                        "gross_salary": 185000.0,
                        "net_salary": 145400.0,
                        "pf_deduction": 14400.0,
                        "tds_deduction": 25000.0,
                        "pan": "ABCDE1234F"
                    }
                }
            ],
            "graph_data": {
                "nodes": [
                    {"id": "APPLICANT:ABCDE1234F", "label": "Rajesh Kumar", "type": "applicant", "color": "#3B82F6", "data": {}},
                    {"id": "EMPLOYER:GREENTECH", "label": "Greentech Solutions", "type": "employer", "color": "#10B981", "data": {}}
                ],
                "links": [
                    {"source": "APPLICANT:ABCDE1234F", "target": "EMPLOYER:GREENTECH", "label": "EMPLOYED_BY"}
                ]
            }
        }
    }

    # ── CASE 2: Priya Sharma (APPROVE) ────────────────────────────────
    c2_id = "CB-PLN-2026-DLH-598211AA"
    cases[c2_id] = {
        "case_id": c2_id,
        "applicant_name": "Priya Sharma",
        "applicant_pan": "XYZSP9876C",
        "loan_type": "Personal Loan",
        "loan_amount": 500000.0,
        "branch": "Delhi Connaught Place",
        "status": "ANALYZED",
        "verdict": "APPROVE",
        "verdict_notes": "All verified income sources align with bank statement. Clean metadata.",
        "created_at": (now - timedelta(days=1, hours=4)).isoformat(),
        "updated_at": (now - timedelta(days=1, hours=4)).isoformat(),
        "documents": ["salary_slip.pdf", "bank_statement.pdf"],
        "analysis": {
            "case_id": c2_id,
            "analyzed_at": (now - timedelta(days=1, hours=4)).isoformat(),
            "elapsed_ms": 9400,
            "applicant_name": "Priya Sharma",
            "loan_amount": 500000.0,
            "loan_type": "Personal Loan",
            "branch": "Delhi Connaught Place",
            "authenticity_score": 98.0,
            "consistency_score": 95.0,
            "relationship_risk_score": 0.0,
            "overall_score": 97.3,
            "verdict": "APPROVE",
            "verdict_color": "#10b981",
            "confidence": "HIGH",
            "score_breakdown": {
                "authenticity": {"score": 98.0, "weight": 0.35, "contribution": 34.3},
                "consistency": {"score": 95.0, "weight": 0.40, "contribution": 38.0},
                "relationship": {"risk_score": 0.0, "safety_score": 100.0, "weight": 0.25, "contribution": 25.0}
            },
            "all_findings": [
                {"type": "INCOME_CONSISTENT", "severity": "INFO", "detail": "Income figures across Salary Slip and Bank Credits match (within 3% deviation)."}
            ],
            "high_severity_count": 0,
            "medium_severity_count": 0,
            "ai_recommendation": "Applicant's documents are authentic and verified. High income-to-credit correlation (97% matching). No guarantor conflicts or property pledging concerns. Recommend: APPROVE.",
            "document_reports": [],
            "graph_data": {"nodes": [], "links": []}
        }
    }

    # ── CASE 3: Srinivas Rao (REJECT) ─────────────────────────────────
    c3_id = "CB-BLN-2026-HYD-7782A10F"
    cases[c3_id] = {
        "case_id": c3_id,
        "applicant_name": "Srinivas Rao",
        "applicant_pan": "PPQQR5566K",
        "loan_type": "Business Loan",
        "loan_amount": 12000000.0,
        "branch": "Hyderabad HITEC City",
        "status": "ANALYZED",
        "verdict": "REJECT",
        "verdict_notes": "High risk of corporate shell structure and ELA tamper detected on financial records.",
        "created_at": (now - timedelta(days=3)).isoformat(),
        "updated_at": (now - timedelta(days=3)).isoformat(),
        "documents": ["business_itrs.pdf", "bank_statement.pdf", "partnership_deed.pdf"],
        "analysis": {
            "case_id": c3_id,
            "analyzed_at": (now - timedelta(days=3)).isoformat(),
            "elapsed_ms": 18200,
            "applicant_name": "Srinivas Rao",
            "loan_amount": 12000000.0,
            "loan_type": "Business Loan",
            "branch": "Hyderabad HITEC City",
            "authenticity_score": 40.0,
            "consistency_score": 50.0,
            "relationship_risk_score": 70.0,
            "overall_score": 41.5,
            "verdict": "REJECT",
            "verdict_color": "#ef4444",
            "confidence": "HIGH",
            "score_breakdown": {
                "authenticity": {"score": 40.0, "weight": 0.35, "contribution": 14.0},
                "consistency": {"score": 50.0, "weight": 0.40, "contribution": 20.0},
                "relationship": {"risk_score": 70.0, "safety_score": 30.0, "weight": 0.25, "contribution": 7.5}
            },
            "all_findings": [
                {
                    "type": "ELA_TAMPER_DETECTED",
                    "severity": "HIGH",
                    "detail": "ELA analysis detected direct pixel modification in the 'Net Profit' row of the business statement.",
                    "document": "business_itrs.pdf"
                },
                {
                    "type": "SHELL_COMPANY_SIGNAL",
                    "severity": "HIGH",
                    "detail": "Employer 'Rao Tech Consulting' shares the same residential address as applicant. Likely shell entity."
                }
            ],
            "high_severity_count": 2,
            "medium_severity_count": 0,
            "ai_recommendation": "High risk of corporate shell structure fraud. Applicant's declared business address matches residential address. Multiple ELA tamper points detected on tax documents. Recommend: REJECT.",
            "document_reports": [],
            "graph_data": {"nodes": [], "links": []}
        }
    }

    # ── CASE 4: Amit Patel (HOLD) ────────────────────────────────────
    c4_id = "CB-HML-2026-BOM-1029415B"
    cases[c4_id] = {
        "case_id": c4_id,
        "applicant_name": "Amit Patel",
        "applicant_pan": "JKLMN4321A",
        "loan_type": "Home Loan",
        "loan_amount": 7500000.0,
        "branch": "Mumbai Fort",
        "status": "ANALYZED",
        "verdict": "HOLD",
        "verdict_notes": "Bank statement running totals failed balance verification. Awaiting clarification.",
        "created_at": (now - timedelta(hours=12)).isoformat(),
        "updated_at": (now - timedelta(hours=12)).isoformat(),
        "documents": ["salary_slip.pdf", "bank_statement.pdf"],
        "analysis": {
            "case_id": c4_id,
            "analyzed_at": (now - timedelta(hours=12)).isoformat(),
            "elapsed_ms": 11000,
            "applicant_name": "Amit Patel",
            "loan_amount": 7500000.0,
            "loan_type": "Home Loan",
            "branch": "Mumbai Fort",
            "authenticity_score": 80.0,
            "consistency_score": 40.0,
            "relationship_risk_score": 10.0,
            "overall_score": 66.5,
            "verdict": "HOLD",
            "verdict_color": "#f59e0b",
            "confidence": "MEDIUM",
            "score_breakdown": {
                "authenticity": {"score": 80.0, "weight": 0.35, "contribution": 28.0},
                "consistency": {"score": 40.0, "weight": 0.40, "contribution": 16.0},
                "relationship": {"risk_score": 10.0, "safety_score": 90.0, "weight": 0.25, "contribution": 22.5}
            },
            "all_findings": [
                {
                    "type": "BALANCE_MATH_ERROR",
                    "severity": "HIGH",
                    "detail": "Balance arithmetic errors found in 4 transaction rows. First error at row 12: expected ₹3,24,152.00, found ₹4,24,152.00."
                }
            ],
            "high_severity_count": 1,
            "medium_severity_count": 0,
            "ai_recommendation": "Bank statement balance arithmetic failed running checks. High probability of manual value manipulation in credit rows. Recommend: HOLD for manual bank verification.",
            "document_reports": [],
            "graph_data": {"nodes": [], "links": []}
        }
    }

    # ── CASE 5: Karan Malhotra (REJECT) ───────────────────────────────
    c5_id = "CB-MTG-2026-DLH-382956CC"
    cases[c5_id] = {
        "case_id": c5_id,
        "applicant_name": "Karan Malhotra",
        "applicant_pan": "DDFFF4499M",
        "loan_type": "Mortgage Loan",
        "loan_amount": 8500000.0,
        "branch": "Delhi Connaught Place",
        "status": "ANALYZED",
        "verdict": "REJECT",
        "verdict_notes": "Double pledging collateral detected on Survey No 142/3A.",
        "created_at": (now - timedelta(days=4)).isoformat(),
        "updated_at": (now - timedelta(days=4)).isoformat(),
        "documents": ["land_deed.pdf", "itr.pdf"],
        "analysis": {
            "case_id": c5_id,
            "analyzed_at": (now - timedelta(days=4)).isoformat(),
            "elapsed_ms": 13400,
            "applicant_name": "Karan Malhotra",
            "loan_amount": 8500000.0,
            "loan_type": "Mortgage Loan",
            "branch": "Delhi Connaught Place",
            "authenticity_score": 90.0,
            "consistency_score": 35.0,
            "relationship_risk_score": 90.0,
            "overall_score": 48.0,
            "verdict": "REJECT",
            "verdict_color": "#ef4444",
            "confidence": "HIGH",
            "score_breakdown": {
                "authenticity": {"score": 90.0, "weight": 0.35, "contribution": 31.5},
                "consistency": {"score": 35.0, "weight": 0.40, "contribution": 14.0},
                "relationship": {"risk_score": 90.0, "safety_score": 10.0, "weight": 0.25, "contribution": 2.5}
            },
            "all_findings": [
                {
                    "type": "DOUBLE_PLEDGING",
                    "severity": "HIGH",
                    "detail": "Asset (Survey No: 142/3A) is already pledged as collateral in active loan application CB-HML-2026-BLR-CCE5DB1B."
                }
            ],
            "high_severity_count": 1,
            "medium_severity_count": 0,
            "ai_recommendation": "Critical collateral conflict. The pledged land record (Survey 142/3A) is active in another loan application. Potential double-pledging fraud. Recommend: REJECT.",
            "document_reports": [],
            "graph_data": {"nodes": [], "links": []}
        }
    }

    # ── CASE 6: Ananya Hegde (APPROVE) ────────────────────────────────
    c6_id = "CB-HML-2026-BLR-9041285A"
    cases[c6_id] = {
        "case_id": c6_id,
        "applicant_name": "Ananya Hegde",
        "applicant_pan": "HHGGE9876C",
        "loan_type": "Home Loan",
        "loan_amount": 3500000.0,
        "branch": "Bengaluru Main",
        "status": "ANALYZED",
        "verdict": "APPROVE",
        "created_at": (now - timedelta(days=1)).isoformat(),
        "updated_at": (now - timedelta(days=1)).isoformat(),
        "documents": ["salary_slip.pdf", "bank_statement.pdf", "land_deed.pdf"],
        "analysis": {
            "case_id": c6_id,
            "analyzed_at": (now - timedelta(days=1)).isoformat(),
            "elapsed_ms": 8200,
            "applicant_name": "Ananya Hegde",
            "loan_amount": 3500000.0,
            "loan_type": "Home Loan",
            "branch": "Bengaluru Main",
            "authenticity_score": 95.0,
            "consistency_score": 98.0,
            "relationship_risk_score": 0.0,
            "overall_score": 97.4,
            "verdict": "APPROVE",
            "verdict_color": "#10b981",
            "confidence": "HIGH",
            "score_breakdown": {
                "authenticity": {"score": 95.0, "weight": 0.35, "contribution": 33.25},
                "consistency": {"score": 98.0, "weight": 0.40, "contribution": 39.2},
                "relationship": {"risk_score": 0.0, "safety_score": 100.0, "weight": 0.25, "contribution": 25.0}
            },
            "all_findings": [
                {"type": "INCOME_CONSISTENT", "severity": "INFO", "detail": "Salaries match bank credits exactly."}
            ],
            "high_severity_count": 0,
            "medium_severity_count": 0,
            "ai_recommendation": "Verified salaries match bank deposits exactly. Property deed guidelines align with SRO Whitefield stamp rates. Recommend: APPROVE.",
            "document_reports": [],
            "graph_data": {"nodes": [], "links": []}
        }
    }

    # ── CASE 7: Vikram Singh (APPROVE) ────────────────────────────────
    c7_id = "CB-PLN-2026-BOM-883915AA"
    cases[c7_id] = {
        "case_id": c7_id,
        "applicant_name": "Vikram Singh",
        "applicant_pan": "VVSIN1122D",
        "loan_type": "Personal Loan",
        "loan_amount": 800000.0,
        "branch": "Mumbai Fort",
        "status": "ANALYZED",
        "verdict": "APPROVE",
        "created_at": (now - timedelta(days=2, hours=3)).isoformat(),
        "updated_at": (now - timedelta(days=2, hours=3)).isoformat(),
        "documents": ["salary_slip.pdf", "bank_statement.pdf"],
        "analysis": {
            "case_id": c7_id,
            "analyzed_at": (now - timedelta(days=2, hours=3)).isoformat(),
            "elapsed_ms": 7800,
            "applicant_name": "Vikram Singh",
            "loan_amount": 800000.0,
            "loan_type": "Personal Loan",
            "branch": "Mumbai Fort",
            "authenticity_score": 92.0,
            "consistency_score": 91.0,
            "relationship_risk_score": 5.0,
            "overall_score": 92.3,
            "verdict": "APPROVE",
            "verdict_color": "#10b981",
            "confidence": "HIGH",
            "score_breakdown": {
                "authenticity": {"score": 92.0, "weight": 0.35, "contribution": 32.2},
                "consistency": {"score": 91.0, "weight": 0.40, "contribution": 36.4},
                "relationship": {"risk_score": 5.0, "safety_score": 95.0, "weight": 0.25, "contribution": 23.75}
            },
            "all_findings": [],
            "high_severity_count": 0,
            "medium_severity_count": 0,
            "ai_recommendation": "All core credentials verified. Minor metadata gap in tax forms resolved. Stable cash flows. Recommend: APPROVE.",
            "document_reports": [],
            "graph_data": {"nodes": [], "links": []}
        }
    }

    # ── CASE 8: Sneha Reddy (HOLD) ────────────────────────────────────
    c8_id = "CB-HML-2026-HYD-552914CC"
    cases[c8_id] = {
        "case_id": c8_id,
        "applicant_name": "Sneha Reddy",
        "applicant_pan": "SSRED8833F",
        "loan_type": "Home Loan",
        "loan_amount": 9500000.0,
        "branch": "Hyderabad HITEC City",
        "status": "ANALYZED",
        "verdict": "HOLD",
        "verdict_notes": "Land valuation outlier detected (overvalued by 58%). Physical valuation recommended.",
        "created_at": (now - timedelta(days=5)).isoformat(),
        "updated_at": (now - timedelta(days=5)).isoformat(),
        "documents": ["salary_slip.pdf", "bank_statement.pdf", "land_deed.pdf"],
        "analysis": {
            "case_id": c8_id,
            "analyzed_at": (now - timedelta(days=5)).isoformat(),
            "elapsed_ms": 12100,
            "applicant_name": "Sneha Reddy",
            "loan_amount": 9500000.0,
            "loan_type": "Home Loan",
            "branch": "Hyderabad HITEC City",
            "authenticity_score": 85.0,
            "consistency_score": 55.0,
            "relationship_risk_score": 20.0,
            "overall_score": 71.75,
            "verdict": "HOLD",
            "verdict_color": "#f59e0b",
            "confidence": "HIGH",
            "score_breakdown": {
                "authenticity": {"score": 85.0, "weight": 0.35, "contribution": 29.75},
                "consistency": {"score": 55.0, "weight": 0.40, "contribution": 22.0},
                "relationship": {"risk_score": 20.0, "safety_score": 80.0, "weight": 0.25, "contribution": 20.0}
            },
            "all_findings": [
                {
                    "type": "LAND_VALUATION_OUTLIER",
                    "severity": "HIGH",
                    "detail": "Declared land value ₹95,00,000 is overvalued by 58% vs market guide rate (₹60,00,000)."
                }
            ],
            "high_severity_count": 1,
            "medium_severity_count": 0,
            "ai_recommendation": "Collateral property appears overvalued by 58% relative to guideline rates. High LTV risk. Recommend: HOLD for independent physical valuation.",
            "document_reports": [],
            "graph_data": {"nodes": [], "links": []}
        }
    }

    # ── CASE 9: Rohan Das (HOLD) ─────────────────────────────────────
    c9_id = "CB-BLN-2026-CHN-449102B1"
    cases[c9_id] = {
        "case_id": c9_id,
        "applicant_name": "Rohan Das",
        "applicant_pan": "RRRDAS7733M",
        "loan_type": "Business Loan",
        "loan_amount": 6000000.0,
        "branch": "Chennai Anna Salai",
        "status": "ANALYZED",
        "verdict": "HOLD",
        "verdict_notes": "Inconsistent fonts and stripped metadata on salary slip.",
        "created_at": (now - timedelta(days=6)).isoformat(),
        "updated_at": (now - timedelta(days=6)).isoformat(),
        "documents": ["salary_slip.pdf", "bank_statement.pdf"],
        "analysis": {
            "case_id": c9_id,
            "analyzed_at": (now - timedelta(days=6)).isoformat(),
            "elapsed_ms": 10500,
            "applicant_name": "Rohan Das",
            "loan_amount": 6000000.0,
            "loan_type": "Business Loan",
            "branch": "Chennai Anna Salai",
            "authenticity_score": 50.0,
            "consistency_score": 75.0,
            "relationship_risk_score": 30.0,
            "overall_score": 65.0,
            "verdict": "HOLD",
            "verdict_color": "#f59e0b",
            "confidence": "MEDIUM",
            "score_breakdown": {
                "authenticity": {"score": 50.0, "weight": 0.35, "contribution": 17.5},
                "consistency": {"score": 75.0, "weight": 0.40, "contribution": 30.0},
                "relationship": {"risk_score": 30.0, "safety_score": 70.0, "weight": 0.25, "contribution": 17.5}
            },
            "all_findings": [
                {
                    "type": "FONT_INCONSISTENCY",
                    "severity": "MEDIUM",
                    "detail": "Document uses 5 distinct font families. Expected 1-2. Indicates potential modification."
                },
                {
                    "type": "STRIPPED_METADATA",
                    "severity": "MEDIUM",
                    "detail": "All PDF creation parameters are missing. Likely stripped by online editor."
                }
            ],
            "high_severity_count": 0,
            "medium_severity_count": 2,
            "ai_recommendation": "Document metadata stripped and fonts are inconsistent, indicating manual text insertion. Recommend: HOLD. Require HR certificate of salary.",
            "document_reports": [],
            "graph_data": {"nodes": [], "links": []}
        }
    }

    # ── CASE 10: Meera Nair (APPROVE) ─────────────────────────────────
    c10_id = "CB-EDN-2026-CHN-110943AA"
    cases[c10_id] = {
        "case_id": c10_id,
        "applicant_name": "Meera Nair",
        "applicant_pan": "MMNAIR4433D",
        "loan_type": "Education Loan",
        "loan_amount": 2500000.0,
        "branch": "Chennai Anna Salai",
        "status": "ANALYZED",
        "verdict": "APPROVE",
        "created_at": (now - timedelta(hours=6)).isoformat(),
        "updated_at": (now - timedelta(hours=6)).isoformat(),
        "documents": ["admission_letter.pdf", "co_applicant_statement.pdf"],
        "analysis": {
            "case_id": c10_id,
            "analyzed_at": (now - timedelta(hours=6)).isoformat(),
            "elapsed_ms": 7900,
            "applicant_name": "Meera Nair",
            "loan_amount": 2500000.0,
            "loan_type": "Education Loan",
            "branch": "Chennai Anna Salai",
            "authenticity_score": 99.0,
            "consistency_score": 96.0,
            "relationship_risk_score": 0.0,
            "overall_score": 98.0,
            "verdict": "APPROVE",
            "verdict_color": "#10b981",
            "confidence": "HIGH",
            "score_breakdown": {
                "authenticity": {"score": 99.0, "weight": 0.35, "contribution": 34.65},
                "consistency": {"score": 96.0, "weight": 0.40, "contribution": 38.4},
                "relationship": {"risk_score": 0.0, "safety_score": 100.0, "weight": 0.25, "contribution": 25.0}
            },
            "all_findings": [],
            "high_severity_count": 0,
            "medium_severity_count": 0,
            "ai_recommendation": "Clean university admission letter and verified sponsor co-applicant statement. Income validation verified. Recommend: APPROVE.",
            "document_reports": [],
            "graph_data": {"nodes": [], "links": []}
        }
    }

    return cases
