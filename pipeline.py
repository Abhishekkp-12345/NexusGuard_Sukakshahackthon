"""
NexusGuard — Intelligent Document Ingestion & Extraction Pipeline
=================================================================
Handles multi-format document parsing, offline NLP-based entity
extraction, structured Indian-identifier regex parsing, and
deterministic entity resolution using difflib similarity.

Pipeline stages
───────────────
  1. Ingest   → read .txt / .pdf / image files from input directory
  2. Extract  → spaCy NER + regex for Indian identifiers + addresses
  3. Classify → keyword-based document-type tagging
  4. Relate   → context-window heuristics to build relationships
  5. Resolve  → SequenceMatcher deduplication across all entities

100 % offline — no network calls.
"""

from __future__ import annotations

import re
import uuid
import logging
import difflib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Dict, List, Optional, Tuple

from config import (
    INPUT_DIR, nlp_config, setup_logging,
    NLPConfig,
)

logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────────────────
# Optional heavy dependencies — graceful fallback
# ────────────────────────────────────────────────────────────────────
try:
    import spacy
    _nlp = spacy.load(nlp_config.spacy_model)
    SPACY_AVAILABLE = True
    logger.info("spaCy model '%s' loaded successfully.", nlp_config.spacy_model)
except Exception as exc:  # noqa: BLE001
    SPACY_AVAILABLE = False
    _nlp = None
    logger.warning("spaCy unavailable (%s). Falling back to regex-only NER.", exc)

try:
    import pytesseract
    from PIL import Image
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    logger.warning("pytesseract / Pillow not installed — image OCR disabled.")

try:
    import PyPDF2
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False
    logger.warning("PyPDF2 not installed — PDF text extraction disabled.")


# ════════════════════════════════════════════════════════════════════
#  Data-model classes
# ════════════════════════════════════════════════════════════════════

@dataclass
class Entity:
    """A resolved entity node destined for Neo4j."""
    id: str
    name: str
    canonical_name: str
    entity_type: str          # PERSON | ORGANIZATION | ASSET | ADDRESS
    attributes: Dict = field(default_factory=dict)
    source_documents: List[str] = field(default_factory=list)

    def __hash__(self):
        return hash(self.id)

    def __eq__(self, other):
        return isinstance(other, Entity) and self.id == other.id


@dataclass
class Relationship:
    """A directed relationship between two entities."""
    id: str
    source_entity_id: str
    target_entity_id: str
    rel_type: str
    confidence: float = 1.0
    source_document: str = ""
    attributes: Dict = field(default_factory=dict)


@dataclass
class Document:
    """A processed source document."""
    id: str
    filename: str
    doc_type: str
    raw_text: str
    entities: List[Entity] = field(default_factory=list)
    relationships: List[Relationship] = field(default_factory=list)
    metadata: Dict = field(default_factory=dict)


@dataclass
class ExtractionResult:
    """Full pipeline output consumed by graph_engine.py and app.py."""
    documents: List[Document] = field(default_factory=list)
    entities: List[Entity] = field(default_factory=list)
    relationships: List[Relationship] = field(default_factory=list)
    entity_registry: Dict[str, Entity] = field(default_factory=dict)
    processing_log: List[str] = field(default_factory=list)


# ════════════════════════════════════════════════════════════════════
#  Helper — text reading from different file types
# ════════════════════════════════════════════════════════════════════

def _read_text(path: Path) -> str:
    """Return plain text from .txt, .pdf, or image file."""
    suffix = path.suffix.lower()
    if suffix == ".txt":
        try:
            return path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            return path.read_text(encoding="latin-1")

    if suffix == ".pdf":
        if not PDF_AVAILABLE:
            logger.error("PyPDF2 missing — cannot read %s", path.name)
            return ""
        text_parts: List[str] = []
        try:
            with open(path, "rb") as fh:
                reader = PyPDF2.PdfReader(fh)
                for page in reader.pages:
                    text_parts.append(page.extract_text() or "")
        except Exception as exc:  # noqa: BLE001
            logger.error("PDF parse error for %s: %s", path.name, exc)
        return "\n".join(text_parts)

    if suffix in {".png", ".jpg", ".jpeg", ".tiff", ".bmp"}:
        if not OCR_AVAILABLE:
            logger.error("pytesseract missing — cannot OCR %s", path.name)
            return ""
        try:
            img = Image.open(path)
            return pytesseract.image_to_string(img)
        except Exception as exc:  # noqa: BLE001
            logger.error("OCR error for %s: %s", path.name, exc)
            return ""

    logger.warning("Unsupported file type: %s — skipping.", path.suffix)
    return ""


