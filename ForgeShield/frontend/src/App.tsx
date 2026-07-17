import { useState, useEffect } from "react";
import {
  LayoutDashboard, Plus, BarChart3,
  Shield, Network, MapPin, Sun, Moon, LogOut, User
} from "lucide-react";
import "./index.css";

import { initAuthStore, getSession, logout, type Session } from "./auth/AuthService";

import LoginPage from "./pages/LoginPage.tsx";
import LandingPage from "./pages/LandingPage.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import NewCase from "./pages/NewCase.tsx";
import CaseReport from "./pages/CaseReport.tsx";
import GraphView from "./pages/GraphView.tsx";
import ExecutiveView from "./pages/ExecutiveView.tsx";
import GeoIntelligence from "./pages/GeoIntelligence.tsx";

type AppPage =
  | { name: "landing" }
  | { name: "login" }
  | { name: "dashboard" }
  | { name: "new-case" }
  | { name: "case-report"; caseId: string }
  | { name: "graph" }
  | { name: "executive" }
  | { name: "geo" };

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [page, setPage] = useState<AppPage>({ name: "landing" });
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  /* ── Initialise auth store on first mount ──────────────────── */
  useEffect(() => {
    initAuthStore().then(() => {
      const existing = getSession();
      setSession(existing);
      setAuthReady(true);
    });
  }, []);

  /* ── Apply theme to root element ───────────────────────────── */
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");
  const navigate = (p: AppPage) => setPage(p);
  const isActive = (name: string) => page.name === name;

  const handleAuthenticated = (s: Session) => {
    setSession(s);
    setPage({ name: "dashboard" });  // after login → go straight to dashboard
  };

  const handleLogout = () => {
    logout();
    setSession(null);
    setPage({ name: "landing" });  // after logout → back to landing
  };

  // Called when user clicks "Enter Dashboard" on the landing page
  const handleLandingEnter = () => {
    if (session) {
      setPage({ name: "dashboard" }); // already logged in → skip login
    } else {
      setPage({ name: "login" });     // not logged in → show login
    }
  };

  /* ── Loading state while initialising ─────────────────────── */
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
            Initialising ForgeShield…
          </div>
        </div>
        <style>{`
          @keyframes pulse-init {
            0%, 100% { box-shadow: 0 8px 32px rgba(99,102,241,0.4); }
            50% { box-shadow: 0 8px 60px rgba(99,102,241,0.7); }
          }
        `}</style>
      </div>
    );
  }

  /* ── Step 1: Landing page — always shown first, publicly ──── */
  if (page.name === "landing") {
    return (
      <LandingPage
        onEnter={handleLandingEnter}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  /* ── Step 2: Login page — shown after clicking Enter ────────── */
  if (page.name === "login" || !session) {
    return (
      <LoginPage
        onAuthenticated={handleAuthenticated}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  /* ── Authenticated: Dashboard layout ───────────────────────── */
  const navItems = [
    { name: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { name: "new-case", label: "New Case", icon: Plus },
    { name: "graph", label: "Relationship Graph", icon: Network },
    { name: "executive", label: "Executive View", icon: BarChart3 },
    { name: "geo", label: "Geo Intelligence", icon: MapPin },
  ] as const;

  return (
    <div className="layout">
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

        {/* Logged-in user */}
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
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                {session.role.charAt(0).toUpperCase() + session.role.slice(1)} · {session.employeeId}
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: "16px 12px", flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", padding: "0 8px 8px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Navigation
          </div>

          <button
            onClick={() => navigate({ name: "landing" })}
            style={{
              width: "100%",
              display: "flex", alignItems: "center", gap: "12px",
              padding: "9px 12px",
              borderRadius: "8px", border: "none",
              cursor: "pointer", fontSize: "13px", fontWeight: 400,
              marginBottom: "2px", transition: "all 0.15s",
              background: "transparent", color: "var(--text-muted)",
              borderLeft: "2px solid transparent",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "rgba(99,102,241,0.08)";
              e.currentTarget.style.color = "var(--indigo-light)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            ← Home
          </button>

          {navItems.map(({ name, label, icon: Icon }) => (
            <button
              key={name}
              onClick={() => navigate({ name } as AppPage)}
              style={{
                width: "100%",
                display: "flex", alignItems: "center", gap: "12px",
                padding: "10px 12px",
                borderRadius: "8px", border: "none",
                cursor: "pointer", fontSize: "14px",
                fontWeight: isActive(name) ? 600 : 400,
                marginBottom: "4px", transition: "all 0.15s",
                background: isActive(name) ? "rgba(99,102,241,0.15)" : "transparent",
                color: isActive(name) ? "var(--indigo-light)" : "var(--text-secondary)",
                borderLeft: isActive(name) ? "2px solid var(--indigo)" : "2px solid transparent",
              }}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-subtle)" }}>
          {/* Theme toggle */}
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

          {/* Logout */}
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              display: "flex", alignItems: "center", gap: 8,
              padding: "9px 10px",
              borderRadius: 8, border: "1px solid var(--border-subtle)",
              background: "transparent",
              color: "var(--text-muted)",
              fontSize: 12, fontWeight: 500,
              cursor: "pointer", transition: "all 0.2s",
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
      </main>
    </div>
  );
}
