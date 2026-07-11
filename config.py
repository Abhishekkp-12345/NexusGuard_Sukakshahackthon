"""
NexusGuard Configuration Module
================================
Centralised configuration for all pipeline components.
All settings are local/offline — no external API calls.

Author : Team Sukaksha
Project: NexusGuard – Real-Time Graph Traversal for Document Forgery & Fraud Detection
"""

import os
import logging
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict

# ━━━ Project Paths ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BASE_DIR = Path(__file__).resolve().parent
INPUT_DIR = BASE_DIR / "input_documents"
OUTPUT_DIR = BASE_DIR / "output"
LOG_DIR = BASE_DIR / "logs"
ASSETS_DIR = BASE_DIR / "assets"

for _d in [INPUT_DIR, OUTPUT_DIR, LOG_DIR, ASSETS_DIR]:
    _d.mkdir(parents=True, exist_ok=True)

# ━━━ Logging ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LOG_FILE = LOG_DIR / "nexusguard.log"
LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)-22s | %(message)s"
LOG_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def setup_logging(level: int = logging.INFO) -> None:
    """Configure project-wide logging to file + console."""
    logging.basicConfig(
        level=level,
        format=LOG_FORMAT,
        datefmt=LOG_DATE_FORMAT,
        handlers=[
            logging.FileHandler(LOG_FILE, encoding="utf-8"),
            logging.StreamHandler(),
        ],
    )
    for noisy in ("neo4j", "urllib3", "matplotlib", "PIL"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


# ━━━ Neo4j ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@dataclass
class Neo4jConfig:
    uri: str = "bolt://localhost:7687"
    username: str = "neo4j"
    password: str = "password"
    database: str = None  # None uses the default database on the server
    max_connection_lifetime: int = 3600
    max_connection_pool_size: int = 50
    connection_timeout: int = 30


# ━━━ NLP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@dataclass
class NLPConfig:
    spacy_model: str = "en_core_web_sm"
    similarity_threshold: float = 0.85
    # Indian-document regex patterns
    survey_number_pattern: str = r"SR-\d{3,4}"
    pan_pattern: str = r"[A-Z]{5}\d{4}[A-Z]"
    aadhaar_pattern: str = r"\d{4}[\s-]?\d{4}[\s-]?\d{4}"
    pincode_pattern: str = r"\b\d{6}\b"
    phone_pattern: str = r"(?:\+91[\s-]?)?[6-9]\d{9}"
    cin_pattern: str = r"[UL]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}"
    din_pattern: str = r"\b\d{8}\b"
    doc_type_keywords: Dict[str, List[str]] = field(default_factory=lambda: {
        "loan_application": [
            "loan", "applicant", "collateral", "borrower", "sanctioned",
            "emi", "disbursement", "tenure",
        ],
        "company_filing": [
            "company", "director", "incorporation", "registered office",
            "cin", "board", "authorized capital",
        ],
        "land_registry": [
            "survey number", "land", "registry", "transfer", "ownership",
            "deed", "mutation", "sub-registrar",
        ],
        "property_verification": [
            "verification", "encumbrance", "title", "valuation",
            "lien", "property",
        ],
    })


# ━━━ Fraud Detection ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@dataclass
class FraudConfig:
    max_traversal_depth: int = 4
    address_overlap_min_entities: int = 2
    collateral_conflict_min_claims: int = 2
    risk_score_weights: Dict[str, float] = field(default_factory=lambda: {
        "address_reuse": 0.25,
        "collateral_conflict": 0.30,
        "network_cycle": 0.25,
        "ownership_conflict": 0.20,
    })
    severity_thresholds: Dict[str, float] = field(default_factory=lambda: {
        "CRITICAL": 0.80,
        "HIGH": 0.60,
        "MEDIUM": 0.40,
        "LOW": 0.20,
    })


# ━━━ UI Theme ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@dataclass
class UIConfig:
    app_title: str = "NexusGuard"
    app_subtitle: str = "Real-Time Graph Traversal for Document Forgery & Fraud Detection"
    app_icon: str = "🛡️"
    theme_primary: str = "#00D4AA"
    theme_secondary: str = "#FFB800"
    theme_bg: str = "#0A0E27"
    theme_card: str = "#111638"
    theme_text: str = "#E8E8E8"
    theme_danger: str = "#FF4757"
    theme_warning: str = "#FFA502"
    theme_success: str = "#2ED573"
    theme_info: str = "#1E90FF"


# ━━━ Singleton instances ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
neo4j_config = Neo4jConfig()
nlp_config = NLPConfig()
fraud_config = FraudConfig()
ui_config = UIConfig()