# ════════════════════════════════════════════════════════════════════
#  Regex extraction helpers
# ════════════════════════════════════════════════════════════════════

_cfg: NLPConfig = nlp_config


def _extract_survey_numbers(text: str) -> List[str]:
    return re.findall(_cfg.survey_number_pattern, text, re.IGNORECASE)


def _extract_pan_numbers(text: str) -> List[str]:
    return re.findall(_cfg.pan_pattern, text)


def _extract_aadhaar(text: str) -> List[str]:
    return re.findall(_cfg.aadhaar_pattern, text)


def _extract_cin(text: str) -> List[str]:
    return re.findall(_cfg.cin_pattern, text)


def _extract_din(text: str) -> List[str]:
    return re.findall(_cfg.din_pattern, text)


def _extract_phone(text: str) -> List[str]:
    return re.findall(_cfg.phone_pattern, text)


def _extract_pincode(text: str) -> List[str]:
    return re.findall(_cfg.pincode_pattern, text)


def _extract_money(text: str) -> List[str]:
    pattern = r"Rs\.?\s*[\d,]+(?:\.\d{2})?(?:\s*(?:Lakhs?|Crores?|Only))?"
    return re.findall(pattern, text, re.IGNORECASE)


def _extract_village_code(text: str) -> Optional[str]:
    m = re.search(r"(?:Village\s+Code|Village)\s*:\s*([A-Za-z0-9\-]+)", text, re.IGNORECASE)
    return m.group(1).strip() if m else None


def _extract_sro_code(text: str) -> Optional[str]:
    m = re.search(r"(?:SRO\s+Code|SRO)\s*:\s*([A-Za-z0-9\-]+)", text, re.IGNORECASE)
    return m.group(1).strip() if m else None


def _extract_plot_number(text: str) -> Optional[str]:
    m = re.search(r"(?:Plot\s+Number|Plot\s+No\.?|Plot)\s*:\s*([A-Za-z0-9\-]+)", text, re.IGNORECASE)
    return m.group(1).strip() if m else None


def _extract_addresses(text: str) -> List[str]:
    """
    Multi-line address pattern matching Indian postal formats.
    Looks for Flat/House/Plot/No followed by text ending in a 6-digit PIN.
    """
    pattern = (
        r"(?:Flat|House|Plot|Door|H\.?No\.?|No\.)\s*[\w/\-]+,\s*"
        r"[^\n]{5,80},\s*"
        r"(?:[A-Za-z ]+,\s*)?"
        r"[\d]{6}"
    )
    raw = re.findall(pattern, text, re.IGNORECASE | re.MULTILINE)
    # Also capture lines explicitly labelled as address
    label_pattern = (
        r"(?:Residential Address|Registered Address|Address)\s*:\s*"
        r"([^\n]{10,120})"
    )
    labelled = re.findall(label_pattern, text, re.IGNORECASE)
    return list({_normalise(a) for a in raw + labelled if a.strip()})


def _extract_dates(text: str) -> List[str]:
    pattern = r"\b\d{2}/\d{2}/\d{4}\b"
    return re.findall(pattern, text)


# ════════════════════════════════════════════════════════════════════
#  spaCy + fallback regex NER
# ════════════════════════════════════════════════════════════════════

# Fallback regex for Indian PERSON names when spaCy unavailable
_PERSON_FALLBACK = re.compile(
    r"\b(?:Sri|Shri|Smt|Mr\.?|Mrs\.?|Ms\.?)?\s*"
    r"([A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\b"
)

