"""
NexusGuard — Synthetic Document Generator
==========================================
Generates realistic Indian banking, corporate, and land-registry
documents that embed a hidden fraud ring for demonstration.

Fraud patterns planted
──────────────────────
• Address overlap   : Doc 1 ↔ Doc 3  (same residential flat)
• Collateral conflict: Doc 1 ↔ Doc 4  (SR-504 pledged AND transferred)
• Guarantor loop    : Doc 2's guarantor (Rajesh) is Doc 1's applicant
• Shell company     : Doc 3 directors overlap with loan applicants
• Lien vs Transfer  : Doc 5 reveals bank lien + ownership change

100 % offline — no network calls.
"""

import os
import textwrap
from pathlib import Path
from datetime import datetime

from config import INPUT_DIR

# ════════════════════════════════════════════════════════════════════
#  Document templates
# ════════════════════════════════════════════════════════════════════

DOC1_LOAN_APP_RAJESH = textwrap.dedent("""\
    ╔══════════════════════════════════════════════════════════════════╗
    ║              CANARA BANK — HOME LOAN APPLICATION               ║
    ║                  Branch: MG Road, Bengaluru                    ║
    ╚══════════════════════════════════════════════════════════════════╝

    Application Ref   : CB/HML/2024/BLR/00451
    Date of Application: 15/03/2024
    Branch Code        : 002145

    ── SECTION A: APPLICANT DETAILS ──────────────────────────────────
    Full Name          : Rajesh Kumar
    Father's Name      : Suresh Kumar
    Date of Birth      : 12/07/1985
    PAN Number         : ABCPK1234F
    Aadhaar Number     : 9876 5432 1098
    Mobile             : +91 9845012345
    Email              : rajesh.kumar@email.com
    Occupation         : Senior Manager, Infosys Ltd.
    Monthly Income     : Rs. 1,85,000
    Residential Address: Flat 402, Royal Residency, MG Road, Bengaluru - 560001

    ── SECTION B: LOAN DETAILS ───────────────────────────────────────
    Loan Type          : Home Loan (Housing Finance)
    Loan Amount Requested : Rs. 45,00,000 (Forty-Five Lakhs Only)
    Tenure             : 20 Years (240 months)
    Purpose            : Purchase of residential property
    Expected EMI       : Rs. 38,750 (approx.)

    ── SECTION C: COLLATERAL / SECURITY DETAILS ──────────────────────
    Type of Collateral : Immovable Property — Land + Construction
    Land Survey Number : SR-504
    Village Code       : Whitefield
    SRO Code           : KA-BLR-E
    Property Location  : Whitefield, Bengaluru East Taluk, Karnataka
    Property Area      : 2400 sq. ft. (site) + 1800 sq. ft. (built-up)
    Estimated Value    : Rs. 72,00,000 (Seventy-Two Lakhs)
    Title Holder       : Rajesh Kumar (self)
    Encumbrance Status : Clear as of 01/03/2024

    ── SECTION D: DECLARATION ────────────────────────────────────────
    I, Rajesh Kumar, hereby declare that the information furnished
    above is true and correct to the best of my knowledge.  I authorise
    Canara Bank to verify the above details from any source.

    Signature of Applicant: _____________________
    Date: 15/03/2024
    Place: Bengaluru

    ── FOR BANK USE ONLY ─────────────────────────────────────────────
    Verified by        : A. K. Mehta (Loan Officer)
    Verification Date  : 18/03/2024
    Recommendation     : APPROVE — subject to title verification
    ══════════════════════════════════════════════════════════════════
""")

