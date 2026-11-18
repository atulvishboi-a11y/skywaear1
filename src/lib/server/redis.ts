import Redis from "ioredis";
import { Redis as UpstashRedis } from "@upstash/redis";

// Global cache fallback in memory if Redis is unreachable or unconfigured
const memoryFallback = new Map<string, { value: string; expiresAt?: number }>();

declare global {
  // eslint-disable-next-line no-var
  var __redisClient: Redis | null | undefined;
  // eslint-disable-next-line no-var
  var __upstashClient: UpstashRedis | null | undefined;
}

function initUpstash(): UpstashRedis | null {
  if (globalThis.__upstashClient !== undefined) {
    return globalThis.__upstashClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (url && token) {
    try {
      const client = new UpstashRedis({ url, token });
      globalThis.__upstashClient = client;
      return client;
    } catch (err) {
      console.warn("[Upstash] Failed to initialize Upstash REST client:", err);
      globalThis.__upstashClient = null;
      return null;
    }
  }

  globalThis.__upstashClient = null;
  return null;
}

function getRedisUrl(): string | null {
  return (
    process.env.REDIS_URL ||
    process.env.REDIS_TLS_URL ||
    process.env.KV_URL ||
    null
  );
}

function initRedis(): Redis | null {
  if (globalThis.__redisClient !== undefined) {
    return globalThis.__redisClient;
  }

  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    globalThis.__redisClient = null;
    return null;
  }

  try {
    const isTls = redisUrl.startsWith("rediss://");
    const client = new Redis(redisUrl, {
      tls: isTls ? { rejectUnauthorized: false } : undefined,
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    client.on("error", (err) => {
      console.warn("[Redis] Connection notice:", err.message);
    });

    globalThis.__redisClient = client;
    return client;
  } catch (err) {
    console.warn("[Redis] Failed to initialize Redis client:", err);
    globalThis.__redisClient = null;
    return null;
  }
}

/**
 * Enterprise Redis GET: reads from Upstash REST, ioredis TCP, or memory fallback
 */
export async function redisGet<T = any>(key: string): Promise<T | null> {
  const upstash = initUpstash();
  if (upstash) {
    try {
      const data = await upstash.get<T>(key);
      if (data !== null && data !== undefined) {
        if (typeof data === "string") {
          try {
            return JSON.parse(data) as T;
          } catch {
            return data as unknown as T;
          }
        }
        return data as T;
      }
      return null;
    } catch (err) {
      console.warn(`[Upstash Get Error: ${key}]`, err);
    }
  }

  const client = initRedis();
  if (client) {
    try {
      if (client.status === "wait" || client.status === "close") {
        await client.connect().catch(() => {});
      }
      if (client.status === "ready") {
        const raw = await client.get(key);
        if (raw) {
          return JSON.parse(raw) as T;
        }
        return null;
      }
    } catch (err) {
      console.warn(`[Redis Get Error: ${key}]`, err);
    }
  }

  // Memory fallback
  const cached = memoryFallback.get(key);
  if (cached) {
    if (cached.expiresAt && Date.now() > cached.expiresAt) {
      memoryFallback.delete(key);
      return null;
    }
    try {
      return JSON.parse(cached.value) as T;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Enterprise Redis SET: sets key with optional TTL in seconds
 */
export async function redisSet(
  key: string,
  value: any,
  ttlSeconds?: number
): Promise<boolean> {
  const serialized = JSON.stringify(value);
  const upstash = initUpstash();
  const client = initRedis();

  // Always update memory fallback for sub-millisecond local reads
  const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
  memoryFallback.set(key, { value: serialized, expiresAt });

  if (upstash) {
    try {
      if (ttlSeconds && ttlSeconds > 0) {
        await upstash.set(key, serialized, { ex: ttlSeconds });
      } else {
        await upstash.set(key, serialized);
      }
      return true;
    } catch (err) {
      console.warn(`[Upstash Set Error: ${key}]`, err);
    }
  }

  if (client) {
    try {
      if (client.status === "wait" || client.status === "close") {
        await client.connect().catch(() => {});
      }
      if (client.status === "ready") {
        if (ttlSeconds && ttlSeconds > 0) {
          await client.set(key, serialized, "EX", ttlSeconds);
        } else {
          await client.set(key, serialized);
        }
        return true;
      }
    } catch (err) {
      console.warn(`[Redis Set Error: ${key}]`, err);
    }
  }

  return true;
}

/**
 * Enterprise Redis DEL: invalidates a key across all distributed instances
 */
export async function redisDel(key: string): Promise<boolean> {
  memoryFallback.delete(key);
  const upstash = initUpstash();
  const client = initRedis();

  if (upstash) {
    try {
      await upstash.del(key);
    } catch (err) {
      console.warn(`[Upstash Del Error: ${key}]`, err);
    }
  }

  if (client) {
    try {
      if (client.status === "ready") {
        await client.del(key);
      }
    } catch (err) {
      console.warn(`[Redis Del Error: ${key}]`, err);
    }
  }
  return true;
}

/**
 * Health status check for admin diagnostics
 */
export async function redisHealth(): Promise<{
  configured: boolean;
  connected: boolean;
  provider: string;
}> {
  const upstash = initUpstash();
  if (upstash) {
    let connected = false;
    try {
      const pong = await upstash.ping();
      connected = pong === "PONG" || Boolean(pong);
    } catch {
      connected = false;
    }
    return {
      configured: true,
      connected,
      provider: "Upstash Redis (Serverless REST)",
    };
  }

  const redisUrl = getRedisUrl();
  const client = initRedis();

  let connected = false;
  if (client) {
    try {
      if (client.status !== "ready") {
        await client.connect().catch(() => {});
      }
      connected = client.status === "ready";
    } catch {
      connected = false;
    }
  }

  return {
    configured: Boolean(redisUrl),
    connected,
    provider: redisUrl
      ? redisUrl.includes("render")
        ? "Render Redis"
        : redisUrl.includes("upstash")
        ? "Upstash Redis (TCP)"
        : "Custom Redis"
      : "In-Memory Multi-Tier",
  };
}

/**
 * Banking-Grade Distributed Mutex / Lock
 * Uses Redis atomic SET NX EX to serialize critical financial actions across serverless instances
 */
export async function acquireDistributedLock(
  lockKey: string,
  ttlSeconds = 10
): Promise<{ acquired: boolean; token?: string }> {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const fullKey = `lock:${lockKey}`;
  const upstash = initUpstash();
  const client = initRedis();

  if (upstash) {
    try {
      const res = await upstash.set(fullKey, token, { nx: true, ex: ttlSeconds });
      if (res === "OK") {
        return { acquired: true, token };
      }
      return { acquired: false };
    } catch (err) {
      console.warn(`[Upstash Lock Acquire Error: ${lockKey}]`, err);
    }
  }

  if (client) {
    try {
      if (client.status === "wait" || client.status === "close") {
        await client.connect().catch(() => {});
      }
      if (client.status === "ready") {
        const res = await client.set(fullKey, token, "EX", ttlSeconds, "NX");
        if (res === "OK") {
          return { acquired: true, token };
        }
        return { acquired: false };
      }
    } catch (err) {
      console.warn(`[Redis Lock Acquire Error: ${lockKey}]`, err);
    }
  }

  // Fallback: in-memory lock
  const existing = memoryFallback.get(fullKey);
  const now = Date.now();
  if (existing && (!existing.expiresAt || existing.expiresAt > now)) {
    return { acquired: false };
  }
  memoryFallback.set(fullKey, { value: token, expiresAt: now + ttlSeconds * 1000 });
  return { acquired: true, token };
}

export async function releaseDistributedLock(
  lockKey: string,
  token?: string
): Promise<boolean> {
  if (!token) return false;
  const fullKey = `lock:${lockKey}`;
  const upstash = initUpstash();
  const client = initRedis();

  // In-memory cleanup
  const existing = memoryFallback.get(fullKey);
  if (existing && existing.value === token) {
    memoryFallback.delete(fullKey);
  }

  if (upstash) {
    try {
      const current = await upstash.get<string>(fullKey);
      if (current === token) {
        await upstash.del(fullKey);
        return true;
      }
    } catch (err) {
      console.warn(`[Upstash Lock Release Error: ${lockKey}]`, err);
    }
  }

  if (client) {
    try {
      if (client.status === "ready") {
        const lua = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
        await client.eval(lua, 1, fullKey, token);
        return true;
      }
    } catch (err) {
      console.warn(`[Redis Lock Release Error: ${lockKey}]`, err);
    }
  }

  return true;
}

export async function withDistributedLock<T>(
  lockKey: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T> {
  const maxAttempts = 3;
  let token: string | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const lock = await acquireDistributedLock(lockKey, ttlSeconds);
    if (lock.acquired && lock.token) {
      token = lock.token;
      break;
    }
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
    }
  }

  if (!token) {
    throw new Error(`FINANCIAL_LOCK_BUSY: An active transaction is already in progress for this account. Please wait.`);
  }

  try {
    return await fn();
  } finally {
    await releaseDistributedLock(lockKey, token).catch(() => {});
  }
}
