import sys
import os
import io
from pathlib import Path

# Force UTF-8 stdout to avoid Windows encoding crashes
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent
sys.path.append(str(backend_dir))

from forensics.benford_analyzer import run_benfords_analysis
from forensics.entropy_analyzer import check_numeric_entropy
from forensics.fraud_dna import generate_document_dna, match_fraud_dna
from forensics.compliance_checker import check_regulatory_compliance
from ai_engine.risk_scorer import compute_overall_risk

def test_benfords_law():
    print("Testing Benford's Law Analyzer...")
    # Compliant text (lots of digits starting with 1, 2, 3)
    compliant_text = "Amounts: 120.50, 150.00, 240.20, 310.00, 19.99, 105.00, 21.00, 115.50, 420.00, 13.00, 180.00, 202.00, 14.50"
    res_clean = run_benfords_analysis(compliant_text)
    print(f"Clean text triggered: {res_clean['triggered']} (Chi-Sq: {res_clean['chi_sq']})")
    assert not res_clean['triggered'] or res_clean['chi_sq'] < 30.0

    # Non-compliant text (lots of digits starting with 8 and 9, completely unnatural)
    fabricated_text = "Amounts: 880.00, 890.00, 990.00, 810.00, 920.00, 840.00, 905.00, 881.00, 940.00, 830.00, 999.00, 875.00"
    res_anomaly = run_benfords_analysis(fabricated_text)
    print(f"Fabricated text triggered: {res_anomaly['triggered']} (Chi-Sq: {res_anomaly['chi_sq']}, Description: {res_anomaly['description']})")
    assert res_anomaly['triggered']
    print("[OK] Benford's Law test passed.\n")

def test_numeric_entropy():
    print("Testing Numeric Entropy Analyzer...")
    # Anomalous text (repeated amount and round numbers)
    anomalous_text = "Salary: 45000, rent: 45000, food: 45000, travel: 45000, savings: 45000"
    res = check_numeric_entropy(anomalous_text)
    print(f"Anomalous text entropy findings count: {len(res)}")
    for f in res:
        print(f"  Finding: {f['type']} | Severity: {f['severity']} | Description: {f['description']}")
    assert len(res) > 0
    print("[OK] Numeric Entropy test passed.\n")

def test_fraud_dna():
    print("Testing Fraud DNA Fingerprinting...")
    text_sample = "Apex Logitech Solutions Pvt Ltd PAN ABCDE1234F Aadhaar 1234-5678-9012"
    dna_sig = generate_document_dna("pan", text_sample, ela_density=0.0, insertion_count=0)
    print(f"Generated DNA Signature: {dna_sig}")
    assert dna_sig is not None

    # Test cross-case matching against cases database
    mock_cases = {
        "case_001": {
            "case_id": "case_001",
            "analysis": {
                "document_reports": [
                    {
                        "filename": "fake_pan.pdf",
                        "type": "pan",
                        "tamper_result": {
                            "dna_signature": dna_sig
                        }
                    }
                ]
            }
        }
    }
    match_res = match_fraud_dna(dna_sig, current_case_id="case_002", all_cases=mock_cases)
    print(f"Match Suspicious: {match_res['suspicious']} | Matches count: {len(match_res['matches'])}")
    assert match_res['suspicious']
    assert len(match_res['matches']) > 0
    print("[OK] Fraud DNA test passed.\n")

def test_compliance():
    print("Testing Regulatory Compliance Checker...")
    mock_findings = [
        {"check_type": "IDENTITY_MISMATCH", "severity": "HIGH", "confidence": 0.9, "detail": "Name mismatch"},
        {"check_type": "BENFORDS_LAW_ANOMALY", "severity": "HIGH", "confidence": 0.85, "detail": "Benford deviation"}
    ]
    violations = check_regulatory_compliance(mock_findings)
    print(f"Compliance violations count: {len(violations)}")
    for v in violations:
        print(f"  Violation: {v['finding_type']} | Reg: {v['regulation']} | Act: {v['act']}")
    assert len(violations) > 0
    print("[OK] Compliance Checker test passed.\n")

def test_risk_scorer():
    print("Testing Penalty-Based Risk Scorer...")
    scores = compute_overall_risk(
        authenticity_score=100.0,
        consistency_score=100.0,
        identity_score=100.0,
        financial_score=100.0,
        relationship_risk_score=0.0,
        ocr_confidence=95.0,
        benford_penalty=25.0,
        entropy_penalty=20.0
    )
    print(f"Risk Scorer Overall Score: {scores['overall_score']}% | Verdict: {scores['verdict']}")
    print(f"Score Breakdown: {scores['score_breakdown']}")
    print(f"Floor Reason: {scores.get('floor_applied')}")
    # High benford penalty >= 20 should trigger hard floor of 45
    assert scores['overall_score'] == 45.0
    assert scores['verdict'] == "HOLD"
    print("[OK] Risk Scorer test passed.\n")

if __name__ == "__main__":
    print("================================================================")
    print("RUNNING TRUTHLENS INTEGRATION TESTS")
    print("================================================================")
    try:
        test_benfords_law()
        test_numeric_entropy()
        test_fraud_dna()
        test_compliance()
        test_risk_scorer()
        print("ALL INTEGRATION TESTS PASSED SUCCESSFULLY!")
    except AssertionError as e:
        print("TEST VALIDATION FAILURE!")
        raise e