DOC2_LOAN_APP_AMIT = textwrap.dedent("""\
    ╔══════════════════════════════════════════════════════════════════╗
    ║            CANARA BANK — BUSINESS LOAN APPLICATION             ║
    ║                 Branch: Jayanagar, Bengaluru                   ║
    ╚══════════════════════════════════════════════════════════════════╝

    Application Ref   : CB/BIZ/2024/BLR/00782
    Date of Application: 22/04/2024
    Branch Code        : 002198

    ── SECTION A: APPLICANT DETAILS ──────────────────────────────────
    Full Name          : Amit Sharma
    Father's Name      : Devendra Sharma
    Date of Birth      : 03/11/1990
    PAN Number         : BCSPS5678G
    Aadhaar Number     : 8765 4321 0987
    Mobile             : +91 8867054321
    Email              : amit.sharma@email.com
    Occupation         : Proprietor, Sharma Enterprises
    Monthly Income     : Rs. 2,10,000
    Residential Address: 12, 3rd Cross, Jayanagar 4th Block, Bengaluru - 560041

    ── SECTION B: LOAN DETAILS ───────────────────────────────────────
    Loan Type          : Secured Business Loan
    Loan Amount Requested : Rs. 32,00,000 (Thirty-Two Lakhs Only)
    Tenure             : 10 Years (120 months)
    Purpose            : Working capital for trading business
    Expected EMI       : Rs. 42,200 (approx.)

    ── SECTION C: COLLATERAL / SECURITY DETAILS ──────────────────────
    Type of Collateral : Immovable Property — Agricultural Land
    Land Survey Number : SR-911
    Village Code       : Jayanagar
    SRO Code           : KA-BLR-S
    Property Location  : Mysuru South Taluk, Karnataka
    Property Area      : 1.5 Acres
    Estimated Value    : Rs. 55,00,000 (Fifty-Five Lakhs)
    Title Holder       : Amit Sharma (self)
    Encumbrance Status : Clear as of 10/04/2024

    ── SECTION D: GUARANTOR DETAILS ──────────────────────────────────
    Guarantor Name     : Rajesh Kumar
    Guarantor PAN      : ABCPK1234F
    Guarantor Aadhaar  : 9876 5432 1098
    Guarantor Address  : Flat 402, Royal Residency, MG Road, Bengaluru - 560001
    Guarantor Occupation: Senior Manager, Infosys Ltd.
    Guarantor Monthly Income: Rs. 1,85,000
    Relationship with Applicant: Business Associate

    ── SECTION E: DECLARATION ────────────────────────────────────────
    I, Amit Sharma, hereby declare that the above information is true,
    complete, and correct.  I further confirm that the guarantor,
    Rajesh Kumar, has voluntarily agreed to guarantee this loan.

    Signature of Applicant : _____________________
    Signature of Guarantor : _____________________
    Date: 22/04/2024
    Place: Bengaluru

    ── FOR BANK USE ONLY ─────────────────────────────────────────────
    Verified by        : P. R. Nair (Loan Officer)
    Verification Date  : 25/04/2024
    Recommendation     : APPROVE — guarantor credentials verified
    ══════════════════════════════════════════════════════════════════
""")

DOC3_COMPANY_REGISTRATION = textwrap.dedent("""\
    ╔══════════════════════════════════════════════════════════════════╗
    ║      MINISTRY OF CORPORATE AFFAIRS — GOVERNMENT OF INDIA       ║
    ║           CERTIFICATE OF INCORPORATION (FORM INC-11)           ║
    ╚══════════════════════════════════════════════════════════════════╝

    Certificate No.    : INC-11/2023/KA/04521
    CIN                : U72200KA2023PTC123456
    Date of Incorporation: 10/01/2023

    ── COMPANY DETAILS ───────────────────────────────────────────────
    Company Name       : Apex Holdings Pvt. Ltd.
    Category           : Company limited by Shares
    Sub-Category       : Non-Government Company
    Class of Company   : Private
    Authorized Capital : Rs. 50,00,000 (Fifty Lakhs)
    Paid-Up Capital    : Rs. 10,00,000 (Ten Lakhs)

    Registered Address : Flat 402, Royal Residency, MG Road, Bengaluru - 560001
    State              : Karnataka
    PIN Code           : 560001
    Email              : info@apexholdings.in

    ── BOARD OF DIRECTORS ────────────────────────────────────────────
    Director 1:
        Name           : Amit Sharma
        DIN            : 09876543
        PAN            : BCSPS5678G
        Designation    : Managing Director
        Date of Appointment: 10/01/2023

    Director 2:
        Name           : Vikram Singh
        DIN            : 08765432
        PAN            : CDQVS9012H
        Designation    : Whole-Time Director
        Date of Appointment: 10/01/2023

    ── MAIN OBJECTS ──────────────────────────────────────────────────
    1. To acquire, hold, manage, develop, and deal in immovable
       property including land, buildings, and estates.
    2. To act as real-estate advisors, property managers, and
       investment consultants.
    3. To carry on the business of construction, development, and
       sale of residential and commercial properties.

    ── REGISTRAR ATTESTATION ─────────────────────────────────────────
    This is to certify that Apex Holdings Pvt. Ltd. has been duly
    incorporated under the Companies Act, 2013, on this day, the
    Tenth of January, Two Thousand and Twenty-Three.

    Registrar of Companies, Karnataka
    Digital Signature: [SIGNED ELECTRONICALLY]
    Date: 10/01/2023
    ══════════════════════════════════════════════════════════════════
""")

