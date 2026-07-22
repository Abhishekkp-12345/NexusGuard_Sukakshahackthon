import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle, Info, ShieldAlert } from "lucide-react";
import { generateFraudAnalysis } from "../api/mockData";

interface Props {
  seed: number;
  applicantType?: "corporate" | "salaried" | "farmer";
  verdict?: string;
  overallScore?: number;
  complianceViolations?: Array<{
    finding_type: string;
    regulation: string;
    details: string;
    mandated_action: string;
    act: string;
  }>;
}

export default function FraudEngine({ seed, applicantType = "corporate", verdict, overallScore, complianceViolations }: Props) {
  const [data, setData] = useState(() => generateFraudAnalysis(seed, applicantType, verdict, overallScore));
  const [activeSubTab, setActiveSubTab] = useState<"fraud" | "compliance">("fraud");

  useEffect(() => {
    setData(generateFraudAnalysis(seed, applicantType, verdict, overallScore));
  }, [seed, applicantType, verdict, overallScore]);

  const isApprove = verdict === "APPROVE" || (overallScore !== undefined && overallScore >= 75);
  const gaugeColor = data.fraudScore < 20 ? "var(--approve)" : data.fraudScore < 45 ? "var(--hold)" : "var(--reject)";

  // Compute final compliance violations list (live + fallback)
  let violationsList = complianceViolations || [];
  if (violationsList.length === 0) {
    if (!isApprove) {
      violationsList = [
        {
          finding_type: "IDENTITY_MISMATCH",
          regulation: "RBI KYC Direction Section 9 & 38",
          details: "Significant name mismatch detected across PAN, Aadhaar and GST registries.",
          mandated_action: "Freeze application processing, request fresh OVD confirmation or video KYC.",
          act: "PMLA 2002"
        },
        {
          finding_type: "STATISTICAL_FABRICATION",
          regulation: "RBI Cyber Security Guidelines Annexure A",
          details: "Numerical distributions deviate from Benford's Law and show high concentration of round numbers.",
          mandated_action: "Refer file to Risk Management Committee (RMC); suspend automated limits.",
          act: "Banking Regulation Act 1949"
        },
        {
          finding_type: "POTENTIAL_SHELL_ENTITY",
          regulation: "PMLA Beneficial Ownership Rule 9",
          details: "Applicant employer matching suspicious shell company template (low employee count, shared address).",
          mandated_action: "File Suspicious Transaction Report (STR) with FIU-IND within 7 days.",
          act: "PMLA 2002"
        }
      ];
    }
  }

  // Active subtab CSS styling helpers
  const tabStyle = (isActive: boolean) => ({
    padding: "10px 20px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    background: isActive ? "rgba(99, 102, 241, 0.15)" : "transparent",
    border: `1.5px solid ${isActive ? "#6366f1" : "var(--border-subtle)"}`,
    color: isActive ? "#818cf8" : "var(--text-muted)",
    transition: "all 0.2s ease",
    display: "flex",
    alignItems: "center",
    gap: 8,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Sub-tab Selector */}
      <div style={{ display: "flex", gap: 12, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 12 }}>
        <button style={tabStyle(activeSubTab === "fraud")} onClick={() => setActiveSubTab("fraud")}>
          🛡️ AI Fraud Intelligence
        </button>
        <button style={tabStyle(activeSubTab === "compliance")} onClick={() => setActiveSubTab("compliance")}>
          ⚖️ Compliance CRAG Checklist
        </button>
      </div>

      {activeSubTab === "fraud" ? (
        <>
          {/* Top Banner with Score Gauge */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            padding: "16px 20px"
          }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div style={{ position: "relative", width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width={64} height={64} style={{ transform: "rotate(-90deg)", position: "absolute" }}>
                  <circle cx={32} cy={32} r={28} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={4} />
                  <motion.circle
                    cx={32}
                    cy={32}
                    r={28}
                    fill="none"
                    stroke={gaugeColor}
                    strokeWidth={4}
                    strokeDasharray={2 * Math.PI * 28}
                    initial={{ strokeDashoffset: 2 * Math.PI * 28 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 28 * (1 - data.fraudScore / 100) }}
                    transition={{ duration: 1 }}
                  />
                </svg>
                <span style={{ fontSize: 13, fontWeight: 800, color: gaugeColor, position: "absolute" }}>{data.fraudScore}</span>
              </div>
              <div style={{ marginLeft: 72 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>AI Fraud Intelligence Score</span>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                  Classification: <strong style={{ color: gaugeColor }}>{data.fraudCategory}</strong>
                </div>
              </div>
            </div>
            <span className={`verdict-badge ${data.riskLevel.toLowerCase()}`} style={{ fontSize: 10, fontWeight: 700 }}>
              {data.riskLevel} RISK
            </span>
          </div>

          {/* AI Explanation Paragraph */}
          <div className="card" style={{
            background: `${gaugeColor}05`,
            border: `1px solid ${gaugeColor}20`,
            padding: 16
          }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <Info size={16} color={gaugeColor} style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--text-secondary)" }}>
                {data.aiExplanation}
              </div>
            </div>
          </div>

          {/* Positive and Risk Factor bullet lists */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            <div className="card" style={{ padding: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--approve)", display: "block", marginBottom: 12 }}>
                🟢 Positive Indicators
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.topPositiveFactors.map((f, i) => (
                  <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", gap: 6, alignItems: "flex-start" }}>
                    <span style={{ color: "var(--approve)" }}>•</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: data.fraudScore > 30 ? "var(--reject)" : "var(--text-muted)", display: "block", marginBottom: 12 }}>
                🔴 Risk Indicators Flagged
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.topRiskFactors.map((f, i) => (
                  <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", gap: 6, alignItems: "flex-start" }}>
                    <span style={{ color: data.fraudScore > 30 ? "var(--reject)" : "var(--text-muted)" }}>•</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 11 Category Checks */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>Forensic Fraud Categories (11 Checks)</span>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 12
            }}>
              {data.checks.map((check, i) => (
                <div
                  key={i}
                  style={{
                    padding: 12,
                    background: "rgba(255,255,255,0.01)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 8,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>{check.name}</span>
                    {check.passed ? (
                      <CheckCircle size={13} color="var(--approve)" />
                    ) : (
                      <AlertTriangle size={13} color="var(--reject)" />
                    )}
                  </div>

                  <div style={{ fontSize: 10, color: "var(--text-secondary)", minHeight: 28, lineHeight: 1.4 }}>
                    {check.detail}
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--text-muted)", marginBottom: 2 }}>
                      <span>Engine Confidence</span>
                      <span>{check.confidence}%</span>
                    </div>
                    <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 1.5, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${check.confidence}%`,
                          background: check.passed ? "var(--approve)" : "var(--reject)"
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Compliance Summary Card */}
          <div className="card" style={{
            background: violationsList.length > 0 ? "rgba(239, 68, 68, 0.04)" : "rgba(16, 185, 129, 0.04)",
            border: `1.5px solid ${violationsList.length > 0 ? "rgba(239, 68, 68, 0.2)" : "rgba(16, 185, 129, 0.2)"}`,
            padding: 18
          }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {violationsList.length > 0 ? (
                <ShieldAlert size={20} color="var(--reject)" />
              ) : (
                <CheckCircle size={20} color="var(--approve)" />
              )}
              <div>
                <span style={{ fontSize: 14, fontWeight: 800, color: "white" }}>
                  RBI Compliance Auditing (CRAG Checklist)
                </span>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                  {violationsList.length > 0 
                    ? `⚠️ Platform flagged ${violationsList.length} regulatory compliance violations.`
                    : "✓ Document dossier is fully compliant with RBI Master Directions on KYC and PMLA guidelines."}
                </div>
              </div>
            </div>
          </div>

          {/* Compliance Checklist Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {violationsList.length > 0 ? (
              violationsList.map((viol, idx) => (
                <div key={idx} className="card" style={{
                  padding: 20,
                  borderLeft: "4px solid var(--reject)",
                  background: "rgba(255,255,255,0.015)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: "var(--reject)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        VIOLATION: {viol.finding_type.replace(/_/g, " ")}
                      </span>
                      <h4 style={{ fontSize: 14, fontWeight: 800, color: "white", margin: "2px 0 0 0" }}>
                        {viol.regulation}
                      </h4>
                    </div>
                    <span style={{ fontSize: 9.5, background: "rgba(255,255,255,0.08)", padding: "2px 8px", borderRadius: 4, color: "var(--text-muted)", fontWeight: 700 }}>
                      ACT: {viol.act}
                    </span>
                  </div>

                  <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, margin: "0 0 14px 0" }}>
                    {viol.details}
                  </p>

                  <div style={{
                    background: "rgba(239, 68, 68, 0.08)",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    borderRadius: 6,
                    padding: "10px 14px"
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#fca5a5", textTransform: "uppercase" }}>
                      Mandated Compliance Action
                    </div>
                    <div style={{ fontSize: 11, color: "#fca5a5", marginTop: 2, lineHeight: 1.4 }}>
                      {viol.mandated_action}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  {
                    title: "KYC & Identity Verification (Section 9)",
                    desc: "Official valid documents (OVDs) have matching name, DOB, and photo hashes across PAN, Aadhaar, and GST databases.",
                    act: "PMLA Guidelines 2002"
                  },
                  {
                    title: "Statistical & Integrity Audit (Benford's Law)",
                    desc: "Numerical inputs in transaction ledgers and financial summaries are clean of algorithmic replication or round number patterns.",
                    act: "RBI Cyber Security Guidelines"
                  },
                  {
                    title: "Mule Account & Shell Entity Screening",
                    desc: "Associated banking entities and director profiles are checked against circular transacting networks and shell registries.",
                    act: "PMLA Rules 2005"
                  }
                ].map((item, idx) => (
                  <div key={idx} className="card" style={{
                    padding: 16,
                    borderLeft: "4px solid var(--approve)",
                    background: "rgba(255,255,255,0.01)"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <h4 style={{ fontSize: 13, fontWeight: 800, color: "white", margin: 0 }}>
                        {item.title}
                      </h4>
                      <span style={{ fontSize: 9.5, background: "rgba(16,185,129,0.1)", color: "var(--approve)", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>
                        COMPLIANT
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                      {item.desc}
                    </p>
                    <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 6, fontStyle: "italic" }}>
                      Act Scope: {item.act}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