# Known Indian org keywords
_ORG_KEYWORDS = re.compile(
    r"([A-Z][A-Za-z\s&]{2,40}"
    r"(?:Pvt\.?\s*Ltd\.?|Ltd\.?|LLP|Holdings|Enterprises|Solutions|Bank|Corp))",
    re.IGNORECASE,
)


def _is_valid_entity_name(name: str, entity_type: str) -> bool:
    name_clean = name.strip()
    if not name_clean:
        return False
    
    # Filter out box drawing characters
    if any(c in name_clean for c in "═║╔╗╚╝╠╣╦╩╬█─│┌┐└┘├┤┬┴┼"):
        return False
        
    # Filter out dates or purely numeric values
    if re.match(r'^[\d/\s\-.:]+$', name_clean):
        return False
        
    name_lower = name_clean.lower()
    
    # Filter out label keywords
    ignored_keywords = {
        "full name", "father", "mother", "husband", "name", "address", "loan type", 
        "loan amount", "monthly income", "applicant", "borrower", "guarantor", "co-applicant",
        "verified", "officer", "recommendation", "status", "tenure", "purpose", "emi",
        "monthly", "income", "details", "section", "declaration", "date", "place",
        "witness", "attestation", "sub-registrar", "advocate", "tahsildar", "inspector",
        "registrar", "encumbrance", "chronology", "transferor", "transferee", "seller",
        "buyer", "discrepancy", "notice", "certification", "objects", "capital",
        "authorized", "paid-up", "category", "incorporation", "cin", "din", "pan",
        "aadhaar", "mobile", "email", "occupation", "estimated", "value", "area", "extent",
        "lien", "mortgage", "active", "subsisting", "registered", "book", "volume",
        "deed", "sale", "transfer", "registration", "boundaries", "north", "south",
        "east", "west", "consideration", "stamp duty", "fee", "dd no", "demand draft",
        "draft", "bank use", "office", "government", "ministry", "certificate", "road",
        "cross", "block", "bda", "flat", "house", "plot", "door", "street", "layout",
        "taluk", "district", "state", "pincode", "pin code", "village", "taluka", "sro",
        "survey", "number", "plot no", "village code", "sro code", "plot number", "revenue"
    }
    
    for kw in ignored_keywords:
        if name_lower == kw or name_lower.startswith(kw + " ") or name_lower.endswith(" " + kw) or name_lower.startswith(kw + ":") or name_lower.startswith(kw + " :"):
            return False
            
    # Also ignore name strings that have colons or too many newlines/tabs
    if ":" in name_clean or "\n" in name_clean or "\r" in name_clean or "\t" in name_clean:
        return False
        
    if len(name_clean) < 3 or len(name_clean) > 80:
        return False
        
    return True


def _ner_extract(text: str) -> Tuple[List[str], List[str]]:
    """
    Return (persons, organisations) lists.
    Uses spaCy when available, and combines with regex fallback to guarantee
    aggressive and accurate extraction.
    """
    persons = []
    orgs = []
    
    if SPACY_AVAILABLE and _nlp:
        doc = _nlp(text[:1_000_000])  # spaCy token limit guard
        persons = [ent.text.strip() for ent in doc.ents if ent.label_ == "PERSON"]
        orgs    = [ent.text.strip() for ent in doc.ents if ent.label_ == "ORG"]

    # Combine with regex fallback for high-recall offline extraction
    reg_persons = [m.group(1).strip() for m in _PERSON_FALLBACK.finditer(text)]
    reg_orgs    = [m.group(1).strip() for m in _ORG_KEYWORDS.finditer(text)]
    
    combined_persons = list(dict.fromkeys(persons + reg_persons))
    combined_orgs    = list(dict.fromkeys(orgs + reg_orgs))
    
    # Filter out layout garbage and labels
    filtered_persons = [p for p in combined_persons if _is_valid_entity_name(p, "PERSON")]
    filtered_orgs    = [o for o in combined_orgs if _is_valid_entity_name(o, "ORGANIZATION")]
    
    return filtered_persons, filtered_orgs


# ════════════════════════════════════════════════════════════════════
#  Document-type classifier
# ════════════════════════════════════════════════════════════════════

