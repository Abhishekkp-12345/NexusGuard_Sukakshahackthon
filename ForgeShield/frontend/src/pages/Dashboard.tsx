import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Shield, Plus, FileText, RefreshCw, AlertTriangle, CheckCircle
} from "lucide-react";
import { casesApi, type Case, type CaseStats } from "../api/client";

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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ position: "relative", overflow: "hidden" }}
    >
      <div style={{
        position: "absolute", top: 0, right: 0, width: 80, height: 80,
        background: `radial-gradient(circle at top right, ${color}22, transparent)`,
      }} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {label}
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "var(--text-primary)", marginTop: 4 }}>
            {value}
          </div>
          {sub && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>}
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: `${color}22`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <Icon size={22} color={color} />
        </div>
      </div>
    </motion.div>
  );
}

function CaseRow({ c, onOpen }: { c: Case; onOpen: () => void }) {
  const verdict = c.verdict || "pending";
  const analysis = c.analysis;

  return (
    <motion.div
      className="card"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      whileHover={{ borderColor: "var(--border-default)" }}
      onClick={onOpen}
      style={{ cursor: "pointer", marginBottom: 12 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        {/* Left: applicant info */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: "rgba(99,102,241,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <FileText size={20} color="var(--indigo-light)" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{c.applicant_name}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {c.case_id} · {c.loan_type} · {c.branch}
            </div>
          </div>
        </div>

        {/* Center: scores */}
        {analysis && (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { label: "Auth", score: analysis.authenticity_score, color: analysis.authenticity_score > 70 ? "var(--approve)" : "var(--reject)" },
              { label: "Consist.", score: analysis.consistency_score, color: analysis.consistency_score > 70 ? "var(--approve)" : "var(--hold)" },
              { label: "Overall", score: analysis.overall_score, color: analysis.overall_score > 70 ? "var(--approve)" : analysis.overall_score > 45 ? "var(--hold)" : "var(--reject)" },
            ].map(({ label, score, color }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color }}>{score.toFixed(0)}%</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Right: verdict + amount */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>₹{(c.loan_amount / 100000).toFixed(1)}L</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Loan Amount</div>
          </div>
          <div className={`verdict-badge ${verdict.toLowerCase()}`}>
            {verdict === "pending" ? "PENDING" : verdict}
          </div>
        </div>
      </div>

      {/* Progress bar for analyzed cases */}
      {analysis && (
        <div style={{ marginTop: 12 }}>
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{
                width: `${analysis.overall_score}%`,
                background: analysis.overall_score > 70
                  ? "linear-gradient(90deg, var(--approve), #34d399)"
                  : analysis.overall_score > 45
                  ? "linear-gradient(90deg, var(--hold), #fbbf24)"
                  : "linear-gradient(90deg, var(--reject), #f87171)",
              }}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default function Dashboard({ onOpenCase, onNewCase }: Props) {
  const [cases, setCases] = useState<Case[]>([]);
  const [stats, setStats] = useState<CaseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "APPROVE" | "HOLD" | "REJECT" | "PENDING">("ALL");

  const load = async () => {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([casesApi.list(), casesApi.stats()]);
      setCases(c);
      setStats(s);
    } catch (e) {
      console.error("Failed to load cases:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Find all double pledging alerts across all cases
  const doublePledgingAlerts = cases.reduce((acc: any[], c) => {
    if (c.analysis?.all_findings) {
      const dpFindings = c.analysis.all_findings.filter((f: any) => f.type === "DOUBLE_PLEDGING");
      dpFindings.forEach((f: any) => {
        const isDuplicate = acc.some(a => a.detail === f.detail);
        if (!isDuplicate) {
          acc.push({
            caseId: c.case_id,
            applicantName: c.applicant_name,
            detail: f.detail,
            severity: f.severity,
          });
        }
      });
    }
    return acc;
  }, []);

  const filtered = filter === "ALL"
    ? cases
    : filter === "PENDING"
    ? cases.filter(c => !c.verdict)
    : cases.filter(c => c.verdict === filter);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <h1 className="page-title">
            Underwriting <span className="gradient-text">Dashboard</span>
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 6 }}>
            Real-time forensic intelligence for loan applications
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost btn-sm" onClick={load}>
            <RefreshCw size={15} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={onNewCase}>
            <Plus size={16} /> New Case
          </button>
        </div>
      </div>

      {/* Stat cards */}
      {stats && (
        <div className="grid-4" style={{ marginBottom: 32 }}>
          <StatCard label="Total Cases" value={stats.total_cases} icon={FileText} color="var(--indigo)" />
          <StatCard label="Flagged Cases" value={stats.held + stats.rejected} sub={`₹${(stats.total_loan_at_risk / 100000).toFixed(1)}L at risk`} icon={AlertTriangle} color="var(--hold)" />
          <StatCard label="Approved" value={stats.approved} icon={CheckCircle} color="var(--approve)" />
          <StatCard label="Detection Rate" value={`${stats.fraud_detection_rate}%`} icon={Shield} color="var(--reject)" />
        </div>
      )}

      {/* Double Pledging Alert Banner */}
      {doublePledgingAlerts.length > 0 && (
        <div style={{
          padding: "16px 20px",
          background: "rgba(239, 68, 68, 0.08)",
          border: "1px solid rgba(239, 68, 68, 0.25)",
          borderRadius: "var(--radius-lg)",
          marginBottom: 32,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <AlertTriangle size={18} color="var(--reject)" />
            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--reject)", letterSpacing: "0.05em" }}>
              CROSS-CASE COLLATERAL FRAUD ALERTS
            </span>
            <span className="verdict-badge reject" style={{ fontSize: 10, padding: "2px 8px" }}>
              {doublePledgingAlerts.length} CRITICAL
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {doublePledgingAlerts.map((alert: any, i: number) => (
              <div key={i} style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                • {alert.detail} (Flagged in case <span className="text-mono" style={{ color: "var(--text-primary)", fontWeight: 600 }}>{alert.caseId}</span> for applicant {alert.applicantName})
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["ALL", "PENDING", "APPROVE", "HOLD", "REJECT"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-ghost"}`}
            style={{ minWidth: 80 }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Case list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 80 }}>
          <div className="spinner" style={{ margin: "0 auto 16px" }} />
          <div style={{ color: "var(--text-muted)" }}>Loading cases…</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 80 }}>
          <Shield size={48} color="var(--text-muted)" style={{ margin: "0 auto 16px" }} />
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No cases yet</div>
          <div style={{ color: "var(--text-muted)", marginBottom: 24 }}>
            Create a new case to start the forensic analysis
          </div>
          <button className="btn btn-primary" onClick={onNewCase}>
            <Plus size={16} /> Create First Case
          </button>
        </div>
      ) : (
        <div>
          {filtered.map((c) => (
            <CaseRow key={c.case_id} c={c} onOpen={() => onOpenCase(c.case_id)} />
          ))}
        </div>
      )}
    </div>
  );
}
