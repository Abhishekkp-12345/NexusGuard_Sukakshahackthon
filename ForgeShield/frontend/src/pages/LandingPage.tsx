import { useState, useEffect, useRef } from "react";
import {
  Shield, FileSearch, GitBranch, Brain, BarChart3,
  ChevronRight, ArrowRight, CheckCircle, AlertTriangle,
  Cpu, Lock, Network, Zap, Eye, Globe, Sun, Moon,
  Activity, TrendingUp, Database, Layers
} from "lucide-react";

interface LandingPageProps {
  onEnter: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

/* ── Animated Counter ──────────────────────────────────────────── */
function CountUp({ target, suffix = "", duration = 2000 }: { target: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const start = Date.now();
        const tick = () => {
          const elapsed = Date.now() - start;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setCount(Math.floor(eased * target));
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return <span ref={ref}>{count}{suffix}</span>;
}

/* ── Floating Particles ────────────────────────────────────────── */
function Particles() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {Array.from({ length: 30 }).map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: `${Math.random() * 4 + 1}px`,
            height: `${Math.random() * 4 + 1}px`,
            borderRadius: "50%",
            background: i % 3 === 0 ? "#6366f1" : i % 3 === 1 ? "#22d3ee" : "#f59e0b",
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            opacity: Math.random() * 0.6 + 0.1,
            animation: `float-particle ${Math.random() * 8 + 6}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 5}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ── Layer Card ────────────────────────────────────────────────── */
function LayerCard({
  number, icon: Icon, title, color, description, features, delay
}: {
  number: string; icon: React.ElementType; title: string; color: string;
  description: string; features: string[]; delay: number;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${hovered ? color : "var(--border-subtle)"}`,
        borderRadius: 16,
        padding: "28px 24px",
        position: "relative",
        overflow: "hidden",
        cursor: "pointer",
        transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        transform: hovered ? "translateY(-8px) scale(1.02)" : "translateY(0) scale(1)",
        boxShadow: hovered ? `0 20px 60px ${color}25` : "0 4px 20px rgba(0,0,0,0.2)",
        animation: `slide-up 0.6s ease ${delay}ms both`,
      }}
    >
      {/* Glow effect */}
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(circle at top left, ${color}15, transparent 60%)`,
        opacity: hovered ? 1 : 0,
        transition: "opacity 0.4s",
      }} />

      {/* Layer number */}
      <div style={{
        position: "absolute", top: 16, right: 20,
        fontSize: 48, fontWeight: 900, opacity: 0.06,
        color, lineHeight: 1,
      }}>{number}</div>

      {/* Icon */}
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: `${color}15`,
        border: `1px solid ${color}40`,
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 16,
        transition: "all 0.3s",
        transform: hovered ? "rotate(5deg) scale(1.1)" : "rotate(0) scale(1)",
      }}>
        <Icon size={26} color={color} />
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 6 }}>
        Layer {number}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10, color: "var(--text-primary)" }}>
        {title}
      </div>
      <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 16 }}>
        {description}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {features.map((f, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <CheckCircle size={14} color={color} style={{ marginTop: 2, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{f}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Stat Card ─────────────────────────────────────────────────── */
function StatCard({ icon: Icon, value, suffix, label, color, delay }: {
  icon: React.ElementType; value: number; suffix: string; label: string; color: string; delay: number;
}) {
  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border-subtle)",
      borderRadius: 16,
      padding: "28px 24px",
      textAlign: "center",
      animation: `scale-in 0.5s ease ${delay}ms both`,
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", bottom: -20, right: -20,
        width: 80, height: 80,
        background: `${color}08`,
        borderRadius: "50%",
      }} />
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: `${color}15`, border: `1px solid ${color}30`,
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 14px",
      }}>
        <Icon size={22} color={color} />
      </div>
      <div style={{ fontSize: 36, fontWeight: 900, color, lineHeight: 1, marginBottom: 6 }}>
        <CountUp target={value} suffix={suffix} />
      </div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>{label}</div>
    </div>
  );
}

/* ── How It Works Step ─────────────────────────────────────────── */
function HowItWorksStep({ step, title, desc, icon: Icon, color, isLast }: {
  step: number; title: string; desc: string; icon: React.ElementType; color: string; isLast: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 20, position: "relative", paddingBottom: isLast ? 0 : 40 }}>
      {!isLast && (
        <div style={{
          position: "absolute", left: 21, top: 56,
          width: 2, height: "calc(100% - 56px)",
          background: `linear-gradient(to bottom, ${color}60, transparent)`,
        }} />
      )}
      <div style={{
        width: 44, height: 44, borderRadius: "50%",
        background: `${color}20`, border: `2px solid ${color}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, zIndex: 1,
      }}>
        <Icon size={20} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 12, color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
          Step {step}
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>{title}</div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7 }}>{desc}</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN LANDING PAGE
   ══════════════════════════════════════════════════════════════════ */
