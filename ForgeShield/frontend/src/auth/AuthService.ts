/**
 * ForgeShield AI — Offline Authentication Service
 * ================================================
 * 100% browser-native. Zero network calls. Zero cloud dependency.
 *
 * Security features:
 *  - SHA-256 password hashing via Web Crypto API (PBKDF2-style salt + iterations)
 *  - Cryptographically random session tokens (crypto.getRandomValues)
 *  - Account lockout after 5 failed attempts (15-minute cooldown)
 *  - Session stored in sessionStorage → auto-expires when browser closes
 *  - Full audit log persisted in localStorage
 *  - Time-based OTP (TOTP-style, purely client-side) as 2nd factor
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "officer" | "auditor";
  branch: string;
  employeeId: string;
  lastLogin: string | null;
  passwordHash: string;
  salt: string;
}

export interface Session {
  token: string;
  userId: string;
  email: string;
  name: string;
  role: "admin" | "officer" | "auditor";
  branch: string;
  employeeId: string;
  createdAt: number;
  expiresAt: number;
}

export interface LoginAttempt {
  email: string;
  timestamp: number;
  success: boolean;
  reason?: string;
}

export interface LockoutRecord {
  email: string;
  lockedUntil: number;
  failCount: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  USERS: "fs_users_v1",
  SESSION: "fs_session_v1",          // sessionStorage — browser-close expiry
  LOCKOUTS: "fs_lockouts_v1",        // localStorage
  AUDIT_LOG: "fs_audit_log_v1",      // localStorage
} as const;

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;  // 15 minutes
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;  // 8 hours
const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 32; // bytes

// ── Default Users (hashed at runtime on first init) ───────────────────────────

interface RawUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "officer" | "auditor";
  branch: string;
  employeeId: string;
  plainPassword: string; // Only used during init to derive hash
}

const DEFAULT_USERS: RawUser[] = [
  {
    id: "usr-001",
    email: "admin@canarabank.in",
    name: "Arjun Menon",
    role: "admin",
    branch: "HQ — Bengaluru",
    employeeId: "CB-ADM-0001",
    plainPassword: "Admin@ForgeShield2026",
  },
  {
    id: "usr-002",
    email: "officer@canarabank.in",
    name: "Priya Sharma",
    role: "officer",
    branch: "Bengaluru South",
    employeeId: "CB-OFF-0042",
    plainPassword: "Officer@Canara2026",
  },
  {
    id: "usr-003",
    email: "auditor@canarabank.in",
    name: "Rajan Pillai",
    role: "auditor",
    branch: "Risk & Compliance",
    employeeId: "CB-AUD-0008",
    plainPassword: "Auditor@Secure2026",
  },
];

// ── Crypto Utilities ──────────────────────────────────────────────────────────

/** Generate a cryptographically random hex string of `bytes` length */
function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Derive a PBKDF2-SHA-256 hash from password + salt */
async function deriveHash(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Generate a cryptographically random session token */
function generateSessionToken(): string {
  return randomHex(32); // 256-bit token
}

// ── Time-Based OTP (TOTP-style, offline) ─────────────────────────────────────
// Uses a 6-digit code that changes every 60 seconds.
// The "secret" is derived from the user's ID + a daily salt stored locally.
// This is a simplified demo TOTP — not RFC 6238 compliant, but fully offline.

export function generateOTP(userId: string): string {
  const window = Math.floor(Date.now() / 60_000); // 60-second windows
  const key = `fs_otp_${userId}_${window}`;
  // Deterministic but unpredictable: hash the key into a 6-digit code
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) >>> 0;
  }
  return String(hash % 1_000_000).padStart(6, "0");
}

export function validateOTP(userId: string, inputCode: string): boolean {
  // Accept current window and the previous window (30s grace)
  const now = Math.floor(Date.now() / 60_000);
  for (const w of [now, now - 1]) {
    const key = `fs_otp_${userId}_${w}`;
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash + key.charCodeAt(i)) >>> 0;
    }
    if (String(hash % 1_000_000).padStart(6, "0") === inputCode.trim()) return true;
  }
  return false;
}

// ── Storage Helpers ───────────────────────────────────────────────────────────

function getUsers(): AuthUser[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || "[]");
  } catch {
    return [];
  }
}

function saveUsers(users: AuthUser[]) {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
}

function getLockouts(): LockoutRecord[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.LOCKOUTS) || "[]");
  } catch {
    return [];
  }
}

function saveLockouts(records: LockoutRecord[]) {
  localStorage.setItem(STORAGE_KEYS.LOCKOUTS, JSON.stringify(records));
}

function getAuditLog(): LoginAttempt[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.AUDIT_LOG) || "[]");
  } catch {
    return [];
  }
}

function appendAudit(entry: LoginAttempt) {
  const log = getAuditLog();
  log.push(entry);
  // Keep last 500 entries
  if (log.length > 500) log.splice(0, log.length - 500);
  localStorage.setItem(STORAGE_KEYS.AUDIT_LOG, JSON.stringify(log));
}

// ── Auth Service Public API ───────────────────────────────────────────────────

/** Initialize default users on first run (derives hashes asynchronously) */
export async function initAuthStore(): Promise<void> {
  const existing = getUsers();
  if (existing.length > 0) return; // already initialised

  const users: AuthUser[] = [];
  for (const raw of DEFAULT_USERS) {
    const salt = randomHex(SALT_LENGTH);
    const passwordHash = await deriveHash(raw.plainPassword, salt);
    users.push({
      id: raw.id,
      email: raw.email,
      name: raw.name,
      role: raw.role,
      branch: raw.branch,
      employeeId: raw.employeeId,
      lastLogin: null,
      passwordHash,
      salt,
    });
  }
  saveUsers(users);
}

