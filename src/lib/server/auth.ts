import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { CustomerAccount } from "@/data/rewardsEngine";
import { maskBankAccountForClient } from "@/lib/paymentDetails";

export const ADMIN_COOKIE = "zenin_admin_session";
export const CUSTOMER_COOKIE = "zenin_customer_session";

const RAW_SESSION_SECRET = process.env.ZENIN_SESSION_SECRET || process.env.SESSION_SECRET;
if (process.env.NODE_ENV === "production" && !RAW_SESSION_SECRET) {
  throw new Error("[SECURITY ERROR] ZENIN_SESSION_SECRET is required in production environment.");
}
const SECRET =
  RAW_SESSION_SECRET ||
  "dev-only-secret-do-not-use-in-production-skywear-local";

// 30-Day persistent production-grade customer session lifetime
export const SESSION_TTL_DAYS = 30;
export const SESSION_MAX_AGE_SECONDS = SESSION_TTL_DAYS * 24 * 3600; // 2,592,000 seconds

function sign(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
}

function issue(value: string, ttlHours: number = SESSION_TTL_DAYS * 24): string {
  const expiresAt = Date.now() + ttlHours * 3_600_000;
  const payload = `${value}.${expiresAt}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

function consume(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  if (!encoded || !signature) return null;

  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expected = sign(payload);
  if (
    expected.length !== signature.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  ) {
    return null;
  }

  const lastDot = payload.lastIndexOf(".");
  if (lastDot === -1) return null;
  const value = payload.slice(0, lastDot);
  const expiry = Number(payload.slice(lastDot + 1));
  if (!value || isNaN(expiry) || expiry < Date.now()) return null;
  return value;
}

export function issueAdminSession(): string {
  return issue("admin", 12); // Admin session remains 12 hours for elevated security
}

export function issueCustomerSession(customerId: string): string {
  return issue(customerId, SESSION_TTL_DAYS * 24); // Customer session 30 days
}

export async function readAdminSession(): Promise<boolean> {
  const store = await cookies();
  return consume(store.get(ADMIN_COOKIE)?.value) === "admin";
}

export async function readCustomerSession(): Promise<string | null> {
  const store = await cookies();
  const rawId = consume(store.get(CUSTOMER_COOKIE)?.value);
  if (!rawId) return null;
  // Aliases for merged accounts (e.g. Vikash Patel duplicate accounts from mobile login)
  if (rawId === "usr-mvyq6ejq" || rawId === "usr-mvxnwbfw" || rawId === "usr-mvylolxd" || rawId === "usr-mw7c86bv") {
    return "usr-mvxo22lh";
  }
  return rawId;
}

export function sessionCookieOptions(maxAgeSeconds: number = SESSION_MAX_AGE_SECONDS) {
  // Ensure cookies work seamlessly on localhost (over plain HTTP) and HTTPS production
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: isProd,
    maxAge: maxAgeSeconds,
    expires: new Date(Date.now() + maxAgeSeconds * 1000),
  };
}

export function clearSessionCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: isProd,
    maxAge: 0,
    expires: new Date(0),
  };
}

function timingSafeCompare(input: string, expected: string): boolean {
  const a = Buffer.from(input.padEnd(expected.length, "\u0000").slice(0, Math.max(input.length, expected.length)));
  const b = Buffer.from(expected.padEnd(a.length, "\u0000").slice(0, a.length));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  const inputUser = username.trim().toLowerCase();
  const configuredUser = (
    process.env.ZENIN_ADMIN_USER ||
    process.env.ADMIN_USER ||
    "admin"
  ).trim().toLowerCase();

  const configuredPassword = (
    process.env.ZENIN_ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD ||
    ""
  ).trim();

  if (!configuredPassword) {
    console.error("[auth] No admin password configured in environment variables");
    return false;
  }

  const userMatches = timingSafeCompare(inputUser, configuredUser);
  const passwordMatches = timingSafeCompare(password.trim(), configuredPassword);

  return userMatches && passwordMatches;
}

/**
 * Hash customer password with crypto.scrypt (OWASP recommended salt + key derivation).
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Timing-safe password verification supporting both modern scrypt hashes and legacy migration.
 */
export function verifyPassword(password: string, storedHash?: string): boolean {
  if (!storedHash || !password) return false;

  // Backward compatibility with legacy plain-text passwords
  if (!storedHash.startsWith("scrypt:")) {
    return timingSafeCompare(password, storedHash);
  }

  const parts = storedHash.split(":");
  if (parts.length !== 3) return false;

  const [, salt, originalKeyHex] = parts;
  try {
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const originalKey = Buffer.from(originalKeyHex, "hex");
    if (derivedKey.length !== originalKey.length) return false;
    return crypto.timingSafeEqual(derivedKey, originalKey);
  } catch {
    return false;
  }
}

/**
 * Strips password and sensitive credentials before sending CustomerAccount in API responses.
 */
export function sanitizeCustomer<T extends Partial<CustomerAccount> | null | undefined>(
  customer: T
): T {
  if (!customer) return customer;
  const copy = { ...customer };
  if ("password" in copy) {
    (copy as { hasPassword?: boolean }).hasPassword = Boolean(copy.password);
    delete (copy as { password?: string }).password;
  }
  if (copy.bankAccounts) {
    copy.bankAccounts = copy.bankAccounts.map(maskBankAccountForClient);
  }
  return copy as T;
}