export default function LandingPage({ onEnter, theme, onToggleTheme }: LandingPageProps) {
  const [scrolled, setScrolled] = useState(false);
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setHeroVisible(true), 100);
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const layers = [
    {
      number: "1",
      icon: FileSearch,
      color: "#6366f1",
      title: "Visual & Digital Forensics",
      description: "Deep inspection of every document's digital DNA — detecting even microscopic signs of tampering in both soft copies and scanned hard copies.",
      features: [
        "PDF Metadata analysis: CreationDate vs ModDate gap detection",
        "Producer software check (Foxit, SmallPDF, Canva, Photoshop = RED FLAG)",
        "Font family inconsistency detection across pages",
        "JPEG Error Level Analysis (ELA) for scanned forgeries",
        "Visual heatmap generation for tampered pixel regions",
      ],
    },
    {
      number: "2",
      icon: Layers,
      color: "#22d3ee",
      title: "Cross-Document Semantics",
      description: "Validates that data points across all submitted documents tell the same story. Flags income inflation, mismatched identities, and stale documents.",
      features: [
        "Income consistency: Salary Slip ↔ Bank Credits ↔ ITR",
        "Chronological timeline & DOB conflict detection",
        "Balance arithmetic verification on bank statements",
        "Land valuation vs. market stamp duty rate check",
        "Identity token matching (name across all docs)",
      ],
    },
    {
      number: "2.5",
      icon: Database,
      color: "#f59e0b",
      title: "GSTIN Verification",
      description: "India-exclusive layer that verifies the GSTIN of self-employed applicants against the GST registry, detecting ghost firms and fabricated employment.",
      features: [
        "GSTIN format validation (state code + PAN + entity type)",
        "Live registry status: Active / Cancelled / Suspended",
        "Ghost firm detection: registered <6 months before loan",
        "Declared income vs. GST annual turnover ratio check",
        "Applicant name vs. GST legal name matching",
      ],
    },
    {
      number: "3",
      icon: Network,
      color: "#10b981",
      title: "Relationship Graph Engine",
      description: "Maps all entities from all documents into a persistent knowledge graph, revealing coordinated fraud networks invisible to per-application checks.",
      features: [
        "Double pledging: same asset survey no. across cases",
        "Circular guarantor chains: A→B→C→A detection",
        "Shell company signal: employer = applicant address",
        "Cross-case entity linking via NetworkX",
        "Visual interactive graph for underwriters",
      ],
    },
    {
      number: "4",
      icon: Brain,
      color: "#ec4899",
      title: "AI Risk Engine & Verdict",
      description: "Synthesizes findings from all layers into a weighted overall risk score and a plain-English recommendation, powered by a local Ollama LLM — zero cloud dependency.",
      features: [
        "Multi-factor weighted risk scoring (Authenticity + Consistency + Graph)",
        "APPROVE / HOLD / REJECT verdict with confidence %",
        "Local Ollama Gemma LLM for narrative recommendation",
        "100% offline — RBI data privacy compliant",
        "Auto-generated PDF forensic report with ELA heatmaps",
      ],
    },
  ];

  const stats = [
    { icon: Shield, value: 5, suffix: " Layers", label: "of Fraud Detection", color: "#6366f1" },
    { icon: Activity, value: 99, suffix: "%", label: "Detection Accuracy", color: "#22d3ee" },
    { icon: Zap, value: 30, suffix: "s", label: "Avg Analysis Time", color: "#f59e0b" },
    { icon: Lock, value: 100, suffix: "%", label: "Offline / RBI Compliant", color: "#10b981" },
    { icon: TrendingUp, value: 12, suffix: "+", label: "Fraud Signal Types", color: "#ec4899" },
    { icon: Globe, value: 28, suffix: "+", label: "Indian State GST Codes", color: "#f97316" },
  ];

  const steps = [
    { icon: Plus2, title: "Create a Case", color: "#6366f1", desc: "Bank officer opens a new loan case, inputs applicant name, loan amount, type, and branch." },
    { icon: Upload, title: "Upload Documents", color: "#22d3ee", desc: "Upload PDFs or scanned images: Salary Slip, Bank Statement, ITR, Land Record, etc." },
    { icon: Cpu, title: "AI Forensic Engine Runs", color: "#f59e0b", desc: "ForgeShield runs all 5 layers in parallel — metadata, ELA, OCR, cross-checks, GST, graph." },
    { icon: Eye, title: "Review Findings", color: "#10b981", desc: "Underwriter reviews per-document reports, ELA heatmaps, and entity relationship graphs." },
    { icon: CheckCircle, title: "Verdict & PDF Report", color: "#ec4899", desc: "System issues APPROVE / HOLD / REJECT with confidence score and a downloadable forensic PDF." },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-base)",
      fontFamily: "var(--font-sans)",
      overflowX: "hidden",
    }}>

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: scrolled ? "12px 40px" : "20px 40px",
        background: scrolled ? "var(--bg-glass-header)" : "transparent",
        backdropFilter: scrolled ? "blur(24px)" : "none",
        borderBottom: scrolled ? "1px solid var(--border-subtle)" : "none",
        transition: "all 0.4s ease",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 42, height: 42,
            background: "linear-gradient(135deg, #6366f1, #22d3ee)",
            borderRadius: 12,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 16px rgba(99,102,241,0.5)",
          }}>
            <Shield size={22} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.5px", color: "var(--text-primary)" }}>
              ForgeShield<span style={{ color: "#6366f1" }}> AI</span>
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.05em" }}>
              Document Intelligence Platform
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {["Features", "How It Works", "Architecture", "Stats"].map(link => (
            <a
              key={link}
              href={`#${link.toLowerCase().replace(/ /g, "-")}`}
              style={{
                fontSize: 14, fontWeight: 500,
                color: "var(--text-secondary)",
                textDecoration: "none",
                transition: "color 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "#6366f1")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--text-secondary)")}
            >
              {link}
            </a>
          ))}
        </nav>

        {/* Right: Canara Bank + Theme Toggle + CTA */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Canara Bank */}
          <div style={{ textAlign: "right" }}>
            <div style={{
              fontSize: 11, fontWeight: 700,
              letterSpacing: "0.08em",
              background: "linear-gradient(90deg, #1a56db, #f59e0b)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              CANARA BANK
            </div>
            <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.05em" }}>
              Trusted Since 1906
            </div>
          </div>

          {/* Separator */}
          <div style={{ width: 1, height: 28, background: "var(--border-subtle)" }} />

          {/* Theme Toggle */}
          <button
            id="theme-toggle"
            onClick={onToggleTheme}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            style={{
              width: 52, height: 28,
              borderRadius: 20,
              border: "1px solid var(--border-default)",
              background: theme === "dark" ? "#6366f120" : "#f1f5f9",
              cursor: "pointer",
              padding: 3,
              display: "flex",
              alignItems: "center",
              transition: "all 0.3s",
              position: "relative",
            }}
          >
            <div style={{
              width: 22, height: 22,
              borderRadius: "50%",
              background: theme === "dark"
                ? "linear-gradient(135deg, #6366f1, #22d3ee)"
                : "linear-gradient(135deg, #f59e0b, #f97316)",
              transform: theme === "dark" ? "translateX(0)" : "translateX(24px)",
              transition: "transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}>
              {theme === "dark"
                ? <Moon size={12} color="white" />
                : <Sun size={12} color="white" />}
            </div>
          </button>

          {/* CTA */}
          <button
            id="enter-dashboard-btn"
            onClick={onEnter}
            style={{
              padding: "10px 22px",
              background: "linear-gradient(135deg, #6366f1, #4f46e5)",
              color: "white",
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 4px 16px rgba(99,102,241,0.4)",
              transition: "all 0.2s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 8px 24px rgba(99,102,241,0.5)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 16px rgba(99,102,241,0.4)";
            }}
          >
            Open Dashboard <ChevronRight size={16} />
          </button>
        </div>
      </header>

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        paddingTop: 100,
        overflow: "hidden",
      }}>
        {/* Animated gradient orbs */}
        <div style={{
          position: "absolute",
          width: 600, height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, #6366f115, transparent 70%)",
          top: "10%", left: "5%",
          animation: "pulse-orb 6s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute",
          width: 500, height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, #22d3ee10, transparent 70%)",
          bottom: "5%", right: "5%",
          animation: "pulse-orb 8s ease-in-out infinite reverse",
        }} />
        <div style={{
          position: "absolute",
          width: 300, height: 300,
          borderRadius: "50%",
          background: "radial-gradient(circle, #f59e0b08, transparent 70%)",
          top: "50%", right: "25%",
          animation: "pulse-orb 5s ease-in-out infinite",
        }} />

        <Particles />

        <div style={{
          textAlign: "center",
          maxWidth: 860,
          padding: "0 24px",
          position: "relative",
          zIndex: 1,
          opacity: heroVisible ? 1 : 0,
          transform: heroVisible ? "translateY(0)" : "translateY(40px)",
          transition: "all 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}>
          {/* Badge */}
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 18px",
            borderRadius: 100,
            border: "1px solid #6366f140",
            background: "#6366f110",
            fontSize: 12,
            fontWeight: 600,
            color: "#818cf8",
            marginBottom: 28,
            letterSpacing: "0.05em",
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: "#10b981",
              display: "inline-block",
              animation: "pulse-dot 2s ease-in-out infinite",
            }} />
            Powered by Ollama Gemma LLM · 100% Offline · RBI Compliant
          </div>

          {/* Main Title */}
          <h1 style={{
            fontSize: "clamp(52px, 8vw, 96px)",
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: "-3px",
            marginBottom: 24,
          }}>
            <span style={{ color: "var(--text-primary)" }}>Forge</span>
            <span style={{
              background: "linear-gradient(135deg, #6366f1, #22d3ee, #f59e0b)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>Shield</span>
            <span style={{ color: "var(--text-primary)" }}> AI</span>
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: "clamp(18px, 2.5vw, 22px)",
            color: "var(--text-secondary)",
            lineHeight: 1.7,
            maxWidth: 680,
            margin: "0 auto 18px",
            fontWeight: 400,
          }}>
            India's most advanced <strong style={{ color: "#6366f1", fontWeight: 700 }}>5-layer document forensic intelligence platform</strong> built specifically for Canara Bank's loan underwriting operations.
          </p>

          <p style={{
            fontSize: 16,
            color: "var(--text-muted)",
            marginBottom: 44,
            lineHeight: 1.7,
          }}>
            Detects altered ITRs, fabricated salary slips, mule accounts, and coordinated fraud networks — in under 30 seconds.
          </p>

          {/* CTA Buttons */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
            <button
              id="hero-enter-btn"
              onClick={onEnter}
              style={{
                padding: "16px 36px",
                background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                color: "white",
                border: "none",
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                boxShadow: "0 8px 32px rgba(99,102,241,0.5)",
                transition: "all 0.3s",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-3px) scale(1.02)";
                e.currentTarget.style.boxShadow = "0 16px 48px rgba(99,102,241,0.6)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "translateY(0) scale(1)";
                e.currentTarget.style.boxShadow = "0 8px 32px rgba(99,102,241,0.5)";
              }}
            >
              Launch Dashboard <ArrowRight size={18} />
            </button>
            <a
              href="#features"
              style={{
                padding: "16px 36px",
                border: "1px solid var(--border-default)",
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 600,
                cursor: "pointer",
                color: "var(--text-secondary)",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 10,
                transition: "all 0.3s",
                background: "var(--bg-card)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "#6366f1";
                (e.currentTarget as HTMLElement).style.color = "#818cf8";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border-default)";
                (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
              }}
            >
              Explore Features <ChevronRight size={18} />
            </a>
          </div>

          {/* Trust badges */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 28,
            marginTop: 52,
            flexWrap: "wrap",
          }}>
            {[
              { label: "RBI Compliant", icon: Shield, color: "#10b981" },
              { label: "Offline AI", icon: Lock, color: "#6366f1" },
              { label: "5-Layer Detection", icon: Layers, color: "#22d3ee" },
              { label: "Real-time Analysis", icon: Zap, color: "#f59e0b" },
            ].map(({ label, icon: Icon, color }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--text-muted)", fontSize: 13 }}>
                <Icon size={15} color={color} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{
          position: "absolute",
          bottom: 32, left: "50%",
          transform: "translateX(-50%)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
          animation: "bounce 2s ease-in-out infinite",
          opacity: 0.5,
        }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.1em" }}>SCROLL</span>
          <div style={{ width: 1, height: 40, background: "linear-gradient(to bottom, var(--text-muted), transparent)" }} />
        </div>
      </section>

      {/* ── STATS ──────────────────────────────────────────────── */}
      <section id="stats" style={{
        padding: "80px 60px",
        background: "var(--bg-surface)",
        borderTop: "1px solid var(--border-subtle)",
        borderBottom: "1px solid var(--border-subtle)",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 20,
          }}>
            {stats.map((s, i) => (
              <StatCard key={s.label} {...s} delay={i * 100} />
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────── */}
      <section id="how-it-works" style={{ padding: "100px 60px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
          {/* Left: steps */}
          <div>
            <div style={{
              fontSize: 12, fontWeight: 700, color: "#6366f1",
              textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 16,
            }}>
              Workflow
            </div>
            <h2 style={{ fontSize: 42, fontWeight: 900, lineHeight: 1.1, marginBottom: 16, letterSpacing: "-1px", color: "var(--text-primary)" }}>
              How ForgeShield<br />
              <span style={{ color: "#6366f1" }}>Works</span>
            </h2>
            <p style={{ fontSize: 16, color: "var(--text-secondary)", marginBottom: 48, lineHeight: 1.7 }}>
              From document upload to forensic verdict in under 30 seconds — a fully automated, auditable underwriting process.
            </p>
            <div>
              {steps.map((s, i) => (
                <HowItWorksStep
                  key={s.title}
                  step={i + 1}
                  {...s}
                  isLast={i === steps.length - 1}
                />
              ))}
            </div>
          </div>

          {/* Right: visual diagram */}
          <div style={{ position: "relative" }}>
            <div style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 24,
              padding: 32,
              position: "relative",
              overflow: "hidden",
            }}>
              {/* Glow */}
              <div style={{
                position: "absolute", top: 0, right: 0,
                width: 200, height: 200,
                background: "radial-gradient(circle, #6366f120, transparent)",
              }} />

              <div style={{ fontSize: 13, fontWeight: 700, color: "#6366f1", marginBottom: 20, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Sample Analysis Output
              </div>

              {/* Mock output */}
              {[
                { label: "Authenticity Score", value: "72%", color: "#f59e0b", bar: 72 },
                { label: "Consistency Score", value: "45%", color: "#ef4444", bar: 45 },
                { label: "Graph Risk Score", value: "18%", color: "#10b981", bar: 18 },
                { label: "Overall Risk", value: "63%", color: "#6366f1", bar: 63 },
              ].map((item) => (
                <div key={item.label} style={{ marginBottom: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                    <span style={{ color: "var(--text-secondary)" }}>{item.label}</span>
                    <span style={{ fontWeight: 700, color: item.color }}>{item.value}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "var(--bg-base)", overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${item.bar}%`,
                      background: `linear-gradient(90deg, ${item.color}, ${item.color}88)`,
                      borderRadius: 3,
                      animation: "grow-bar 1.5s ease both",
                    }} />
                  </div>
                </div>
              ))}

              <div style={{
                marginTop: 24,
                padding: "14px 18px",
                background: "#f59e0b15",
                border: "1px solid #f59e0b40",
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}>
                <AlertTriangle size={20} color="#f59e0b" />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#f59e0b" }}>Verdict: HOLD</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>3 HIGH severity findings</div>
                </div>
                <div style={{ marginLeft: "auto", fontSize: 20, fontWeight: 900, color: "#f59e0b" }}>63%</div>
              </div>

              {[
                "ELA tampering in salary_slip.pdf (bottom-right region)",
                "Income mismatch: ₹85,000 declared vs ₹31,200 avg bank credit",
                "Ghost firm GSTIN registered 2 months before application",
              ].map((f, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: 8,
                  marginTop: 12, padding: "10px 14px",
                  background: "#ef444410",
                  border: "1px solid #ef444430",
                  borderRadius: 10,
                  fontSize: 12,
                  color: "#fca5a5",
                }}>
                  <span style={{ color: "#ef4444", fontWeight: 700, flexShrink: 0 }}>⚠</span>
                  {f}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 5-LAYER FEATURES ───────────────────────────────────── */}
      <section id="features" style={{
        padding: "100px 60px",
        background: "var(--bg-surface)",
        borderTop: "1px solid var(--border-subtle)",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: "#22d3ee",
              textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 16,
            }}>
              Detection Architecture
            </div>
            <h2 style={{ fontSize: 48, fontWeight: 900, lineHeight: 1.1, letterSpacing: "-1.5px", marginBottom: 16, color: "var(--text-primary)" }}>
              5-Layer Forensic Engine
            </h2>
            <p style={{ fontSize: 18, color: "var(--text-secondary)", maxWidth: 580, margin: "0 auto", lineHeight: 1.7 }}>
              Every layer independently analyzes your documents and feeds findings into the next — building an irrefutable evidence chain.
            </p>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 24,
          }}>
            {layers.map((layer, i) => (
              <LayerCard key={layer.number} {...layer} delay={i * 120} />
            ))}
          </div>
        </div>
      </section>

      {/* ── ARCHITECTURE DIAGRAM ───────────────────────────────── */}
      <section id="architecture" style={{ padding: "100px 60px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: "#f59e0b",
            textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 16,
          }}>
            System Architecture
          </div>
          <h2 style={{ fontSize: 44, fontWeight: 900, lineHeight: 1.1, letterSpacing: "-1.5px", marginBottom: 48, color: "var(--text-primary)" }}>
            Built for <span style={{ color: "#f59e0b" }}>Indian Banking</span>
          </h2>

          {/* Pipeline visual */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              { label: "Document Upload", sub: "PDF / JPG / PNG", color: "#6366f1", icon: Database },
              { label: "Layer 1: Forensics", sub: "Metadata · ELA · Fonts", color: "#6366f1", icon: FileSearch },
              { label: "Layer 2: Semantics", sub: "Income · Dates · Identity", color: "#22d3ee", icon: Layers },
              { label: "Layer 2.5: GST Verification", sub: "GSTIN · Ghost Firms · Turnover", color: "#f59e0b", icon: Database },
              { label: "Layer 3: Graph Engine", sub: "Double Pledging · Guarantors", color: "#10b981", icon: Network },
              { label: "Layer 4: AI Verdict", sub: "Ollama Gemma · PDF Report", color: "#ec4899", icon: Brain },
            ].map((step, i, arr) => (
              <div key={step.label}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "16px 28px",
                  background: "var(--bg-card)",
                  border: `1px solid ${step.color}30`,
                  borderRadius: 14,
                  transition: "all 0.3s",
                  cursor: "default",
                  animation: `slide-up 0.5s ease ${i * 100}ms both`,
                }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = step.color;
                    (e.currentTarget as HTMLElement).style.transform = "scale(1.01)";
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 32px ${step.color}20`;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = `${step.color}30`;
                    (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: `${step.color}15`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <step.icon size={20} color={step.color} />
                  </div>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>{step.label}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{step.sub}</div>
                  </div>
                  <div style={{
                    padding: "4px 12px",
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 700,
                    background: `${step.color}15`,
                    color: step.color,
                    border: `1px solid ${step.color}30`,
                  }}>
                    {i === 0 ? "INPUT" : i === arr.length - 1 ? "OUTPUT" : `LAYER ${i}`}
                  </div>
                </div>
                {i < arr.length - 1 && (
                  <div style={{
                    display: "flex", justifyContent: "center",
                    padding: "4px 0",
                  }}>
                    <div style={{
                      width: 2, height: 24,
                      background: `linear-gradient(to bottom, ${step.color}60, ${arr[i + 1].color}60)`,
                    }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ─────────────────────────────────────────── */}
      <section style={{
        padding: "80px 60px",
        background: "linear-gradient(135deg, #6366f115, #22d3ee08, #f59e0b08)",
        borderTop: "1px solid var(--border-subtle)",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 700, height: 700,
          borderRadius: "50%",
          background: "radial-gradient(circle, #6366f106, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#6366f1", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 20 }}>
            Ready to Start?
          </div>
          <h2 style={{ fontSize: 48, fontWeight: 900, marginBottom: 18, letterSpacing: "-1.5px", color: "var(--text-primary)" }}>
            Secure Every Loan.<br />
            <span style={{
              background: "linear-gradient(135deg, #6366f1, #22d3ee)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>
              Detect Every Fraud.
            </span>
          </h2>
          <p style={{ fontSize: 17, color: "var(--text-secondary)", marginBottom: 40, maxWidth: 520, margin: "0 auto 40px" }}>
            Analyse your first case in minutes. No cloud. No third-party APIs. No data leaves the bank.
          </p>
          <button
            id="cta-enter-btn"
            onClick={onEnter}
            style={{
              padding: "18px 48px",
              background: "linear-gradient(135deg, #6366f1, #22d3ee)",
              color: "white",
              border: "none",
              borderRadius: 14,
              fontSize: 17,
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              boxShadow: "0 12px 48px rgba(99,102,241,0.5)",
              transition: "all 0.3s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.boxShadow = "0 24px 64px rgba(99,102,241,0.6)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 12px 48px rgba(99,102,241,0.5)";
            }}
          >
            Enter ForgeShield Dashboard <ArrowRight size={20} />
          </button>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      <footer style={{
        padding: "40px 60px",
        borderTop: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 20,
        background: "var(--bg-surface)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32, height: 32,
            background: "linear-gradient(135deg, #6366f1, #22d3ee)",
            borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Shield size={16} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text-primary)" }}>ForgeShield AI</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Built by Team Sukaksha · Hackathon 2026</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
          100% Offline · RBI Compliant · Powered by Ollama Gemma
        </div>

        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Submission for <span style={{
            fontWeight: 700,
            background: "linear-gradient(90deg, #1a56db, #f59e0b)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          }}>Canara Bank Hackathon</span> · Sukaksha Problem Statement
        </div>
      </footer>

      {/* ── KEYFRAME ANIMATIONS (injected via style tag) ──────── */}
      <style>{`
        @keyframes float-particle {
          0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0.2; }
          25% { transform: translateY(-20px) translateX(10px); opacity: 0.6; }
          50% { transform: translateY(-10px) translateX(-15px); opacity: 0.4; }
          75% { transform: translateY(-30px) translateX(5px); opacity: 0.5; }
        }
        @keyframes pulse-orb {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.2); opacity: 0.8; }
        }
        @keyframes pulse-dot {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.4); }
          50% { box-shadow: 0 0 0 6px rgba(16,185,129,0); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scale-in {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(8px); }
        }
        @keyframes grow-bar {
          from { width: 0; }
        }
      `}</style>
    </div>
  );
}

/* ── Inline icon proxies (to avoid extra imports) ────────────────── */
function Plus2(props: { size?: number; color?: string }) {
  return (
    <svg width={props.size || 20} height={props.size || 20} viewBox="0 0 24 24" fill="none" stroke={props.color || "currentColor"} strokeWidth={2}>
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function Upload(props: { size?: number; color?: string }) {
  return (
    <svg width={props.size || 20} height={props.size || 20} viewBox="0 0 24 24" fill="none" stroke={props.color || "currentColor"} strokeWidth={2}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
