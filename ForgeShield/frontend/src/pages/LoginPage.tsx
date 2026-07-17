/**
 * ForgeShield AI — Secure Login Page
 * ====================================
 * Bank-grade two-factor authentication UI.
 * Step 1: Email + Password
 * Step 2: Time-based OTP (displayed inline since this is offline demo)
 * All authentication is 100% offline via Web Crypto API.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Shield, Lock, Eye, EyeOff, AlertTriangle, CheckCircle,
  Clock, User, ChevronRight, RefreshCw, LogIn, Fingerprint,
  Sun, Moon, Building2
} from "lucide-react";
import {
  login, completeLogin, generateOTP, getLockoutRemaining, getFailCount,
  type Session,
} from "../auth/AuthService";

/* ── Props ───────────────────────────────────────────────────────────── */
interface LoginPageProps {
  onAuthenticated: (session: Session) => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

/* ── Floating animated orb ───────────────────────────────────────────── */
function Orb({ cx, cy, size, color, delay }: { cx: string; cy: string; size: number; color: string; delay: number }) {
  return (
    <div style={{
      position: "absolute",
      left: cx, top: cy,
      width: size, height: size,
      borderRadius: "50%",
      background: `radial-gradient(circle, ${color}22, transparent 70%)`,
      animation: `orb-float ${6 + delay}s ease-in-out infinite`,
      animationDelay: `${delay}s`,
      pointerEvents: "none",
    }} />
  );
}

/* ── OTP Display Cell ────────────────────────────────────────────────── */
function OTPCell({ char, active }: { char: string; active: boolean }) {
  return (
    <div style={{
      width: 52, height: 60,
      borderRadius: 12,
      border: `2px solid ${active ? "#6366f1" : char ? "#6366f140" : "var(--border-subtle)"}`,
      background: char ? "#6366f110" : "var(--bg-card)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 24, fontWeight: 800,
      color: char ? "var(--text-primary)" : "var(--text-muted)",
      transition: "all 0.2s",
      boxShadow: active ? "0 0 0 3px #6366f130" : "none",
      letterSpacing: 0,
    }}>
      {char || ""}
    </div>
  );
}

/* ── Timer ring ──────────────────────────────────────────────────────── */
function OTPTimer({ secondsLeft, total }: { secondsLeft: number; total: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = circ * (secondsLeft / total);
  return (
    <div style={{ position: "relative", width: 52, height: 52 }}>
      <svg width={52} height={52} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={26} cy={26} r={r} fill="none" stroke="var(--border-subtle)" strokeWidth={3} />
        <circle
          cx={26} cy={26} r={r} fill="none"
          stroke={secondsLeft < 10 ? "#ef4444" : "#6366f1"}
          strokeWidth={3}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s linear, stroke 0.3s" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 800,
        color: secondsLeft < 10 ? "#ef4444" : "var(--text-primary)",
      }}>
        {secondsLeft}
      </div>
    </div>
  );
}

