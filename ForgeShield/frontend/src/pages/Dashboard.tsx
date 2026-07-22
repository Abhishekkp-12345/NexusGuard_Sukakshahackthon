import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from "recharts";
import {
  Shield, Plus, FileText, RefreshCw, AlertTriangle, CheckCircle, XCircle,
  Clock, TrendingUp, DollarSign, Award, Search, Bell, Trash2
} from "lucide-react";
import { casesApi, type Case } from "../api/client";
import {
  DASHBOARD_KPIS,
  MONTHLY_APPLICATIONS,
  FRAUD_DETECTION_TREND,
  RISK_DISTRIBUTION,
  INDUSTRY_APPLICATIONS,
  GST_SALES_TREND,
  BANKING_CASH_FLOW,
  DEFAULT_PROB_DISTRIBUTION,
  TRUST_SCORE_DISTRIBUTION,
  NOTIFICATIONS
} from "../api/mockData";

interface Props {
  onOpenCase: (id: string) => void;
  onNewCase: () => void;
}

function StatCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string | number; sub?: string; color: string; icon: any;
}) {
  return (
    <motion.div
      className="card"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", minHeight: 120 }}
    >
      <div style={{
        position: "absolute", top: 0, right: 0, width: 60, height: 60,
        background: `radial-gradient(circle at top right, ${color}22, transparent)`,
      }} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {label}
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginTop: 4 }}>
            {value}
          </div>
        </div>
        <div style={{
          width: 38, height: 38, borderRadius: 8,
          background: `${color}15`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, marginLeft: 8
        }}>
          <Icon size={18} color={color} />
        </div>
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
          {sub}
        </div>
      )}
    </motion.div>
  );
}

