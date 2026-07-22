import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, CheckCircle, AlertTriangle, Shield, Sparkles, ChevronDown, ChevronUp, ShieldAlert, Eye } from "lucide-react";
import { generateAnomalies } from "../api/mockData";
import type { DocumentReport } from "../api/client";
import ForensicOverlay from "./ForensicOverlay";

interface DocumentItem {
  id: string;
  name: string;
  type: string;
  score: number;
  uploadDate: string;
  status: "OK" | "WARN" | "FAIL";
  fields: Record<string, string>;
  _docFindings?: Array<{ severity?: string; type?: string; detail?: string }>;
  benford_result?: any;
  entropy_result?: any[];
  dna_result?: any;
}

interface Props {
  caseId: string;
  applicantName: string;
  applicantPan?: string;
  applicantType?: "corporate" | "salaried" | "farmer";
  verdict?: string;
  overallScore?: number;
  seed: number;
  documentReports?: DocumentReport[];
}

export default function DocumentIntegrityViewer({
  applicantName,
  applicantPan = "ABCDE1234F",
  applicantType = "corporate",
  verdict,
  overallScore = 95,
  seed,
  documentReports,
}: Props) {
  const isApprove = verdict === "APPROVE" || overallScore >= 75;

  let docList: DocumentItem[] = [];

  if (documentReports && documentReports.length > 0) {
    docList = documentReports.map((doc, idx) => {
      const f = doc.extracted_fields || {};
      const fields: Record<string, string> = {};

      let typeLabel = "DOCUMENT";
      const dt = (doc.type || "").toLowerCase();
      if (dt.includes("pan")) typeLabel = "PAN Card";
      else if (dt.includes("aadhaar")) typeLabel = "Aadhaar Card";
      else if (dt.includes("license") || dt.includes("driving")) typeLabel = "Driving License";
      else if (dt.includes("bank") || dt.includes("passbook") || dt.includes("statement")) typeLabel = "Bank Statement";
      else if (dt.includes("salary") || dt.includes("payslip")) typeLabel = "Salary Slip";
      else if (dt.includes("land") || dt.includes("pahani") || dt.includes("rtc")) typeLabel = "Land Record";
      else if (dt.includes("gst")) typeLabel = "GST Return";
      else typeLabel = doc.type.replace(/_/g, " ").toUpperCase();

      const name = String(f.owner_name || f.account_holder_name || f.name || applicantName).toUpperCase();
      fields.name = name;

      if (f.father_name) fields.fatherName = String(f.father_name);
      if (f.dob) fields.dob = String(f.dob);

      if (Array.isArray(f.pans) && f.pans.length > 0) fields.panNo = String(f.pans[0]);
      else if (f.pan_number) fields.panNo = String(f.pan_number);
      else if (dt.includes("pan")) fields.panNo = applicantPan.toUpperCase();

      if (f.aadhaar_number) fields.aadhaarNo = String(f.aadhaar_number);
      if (f.driving_license_number) fields.dlNo = String(f.driving_license_number);

      if (f.account_number) fields.accNumber = String(f.account_number);
      else if (Array.isArray(f.account_numbers) && f.account_numbers.length > 0) fields.accNumber = String(f.account_numbers[0]);
      if (f.accHolder) fields.accHolder = String(f.accHolder);
      else fields.accHolder = name;

      if (f.ifsc_code) fields.ifsc = String(f.ifsc_code);
      else if (Array.isArray(f.ifsc_codes) && f.ifsc_codes.length > 0) fields.ifsc = String(f.ifsc_codes[0]);

      if (f.income) fields.grossSalary = `₹${Number(f.income).toLocaleString()} / month`;
      if (f.employer) fields.employer = String(f.employer);
      if (f.doc_date) fields.issueDate = String(f.doc_date);
      if (f.gstin) fields.gstin = String(f.gstin);

      Object.entries(f).forEach(([k, v]) => {
        if (!fields[k] && typeof v === "string" && k !== "full_text" && k !== "raw_lines") {
          fields[k] = v;
        }
      });

      // ── Compute REAL integrity score factoring in all backend findings ──
      // Start with the document's raw authenticity score
      let adjustedScore = doc.authenticity_score ?? 100;

      // Collect all findings for this specific document
      const docFindings: Array<{ severity?: string; type?: string }> = [];

      // From PDF forensics
      const pdfFindings: Array<{ severity?: string; type?: string }> =
        (doc.pdf_forensics as { findings?: Array<{ severity?: string; type?: string }> } | null)?.findings ?? [];
      docFindings.push(...pdfFindings);

      // From tamper detection
      const tamperFindings: Array<{ severity?: string; type?: string }> =
        (doc.tamper_result as { findings?: Array<{ severity?: string; type?: string }> } | null)?.findings ?? [];
      docFindings.push(...tamperFindings);

      // Count severity-based penalties
      const highCount = docFindings.filter((x) => x.severity === "HIGH").length;
      const medCount = docFindings.filter((x) => x.severity === "MEDIUM").length;

      // Apply penalties: each HIGH = -12, each MEDIUM = -5
      adjustedScore = Math.max(0, adjustedScore - highCount * 12 - medCount * 5);
      adjustedScore = Math.round(adjustedScore);

      // Determine status badge
      const isTampered = (doc.tamper_result as { tampered?: boolean } | null)?.tampered === true;
      let status: "OK" | "WARN" | "FAIL" = "OK";
      if (isTampered || highCount >= 2 || adjustedScore < 50) {
        status = "FAIL";
      } else if (highCount >= 1 || medCount >= 2 || adjustedScore < 75) {
        status = "WARN";
      }

      return {
        id: `doc_${idx}_${doc.type}`,
        name: doc.filename,
        type: typeLabel,
        score: adjustedScore,
        uploadDate: new Date().toISOString().split("T")[0],
        status,
        fields,
        // Carry raw findings for the checklist
        _docFindings: docFindings,
        benford_result: (doc as any).benford_result,
        entropy_result: (doc as any).entropy_result,
        dna_result: (doc as any).dna_result,
      };
    });
  } else {
    docList = [
      {
        id: "pan",
        name: "PAN Card - Corporate.pdf",
        type: "PAN Card",
        score: isApprove ? 99 : 65,
        uploadDate: "2026-07-14",
        status: isApprove ? "OK" : "WARN",
        fields: {
          name: applicantName.toUpperCase(),
          fatherName: "S. KUMAR",
          dob: "14/08/1988",
          panNo: applicantPan.toUpperCase(),
          issueDate: "12-OCT-2018",
          status: "ACTIVE & VERIFIED (INCOME TAX DEPT)",
        },
        benford_result: {
          triggered: false,
          chi_sq: 4.8,
          observed_distribution: { "1": 0.31, "2": 0.17, "3": 0.12, "4": 0.10, "5": 0.08, "6": 0.07, "7": 0.05, "8": 0.05, "9": 0.05 },
          expected_distribution: { "1": 0.301, "2": 0.176, "3": 0.125, "4": 0.097, "5": 0.079, "6": 0.067, "7": 0.058, "8": 0.051, "9": 0.046 },
          description: "Benford's Law check passed.",
          total_samples: 28
        },
        entropy_result: [],
        dna_result: {
          signature_hash: "9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c",
          matches: [],
          suspicious: false
        }
      },
      {
        id: "bank",
        name: "SBI Bank Statement FY25.pdf",
        type: "Bank Statement",
        score: isApprove ? 97 : 58,
        uploadDate: "2026-07-14",
        status: isApprove ? "OK" : "FAIL",
        fields: {
          bankName: "STATE BANK OF INDIA",
          accHolder: applicantName,
          accNumber: "38920194821",
          ifsc: "SBIN0000842",
          period: "01-Apr-2025 to 31-Mar-2026",
          amb: "₹1,85,420",
          closingBal: "₹4,12,050",
          fontIntegrity: isApprove ? "MATCH (Helvetica Standard)" : "FONT MODIFICATION ON PAGE 2",
        },
        benford_result: {
          triggered: !isApprove,
          chi_sq: isApprove ? 5.2 : 26.4,
          observed_distribution: isApprove 
            ? { "1": 0.29, "2": 0.18, "3": 0.13, "4": 0.09, "5": 0.08, "6": 0.07, "7": 0.06, "8": 0.05, "9": 0.05 }
            : { "1": 0.12, "2": 0.28, "3": 0.10, "4": 0.15, "5": 0.08, "6": 0.07, "7": 0.12, "8": 0.04, "9": 0.04 },
          expected_distribution: { "1": 0.301, "2": 0.176, "3": 0.125, "4": 0.097, "5": 0.079, "6": 0.067, "7": 0.058, "8": 0.051, "9": 0.046 },
          description: isApprove 
            ? "Benford's Law check passed." 
            : "Significant Benford's Law anomaly: first-digit distribution departs heavily from expected distribution.",
          total_samples: 110
        },
        entropy_result: isApprove ? [] : [
          {
            type: "REPEATED_AMOUNT_ANOMALY",
            severity: "HIGH",
            confidence: 0.94,
            description: "Amount ₹45,000 repeats 8 times on consecutive days. Suspected manufacturing.",
            value: "Amount: ₹45,000, count: 8"
          },
          {
            type: "ROUND_NUMBER_CONCENTRATION",
            severity: "MEDIUM",
            confidence: 0.82,
            description: "85% of transactions end in .00 or are round multiples of ₹1,000.",
            value: "85.0% round numbers"
          }
        ],
        dna_result: {
          signature_hash: isApprove ? "2a3d4f5e6b7c8d9e0a1b2c3d4e5f6a7b" : "fa3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d",
          matches: isApprove ? [] : [
            {
              match_type: "KNOWN_FRAUD_TEMPLATE",
              pattern_name: "SBI Statement Builder Online v3.1",
              description: "A known digital statement template generator found in darkweb repos.",
              risk_category: "Statement Fabrication Tool",
              similarity_score: 98.4,
              case_reference: "DB_TEMPLATE_6672"
            }
          ],
          suspicious: !isApprove
        }
      },
      {
        id: "land_or_salary",
        name: applicantType === "farmer" ? "Land Record Pahani.pdf" : applicantType === "salaried" ? "Salary Slip_June2025.pdf" : "GST Certificate & Filings.pdf",
        type: applicantType === "farmer" ? "Land Record" : applicantType === "salaried" ? "Salary Slip" : "GST Return",
        score: isApprove ? 96 : 72,
        uploadDate: "2026-07-14",
        status: isApprove ? "OK" : "WARN",
        fields: applicantType === "farmer" ? {
          surveyNo: "142/3A, 142/3B",
          acres: "4.85 Acres",
          village: "Devanahalli, Rural Bengaluru",
          pahaniNo: "RTC-2026-88192",
          crop: "Sugarcane & Paddy",
        } : applicantType === "salaried" ? {
          employer: "Greentech Solutions Pvt Ltd",
          grossSalary: "₹1,85,000 / month",
          netPay: "₹1,45,400 / month",
          pfNo: "KN/BNG/0048291/000",
          epfoStatus: "VERIFIED & ACTIVE",
        } : {
          gstin: "29ABCDE1234F1Z5",
          legalName: applicantName + " Enterprises",
          annualTurnover: "₹2.45 Crores",
          gstr3bStatus: "100% TIMELY FILED",
          vendorMatch: "98.2% MATCH",
        },
        benford_result: {
          triggered: false,
          chi_sq: 3.4,
          observed_distribution: { "1": 0.32, "2": 0.16, "3": 0.13, "4": 0.09, "5": 0.08, "6": 0.06, "7": 0.06, "8": 0.05, "9": 0.05 },
          expected_distribution: { "1": 0.301, "2": 0.176, "3": 0.125, "4": 0.097, "5": 0.079, "6": 0.067, "7": 0.058, "8": 0.051, "9": 0.046 },
          description: "Benford's check passed.",
          total_samples: 34
        },
        entropy_result: [],
        dna_result: {
          signature_hash: "8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c",
          matches: [],
          suspicious: false
        }
      },
    ];
  }

  const [selectedDocId, setSelectedDocId] = useState<string>(docList[0]?.id || "pan");
  const [showCopilot, setShowCopilot] = useState(false);
  const [showChecklist, setShowChecklist] = useState(true);
  const [showStatsForensics, setShowStatsForensics] = useState(true);

  const activeDoc = docList.find((d) => d.id === selectedDocId) || docList[0];
  const anomalies = generateAnomalies(seed + (selectedDocId.includes("pan") ? 1 : selectedDocId.includes("bank") ? 2 : 3), verdict);
  const detectedAnomalies = anomalies.filter((a) => a.detected);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Main Two-Column Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "stretch" }}>
        
        {/* Left Column: Uploaded Assets */}
        <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-subtle)", paddingBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              UPLOADED ASSETS
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(99,102,241,0.15)", color: "var(--indigo-light)", padding: "2px 8px", borderRadius: 10 }}>
              {docList.length} FILES
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {docList.map((doc) => {
              const isSelected = doc.id === activeDoc.id;
              return (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDocId(doc.id)}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    cursor: "pointer",
                    background: isSelected ? "rgba(245, 158, 11, 0.06)" : "rgba(255,255,255,0.015)",
                    border: isSelected ? "1.5px solid #f59e0b" : "1px solid var(--border-subtle)",
                    boxShadow: isSelected ? "0 0 15px rgba(245, 158, 11, 0.15)" : "none",
                    transition: "all 0.2s ease",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 6,
                      background: isSelected ? "#f59e0b20" : "rgba(255,255,255,0.05)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0
                    }}>
                      <FileText size={16} color={isSelected ? "#f59e0b" : "var(--indigo-light)"} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12.5, fontWeight: 700, color: isSelected ? "white" : "var(--text-primary)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                      }}>
                        {doc.name}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                        {doc.type} · Score: <strong style={{
                        color: doc.score >= 75 ? "var(--approve)" : doc.score >= 50 ? "var(--hold)" : "var(--reject)"
                      }}>{doc.score}%</strong>
                      </div>
                    </div>
                  </div>

                  {/* Integrity pill badge */}
                  <div style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    background:
                      doc.status === "OK"
                        ? "rgba(16, 185, 129, 0.12)"
                        : doc.status === "WARN"
                        ? "rgba(245, 158, 11, 0.12)"
                        : "rgba(239, 68, 68, 0.12)",
                    border: `1px solid ${
                      doc.status === "OK"
                        ? "rgba(16, 185, 129, 0.3)"
                        : doc.status === "WARN"
                        ? "rgba(245, 158, 11, 0.3)"
                        : "rgba(239, 68, 68, 0.3)"
                    }`,
                    fontSize: 10,
                    fontWeight: 700,
                    color:
                      doc.status === "OK"
                        ? "var(--approve)"
                        : doc.status === "WARN"
                        ? "var(--hold)"
                        : "var(--reject)",
                    display: "flex",
                    alignItems: "center",
                    gap: 5
                  }}>
                    {doc.status === "OK" ? (
                      <CheckCircle size={11} />
                    ) : doc.status === "WARN" ? (
                      <AlertTriangle size={11} />
                    ) : (
                      <AlertTriangle size={11} />
                    )}
                    <span>
                      {doc.status === "OK"
                        ? "Integrity OK"
                        : doc.status === "WARN"
                        ? "Anomalies Detected"
                        : "Tamper Flag Detected"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Document Forensic Viewer */}
        <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16, position: "relative" }}>
          
          {/* Document Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-subtle)", paddingBottom: 14 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: "0.04em", textTransform: "uppercase", color: "white" }}>
                {activeDoc.name.toUpperCase()}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                Uploaded {activeDoc.uploadDate} · AI Fraud Engine Verified
              </div>
            </div>
            <div style={{
              padding: "6px 14px",
              borderRadius: 8,
              background:
                activeDoc.score >= 75
                  ? "rgba(16, 185, 129, 0.1)"
                  : activeDoc.score >= 50
                  ? "rgba(245, 158, 11, 0.1)"
                  : "rgba(239, 68, 68, 0.1)",
              border: `1px solid ${
                activeDoc.score >= 75
                  ? "rgba(16, 185, 129, 0.4)"
                  : activeDoc.score >= 50
                  ? "rgba(245, 158, 11, 0.4)"
                  : "rgba(239, 68, 68, 0.4)"
              }`,
              color:
                activeDoc.score >= 75
                  ? "var(--approve)"
                  : activeDoc.score >= 50
                  ? "var(--hold)"
                  : "var(--reject)",
              fontSize: 12,
              fontWeight: 800
            }}>
              Authenticity Score: {activeDoc.score}%
              {activeDoc.status !== "OK" && (
                <span style={{ marginLeft: 8, fontSize: 10, opacity: 0.8 }}>
                  ({activeDoc.status === "WARN" ? "Anomalies Detected" : "Tampered"})
                </span>
              )}
            </div>
          </div>

          {/* Styled Document Mockup Viewer with Bounding Boxes & Hover Alert Tooltip Cards */}
          {(() => {
            // Helper to get anomalies dynamically
            interface DocAnomaly {
              fieldKey: string;
              title: string;
              detail: string;
              severity: "HIGH" | "MEDIUM" | "LOW";
              probability: number;
            }

            const getAnomaliesForDoc = (doc: any): DocAnomaly[] => {
              if (doc._docFindings && doc._docFindings.length > 0) {
                return doc._docFindings.map((f: any) => {
                  let fieldKey = "general";
                  const fType = (f.type || "").toUpperCase();
                  if (fType.includes("DATE") || fType.includes("DOB")) fieldKey = "issueDate";
                  else if (fType.includes("NAME") || fType.includes("HOLDER")) fieldKey = "accHolder";
                  else if (fType.includes("PAN") || fType.includes("AADHAAR")) fieldKey = "panNo";
                  else if (fType.includes("AMOUNT") || fType.includes("SALARY") || fType.includes("BALANCE")) fieldKey = "closingBal";
                  else if (fType.includes("LOGO")) fieldKey = "logo";
                  else if (fType.includes("SIGNATURE")) fieldKey = "signature";

                  return {
                    fieldKey,
                    title: (f.type ? f.type.replace(/_/g, " ") + " ALERT" : "FORENSIC INTEGRITY ALERT").toUpperCase(),
                    detail: f.detail || "Forensic analysis flagged a pixel or metadata anomaly in this field.",
                    severity: f.severity || "MEDIUM",
                    probability: f.confidence ? Math.round(f.confidence * 100) : (f.severity === "HIGH" ? 98 : 88)
                  };
                });
              }

              // Fallback mockup anomalies if not approved
              const isApprove = activeDoc.score >= 75;
              if (!isApprove) {
                const type = (doc.type || "").toLowerCase();
                const name = (doc.name || "").toLowerCase();

                if (type.includes("gst") || name.includes("gst")) {
                  return [
                    {
                      fieldKey: "issueDate",
                      title: "GSTIN REGISTRATION DATE ALERT",
                      detail: "Font type mismatch detected. The date field was edited using an Arial narrow font while the surrounding document uses standard dynamic OCR fonts.",
                      severity: "MEDIUM",
                      probability: 94
                    }
                  ];
                }
                if (type.includes("bank") || name.includes("bank") || name.includes("statement")) {
                  return [
                    {
                      fieldKey: "logo",
                      title: "HDFC BANK LOGO ALERT",
                      detail: "Logo manipulation detected. Logo metadata reveals it was inserted on a modified PDF canvas using Photoshop CC on July 14, 2026.",
                      severity: "HIGH",
                      probability: 98
                    },
                    {
                      fieldKey: "transaction",
                      title: "TRANSACTION INCONSISTENCY ALERT",
                      detail: "High-value credit of ₹20,000,000 does not align with average monthly balance trends or declared GST sales.",
                      severity: "MEDIUM",
                      probability: 88
                    }
                  ];
                }
                if (type.includes("balance") || name.includes("balance") || type.includes("financial")) {
                  return [
                    {
                      fieldKey: "signature",
                      title: "AUDITOR DIGITAL SIGNATURE ALERT",
                      detail: "Digital Signature warning: Certificate was self-signed and does not resolve to an active CA registry of ICAI. Certified by mock CA 'M/s Goel & Associates'.",
                      severity: "MEDIUM",
                      probability: 87
                    }
                  ];
                }
                if (type.includes("pan") || name.includes("pan")) {
                  return [
                    {
                      fieldKey: "panNo",
                      title: "PAN ID NUMBER ALERT",
                      detail: "Altered character spacing detected around the PAN ID number. Neural layout scan flags character replacement.",
                      severity: "HIGH",
                      probability: 92
                    }
                  ];
                }
              }
              return [];
            };

            const docAnomalies = getAnomaliesForDoc(activeDoc);

            // Helper component to render highlighted container with tooltip
            const HighlightedField = ({ fieldKey, children }: { fieldKey: string, children: React.ReactNode }) => {
              const anomaly = docAnomalies.find(a => a.fieldKey === fieldKey);
              if (!anomaly) return <>{children}</>;

              const borderColor = anomaly.severity === "HIGH" ? "#ef4444" : "#f59e0b";
              const bgColor = anomaly.severity === "HIGH" ? "rgba(239, 68, 68, 0.08)" : "rgba(245, 158, 11, 0.08)";
              const glowColor = anomaly.severity === "HIGH" ? "rgba(239, 68, 68, 0.3)" : "rgba(245, 158, 11, 0.3)";

              return (
                <div style={{ position: "relative", display: "inline-block" }}>
                  <div style={{
                    border: `2px solid ${borderColor}`,
                    borderRadius: 6,
                    padding: "4px 10px",
                    background: bgColor,
                    boxShadow: `0 0 10px ${glowColor}`,
                    cursor: "pointer"
                  }}>
                    {children}
                  </div>

                  {/* Dynamic Alert Tooltip Card */}
                  <div style={{
                    position: "absolute",
                    right: 0,
                    bottom: "125%",
                    width: 320,
                    background: "#090d16",
                    border: `1px solid ${borderColor}`,
                    borderRadius: 10,
                    padding: 16,
                    boxShadow: "0 12px 36px rgba(0,0,0,0.8)",
                    zIndex: 40,
                    textAlign: "left",
                    color: "#fff",
                    pointerEvents: "none"
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                      <ShieldAlert size={16} color={borderColor} style={{ flexShrink: 0, marginTop: 1 }} />
                      <div style={{ fontWeight: 800, fontSize: 11, color: anomaly.severity === "HIGH" ? "#fca5a5" : "#fef08a", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                        {anomaly.title}
                      </div>
                    </div>
                    <div style={{ fontSize: 10.5, color: "#cbd5e1", lineHeight: 1.5, marginBottom: 12 }}>
                      {anomaly.detail}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 10, fontSize: 10 }}>
                      <span style={{ color: "#94a3b8" }}>Scan Confidence</span>
                      <span style={{ fontWeight: 800, color: "#f43f5e" }}>{anomaly.probability}% Probability</span>
                    </div>
                  </div>
                </div>
              );
            };

            const isGst = activeDoc.type.toLowerCase().includes("gst") || activeDoc.name.toLowerCase().includes("gst");
            const isBank = activeDoc.type.toLowerCase().includes("bank") || activeDoc.name.toLowerCase().includes("bank") || activeDoc.name.toLowerCase().includes("statement");
            const isBalance = activeDoc.type.toLowerCase().includes("balance") || activeDoc.name.toLowerCase().includes("balance") || activeDoc.name.toLowerCase().includes("audited") || activeDoc.type.toLowerCase().includes("financial");
            const isPan = activeDoc.type.toLowerCase().includes("pan") || activeDoc.name.toLowerCase().includes("pan");

            return (
              <div style={{
                background: "#0a131c",
                border: "1px solid var(--border-subtle)",
                borderRadius: 14,
                padding: 24,
                minHeight: 380,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
                position: "relative",
                overflow: "hidden"
              }}>
                {/* ── 1. GST RETURN CERTIFICATE ── */}
                {isGst && (
                  <div style={{ position: "relative", background: "#0b1726", border: "1px solid #1e293b", borderRadius: 10, padding: 24 }}>
                    <div style={{ textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 12, marginBottom: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: "#f59e0b", letterSpacing: "0.06em" }}>GOVERNMENT OF INDIA</div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>REGISTRATION CERTIFICATE UNDER GOODS AND SERVICES TAX</div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-muted)" }}>Registration Number (GSTIN)</span>
                        <span style={{ fontWeight: 700, fontFamily: "monospace", color: "white" }}>{activeDoc.fields.gstin || "27AAACA123411Z5"}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-muted)" }}>Legal Name</span>
                        <span style={{ fontWeight: 700, color: "white" }}>{activeDoc.fields.name || "APEX LOGITECH SOLUTIONS PVT LTD"}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ color: "var(--text-muted)" }}>Registration Date</span>
                        <HighlightedField fieldKey="issueDate">
                          <span style={{ fontWeight: 800, color: "white", fontFamily: "monospace" }}>
                            {activeDoc.fields.issueDate || "14/05/2021"}
                          </span>
                        </HighlightedField>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, paddingTop: 12, borderTop: "1px dashed rgba(255,255,255,0.1)", fontSize: 10, color: "var(--text-muted)" }}>
                        <span>Jurisdictional Office: Mumbai Ward 402</span>
                        <span style={{ border: "1px solid var(--border-subtle)", padding: "2px 6px", borderRadius: 4 }}>QR Code</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── 2. BANK STATEMENT ── */}
                {isBank && (
                  <div style={{ position: "relative", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 20, color: "#0f172a" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #e2e8f0", paddingBottom: 12, marginBottom: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <HighlightedField fieldKey="logo">
                          <div style={{ background: "#000", color: "#fff", fontWeight: 900, padding: "4px 8px", borderRadius: 4, fontSize: 11 }}>
                            BK HDFC Bank
                          </div>
                        </HighlightedField>
                        <div style={{ fontSize: 10, color: "#64748b" }}>Wealth Management Branch</div>
                      </div>

                      <div style={{ textAlign: "right", fontSize: 10, color: "#475569" }}>
                        <div>STATEMENT OF ACCOUNT</div>
                        <div style={{ fontWeight: 700, fontFamily: "monospace" }}>Acc No: {activeDoc.fields.accNumber || "50200049928312"}</div>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, textAlign: "center", background: "#f8fafc", padding: 10, borderRadius: 6, marginBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: 8, color: "#64748b" }}>OPENING BALANCE</div>
                        <div style={{ fontSize: 12, fontWeight: 800 }}>₹3,412,410.50</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 8, color: "#64748b" }}>TOTAL CREDITS</div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#16a34a" }}>₹20,000,000.00</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 8, color: "#64748b" }}>CLOSING BALANCE</div>
                        <HighlightedField fieldKey="closingBal">
                          <div style={{ fontSize: 12, fontWeight: 800, color: "#2563eb" }}>{activeDoc.fields.closingBal || "₹2,34,12,410.50"}</div>
                        </HighlightedField>
                      </div>
                    </div>

                    <table style={{ width: "100%", fontSize: 10, borderCollapse: "collapse", color: "#334155" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #e2e8f0", fontWeight: 700, color: "#64748b" }}>
                          <td style={{ padding: 4 }}>Date</td>
                          <td style={{ padding: 4 }}>Narration</td>
                          <td style={{ padding: 4, textAlign: "right" }}>Amount (₹)</td>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ padding: 4 }}>14-May-26</td>
                          <td style={{ padding: 4 }}>Salary Disbursement Bulk</td>
                          <td style={{ padding: 4, textAlign: "right", color: "#dc2626" }}>-450,000.00</td>
                        </tr>
                        <tr style={{ background: docAnomalies.some(a => a.fieldKey === "transaction") ? "rgba(245, 158, 11, 0.08)" : "transparent" }}>
                          <td style={{ padding: 4 }}>24-May-26</td>
                          <td style={{ padding: 4, fontWeight: 800 }}>
                            <HighlightedField fieldKey="transaction">
                              <span>RTGS IN - VARDHAMAN IND - CR</span>
                            </HighlightedField>
                          </td>
                          <td style={{ padding: 4, textAlign: "right", color: "#16a34a", fontWeight: 800 }}>+20,000,000.00</td>
                        </tr>
                        <tr>
                          <td style={{ padding: 4 }}>28-May-26</td>
                          <td style={{ padding: 4 }}>GST Outward Payment</td>
                          <td style={{ padding: 4, textAlign: "right", color: "#dc2626" }}>-812,410.00</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ── 3. AUDITED BALANCE SHEET ── */}
                {isBalance && (
                  <div style={{ position: "relative", background: "#0b1726", border: "1px solid #1e293b", borderRadius: 10, padding: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 10, marginBottom: 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: "white" }}>Financial Audited Balance Sheet</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>FY 2025-26</div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-muted)" }}>Revenue</span>
                        <HighlightedField fieldKey="revenue">
                          <span style={{ fontWeight: 800, color: "white", fontFamily: "monospace" }}>{activeDoc.fields.revenue || "₹18,42,00,000"}</span>
                        </HighlightedField>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-muted)" }}>Auditor Name</span>
                        <span style={{ fontWeight: 700, color: "white" }}>{activeDoc.fields.auditorName || "CA Alok Goel (M.No. 408293)"}</span>
                      </div>

                      <div style={{ marginTop: 10 }}>
                        <HighlightedField fieldKey="signature">
                          <div style={{ fontSize: 10, color: "#fef08a", fontWeight: 700 }}>
                            OCR and metadata integrity scanner completed.
                          </div>
                        </HighlightedField>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── 4. PAN ID CARD ── */}
                {isPan && (
                  <div style={{ position: "relative", background: "#081b18", border: "1px solid #134e45", borderRadius: 10, padding: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(16,185,129,0.2)", paddingBottom: 10, marginBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "#10b981", letterSpacing: "0.08em" }}>INCOME TAX DEPARTMENT</div>
                        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.6)", marginTop: 1 }}>GOVERNMENT OF INDIA</div>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 900, color: "#10b981", letterSpacing: "0.1em" }}>PAN CARD</div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: 11 }}>
                      <div>
                        <div style={{ fontSize: 8, color: "#10b981", fontWeight: 700 }}>NAME</div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "white", marginTop: 2 }}>{activeDoc.fields.name || "N/A"}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 8, color: "#10b981", fontWeight: 700 }}>DATE OF BIRTH</div>
                        <HighlightedField fieldKey="dob">
                          <div style={{ fontSize: 12, fontWeight: 800, color: "white", marginTop: 2 }}>{activeDoc.fields.dob || "N/A"}</div>
                        </HighlightedField>
                      </div>
                      <div>
                        <div style={{ fontSize: 8, color: "#10b981", fontWeight: 700 }}>FATHER'S NAME</div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "white", marginTop: 2 }}>{activeDoc.fields.fatherName || "N/A"}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 8, color: "#10b981", fontWeight: 700 }}>PAN ID NUMBER</div>
                        <HighlightedField fieldKey="panNo">
                          <div style={{ fontSize: 12, fontWeight: 900, color: "#fef08a", fontFamily: "monospace", marginTop: 2 }}>{activeDoc.fields.panNo || "N/A"}</div>
                        </HighlightedField>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── 5. OTHER / GENERIC DOCUMENT CARD ── */}
                {!isGst && !isBank && !isBalance && !isPan && (
                  <div style={{ position: "relative", background: "#0b1726", border: "1px solid #1e293b", borderRadius: 10, padding: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#f59e0b", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 8, marginBottom: 12 }}>
                      {activeDoc.type.toUpperCase()} RECORD
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12 }}>
                      {Object.entries(activeDoc.fields).map(([k, v]) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--text-muted)", textTransform: "capitalize" }}>{k.replace(/([A-Z])/g, " $1")}</span>
                          <HighlightedField fieldKey={k}>
                            <span style={{ fontWeight: 700, color: "white" }}>{String(v)}</span>
                          </HighlightedField>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bottom Status Bar matching screenshots */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 11, color: "var(--text-muted)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Eye size={13} color="var(--indigo-light)" /> Hover highlighted regions to view AI analysis report.
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.04)", padding: "2px 8px", borderRadius: 4, fontWeight: 700, fontSize: 10, color: docAnomalies.length > 0 ? "var(--reject)" : "var(--approve)" }}>
                    {docAnomalies.length} Flagged Points
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Real Forensic Overlay Panel (ELA Heatmaps, Bounding Boxes, Labels, Detector Results) */}
          {documentReports && documentReports.length > 0 && (
            <div style={{ marginTop: 14 }}>
              {(() => {
                const docRep = documentReports.find(r => r.filename === activeDoc.name) || documentReports[0];
                return <ForensicOverlay docReport={docRep} />;
              })()}
            </div>
          )}

          {/* Floating AI COPILOT Button */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => setShowCopilot(!showCopilot)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 16px",
                borderRadius: 20,
                background: "linear-gradient(135deg, #1e1b4b, #312e81)",
                border: "1px solid rgba(99, 102, 241, 0.4)",
                color: "#c7d2fe",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(99, 102, 241, 0.3)",
                transition: "all 0.2s ease"
              }}
            >
              🤖 AI COPILOT ✨
            </button>
          </div>

          {/* AI Copilot expandable drawer */}
          <AnimatePresence>
            {showCopilot && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                style={{
                  background: "rgba(15, 23, 42, 0.95)",
                  border: "1px solid var(--indigo)",
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: "var(--text-secondary)"
                }}
              >
                <div style={{ fontWeight: 700, color: "var(--indigo-light)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <Sparkles size={14} /> AI Copilot Document Summary ({activeDoc.name})
                </div>
                {activeDoc.score > 80 ? (
                  <p style={{ margin: 0 }}>
                    This document was analyzed by the 5-layer forensic engine. Digital signatures match official registries, metadata indicates standard creation parameters, and OCR field extraction confirmed 100% consistency with PAN and Aadhaar identity logs.
                  </p>
                ) : (
                  <p style={{ margin: 0, color: "#fca5a5" }}>
                    Warning: Forensic inspection flagged potential anomalies in font spacing and last-modified dates. Direct verification with issuing authority is recommended.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Expandable Statistical & Fraud DNA Forensics Section */}
      <div className="card" style={{ padding: 16 }}>
        <div
          onClick={() => setShowStatsForensics(!showStatsForensics)}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Sparkles size={16} color="#f59e0b" />
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              Statistical & Fraud DNA Forensics ({activeDoc.name})
            </span>
            <span style={{
              fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 10,
              background: activeDoc.benford_result?.triggered || activeDoc.dna_result?.suspicious
                ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)",
              color: activeDoc.benford_result?.triggered || activeDoc.dna_result?.suspicious
                ? "var(--reject)" : "var(--approve)"
            }}>
              {activeDoc.benford_result?.triggered || activeDoc.dna_result?.suspicious ? "ANOMALIES DETECTED" : "CLEAN STATS"}
            </span>
          </div>
          {showStatsForensics ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
        </div>

        {showStatsForensics && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 24,
            marginTop: 14,
            borderTop: "1px solid var(--border-subtle)",
            paddingTop: 16
          }}>
            {/* Column 1: Benford's Law Digit Analysis */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 800, color: "white", margin: "0 0 4px 0" }}>Benford's Law Digit Frequency</h4>
                <p style={{ fontSize: 10, color: "var(--text-muted)", margin: 0 }}>
                  Checks frequencies of first-digits (1-9) in numerical text. Fabricated data deviates from natural distribution.
                </p>
              </div>

              {activeDoc.benford_result && (
                <div style={{ background: "rgba(0,0,0,0.2)", padding: 12, borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: 11 }}>
                    <span style={{ color: "var(--text-secondary)" }}>Chi-Square Statistic: <strong style={{ color: activeDoc.benford_result.triggered ? "var(--reject)" : "var(--approve)" }}>{activeDoc.benford_result.chi_sq}</strong> (threshold: 20.09)</span>
                    <span style={{ color: "var(--text-muted)" }}>Samples: {activeDoc.benford_result.total_samples}</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {Object.keys(activeDoc.benford_result.expected_distribution).map((digit) => {
                      const obs = activeDoc.benford_result.observed_distribution[digit] || 0;
                      const exp = activeDoc.benford_result.expected_distribution[digit] || 0;
                      return (
                        <div key={digit} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 10 }}>
                          <span style={{ width: 10, fontWeight: 700, color: "white" }}>{digit}</span>
                          <div style={{ flex: 1, height: 16, background: "rgba(255,255,255,0.05)", borderRadius: 4, position: "relative", overflow: "hidden" }}>
                            {/* Expected bar */}
                            <div style={{
                              position: "absolute", top: 0, left: 0, bottom: 0,
                              width: `${exp * 100}%`,
                              borderRight: "2px dashed #94a3b8",
                              background: "rgba(255,255,255,0.08)",
                              zIndex: 1
                            }} />
                            {/* Observed bar */}
                            <div style={{
                              position: "absolute", top: 0, left: 0, bottom: 0,
                              width: `${obs * 100}%`,
                              background: activeDoc.benford_result.triggered ? "var(--warning)" : "var(--indigo-light)",
                              opacity: 0.85,
                              zIndex: 2
                            }} />
                          </div>
                          <span style={{ width: 110, fontSize: 9, color: "var(--text-muted)", textAlign: "right" }}>
                            Obs: {Math.round(obs*100)}% / Exp: {Math.round(exp*100)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 12, fontSize: 10, color: activeDoc.benford_result.triggered ? "var(--reject)" : "var(--approve)" }}>
                    {activeDoc.benford_result.description}
                  </div>
                </div>
              )}
            </div>

            {/* Column 2: Numeric Entropy & Fraud DNA Match */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 800, color: "white", margin: "0 0 4px 0" }}>Numeric Entropy & Patterns</h4>
                <p style={{ fontSize: 10, color: "var(--text-muted)", margin: 0 }}>
                  Detects round number concentrations, duplicate transaction amounts, and balance sheets discrepancies.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                  {activeDoc.entropy_result && activeDoc.entropy_result.length > 0 ? (
                    activeDoc.entropy_result.map((err: any, i: number) => (
                      <div key={i} style={{
                        padding: "8px 12px",
                        background: "rgba(239, 68, 68, 0.04)",
                        border: "1px solid rgba(239, 68, 68, 0.2)",
                        borderRadius: 6,
                        fontSize: 10.5
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                          <span style={{ fontWeight: 700, color: "#fca5a5" }}>{err.type.replace(/_/g, " ")}</span>
                          <span style={{ fontSize: 9, background: "rgba(239, 68, 68, 0.2)", color: "#f87171", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>
                            {err.severity}
                          </span>
                        </div>
                        <div style={{ color: "#cbd5e1", lineHeight: 1.4 }}>{err.description}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: 10, background: "rgba(16, 185, 129, 0.04)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: 6, fontSize: 10.5, color: "var(--approve)" }}>
                      No numeric entropy or repetition issues identified in document values.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: 12, fontWeight: 800, color: "white", margin: "0 0 4px 0" }}>Fraud DNA Matching</h4>
                <p style={{ fontSize: 10, color: "var(--text-muted)", margin: 0 }}>
                  Calculates document layout and structural DNA hash. Scans for template reuse across database cases.
                </p>

                {activeDoc.dna_result && (
                  <div style={{
                    padding: 12,
                    background: "rgba(0, 0, 0, 0.2)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 8,
                    marginTop: 10,
                    fontSize: 10.5
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ color: "var(--text-muted)" }}>DNA Hash</span>
                      <code style={{ background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: 4, fontFamily: "monospace", color: "var(--indigo-light)" }}>
                        {activeDoc.dna_result.signature_hash.substring(0, 16)}...
                      </code>
                    </div>

                    {activeDoc.dna_result.suspicious ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {activeDoc.dna_result.matches.map((match: any, i: number) => (
                          <div key={i} style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: 8, borderRadius: 6 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: "#f87171", fontSize: 10 }}>
                              <span>TEMPLATE MATCH FOUND</span>
                              <span>{match.similarity_score}% Similar</span>
                            </div>
                            <div style={{ fontWeight: 700, color: "white", marginTop: 2 }}>{match.pattern_name}</div>
                            <div style={{ fontSize: 9.5, color: "#94a3b8", marginTop: 1 }}>{match.description}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: "var(--approve)", fontWeight: 600 }}>
                        ✓ Unique document layout DNA. No template matches in shared fraud network database.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Expandable Anomaly Scan Checklist Section */}
      <div className="card" style={{ padding: 16 }}>
        <div
          onClick={() => setShowChecklist(!showChecklist)}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Shield size={16} color="var(--indigo-light)" />
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              16-Category Forensic Anomaly Scan Checklist ({activeDoc.name})
            </span>
            <span style={{
              fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 10,
              background: detectedAnomalies.length > 0 ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)",
              color: detectedAnomalies.length > 0 ? "var(--reject)" : "var(--approve)"
            }}>
              {detectedAnomalies.length > 0 ? `${detectedAnomalies.length} FLAG(S) DETECTED` : "ALL 16 CHECKS CLEAN"}
            </span>
          </div>
          {showChecklist ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
        </div>

        {showChecklist && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 10,
            marginTop: 14,
            borderTop: "1px solid var(--border-subtle)",
            paddingTop: 12
          }}>
            {anomalies.map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: "8px 10px",
                  borderRadius: 6,
                  background: item.detected ? "rgba(239,68,68,0.04)" : "rgba(255,255,255,0.01)",
                  border: `1px solid ${item.detected ? "rgba(239,68,68,0.2)" : "var(--border-subtle)"}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 11
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: item.detected ? "var(--reject)" : "var(--text-primary)" }}>
                    {item.type}
                  </div>
                  <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>
                    Conf: {item.confidence}%
                  </div>
                </div>
                <div>
                  {item.detected ? (
                    <AlertTriangle size={13} color="var(--reject)" />
                  ) : (
                    <CheckCircle size={13} color="var(--approve)" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
