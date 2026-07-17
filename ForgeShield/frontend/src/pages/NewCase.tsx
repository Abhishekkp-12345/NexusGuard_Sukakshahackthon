import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileText, Image, CheckCircle, Loader2,
  AlertCircle, ChevronRight, ChevronLeft, Plus, Trash2
} from "lucide-react";
import { casesApi, forensicsApi } from "../api/client";
import { logActivity } from "../auth/AuthService";

interface UploadedFile {
  file: File;
  docType: string;
  id: string;
  progress: number;
  status: "idle" | "verifying" | "complete" | "error";
}

const DOC_TYPES = [
  { value: "pan", label: "PAN Card" },
  { value: "aadhaar", label: "Aadhaar Card" },
  { value: "gst", label: "GST Certificate / Registration" },
  { value: "bank_statement", label: "Bank Statement (Income)" },
  { value: "financial_statement", label: "Financial Statement / ITR" },
  { value: "land_record", label: "Land Record / Property Deed" },
  { value: "legal_document", label: "Legal & Litigation Documents" },
  { value: "salary_slip", label: "Promoter Salary Slips" },
  { value: "partnership_deed", label: "Partnership Deed / MoA" },
  { value: "utility_bill", label: "Utility Bill (Address Proof)" },
  { value: "board_resolution", label: "Board Resolution Document" },
  { value: "unknown", label: "Other / Auto-detect Type" },
];

const LOAN_TYPES = ["Business Expansion Loan", "Working Capital Loan", "Home Loan", "Personal Loan", "Education Loan", "Mortgage Loan"];
const BRANCHES = ["Bengaluru Main", "Mumbai Fort", "Delhi Connaught Place", "Chennai Anna Salai", "Hyderabad HITEC City"];
const INDUSTRIES = ["Manufacturing", "Real Estate", "Trading & Retail", "IT & Technology Services", "Agriculture & Food Processing", "Healthcare & Pharma", "Construction & Infrastructure", "Hospitality & Tourism"];

interface Props {
  onCaseCreated: (caseId: string) => void;
}

type Step = "info" | "upload" | "analyzing";

