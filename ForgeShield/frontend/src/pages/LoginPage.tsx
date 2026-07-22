/**
 * ForgeShield AI — Secure Login Page
 * ====================================
 * Bank-grade two-factor authentication UI with Forgot Password support.
 *
 * Steps:
 *  - Step 1: Email + Password Login
 *  - Step 2: 2FA OTP Code Verification
 *  - Recovery: Forgot Password flow using Security Questions
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Shield, Lock, Eye, EyeOff, AlertTriangle, CheckCircle,
  User, ChevronRight, RefreshCw, LogIn,
  Sun, Moon, Building2, KeyRound, HelpCircle
} from "lucide-react";
import {
  login, completeLogin, generateOTP, getFailCount,
  getSecurityQuestion, resetPassword, type Session
} from "../auth/AuthService";

interface LoginPageProps {
  onAuthenticated: (session: Session) => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

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
    }}>
      {char || ""}
    </div>
  );
}

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

export default function LoginPage({ onAuthenticated, theme, onToggleTheme }: LoginPageProps) {
  /* State */
  const [step, setStep] = useState<"credentials" | "otp" | "forgot">("credentials");
  const [pendingUserId, setPendingUserId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [liveOTP, setLiveOTP] = useState("");

  /* Login Form State */
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  /* Recovery Form State */
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryStep, setRecoveryStep] = useState<1 | 2>(1); // 1: Enter email, 2: Answer question & reset
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  /* UI feedback state */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [shake, setShake] = useState(false);
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(60);
  const [lockedRemaining, setLockedRemaining] = useState(0);
  const [failCount, setFailCount] = useState(0);

  const otpRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

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

  /* OTP refresh loop */
  useEffect(() => {
    if (step !== "otp") return;
    const computeSecs = () => 60 - (Math.floor(Date.now() / 1000) % 60);
    const initId = setTimeout(() => {
      setOtpSecondsLeft(computeSecs());
    }, 0);
    const id = setInterval(() => {
      const secs = computeSecs();
      setOtpSecondsLeft(secs);
      if (secs === 60) {
        setLiveOTP(generateOTP(pendingUserId));
      }
    }, 1000);
    return () => {
      clearTimeout(initId);
      clearInterval(id);
    };
  }, [step, pendingUserId]);

  /* Trigger OTP */
  useEffect(() => {
    if (step === "otp" && pendingUserId) {
      const initId = setTimeout(() => {
        setLiveOTP(generateOTP(pendingUserId));
        otpRef.current?.focus();
      }, 100);
      return () => clearTimeout(initId);
    }
  }, [step, pendingUserId]);

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  }, []);

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
    setSuccessMessage("Authentication Successful");
    setTimeout(() => onAuthenticated(result.session), 1200);
  };

  /* ── Password Recovery Step 1 ──────────────────────────────── */
  const handleRecoveryEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail) { setError("Please enter your corporate email."); triggerShake(); return; }

    const question = getSecurityQuestion(recoveryEmail);
    if (!question) {
      setError("No user profile found matching this email.");
      triggerShake();
      return;
    }

    setSecurityQuestion(question);
    setError("");
    setRecoveryStep(2);
  };

  /* ── Password Recovery Step 2 ──────────────────────────────── */
  const handleRecoveryResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!securityAnswer) { setError("Please answer your security question."); triggerShake(); return; }
    if (!newPassword || !confirmPassword) { setError("Please input your new password."); triggerShake(); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); triggerShake(); return; }
    if (newPassword.length < 8) { setError("New password must be at least 8 characters."); triggerShake(); return; }

    setLoading(true);
    setError("");

    const result = await resetPassword(recoveryEmail, securityAnswer, newPassword);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      triggerShake();
      return;
    }

    setSuccess(true);
    setSuccessMessage("Password Reset Successful");
    setTimeout(() => {
      setSuccess(false);
      setSuccessMessage("");
      setStep("credentials");
      // Pre-fill email for convenience
      setEmail(recoveryEmail);
      setPassword("");
      // Reset recovery form
      setRecoveryEmail("");
      setSecurityAnswer("");
      setNewPassword("");
      setConfirmPassword("");
      setRecoveryStep(1);
    }, 1500);
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
      <Orb cx="5%" cy="10%" size={500} color="#6366f1" delay={0} />
      <Orb cx="65%" cy="65%" size={450} color="#22d3ee" delay={2} />
      <Orb cx="80%" cy="5%" size={350} color="#f59e0b" delay={4} />

      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `
          linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
      }} />

      {/* Left side: branding info */}
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
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 44 }}>
          <div style={{
            width: 52, height: 52,
            background: "linear-gradient(135deg, #6366f1, #22d3ee)",
            borderRadius: 14,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 32px rgba(99,102,241,0.4)",
          }}>
            <Shield size={28} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.5px", color: "var(--text-primary)" }}>
              ForgeShield <span style={{ color: "#6366f1" }}>AI</span>
            </div>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.10em",
              background: "linear-gradient(90deg, #1a56db, #f59e0b)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>
              CANARA BANK
            </div>
          </div>
        </div>

        <h1 style={{
          fontSize: "clamp(34px, 3.5vw, 48px)",
          fontWeight: 900, lineHeight: 1.1,
          letterSpacing: "-1.5px",
          marginBottom: 16,
          color: "var(--text-primary)",
        }}>
          Secure Access<br />
          <span style={{
            background: "linear-gradient(135deg, #6366f1, #22d3ee)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          }}>
            Management
          </span>
        </h1>

        <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: 380, marginBottom: 36 }}>
          This system is restricted to authorised Canara Bank personnel. All actions are cryptographically signed and logged for security audits.
        </p>

        {/* Info panel */}
        <div style={{
          padding: "16px 20px",
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 14,
          maxWidth: 380,
          marginBottom: 20,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
            Active Audit & Security System
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            * **Forgot Password**: Password recovery uses offline security questions verified via client-side PBKDF2 hashing.<br />
            * **RBAC Controls**: Strict enforcement for Administrators, Operations Officers, and Read-Only Auditors.
          </div>
        </div>

        {/* Demo profiles hint */}
        <div style={{
          padding: "16px 20px",
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 14,
          maxWidth: 380,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
            Roles & Credentials
          </div>
          {[
            { r: "Admin", e: "admin@canarabank.in", p: "Admin@ForgeShield2026" },
            { r: "Officer", e: "officer@canarabank.in", p: "Officer@Canara2026" },
            { r: "Auditor", e: "auditor@canarabank.in", p: "Auditor@Secure2026" },
          ].map(u => (
            <div key={u.r} style={{ fontSize: 12, marginBottom: 6, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "#6366f115", color: "#818cf8" }}>{u.r}</span>
              <code style={{ fontSize: 11, color: "var(--text-secondary)" }}>{u.e}</code>
              <code style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>{u.p}</code>
            </div>
          ))}
        </div>
      </div>

      {/* Right side: Interactive Form Container */}
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
        backdropFilter: "blur(20px)",
      }}>
        {/* Header toolbar */}
        <div style={{ position: "absolute", top: 24, right: 24, display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={onToggleTheme}
            style={{
              width: 44, height: 24,
              borderRadius: 20,
              border: "1px solid var(--border-default)",
              background: theme === "dark" ? "#6366f115" : "#f1f5f9",
              cursor: "pointer", padding: "2px",
              display: "flex", alignItems: "center",
              transition: "all 0.3s",
            }}
          >
            <div style={{
              width: 18, height: 18, borderRadius: "50%",
              background: theme === "dark" ? "linear-gradient(135deg, #6366f1, #22d3ee)" : "linear-gradient(135deg, #f59e0b, #f97316)",
              transform: theme === "dark" ? "translateX(0)" : "translateX(20px)",
              transition: "transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {theme === "dark" ? <Moon size={10} color="white" /> : <Sun size={10} color="white" />}
            </div>
          </button>
        </div>

        <div style={{
          width: "100%",
          maxWidth: 420,
          transform: shake ? "translateX(0)" : undefined,
        }}>

          {/* ── ERROR DISPLAY ───────────────────────────────────── */}
          {error && (
            <div style={{
              padding: "12px 14px", borderRadius: 10, marginBottom: 18,
              background: "#ef444412", border: "1px solid #ef444430",
              fontSize: 13, color: "#fca5a5",
              display: "flex", alignItems: "center", gap: 8,
              animation: shake ? "shake 0.5s ease both" : "none",
            }}>
              <AlertTriangle size={15} color="#ef4444" style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* ── SUCCESS VIEW ────────────────────────────────────── */}
          {success && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{
                width: 80, height: 80, borderRadius: "50%",
                background: "linear-gradient(135deg, #10b981, #059669)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 20px",
                boxShadow: "0 0 40px #10b98150",
              }}>
                <CheckCircle size={40} color="white" />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
                {successMessage}
              </h2>
              <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
                Processing authentication request…
              </p>
            </div>
          )}

          {/* ── STEP 1: CREDENTIALS LOGIN ───────────────────────── */}
          {step === "credentials" && !success && (
            <>
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", color: "var(--text-primary)", marginBottom: 6 }}>
                  Secured Sign-In
                </h2>
                <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
                  Enterprise Operations Center Verification
                </p>
              </div>

              {isLocked && (
                <div style={{
                  padding: "14px 16px", borderRadius: 12, marginBottom: 20,
                  background: "#ef444415", border: "1px solid #ef444430",
                  display: "flex", alignItems: "flex-start", gap: 10,
                }}>
                  <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", marginBottom: 2 }}>Temporary Lockout</div>
                    <div style={{ fontSize: 12, color: "#fca5a5" }}>
                      Locked for {lockedMinutes} more minute{lockedMinutes > 1 ? "s" : ""}.
                    </div>
                  </div>
                </div>
              )}

              {failCount > 0 && !isLocked && (
                <div style={{
                  padding: "10px 14px", borderRadius: 10, marginBottom: 16,
                  background: "#f59e0b10", border: "1px solid #f59e0b30",
                  fontSize: 12, color: "#fcd34d",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <AlertTriangle size={13} color="#f59e0b" style={{ flexShrink: 0 }} />
                  <span>{attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining before secure account lockout.</span>
                </div>
              )}

              <form onSubmit={handleCredentialSubmit}>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    Corporate Email
                  </label>
                  <div style={{ position: "relative" }}>
                    <User size={16} color="var(--text-muted)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                    <input
                      ref={emailRef}
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="officer@canarabank.in"
                      disabled={isLocked || loading}
                      autoComplete="username"
                      style={{
                        width: "100%", padding: "14px 14px 14px 42px", borderRadius: 12,
                        border: "1px solid var(--border-default)", background: "var(--bg-card)",
                        color: "var(--text-primary)", fontSize: 14, outline: "none",
                        transition: "all 0.2s",
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                      Security Password
                    </label>
                    <button
                      type="button"
                      onClick={() => { setStep("forgot"); setError(""); }}
                      style={{
                        background: "none", border: "none", color: "var(--indigo-light)",
                        fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0,
                      }}
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div style={{ position: "relative" }}>
                    <Lock size={16} color="var(--text-muted)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Input security password"
                      disabled={isLocked || loading}
                      autoComplete="current-password"
                      style={{
                        width: "100%", padding: "14px 44px 14px 42px", borderRadius: 12,
                        border: "1px solid var(--border-default)", background: "var(--bg-card)",
                        color: "var(--text-primary)", fontSize: 14, outline: "none",
                        transition: "all 0.2s",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                        background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)",
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLocked || loading || !email || !password}
                  style={{
                    width: "100%", padding: "15px", borderRadius: 12, border: "none",
                    background: isLocked ? "var(--bg-card)" : "linear-gradient(135deg, #6366f1, #22d3ee)",
                    color: isLocked ? "var(--text-muted)" : "white", fontSize: 15, fontWeight: 700,
                    cursor: isLocked || loading ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    boxShadow: isLocked ? "none" : "0 8px 24px rgba(99,102,241,0.3)",
                    transition: "all 0.2s",
                  }}
                >
                  {loading ? (
                    <div style={{
                      width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite",
                    }} />
                  ) : (
                    <><LogIn size={16} /> Authenticate Credential</>
                  )}
                </button>
              </form>
            </>
          )}

          {/* ── STEP 2: MULTI-FACTOR OTP ─────────────────────────── */}
          {step === "otp" && !success && (
            <>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>
                  Multi-Factor Challenge
                </h2>
                <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
                  Provide 6-digit offline token to authorize session
                </p>
              </div>

              <div style={{
                padding: "16px 20px", background: "var(--bg-card)",
                border: "1px solid var(--border-default)", borderRadius: 16,
                marginBottom: 24, position: "relative", overflow: "hidden",
              }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #6366f1, #22d3ee)" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Security Token
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Expires shortly</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <OTPTimer secondsLeft={otpSecondsLeft} total={60} />
                    <button
                      type="button"
                      onClick={() => setLiveOTP(generateOTP(pendingUserId))}
                      style={{
                        background: "none", border: "1px solid var(--border-subtle)",
                        borderRadius: 6, padding: 4, cursor: "pointer", color: "var(--text-muted)",
                      }}
                    >
                      <RefreshCw size={13} />
                    </button>
                  </div>
                </div>
                <div style={{
                  fontSize: 36, fontWeight: 900, letterSpacing: "0.3em",
                  background: "linear-gradient(135deg, #6366f1, #22d3ee)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                  textAlign: "center", padding: "4px 0",
                }}>
                  {liveOTP}
                </div>
              </div>

              <form onSubmit={handleOTPSubmit}>
                <div style={{ position: "relative", marginBottom: 24 }}>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center", pointerEvents: "none" }}>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <OTPCell key={i} char={otpCode[i] || ""} active={otpCode.length === i} />
                    ))}
                  </div>
                  <input
                    ref={otpRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    style={{ position: "absolute", inset: 0, opacity: 0, cursor: "text", width: "100%", height: "100%" }}
                  />
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => { setStep("credentials"); setError(""); setOtpCode(""); }}
                    style={{
                      padding: "14px 18px", borderRadius: 12, border: "1px solid var(--border-default)",
                      background: "var(--bg-card)", color: "var(--text-secondary)", cursor: "pointer",
                    }}
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading || otpCode.length !== 6}
                    style={{
                      flex: 1, padding: "14px", borderRadius: 12, border: "none",
                      background: otpCode.length === 6 ? "linear-gradient(135deg, #6366f1, #22d3ee)" : "var(--bg-card)",
                      color: otpCode.length === 6 ? "white" : "var(--text-muted)", fontSize: 15, fontWeight: 700,
                      cursor: otpCode.length !== 6 ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      boxShadow: otpCode.length === 6 ? "0 8px 24px rgba(99,102,241,0.3)" : "none",
                    }}
                  >
                    {loading ? (
                      <div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    ) : (
                      <><Shield size={15} /> Confirm Verification</>
                    )}
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ── RECOVERY: FORGOT PASSWORD ───────────────────────── */}
          {step === "forgot" && !success && (
            <>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>
                  Password Recovery
                </h2>
                <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
                  Verify your identity using security questions.
                </p>
              </div>

              {recoveryStep === 1 ? (
                <form onSubmit={handleRecoveryEmailSubmit}>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                      Enter Account Email
                    </label>
                    <div style={{ position: "relative" }}>
                      <User size={16} color="var(--text-muted)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                      <input
                        type="email"
                        value={recoveryEmail}
                        onChange={e => setRecoveryEmail(e.target.value)}
                        placeholder="officer@canarabank.in"
                        style={{
                          width: "100%", padding: "14px 14px 14px 42px", borderRadius: 12,
                          border: "1px solid var(--border-default)", background: "var(--bg-card)",
                          color: "var(--text-primary)", fontSize: 14, outline: "none",
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 12 }}>
                    <button
                      type="button"
                      onClick={() => { setStep("credentials"); setError(""); }}
                      style={{
                        padding: "14px 18px", borderRadius: 12, border: "1px solid var(--border-default)",
                        background: "var(--bg-card)", color: "var(--text-secondary)", cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!recoveryEmail}
                      style={{
                        flex: 1, padding: "14px", borderRadius: 12, border: "none",
                        background: recoveryEmail ? "linear-gradient(135deg, #6366f1, #22d3ee)" : "var(--bg-card)",
                        color: recoveryEmail ? "white" : "var(--text-muted)", fontSize: 15, fontWeight: 700,
                        cursor: !recoveryEmail ? "not-allowed" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      }}
                    >
                      Next Step <ChevronRight size={15} />
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleRecoveryResetSubmit}>
                  {/* Security Question */}
                  <div style={{ marginBottom: 18, padding: "12px 16px", background: "rgba(99,102,241,0.06)", border: "1px solid var(--border-subtle)", borderRadius: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--indigo-light)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                      <HelpCircle size={13} /> Security Challenge
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                      {securityQuestion}
                    </div>
                  </div>

                  {/* Security Answer */}
                  <div style={{ marginBottom: 18 }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                      Security Answer
                    </label>
                    <input
                      type="text"
                      value={securityAnswer}
                      onChange={e => setSecurityAnswer(e.target.value)}
                      placeholder="Case-insensitive answer"
                      style={{
                        width: "100%", padding: "14px", borderRadius: 12,
                        border: "1px solid var(--border-default)", background: "var(--bg-card)",
                        color: "var(--text-primary)", fontSize: 14, outline: "none",
                      }}
                    />
                  </div>

                  {/* New Password */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                      New Password
                    </label>
                    <div style={{ position: "relative" }}>
                      <KeyRound size={16} color="var(--text-muted)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Min 8 chars, mixed case/numbers"
                        style={{
                          width: "100%", padding: "14px 14px 14px 42px", borderRadius: 12,
                          border: "1px solid var(--border-default)", background: "var(--bg-card)",
                          color: "var(--text-primary)", fontSize: 14, outline: "none",
                        }}
                      />
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div style={{ marginBottom: 24 }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                      Confirm New Password
                    </label>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      style={{
                        width: "100%", padding: "14px", borderRadius: 12,
                        border: "1px solid var(--border-default)", background: "var(--bg-card)",
                        color: "var(--text-primary)", fontSize: 14, outline: "none",
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: 12 }}>
                    <button
                      type="button"
                      onClick={() => setRecoveryStep(1)}
                      style={{
                        padding: "14px 18px", borderRadius: 12, border: "1px solid var(--border-default)",
                        background: "var(--bg-card)", color: "var(--text-secondary)", cursor: "pointer",
                      }}
                    >
                      ← Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !securityAnswer || !newPassword || !confirmPassword}
                      style={{
                        flex: 1, padding: "14px", borderRadius: 12, border: "none",
                        background: (securityAnswer && newPassword && confirmPassword) ? "linear-gradient(135deg, #6366f1, #22d3ee)" : "var(--bg-card)",
                        color: (securityAnswer && newPassword && confirmPassword) ? "white" : "var(--text-muted)", fontSize: 15, fontWeight: 700,
                        cursor: (!securityAnswer || !newPassword || !confirmPassword) ? "not-allowed" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      }}
                    >
                      {loading ? (
                        <div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                      ) : (
                        <><KeyRound size={15} /> Reset & Sign In</>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* Footer info banner */}
          {!success && (
            <div style={{
              marginTop: 36, padding: "12px 14px", borderRadius: 12,
              background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <Building2 size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4 }}>
                <strong style={{ color: "var(--text-secondary)" }}>Canara Security Operations</strong><br />
                Transactions are recorded in compliance with IT Security Policy. Unauthorized usage will be prosecuted.
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes orb-float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(15px, -20px) scale(1.05); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
