# 🛡️ NexusGuard
### Real-Time Graph Traversal for Document Forgery & Fraud Detection
**Canara Bank Hackathon 2024 — Team Sukaksha**

---

![Python](https://img.shields.io/badge/Python-3.10%2B-blue?logo=python&logoColor=white)
![Neo4j](https://img.shields.io/badge/Neo4j-5.x-green?logo=neo4j&logoColor=white)
![Streamlit](https://img.shields.io/badge/Streamlit-1.28%2B-red?logo=streamlit&logoColor=white)
![spaCy](https://img.shields.io/badge/spaCy-3.5%2B-09A3D5?logo=spacy&logoColor=white)
![Offline](https://img.shields.io/badge/Mode-100%25%20Offline-darkgreen)

---

## 📖 Overview

**NexusGuard** is a production-grade, fully offline document fraud detection system for financial institutions. It ingests Indian banking and land-registry documents, extracts entities and relationships using local NLP, builds a knowledge graph in Neo4j, and runs graph traversal algorithms to surface hidden fraud rings — all without any internet connectivity.

### Key Fraud Patterns Detected

| # | Pattern | Description |
|---|---------|-------------|
| 1 | **Address Reuse** | Multiple entities (persons + companies) registered at the same address |
| 2 | **Collateral Conflict** | Same land asset pledged across multiple independent loan applications |
| 3 | **Network Cycle** | Applicant B's guarantor is secretly connected to Applicant A's collateral |
| 4 | **Shell Company** | Company registered at applicant's personal address; director doubles as guarantor |
| 5 | **Ownership Conflict** | Asset transferred to new owner while an active bank lien exists |

---

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        NexusGuard System                             │
│                                                                      │
│  ┌────────────┐    ┌─────────────────┐    ┌───────────────────────┐ │
│  │  Input     │    │  Extraction     │    │  Graph Engine         │ │
│  │  Documents │───▶│  Pipeline       │───▶│  (Neo4j + Cypher)     │ │
│  │  (.txt /   │    │                 │    │                       │ │
│  │   .pdf /   │    │  • spaCy NER    │    │  Nodes:               │ │
│  │   image)   │    │  • Regex Rules  │    │    :Person            │ │
│  └────────────┘    │  • Entity Res.  │    │    :Asset             │ │
│                    │  • Rel Extract  │    │    :Address           │ │
│                    └─────────────────┘    │    :Company           │ │
│                                           │                       │ │
│                                           │  Relationships:       │ │
│                                           │    APPLIED_FOR_LOAN   │ │
│                                           │    GUARANTOR_FOR      │ │
│  ┌─────────────────────────────────┐      │    DIRECTOR_OF        │ │
│  │  Streamlit Dashboard (app.py)   │      │    REGISTERED_AT      │ │
│  │                                 │◀────│    OWNS_ASSET         │ │
│  │  • KPI Metrics                  │      │    TRANSFERRED_TO     │ │
│  │  • Anomaly Center               │      │    HAS_LIEN_BY        │ │
│  │  • Graph Visualiser             │      └───────────────────────┘ │
│  │  • Cypher Lab                   │                │               │
│  │  • System Logs                  │      ┌─────────▼─────────────┐ │
│  └─────────────────────────────────┘      │  Fraud Detector       │ │
│                                           │  (5 algorithms)       │ │
│                                           └───────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

---

## ⚙️ System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Python | 3.10 | 3.11+ |
| RAM | 4 GB | 8 GB |
| Disk | 2 GB | 5 GB |
| OS | Windows 10 / Ubuntu 20.04 | Windows 11 / Ubuntu 22.04 |
| Neo4j | 5.x Community | 5.x Community |

---

## 🚀 Installation Guide

### Step 1 — Install Python 3.10+

**Windows:**
1. Download from https://www.python.org/downloads/
2. Run installer → check **"Add Python to PATH"**
3. Verify: `python --version`

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install python3.10 python3.10-pip python3.10-venv -y
```

---

### Step 2 — Clone / Download the Project

```bash
# If using git
git clone <repo-url>
cd NexusGuard_Sukaksha_hackthon

# Or navigate to the extracted folder
cd C:\Users\DELL\CanaraBank-Hackthon\NexusGuard_Sukaksha_hackthon
```

---

### Step 3 — Create a Virtual Environment

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux / macOS
python3 -m venv venv
source venv/bin/activate
```

---

### Step 4 — Install Python Dependencies

```bash
pip install -r requirements.txt
```

---

### Step 5 — Install spaCy English Model

```bash
python -m spacy download en_core_web_sm
```

> **Offline installation:** If the system is air-gapped, download the model wheel from
> https://github.com/explosion/spacy-models/releases and install with:
> ```bash
> pip install en_core_web_sm-3.7.0-py3-none-any.whl
> ```

---

### Step 6 — Install Tesseract OCR (for image/scan documents)

**Windows:**
1. Download the installer from:
   https://github.com/UB-Mannheim/tesseract/wiki
2. Install to `C:\Program Files\Tesseract-OCR\`
3. Add `C:\Program Files\Tesseract-OCR\` to your System PATH
4. Verify: `tesseract --version`

**Linux (Ubuntu/Debian):**
```bash
sudo apt install tesseract-ocr -y
```

> ℹ️ Tesseract is **optional** — it is only needed for scanned image documents.
> The system works fully without it for `.txt` and `.pdf` files.

---

### Step 7 — Install and Configure Neo4j

**Option A — Neo4j Desktop (Recommended for Windows)**
1. Download from: https://neo4j.com/download/
2. Install Neo4j Desktop
3. Create a new **Local DBMS**:
   - Name: `NexusGuard`
   - Password: `password`
   - Version: 5.x
4. Click **Start** to start the database
5. Verify it is running at http://localhost:7474

**Option B — Neo4j Community Server (Linux)**
```bash
# Download and extract Neo4j Community Edition
wget https://neo4j.com/artifact.php?name=neo4j-community-5.18.0-unix.tar.gz -O neo4j.tar.gz
tar -xzf neo4j.tar.gz
cd neo4j-community-5.18.0

# Set password
bin/neo4j-admin dbms set-initial-password password

# Start Neo4j
bin/neo4j start

# Verify
bin/neo4j status
```

**Option C — Docker (if Docker is installed)**
```bash
docker run \
  --name nexusguard-neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  -d neo4j:5
```

**Verify Neo4j:**
- Open http://localhost:7474 in your browser
- Login: username `neo4j`, password `password`
- You should see the Neo4j Browser interface

---

## ▶️ Running the Application

### Quick Start (3 Commands)

```bash
# 1. Activate your virtual environment
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux

# 2. Generate mock fraud documents
python generate_mock_data.py

# 3. Launch the dashboard
streamlit run app.py
```

The dashboard will open automatically at: **http://localhost:8501**

---

### Detailed Usage

#### Step 1: Generate Mock Data
```bash
python generate_mock_data.py
```
This creates `./input_documents/` with 5 realistic Indian banking documents containing embedded fraud patterns.

#### Step 2: Launch Dashboard
```bash
streamlit run app.py
```

#### Step 3: In the Dashboard
1. **Configure Neo4j** in the sidebar (URI, username, password) → click **Connect**
2. Go to **Pipeline Control** → click **Generate Documents** (if not done already)
3. Click **Execute Full Pipeline** — watch the live step-by-step progress
4. Navigate to **Anomaly Center** to see all detected fraud alerts
5. Open **Graph Explorer** to see the knowledge graph visualisation
6. Use **Cypher Lab** to copy queries into Neo4j Browser for interactive exploration

---

## 📁 Project Structure

```
NexusGuard_Sukaksha_hackthon/
│
├── app.py                  ← Streamlit dashboard (main entry point)
├── config.py               ← Centralised configuration
├── generate_mock_data.py   ← Synthetic fraud document generator
├── pipeline.py             ← NLP extraction pipeline
├── graph_engine.py         ← Neo4j graph builder & query engine
├── fraud_detector.py       ← Graph traversal fraud detection algorithms
├── requirements.txt        ← Python dependencies
├── README.md               ← This file
│
├── .streamlit/
│   └── config.toml         ← Streamlit dark theme configuration
│
├── input_documents/        ← Source documents (auto-created)
│   ├── doc1_loan_application_rajesh.txt
│   ├── doc2_loan_application_amit.txt
│   ├── doc3_company_registration_apex.txt
│   ├── doc4_land_transfer_deed.txt
│   └── doc5_property_verification_report.txt
│
├── output/                 ← Pipeline outputs (auto-created)
└── logs/
    └── nexusguard.log      ← System log file
```

---

## 🕸️ Knowledge Graph Schema

```cypher
// Node Labels
(:Person       {entity_id, name, canonical_name, pan, aadhaar})
(:Asset        {entity_id, name, survey_number, asset_type})
(:Address      {entity_id, full_address, pincode, canonical_name})
(:Company      {entity_id, name, canonical_name, cin})
(:Organization {entity_id, name, canonical_name, cin})

// Relationship Types
(:Person)  -[:APPLIED_FOR_LOAN_WITH]-> (:Asset)
(:Person)  -[:GUARANTOR_FOR]->         (:Person)
(:Person)  -[:DIRECTOR_OF]->           (:Company)
(:Person)  -[:RESIDES_AT]->            (:Address)
(:Company) -[:REGISTERED_AT]->         (:Address)
(:Asset)   -[:HAS_LIEN_BY]->           (:Organization)
(*)        -[:OWNS_ASSET]->            (:Asset)
(*)        -[:TRANSFERRED_TO]->        (*)
```

---

## 🔬 Fraud Detection Cypher Queries

Paste these into Neo4j Browser (http://localhost:7474):

```cypher
-- Full graph
MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 100;

-- Address overlap
MATCH (addr:Address)<-[:REGISTERED_AT|RESIDES_AT]-(e)
WITH addr, collect(e.name) AS names, count(e) AS cnt
WHERE cnt >= 2
RETURN addr.full_address, names, cnt;

-- Collateral conflict
MATCH (p1:Person)-[:APPLIED_FOR_LOAN_WITH]->(a:Asset)
MATCH (p2:Person)-[:APPLIED_FOR_LOAN_WITH]->(a)
WHERE p1.entity_id <> p2.entity_id
RETURN a.name, p1.name, p2.name;
```

---

## 🛠️ Troubleshooting

| Issue | Solution |
|-------|----------|
| `spaCy model not found` | Run `python -m spacy download en_core_web_sm` |
| `Neo4j connection refused` | Start Neo4j Desktop or `bin/neo4j start` |
| `Auth error` | Verify password is `password` in Neo4j Desktop settings |
| `ModuleNotFoundError` | Run `pip install -r requirements.txt` with venv activated |
| `Tesseract not found` | Install Tesseract and add it to PATH (only needed for image OCR) |
| `Port 8501 in use` | Run `streamlit run app.py --server.port 8502` |
| `Empty graph` | Run pipeline first; check input_documents/ has files |

---

## 🧰 Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Language | Python 3.10+ | Core runtime |
| NLP | spaCy `en_core_web_sm` | Named Entity Recognition |
| Pattern Matching | Python `re` | Indian identifier extraction |
| Entity Resolution | `difflib.SequenceMatcher` | Fuzzy deduplication |
| OCR | Tesseract + pytesseract | Scanned document ingestion |
| PDF Parsing | PyPDF2 | PDF text extraction |
| Graph Database | Neo4j 5.x | Knowledge graph storage |
| Graph Driver | neo4j Python driver | Bolt protocol communication |
| Graph Viz | networkx + matplotlib | In-app network rendering |
| Dashboard | Streamlit | Web UI |
| Data | pandas | Table display |

---

## 📜 License

MIT License — see LICENSE file.

---

*Built with ❤️ by Team Sukaksha for the Canara Bank Hackathon 2024*