/* ── Main Login Page ─────────────────────────────────────────────────── */
export default function LoginPage({ onAuthenticated, theme, onToggleTheme }: LoginPageProps) {
  /* Step state */
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [pendingUserId, setPendingUserId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [liveOTP, setLiveOTP] = useState("");

  /* Form state */
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  /* UI state */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [shake, setShake] = useState(false);
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(60);
  const [lockedRemaining, setLockedRemaining] = useState(0);
  const [failCount, setFailCount] = useState(0);

  const otpRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  /* Focus email on mount */
  useEffect(() => { emailRef.current?.focus(); }, []);

  /* Lockout countdown */
  useEffect(() => {
    if (lockedRemaining <= 0) return;
    const id = setInterval(() => {
      setLockedRemaining(prev => {
        if (prev <= 1000) { clearInterval(id); return 0; }
        return prev - 1000;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [lockedRemaining]);

  /* OTP timer countdown */
  useEffect(() => {
    if (step !== "otp") return;
    const computeSecs = () => 60 - (Math.floor(Date.now() / 1000) % 60);
    setOtpSecondsLeft(computeSecs());
    const id = setInterval(() => {
      const secs = computeSecs();
      setOtpSecondsLeft(secs);
      if (secs === 60) {
        // New window — refresh displayed OTP
        setLiveOTP(generateOTP(pendingUserId));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [step, pendingUserId]);

  /* Generate live OTP when entering OTP step */
  useEffect(() => {
    if (step === "otp" && pendingUserId) {
      setLiveOTP(generateOTP(pendingUserId));
      setTimeout(() => otpRef.current?.focus(), 100);
    }
  }, [step, pendingUserId]);

  /* ── Trigger shake animation ───────────────────────────────────── */
  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  }, []);

  /* ── Step 1: Credential submit ─────────────────────────────────── */
  const handleCredentialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Please enter your email and password."); triggerShake(); return; }

    setLoading(true);
    setError("");

    const result = await login(email, password);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      triggerShake();
      if (result.lockedOut && result.remainingMs) {
        setLockedRemaining(result.remainingMs);
      }
      setFailCount(getFailCount(email.toLowerCase()));
      return;
    }

    setPendingUserId(result.userId);
    setStep("otp");
  };

  /* ── Step 2: OTP submit ────────────────────────────────────────── */
  const handleOTPSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) { setError("Enter the 6-digit OTP code."); triggerShake(); return; }

    setLoading(true);
    setError("");

    const result = completeLogin(pendingUserId, otpCode);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      triggerShake();
      setOtpCode("");
      return;
    }

    setSuccess(true);
    setTimeout(() => onAuthenticated(result.session), 1200);
  };

  const attemptsLeft = Math.max(0, 5 - failCount);
  const isLocked = lockedRemaining > 0;
  const lockedMinutes = Math.ceil(lockedRemaining / 60000);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-base)",
      display: "flex",
      alignItems: "stretch",
      fontFamily: "var(--font-sans)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* ── Background animated orbs ─────────────────────────────── */}
      <Orb cx="5%" cy="10%" size={500} color="#6366f1" delay={0} />
      <Orb cx="60%" cy="60%" size={400} color="#22d3ee" delay={2} />
      <Orb cx="80%" cy="5%" size={350} color="#f59e0b" delay={4} />
      <Orb cx="20%" cy="75%" size={300} color="#ec4899" delay={1.5} />

      {/* Animated grid lines */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `
          linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)
        `,
        backgroundSize: "50px 50px",
      }} />

      {/* ── Left side — Branding panel ──────────────────────────── */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "60px 64px",
        position: "relative",
        zIndex: 1,
        minWidth: 420,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 56 }}>
          <div style={{
            width: 52, height: 52,
            background: "linear-gradient(135deg, #6366f1, #22d3ee)",
            borderRadius: 14,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 32px rgba(99,102,241,0.5)",
          }}>
            <Shield size={28} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.5px", color: "var(--text-primary)" }}>
              ForgeShield <span style={{ color: "#6366f1" }}>AI</span>
            </div>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
              background: "linear-gradient(90deg, #1a56db, #f59e0b)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>
              CANARA BANK
            </div>
          </div>
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: "clamp(36px, 4vw, 52px)",
          fontWeight: 900, lineHeight: 1.1,
          letterSpacing: "-2px",
          marginBottom: 20,
          color: "var(--text-primary)",
        }}>
          Secure Access<br />
          <span style={{
            background: "linear-gradient(135deg, #6366f1, #22d3ee)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          }}>
            Portal
          </span>
        </h1>

        <p style={{ fontSize: 16, color: "var(--text-secondary)", lineHeight: 1.8, maxWidth: 380, marginBottom: 48 }}>
          This system is restricted to authorised Canara Bank personnel. All access attempts are logged and monitored in compliance with RBI IT Security guidelines.
        </p>

        {/* Security features */}
        {[
          { icon: Lock, label: "PBKDF2-SHA-256 password hashing", color: "#6366f1" },
          { icon: Fingerprint, label: "Two-factor offline OTP verification", color: "#22d3ee" },
          { icon: AlertTriangle, label: "Account lockout after 5 failed attempts", color: "#f59e0b" },
          { icon: Clock, label: "Session auto-expires on browser close", color: "#10b981" },
        ].map(({ icon: Icon, label, color }) => (
          <div key={label} style={{
            display: "flex", alignItems: "center", gap: 12,
            marginBottom: 14,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: `${color}15`,
              border: `1px solid ${color}30`,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <Icon size={15} color={color} />
            </div>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
          </div>
        ))}

        {/* Credentials hint */}
        <div style={{
          marginTop: 48,
          padding: "16px 20px",
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 14,
          maxWidth: 380,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
            Demo Credentials
          </div>
          {[
            { role: "Admin", email: "admin@canarabank.in", pwd: "Admin@ForgeShield2026" },
            { role: "Officer", email: "officer@canarabank.in", pwd: "Officer@Canara2026" },
            { role: "Auditor", email: "auditor@canarabank.in", pwd: "Auditor@Secure2026" },
          ].map(({ role, email: e, pwd }) => (
            <div key={role} style={{ marginBottom: 8 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "2px 8px",
                borderRadius: 4,
                background: role === "Admin" ? "#6366f120" : role === "Officer" ? "#22d3ee15" : "#10b98115",
                color: role === "Admin" ? "#818cf8" : role === "Officer" ? "#22d3ee" : "#10b981",
                marginRight: 8,
              }}>
                {role}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {e}
              </span>
              <div style={{ fontSize: 11, color: "var(--text-muted)", paddingLeft: 60, fontFamily: "var(--font-mono)", marginTop: 1 }}>
                {pwd}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right side — Login form ──────────────────────────────── */}
      <div style={{
        width: 500,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "40px 32px",
        position: "relative",
        zIndex: 1,
        borderLeft: "1px solid var(--border-subtle)",
        background: "var(--bg-glass)",
        backdropFilter: "blur(24px)",
      }}>
        {/* Theme toggle (top right) */}
        <div style={{ position: "absolute", top: 24, right: 24, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {theme === "dark" ? "Dark" : "Light"}
          </span>
          <button
            onClick={onToggleTheme}
            style={{
              width: 48, height: 26,
              borderRadius: 20,
              border: "1px solid var(--border-default)",
              background: theme === "dark" ? "#6366f120" : "#f1f5f9",
              cursor: "pointer",
              padding: "2px",
              display: "flex",
              alignItems: "center",
              transition: "all 0.3s",
            }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: "50%",
              background: theme === "dark"
                ? "linear-gradient(135deg, #6366f1, #22d3ee)"
                : "linear-gradient(135deg, #f59e0b, #f97316)",
              transform: theme === "dark" ? "translateX(0)" : "translateX(22px)",
              transition: "transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            }}>
              {theme === "dark" ? <Moon size={11} color="white" /> : <Sun size={11} color="white" />}
            </div>
          </button>
        </div>

        <div style={{
          width: "100%",
          maxWidth: 420,
          animation: "slide-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
          transform: shake ? "translateX(0)" : undefined,
        }}>

          {/* Step indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 32 }}>
            {(["credentials", "otp"] as const).map((s, i) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: step === s
                    ? "linear-gradient(135deg, #6366f1, #22d3ee)"
                    : success || (s === "credentials" && step === "otp")
                      ? "#10b981"
                      : "var(--bg-card)",
                  border: step === s || success || (s === "credentials" && step === "otp")
                    ? "none"
                    : "1px solid var(--border-subtle)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700,
                  color: step === s || success || (s === "credentials" && step === "otp")
                    ? "white"
                    : "var(--text-muted)",
                  transition: "all 0.4s",
                }}>
                  {(success || (s === "credentials" && step === "otp"))
                    ? <CheckCircle size={14} />
                    : i + 1}
                </div>
                <span style={{
                  fontSize: 12,
                  fontWeight: step === s ? 600 : 400,
                  color: step === s ? "var(--text-primary)" : "var(--text-muted)",
                }}>
                  {s === "credentials" ? "Credentials" : "OTP Verify"}
                </span>
                {i < 1 && (
                  <div style={{
                    width: 32, height: 1,
                    background: step === "otp" ? "#6366f1" : "var(--border-subtle)",
                    transition: "background 0.4s",
                    marginRight: 4,
                  }} />
                )}
              </div>
            ))}
          </div>

          {/* ── STEP 1: CREDENTIALS ─────────────────────────────── */}
          {step === "credentials" && !success && (
            <>
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", color: "var(--text-primary)", marginBottom: 6 }}>
                  Welcome Back
                </h2>
                <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
                  Sign in to ForgeShield AI — Canara Bank Forensics
                </p>
              </div>

              {/* Lockout banner */}
              {isLocked && (
                <div style={{
                  padding: "14px 16px", borderRadius: 12, marginBottom: 20,
                  background: "#ef444415", border: "1px solid #ef444430",
                  display: "flex", alignItems: "flex-start", gap: 10,
                }}>
                  <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", marginBottom: 2 }}>Account Locked</div>
                    <div style={{ fontSize: 12, color: "#fca5a5" }}>
                      Too many failed attempts. Locked for {lockedMinutes} more minute{lockedMinutes > 1 ? "s" : ""}.
                    </div>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && !isLocked && (
                <div style={{
                  padding: "12px 14px", borderRadius: 10, marginBottom: 18,
                  background: "#ef444410", border: "1px solid #ef444430",
                  fontSize: 13, color: "#fca5a5",
                  display: "flex", alignItems: "center", gap: 8,
                  animation: shake ? "shake 0.5s ease both" : "none",
                }}>
                  <AlertTriangle size={15} color="#ef4444" style={{ flexShrink: 0 }} />
                  {error}
                </div>
              )}

              {/* Attempts warning */}
              {failCount > 0 && !isLocked && (
                <div style={{
                  padding: "10px 14px", borderRadius: 10, marginBottom: 16,
                  background: "#f59e0b10", border: "1px solid #f59e0b30",
                  fontSize: 12, color: "#fcd34d",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <AlertTriangle size={13} color="#f59e0b" style={{ flexShrink: 0 }} />
                  {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining before 15-minute lockout.
                </div>
              )}

              <form onSubmit={handleCredentialSubmit}>
                {/* Email */}
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    Employee Email
                  </label>
                  <div style={{ position: "relative" }}>
                    <User size={16} color="var(--text-muted)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                    <input
                      ref={emailRef}
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="officer@canarabank.in"
                      disabled={isLocked || loading}
                      autoComplete="username"
                      style={{
                        width: "100%",
                        padding: "14px 14px 14px 42px",
                        borderRadius: 12,
                        border: "1px solid var(--border-default)",
                        background: "var(--bg-card)",
                        color: "var(--text-primary)",
                        fontSize: 14,
                        outline: "none",
                        fontFamily: "var(--font-sans)",
                        transition: "border-color 0.2s, box-shadow 0.2s",
                      }}
                      onFocus={e => {
                        e.target.style.borderColor = "#6366f1";
                        e.target.style.boxShadow = "0 0 0 3px #6366f125";
                      }}
                      onBlur={e => {
                        e.target.style.borderColor = "var(--border-default)";
                        e.target.style.boxShadow = "none";
                      }}
                    />
                  </div>
                </div>

                {/* Password */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                      Password
                    </label>
                  </div>
                  <div style={{ position: "relative" }}>
                    <Lock size={16} color="var(--text-muted)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      disabled={isLocked || loading}
                      autoComplete="current-password"
                      style={{
                        width: "100%",
                        padding: "14px 44px 14px 42px",
                        borderRadius: 12,
                        border: "1px solid var(--border-default)",
                        background: "var(--bg-card)",
                        color: "var(--text-primary)",
                        fontSize: 14,
                        outline: "none",
                        fontFamily: "var(--font-sans)",
                        transition: "border-color 0.2s, box-shadow 0.2s",
                      }}
                      onFocus={e => {
                        e.target.style.borderColor = "#6366f1";
                        e.target.style.boxShadow = "0 0 0 3px #6366f125";
                      }}
                      onBlur={e => {
                        e.target.style.borderColor = "var(--border-default)";
                        e.target.style.boxShadow = "none";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute", right: 12, top: "50%",
                        transform: "translateY(-50%)",
                        background: "none", border: "none",
                        cursor: "pointer", color: "var(--text-muted)",
                        padding: 4,
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {/* Password strength bar */}
                  {password && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ height: 3, borderRadius: 2, background: "var(--bg-surface)", overflow: "hidden" }}>
                        {[
                          password.length >= 8,
                          /[A-Z]/.test(password),
                          /[0-9]/.test(password),
                          /[^a-zA-Z0-9]/.test(password),
                        ].map((ok, i) => (
                          <div key={i} style={{
                            display: "inline-block",
                            width: "25%",
                            height: "100%",
                            background: ok
                              ? i < 2 ? "#f59e0b" : i < 3 ? "#22d3ee" : "#10b981"
                              : "transparent",
                            transition: "background 0.3s",
                          }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Submit button */}
                <button
                  id="login-submit-btn"
                  type="submit"
                  disabled={isLocked || loading || !email || !password}
                  style={{
                    width: "100%",
                    padding: "15px",
                    borderRadius: 12,
                    border: "none",
                    background: isLocked
                      ? "var(--bg-card)"
                      : loading
                        ? "linear-gradient(135deg, #4f46e5, #0891b2)"
                        : "linear-gradient(135deg, #6366f1, #22d3ee)",
                    color: isLocked ? "var(--text-muted)" : "white",
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: isLocked || loading ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    boxShadow: isLocked ? "none" : "0 8px 24px rgba(99,102,241,0.4)",
                    transition: "all 0.3s",
                    opacity: !email || !password ? 0.6 : 1,
                  }}
                  onMouseEnter={e => {
                    if (!isLocked && !loading) {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 12px 32px rgba(99,102,241,0.5)";
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = isLocked ? "none" : "0 8px 24px rgba(99,102,241,0.4)";
                  }}
                >
                  {loading ? (
                    <>
                      <div style={{
                        width: 18, height: 18,
                        border: "2px solid rgba(255,255,255,0.3)",
                        borderTopColor: "white",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                      }} />
                      Verifying credentials…
                    </>
                  ) : isLocked ? (
                    <><Lock size={16} /> Locked — Wait {lockedMinutes}m</>
                  ) : (
                    <><LogIn size={16} /> Verify Credentials</>
                  )}
                </button>
              </form>
            </>
          )}

          {/* ── STEP 2: OTP ────────────────────────────────────── */}
          {step === "otp" && !success && (
            <>
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", color: "var(--text-primary)", marginBottom: 6 }}>
                  OTP Verification
                </h2>
                <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
                  Enter the 6-digit code to complete authentication.
                </p>
              </div>

              {/* Live OTP display (offline demo — shows the code) */}
              <div style={{
                padding: "20px 24px",
                background: "var(--bg-card)",
                border: "1px solid var(--border-default)",
                borderRadius: 16,
                marginBottom: 24,
                position: "relative",
                overflow: "hidden",
              }}>
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: 3,
                  background: "linear-gradient(90deg, #6366f1, #22d3ee, #f59e0b)",
                }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>
                      Your OTP Code
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      Refreshes every 60 seconds
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <OTPTimer secondsLeft={otpSecondsLeft} total={60} />
                    <button
                      type="button"
                      onClick={() => setLiveOTP(generateOTP(pendingUserId))}
                      style={{
                        background: "none", border: "1px solid var(--border-subtle)",
                        borderRadius: 8, padding: 6, cursor: "pointer",
                        color: "var(--text-muted)",
                        transition: "all 0.2s",
                      }}
                      title="Refresh OTP"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>
                {/* Display OTP prominently */}
                <div style={{
                  fontSize: 40, fontWeight: 900, letterSpacing: "0.35em",
                  fontFamily: "var(--font-mono)",
                  background: "linear-gradient(135deg, #6366f1, #22d3ee)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  userSelect: "all",
                  cursor: "text",
                  textAlign: "center",
                  padding: "8px 0",
                }}>
                  {liveOTP || "------"}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", marginTop: 4 }}>
                  Copy this code and enter it below ↓
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  padding: "12px 14px", borderRadius: 10, marginBottom: 18,
                  background: "#ef444410", border: "1px solid #ef444430",
                  fontSize: 13, color: "#fca5a5",
                  display: "flex", alignItems: "center", gap: 8,
                  animation: shake ? "shake 0.5s ease both" : "none",
                }}>
                  <AlertTriangle size={15} color="#ef4444" style={{ flexShrink: 0 }} />
                  {error}
                </div>
              )}

              {/* OTP input cells */}
              <form onSubmit={handleOTPSubmit}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  Enter OTP Code
                </label>
                <div style={{ position: "relative", marginBottom: 28 }}>
                  {/* Visual cells */}
                  <div style={{ display: "flex", gap: 8, justifyContent: "center", pointerEvents: "none" }}>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <OTPCell
                        key={i}
                        char={otpCode[i] || ""}
                        active={otpCode.length === i}
                      />
                    ))}
                  </div>
                  {/* Hidden real input */}
                  <input
                    ref={otpRef}
                    id="otp-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    style={{
                      position: "absolute", inset: 0,
                      opacity: 0,
                      cursor: "text",
                      width: "100%", height: "100%",
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => { setStep("credentials"); setError(""); setOtpCode(""); }}
                    style={{
                      flex: "0 0 auto",
                      padding: "14px 18px",
                      borderRadius: 12,
                      border: "1px solid var(--border-default)",
                      background: "var(--bg-card)",
                      color: "var(--text-secondary)",
                      fontSize: 14, fontWeight: 500,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    ← Back
                  </button>
                  <button
                    id="otp-submit-btn"
                    type="submit"
                    disabled={loading || otpCode.length !== 6}
                    style={{
                      flex: 1,
                      padding: "14px",
                      borderRadius: 12,
                      border: "none",
                      background: otpCode.length === 6
                        ? "linear-gradient(135deg, #6366f1, #22d3ee)"
                        : "var(--bg-card)",
                      color: otpCode.length === 6 ? "white" : "var(--text-muted)",
                      fontSize: 15, fontWeight: 700,
                      cursor: otpCode.length !== 6 ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      boxShadow: otpCode.length === 6 ? "0 8px 24px rgba(99,102,241,0.4)" : "none",
                      transition: "all 0.3s",
                    }}
                  >
                    {loading ? (
                      <div style={{
                        width: 18, height: 18,
                        border: "2px solid rgba(255,255,255,0.3)",
                        borderTopColor: "white",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                      }} />
                    ) : (
                      <><Shield size={16} /> Complete Login</>
                    )}
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ── SUCCESS state ───────────────────────────────────── */}
          {success && (
            <div style={{
              textAlign: "center",
              animation: "scale-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) both",
            }}>
              <div style={{
                width: 80, height: 80,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #10b981, #059669)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 20px",
                boxShadow: "0 0 60px #10b98150",
                animation: "pulse-success 1s ease infinite",
              }}>
                <CheckCircle size={40} color="white" />
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
                Authentication Successful
              </div>
              <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
                Redirecting to ForgeShield Dashboard…
              </div>
            </div>
          )}

          {/* ── Footer info ─────────────────────────────────────── */}
          {!success && (
            <div style={{
              marginTop: 36,
              padding: "14px",
              borderRadius: 12,
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}>
              <Building2 size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
                <strong style={{ color: "var(--text-secondary)" }}>Canara Bank — ForgeShield AI</strong><br />
                All access is logged per RBI IT Framework 2021. Unauthorised access is a criminal offence under IT Act 2000, Section 66.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Keyframe animations ──────────────────────────────────── */}
      <style>{`
        @keyframes orb-float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(20px, -30px) scale(1.1); }
          66% { transform: translate(-15px, 20px) scale(0.95); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scale-in {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-8px); }
          30% { transform: translateX(8px); }
          45% { transform: translateX(-6px); }
          60% { transform: translateX(6px); }
          75% { transform: translateX(-3px); }
          90% { transform: translateX(3px); }
        }
        @keyframes pulse-success {
          0%, 100% { box-shadow: 0 0 30px #10b98150; }
          50% { box-shadow: 0 0 70px #10b98180; }
        }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 1000px var(--bg-card) inset !important;
          -webkit-text-fill-color: var(--text-primary) !important;
        }
        @media (max-width: 900px) {
          .login-left { display: none !important; }
        }
      `}</style>
    </div>
  );
}
