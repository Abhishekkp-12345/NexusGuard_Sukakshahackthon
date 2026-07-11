# ForgeShield AI — Quick Start Guide

## Setup

### 1. Backend Setup
```powershell
cd "e:\Canara Hack\ForgeShield\backend"
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m spacy download en_core_web_sm    # optional, improves NER
```

### 2. Generate Mock Demo Data
```powershell
# (while venv is active)
python mock_data\generate_samples.py
```

### 3. Start Backend
```powershell
# (while venv is active)
uvicorn main:app --reload --port 8000
```

### 4. Start Frontend
```powershell
cd "e:\Canara Hack\ForgeShield\frontend"
npm run dev
```

### 5. Access the App
- **Frontend**: http://localhost:5173
- **Backend API Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/api/health

---

## Demo Flow (Hackathon)

1. Open http://localhost:5173
2. Click **New Case**
3. Fill in: Applicant = "Rajesh Kumar", Loan = ₹45,00,000 (4500000), Home Loan
4. Upload from `backend/mock_data/samples/`:
   - `tampered_salary_slip.pdf` → type: **Salary Slip**
   - `bank_statement.pdf` → type: **Bank Statement**
   - `land_record.pdf` → type: **Land Record**
5. Click **Run ForgeShield Analysis**
6. Watch the 5-layer analysis progress (Ollama gemma4 runs last)
7. See HOLD verdict with:
   - ELA heatmap (if image)
   - Income inconsistency flagged
   - Adobe Acrobat metadata flag
   - AI recommendation
8. Download PDF forensic report
9. View Relationship Graph
10. View Executive Analytics

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Ollama not running` | Run `ollama serve` in a separate terminal |
| `gemma4 model not found` | Run `ollama pull gemma4` |
| `tesseract not found` | Install from https://github.com/UB-Mannheim/tesseract/wiki |
| `CORS error` | Ensure backend is on port 8000 |
| `fpdf2 missing` | `pip install fpdf2` |
