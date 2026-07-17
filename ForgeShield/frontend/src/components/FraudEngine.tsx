import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle, Info } from "lucide-react";
import { generateFraudAnalysis } from "../api/mockData";

interface Props {
  seed: number;
}

export default function FraudEngine({ seed }: Props) {
  const [data] = useState(() => generateFraudAnalysis(seed));
  const gaugeColor = data.fraudScore < 20 ? "var(--approve)" : data.fraudScore < 45 ? "var(--hold)" : "var(--reject)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
            <span style={{ fontSize: 13, fontWeight: 800, color: gaugeColor }}>{data.fraudScore}</span>
          </div>
          <div>
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
    </div>
  );
}
