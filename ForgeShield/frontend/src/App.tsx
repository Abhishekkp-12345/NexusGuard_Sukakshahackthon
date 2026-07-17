import { useState } from "react";
import {
  LayoutDashboard, Plus, BarChart3,
  Shield, Network, MapPin
} from "lucide-react";
import "./index.css";

import Dashboard from "./pages/Dashboard.tsx";
import NewCase from "./pages/NewCase.tsx";
import CaseReport from "./pages/CaseReport.tsx";
import GraphView from "./pages/GraphView.tsx";
import ExecutiveView from "./pages/ExecutiveView.tsx";
import GeoIntelligence from "./pages/GeoIntelligence.tsx";

type Page =
  | { name: "dashboard" }
  | { name: "new-case" }
  | { name: "case-report"; caseId: string }
  | { name: "graph" }
  | { name: "executive" }
  | { name: "geo" };

export default function App() {
  const [page, setPage] = useState<Page>({ name: "dashboard" });
  const navigate = (p: Page) => setPage(p);

  const navItems = [
    { name: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { name: "new-case", label: "New Case", icon: Plus },
    { name: "graph", label: "Relationship Graph", icon: Network },
    { name: "executive", label: "Executive View", icon: BarChart3 },
    { name: "geo", label: "Geo Intelligence", icon: MapPin },
  ] as const;

  const isActive = (name: string) => page.name === name;

  return (
    <div className="layout">
      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside className="sidebar">
        {/* Logo */}
        <div style={{
          padding: "24px 20px 20px",
          borderBottom: "1px solid var(--border-subtle)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: 40, height: 40,
              background: "linear-gradient(135deg, var(--indigo), var(--cyan-dark))",
              borderRadius: "10px",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(99,102,241,0.4)",
            }}>
              <Shield size={22} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.3px" }}>
                ForgeShield AI
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                Canara Bank | v1.0
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: "16px 12px", flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", padding: "0 8px 8px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Navigation
          </div>
          {navItems.map(({ name, label, icon: Icon }) => (
            <button
              key={name}
              onClick={() => navigate({ name } as Page)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: isActive(name) ? 600 : 400,
                marginBottom: "4px",
                transition: "all 0.15s",
                background: isActive(name)
                  ? "rgba(99,102,241,0.15)"
                  : "transparent",
                color: isActive(name)
                  ? "var(--indigo-light)"
                  : "var(--text-secondary)",
                borderLeft: isActive(name)
                  ? "2px solid var(--indigo)"
                  : "2px solid transparent",
              }}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div style={{
          padding: "16px 20px",
          borderTop: "1px solid var(--border-subtle)",
        }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--approve)" }} />
              <span>Offline — 100% RBI Compliant</span>
            </div>
            <div>AI: gemma4 via Ollama</div>
            <div style={{ marginTop: 6, color: "var(--indigo-light)", fontWeight: 600 }}>
              Team Sukaksha
            </div>
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
