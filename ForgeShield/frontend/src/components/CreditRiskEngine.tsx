import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Award, BarChart3, TrendingUp, Percent, FileText } from "lucide-react";
import {
  generateCIBIL,
  generateBankingBehaviour,
  generateFinancialScore,
  generateIndustryScore,
  generateGSTScore
} from "../api/mockData";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";

interface Props {
  seed: number;
  applicantType?: "corporate" | "salaried" | "farmer";
}

type ModelTab = "cibil" | "banking" | "financial" | "industry" | "gst";

export default function CreditRiskEngine({ seed, applicantType = "corporate" }: Props) {
  const [activeTab, setActiveTab] = useState<ModelTab>("cibil");

  // Load scores based on case seed
  const [cibil] = useState(() => generateCIBIL(seed));
  const [banking] = useState(() => generateBankingBehaviour(seed));
  const [financial] = useState(() => generateFinancialScore(seed));
  const [industry] = useState(() => generateIndustryScore(seed));
  const [gst] = useState(() => generateGSTScore(seed));

  const modelTabs = applicantType === "salaried" ? [
    { value: "cibil", label: "CIBIL Consumer", score: cibil.consumerScore, rating: cibil.consumerRiskLabel, icon: Award, color: "#3b82f6" },
    { value: "banking", label: "Salary Stability", score: banking.behaviourScore, rating: banking.behaviourRating, icon: BarChart3, color: "#10b981" },
    { value: "financial", label: "Monthly Savings", score: financial.financialHealthScore, rating: financial.healthRating, icon: FileText, color: "#ec4899" },
    { value: "industry", label: "Employment Tenure", score: industry.industryRiskScore, rating: industry.riskRating, icon: TrendingUp, color: "#f59e0b" },
    { value: "gst", label: "Job Credit History", score: gst.gstHealthScore, rating: gst.healthLabel, icon: Percent, color: "#22d3ee" }
  ] : applicantType === "farmer" ? [
    { value: "cibil", label: "KCC Limit Eligibility", score: cibil.consumerScore > 700 ? 94 : 64, rating: "Compliant", icon: Award, color: "#3b82f6" },
    { value: "banking", label: "Land Productivity", score: banking.behaviourScore, rating: "Strong", icon: BarChart3, color: "#10b981" },
    { value: "financial", label: "Climate & Monsoon", score: financial.financialHealthScore, rating: "Moderate", icon: FileText, color: "#ec4899" },
    { value: "industry", label: "Soil Fertility", score: industry.industryRiskScore, rating: "Optimal", icon: TrendingUp, color: "#f59e0b" },
    { value: "gst", label: "Seasonal Harvest Log", score: gst.gstHealthScore, rating: "Consistent", icon: Percent, color: "#22d3ee" }
  ] : [
    { value: "cibil", label: "CIBIL Intelligence", score: cibil.consumerScore > 700 ? 92 : 54, rating: cibil.overallCreditRisk, icon: Award, color: "#3b82f6" },
    { value: "banking", label: "Banking Behaviour", score: banking.behaviourScore, rating: banking.behaviourRating, icon: BarChart3, color: "#10b981" },
    { value: "financial", label: "Financial Health", score: financial.financialHealthScore, rating: financial.healthRating, icon: FileText, color: "#ec4899" },
    { value: "industry", label: "Industry Outlook", score: industry.industryRiskScore, rating: industry.riskRating, icon: TrendingUp, color: "#f59e0b" },
    { value: "gst", label: "GST Compliance", score: gst.gstHealthScore, rating: gst.healthLabel, icon: Percent, color: "#22d3ee" }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* 5 Model Navigation Tabs */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 10
      }}>
        {modelTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;

          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value as ModelTab)}
              style={{
                padding: "12px 14px",
                background: isActive ? "rgba(99,102,241,0.08)" : "var(--bg-card)",
                border: `1px solid ${isActive ? "var(--indigo)" : "var(--border-subtle)"}`,
                borderRadius: 12,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: 8,
                transition: "all 0.2s"
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: isActive ? `${tab.color}15` : "rgba(255,255,255,0.03)",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <Icon size={16} color={isActive ? tab.color : "var(--text-muted)"} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: isActive ? 700 : 500, color: isActive ? "var(--text-primary)" : "var(--text-secondary)" }}>
                  {tab.label}
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, marginTop: 4, color: tab.color }}>
                  {tab.score}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Dynamic Model Content */}
      <div className="card" style={{ minHeight: 340 }}>
        <AnimatePresence mode="wait">
          {activeTab === "cibil" && (
            <motion.div
              key="cibil"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              <div style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: 10, display: "flex", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>CIBIL Bureau Intelligence</span>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>Consumer + Commercial Bureau Analysis</div>
                </div>
                <span className={`verdict-badge ${cibil.overallCreditRisk === "LOW" ? "approve" : cibil.overallCreditRisk === "MODERATE" ? "hold" : "reject"}`} style={{ fontSize: 10 }}>
                  {cibil.overallCreditRisk} RISK
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                {[
                  { label: "Consumer CIBIL Score", value: cibil.consumerScore, sub: cibil.consumerRiskLabel },
                  { label: "Commercial Risk Rank", value: `CMR ${cibil.commercialScore}`, sub: cibil.commercialRiskLabel },
                  { label: "Credit History Length", value: `${cibil.creditHistory} Years`, sub: "Operational history" },
                  { label: "Active Defaults Count", value: cibil.defaults, sub: cibil.defaults > 0 ? "Adverse record" : "No defaults" },
                  { label: "Credit Facility Ratio", value: `${cibil.activeLoans} Active / ${cibil.closedLoans} Closed`, sub: "Borrowing behavior" },
                  { label: "Credit Bureau Inquiries", value: cibil.creditEnquiries, sub: "Last 12 months" },
                ].map(({ label, value, sub }) => (
                  <div key={label} style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{label}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4, color: "var(--text-primary)" }}>{value}</div>
                    <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>{sub}</div>
                  </div>
                ))}
              </div>

              <div style={{
                background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: 12, fontSize: 12
              }}>
                <strong>DPD History Log:</strong> {cibil.dpdHistory}
              </div>
            </motion.div>
          )}

          {activeTab === "banking" && (
            <motion.div
              key="banking"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              <div style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: 10, display: "flex", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Banking Behaviour Model</span>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>Statement cash flow verification</div>
                </div>
                <span className={`verdict-badge ${banking.behaviourRating === "EXCELLENT" || banking.behaviourRating === "GOOD" ? "approve" : "reject"}`} style={{ fontSize: 10 }}>
                  {banking.behaviourRating}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                {[
                  { label: "Avg Monthly Balance (AMB)", value: `₹${(banking.avgMonthlyBalance / 100000).toFixed(1)} Lakhs`, sub: "Liquid cash cushion" },
                  { label: "Cash Flow Stability", value: `${banking.cashFlowStability}/100`, sub: "Inflow volatility index" },
                  { label: "EMI Servicing Compliance", value: banking.emiServicing, sub: "Repayment track" },
                  { label: "Cheque Bounce Incidence", value: banking.chequeBounceHistory, sub: "Last 12 months" },
                  { label: "Returned Transactions", value: banking.returnedTransactions, sub: "Debit/Credit failures" },
                  { label: "Suspicious Large Transfers", value: banking.suspiciousTransfers, sub: "Related party flags" },
                ].map(({ label, value, sub }) => (
                  <div key={label} style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{label}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4, color: "var(--text-primary)" }}>{value}</div>
                    <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>{sub}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "financial" && (
            <motion.div
              key="financial"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              <div style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: 10, display: "flex", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Financial Ratio Analysis</span>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>ITR & Audit report extraction</div>
                </div>
                <span className={`verdict-badge ${financial.healthRating === "STRONG" || financial.healthRating === "ADEQUATE" ? "approve" : "reject"}`} style={{ fontSize: 10 }}>
                  {financial.healthRating}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                {[
                  { label: "DSCR", value: financial.dscr, sub: financial.dscr >= 1.25 ? "✅ Compliant" : "❌ Deficit risk" },
                  { label: "Interest Coverage Ratio", value: financial.interestCoverageRatio, sub: "Operating buffer" },
                  { label: "Current Ratio", value: financial.currentRatio, sub: "Working liquidity" },
                  { label: "Debt-Equity Ratio", value: financial.debtEquityRatio, sub: "Leverage safety" },
                  { label: "EBITDA Margin", value: `${financial.ebitdaMargin}%`, sub: "Operating margin" },
                  { label: "Cash Conversion Cycle", value: `${financial.cashConversionCycle} Days`, sub: "Capital cycle efficiency" },
                ].map(({ label, value, sub }) => (
                  <div key={label} style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{label}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4, color: "var(--text-primary)" }}>{value}</div>
                    <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>{sub}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "industry" && (
            <motion.div
              key="industry"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              <div style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: 10, display: "flex", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Industry Outlook & Risks</span>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>Macro sector trends & promoter rating</div>
                </div>
                <span className={`verdict-badge ${industry.riskRating === "LOW" ? "approve" : "reject"}`} style={{ fontSize: 10 }}>
                  {industry.riskRating} RISK
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                {[
                  { label: "Sector Outlook", value: industry.industryOutlook, sub: `CAGR: ${industry.marketGrowthPct}%` },
                  { label: "Market Competition", value: industry.competitionLevel, sub: "Competitive density" },
                  { label: "Promoter Experience", value: `${industry.promoterExperience} Years`, sub: "Domain expertise" },
                  { label: "Litigation History", value: `${industry.litigationHistory} Cases`, sub: "Active legal actions" },
                  { label: "Management Stability", value: industry.managementStability, sub: "Director rotation risk" },
                  { label: "Macro Sector Risk Rank", value: industry.sectorRisk, sub: "External volatility" },
                ].map(({ label, value, sub }) => (
                  <div key={label} style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{label}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4, color: "var(--text-primary)" }}>{value}</div>
                    <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>{sub}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "gst" && (
            <motion.div
              key="gst"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              <div style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: 10, display: "flex", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>GST Tax Compliance Model</span>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>Sales ledger matching</div>
                </div>
                <span className={`verdict-badge ${gst.healthLabel === "EXCELLENT" || gst.healthLabel === "GOOD" ? "approve" : "reject"}`} style={{ fontSize: 10 }}>
                  {gst.healthLabel}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "center" }}>
                {/* GST stats */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    { label: "Annual Turnover Filed", value: `₹${(gst.annualTurnover / 100).toFixed(1)} Cr` },
                    { label: "GST Return Compliance", value: `${gst.filingCompliance}%` },
                    { label: "Invoice Matching Index", value: `${gst.invoiceMatching}%` },
                    { label: "Vendor Concentration", value: `${gst.vendorConcentration}%` }
                  ].map(({ label, value }) => (
                    <div key={label} style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: 12 }}>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{label}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* GST Sales chart */}
                <div style={{ height: 260, padding: "10px 0" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, display: "block", textAlign: "center" }}>GST Filed vs Actual Sales Trend</span>
                  <ResponsiveContainer width="100%" height="88%">
                    <BarChart data={gst.monthlySalesTrend} margin={{ left: -25 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 9 }} />
                      <YAxis tick={{ fill: "var(--text-muted)", fontSize: 9 }} />
                      <Tooltip contentStyle={{ background: "var(--bg-card)", borderColor: "var(--border-default)", fontSize: 10 }} />
                      <Bar dataKey="sales" name="Actual verified" fill="var(--indigo)" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="filedSales" name="GST declared" fill="var(--approve)" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
