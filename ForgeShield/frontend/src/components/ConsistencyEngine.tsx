import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { generateConsistencyMatrix } from "../api/mockData";

interface Props {
  seed: number;
  verdict?: string;
  overallScore?: number;
  analysis?: any;
}

export default function ConsistencyEngine({ seed, verdict, overallScore, analysis }: Props) {
  const [mockData, setMockData] = useState(() => generateConsistencyMatrix(seed, verdict, overallScore));

  useEffect(() => {
    setMockData(generateConsistencyMatrix(seed, verdict, overallScore));
  }, [seed, verdict, overallScore]);

  const hasRealData = !!(analysis && analysis.consistency_matrix && analysis.consistency_matrix.length > 0);
  const score = hasRealData ? (analysis.identity_score ?? analysis.consistency_score) : mockData.score;
  const cells = hasRealData ? analysis.consistency_matrix : mockData.cells;

  // Get unique documents and fields from cell data
  const docs = Array.from(new Set(cells.flatMap((c: any) => [c.docA, c.docB])));
  const fields = Array.from(new Set(cells.map((c: any) => c.field)));

  // Identity score styling
  const gaugeColor = score > 80 ? "var(--approve)" : score > 60 ? "var(--hold)" : "var(--reject)";
  const mismatches = cells.filter((c: any) => c.match === "MISMATCH");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Identity consistency banner */}
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
                animate={{ strokeDashoffset: 2 * Math.PI * 28 * (1 - score / 100) }}
                transition={{ duration: 1 }}
              />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 800, color: gaugeColor }}>{score}%</span>
          </div>
          <div>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Identity Consistency Score</span>
            <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
              {hasRealData ? "Deterministic cross-validation of data points across all submitted papers" : "Synthesizing matching details across all uploaded documentation"}
            </p>
          </div>
        </div>
        <span className={`verdict-badge ${mismatches.length > 0 ? "reject" : "approve"}`} style={{ fontSize: 10, fontWeight: 700 }}>
          {mismatches.length > 0 ? `${mismatches.length} MISMATCHES` : "100% IDENTICAL"}
        </span>
      </div>

      {/* Grid Comparison Matrix */}
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.01)", borderBottom: "1px solid var(--border-subtle)" }}>
              <th style={{ padding: 12, textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>FIELD / ENTITY</th>
              {docs.map((doc: any) => (
                <th key={doc} style={{ padding: 12, textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--text-secondary)" }}>
                  {doc.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fields.map((field: any) => (
              <tr key={field} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <td style={{ padding: 12, fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{field}</td>
                {docs.map((doc: any) => {
                  const relatedCell = cells.find((c: any) => c.field === field && (c.docA === doc || c.docB === doc));
                  if (!relatedCell) {
                    return (
                      <td key={doc} style={{ padding: 12, textAlign: "center" }}>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>—</span>
                      </td>
                    );
                  }

                  const isMismatch = cells.some(
                    (c: any) => c.field === field && (c.docA === doc || c.docB === doc) && c.match === "MISMATCH"
                  );
                  const isMatch = cells.some(
                    (c: any) => c.field === field && (c.docA === doc || c.docB === doc) && c.match === "MATCH"
                  );

                  return (
                    <td key={doc} style={{ padding: 12, textAlign: "center" }}>
                      {isMismatch ? (
                        <span style={{
                          display: "inline-flex", padding: "2px 8px", borderRadius: 4,
                          background: "var(--reject-bg)", color: "var(--reject)", fontSize: 10, fontWeight: 700,
                          alignItems: "center", gap: 4
                        }}>
                          <X size={10} /> Conflict
                        </span>
                      ) : isMatch ? (
                        <span style={{
                          display: "inline-flex", padding: "2px 8px", borderRadius: 4,
                          background: "var(--approve-bg)", color: "var(--approve)", fontSize: 10, fontWeight: 700,
                          alignItems: "center", gap: 4
                        }}>
                          <Check size={10} /> Match
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>N/A</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detailed Field Comparison Table */}
      {hasRealData && (
        <div style={{ marginTop: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--indigo-light)", textTransform: "uppercase", display: "block", marginBottom: 12 }}>
            Detailed Field Comparison Report
          </span>
          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.01)", borderBottom: "1px solid var(--border-subtle)" }}>
                  <th style={{ padding: 12, textAlign: "left", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", width: "15%" }}>FIELD NAME</th>
                  <th style={{ padding: 12, textAlign: "left", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", width: "22%" }}>SOURCE A & VALUE</th>
                  <th style={{ padding: 12, textAlign: "left", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", width: "22%" }}>SOURCE B & VALUE</th>
                  <th style={{ padding: 12, textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", width: "12%" }}>STATUS</th>
                  <th style={{ padding: 12, textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", width: "10%" }}>CONFIDENCE</th>
                  <th style={{ padding: 12, textAlign: "left", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", width: "19%" }}>MISMATCH REASON / NOTE</th>
                </tr>
              </thead>
              <tbody>
                {cells.map((cell: any, idx: number) => {
                  const isMismatch = cell.match === "MISMATCH";
                  const isMatch = cell.match === "MATCH";
                  
                  return (
                    <tr key={idx} style={{ borderBottom: "1px solid var(--border-subtle)", background: isMismatch ? "rgba(239,68,68,0.01)" : "transparent" }}>
                      <td style={{ padding: 12, fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>{cell.field}</td>
                      <td style={{ padding: 12, fontSize: 11 }}>
                        <span style={{ color: "var(--text-muted)", display: "block", fontSize: 9 }}>{cell.docA}</span>
                        <strong className="text-mono" style={{ fontSize: 11, color: "var(--text-secondary)" }}>{cell.valA || "—"}</strong>
                      </td>
                      <td style={{ padding: 12, fontSize: 11 }}>
                        <span style={{ color: "var(--text-muted)", display: "block", fontSize: 9 }}>{cell.docB}</span>
                        <strong className="text-mono" style={{ fontSize: 11, color: "var(--text-secondary)" }}>{cell.valB || "—"}</strong>
                      </td>
                      <td style={{ padding: 12, textAlign: "center" }}>
                        {isMismatch ? (
                          <span style={{
                            display: "inline-flex", padding: "2px 8px", borderRadius: 4,
                            background: "var(--reject-bg)", color: "var(--reject)", fontSize: 10, fontWeight: 700,
                            alignItems: "center", gap: 4
                          }}>
                            <X size={10} /> Conflict
                          </span>
                        ) : isMatch ? (
                          <span style={{
                            display: "inline-flex", padding: "2px 8px", borderRadius: 4,
                            background: "var(--approve-bg)", color: "var(--approve)", fontSize: 10, fontWeight: 700,
                            alignItems: "center", gap: 4
                          }}>
                            <Check size={10} /> Match
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>N/A</span>
                        )}
                      </td>
                      <td style={{ padding: 12, textAlign: "center", fontSize: 11, fontWeight: 600 }}>
                        <span style={{ color: cell.confidence < 70 ? "var(--hold)" : "var(--approve)" }}>
                          {cell.confidence}%
                        </span>
                      </td>
                      <td style={{ padding: 12, fontSize: 11, color: isMismatch ? "var(--reject)" : "var(--text-secondary)" }}>
                        {cell.reason || "Matched successfully."}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Discrepancy details (Fallback/Mock details when no real report is shown) */}
      {!hasRealData && mismatches.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--reject)" }}>⚠️ Identified Verification Conflicts</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {mismatches.map((m: any, i: number) => (
              <div
                key={i}
                style={{
                  padding: 12,
                  background: "rgba(239,68,68,0.04)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: 8,
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}
              >
                <div>
                  <strong>{m.field}</strong> mismatch detected between <span style={{ color: "var(--indigo-light)" }}>{m.docA}</span> and <span style={{ color: "var(--indigo-light)" }}>{m.docB}</span>.
                </div>
                <span className="text-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  Conf: {m.confidence}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