def _classify_document(text: str, filename: str) -> str:
    text_lower = text.lower()
    scores: Dict[str, int] = {}
    for doc_type, keywords in _cfg.doc_type_keywords.items():
        scores[doc_type] = sum(1 for kw in keywords if kw in text_lower)
    # filename hint override
    fname = filename.lower()
    if "loan" in fname:
        scores["loan_application"] = scores.get("loan_application", 0) + 3
    if "company" in fname or "registr" in fname:
        scores["company_filing"] = scores.get("company_filing", 0) + 3
    if "land" in fname or "transfer" in fname or "deed" in fname:
        scores["land_registry"] = scores.get("land_registry", 0) + 3
    if "verif" in fname or "encumb" in fname:
        scores["property_verification"] = scores.get("property_verification", 0) + 3

    return max(scores, key=scores.get) if scores else "unknown"


# ════════════════════════════════════════════════════════════════════
#  Entity Resolution
# ════════════════════════════════════════════════════════════════════

def _normalise(s: str) -> str:
    """Strip, lowercase, collapse whitespace."""
    return " ".join(s.strip().lower().split())


def _similarity(a: str, b: str) -> float:
    return difflib.SequenceMatcher(None, a, b).ratio()


class EntityRegistry:
    """
    Canonical entity store with fuzzy deduplication.
    Maintains a dict: canonical_name → Entity
    """

    def __init__(self, threshold: float = nlp_config.similarity_threshold):
        self.threshold = threshold
        self._store: Dict[str, Entity] = {}          # canonical_name → Entity
        self._alias_map: Dict[str, str] = {}         # any_name → canonical_name

    def _find_match(self, norm_name: str) -> Optional[str]:
        """Return existing canonical_name if similarity ≥ threshold."""
        for canonical in self._store:
            if _similarity(norm_name, canonical) >= self.threshold:
                return canonical
        return None

    def register(
        self,
        name: str,
        entity_type: str,
        attributes: Optional[Dict] = None,
        source_doc: str = "",
    ) -> Entity:
        """Register or retrieve a canonical entity."""
        norm = _normalise(name)

        # Check Indian identifier matching for merging (override name-based matches)
        pan = (attributes or {}).get("pan")
        din = (attributes or {}).get("din")
        cin = (attributes or {}).get("cin")

        matched_ent = None
        if pan:
            for existing in self._store.values():
                if existing.attributes.get("pan") == pan:
                    matched_ent = existing
                    break
        if not matched_ent and din:
            for existing in self._store.values():
                if existing.attributes.get("din") == din:
                    matched_ent = existing
                    break
        if not matched_ent and cin:
            for existing in self._store.values():
                if existing.attributes.get("cin") == cin:
                    matched_ent = existing
                    break

        if matched_ent:
            if attributes:
                matched_ent.attributes.update(
                    {k: v for k, v in attributes.items() if v and k not in matched_ent.attributes}
                )
            if source_doc and source_doc not in matched_ent.source_documents:
                matched_ent.source_documents.append(source_doc)
            self._alias_map[norm] = matched_ent.canonical_name
            return matched_ent

        # Check alias map first
        if norm in self._alias_map:
            canonical = self._alias_map[norm]
            ent = self._store[canonical]
        else:
            canonical = self._find_match(norm)
            if canonical:
                ent = self._store[canonical]
                self._alias_map[norm] = canonical
            else:
                # New entity
                ent = Entity(
                    id=f"{entity_type[:3].upper()}_{uuid.uuid4().hex[:8]}",
                    name=name.strip(),
                    canonical_name=norm,
                    entity_type=entity_type,
                    attributes=attributes or {},
                )
                self._store[norm] = ent
                self._alias_map[norm] = norm

        # Merge attributes
        if attributes:
            ent.attributes.update(
                {k: v for k, v in attributes.items() if v and k not in ent.attributes}
            )
        if source_doc and source_doc not in ent.source_documents:
            ent.source_documents.append(source_doc)
        return ent

    @property
    def all_entities(self) -> List[Entity]:
        return list(self._store.values())


# ════════════════════════════════════════════════════════════════════
#  Relationship Extractor — context-window heuristics
# ════════════════════════════════════════════════════════════════════

