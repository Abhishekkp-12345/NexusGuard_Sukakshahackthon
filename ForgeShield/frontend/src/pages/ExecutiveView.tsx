import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Area, AreaChart, Legend
} from "recharts";
import { Shield, DollarSign, Target, Activity } from "lucide-react";
import { casesApi, type CaseStats } from "../api/client";

const COLORS = {
  APPROVE: "#10b981",
  HOLD: "#f59e0b",
  REJECT: "#ef4444",
  PENDING: "#6b7280",
};

// Custom tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border-default)",
        borderRadius: 8, padding: "10px 14px", fontSize: 13,
      }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
        {payload.map((p: any) => (
          <div key={p.name} style={{ color: p.color }}>
            {p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function ExecutiveView() {
  const [stats, setStats] = useState<CaseStats | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const s = await casesApi.stats();
        setStats(s);
      } catch {}
    };
    load();
  }, []);

  // Build chart data — with demo data fallback
  const verdictData = [
    { name: "Approved", value: stats?.approved || 12, color: COLORS.APPROVE },
    { name: "HOLD", value: stats?.held || 8, color: COLORS.HOLD },
    { name: "Rejected", value: stats?.rejected || 4, color: COLORS.REJECT },
    { name: "Pending", value: stats?.pending || 3, color: COLORS.PENDING },
  ];

  const branchData = [
    { branch: "Bengaluru", approved: 15, held: 6, rejected: 3 },
    { branch: "Mumbai", approved: 12, held: 4, rejected: 2 },
    { branch: "Delhi", approved: 10, held: 5, rejected: 4 },
    { branch: "Chennai", approved: 8, held: 3, rejected: 1 },
    { branch: "Hyderabad", approved: 9, held: 4, rejected: 2 },
  ];

  const trendData = [
    { month: "Feb", cases: 18, flagged: 5, amount: 8.2 },
    { month: "Mar", cases: 22, flagged: 7, amount: 10.5 },
    { month: "Apr", cases: 19, flagged: 4, amount: 9.1 },
    { month: "May", cases: 28, flagged: 9, amount: 13.4 },
    { month: "Jun", cases: 31, flagged: 11, amount: 15.8 },
    { month: "Jul", cases: stats?.total_cases || 27, flagged: stats ? (stats.held + stats.rejected) : 8, amount: 12.6 },
  ];

  const scoreDistribution = [
    { range: "0–20%", count: 4 },
    { range: "21–40%", count: 3 },
    { range: "41–60%", count: 7 },
    { range: "61–75%", count: 9 },
    { range: "76–90%", count: 14 },
    { range: "91–100%", count: 8 },
  ];

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 className="page-title">
          Executive <span className="gradient-text">Analytics</span>
        </h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 6 }}>
          Branch-level fraud detection performance — July 2026
        </p>
      </div>

      {/* KPI row */}
      <div className="grid-4" style={{ marginBottom: 32 }}>
        {[
          {
            label: "Total Cases (MTD)",
            value: stats?.total_cases ?? 27,
            sub: "+12% vs last month",
            icon: Activity, color: "var(--indigo)",
          },
          {
            label: "Fraud Detection Rate",
            value: `${stats?.fraud_detection_rate ?? 41}%`,
            sub: "Cases flagged for review",
            icon: Target, color: "var(--hold)",
          },
          {
            label: "Loan Amount at Risk",
            value: `₹${((stats?.total_loan_at_risk ?? 45000000) / 10000000).toFixed(1)}Cr`,
            sub: "HOLD + REJECT verdicts",
            icon: DollarSign, color: "var(--reject)",
          },
          {
            label: "Auto-Cleared Cases",
            value: stats?.approved ?? 12,
            sub: "No human review needed",
            icon: Shield, color: "var(--approve)",
          },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <motion.div
            key={label}
            className="card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ position: "relative", overflow: "hidden" }}
          >
            <div style={{
              position: "absolute", top: 0, right: 0, width: 80, height: 80,
              background: `radial-gradient(circle at top right, ${color}22, transparent)`,
            }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {label}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4 }}>{value}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>
              </div>
              <div style={{
                width: 40, height: 40, borderRadius: 10, background: `${color}22`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon size={20} color={color} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, marginBottom: 20 }}>
        {/* Trend line chart */}
        <div className="card">
          <div className="section-title">Monthly Case Volume & Fraud Detection Trend</div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="gradCases" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradFlagged" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
              <Area type="monotone" dataKey="cases" name="Total Cases" stroke="#6366f1" fill="url(#gradCases)" strokeWidth={2} />
              <Area type="monotone" dataKey="flagged" name="Flagged" stroke="#ef4444" fill="url(#gradFlagged)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Verdict distribution pie */}
        <div className="card">
          <div className="section-title">Verdict Distribution</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={verdictData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                {verdictData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {verdictData.map(({ name, value, color }) => (
              <div key={name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{name}</span>
                </div>
                <span style={{ fontWeight: 700, color }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Branch performance bar chart */}
        <div className="card">
          <div className="section-title">Case Volume by Branch</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={branchData} barSize={12}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="branch" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
              <Bar dataKey="approved" name="Approved" fill={COLORS.APPROVE} radius={[3, 3, 0, 0]} />
              <Bar dataKey="held" name="HOLD" fill={COLORS.HOLD} radius={[3, 3, 0, 0]} />
              <Bar dataKey="rejected" name="Rejected" fill={COLORS.REJECT} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Score distribution */}
        <div className="card">
          <div className="section-title">Overall Score Distribution</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={scoreDistribution} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="range" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Cases" radius={[4, 4, 0, 0]}>
                {scoreDistribution.map((_entry, i) => (
                  <Cell
                    key={i}
                    fill={
                      i >= 4 ? COLORS.APPROVE :
                      i >= 2 ? COLORS.HOLD :
                      COLORS.REJECT
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
            🟢 75%+ APPROVE threshold · 🟡 45–75% HOLD · 🔴 &lt;45% REJECT
          </div>
        </div>
      </div>
    </div>
  );
}
