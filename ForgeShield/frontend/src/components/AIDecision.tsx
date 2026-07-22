import { useState, useEffect } from "react";
import { ShieldCheck, Sparkles, ArrowRight } from "lucide-react";
import { generateFinalDecision } from "../api/mockData";

interface Props {
  seed: number;
  applicantType?: "corporate" | "salaried" | "farmer";
  verdict?: string;
  overallScore?: number;
}

export default function AIDecision({ seed, applicantType = "corporate", verdict, overallScore }: Props) {
  const [data, setData] = useState(() => generateFinalDecision(seed, applicantType, verdict, overallScore));

  useEffect(() => {
    setData(generateFinalDecision(seed, applicantType, verdict, overallScore));
  }, [seed, applicantType, verdict, overallScore]);

  const ratingColor = data.recommendation === "APPROVE" 
    ? "var(--approve)" 
    : data.recommendation === "APPROVE_WITH_CONDITIONS" 
    ? "var(--indigo)" 
    : data.recommendation === "MANUAL_REVIEW" 
    ? "var(--hold)" 
    : "var(--reject)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Top Banner Recommendation */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: `${ratingColor}08`,
        border: `1px solid ${ratingColor}33`,
        borderRadius: 12,
        padding: "16px 20px"
      }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: `${ratingColor}15`,
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <ShieldCheck size={22} color={ratingColor} />
          </div>
          <div>
            <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
              AI Underwriting Verdict
            </span>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: ratingColor, margin: "2px 0 0" }}>
              {data.recommendation.replace(/_/g, " ")}
            </h3>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Risk Rating</span>
          <div style={{ fontSize: 13, fontWeight: 800, color: ratingColor }}>{data.riskLevel.replace(/_/g, " ")}</div>
        </div>
      </div>

      {/* Suggested Loan terms */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12
      }}>
        {[
          { label: "Suggested Loan Capital", value: data.suggestedLoanAmount > 0 ? `₹${data.suggestedLoanAmount} Lakhs` : "Decline recommended", color: "var(--text-primary)" },
          { label: "Interest Pricing Plan", value: data.suggestedLoanAmount > 0 ? `${data.suggestedInterestRate}% p.a.` : "—", color: "var(--indigo-light)" },
          { label: "Recommended Tenure Limit", value: data.suggestedLoanAmount > 0 ? `${data.recommendedTenure} Months` : "—", color: "var(--cyan)" },
          { label: "Collateral Covenants", value: data.requiredCollateral, color: "var(--hold)" }
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{label}</div>
            <div style={{ fontSize: 14, fontWeight: 800, marginTop: 4, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* 8 Composite Sub-Scores Breakdown */}
      <div className="card" style={{ padding: 16 }}>
        <span style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, display: "block" }}>Underwriting Composite Weights</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          {[
            { name: "Document Authenticity", val: data.documentAuthenticityScore, color: "var(--indigo)" },
            { name: "Identity Matching", val: data.identityConsistencyScore, color: "var(--cyan)" },
            { name: "Inverted Fraud Index", val: 100 - data.fraudScore, color: "var(--reject)" },
            { name: "Financial Ratio health", val: data.financialHealthScore, color: "#ec4899" },
            { name: "Banking Cash flow Score", val: data.bankingBehaviourScore, color: "#10b981" },
            { name: "GST filing compliance", val: data.gstHealthScore, color: "#f59e0b" },
            { name: "Industry Sector Outlook", val: data.industryRiskScore, color: "#a855f7" }
          ].map((score) => (
            <div key={score.name} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-secondary)" }}>
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{score.name}</span>
                <strong style={{ color: score.color }}>{score.val}%</strong>
              </div>
              <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 1.5, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${score.val}%`, background: score.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Explainable AI block */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 12 }}>
          <Sparkles size={16} color="var(--indigo-light)" style={{ marginTop: 2 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>Explainable AI Underwriting Rationale</span>
        </div>
        <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--text-secondary)", margin: 0 }}>
          {data.aiExplanation}
        </p>
      </div>

      {/* Factors and recommended improvements grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <div className="card" style={{ padding: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--approve)", display: "block", marginBottom: 10 }}>
            🟢 Major Credit Mitigants (Positives)
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.positiveFactors.map((f, i) => (
              <div key={i} style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", gap: 6 }}>
                <span>•</span>
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: data.probabilityOfDefault > 35 ? "var(--reject)" : "var(--text-muted)", display: "block", marginBottom: 10 }}>
            🔴 Key Risk Concerns Flagged
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.riskFactors.map((f, i) => (
              <div key={i} style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", gap: 6 }}>
                <span>•</span>
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 16, gridColumn: "1 / -1" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--indigo-light)", display: "block", marginBottom: 10 }}>
            ⚡ Prescribed Remedial Covenants (To Improve Application)
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 8 }}>
            {data.improvements.map((imp, i) => (
              <div key={i} style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", gap: 8, background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 10, alignItems: "center" }}>
                <ArrowRight size={12} color="var(--indigo)" style={{ flexShrink: 0 }} />
                <span>{imp}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
