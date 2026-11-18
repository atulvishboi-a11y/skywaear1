import { Pool } from "pg";
import type { ZeninState } from "./store";
import { DEFAULT_SUPPORT } from "@/lib/support";
import fs from "node:fs";
import path from "node:path";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

/**
 * Local-only mode keeps the whole store on disk (`.data/zenin-state.json`) and never
 * reads or writes the cloud Postgres copy. Enable with SKYWEAR_LOCAL_ONLY=true.
 */
export function isLocalOnly(): boolean {
  // On Vercel or in production, NEVER run in local-only mode — always connect to PostgreSQL!
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    return false;
  }
  const flag = (process.env.SKYWEAR_LOCAL_ONLY ?? "").trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}

function readEnvVarFromFile(varName: string): string | undefined {
  try {
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith(`${varName}=`)) {
          return trimmed.substring(`${varName}=`.length).replace(/^["']|["']$/g, "");
        }
      }
    }
  } catch {}
  return undefined;
}

function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const fromFile = readEnvVarFromFile("DATABASE_URL") || readEnvVarFromFile("STUDIO_DATABASE_URL");
  if (fromFile) return fromFile;
  if (process.env.NODE_ENV === "production" && !isLocalOnly()) {
    throw new Error("[SECURITY ERROR] DATABASE_URL is not configured on the production server.");
  }
  return "";
}

export function getPool(): Pool {
  if (!globalThis.__pgPool) {
    const url = getDatabaseUrl();
    const isCloudDb = url.includes("neon.tech") || url.includes("sslmode=require") || url.includes("supabase.co");
    // In serverless (Vercel), keep pool small (2 connections) to prevent Neon connection exhaustion
    globalThis.__pgPool = new Pool({
      connectionString: url,
      ssl: isCloudDb ? { rejectUnauthorized: false } : undefined,
      max: process.env.VERCEL ? 2 : 10,
      idleTimeoutMillis: 15000,
      connectionTimeoutMillis: 2500,
    });

    globalThis.__pgPool.on("error", (err) => {
      console.error("[PostgreSQL] Unexpected error on idle client", err);
    });
  }
  return globalThis.__pgPool;
}

let unpooledPool: Pool | undefined;

function getUnpooledPool(): Pool | undefined {
  let unpooledUrl = process.env.DATABASE_URL_UNPOOLED;
  if (!unpooledUrl) {
    unpooledUrl = readEnvVarFromFile("DATABASE_URL_UNPOOLED") || readEnvVarFromFile("STUDIO_DATABASE_URL");
  }
  if (!unpooledPool && unpooledUrl) {
    const isCloudDb = unpooledUrl.includes("neon.tech") || unpooledUrl.includes("sslmode=require") || unpooledUrl.includes("supabase.co");
    unpooledPool = new Pool({
      connectionString: unpooledUrl,
      ssl: isCloudDb ? { rejectUnauthorized: false } : undefined,
      max: 2,
      idleTimeoutMillis: 15000,
      connectionTimeoutMillis: 2500,
    });
  }
  return unpooledPool;
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  try {
    const pool = getPool();
    const res = await pool.query(sql, params);
    return res.rows as T[];
  } catch (err: any) {
    const backup = getUnpooledPool();
    if (backup && (err.code === "ENOTFOUND" || err.message?.includes("ENOTFOUND") || err.code === "ETIMEDOUT")) {
      console.warn("[PostgreSQL] Pooler connection notice, retrying with unpooled direct database:", err.message);
      try {
        const res = await backup.query(sql, params);
        return res.rows as T[];
      } catch (backupErr: any) {
        console.warn("[PostgreSQL] Unpooled direct database also failed:", backupErr.message);
        throw backupErr;
      }
    }
    throw err;
  }
}

export async function loadStateFromPostgres(): Promise<ZeninState | null> {
  if (isLocalOnly()) return null;
  try {
    // Parallelize AppState and User table queries for sub-second execution
    const [rows, userRows] = await Promise.all([
      query<{ data: ZeninState }>(
        `SELECT "data" FROM "AppState" WHERE "key" = 'zenin_state' LIMIT 1`
      ),
      query<any>(`SELECT * FROM "User" WHERE "role" = 'CUSTOMER'`).catch(() => [] as any[]),
    ]);
    let state = rows && rows.length > 0 && rows[0].data ? rows[0].data : null;

    // Load and merge users from the persistent relational "User" table
    // This guarantees no customer is EVER lost even if AppState had a sync delay
    try {
      if (userRows && userRows.length > 0) {
        if (!state) {
          state = {
            version: 2,
            products: [],
            customers: [],
            activeCustomerId: "",
            orders: [],
            transactions: [],
            referrals: [],
            withdrawals: [],
            auditLogs: [],
            support: { ...DEFAULT_SUPPORT } as any,
            rewardRules: {} as any,
          } as ZeninState;
        }
        if (!state.customers) state.customers = [];
        const existingIds = new Set(state.customers.map((c) => c.id));
        const existingPhones = new Set(
          state.customers.map((c) => (c.phone || "").replace(/\D/g, "").slice(-10)).filter(Boolean)
        );

        for (const u of userRows) {
          const uLast10 = (u.phone || "").replace(/\D/g, "").slice(-10);
          if (!existingIds.has(u.id) && (!uLast10 || !existingPhones.has(uLast10))) {
            state.customers.push({
              id: u.id,
              name: u.name || "Skywear Member",
              email: u.email && !u.email.endsWith("@skywear.customer") ? u.email : undefined,
              phone: u.phone || undefined,
              referralCode: u.referralCode || undefined,
              referredByCode: u.referredByCode || undefined,
              tier: u.tier || "Silver",
              availableCoins: u.availablePoints || 0,
              pendingCoins: u.pendingPoints || 0,
              referralCoinBalance: 0,
              lifetimeEarnedCoins: u.lifetimeEarnedPoints || 0,
              addresses: Array.isArray(u.addresses) ? u.addresses : [],
              bankAccounts: [],
            });
            existingIds.add(u.id);
            if (uLast10) existingPhones.add(uLast10);
          }
        }
      }
    } catch (userErr) {
      console.warn("[PostgreSQL] User table merge notice:", userErr);
    }

    return state;
  } catch (error) {
    console.warn("[PostgreSQL] Could not read state from PostgreSQL, falling back to disk:", error);
  }
  return null;
}