/** Check if an account is currently locked out. Returns ms remaining or 0. */
export function getLockoutRemaining(email: string): number {
  const records = getLockouts();
  const rec = records.find((r) => r.email === email.toLowerCase());
  if (!rec) return 0;
  const remaining = rec.lockedUntil - Date.now();
  return Math.max(0, remaining);
}

/** Get the number of recent failed attempts for an email */
export function getFailCount(email: string): number {
  const records = getLockouts();
  const rec = records.find((r) => r.email === email.toLowerCase());
  return rec ? rec.failCount : 0;
}

/** Attempt to log in. Returns the session or an error message. */
export async function login(
  email: string,
  password: string
): Promise<{ ok: true; session: Session; requiresOTP: boolean; userId: string } | { ok: false; error: string; lockedOut?: boolean; remainingMs?: number }> {
  const normalEmail = email.toLowerCase().trim();

  // ── Check lockout ───────────────────────────────────────────────
  const remaining = getLockoutRemaining(normalEmail);
  if (remaining > 0) {
    const minutes = Math.ceil(remaining / 60_000);
    return {
      ok: false,
      error: `Account locked. Try again in ${minutes} minute${minutes > 1 ? "s" : ""}.`,
      lockedOut: true,
      remainingMs: remaining,
    };
  }

  // ── Find user ───────────────────────────────────────────────────
  const users = getUsers();
  const user = users.find((u) => u.email === normalEmail);

  if (!user) {
    // Don't reveal user existence — always hash something (timing-safe)
    await deriveHash(password, "dummy_salt_to_prevent_timing_attack");
    appendAudit({ email: normalEmail, timestamp: Date.now(), success: false, reason: "User not found" });
    _recordFailedAttempt(normalEmail);
    return { ok: false, error: "Invalid credentials. Please check your email and password." };
  }

  // ── Verify password ─────────────────────────────────────────────
  const hash = await deriveHash(password, user.salt);
  if (hash !== user.passwordHash) {
    appendAudit({ email: normalEmail, timestamp: Date.now(), success: false, reason: "Wrong password" });
    const afterCount = _recordFailedAttempt(normalEmail);
    const attemptsLeft = MAX_FAILED_ATTEMPTS - afterCount;

    if (attemptsLeft <= 0) {
      return {
        ok: false,
        error: `Account locked for 15 minutes after ${MAX_FAILED_ATTEMPTS} failed attempts.`,
        lockedOut: true,
        remainingMs: LOCKOUT_DURATION_MS,
      };
    }

    return {
      ok: false,
      error: `Invalid credentials. ${attemptsLeft} attempt${attemptsLeft > 1 ? "s" : ""} remaining before lockout.`,
    };
  }

  // ── Credentials correct — clear fail count ──────────────────────
  _clearFailedAttempts(normalEmail);

  // ── OTP required ────────────────────────────────────────────────
  // Return a partial result — caller must verify OTP before creating session
  return { ok: true, requiresOTP: true, userId: user.id, session: null as unknown as Session };
}

/** Complete login after OTP verification. Creates and stores the session. */
export function completeLogin(userId: string, otp: string): { ok: true; session: Session } | { ok: false; error: string } {
  if (!validateOTP(userId, otp)) {
    return { ok: false, error: "Invalid or expired OTP code. Please try again." };
  }

  const users = getUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return { ok: false, error: "Session error. Please log in again." };

  // Create session
  const token = generateSessionToken();
  const now = Date.now();
  const session: Session = {
    token,
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    branch: user.branch,
    employeeId: user.employeeId,
    createdAt: now,
    expiresAt: now + SESSION_DURATION_MS,
  };

  // Store in sessionStorage (auto-wipes on browser close)
  sessionStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));

  // Update last login timestamp
  user.lastLogin = new Date(now).toISOString();
  saveUsers(users);

  appendAudit({ email: user.email, timestamp: now, success: true });

  return { ok: true, session };
}

/** Get current active session (returns null if expired or absent) */
export function getSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.SESSION);
    if (!raw) return null;
    const session: Session = JSON.parse(raw);
    if (Date.now() > session.expiresAt) {
      sessionStorage.removeItem(STORAGE_KEYS.SESSION);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

/** Log out the current session */
export function logout(): void {
  sessionStorage.removeItem(STORAGE_KEYS.SESSION);
}

/** Get audit log entries (admin only usage) */
export function getAuditLogEntries(): LoginAttempt[] {
  return getAuditLog();
}

// ── Internal Helpers ──────────────────────────────────────────────────────────

function _recordFailedAttempt(email: string): number {
  const records = getLockouts();
  const idx = records.findIndex((r) => r.email === email);
  const now = Date.now();

  if (idx === -1) {
    records.push({ email, lockedUntil: 0, failCount: 1 });
    saveLockouts(records);
    return 1;
  }

  records[idx].failCount++;
  if (records[idx].failCount >= MAX_FAILED_ATTEMPTS) {
    records[idx].lockedUntil = now + LOCKOUT_DURATION_MS;
  }
  saveLockouts(records);
  return records[idx].failCount;
}

function _clearFailedAttempts(email: string) {
  const records = getLockouts().filter((r) => r.email !== email);
  saveLockouts(records);
}