function CaseRow({ c, onOpen, onDelete }: { c: Case; onOpen: () => void; onDelete: () => void }) {
  const verdict = c.verdict || "pending";
  const analysis = c.analysis;

  return (
    <motion.div
      className="card"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      whileHover={{ borderColor: "var(--border-default)" }}
      onClick={onOpen}
      style={{ cursor: "pointer", marginBottom: 10, padding: "16px 54px 16px 20px", position: "relative" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 8,
            background: "rgba(99,102,241,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <FileText size={18} color="var(--indigo-light)" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{c.applicant_name}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              {c.case_id} · {c.loan_type} · {c.branch}
            </div>
          </div>
        </div>

        {analysis && (
          <div style={{ display: "flex", gap: 20 }}>
            {[
              { label: "Document Auth", score: analysis.authenticity_score, color: analysis.authenticity_score > 70 ? "var(--approve)" : "var(--reject)" },
              { label: "Identity Match", score: analysis.consistency_score, color: analysis.consistency_score > 70 ? "var(--approve)" : "var(--hold)" },
              { label: "Overall Score", score: analysis.overall_score, color: analysis.overall_score > 70 ? "var(--approve)" : analysis.overall_score > 45 ? "var(--hold)" : "var(--reject)" },
            ].map(({ label, score, color }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color }}>{score.toFixed(0)}%</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>₹{(c.loan_amount / 100000).toFixed(1)} Lakhs</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>Requested</div>
          </div>
          <div className={`verdict-badge ${verdict.toLowerCase()}`} style={{ minWidth: 90, textAlign: "center", fontSize: 11, fontWeight: 700 }}>
            {verdict === "pending" ? "PENDING" : verdict}
          </div>
        </div>
      </div>

      {/* Delete button pinned to top-right of card */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (window.confirm(`Delete case for "${c.applicant_name}"? This cannot be undone.`)) {
            onDelete();
          }
        }}
        title="Delete case"
        style={{
          position: "absolute",
          right: 12,
          top: "50%",
          transform: "translateY(-50%)",
          background: "rgba(239, 68, 68, 0.12)",
          border: "1px solid rgba(239, 68, 68, 0.35)",
          borderRadius: 8,
          width: 32,
          height: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 5,
          transition: "all 0.15s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(239, 68, 68, 0.3)";
          e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.6)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(239, 68, 68, 0.12)";
          e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.35)";
        }}
      >
        <Trash2 size={14} color="#ef4444" />
      </button>
    </motion.div>
  );
}


export default function Dashboard({ onOpenCase, onNewCase }: Props) {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "APPROVE" | "HOLD" | "REJECT" | "PENDING">("ALL");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const c = await casesApi.list();
      setCases(c);
    } catch (e) {
      console.error("Failed to load cases:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  // Filter and search
  const filtered = cases.filter(c => {
    const matchesFilter = filter === "ALL"
      ? true
      : filter === "PENDING"
      ? !c.verdict
      : c.verdict === filter;

    const matchesSearch = c.applicant_name.toLowerCase().includes(search.toLowerCase()) ||
      c.case_id.toLowerCase().includes(search.toLowerCase()) ||
      c.branch.toLowerCase().includes(search.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  return (
    <div style={{ display: "flex", flexDirection: "row", gap: 24, flexWrap: "wrap" }}>
      {/* Left 3/4 Column: Stats, Charts, Cases */}
      <div style={{ flex: "3 1 700px", minWidth: 0, display: "flex", flexDirection: "column", gap: 24 }}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>
              Underwriting & Risk <span className="gradient-text">Operations</span>
            </h1>
            <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 13 }}>
              Real-time forensic intelligence and automated credit decisioning powered by Sukaksha AI
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost btn-sm" onClick={load}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button className="btn btn-primary" onClick={onNewCase}>
              <Plus size={15} /> New Loan Case
            </button>
          </div>
        </div>

        {/* 12 KPI Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 16
        }}>
          <StatCard label="Total Applications" value={DASHBOARD_KPIS.totalApplications} sub="Cumulative cases" color="var(--indigo)" icon={FileText} />
          <StatCard label="Pending Verification" value={DASHBOARD_KPIS.pendingVerification} sub="Awaiting analysis" color="var(--cyan)" icon={Clock} />
          <StatCard label="AI Analyzing Docs" value={DASHBOARD_KPIS.documentsUnderAnalysis} sub="Gemma-9B active" color="#a855f7" icon={Shield} />
          <StatCard label="Fraud Alerts Flagged" value={DASHBOARD_KPIS.fraudAlerts} sub="Tamper indications" color="var(--reject)" icon={AlertTriangle} />
          <StatCard label="High-Risk Applications" value={DASHBOARD_KPIS.highRiskApplications} sub="PD > 50% cases" color="#f97316" icon={AlertTriangle} />
          <StatCard label="Approved Loans" value={DASHBOARD_KPIS.approvedLoans} sub="Disbursed portfolio" color="var(--approve)" icon={CheckCircle} />
          <StatCard label="Rejected Loans" value={DASHBOARD_KPIS.rejectedLoans} sub="Underwriting filter" color="#ef4444" icon={XCircle} />
          <StatCard label="Manual Review Queue" value={DASHBOARD_KPIS.manualReviewQueue} sub="Human-in-the-loop" color="var(--hold)" icon={Clock} />
          <StatCard label="Avg Prob. of Default" value={`${DASHBOARD_KPIS.avgProbabilityOfDefault}%`} sub="Target: < 15.0%" color="#ec4899" icon={TrendingUp} />
          <StatCard label="Avg Trust Score" value={`${DASHBOARD_KPIS.avgTrustScore}/100`} sub="Target: > 70.0" color="#3b82f6" icon={Award} />
          <StatCard label="Avg Fraud Score" value={`${DASHBOARD_KPIS.avgFraudScore}/100`} sub="Target: < 20.0" color="var(--reject)" icon={Shield} />
          <StatCard label="Total Value Requested" value={`₹${(DASHBOARD_KPIS.totalLoanValueRequested).toFixed(1)} Cr`} sub="Aggregate requested" color="var(--approve)" icon={DollarSign} />
        </div>

        {/* 8 Charts Grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 10, margin: 0 }}>
            Operational & Analytics Trends
          </h2>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
            gap: 20
          }}>
            {/* Chart 1: Monthly Applications */}
            <div className="card" style={{ height: 320, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Monthly Application Trends</span>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Current Financial Year</span>
              </div>
              <ResponsiveContainer width="100%" height="88%">
                <BarChart data={MONTHLY_APPLICATIONS} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="applications" name="Total" fill="var(--indigo)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="approved" name="Approved" fill="var(--approve)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="rejected" name="Rejected" fill="var(--reject)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 2: Fraud Detection Trend */}
            <div className="card" style={{ height: 320, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Fraud Detection Trends</span>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Alert vs Prevention Rate</span>
              </div>
              <ResponsiveContainer width="100%" height="88%">
                <LineChart data={FRAUD_DETECTION_TREND} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="fraudDetected" name="Alerts Confirmed" stroke="var(--reject)" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="fraudPrevented" name="Value Shielded" stroke="var(--approve)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 3: Risk Distribution */}
            <div className="card" style={{ height: 320, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Portfolio Risk Distribution</span>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Active Applications Risk</span>
              </div>
              <div style={{ display: "flex", height: "85%", alignItems: "center" }}>
                <div style={{ flex: 1, height: "100%" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={RISK_DISTRIBUTION}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {RISK_DISTRIBUTION.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => [`${v} applications`, 'Count']} contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ width: 140, display: "flex", flexDirection: "column", gap: 6 }}>
                  {RISK_DISTRIBUTION.map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: item.color }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 10, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
                        <div style={{ fontSize: 11, fontWeight: 700 }}>{item.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Chart 4: Industry-wise Applications */}
            <div className="card" style={{ height: 320, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Industry Concentration & Risk</span>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Volume vs Sector Risk Score</span>
              </div>
              <ResponsiveContainer width="100%" height="88%">
                <BarChart data={INDUSTRY_APPLICATIONS} layout="vertical" margin={{ top: 5, right: 5, left: 15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <YAxis dataKey="industry" type="category" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} width={80} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="applications" name="Applications" fill="var(--indigo)" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="riskScore" name="Industry Risk" fill="var(--hold)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 5: GST Sales Trend */}
            <div className="card" style={{ height: 320, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>GST Filing Integrity Trend</span>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Reported vs Actual Sales (in Lakhs)</span>
              </div>
              <ResponsiveContainer width="100%" height="88%">
                <AreaChart data={GST_SALES_TREND} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Area type="monotone" dataKey="reported" name="GST Reported" stroke="var(--indigo)" fill="rgba(99,102,241,0.15)" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="actual" name="Actual Bank Verified" stroke="var(--approve)" fill="rgba(16,185,129,0.15)" strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 6: Banking Cash Flow Trend */}
            <div className="card" style={{ height: 320, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Aggregate Banking Cash Flow</span>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Inflow vs Outflow vs Net (in Lakhs)</span>
              </div>
              <ResponsiveContainer width="100%" height="88%">
                <ComposedChart data={BANKING_CASH_FLOW} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="inflow" name="Inflow" fill="rgba(34,211,238,0.6)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outflow" name="Outflow" fill="rgba(244,63,94,0.6)" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="netBalance" name="Net Flow" stroke="var(--approve)" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 7: Default Probability Distribution */}
            <div className="card" style={{ height: 320, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>PD Risk Pool Breakdown</span>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Distribution across ranges</span>
              </div>
              <ResponsiveContainer width="100%" height="88%">
                <BarChart data={DEFAULT_PROB_DISTRIBUTION} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="range" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', fontSize: 11 }} />
                  <Bar dataKey="count" name="Case Count" fill="#ec4899" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 8: Trust Score Distribution */}
            <div className="card" style={{ height: 320, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Averaged Portfolio Trust Trend</span>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Monthly Trust Metrics</span>
              </div>
              <ResponsiveContainer width="100%" height="88%">
                <AreaChart data={TRUST_SCORE_DISTRIBUTION} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Area type="monotone" dataKey="avgTrust" name="Avg Trust Score" stroke="#3b82f6" fill="rgba(59,130,246,0.15)" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="highTrust" name="Upper Quartile" stroke="#10b981" fill="rgba(16,185,129,0.05)" strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Case List Section */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-subtle)", paddingBottom: 10 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
              Loan Intake & Case Queue
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Search Bar */}
              <div style={{ position: "relative", width: 220 }}>
                <Search size={14} color="var(--text-muted)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  placeholder="Search applicant name, case ID, or branch..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: "100%", padding: "6px 12px 6px 30px", borderRadius: 8,
                    border: "1px solid var(--border-default)", background: "rgba(0,0,0,0.1)",
                    color: "var(--text-primary)", fontSize: 12
                  }}
                />
              </div>

              {/* Filter tabs */}
              <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.03)", padding: 3, borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                {(["ALL", "PENDING", "APPROVE", "HOLD", "REJECT"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-ghost"}`}
                    style={{ minWidth: 65, fontSize: 10, padding: "4px 8px", borderRadius: 6 }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 60 }}>
              <div className="spinner" style={{ margin: "0 auto 12px" }} />
              <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Retrieving system queue…</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 60 }}>
              <Shield size={38} color="var(--text-muted)" style={{ margin: "0 auto 12px" }} />
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>No matching records</div>
              <div style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 16 }}>
                Adjust search query or filter tags, or create a new case to initiate audit checks.
              </div>
              <button className="btn btn-primary btn-sm" style={{ margin: "0 auto" }} onClick={onNewCase}>
                <Plus size={14} /> Intake New Case
              </button>
            </div>
          ) : (
            <div>
              {filtered.map((c) => (
                <CaseRow
                  key={c.case_id}
                  c={c}
                  onOpen={() => onOpenCase(c.case_id)}
                  onDelete={async () => {
                    try {
                      await casesApi.delete(c.case_id);
                      setCases(prev => prev.filter(x => x.case_id !== c.case_id));
                    } catch (e) {
                      console.error("Failed to delete case:", e);
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Right 1/4 Column: Anomaly Alert Feed & Quick Actions */}
      <div style={{ flex: "1 1 280px", display: "flex", flexDirection: "column", gap: 20 }}>
        
        {/* Real-time Forensic Alerts */}
        <div className="card-glass" style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%", maxHeight: 600, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-subtle)", paddingBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
              <Bell size={15} color="var(--reject)" /> Real-Time Forensic Logs
            </span>
            <span className="verdict-badge reject" style={{ fontSize: 9, padding: "2px 8px", fontWeight: 700 }}>
              Live
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", paddingRight: 4, flex: 1 }}>
            {NOTIFICATIONS.map((n) => (
              <div
                key={n.id}
                style={{
                  padding: 12,
                  background: n.read ? "rgba(255,255,255,0.02)" : "rgba(239, 68, 68, 0.05)",
                  border: `1px solid ${n.read ? "rgba(255,255,255,0.05)" : "rgba(239,68,68,0.2)"}`,
                  borderRadius: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: n.type === "fraud" || n.type === "tampering" ? "var(--reject)" : n.type === "high_risk" ? "var(--hold)" : "var(--indigo-light)"
                  }}>
                    {n.title}
                  </span>
                  <span style={{ fontSize: 9, color: "var(--text-muted)" }}>
                    {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: 0, lineHeight: 1.4 }}>
                  {n.message}
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                  <span style={{ fontSize: 9, color: "var(--indigo-light)", fontWeight: 600 }}>
                    ID: {n.caseId}
                  </span>
                  {!n.read && (
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--reject)" }} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Audit Actions Card */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 10 }}>
            Quick Operations
          </span>
          <button className="btn btn-primary btn-sm" style={{ width: "100%" }} onClick={onNewCase}>
            <Plus size={14} /> Start New Case Intake
          </button>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5, padding: "4px 8px" }}>
            Every action and case review is strictly logged and audited in compliance with the **RBI IT Security Framework**. 
            To view logs or reset authorization profiles, contact your Administrator.
          </div>
        </div>
      </div>
    </div>
  );
}