DOC4_LAND_TRANSFER = textwrap.dedent("""\
    ╔══════════════════════════════════════════════════════════════════╗
    ║     OFFICE OF THE SUB-REGISTRAR, BENGALURU EAST DISTRICT       ║
    ║              REGISTERED SALE DEED / TRANSFER DEED              ║
    ╚══════════════════════════════════════════════════════════════════╝

    Document No.       : SR/BLR-E/2024/05678
    Registration Date  : 05/02/2024
    Book-I, Volume 32, Pages 115-120

    ── PARTIES TO THE DEED ───────────────────────────────────────────
    TRANSFEROR (Seller):
        Name           : Rajesh Kumar
        S/o            : Suresh Kumar
        PAN            : ABCPK1234F
        Aadhaar        : 9876 5432 1098
        Address        : Flat 402, Royal Residency, MG Road, Bengaluru - 560001

    TRANSFEREE (Buyer):
        Name           : Apex Holdings Pvt. Ltd.
        CIN            : U72200KA2023PTC123456
        Represented by : Amit Sharma (Managing Director, DIN 09876543)
        Registered Office: Flat 402, Royal Residency, MG Road, Bengaluru - 560001

    ── PROPERTY DESCRIPTION ──────────────────────────────────────────
    Land Survey Number : SR-504
    Village Code       : Whitefield
    SRO Code           : KA-BLR-E
    Location           : Sy. No. 504, Whitefield Village,
                         Bengaluru East Taluk, Bengaluru Urban District,
                         Karnataka — 560066
    Extent             : 2400 sq. ft. (site area)
    Built-Up Structure : Residential building — 1800 sq. ft. (built-up)
    Boundaries:
        North  : Property of Mr. K. Raghunath
        South  : 40-ft BDA Road
        East   : Property of Smt. Lakshmi Devi
        West   : Vacant BDA site

    ── SALE CONSIDERATION ────────────────────────────────────────────
    Sale Consideration : Rs. 68,00,000 (Sixty-Eight Lakhs Only)
    Mode of Payment    : Demand Draft — DD No. 445521, HDFC Bank
    Stamp Duty Paid    : Rs. 3,74,000
    Registration Fee   : Rs. 34,000

    ── TRANSFER DECLARATION ──────────────────────────────────────────
    The Transferor hereby transfers absolute ownership, title, and
    interest in the above-described property bearing Land Survey
    Number SR-504 to the Transferee, Apex Holdings Pvt. Ltd.,
    free from all encumbrances, charges, and liabilities.

    The Transferee shall henceforth be the absolute owner and shall
    have full rights of possession, enjoyment, and disposal.

    Execution Date     : 05/02/2024

    ── WITNESS & ATTESTATION ─────────────────────────────────────────
    Witness 1: Vikram Singh, DIN 08765432
    Witness 2: K. Nagaraj, Advocate

    Sub-Registrar       : M. S. Ramaiah
    Seal & Signature    : [OFFICIAL SEAL]
    Date                : 05/02/2024
    ══════════════════════════════════════════════════════════════════
""")

