import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Download, FileText, Clock, RefreshCw,
  Sliders, ShieldAlert, Layers, ShieldCheck, Activity
} from "lucide-react";
import { casesApi, reportsApi, type Case, type AnalysisResult } from "../api/client";

// Import custom engine components
import AnomalyPanel from "../components/AnomalyPanel";
import ConsistencyEngine from "../components/ConsistencyEngine";
import FraudEngine from "../components/FraudEngine";
import CreditRiskEngine from "../components/CreditRiskEngine";
import AIDecision from "../components/AIDecision";
import AIChat from "../components/AIChat";
import WhatIfSimulator from "../components/WhatIfSimulator";

import { generateDocIntegrity } from "../api/mockData";

interface Props {
  caseId: string;
  onBack: () => void;
}

// ── Score Ring ─────────────────────────────────────────────────────────
function ScoreRing({ score, label, color, size = 120 }: { score: number; label: string; color: string; size?: number }) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ position: "relative", width: size, height: size, margin: "0 auto" }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
          <motion.circle
            cx={size/2} cy={size/2} r={r}
            fill="none" stroke={color} strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ fontSize: size > 100 ? 22 : 16, fontWeight: 800, color }}>{score.toFixed(0)}%</div>
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textAlign: "center" }}>
        {label}
      </div>
    </div>
  );
}



// ── Document Integrity Card ──────────────────────────────────────────
function DocIntegrityCard({ docType, seed }: { docType: string; seed: number }) {
  const [data] = useState(() => generateDocIntegrity(docType, seed));
  const [expanded, setExpanded] = useState(false);

  const getStatusColor = (status: string) => {
    return status === "PASS" ? "var(--approve)" : status === "WARN" ? "var(--hold)" : "var(--reject)";
  };

  const getStatusIcon = (status: string) => {
    return status === "PASS" ? "✅" : status === "WARN" ? "⚠️" : "❌";
  };

  const scoreColor = data.overallScore > 75 ? "var(--approve)" : data.overallScore > 50 ? "var(--hold)" : "var(--reject)";

  return (
    <div className="card" style={{ marginBottom: 12, padding: 14 }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <FileText size={18} color="var(--indigo-light)" />
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, textTransform: "capitalize" }}>
              {docType.replace(/_/g, " ")} Integrity Verification
            </span>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
              Authenticity score: <strong style={{ color: scoreColor }}>{data.overallScore}%</strong>
            </div>
          </div>
        </div>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{expanded ? "Hide Details ▲" : "Show Details ▼"}</span>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}
          >
            {data.checks.map((check, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  fontSize: 11, padding: "8px 10px", background: "rgba(255,255,255,0.01)",
                  border: "1px solid var(--border-subtle)", borderRadius: 6
                }}
              >
                <div>
                  <span style={{ marginRight: 6 }}>{getStatusIcon(check.status)}</span>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{check.name}</span>
                  <p style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2, margin: 0 }}>
                    {check.detail}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: getStatusColor(check.status) }}>{check.status}</span>
                  <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>Conf: {check.confidence}%</div>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Audit Timeline ────────────────────────────────────────────────────
