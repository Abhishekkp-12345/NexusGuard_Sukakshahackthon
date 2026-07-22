import { ShieldAlert, CheckCircle2, AlertOctagon, HelpCircle } from "lucide-react";
import type { IdentityVerificationResult, MatrixEntry } from "../api/client";

interface Props {
  identityVerification?: IdentityVerificationResult;
}

export default function CrossDocumentMismatch({ identityVerification }: Props) {
  const critical = identityVerification?.critical_identity_mismatch || false;
  const matrix: MatrixEntry[] = identityVerification?.field_comparison_matrix || [];
  const mismatched: MatrixEntry[] = identityVerification?.mismatched_fields || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary Banner */}
      <div style={{
        padding: 16, borderRadius: 8,
        background: critical ? "rgba(239,68,68,0.08)" : mismatched.length > 0 ? "rgba(245,158,11,0.08)" : "rgba(16,185,129,0.08)",
        border: `1px solid ${critical ? "rgba(239,68,68,0.3)" : mismatched.length > 0 ? "rgba(245,158,11,0.3)" : "rgba(16,185,129,0.3)"}`,
        display: "flex", alignItems: "center", gap: 12
      }}>
        {critical ? (
          <AlertOctagon size={24} color="var(--reject)" />
        ) : mismatched.length > 0 ? (
          <ShieldAlert size={24} color="var(--hold)" />
        ) : (
          <CheckCircle2 size={24} color="var(--approve)" />
        )}

        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: critical ? "var(--reject)" : mismatched.length > 0 ? "var(--hold)" : "var(--approve)" }}>
            {critical
              ? "CRITICAL IDENTITY MISMATCH — AUTOMATIC REJECTION LOCK"
              : mismatched.length > 0
              ? `${mismatched.length} Cross-Document Discrepancy(ies) Flagged`
              : "All Identity & Financial Fields Matched Cleanly Across Documents"}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
            {identityVerification?.identity_summary || "Cross-document audit complete across uploaded files."}
          </div>
        </div>
      </div>

      {/* Cross-Document Mismatch Matrix Table */}
      {matrix.length > 0 ? (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid var(--border-subtle)" }}>
                <th style={{ padding: "10px 14px", color: "var(--text-muted)", fontWeight: 700 }}>FIELD</th>
                <th style={{ padding: "10px 14px", color: "var(--text-muted)", fontWeight: 700 }}>SOURCE A</th>
                <th style={{ padding: "10px 14px", color: "var(--text-muted)", fontWeight: 700 }}>VALUE A</th>
                <th style={{ padding: "10px 14px", color: "var(--text-muted)", fontWeight: 700 }}>SOURCE B</th>
                <th style={{ padding: "10px 14px", color: "var(--text-muted)", fontWeight: 700 }}>VALUE B</th>
                <th style={{ padding: "10px 14px", color: "var(--text-muted)", fontWeight: 700 }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: "1px solid var(--border-subtle)",
                    background: row.match ? "transparent" : "rgba(239, 68, 68, 0.05)"
                  }}
                >
                  <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--text-primary)" }}>{row.field}</td>
                  <td style={{ padding: "10px 14px", color: "var(--text-secondary)" }}>{row.sourceA}</td>
                  <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{row.valueA || "—"}</td>
                  <td style={{ padding: "10px 14px", color: "var(--text-secondary)" }}>{row.sourceB}</td>
                  <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{row.valueB || "—"}</td>
                  <td style={{ padding: "10px 14px" }}>
                    {row.match ? (
                      <span style={{ color: "var(--approve)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        ✓ MATCH {row.similarity ? `(${row.similarity.toFixed(0)}%)` : ""}
                      </span>
                    ) : (
                      <span style={{ color: "var(--reject)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        ✕ MISMATCH
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
          <HelpCircle size={24} style={{ margin: "0 auto 8px" }} />
          <div>Upload multiple identity documents (e.g. Aadhaar + PAN) to run cross-document field verification.</div>
        </div>
      )}
    </div>
  );
}