DOC5_PROPERTY_VERIFICATION = textwrap.dedent("""\
    ╔══════════════════════════════════════════════════════════════════╗
    ║       GOVERNMENT OF KARNATAKA — REVENUE DEPARTMENT             ║
    ║          PROPERTY ENCUMBRANCE & VERIFICATION REPORT            ║
    ╚══════════════════════════════════════════════════════════════════╝

    Report Ref         : EC/BLR-E/2024/09123
    Date of Issue      : 20/05/2024
    Requested by       : Canara Bank, MG Road Branch (Ref: CB/HML/2024/BLR/00451)

    ── PROPERTY IDENTIFICATION ───────────────────────────────────────
    Land Survey Number : SR-504
    Village Code       : Whitefield
    SRO Code           : KA-BLR-E
    Taluk              : Bengaluru East
    District           : Bengaluru Urban
    State              : Karnataka
    Extent             : 2400 sq. ft.

    ── OWNERSHIP CHRONOLOGY ──────────────────────────────────────────
    Period               Owner                      Basis
    ─────────────────    ───────────────────────    ─────────────────
    Before 2015          Late Sri Suresh Kumar      Ancestral property
    2015 – Feb 2024      Rajesh Kumar               Gift deed (2015)
    Feb 2024 – Present   Apex Holdings Pvt. Ltd.    Sale deed SR/BLR-E/2024/05678

    ── ENCUMBRANCE DETAILS ───────────────────────────────────────────
    Sl.  Nature           Party                 Ref. / Date
    ──   ──────────       ─────────────────     ─────────────────────
    1    Mortgage Lien    Canara Bank           CB/HML/2024/BLR/00451
                                                Created: 18/03/2024
                                                Amount : Rs. 45,00,000
                                                Status : ACTIVE / SUBSISTING

    2    Sale Transfer    Apex Holdings Pvt Ltd Sale deed dt. 05/02/2024
                          (CIN U72200KA2023PTC123456)
                                                Consideration: Rs. 68,00,000
                                                Status : REGISTERED

    ── DISCREPANCY NOTICE ────────────────────────────────────────────
    *** IMPORTANT: This report highlights a material discrepancy. ***

    The property bearing Land Survey Number SR-504 was transferred
    to Apex Holdings Pvt. Ltd. via Sale Deed dated 05/02/2024.
    However, a mortgage lien in favour of Canara Bank was created
    on 18/03/2024 — AFTER the ownership had already been transferred.

    The current registered owner (Apex Holdings Pvt. Ltd.) did NOT
    create the said mortgage lien.  The lien was executed by the
    previous owner, Rajesh Kumar, who no longer holds title to the
    property at the date of lien creation.

    This constitutes a potential case of:
      (a) Fraudulent mortgage using property not owned by mortgagor.
      (b) Failure to update title records before lien creation.

    Recommended Action : Immediate verification by the lending
                         institution (Canara Bank).

    ── CERTIFICATION ─────────────────────────────────────────────────
    Certified that the above details have been extracted from the
    records maintained in the Office of the Sub-Registrar, Bengaluru
    East District, and are true to the best of our knowledge.

    Revenue Inspector   : T. N. Prasad
    Tahsildar           : S. Manjunath
    Seal                : [OFFICIAL SEAL — REVENUE DEPARTMENT]
    Date                : 20/05/2024
    ══════════════════════════════════════════════════════════════════
""")


# ════════════════════════════════════════════════════════════════════
#  Public helpers
# ════════════════════════════════════════════════════════════════════

DOCUMENTS = {
    "doc1_loan_application_rajesh.txt": DOC1_LOAN_APP_RAJESH,
    "doc2_loan_application_amit.txt": DOC2_LOAN_APP_AMIT,
    "doc3_company_registration_apex.txt": DOC3_COMPANY_REGISTRATION,
    "doc4_land_transfer_deed.txt": DOC4_LAND_TRANSFER,
    "doc5_property_verification_report.txt": DOC5_PROPERTY_VERIFICATION,
}


def generate_all_documents(output_dir: Path | None = None) -> list[Path]:
    """Write every mock document to *output_dir* and return the list of paths."""
    output_dir = output_dir or INPUT_DIR
    output_dir.mkdir(parents=True, exist_ok=True)
    created: list[Path] = []
    for name, content in DOCUMENTS.items():
        path = output_dir / name
        path.write_text(content, encoding="utf-8")
        created.append(path)
    return created


# ════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    paths = generate_all_documents()
    sep = "=" * 60
    print(f"\n{sep}")
    print("  NexusGuard -- Mock Data Generator")
    print(sep)
    print(f"  Created {len(paths)} documents in {INPUT_DIR}/\n")
    for p in paths:
        size = p.stat().st_size
        print(f"   * {p.name:<45s}  ({size:,} bytes)")
    print(f"\n{sep}\n")
