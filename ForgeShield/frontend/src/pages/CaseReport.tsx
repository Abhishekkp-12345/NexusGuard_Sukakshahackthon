import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Download,
  FileText, Brain, Clock, RefreshCw, Eye
} from "lucide-react";
import { casesApi, reportsApi, type Case, type AnalysisResult, type Finding } from "../api/client";

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

// ── Finding Card ──────────────────────────────────────────────────────
function FindingCard({ finding }: { finding: Finding }) {
  const [expanded, setExpanded] = useState(false);
  const severityClass = finding.severity.toLowerCase();


  return (
    <motion.div
      className="card"
      style={{ padding: 16, marginBottom: 10, cursor: "pointer" }}
      onClick={() => setExpanded(!expanded)}
      whileHover={{ borderColor: "var(--border-default)" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span className={`severity-badge ${severityClass}`}>{finding.severity}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
            {finding.type.replace(/_/g, " ")}
          </div>
          {finding.document && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
              📄 {finding.document}
            </div>
          )}
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7, marginTop: 8, whiteSpace: "pre-line" }}
            >
              {finding.detail}
            </motion.div>
          )}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0 }}>
          {expanded ? "▲" : "▼"}
        </div>
      </div>
    </motion.div>
  );
}

// ── ELA Heatmap ───────────────────────────────────────────────────────
function ELAHeatmap({ heatmap_b64, tamper_score, filename }: { heatmap_b64: string; tamper_score: number; filename: string }) {
  const [show, setShow] = useState(false);
  if (!heatmap_b64) return null;

  return (
    <div className="card" style={{ padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>ELA Heatmap — {filename}</div>
          <div style={{ fontSize: 12, color: tamper_score > 30 ? "var(--reject)" : "var(--approve)", marginTop: 2 }}>
            Tamper Probability: {tamper_score.toFixed(1)}%
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShow(!show)}>
          <Eye size={14} /> {show ? "Hide" : "View"} Heatmap
        </button>
      </div>
      {show && (
        <motion.img
          src={`data:image/png;base64,${heatmap_b64}`}
          alt="ELA Heatmap"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border-subtle)" }}
        />
      )}
    </div>
  );
}

// ── AI Recommendation Parser & Panel ───────────────────────────────────
function parseBold(text: string): React.ReactNode[] {
  const regex = /\*\*(.*?)\*\*/g;
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }
    result.push(
      <strong key={match.index} style={{ fontWeight: 700, color: "var(--text-primary)" }}>
        {match[1]}
      </strong>
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result.length > 0 ? result : [text];
}

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  return lines.map((line, idx) => {
    // Check for headings
    if (line.startsWith("### ")) {
      return (
        <h4 key={idx} style={{
          fontSize: 13,
          fontWeight: 700,
          marginTop: 18,
          marginBottom: 8,
          color: "var(--text-primary)",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          opacity: 0.9,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          paddingBottom: 4
        }}>
          {parseBold(line.slice(4))}
        </h4>
      );
    } else if (line.startsWith("## ")) {
      return (
        <h3 key={idx} style={{
          fontSize: 14,
          fontWeight: 700,
          marginTop: 20,
          marginBottom: 8,
          color: "var(--text-primary)"
        }}>
          {parseBold(line.slice(3))}
        </h3>
      );
    } else if (line.startsWith("# ")) {
      return (
        <h2 key={idx} style={{
          fontSize: 16,
          fontWeight: 700,
          marginTop: 22,
          marginBottom: 10,
          color: "var(--text-primary)"
        }}>
          {parseBold(line.slice(2))}
        </h2>
      );
    }

    // Check for list items (like "1. Item" or "1. **Item**")
    const matchNumbered = line.match(/^(\d+)\.\s(.*)/);
    if (matchNumbered) {
      const num = matchNumbered[1];
      const rest = matchNumbered[2];
      return (
        <div key={idx} style={{ display: "flex", gap: 8, marginLeft: 8, marginBottom: 8, alignItems: "flex-start" }}>
          <span style={{ fontWeight: 700, color: "var(--indigo-light)", minWidth: 16 }}>{num}.</span>
          <div style={{ flex: 1, fontSize: 13.5, lineHeight: 1.6, color: "var(--text-secondary)" }}>
            {parseBold(rest)}
          </div>
        </div>
      );
    }

    const matchBullet = line.match(/^([*\-•])\s(.*)/);
    if (matchBullet) {
      const rest = matchBullet[2];
      return (
        <div key={idx} style={{ display: "flex", gap: 8, marginLeft: 8, marginBottom: 8, alignItems: "flex-start" }}>
          <span style={{ color: "var(--indigo-light)", fontWeight: 700, minWidth: 16 }}>•</span>
          <div style={{ flex: 1, fontSize: 13.5, lineHeight: 1.6, color: "var(--text-secondary)" }}>
            {parseBold(rest)}
          </div>
        </div>
      );
    }

    // Regular line
    if (line.trim() === "") {
      return <div key={idx} style={{ height: 10 }} />;
    }

    return (
      <div key={idx} style={{
        fontSize: 13.5,
        lineHeight: 1.6,
        color: "var(--text-secondary)",
        marginBottom: 8
      }}>
        {parseBold(line)}
      </div>
    );
  });
}

