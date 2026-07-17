import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { generateAnomalies } from "../api/mockData";

interface Props {
  seed: number;
  filename: string;
}

export default function AnomalyPanel({ seed, filename }: Props) {
  const [anomalies] = useState(() => generateAnomalies(seed));
  const detectedCount = anomalies.filter((a) => a.detected).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700 }}>🔍 Anomaly Checklist Verification</span>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
            File: {filename}
          </div>
        </div>
        <span className={`verdict-badge ${detectedCount > 0 ? "reject" : "approve"}`} style={{ fontSize: 10, fontWeight: 700 }}>
          {detectedCount > 0 ? `${detectedCount} FLAG(S)` : "CLEAN SCAN"}
        </span>
      </div>

      {/* 16 Anomaly Checklist */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 12
      }}>
        {anomalies.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.02 }}
            style={{
              padding: 12,
              background: item.detected ? "rgba(239, 68, 68, 0.04)" : "rgba(255,255,255,0.01)",
              border: `1px solid ${item.detected ? "rgba(239,68,68,0.25)" : "var(--border-subtle)"}`,
              borderRadius: 8,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: 8
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>{item.type}</span>
              {item.detected ? (
                <AlertTriangle size={13} color="var(--reject)" />
              ) : (
                <CheckCircle size={13} color="var(--approve)" />
              )}
            </div>

            {/* Confidence bar */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--text-muted)", marginBottom: 2 }}>
                <span>Scan Confidence</span>
                <span style={{ color: item.detected ? "var(--reject)" : "var(--text-muted)" }}>{item.confidence}%</span>
              </div>
              <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${item.confidence}%`,
                    background: item.detected ? "var(--reject)" : "var(--approve)"
                  }}
                />
              </div>
            </div>

            {item.detected && item.location && (
              <div style={{
                fontSize: 9,
                background: "rgba(239,68,68,0.08)",
                padding: "2px 6px",
                borderRadius: 4,
                color: "#f87171",
                fontFamily: "var(--font-mono)"
              }}>
                📍 {item.location}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