export default function NewCase({ onCaseCreated }: Props) {
  const [step, setStep] = useState<Step>("info");
  const [caseId, setCaseId] = useState<string>("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<string[]>([]);
  const [error, setError] = useState<string>("");

  // Step 1 Form state
  const [form, setForm] = useState({
    company_name: "",
    cin: "",
    gst_number: "",
    applicant_name: "", // Promoter Name
    applicant_pan: "",  // PAN Number
    aadhaar_promoter: "",
    industry_type: "Manufacturing",
    years_in_business: "",
    registered_address: "",
    annual_turnover: "",
    loan_amount: "",
    loan_type: "Business Expansion Loan",
    loan_purpose: "",
    branch: "Bengaluru Main"
  });

  const [directors, setDirectors] = useState<string[]>([""]);

  const handleFormChange = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddDirector = () => {
    setDirectors(prev => [...prev, ""]);
  };

  const handleRemoveDirector = (index: number) => {
    setDirectors(prev => prev.filter((_, i) => i !== index));
  };

  const handleDirectorChange = (index: number, value: string) => {
    setDirectors(prev => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  };

  const handleCreateCase = async () => {
    if (!form.company_name || !form.applicant_name || !form.loan_amount) {
      setError("Company Name, Promoter Name, and Loan Amount are required.");
      return;
    }
    setError("");
    try {
      // Backend case creation
      const c = await casesApi.create({
        applicant_name: form.company_name, // Map company name as applicant name to fit backend schema
        applicant_pan: form.applicant_pan,
        loan_type: form.loan_type,
        loan_amount: parseFloat(form.loan_amount),
        branch: form.branch,
      });

      // Save complete details locally (to be passed or matched in memory/reports)
      const fullDetails = {
        ...form,
        directors: directors.filter(Boolean),
        case_id: c.case_id,
        created_at: new Date().toISOString()
      };
      localStorage.setItem(`case_details_${c.case_id}`, JSON.stringify(fullDetails));

      setCaseId(c.case_id);
      setStep("upload");
      logActivity("CREATE_CASE", `Created new underwriting case for ${form.company_name} (Case ID: ${c.case_id}, Amount: ₹${parseFloat(form.loan_amount).toLocaleString()})`);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to create case. Ensure the server is online.");
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    addFiles(dropped);
  }, []);

  const addFiles = (newFiles: File[]) => {
    const validFiles: UploadedFile[] = [];
    const invalidNames: string[] = [];

    newFiles.forEach(f => {
      if (/\.(pdf|jpg|jpeg|png|tiff|bmp)$/i.test(f.name)) {
        // Auto-detect docType from file name patterns
        let docType = "unknown";
        const name = f.name.toLowerCase();
        if (name.includes("pan")) docType = "pan";
        else if (name.includes("aadhaar") || name.includes("adhar")) docType = "aadhaar";
        else if (name.includes("gst")) docType = "gst";
        else if (name.includes("statement") || name.includes("bank")) docType = "bank_statement";
        else if (name.includes("financial") || name.includes("itr") || name.includes("tax")) docType = "financial_statement";
        else if (name.includes("land") || name.includes("property")) docType = "land_record";
        else if (name.includes("legal") || name.includes("deed") || name.includes("court")) docType = "legal_document";

        validFiles.push({
          file: f,
          docType,
          id: Math.random().toString(36).slice(2),
          progress: 100, // Pre-load simulator
          status: "idle"
        });
      } else {
        invalidNames.push(f.name);
      }
    });

    if (invalidNames.length > 0) {
      setError(`Unsupported files ignored: ${invalidNames.join(", ")}. Upload PDF, Images (JPG, PNG) or TIFF.`);
    } else {
      setError("");
    }

    setFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id));

  const setDocType = (id: string, docType: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, docType } : f));
  };

  const handleAnalyze = async () => {
    if (files.length === 0) {
      setError("Please upload at least one document to proceed.");
      return;
    }
    setError("");
    setStep("analyzing");
    setAnalysisProgress(["Uploading documents to secure local gateway..."]);

    const steps = [
      "Analyzing document authenticity (metadata, headers, fonts)...",
      "Running Error Level Analysis (ELA) for image tampering...",
      "OCR Extraction and semantic parsing of critical fields...",
      "GSTIN registry lookup and compliance filing checks...",
      "Cross-document consistency validation (Identity & Address matching)...",
      "Network Graph mapping (identifying related party relationships)...",
      "Running 5 credit intelligence engines...",
      "Computing Final Trust & Probability of Default scores...",
      "Generating AI explainable output and decision summary...",
      "Finalizing comprehensive forensic report package..."
    ];

    let stepIdx = 0;
    const progressInterval = setInterval(() => {
      if (stepIdx < steps.length) {
        setAnalysisProgress(prev => [...prev, steps[stepIdx]]);
        stepIdx++;
      }
    }, 1500);

    try {
      await forensicsApi.analyze(
        caseId,
        files.map(f => f.file),
        files.map(f => f.docType),
      );
      clearInterval(progressInterval);
      setAnalysisProgress(prev => [...prev, "✅ Forensic Audit complete!"]);
      logActivity("RUN_ANALYSIS", `Executed AI pipeline for Case: ${caseId} (${files.length} doc(s) analyzed)`);
      setTimeout(() => onCaseCreated(caseId), 800);
    } catch (e: any) {
      clearInterval(progressInterval);
      setError(e?.response?.data?.detail || "Analysis pipeline failed. Check console or server logs.");
      setStep("upload");
    }
  };

  return (
    <div style={{ maxWidth: 840, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 className="page-title">New Loan Case Intake</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 6, fontSize: 13 }}>
          Automated SME Credit Underwriting & Forensic Verification Portal
        </p>
      </div>

      {/* Steps indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28, background: "rgba(255,255,255,0.02)", padding: "12px 20px", borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
        {(["info", "upload", "analyzing"] as Step[]).map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%",
                background: step === s ? "var(--indigo)" : (["info","upload","analyzing"].indexOf(step) > i ? "var(--approve)" : "rgba(255,255,255,0.05)"),
                border: `2px solid ${step === s ? "var(--indigo)" : (["info","upload","analyzing"].indexOf(step) > i ? "var(--approve)" : "var(--border-subtle)")}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700,
                color: step === s || ["info","upload","analyzing"].indexOf(step) > i ? "white" : "var(--text-muted)",
              }}>
                {["info","upload","analyzing"].indexOf(step) > i ? "✓" : i + 1}
              </div>
              <span style={{
                fontSize: 13, fontWeight: step === s ? 600 : 400,
                color: step === s ? "var(--text-primary)" : "var(--text-muted)",
              }}>
                {s === "info" ? "Company Details" : s === "upload" ? "Document Intake" : "AI Verification"}
              </span>
            </div>
            {i < 2 && <ChevronRight size={14} color="var(--text-muted)" />}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: "12px 16px", borderRadius: "var(--radius-md)",
          background: "var(--reject-bg)", border: "1px solid rgba(239,68,68,0.3)",
          color: "var(--reject)", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 10, fontSize: 13
        }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* Step 1: Company Info */}
        {step === "info" && (
          <motion.div
            key="info"
            className="card"
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 15 }}
            transition={{ duration: 0.2 }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: "var(--indigo-light)" }}>Company & Promoter Profile</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              
              <div className="form-group">
                <label className="form-label">Company Legal Name *</label>
                <input
                  className="form-input"
                  placeholder="e.g. Acme Tech Solutions Private Limited"
                  value={form.company_name}
                  onChange={e => handleFormChange("company_name", e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Corporate Identification Number (CIN)</label>
                <input
                  className="form-input text-mono"
                  placeholder="e.g. U72200KA2021PTC145678"
                  value={form.cin}
                  onChange={e => handleFormChange("cin", e.target.value.toUpperCase())}
                  maxLength={21}
                />
              </div>

              <div className="form-group">
                <label className="form-label">GSTIN / Tax Number</label>
                <input
                  className="form-input text-mono"
                  placeholder="e.g. 29ABCDE1234F1Z5"
                  value={form.gst_number}
                  onChange={e => handleFormChange("gst_number", e.target.value.toUpperCase())}
                  maxLength={15}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Company PAN</label>
                <input
                  className="form-input text-mono"
                  placeholder="e.g. ABCDE1234F"
                  value={form.applicant_pan}
                  onChange={e => handleFormChange("applicant_pan", e.target.value.toUpperCase())}
                  maxLength={10}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Promoter Name (Primary Applicant) *</label>
                <input
                  className="form-input"
                  placeholder="e.g. Rajesh Kumar"
                  value={form.applicant_name}
                  onChange={e => handleFormChange("applicant_name", e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Aadhaar of Promoter</label>
                <input
                  className="form-input text-mono"
                  placeholder="e.g. 1234 5678 9012"
                  value={form.aadhaar_promoter}
                  onChange={e => handleFormChange("aadhaar_promoter", e.target.value)}
                  maxLength={14}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Industry Sector</label>
                <select
                  className="form-select"
                  value={form.industry_type}
                  onChange={e => handleFormChange("industry_type", e.target.value)}
                >
                  {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Years in Business</label>
                <input
                  className="form-input"
                  type="number"
                  placeholder="e.g. 5"
                  value={form.years_in_business}
                  onChange={e => handleFormChange("years_in_business", e.target.value)}
                />
              </div>

              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Registered Office Address</label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Street, City, State, ZIP code..."
                  value={form.registered_address}
                  onChange={e => handleFormChange("registered_address", e.target.value)}
                  style={{ resize: "vertical" }}
                />
              </div>

              {/* Directors Section */}
              <div style={{ gridColumn: "1 / -1", marginTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <label className="form-label" style={{ margin: 0 }}>List of Directors / Partners</label>
                  <button className="btn btn-ghost btn-sm" onClick={handleAddDirector} style={{ padding: "4px 8px", fontSize: 11 }}>
                    <Plus size={12} /> Add Director
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {directors.map((dir, index) => (
                    <div key={index} style={{ display: "flex", gap: 10 }}>
                      <input
                        className="form-input"
                        placeholder={`Director #${index + 1} Name`}
                        value={dir}
                        onChange={(e) => handleDirectorChange(index, e.target.value)}
                      />
                      {directors.length > 1 && (
                        <button className="btn btn-ghost" onClick={() => handleRemoveDirector(index)} style={{ padding: "6px 10px" }}>
                          <Trash2 size={14} color="var(--reject)" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ marginTop: 8 }}>
                <label className="form-label">Annual Turnover (₹ Lakhs)</label>
                <input
                  className="form-input"
                  type="number"
                  placeholder="e.g. 250"
                  value={form.annual_turnover}
                  onChange={e => handleFormChange("annual_turnover", e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginTop: 8 }}>
                <label className="form-label">Loan Amount Requested (₹) *</label>
                <input
                  className="form-input"
                  type="number"
                  placeholder="e.g. 5000000"
                  value={form.loan_amount}
                  onChange={e => handleFormChange("loan_amount", e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Loan Facility Type</label>
                <select
                  className="form-select"
                  value={form.loan_type}
                  onChange={e => handleFormChange("loan_type", e.target.value)}
                >
                  {LOAN_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Loan Purpose / Utilization Plan</label>
                <input
                  className="form-input"
                  placeholder="e.g. Purchase of machinery, inventory..."
                  value={form.loan_purpose}
                  onChange={e => handleFormChange("loan_purpose", e.target.value)}
                />
              </div>

              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Branch Processing Case</label>
                <select
                  className="form-select"
                  value={form.branch}
                  onChange={e => handleFormChange("branch", e.target.value)}
                >
                  {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

            </div>

            <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-primary" onClick={handleCreateCase}>
                Continue to Document Upload <ChevronRight size={16} />
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Upload */}
        {step === "upload" && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.2 }}
          >
            <div style={{
              padding: "10px 14px", borderRadius: "var(--radius-md)",
              background: "rgba(99,102,241,0.08)", border: "1px solid var(--border-subtle)",
              marginBottom: 20, fontSize: 13, color: "var(--text-secondary)",
              display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
              <span>Case ID: <span className="text-mono" style={{ color: "var(--indigo-light)", fontWeight: 700 }}>{caseId}</span> ({form.company_name})</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setStep("info")} style={{ fontSize: 11, padding: "4px 8px" }}>
                <ChevronLeft size={12} /> Edit Details
              </button>
            </div>

            {/* Drop zone */}
            <div
              className={`upload-zone ${dragOver ? "drag-over" : ""}`}
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <input
                id="file-input"
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.tiff,.bmp"
                style={{ display: "none" }}
                onChange={e => addFiles(Array.from(e.target.files || []))}
              />
              <Upload size={40} color="var(--indigo)" style={{ margin: "0 auto 16px" }} />
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                Drag and drop loan application documents or click to browse
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                PDF, JPG, PNG, or TIFF files. ForgeShield will automatically run Layer-1 pixel and font integrity scans.
              </div>
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Document Package ({files.length})</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Confirm Document Category for AI analysis</span>
                </div>
                
                {files.map(({ file, docType, id }) => (
                  <motion.div
                    key={id}
                    className="card"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ marginBottom: 10, padding: 14 }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 8,
                        background: "rgba(99,102,241,0.1)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        {file.type.includes("image") ? <Image size={18} color="var(--indigo-light)" /> : <FileText size={18} color="var(--indigo-light)" />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {file.name}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                          {(file.size / 1024).toFixed(0)} KB · Ready
                        </div>
                      </div>
                      <select
                        className="form-select"
                        style={{ width: 200, fontSize: 12, padding: "6px 8px" }}
                        value={docType}
                        onChange={e => setDocType(id, e.target.value)}
                      >
                        {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <button className="btn btn-ghost btn-sm" onClick={() => removeFile(id)} style={{ padding: "6px 8px" }}>
                        <Trash2 size={14} color="var(--reject)" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => document.getElementById("file-input")?.click()}>
                <Plus size={15} /> Add More Files
              </button>
              <button className="btn btn-primary btn-lg" onClick={handleAnalyze} disabled={files.length === 0} style={{ padding: "12px 24px" }}>
                🔍 Run 5-Layer Forensic Audit
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Analyzing */}
        {step === "analyzing" && (
          <motion.div
            key="analyzing"
            className="card"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ textAlign: "center", padding: "50px 30px" }}
          >
            <div style={{ marginBottom: 24 }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                style={{ display: "inline-block" }}
              >
                <div style={{
                  width: 54, height: 54, borderRadius: "50%",
                  border: "3px solid rgba(99,102,241,0.2)",
                  borderTop: "3px solid var(--indigo)",
                }} />
              </motion.div>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
              Running 5-Layer AI Pipeline
            </h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: 30, fontSize: 13 }}>
              Scrutinizing documents and verifying entities against local model endpoints
            </p>
            <div style={{ textAlign: "left", maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {analysisProgress.filter(Boolean).map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "6px 0", borderBottom: i < analysisProgress.length - 1 ? "1px solid var(--border-subtle)" : "none",
                    color: msg.startsWith("✅") ? "var(--approve)" : "var(--text-secondary)",
                    fontSize: 13,
                  }}
                >
                  {msg.startsWith("✅")
                    ? <CheckCircle size={14} color="var(--approve)" />
                    : i === analysisProgress.length - 1
                    ? <Loader2 size={14} color="var(--indigo)" className="pulse" />
                    : <CheckCircle size={14} color="var(--approve)" />
                  }
                  {msg}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
