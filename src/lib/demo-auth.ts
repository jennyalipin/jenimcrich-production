/**
 * DEMO AUTH — stand-in for Supabase Auth until the project is provisioned.
 *
 * A single signed cookie ("demo_session") marks the recruiter as signed in.
 * The value is `base64url(payload).hmac` where the HMAC-SHA256 secret comes
 * from DEMO_AUTH_SECRET (falling back to a build-time constant, which is
 * acceptable only because this guards demo data).
 *
 * Server-only (node:crypto): import from server actions and from
 * src/middleware.ts (which runs on the Node.js runtime).
 *
 * SECURITY NOTES
 * - Never log credentials or tokens.
 * - Replaced wholesale by Supabase Auth + RLS in production; nothing in the
 *   app outside middleware/login should depend on this module's internals.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Name of the httpOnly session cookie. */
export const SESSION_COOKIE_NAME = "demo_session";

/** Sessions last 7 days (demo convenience). */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/** The one demo account. The password lives only in this module. */
export const DEMO_USER = {
  name: "Jenny M.",
  email: "jenny@jenimcrich.com",
  role: "admin",
} as const;

const DEMO_PASSWORD = "demo1234";

/** Build-time fallback so the demo runs with zero env configuration. */
const FALLBACK_SECRET =
  "jenimcrich-demo-session-secret-2026-do-not-use-in-production";

function sessionSecret(): string {
  return process.env.DEMO_AUTH_SECRET || FALLBACK_SECRET;
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/**
 * Constant-time-ish string comparison: hash both sides to a fixed length,
 * then `timingSafeEqual`, so neither content nor length leaks via timing.
 */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b));
}

/**
 * Check the demo credentials. Both comparisons always run (no short-circuit
 * on the email check) to keep timing uniform. Never log the inputs.
 */
export function verifyDemoCredentials(email: string, password: string): boolean {
  const emailOk = safeEqual(email.trim().toLowerCase(), DEMO_USER.email);
  const passwordOk = safeEqual(password, DEMO_PASSWORD);
  return emailOk && passwordOk;
}

export interface DemoSession {
  email: string;
  name: string;
  /** Epoch millis at sign-in. */
  issuedAt: number;
}

interface SessionPayload {
  email: string;
  iat: number;
}

/** Create a signed session token for the cookie value. */
export function createSessionToken(email: string = DEMO_USER.email): string {
  const payload: SessionPayload = { email, iat: Date.now() };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

/**
 * Verify a cookie value. Returns the session or null — never throws, so it
 * is safe on every request (middleware) against garbage cookies.
 */
export function verifySessionToken(
  token: string | null | undefined,
): DemoSession | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;

  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!safeEqual(signature, sign(body))) return null;

  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    );
    if (parsed === null || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.email !== "string") return null;
    return {
      email: record.email,
      name: DEMO_USER.name,
      issuedAt: typeof record.iat === "number" ? record.iat : 0,
    };
  } catch {
    return null;
  }
}

/** Shared cookie attributes (httpOnly + SameSite=Lax per the auth spec). */
export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
} as const;
