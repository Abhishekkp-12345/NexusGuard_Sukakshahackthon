import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Upload, FileText, Image, CheckCircle, Loader2,
  AlertCircle, ChevronRight, Plus, Trash2
} from "lucide-react";
import { casesApi, forensicsApi } from "../api/client";

interface UploadedFile {
  file: File;
  docType: string;
  id: string;
}

const DOC_TYPES = [
  { value: "salary_slip", label: "Salary Slip" },
  { value: "bank_statement", label: "Bank Statement" },
  { value: "itr", label: "ITR / Form 16" },
  { value: "land_record", label: "Land Record / Property Deed" },
  { value: "aadhaar_card", label: "Aadhaar Card" },
  { value: "pan_card", label: "PAN Card" },
  { value: "driving_license", label: "Driving License" },
  { value: "bank_passbook", label: "Bank Passbook" },
  { value: "legal_document", label: "Legal Document" },
  { value: "unknown", label: "Auto-detect" },
];

const LOAN_TYPES = ["Home Loan", "Personal Loan", "Business Loan", "Mortgage Loan", "Education Loan"];
const BRANCHES = ["Bengaluru Main", "Mumbai Fort", "Delhi Connaught Place", "Chennai Anna Salai", "Hyderabad HITEC City"];

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

  // Form state
  const [form, setForm] = useState({
    applicant_name: "",
    applicant_pan: "",
    loan_type: "Home Loan",
    loan_amount: "",
    branch: "Bengaluru Main",
  });

  const handleFormChange = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleCreateCase = async () => {
    if (!form.applicant_name || !form.loan_amount) {
      setError("Applicant name and loan amount are required.");
      return;
    }
    setError("");
    try {
      const c = await casesApi.create({
        ...form,
        loan_amount: parseFloat(form.loan_amount),
      });
      setCaseId(c.case_id);
      setStep("upload");
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to create case. Is the backend running?");
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
        validFiles.push({
          file: f,
          docType: "unknown",
          id: Math.random().toString(36).slice(2),
        });
      } else {
        invalidNames.push(f.name);
      }
    });

    if (invalidNames.length > 0) {
      setError(`Unsupported file types ignored: ${invalidNames.join(", ")}. Only PDF, JPG, PNG, and TIFF are supported.`);
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
      setError("Please upload at least one document.");
      return;
    }
    setError("");
    setStep("analyzing");
    setAnalysisProgress(["Uploading documents..."]);

    const steps = [
      "Running ELA pixel analysis...",
      "Extracting PDF metadata and fonts...",
      "OCR text extraction...",
      "Cross-document validation (Layer 2)...",
      "Graph relationship analysis (Layer 3)...",
      "Computing risk scores (Layer 4)...",
      "Generating AI recommendation (Ollama gemma4)...",
      "Assembling forensic report...",
    ];

    // Show progressive status messages
    let stepIdx = 0;
    const progressInterval = setInterval(() => {
      if (stepIdx < steps.length) {
        const currentMsg = steps[stepIdx]; // Capture inside block to avoid React state batch closure bug
        setAnalysisProgress(prev => [...prev, currentMsg]);
        stepIdx++;
      }
    }, 2000);

    try {
      await forensicsApi.analyze(
        caseId,
        files.map(f => f.file),
        files.map(f => f.docType),
      );
      clearInterval(progressInterval);
      setAnalysisProgress(prev => [...prev, "✅ Analysis complete!"]);
      setTimeout(() => onCaseCreated(caseId), 800);
    } catch (e: any) {
      clearInterval(progressInterval);
      setError(e?.response?.data?.detail || "Analysis failed. Check backend logs.");
      setStep("upload");
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 className="page-title">New Underwriting Case</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 6 }}>
          Upload loan documents for ForgeShield AI forensic analysis
        </p>
      </div>

      {/* Steps indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
        {(["info", "upload", "analyzing"] as Step[]).map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: step === s ? "var(--indigo)" : (["info","upload","analyzing"].indexOf(step) > i ? "var(--approve)" : "var(--bg-card)"),
                border: `2px solid ${step === s ? "var(--indigo)" : (["info","upload","analyzing"].indexOf(step) > i ? "var(--approve)" : "var(--border-subtle)")}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700,
                color: step === s || ["info","upload","analyzing"].indexOf(step) > i ? "white" : "var(--text-muted)",
              }}>
                {["info","upload","analyzing"].indexOf(step) > i ? "✓" : i + 1}
              </div>
              <span style={{
                fontSize: 13, fontWeight: step === s ? 600 : 400,
                color: step === s ? "var(--text-primary)" : "var(--text-muted)",
              }}>
                {s === "info" ? "Case Info" : s === "upload" ? "Upload Documents" : "Analyzing"}
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
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Step 1: Case Info */}
      {step === "info" && (
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24 }}>Case Information</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Applicant Full Name *</label>
              <input
                className="form-input"
                placeholder="e.g. Rajesh Kumar"
                value={form.applicant_name}
                onChange={e => handleFormChange("applicant_name", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">PAN Number</label>
              <input
                className="form-input text-mono"
                placeholder="e.g. ABCDE1234F"
                value={form.applicant_pan}
                onChange={e => handleFormChange("applicant_pan", e.target.value.toUpperCase())}
                maxLength={10}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Loan Amount (₹) *</label>
              <input
                className="form-input"
                type="number"
                placeholder="e.g. 4500000"
                value={form.loan_amount}
                onChange={e => handleFormChange("loan_amount", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Loan Type</label>
              <select
                className="form-select"
                value={form.loan_type}
                onChange={e => handleFormChange("loan_type", e.target.value)}
              >
                {LOAN_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Branch</label>
              <select
                className="form-select"
                value={form.branch}
                onChange={e => handleFormChange("branch", e.target.value)}
              >
                {BRANCHES.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
            <button className="btn btn-primary" onClick={handleCreateCase}>
              Continue to Upload <ChevronRight size={16} />
            </button>
          </div>
        </motion.div>
      )}

      {/* Step 2: Upload */}
      {step === "upload" && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{
            padding: "10px 14px", borderRadius: "var(--radius-md)",
            background: "rgba(99,102,241,0.08)", border: "1px solid var(--border-subtle)",
            marginBottom: 20, fontSize: 13, color: "var(--text-secondary)",
          }}>
            Case <span className="text-mono" style={{ color: "var(--indigo-light)" }}>{caseId}</span> created.
            Upload documents below.
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
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              Drop documents here or click to browse
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
              Supported: PDF, JPG, PNG, TIFF
            </div>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div className="section-title">Uploaded Documents ({files.length})</div>
              {files.map(({ file, docType, id }) => (
                <motion.div
                  key={id}
                  className="card"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
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
                      <div style={{ fontWeight: 500, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {file.name}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {(file.size / 1024).toFixed(0)} KB
                      </div>
                    </div>
                    <select
                      className="form-select"
                      style={{ width: 160, fontSize: 12 }}
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
              <Plus size={16} /> Add More
            </button>
            <button className="btn btn-primary btn-lg" onClick={handleAnalyze} disabled={files.length === 0}>
              🔍 Run ForgeShield Analysis
            </button>
          </div>
        </motion.div>
      )}

      {/* Step 3: Analyzing */}
      {step === "analyzing" && (
        <motion.div
          className="card"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ textAlign: "center", padding: 60 }}
        >
          <div style={{ marginBottom: 24 }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              style={{ display: "inline-block" }}
            >
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                border: "3px solid rgba(99,102,241,0.2)",
                borderTop: "3px solid var(--indigo)",
              }} />
            </motion.div>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
            Running 5-Layer Analysis
          </h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 32 }}>
            Analyzing documents with ForgeShield AI + Ollama (gemma4)
          </p>
          <div style={{ textAlign: "left", maxWidth: 440, margin: "0 auto" }}>
            {analysisProgress.filter(Boolean).map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 0", borderBottom: i < analysisProgress.length - 1 ? "1px solid var(--border-subtle)" : "none",
                  color: msg.startsWith("✅") ? "var(--approve)" : "var(--text-secondary)",
                  fontSize: 14,
                }}
              >
                {msg.startsWith("✅")
                  ? <CheckCircle size={15} color="var(--approve)" />
                  : i === analysisProgress.length - 1
                  ? <Loader2 size={15} color="var(--indigo)" className="pulse" />
                  : <CheckCircle size={15} color="var(--approve)" />
                }
                {msg}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