function AuditTimeline({
  analysis,
  caseData,
  onUpdateVerdict
}: {
  analysis: AnalysisResult;
  caseData: Case;
  onUpdateVerdict: (verdict: string, notes: string) => Promise<void>;
}) {
  const isReviewed = caseData.status === "REVIEWED";
  const finalVerdict = caseData.verdict || analysis.verdict;
  const [note, setNote] = useState(caseData.verdict_notes || "");

  // Update note when caseData changes
  useEffect(() => {
    setNote(caseData.verdict_notes || "");
  }, [caseData.verdict_notes]);

  const reviewDetail = isReviewed
    ? `Verdict updated to ${finalVerdict} (Notes: "${caseData.verdict_notes || 'Confirmed by Underwriter'}")`
    : "Awaiting human decision";

  const steps = [
    { label: "Documents Uploaded", detail: `${analysis.document_reports.length} document(s)`, done: true, color: "var(--approve)" },
    { label: "Layer 1: Document Forensics", detail: `Authenticity: ${analysis.authenticity_score.toFixed(1)}%`, done: true, color: analysis.authenticity_score > 70 ? "var(--approve)" : "var(--hold)" },
    { label: "Layer 2: Cross-Document Validation", detail: `Consistency: ${analysis.consistency_score.toFixed(1)}%`, done: true, color: analysis.consistency_score > 70 ? "var(--approve)" : "var(--hold)" },
    { label: "Layer 3: Relationship Intelligence", detail: `Relationship Risk: ${analysis.relationship_risk_score.toFixed(1)}%`, done: true, color: analysis.relationship_risk_score < 30 ? "var(--approve)" : "var(--hold)" },
    { label: "Layer 4: AI Risk Engine", detail: `Overall: ${analysis.overall_score.toFixed(1)}% — ${analysis.verdict}`, done: true, color: analysis.verdict === "APPROVE" ? "var(--approve)" : analysis.verdict === "HOLD" ? "var(--hold)" : "var(--reject)" },
    {
      label: "Underwriter Review Required",
      detail: reviewDetail,
      done: isReviewed,
      color: isReviewed
        ? (finalVerdict === "APPROVE" ? "var(--approve)" : finalVerdict === "HOLD" ? "var(--hold)" : "var(--reject)")
        : "var(--indigo)"
    },
  ];

  return (
    <div>
      {steps.map((step, i) => (
        <div key={i} style={{ display: "flex", gap: 14, marginBottom: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%",
              background: step.done ? step.color : "transparent",
              border: `2px solid ${step.color}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: "white",
              flexShrink: 0,
            }}>
              {step.done ? "✓" : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: 2, flex: 1, background: "var(--border-subtle)", minHeight: 24, margin: "4px 0" }} />
            )}
          </div>
          <div style={{ paddingBottom: i < steps.length - 1 ? 16 : 0, flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{step.label}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{step.detail}</div>
            {i === 5 && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10, maxWidth: 450 }}>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add underwriting decision notes..."
                  style={{
                    width: "100%",
                    minHeight: 60,
                    padding: "8px 12px",
                    fontSize: 12,
                    borderRadius: 6,
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-primary)",
                    resize: "vertical"
                  }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => onUpdateVerdict("APPROVE", note || "Approved by Underwriter")}
                    className="btn btn-sm"
                    style={{
                      fontSize: 11,
                      padding: "5px 12px",
                      borderRadius: "6px",
                      background: caseData.verdict === "APPROVE" && isReviewed ? "var(--approve)" : "rgba(16,185,129,0.06)",
                      color: caseData.verdict === "APPROVE" && isReviewed ? "white" : "var(--approve)",
                      border: "1px solid rgba(16,185,129,0.3)",
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    🟢 Approve
                  </button>
                  <button
                    onClick={() => onUpdateVerdict("HOLD", note || "Placed on Hold by Underwriter")}
                    className="btn btn-sm"
                    style={{
                      fontSize: 11,
                      padding: "5px 12px",
                      borderRadius: "6px",
                      background: caseData.verdict === "HOLD" && isReviewed ? "var(--hold)" : "rgba(245,158,11,0.06)",
                      color: caseData.verdict === "HOLD" && isReviewed ? "white" : "var(--hold)",
                      border: "1px solid rgba(245,158,11,0.3)",
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    🟡 Hold
                  </button>
                  <button
                    onClick={() => onUpdateVerdict("REJECT", note || "Rejected by Underwriter")}
                    className="btn btn-sm"
                    style={{
                      fontSize: 11,
                      padding: "5px 12px",
                      borderRadius: "6px",
                      background: caseData.verdict === "REJECT" && isReviewed ? "var(--reject)" : "rgba(239,68,68,0.06)",
                      color: caseData.verdict === "REJECT" && isReviewed ? "white" : "var(--reject)",
                      border: "1px solid rgba(239,68,68,0.3)",
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    🔴 Reject
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CaseReport({ caseId, onBack }: Props) {
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "integrity" | "consistency" | "fraud" | "risk" | "timeline" | "reports" | "simulation">("overview");

  // Determine a stable numeric seed for the case ID string to generate consistent mock data
  const seedVal = caseId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

  const load = async () => {
    setLoading(true);
    try {
      const c = await casesApi.get(caseId);
      setCaseData(c);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [caseId]);

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try { await reportsApi.downloadPdf(caseId); }
    finally { setDownloading(false); }
  };

  const handleUpdateVerdict = async (verdict: string, notes: string) => {
    try {
      const updated = await casesApi.updateVerdict(caseId, verdict, notes);
      setCaseData(updated);
    } catch (e) {
      console.error("Failed to update verdict:", e);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 100 }}>
        <div className="spinner" style={{ margin: "0 auto 16px" }} />
        <div style={{ color: "var(--text-muted)" }}>Loading forensic report dossier…</div>
      </div>
    );
  }

  if (!caseData) return <div>Case details not found.</div>;

  const analysis = caseData.analysis;
  const verdict = caseData.status === "REVIEWED" ? caseData.verdict : (analysis?.verdict || caseData.verdict);
  const verdictColors: Record<string, string> = {
    APPROVE: "var(--approve)", HOLD: "var(--hold)", REJECT: "var(--reject)"
  };
  const vColor = verdictColors[verdict || ""] || "var(--text-muted)";

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button className="btn btn-ghost btn-sm" onClick={onBack}>
            <ArrowLeft size={15} /> Back
          </button>
          <div>
            <h1 className="page-title" style={{ fontSize: 20, margin: 0 }}>{caseData.applicant_name}</h1>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, fontFamily: "var(--font-mono)" }}>
              {caseId} · {caseData.loan_type} · ₹{(caseData.loan_amount / 100000).toFixed(1)}L · {caseData.branch}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost btn-sm" onClick={load}>
            <RefreshCw size={14} />
          </button>
          {analysis && (
            <button className="btn btn-primary btn-sm" onClick={handleDownloadPdf} disabled={downloading}>
              {downloading ? <div className="spinner" /> : <Download size={14} />}
              Export PDF Report
            </button>
          )}
        </div>
      </div>

      {/* Verdict banner */}
      {verdict && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: "16px 24px",
            borderRadius: "var(--radius-lg)",
            background: `${vColor}15`,
            border: `1px solid ${vColor}44`,
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: vColor }}>
              ⚡ {verdict}
            </div>
            {analysis && (
              <div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  Underwriter Confidence: <strong style={{ color: "var(--text-primary)" }}>{analysis.confidence}</strong>
                  {" · "}Composite Score: <strong style={{ color: vColor }}>{analysis.overall_score.toFixed(1)}%</strong>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {analysis.high_severity_count} HIGH · {analysis.medium_severity_count} MEDIUM anomalies detected
                </div>
              </div>
            )}
          </div>
          {analysis && (
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--reject)" }}>
              ₹{(caseData.loan_amount / 100000).toFixed(1)}L exposure
            </div>
          )}
        </motion.div>
      )}

      {!analysis ? (
        <div className="card" style={{ textAlign: "center", padding: 60 }}>
          <Clock size={40} color="var(--text-muted)" style={{ margin: "0 auto 16px" }} />
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Forensic analysis pending</div>
          <div style={{ color: "var(--text-muted)" }}>This case requires document uploads to trigger the verification pipeline.</div>
        </div>
      ) : (
        <>
          {/* Main Navigation Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 0, overflowX: "auto" }}>
            {[
              { id: "overview", label: "Executive Decision", icon: ShieldCheck },
              { id: "integrity", label: "Document Integrity", icon: FileText },
              { id: "consistency", label: "Cross-Doc Consistency", icon: Layers },
              { id: "fraud", label: "Fraud Intelligence", icon: ShieldAlert },
              { id: "risk", label: "Credit Risk Models", icon: Activity },
              { id: "simulation", label: "What-If Simulator", icon: Sliders },
              { id: "timeline", label: "Event Timeline", icon: Clock },
              { id: "reports", label: "Reports Center", icon: Download }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    padding: "10px 14px",
                    background: "transparent",
                    border: "none",
                    borderBottom: activeTab === tab.id ? "2px solid var(--indigo)" : "2px solid transparent",
                    color: activeTab === tab.id ? "var(--indigo-light)" : "var(--text-muted)",
                    fontWeight: activeTab === tab.id ? 700 : 500,
                    fontSize: 13,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    whiteSpace: "nowrap"
                  }}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Dynamic Content */}
          <div style={{ marginBottom: 40 }}>
            {activeTab === "overview" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {/* Score Summary grid */}
                <div className="grid-3">
                  <div className="card" style={{ textAlign: "center", padding: 20 }}>
                    <ScoreRing score={analysis.authenticity_score} label="Document Authenticity" color={analysis.authenticity_score > 70 ? "var(--approve)" : "var(--reject)"} />
                  </div>
                  <div className="card" style={{ textAlign: "center", padding: 20 }}>
                    <ScoreRing score={analysis.consistency_score} label="Cross-Doc Integrity" color={analysis.consistency_score > 70 ? "var(--approve)" : "var(--hold)"} />
                  </div>
                  <div className="card" style={{ textAlign: "center", padding: 20 }}>
                    <ScoreRing score={100 - analysis.relationship_risk_score} label="Relationship Safety" color={analysis.relationship_risk_score > 40 ? "var(--reject)" : "var(--approve)"} />
                  </div>
                </div>

                {/* Final Underwriting Decision */}
                <AIDecision seed={seedVal} />
              </div>
            )}

            {activeTab === "integrity" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 24, alignItems: "flex-start" }}>
                {/* Left checklist of documents */}
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: "var(--text-secondary)" }}>Verifying Document Integrity (7 Categories)</span>
                  {["pan", "aadhaar", "gst", "bank_statement", "financial_statement", "land_record", "legal_document"].map((doc) => (
                    <DocIntegrityCard key={doc} docType={doc} seed={seedVal} />
                  ))}
                </div>

                {/* Right Anomaly checklist viewer */}
                <div className="card">
                  <AnomalyPanel seed={seedVal} filename="Package_Upload_Batch_1.zip" />
                </div>
              </div>
            )}

            {activeTab === "consistency" && (
              <ConsistencyEngine seed={seedVal} />
            )}

            {activeTab === "fraud" && (
              <FraudEngine seed={seedVal} />
            )}

            {activeTab === "risk" && (
              <CreditRiskEngine seed={seedVal} />
            )}

            {activeTab === "simulation" && (
              <WhatIfSimulator initialAmount={caseData.loan_amount} />
            )}

            {activeTab === "timeline" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div className="card">
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>🕐 Investigation Pipeline Logs</div>
                  <AuditTimeline
                    analysis={analysis}
                    caseData={caseData}
                    onUpdateVerdict={handleUpdateVerdict}
                  />
                </div>

                {analysis.timeline && analysis.timeline.length > 0 && (
                  <div className="card">
                    <span style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      📅 Chronological Event Timeline
                    </span>
                    <p style={{ color: "var(--text-secondary)", fontSize: 12, marginBottom: 24 }}>
                      Visual verification of document issue dates relative to the applicant's Date of Birth (DOB).
                    </p>
                    <div style={{ position: "relative", paddingLeft: 24, borderLeft: "2px solid var(--border-subtle)", marginLeft: 8 }}>
                      {analysis.timeline.map((event: any, i: number) => {
                        const isDOB = event.type === "dob";
                        const isCase = event.type === "case_created";
                        const circleColor = isDOB ? "var(--approve)" : (isCase ? "var(--indigo)" : "var(--hold)");

                        return (
                          <div key={i} style={{ position: "relative", marginBottom: 24 }}>
                            <div style={{
                              position: "absolute", left: -31, top: 2, width: 12, height: 12,
                              borderRadius: "50%", background: "var(--bg-surface)", border: `3px solid ${circleColor}`,
                            }} />
                            <div>
                              <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                                <span className="text-mono" style={{ fontWeight: 700, fontSize: 13, color: circleColor }}>{event.date}</span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{event.label}</span>
                              </div>
                              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                                Source: <span className="text-mono">{event.filename}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "reports" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <span style={{ fontSize: 13, fontWeight: 700, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 10 }}>
                  Downloadable Forensic Dossiers & Reports
                </span>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: 16
                }}>
                  {[
                    { title: "Credit Risk Report", desc: "Detailed breakdown of the 5 Credit Risk Engines", type: "PDF" },
                    { title: "Fraud Investigation Report", desc: "Detailed breakdown of 11 fraud check categories", type: "PDF" },
                    { title: "Financial Analysis Report", desc: "Balance sheet ratios, working capital cycles & DSCR profiles", type: "PDF" },
                    { title: "GST Audit Analysis", desc: "Integrity verify log of filed sales vs bank deposits", type: "PDF" },
                    { title: "Banking Cash flow Report", desc: "AMB stability metrics and suspicious transaction alerts", type: "PDF" },
                    { title: "Underwriting Digest", desc: "Consolidated loan terms, covenants & mitigate summaries", type: "PDF" },
                    { title: "AI Explainability Summary", desc: "Plain-language underwriting rationale logs", type: "PDF" },
                    { title: "Executive Risk Dossier", desc: "High-level risk heatmap summary for Credit Committee", type: "PDF" },
                  ].map((report, i) => (
                    <div key={i} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 14 }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{report.title}</span>
                        <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4, margin: 0 }}>{report.desc}</p>
                      </div>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: "8px 10px", flexShrink: 0 }}
                        onClick={() => alert(`Generating and downloading: ${report.title}`)}
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Floating AI chat assistant bubble */}
          <AIChat seed={seedVal} />
        </>
      )}
    </div>
  );
}