function AIRecommendation({ text, verdict }: { text: string; verdict: string }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      if (i <= text.length) {
        setDisplayed(text.slice(0, i));
        i += 3;
      } else {
        setDone(true);
        clearInterval(interval);
      }
    }, 20);
    return () => clearInterval(interval);
  }, [text]);

  const verdictColors: Record<string, string> = {
    APPROVE: "var(--approve)", HOLD: "var(--hold)", REJECT: "var(--reject)"
  };

  return (
    <div className="card" style={{
      border: `1px solid ${verdictColors[verdict] || "var(--border-subtle)"}33`,
      background: `${verdictColors[verdict] || "transparent"}08`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: "rgba(99,102,241,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Brain size={18} color="var(--indigo-light)" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>AI Recommendation</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Generated by Ollama gemma4 — 100% Offline</div>
        </div>
      </div>
      <div style={{
        lineHeight: 1.8,
      }} className={!done ? "typing-cursor" : ""}>
        {renderMarkdown(displayed)}
      </div>
    </div>
  );
}

function RawOcrInspector({ rawLines }: { rawLines: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-md)",
      overflow: "hidden",
      marginTop: 10
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          padding: "10px 14px",
          background: "var(--bg-surface)",
          border: "none",
          textAlign: "left",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontWeight: 600,
          fontSize: 12,
          color: "var(--text-secondary)",
          cursor: "pointer",
        }}
      >
        <span>📝 View Raw OCR Lines</span>
        <span style={{ fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{
          padding: 12,
          background: "rgba(0,0,0,0.2)",
          maxHeight: 250,
          overflowY: "auto",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          lineHeight: 1.5,
          color: "var(--text-muted)",
          whiteSpace: "pre-wrap",
          borderTop: "1px solid var(--border-subtle)"
        }}>
          {rawLines.map((line, idx) => (
            <div key={idx} style={{ padding: "2px 0", borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
              <span style={{ color: "rgba(255,255,255,0.15)", marginRight: 8, display: "inline-block", width: 24, textAlign: "right" }}>{idx + 1}</span>
              {line}
            </div>
          ))}
        </div>
      )}
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
        <div key={i} style={{ display: "flex", gap: 14, marginBottom: i < steps.length - 1 ? 0 : 0 }}>
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

// ── Main Page ──────────────────────────────────────────────────────────
export default function CaseReport({ caseId, onBack }: Props) {
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "findings" | "documents" | "timeline">("overview");

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
        <div style={{ color: "var(--text-muted)" }}>Loading case report…</div>
      </div>
    );
  }

  if (!caseData) return <div>Case not found.</div>;

  const analysis = caseData.analysis;
  const verdict = caseData.status === "REVIEWED" ? caseData.verdict : (analysis?.verdict || caseData.verdict);
  const verdictColors: Record<string, string> = {
    APPROVE: "var(--approve)", HOLD: "var(--hold)", REJECT: "var(--reject)"
  };
  const vColor = verdictColors[verdict || ""] || "var(--text-muted)";

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button className="btn btn-ghost btn-sm" onClick={onBack}>
            <ArrowLeft size={15} /> Back
          </button>
          <div>
            <h1 className="page-title" style={{ fontSize: 22 }}>{caseData.applicant_name}</h1>
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
              Download PDF Report
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
            <div style={{ fontSize: 28, fontWeight: 900, color: vColor }}>
              ⚡ {verdict}
            </div>
            {analysis && (
              <div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  Confidence: <strong style={{ color: "var(--text-primary)" }}>{analysis.confidence}</strong>
                  {" · "}Overall Score: <strong style={{ color: vColor }}>{analysis.overall_score.toFixed(1)}%</strong>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {analysis.high_severity_count} HIGH · {analysis.medium_severity_count} MEDIUM findings
                  · Processed in {(analysis.elapsed_ms / 1000).toFixed(1)}s
                </div>
              </div>
            )}
          </div>
          {analysis && (
            <div style={{ fontWeight: 700, fontSize: 18, color: "var(--reject)" }}>
              ₹{(caseData.loan_amount / 100000).toFixed(1)}L at risk
            </div>
          )}
        </motion.div>
      )}

      {!analysis ? (
        <div className="card" style={{ textAlign: "center", padding: 60 }}>
          <Clock size={40} color="var(--text-muted)" style={{ margin: "0 auto 16px" }} />
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Analysis Pending</div>
          <div style={{ color: "var(--text-muted)" }}>Documents not yet uploaded for this case.</div>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 0 }}>
            {(["overview", "findings", "documents", "timeline"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "10px 18px",
                  background: "transparent",
                  border: "none",
                  borderBottom: activeTab === tab ? "2px solid var(--indigo)" : "2px solid transparent",
                  color: activeTab === tab ? "var(--indigo-light)" : "var(--text-muted)",
                  fontWeight: activeTab === tab ? 600 : 400,
                  fontSize: 14,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  textTransform: "capitalize",
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Overview tab */}
          {activeTab === "overview" && (
            <div>
              {/* Score cards */}
              <div className="grid-3" style={{ marginBottom: 24 }}>
                <div className="card" style={{ textAlign: "center", padding: 24 }}>
                  <ScoreRing
                    score={analysis.authenticity_score}
                    label="Document Authenticity"
                    color={analysis.authenticity_score > 70 ? "var(--approve)" : "var(--reject)"}
                  />
                  <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)" }}>Weight: 35%</div>
                </div>
                <div className="card" style={{ textAlign: "center", padding: 24 }}>
                  <ScoreRing
                    score={analysis.consistency_score}
                    label="Cross-Doc Consistency"
                    color={analysis.consistency_score > 70 ? "var(--approve)" : "var(--hold)"}
                  />
                  <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)" }}>Weight: 40%</div>
                </div>
                <div className="card" style={{ textAlign: "center", padding: 24 }}>
                  <ScoreRing
                    score={analysis.relationship_risk_score}
                    label="Relationship Risk"
                    color={analysis.relationship_risk_score > 40 ? "var(--reject)" : "var(--approve)"}
                  />
                  <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)" }}>Weight: 25% (inverted)</div>
                </div>
              </div>

              {/* AI Recommendation */}
              <div style={{ marginBottom: 24 }}>
                <AIRecommendation text={analysis.ai_recommendation} verdict={analysis.verdict} />
              </div>

              {/* Top findings preview */}
              {analysis.all_findings.filter(f => f.severity === "HIGH").length > 0 && (
                <div>
                  <div className="section-title">⚠️ High Severity Findings</div>
                  {analysis.all_findings.filter(f => f.severity === "HIGH").slice(0, 3).map((f, i) => (
                    <FindingCard key={i} finding={f} />
                  ))}
                  {analysis.all_findings.filter(f => f.severity === "HIGH").length > 3 && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab("findings")}>
                      View all findings →
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Findings tab */}
          {activeTab === "findings" && (
            <div>
              {analysis.all_findings.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: 48 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--approve)" }}>🟢 No Risk Findings</div>
                  <div style={{ color: "var(--text-muted)", fontSize: 13 }}>This application has clean document metrics and no flags.</div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                    {["HIGH", "MEDIUM", "LOW", "INFO"].map(s => {
                      const count = analysis.all_findings.filter(f => f.severity === s).length;
                      return count > 0 ? (
                        <span key={s} className={`severity-badge ${s.toLowerCase()}`} style={{ fontSize: 12, padding: "4px 10px" }}>
                          {s}: {count}
                        </span>
                      ) : null;
                    })}
                  </div>
                  {analysis.all_findings.map((f, i) => (
                    <FindingCard key={i} finding={f} />
                  ))}
                </>
              )}
            </div>
          )}

          {/* Documents tab */}
          {activeTab === "documents" && (
            <div>
              {analysis.document_reports.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: 48 }}>
                  <FileText size={32} color="var(--text-muted)" style={{ margin: "0 auto 12px" }} />
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No Document Reports</div>
                  <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No document analysis records are available for this case.</div>
                </div>
              ) : (
                analysis.document_reports.map((doc, i) => (
                  <div key={i} className="card" style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                      <FileText size={20} color="var(--indigo-light)" />
                      <div>
                        <div style={{ fontWeight: 700 }}>{doc.filename}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          Type: {doc.type.replace(/_/g, " ").toUpperCase()} · Auth Score: {doc.authenticity_score.toFixed(1)}%
                        </div>
                      </div>
                      <div style={{ marginLeft: "auto" }}>
                        <div className={`verdict-badge ${doc.authenticity_score > 70 ? "approve" : "hold"}`}>
                          {doc.authenticity_score > 70 ? "CLEAN" : "SUSPECT"}
                        </div>
                      </div>
                    </div>

                    {/* ELA heatmap */}
                    {doc.ela_result?.heatmap_b64 && (
                      <ELAHeatmap
                        heatmap_b64={doc.ela_result.heatmap_b64}
                        tamper_score={doc.ela_result.tamper_score}
                        filename={doc.filename}
                      />
                    )}

                    {/* PDF Metadata */}
                    {doc.pdf_forensics?.metadata && 
                     Object.values(doc.pdf_forensics.metadata).some(v => v !== null && v !== undefined && (!Array.isArray(v) || v.length > 0)) && (
                      <div style={{
                        padding: 14, borderRadius: "var(--radius-md)",
                        background: "var(--bg-surface)", marginTop: 12,
                      }}>
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>📋 PDF Metadata</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
                          {Object.entries(doc.pdf_forensics.metadata).map(([k, v]) => {
                            if (v === null || v === undefined) return null;
                            if (Array.isArray(v) && v.length === 0) return null;
                            
                            const label = k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                            let valStr = "";
                            if (Array.isArray(v)) {
                              valStr = v.join(", ");
                            } else {
                              valStr = String(v);
                            }
                            
                            return (
                              <div key={k} style={{ fontSize: 12 }}>
                                <span style={{ color: "var(--text-muted)" }}>{label}: </span>
                                <span className="text-mono">{valStr.slice(0, 50)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Extracted Predictions */}
                    {doc.extracted_fields && Object.keys(doc.extracted_fields).length > 0 && (
                      <div style={{
                        padding: 14, borderRadius: "var(--radius-md)",
                        background: "var(--bg-surface)", marginTop: 12,
                      }}>
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>🔍 Extracted Predictions</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
                          {Object.entries(doc.extracted_fields).map(([k, v]) => {
                            if (v === null || v === undefined || (Array.isArray(v) && v.length === 0)) return null;
                            
                            const label = k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                            let valStr = "";
                            if (Array.isArray(v)) {
                              valStr = v.slice(0, 5).join(", ");
                            } else if (typeof v === "object") {
                              valStr = JSON.stringify(v);
                            } else if (typeof v === "number" && k.toLowerCase().includes("income")) {
                              valStr = `₹${v.toLocaleString("en-IN")}`;
                            } else {
                              valStr = String(v);
                            }
                            
                            // Skip raw dumps like raw_lines or full_text
                            if (k === "raw_lines" || k === "full_text" || valStr.length > 100) return null;
                            
                            return (
                              <div key={k} style={{ fontSize: 12 }}>
                                <span style={{ color: "var(--text-muted)" }}>{label}: </span>
                                <span className="text-mono">{valStr}</span>
                              </div>
                            );
                          })}
                        </div>
                    {/* Raw OCR Text Toggle */}
                    {doc.extracted_fields?.raw_lines && doc.extracted_fields.raw_lines.length > 0 && (
                      <RawOcrInspector rawLines={doc.extracted_fields.raw_lines} />
                    )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Timeline tab */}
          {activeTab === "timeline" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div className="card">
                <div className="section-title" style={{ marginBottom: 16 }}>🕐 Investigation Pipeline</div>
                <AuditTimeline 
                  analysis={analysis} 
                  caseData={caseData} 
                  onUpdateVerdict={handleUpdateVerdict} 
                />
              </div>

              {analysis.timeline && analysis.timeline.length > 0 && (
                <div className="card">
                  <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    📅 Chronological Event Timeline
                  </div>
                  <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24 }}>
                    Visual verification of document issue dates relative to the applicant's Date of Birth (DOB).
                  </p>
                  <div style={{ position: "relative", paddingLeft: 24, borderLeft: "2px solid var(--border-subtle)", marginLeft: 8 }}>
                    {analysis.timeline.map((event: any, i: number) => {
                      const isDOB = event.type === "dob";
                      const isCase = event.type === "case_created";
                      const circleColor = isDOB ? "var(--approve)" : (isCase ? "var(--indigo)" : "var(--hold)");
                      
                      return (
                        <div key={i} style={{ position: "relative", marginBottom: 24 }}>
                          {/* Timeline Dot */}
                          <div style={{
                            position: "absolute",
                            left: -31,
                            top: 2,
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            background: "var(--bg-surface)",
                            border: `3px solid ${circleColor}`,
                          }} />
                          
                          {/* Timeline Content */}
                          <div>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                              <span className="text-mono" style={{ fontWeight: 700, fontSize: 13, color: circleColor }}>{event.date}</span>
                              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{event.label}</span>
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
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
        </>
      )}
    </div>
  );
}