def _window(text: str, keyword: str, radius: int = 200) -> List[str]:
    """Return text snippets around every occurrence of *keyword*."""
    snippets = []
    for m in re.finditer(re.escape(keyword), text, re.IGNORECASE):
        start = max(0, m.start() - radius)
        end   = min(len(text), m.end() + radius)
        snippets.append(text[start:end])
    return snippets


def _extract_relationships(
    doc: Document,
    registry: EntityRegistry,
) -> List[Relationship]:
    """Heuristically extract relationships from a document."""
    rels: List[Relationship] = []
    text = doc.raw_text
    doc_id = doc.filename

    persons_in_doc  = [e for e in doc.entities if e.entity_type == "PERSON"]
    assets_in_doc   = [e for e in doc.entities if e.entity_type == "ASSET"]
    addresses_in_doc = [e for e in doc.entities if e.entity_type == "ADDRESS"]
    companies_in_doc = [e for e in doc.entities if e.entity_type == "ORGANIZATION"]

    def _rel(src_id, tgt_id, rel_type, conf=0.9, attrs=None) -> Relationship:
        return Relationship(
            id=f"REL_{uuid.uuid4().hex[:8]}",
            source_entity_id=src_id,
            target_entity_id=tgt_id,
            rel_type=rel_type,
            confidence=conf,
            source_document=doc_id,
            attributes=attrs or {},
        )

    # ── Loan application patterns ──────────────────────────────────
    if doc.doc_type == "loan_application":
        # First person = applicant; assets = collateral
        if persons_in_doc and assets_in_doc:
            applicant = persons_in_doc[0]
            for asset in assets_in_doc:
                rels.append(_rel(applicant.id, asset.id, "APPLIED_FOR_LOAN_WITH", 0.95))
        # Guarantor pattern
        for snippet in _window(text, "guarantor"):
            for person in persons_in_doc[1:]:  # Guarantor is usually the 2nd person
                if _normalise(person.name) in _normalise(snippet):
                    if persons_in_doc:
                        rels.append(_rel(
                            person.id, persons_in_doc[0].id,
                            "GUARANTOR_FOR", 0.90,
                        ))
        # Residential address
        if persons_in_doc and addresses_in_doc:
            rels.append(_rel(
                persons_in_doc[0].id, addresses_in_doc[0].id, "RESIDES_AT", 0.85,
            ))

    # ── Company filing patterns ────────────────────────────────────
    if doc.doc_type == "company_filing":
        for company in companies_in_doc:
            for person in persons_in_doc:
                rels.append(_rel(person.id, company.id, "DIRECTOR_OF", 0.95))
            for addr in addresses_in_doc:
                rels.append(_rel(company.id, addr.id, "REGISTERED_AT", 0.95))

    # ── Land registry / transfer patterns ─────────────────────────
    if doc.doc_type == "land_registry":
        if assets_in_doc:
            asset = assets_in_doc[0]
            # Transferor → owns/held asset
            for snippet in _window(text, "transferor"):
                for person in persons_in_doc:
                    if _normalise(person.name) in _normalise(snippet):
                        rels.append(_rel(person.id, asset.id, "OWNS_ASSET", 0.85))
            # Transferee → receiving ownership
            for snippet in _window(text, "transferee"):
                for company in companies_in_doc:
                    if _normalise(company.name) in _normalise(snippet):
                        rels.append(_rel(
                            persons_in_doc[0].id if persons_in_doc else asset.id,
                            company.id,
                            "TRANSFERRED_TO", 0.90,
                        ))
                        rels.append(_rel(company.id, asset.id, "OWNS_ASSET", 0.90))

    # ── Property verification — lien detection ─────────────────────
    if doc.doc_type == "property_verification":
        for snippet in _window(text, "mortgage lien"):
            for asset in assets_in_doc:
                # Find bank name
                bank_match = re.search(r"Canara Bank", snippet, re.IGNORECASE)
                if bank_match:
                    bank_ent = registry.register(
                        "Canara Bank", "ORGANIZATION",
                        {"type": "public_sector_bank"}, doc_id,
                    )
                    rels.append(_rel(asset.id, bank_ent.id, "HAS_LIEN_BY", 0.95))
        # Ownership chain
        if assets_in_doc and companies_in_doc:
            for company in companies_in_doc:
                rels.append(_rel(
                    company.id, assets_in_doc[0].id, "OWNS_ASSET", 0.90,
                ))

    return rels


