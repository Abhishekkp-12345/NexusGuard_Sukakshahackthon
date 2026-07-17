/**
 * ForgeShield AI — Audit Logs View (Admin Only Portal)
 * ====================================================
 * Allows banking administrators to review every single user activity
 * in real-time, search and filter actions, and clear audit logs.
 */

import { useState, useEffect } from "react";
import {
  Search, Trash2, Calendar, ShieldAlert,
  ArrowDownToLine, RefreshCw, FileText, CheckCircle2,
  XCircle, UserCheck, AlertOctagon
} from "lucide-react";
import { getAuditLogs, clearAuditLogs, logActivity, type AuditActivity } from "../auth/AuthService";

export default function AuditLogsView() {
  const [logs, setLogs] = useState<AuditActivity[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = () => {
    setLogs(getAuditLogs().reverse()); // Show newest logs first
  };

  const handleClearLogs = () => {
    if (window.confirm("WARNING: You are about to permanently delete all security audit logs. This action cannot be undone and will be logged. Proceed?")) {
      clearAuditLogs();
      loadLogs();
    }
  };

  const handleExportLogs = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `forgeshield_audit_log_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    logActivity("ADMIN_EXPORT_LOGS", "Administrator exported the security audit logs to JSON.");
  };

  // Get all unique actions for filtering dropdown
  const uniqueActions = ["ALL", ...Array.from(new Set(logs.map(l => l.action)))];

  const filteredLogs = logs.filter(log => {
    const matchesSearch =
      log.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.detail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAction = actionFilter === "ALL" || log.action === actionFilter;
    const matchesRole = roleFilter === "ALL" || log.role === roleFilter;

    return matchesSearch && matchesAction && matchesRole;
  });

  const getActionBadgeColor = (action: string) => {
    if (action.includes("FAIL") || action.includes("LOCKOUT") || action.includes("PURGE")) {
      return { bg: "#ef444415", text: "#ef4444", border: "#ef444430" };
    }
    if (action.includes("SUCCESS") || action.includes("RESET_SUCCESS") || action.includes("INITIALIZE")) {
      return { bg: "#10b98115", text: "#10b981", border: "#10b98130" };
    }
    if (action.includes("CREATE") || action.includes("RUN")) {
      return { bg: "#22d3ee15", text: "#22d3ee", border: "#22d3ee30" };
    }
    return { bg: "rgba(99,102,241,0.1)", text: "var(--indigo-light)", border: "var(--border-subtle)" };
  };

  const getActionIcon = (action: string) => {
    if (action.includes("FAIL") || action.includes("LOCKOUT")) return <XCircle size={14} />;
    if (action.includes("SUCCESS")) return <UserCheck size={14} />;
    if (action.includes("CREATE") || action.includes("EXPORT")) return <FileText size={14} />;
    if (action.includes("PURGE") || action.includes("RESET")) return <ShieldAlert size={14} />;
    return <CheckCircle2 size={14} />;
  };

  return (
    <div style={{ padding: "30px", animation: "slide-up 0.5s ease both" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "#ef444415", border: "1px solid #ef444430",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <ShieldAlert size={18} color="#ef4444" />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "var(--text-primary)" }}>
              Security Audit Logs
            </h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Review real-time employee activities, system configuration overrides, and security events.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={handleExportLogs}
            style={{
              padding: "10px 18px", borderRadius: 10,
              border: "1px solid var(--border-default)",
              background: "var(--bg-card)", color: "var(--text-secondary)",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
              transition: "all 0.2s"
            }}
          >
            <ArrowDownToLine size={15} /> Export Audit
          </button>
          <button
            onClick={handleClearLogs}
            style={{
              padding: "10px 18px", borderRadius: 10, border: "none",
              background: "#ef4444", color: "white",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
              boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)",
              transition: "all 0.2s"
            }}
          >
            <Trash2 size={15} /> Clear Logs
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 16, marginBottom: 24
      }}>
        {[
          { label: "Total Logged Actions", val: logs.length, color: "var(--indigo)" },
          { label: "Critical Failures / Lockouts", val: logs.filter(l => l.action.includes("FAIL") || l.action.includes("LOCKOUT")).length, color: "#ef4444" },
          { label: "Intake Actions (Cases/Runs)", val: logs.filter(l => l.action.includes("CREATE") || l.action.includes("RUN")).length, color: "#22d3ee" },
        ].map(st => (
          <div key={st.label} style={{
            background: "var(--bg-card)", padding: "18px 20px", borderRadius: 12,
            border: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center"
          }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{st.label}</span>
            <span style={{ fontSize: 24, fontWeight: 850, color: st.color }}>{st.val}</span>
          </div>
        ))}
      </div>

      {/* Filter panel */}
      <div style={{
        background: "var(--bg-card)", padding: "20px", borderRadius: 14,
        border: "1px solid var(--border-subtle)", marginBottom: 20
      }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {/* Search */}
          <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
            <Search size={16} color="var(--text-muted)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Search by User, Action, detail..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: "100%", padding: "10px 14px 10px 42px", borderRadius: 10,
                border: "1px solid var(--border-default)", background: "var(--bg-base)",
                color: "var(--text-primary)", fontSize: 13, outline: "none"
              }}
            />
          </div>

          {/* Action filter */}
          <div style={{ width: 180 }}>
            <select
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              style={{
                width: "100%", padding: "10px", borderRadius: 10,
                border: "1px solid var(--border-default)", background: "var(--bg-base)",
                color: "var(--text-primary)", fontSize: 13, outline: "none", cursor: "pointer"
              }}
            >
              {uniqueActions.map(act => (
                <option key={act} value={act}>{act === "ALL" ? "All Actions" : act}</option>
              ))}
            </select>
          </div>

          {/* Role filter */}
          <div style={{ width: 140 }}>
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              style={{
                width: "100%", padding: "10px", borderRadius: 10,
                border: "1px solid var(--border-default)", background: "var(--bg-base)",
                color: "var(--text-primary)", fontSize: 13, outline: "none", cursor: "pointer"
              }}
            >
              <option value="ALL">All Roles</option>
              <option value="admin">Admin</option>
              <option value="officer">Officer</option>
              <option value="auditor">Auditor</option>
            </select>
          </div>

          <button
            onClick={() => { setSearchTerm(""); setActionFilter("ALL"); setRoleFilter("ALL"); loadLogs(); }}
            style={{
              padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border-default)",
              background: "var(--bg-base)", color: "var(--text-muted)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}
            title="Reload log database"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div style={{
        background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border-subtle)",
        overflow: "hidden", boxShadow: "var(--shadow-card)"
      }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)" }}>
                <th style={{ padding: "16px 20px", color: "var(--text-muted)", fontWeight: 600 }}>Timestamp</th>
                <th style={{ padding: "16px", color: "var(--text-muted)", fontWeight: 600 }}>Employee</th>
                <th style={{ padding: "16px", color: "var(--text-muted)", fontWeight: 600 }}>Action</th>
                <th style={{ padding: "16px", color: "var(--text-muted)", fontWeight: 600 }}>Details</th>
                <th style={{ padding: "16px 20px", color: "var(--text-muted)", fontWeight: 600 }}>Node Gate</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                    <AlertOctagon size={32} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
                    No matching audit activities detected in database.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const badge = getActionBadgeColor(log.action);
                  return (
                    <tr key={log.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td style={{ padding: "16px 20px", whiteSpace: "nowrap" }}>
                        <span style={{ color: "var(--text-secondary)", display: "block" }}>
                          {new Date(log.timestamp).toLocaleDateString()}
                        </span>
                        <span style={{ color: "var(--text-muted)", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                          <Calendar size={10} />
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </td>
                      <td style={{ padding: "16px" }}>
                        <span style={{ fontWeight: 700, color: "var(--text-primary)", display: "block" }}>{log.name}</span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{log.email}</span>
                      </td>
                      <td style={{ padding: "16px" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 20,
                          background: badge.bg, color: badge.text, border: `1px solid ${badge.border}`
                        }}>
                          {getActionIcon(log.action)}
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: "16px", color: "var(--text-secondary)", maxWidth: 350, wordBreak: "break-word" }}>
                        {log.detail}
                      </td>
                      <td style={{ padding: "16px 20px", color: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-mono)" }}>
                        {log.ipAddress}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