/**
 * Synchronizes a customer account into the relational "User" table so both AppState
 * and relational tables remain consistent without destructive deletes.
 */
export async function syncCustomerToUserTable(customer: {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  referralCode?: string;
  tier?: string;
  availableCoins?: number;
  pendingCoins?: number;
  lifetimeEarnedCoins?: number;
  addresses?: any[];
}): Promise<void> {
  if (isLocalOnly()) return;
  try {
    const cleanPhone = (customer.phone || "").trim();
    const cleanEmail = (customer.email || "").trim().toLowerCase() ||
      `${cleanPhone.replace(/\D/g, "") || customer.id}@skywear.customer`;
    const words = (customer.name || "Member").trim().split(/\s+/).filter(Boolean);
    const inits = words.length >= 2
      ? `${(words[0][0] || "M").toUpperCase()}${(words[1][0] || "B").toUpperCase()}`
      : (words[0] || "MB").slice(0, 2).toUpperCase();
    const randC = "ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 24)];
    const fallbackCode = `SW${inits}${randC}${customer.id.replace(/\D/g, "").slice(-2) || "1"}`;
    const refCode = customer.referralCode || fallbackCode;
    const tier = customer.tier || "Silver";
    const available = customer.availableCoins || 0;
    const pending = customer.pendingCoins || 0;
    const lifetime = customer.lifetimeEarnedCoins || 0;
    const addresses = JSON.stringify(customer.addresses || []);

    await query(
      `INSERT INTO "User" (
         "id", "name", "email", "phone", "role", "referralCode",
         "tier", "availablePoints", "pendingPoints", "lifetimeEarnedPoints",
         "addresses", "createdAt", "updatedAt"
       )
       VALUES ($1, $2, $3, $4, 'CUSTOMER', $5, $6, $7, $8, $9, $10::jsonb, NOW(), NOW())
       ON CONFLICT ("id") DO UPDATE SET
         "name" = EXCLUDED."name",
         "email" = EXCLUDED."email",
         "phone" = EXCLUDED."phone",
         "referralCode" = COALESCE("User"."referralCode", EXCLUDED."referralCode"),
         "tier" = EXCLUDED."tier",
         "availablePoints" = EXCLUDED."availablePoints",
         "pendingPoints" = EXCLUDED."pendingPoints",
         "lifetimeEarnedPoints" = EXCLUDED."lifetimeEarnedPoints",
         "addresses" = EXCLUDED."addresses",
         "updatedAt" = NOW()`,
      [
        customer.id,
        customer.name || "Skywear Member",
        cleanEmail,
        cleanPhone || null,
        refCode,
        tier,
        available,
        pending,
        lifetime,
        addresses,
      ]
    );
  } catch (err) {
    // Non-blocking sync notice
    console.warn("[PostgreSQL] syncCustomerToUserTable notice:", err);
  }
}

export async function persistStateToPostgres(state: ZeninState): Promise<void> {
  if (isLocalOnly()) return;
  try {
    // Safety Shield: Never overwrite PostgreSQL with an empty customer array if real users exist in User table!
    if (!state.customers || state.customers.length === 0) {
      try {
        const userRows = await query<any>(`SELECT * FROM "User" WHERE "role" = 'CUSTOMER'`);
        if (userRows && userRows.length > 0) {
          console.warn(`[SAFETY SHIELD] Prevented overwriting customers with empty array. Restored ${userRows.length} users from User table.`);
          state.customers = userRows.map((u) => ({
            id: u.id,
            name: u.name || "Skywear Member",
            email: u.email && !u.email.endsWith("@skywear.customer") ? u.email : undefined,
            phone: u.phone || undefined,
            referralCode: u.referralCode || undefined,
            referredByCode: u.referredByCode || undefined,
            tier: u.tier || "Silver",
            availableCoins: u.availablePoints || 0,
            pendingCoins: u.pendingPoints || 0,
            referralCoinBalance: 0,
            lifetimeEarnedCoins: u.lifetimeEarnedPoints || 0,
            addresses: Array.isArray(u.addresses) ? u.addresses : [],
            bankAccounts: [],
          }));
        }
      } catch {}
    }

    await query(
      `INSERT INTO "AppState" ("key", "data", "updatedAt")
       VALUES ('zenin_state', $1, NOW())
       ON CONFLICT ("key") DO UPDATE SET
         "data" = EXCLUDED."data",
         "updatedAt" = NOW()`,
      [JSON.stringify(state)]
    );

    // Banking Ledger Sync: Keep relational User table coins 100% matched with AppState
    if (state.customers && state.customers.length > 0) {
      for (const customer of state.customers) {
        void syncCustomerToUserTable(customer).catch(() => {});
      }
    }
  } catch (error) {
    console.error("[PostgreSQL] Failed to persist state to PostgreSQL:", error);
  }
}
