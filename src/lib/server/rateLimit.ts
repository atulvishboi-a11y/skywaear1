import { createHash } from "node:crypto";
import { redisDel, redisGet, redisSet } from "./redis";
import { isLocalOnly } from "./db";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  blocked: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

// Identifiers are hashed so raw phone numbers, emails and IPs never land in Redis keys.
const localStore = new Map<string, RateLimitEntry>();

function storageKey(bucket: string, identifier: string): string {
  const digest = createHash("sha256")
    .update(identifier.trim().toLowerCase())
    .digest("hex")
    .slice(0, 24);
  return `rl:${bucket}:${digest}`;
}

function secondsUntil(timestamp: number): number {
  return Math.max(1, Math.ceil((timestamp - Date.now()) / 1000));
}

async function readEntry(key: string): Promise<RateLimitEntry | null> {
  if (isLocalOnly()) return localStore.get(key) ?? null;
  try {
    const entry = await redisGet<RateLimitEntry>(key);
    if (entry && typeof entry.count === "number" && typeof entry.resetAt === "number") {
      return entry;
    }
  } catch {}
  return null;
}

async function writeEntry(key: string, entry: RateLimitEntry): Promise<void> {
  const ttl = secondsUntil(entry.resetAt);
  if (isLocalOnly()) {
    localStore.set(key, entry);
    return;
  }
  try {
    await redisSet(key, entry, ttl);
  } catch {
    // Losing the counter must never block sign-in; database auth stays authoritative.
    localStore.set(key, entry);
  }
}

/**
 * Counts a failed attempt and reports whether the bucket is now locked.
 * Failures only are recorded, so a valid sign-in is never penalized.
 */
export async function recordRateLimitFailure(
  bucket: string,
  identifier: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const key = storageKey(bucket, identifier);
  const now = Date.now();
  const existing = await readEntry(key);
  const active = existing && existing.resetAt > now ? existing : null;
  const count = (active?.count ?? 0) + 1;
  const resetAt = active?.resetAt ?? now + windowSeconds * 1000;

  await writeEntry(key, { count, resetAt });

  if (count >= limit) {
    return { blocked: true, retryAfterSeconds: secondsUntil(resetAt), remaining: 0 };
  }
  return { blocked: false, retryAfterSeconds: 0, remaining: limit - count };
}

export async function checkRateLimit(
  bucket: string,
  identifier: string,
  limit: number
): Promise<RateLimitResult> {
  const key = storageKey(bucket, identifier);
  const existing = await readEntry(key);
  if (!existing || existing.resetAt <= Date.now()) {
    return { blocked: false, retryAfterSeconds: 0, remaining: limit };
  }
  if (existing.count >= limit) {
    return { blocked: true, retryAfterSeconds: secondsUntil(existing.resetAt), remaining: 0 };
  }
  return { blocked: false, retryAfterSeconds: 0, remaining: limit - existing.count };
}

export async function clearRateLimit(bucket: string, identifier: string): Promise<void> {
  const key = storageKey(bucket, identifier);
  localStore.delete(key);
  if (isLocalOnly()) return;
  try {
    await redisDel(key);
  } catch {}
}

export function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || null;
}

export function lockoutMessage(retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Too many failed attempts. Please wait ${minutes} minute${minutes === 1 ? "" : "s"} before trying again.`;
}