# ════════════════════════════════════════════════════════════════════
#  Pipeline Orchestrator
# ════════════════════════════════════════════════════════════════════

ProgressCallback = Callable[[str, float, str], None]


class NexusGuardPipeline:
    """
    Main pipeline class — orchestrates all stages from raw files to
    a structured ExtractionResult ready for graph ingestion.

    Usage
    ─────
    >>> pipeline = NexusGuardPipeline()
    >>> result = pipeline.run_full_pipeline(input_dir)
    """

    def __init__(self):
        self._registry = EntityRegistry()
        self._log: List[str] = []

    # ── Private helpers ───────────────────────────────────────────

    def _info(self, msg: str) -> None:
        logger.info(msg)
        self._log.append(f"[INFO]  {msg}")

    def _warn(self, msg: str) -> None:
        logger.warning(msg)
        self._log.append(f"[WARN]  {msg}")

    def _err(self, msg: str) -> None:
        logger.error(msg)
        self._log.append(f"[ERROR] {msg}")

    # ── Stage 1: Ingest ───────────────────────────────────────────

    def ingest_documents(self, input_dir: Path) -> List[Document]:
        """Read all supported files from *input_dir*."""
        supported = {".txt", ".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".bmp"}
        files = [f for f in sorted(input_dir.iterdir()) if f.suffix.lower() in supported]
        if not files:
            self._warn(f"No supported files found in {input_dir}.")
            return []
        self._info(f"Found {len(files)} document(s) in {input_dir}.")
        documents: List[Document] = []
        for f in files:
            text = _read_text(f)
            if not text.strip():
                self._warn(f"Empty content from {f.name} — skipping.")
                continue
            doc_type = _classify_document(text, f.name)
            doc = Document(
                id=f"DOC_{uuid.uuid4().hex[:8]}",
                filename=f.name,
                doc_type=doc_type,
                raw_text=text,
                metadata={"size_bytes": f.stat().st_size, "path": str(f)},
            )
            documents.append(doc)
            self._info(f"  Ingested: {f.name}  [type={doc_type}]")
        return documents

    # ── Stage 2: Extract entities ─────────────────────────────────

    def extract_entities(self, document: Document) -> List[Entity]:
        """Extract all entities from a single document."""
        text = document.raw_text
        fname = document.filename
        entities: List[Entity] = []

        # ── PERSON & ORG via spaCy / regex
        persons, orgs = _ner_extract(text)
        for pname in persons:
            attrs = {}
            # Find associated PAN/Aadhaar/DIN from context
            for snippet in _window(text, pname, 150):
                pans = _extract_pan_numbers(snippet)
                aads = _extract_aadhaar(snippet)
                dins = _extract_din(snippet)
                if pans:
                    attrs["pan"] = pans[0]
                if aads:
                    attrs["aadhaar"] = aads[0]
                if dins:
                    attrs["din"] = dins[0]
            ent = self._registry.register(pname, "PERSON", attrs, fname)
            entities.append(ent)

        for oname in orgs:
            attrs = {}
            # Find associated CIN from context
            for snippet in _window(text, oname, 150):
                cins = _extract_cin(snippet)
                if cins:
                    attrs["cin"] = cins[0]
            ent = self._registry.register(oname, "ORGANIZATION", attrs, fname)
            entities.append(ent)

        # ── ASSET — Land Survey Numbers & Land Registry Identifiers
        surveys = _extract_survey_numbers(text)
        village = _extract_village_code(text)
        sro = _extract_sro_code(text)
        plot = _extract_plot_number(text)
        
        for sv in set(surveys):
            sv_upper = sv.upper()
            attrs = {
                "survey_number": sv_upper,
                "type": "land",
            }
            if village:
                attrs["village_code"] = village
            if sro:
                attrs["sro_code"] = sro
            if plot:
                attrs["plot_number"] = plot
                
            # Create composite key SurveyNumber_VillageCode
            if village:
                composite_key = f"{sv_upper}_{village}"
            else:
                composite_key = sv_upper
                
            attrs["composite_key"] = composite_key
            ent = self._registry.register(composite_key, "ASSET", attrs, fname)
            entities.append(ent)

        # ── ADDRESS — multi-line regex
        addresses = _extract_addresses(text)
        for addr in set(addresses):
            pincodes = _extract_pincode(addr)
            attrs = {
                "full_address": addr,
                "pincode": pincodes[0] if pincodes else "",
            }
            ent = self._registry.register(addr, "ADDRESS", attrs, fname)
            entities.append(ent)

        # Deduplicate within this document
        seen_ids: set[str] = set()
        unique: List[Entity] = []
        for e in entities:
            if e.id not in seen_ids:
                seen_ids.add(e.id)
                unique.append(e)
        return unique

    # ── Stage 3: Extract relationships ────────────────────────────

    def extract_relationships(
        self,
        document: Document,
        entities: List[Entity],
    ) -> List[Relationship]:
        document.entities = entities
        return _extract_relationships(document, self._registry)

    # ── Stage 4: Entity resolution (already handled by registry) ─

    def resolve_entities(self, entities: List[Entity]) -> List[Entity]:
        """Return registry's deduplicated canonical entity list."""
        return self._registry.all_entities

    # ── Full pipeline ─────────────────────────────────────────────

    def run_full_pipeline(
        self,
        input_dir: Path | None = None,
        progress_callback: Optional[ProgressCallback] = None,
    ) -> ExtractionResult:
        """
        Execute all pipeline stages end-to-end.

        Parameters
        ----------
        input_dir :
            Directory containing source documents.
        progress_callback :
            Optional callable(step_name, progress_0_to_1, message).
        """
        self._registry = EntityRegistry()
        self._log = []
        result = ExtractionResult()
        input_dir = input_dir or INPUT_DIR

        def _cb(step: str, prog: float, msg: str) -> None:
            if progress_callback:
                try:
                    progress_callback(step, prog, msg)
                except Exception:  # noqa: BLE001
                    pass

        # ── 1. Ingest
        _cb("ingest", 0.05, "Reading documents from disk…")
        self._info("═" * 50)
        self._info("STAGE 1 — Document Ingestion")
        documents = self.ingest_documents(input_dir)
        result.documents = documents
        _cb("ingest", 0.20, f"Ingested {len(documents)} document(s).")

        if not documents:
            result.processing_log = self._log
            return result

        # ── 2 & 3. Extract + Relate (per document)
        _cb("extract", 0.25, "Extracting entities and relationships…")
        self._info("STAGE 2 — Entity & Relationship Extraction")
        all_rels: List[Relationship] = []
        for i, doc in enumerate(documents, 1):
            self._info(f"  Processing [{i}/{len(documents)}]: {doc.filename}")
            entities = self.extract_entities(doc)
            doc.entities = entities
            rels = self.extract_relationships(doc, entities)
            doc.relationships = rels
            all_rels.extend(rels)
            prog = 0.25 + (i / len(documents)) * 0.40
            _cb("extract", prog, f"Processed {doc.filename} — {len(entities)} entities, {len(rels)} relations.")

        # ── 4. Resolve
        _cb("resolve", 0.68, "Resolving and deduplicating entities…")
        self._info("STAGE 3 — Entity Resolution")
        canonical_entities = self.resolve_entities([])
        self._info(
            f"  Resolved to {len(canonical_entities)} unique entities "
            f"from {sum(len(d.entities) for d in documents)} raw mentions."
        )
        _cb("resolve", 0.75, f"Resolved to {len(canonical_entities)} unique entities.")

        result.entities = canonical_entities
        result.relationships = all_rels
        result.entity_registry = {e.id: e for e in canonical_entities}

        # Summary log
        self._info("═" * 50)
        self._info("PIPELINE COMPLETE")
        self._info(f"  Documents  : {len(documents)}")
        self._info(f"  Entities   : {len(canonical_entities)}")
        self._info(f"  Relations  : {len(all_rels)}")
        _cb("done", 1.0, "Pipeline complete.")

        result.processing_log = self._log
        return result
