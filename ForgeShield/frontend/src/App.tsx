import { useState, useEffect } from "react";
import {
  LayoutDashboard, Plus, BarChart3,
  Shield, MapPin, Sun, Moon, LogOut, User,
  ShieldAlert, AlertTriangle, Clock, RefreshCw, Lock
} from "lucide-react";
import "./index.css";

import {
  initAuthStore, getSession, logout, extendSession,
  logActivity, type Session
} from "./auth/AuthService";

import LoginPage from "./pages/LoginPage.tsx";
import LandingPage from "./pages/LandingPage.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import NewCase from "./pages/NewCase.tsx";
import CaseReport from "./pages/CaseReport.tsx";
import GraphView from "./pages/GraphView.tsx";
import ExecutiveView from "./pages/ExecutiveView.tsx";
import GeoIntelligence from "./pages/GeoIntelligence.tsx";
import AuditLogsView from "./pages/AuditLogsView.tsx";

type AppPage =
  | { name: "landing" }
  | { name: "login" }
  | { name: "dashboard" }
  | { name: "new-case" }
  | { name: "case-report"; caseId: string }
  | { name: "graph" }
  | { name: "executive" }
  | { name: "geo" }
  | { name: "admin-logs" };

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [page, setPage] = useState<AppPage>({ name: "landing" });
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  /* Session state */
  const [secondsRemaining, setSecondsRemaining] = useState<number>(900); // 15 min default
  const [showSessionWarning, setShowSessionWarning] = useState(false);

  /* ── Initialise auth store on mount ────────────────────────── */
  useEffect(() => {
    initAuthStore().then(() => {
      const existing = getSession();
      setSession(existing);
      setAuthReady(true);
    });
  }, []);

  /* ── Apply theme to root ───────────────────────────────────── */
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  /* ── Session monitoring countdown loop ─────────────────────── */
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const diffMs = session.expiresAt - now;
      const secs = Math.ceil(diffMs / 1000);

      if (secs <= 0) {
        clearInterval(interval);
        handleAutoLogout();
      } else {
        setSecondsRemaining(secs);
        // Show warning if 5 minutes or less (300 seconds)
        if (secs <= 300) {
          setShowSessionWarning(true);
        } else {
          setShowSessionWarning(false);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session, page]);

  /* ── User Inactivity Extension (throttle to 10s) ───────────── */
  useEffect(() => {
    if (!session) return;

    let lastInteraction = Date.now();

    const handleInteraction = () => {
      const now = Date.now();
      if (now - lastInteraction > 10000) { // 10s throttle
        lastInteraction = now;
        extendSession();
        // Update local session reference to trigger state updates for countdown
        const updated = getSession();
        if (updated) setSession(updated);
      }
    };

    window.addEventListener("mousemove", handleInteraction);
    window.addEventListener("keydown", handleInteraction);
    window.addEventListener("click", handleInteraction);

    return () => {
      window.removeEventListener("mousemove", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
      window.removeEventListener("click", handleInteraction);
    };
  }, [session]);

  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");

  const navigate = (p: AppPage) => {
    if (session) {
      // Log activities when switching views
      if (p.name === "dashboard") logActivity("NAVIGATE_DASHBOARD", "Navigated to underwriting dashboard.");
      else if (p.name === "new-case") logActivity("NAVIGATE_NEW_CASE", "Navigated to new loan case intake form.");
      else if (p.name === "graph") logActivity("NAVIGATE_GRAPH", "Accessed NetworkX entity relationship graph.");
      else if (p.name === "executive") logActivity("NAVIGATE_EXECUTIVE", "Accessed executive analytics panel.");
      else if (p.name === "geo") logActivity("NAVIGATE_GEO", "Accessed regional geo-intelligence heatmap.");
      else if (p.name === "admin-logs") logActivity("VIEW_AUDIT_LOGS", "Accessed system security audit logs.");
      else if (p.name === "case-report") logActivity("VIEW_CASE_REPORT", `Accessed forensic report for Case ID: ${p.caseId}`);
    }
    setPage(p);
  };

  const isActive = (name: string) => page.name === name;

  const handleAuthenticated = (s: Session) => {
    setSession(s);
    setPage({ name: "dashboard" });
    logActivity("LOGIN_SUCCESS", `Authorized employee ${s.name} logged in successfully via 2FA.`, s);
  };

  const handleLogout = () => {
    logout();
    setSession(null);
    setPage({ name: "landing" });
  };

  const handleAutoLogout = () => {
    logout();
    setSession(null);
    setShowSessionWarning(false);
    setPage({ name: "landing" });
    alert("Your security session has expired due to 15 minutes of inactivity. Please sign in again.");
  };

  const handleExtendSession = () => {
    extendSession();
    const updated = getSession();
    if (updated) {
      setSession(updated);
      setShowSessionWarning(false);
      logActivity("SESSION_EXTENSION", "Inactivity session timer extended by employee.");
    }
  };

  const handleLandingEnter = () => {
    if (session) navigate({ name: "dashboard" });
    else setPage({ name: "login" });
  };

  /* Format seconds left to MM:SS */
  const formatTimeRemaining = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  /* ── Loading state ─────────────────────────────────────────── */
  if (!authReady) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "var(--bg-base)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-sans)",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 56, height: 56,
            background: "linear-gradient(135deg, #6366f1, #22d3ee)",
            borderRadius: 14,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
            boxShadow: "0 8px 32px rgba(99,102,241,0.4)",
            animation: "pulse-init 1.5s ease-in-out infinite",
          }}>
            <Shield size={28} color="white" />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-secondary)" }}>
            Initialising ForgeShield Security Gate…
          </div>
        </div>
      </div>
    );
  }

  /* ── Landing Page (Public) ─────────────────────────────────── */
  if (page.name === "landing") {
    return (
      <LandingPage
        onEnter={handleLandingEnter}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  /* ── Login Gate ────────────────────────────────────────────── */
  if (page.name === "login" || !session) {
    return (
      <LoginPage
        onAuthenticated={handleAuthenticated}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  /* ── Dynamic Nav items based on RBAC ───────────────────────── */
  const isAuditor = session.role === "auditor";
  const isAdmin = session.role === "admin";

  return (
    <div className="layout">
      {/* ── SESSION EXPIRY BANNER ───────────────────────────────── */}
      {showSessionWarning && (
        <div style={{
          position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)",
          zIndex: 9999, width: "90%", maxWidth: 520, padding: "12px 18px",
          borderRadius: 12, background: "rgba(245, 158, 11, 0.95)", color: "white",
          boxShadow: "0 10px 30px rgba(0,0,0,0.3)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          animation: "slide-down 0.4s ease both"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={18} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              Session expiring in {formatTimeRemaining(secondsRemaining)} due to inactivity.
            </span>
          </div>
          <button
            onClick={handleExtendSession}
            style={{
              marginLeft: "auto", padding: "6px 14px", borderRadius: 8, border: "none",
              background: "white", color: "#d97706", fontSize: 12, fontWeight: 700,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 4
            }}
          >
            <RefreshCw size={12} /> Keep Connected
          </button>
        </div>
      )}

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside className="sidebar">
        {/* Logo */}
        <div style={{
          padding: "20px 20px 16px",
          borderBottom: "1px solid var(--border-subtle)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: 38, height: 38,
              background: "linear-gradient(135deg, var(--indigo), var(--cyan-dark))",
              borderRadius: "10px",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(99,102,241,0.4)",
            }}>
              <Shield size={20} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-0.3px", color: "var(--text-primary)" }}>
                ForgeShield AI
              </div>
              <div style={{
                fontSize: 10, fontWeight: 700,
                background: "linear-gradient(90deg, #1a56db, #f59e0b)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                letterSpacing: "0.05em",
              }}>
                CANARA BANK
              </div>
            </div>
          </div>
        </div>

        {/* User Identity Panel */}
        <div style={{
          padding: "12px 16px",
          margin: "12px 12px 0",
          borderRadius: 10,
          background: "#6366f108",
          border: "1px solid var(--border-subtle)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "linear-gradient(135deg, #6366f1, #22d3ee)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <User size={15} color="white" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {session.name}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{
                  padding: "1px 4px", borderRadius: 4, background: "rgba(99,102,241,0.15)", color: "var(--indigo-light)", fontWeight: 700, fontSize: 9
                }}>{session.role.toUpperCase()}</span>
                <span>{session.employeeId}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Nav list */}
        <nav style={{ padding: "16px 12px", flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", padding: "0 8px 8px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Navigation
          </div>

          <button
            onClick={() => navigate({ name: "landing" })}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: "12px",
              padding: "9px 12px", borderRadius: "8px", border: "none",
              cursor: "pointer", fontSize: "13px", fontWeight: 400,
              marginBottom: "4px", background: "transparent", color: "var(--text-muted)",
              borderLeft: "2px solid transparent",
            }}
          >
            ← Home
          </button>

          {/* Standard menu items */}
          <button
            onClick={() => navigate({ name: "dashboard" })}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: "12px",
              padding: "10px 12px", borderRadius: "8px", border: "none",
              cursor: "pointer", fontSize: "14px",
              fontWeight: isActive("dashboard") ? 600 : 400,
              marginBottom: "4px",
              background: isActive("dashboard") ? "rgba(99,102,241,0.12)" : "transparent",
              color: isActive("dashboard") ? "var(--indigo-light)" : "var(--text-secondary)",
              borderLeft: isActive("dashboard") ? "2px solid var(--indigo)" : "2px solid transparent",
            }}
          >
            <LayoutDashboard size={18} />
            Dashboard
          </button>

          {/* New Case (Enforce RBAC Auditor Block) */}
          <button
            onClick={() => navigate({ name: "new-case" })}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: "12px",
              padding: "10px 12px", borderRadius: "8px", border: "none",
              cursor: isAuditor ? "not-allowed" : "pointer", fontSize: "14px",
              fontWeight: isActive("new-case") ? 600 : 400,
              marginBottom: "4px",
              background: isActive("new-case") ? "rgba(99,102,241,0.12)" : "transparent",
              color: isAuditor ? "var(--text-muted)" : isActive("new-case") ? "var(--indigo-light)" : "var(--text-secondary)",
              borderLeft: isActive("new-case") ? "2px solid var(--indigo)" : "2px solid transparent",
              opacity: isAuditor ? 0.6 : 1,
            }}
            title={isAuditor ? "New case uploads are blocked for Read-Only Auditors" : "Open case entry form"}
          >
            {isAuditor ? <Lock size={18} /> : <Plus size={18} />}
            <span>New Case</span>
            {isAuditor && (
              <span style={{
                marginLeft: "auto", fontSize: 9, fontWeight: 700, padding: "1px 6px",
                borderRadius: 4, background: "#ef444415", color: "#ef4444"
              }}>RO</span>
            )}
          </button>

          <button
            onClick={() => navigate({ name: "executive" })}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: "12px",
              padding: "10px 12px", borderRadius: "8px", border: "none",
              cursor: "pointer", fontSize: "14px",
              fontWeight: isActive("executive") ? 600 : 400,
              marginBottom: "4px",
              background: isActive("executive") ? "rgba(99,102,241,0.12)" : "transparent",
              color: isActive("executive") ? "var(--indigo-light)" : "var(--text-secondary)",
              borderLeft: isActive("executive") ? "2px solid var(--indigo)" : "2px solid transparent",
            }}
          >
            <BarChart3 size={18} />
            Executive View
          </button>

          <button
            onClick={() => navigate({ name: "geo" })}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: "12px",
              padding: "10px 12px", borderRadius: "8px", border: "none",
              cursor: "pointer", fontSize: "14px",
              fontWeight: isActive("geo") ? 600 : 400,
              marginBottom: "4px",
              background: isActive("geo") ? "rgba(99,102,241,0.12)" : "transparent",
              color: isActive("geo") ? "var(--indigo-light)" : "var(--text-secondary)",
              borderLeft: isActive("geo") ? "2px solid var(--indigo)" : "2px solid transparent",
            }}
          >
            <MapPin size={18} />
            Geo Intelligence
          </button>

          {/* Admin logs route */}
          {isAdmin && (
            <button
              onClick={() => navigate({ name: "admin-logs" })}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: "12px",
                padding: "10px 12px", borderRadius: "8px", border: "none",
                cursor: "pointer", fontSize: "14px",
                fontWeight: isActive("admin-logs") ? 600 : 400,
                marginBottom: "4px",
                background: isActive("admin-logs") ? "rgba(239,68,68,0.08)" : "transparent",
                color: isActive("admin-logs") ? "#fca5a5" : "var(--text-secondary)",
                borderLeft: isActive("admin-logs") ? "2px solid #ef4444" : "2px solid transparent",
              }}
            >
              <ShieldAlert size={18} color="#ef4444" />
              <span style={{ color: isActive("admin-logs") ? "#ef4444" : "var(--text-secondary)" }}>Audit Logs</span>
            </button>
          )}
        </nav>

        {/* Footer Panel */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-subtle)" }}>
          {/* Expiry Countdown Widget */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: secondsRemaining <= 300 ? "#ef444410" : "rgba(99,102,241,0.06)",
            border: `1px solid ${secondsRemaining <= 300 ? "#ef444430" : "var(--border-subtle)"}`,
            padding: "8px 10px", borderRadius: 8, marginBottom: 12
          }}>
            <Clock size={12} color={secondsRemaining <= 300 ? "#ef4444" : "var(--indigo-light)"} />
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: secondsRemaining <= 300 ? "#ef4444" : "var(--text-secondary)"
            }}>
              Session Expiry: {formatTimeRemaining(secondsRemaining)}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {theme === "dark" ? "Dark Mode" : "Light Mode"}
            </span>
            <button
              onClick={toggleTheme}
              style={{
                width: 44, height: 24,
                borderRadius: 20,
                border: "1px solid var(--border-default)",
                background: theme === "dark" ? "#6366f120" : "#e2e8f0",
                cursor: "pointer", padding: "2px",
                display: "flex", alignItems: "center",
                transition: "all 0.3s",
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: "50%",
                background: theme === "dark"
                  ? "linear-gradient(135deg, #6366f1, #22d3ee)"
                  : "linear-gradient(135deg, #f59e0b, #f97316)",
                transform: theme === "dark" ? "translateX(0)" : "translateX(20px)",
                transition: "transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {theme === "dark" ? <Moon size={10} color="white" /> : <Sun size={10} color="white" />}
              </div>
            </button>
          </div>

          <button
            onClick={handleLogout}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 8,
              padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border-subtle)",
              background: "transparent", color: "var(--text-muted)",
              fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.2s",
              marginBottom: 10,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "#ef444412";
              e.currentTarget.style.borderColor = "#ef444440";
              e.currentTarget.style.color = "#ef4444";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "var(--border-subtle)";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            <LogOut size={13} /> Sign Out
          </button>

          <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "3px" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--approve)", flexShrink: 0 }} />
              <span>Offline · RBI Compliant</span>
            </div>
            <div>AI: gemma4 via Ollama</div>
            <div style={{ marginTop: 4, color: "var(--indigo-light)", fontWeight: 600 }}>Team Sukaksha</div>
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────── */}
      <main className="main-content">
        {/* Enforce RBAC block for Auditor in Case Creator page */}
        {page.name === "new-case" && isAuditor ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            height: "100%", padding: "40px"
          }}>
            <div style={{
              background: "var(--bg-card)", border: "1px solid #ef444440",
              padding: "40px", borderRadius: 16, maxWidth: 480, textAlign: "center",
              boxShadow: "0 10px 30px rgba(239, 68, 68, 0.05)"
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%", background: "#ef444415",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 20px"
              }}>
                <Lock size={32} color="#ef4444" />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 12 }}>
                Access Restricted
              </h2>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 24 }}>
                Your account is registered as a **Read-Only Auditor**. You do not have sufficient permissions to create new loan cases or submit document packages.
              </p>
              <button
                onClick={() => navigate({ name: "dashboard" })}
                style={{
                  padding: "10px 24px", borderRadius: 10, border: "none",
                  background: "linear-gradient(135deg, #6366f1, #22d3ee)", color: "white",
                  fontSize: 14, fontWeight: 700, cursor: "pointer"
                }}
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        ) : (
          <>
            {page.name === "dashboard" && (
              <Dashboard onOpenCase={(id) => navigate({ name: "case-report", caseId: id })} onNewCase={() => navigate({ name: "new-case" })} />
            )}
            {page.name === "new-case" && (
              <NewCase onCaseCreated={(id) => navigate({ name: "case-report", caseId: id })} />
            )}
            {page.name === "case-report" && (
              <CaseReport caseId={page.caseId} onBack={() => navigate({ name: "dashboard" })} />
            )}
            {page.name === "graph" && <GraphView />}
            {page.name === "executive" && <ExecutiveView />}
            {page.name === "geo" && <GeoIntelligence />}
            {page.name === "admin-logs" && <AuditLogsView />}
          </>
        )}
      </main>
    </div>
  );
}
