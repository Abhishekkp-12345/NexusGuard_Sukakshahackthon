import { useState, useEffect } from "react";
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

// ── AI Recommendation Panel ───────────────────────────────────────────
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
        fontSize: 14, lineHeight: 1.8, color: "var(--text-secondary)",
        fontStyle: "italic",
      }} className={!done ? "typing-cursor" : ""}>
        "{displayed}"
      </div>
    </div>
  );
}

// ── Audit Timeline ────────────────────────────────────────────────────
function AuditTimeline({ analysis }: { analysis: AnalysisResult }) {
  const steps = [
    { label: "Documents Uploaded", detail: `${analysis.document_reports.length} document(s)`, done: true, color: "var(--approve)" },
    { label: "Layer 1: Document Forensics", detail: `Authenticity: ${analysis.authenticity_score.toFixed(1)}%`, done: true, color: analysis.authenticity_score > 70 ? "var(--approve)" : "var(--hold)" },
    { label: "Layer 2: Cross-Document Validation", detail: `Consistency: ${analysis.consistency_score.toFixed(1)}%`, done: true, color: analysis.consistency_score > 70 ? "var(--approve)" : "var(--hold)" },
    { label: "Layer 3: Relationship Intelligence", detail: `Relationship Risk: ${analysis.relationship_risk_score.toFixed(1)}%`, done: true, color: analysis.relationship_risk_score < 30 ? "var(--approve)" : "var(--hold)" },
    { label: "Layer 4: AI Risk Engine", detail: `Overall: ${analysis.overall_score.toFixed(1)}% — ${analysis.verdict}`, done: true, color: analysis.verdict === "APPROVE" ? "var(--approve)" : analysis.verdict === "HOLD" ? "var(--hold)" : "var(--reject)" },
    { label: "Underwriter Review Required", detail: "Awaiting human decision", done: false, color: "var(--indigo)" },
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
          <div style={{ paddingBottom: i < steps.length - 1 ? 16 : 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{step.label}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{step.detail}</div>
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
  const verdict = analysis?.verdict || caseData.verdict;
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
            </div>
          )}

          {/* Documents tab */}
          {activeTab === "documents" && (
            <div>
              {analysis.document_reports.map((doc, i) => (
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
                  {doc.pdf_forensics?.metadata && (
                    <div style={{
                      padding: 14, borderRadius: "var(--radius-md)",
                      background: "var(--bg-surface)", marginTop: 12,
                    }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>📋 PDF Metadata</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
                        {Object.entries(doc.pdf_forensics.metadata).map(([k, v]) =>
                          v && typeof v === "string" ? (
                            <div key={k} style={{ fontSize: 12 }}>
                              <span style={{ color: "var(--text-muted)" }}>{k}: </span>
                              <span className="text-mono">{String(v).slice(0, 50)}</span>
                            </div>
                          ) : null
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Timeline tab */}
          {activeTab === "timeline" && (
            <div className="card">
              <div className="section-title">🕐 Investigation Timeline</div>
              <AuditTimeline analysis={analysis} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
