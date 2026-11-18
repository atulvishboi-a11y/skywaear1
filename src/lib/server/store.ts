import fs from "node:fs";
import path from "node:path";
import { PRODUCTS, type Product } from "@/data/products";
import {
  CustomerAccount,
  ReferralLead,
  RewardRulesConfig,
  WalletTransaction,
  WithdrawalRequest,
  INITIAL_REWARD_RULES,
  DEFAULT_AGENT_SLABS,
  MAX_AGENT_SLABS,
  type AgentSlabConfig,
} from "@/data/rewardsEngine";
import type { AuditLogEntry, ManualUpiConfig, GatewaysConfig, QikinkConfig, ShopOrder, ZeninNotification, ProductReview, WebPushSubscription, Team, SupportChatThread } from "@/lib/domain";
import { DEFAULT_SUPPORT, type SupportConfig } from "@/lib/support";
import { seedState } from "./seed";
import { refreshVesting, releaseDueCashback } from "@/lib/vesting";
import { loadStateFromPostgres, persistStateToPostgres, isLocalOnly } from "./db";
import { keepWhatsAppAlive } from "./otpService";
import { redisGet, redisSet } from "./redis";

export type { ManualUpiConfig, GatewaysConfig };

export const DEFAULT_GATEWAYS: GatewaysConfig = {
  razorpayEnabled: true,
  razorpayMode: "live",
  ownpayEnabled: false,
  manualUpiEnabled: true,
  codEnabled: true,
  razorpayFee: {
    enabled: false,
    percent: 2.0,
    flatAmount: 0,
    hideBreakdownOnCheckout: false,
    customLabel: "Convenience Fee",
  },
  ownpayFee: {
    enabled: false,
    percent: 0,
    flatAmount: 0,
    hideBreakdownOnCheckout: false,
    customLabel: "Processing Fee",
  },
  manualUpiFee: {
    enabled: false,
    percent: 0,
    flatAmount: 0,
    hideBreakdownOnCheckout: false,
    customLabel: "Processing Fee",
  },
  codFee: {
    enabled: true,
    percent: 18,
    flatAmount: 0,
    hideBreakdownOnCheckout: false,
    customLabel: "COD Handling Fee",
  },
};

export const DEFAULT_MANUAL_UPI: ManualUpiConfig = {
  enabled: true,
  upiId: "skywear@upi",
  merchantName: "SKYWARE STREETWEAR",
  instructions: "Scan the QR code using Google Pay, PhonePe, Paytm, or BHIM. Enter your Order # in the payment note/remarks, and submit your 12-digit UTR reference below.",
  autoReconciliationEnabled: true,
};

export const DEFAULT_QIKINK_CONFIG: QikinkConfig = {
  enabled: process.env.QIKINK_ENABLED !== "false",
  clientId: process.env.QIKINK_CLIENT_ID || "",
  clientSecret: process.env.QIKINK_CLIENT_SECRET || process.env.QIKINK_API_KEY || "",
  baseUrl: process.env.QIKINK_BASE_URL || "https://sandbox.qikink.com",
  masterSku: process.env.QIKINK_MASTER_SKU || "LIMITLESS",
  autoPushOnApproved: false,
};

export interface ZeninState {
  version: number;
  /**
   * Bumped on every write. The Postgres copy is only adopted when its revision is ahead
   * of the local file — otherwise a cluster that was offline while the demo kept moving
   * would pour last week's data back over the live one.
   */
  revision?: number;
  rewardRules: RewardRulesConfig;
  support: SupportConfig;
  manualUpi?: ManualUpiConfig;
  gateways?: GatewaysConfig;
  qikink?: QikinkConfig;
  products: Product[];
  customers: CustomerAccount[];
  activeCustomerId: string;
  orders: ShopOrder[];
  transactions: WalletTransaction[];
  referrals: ReferralLead[];
  withdrawals: WithdrawalRequest[];
  auditLogs: AuditLogEntry[];
  notifications?: ZeninNotification[];
  reviews?: ProductReview[];
  pushSubscriptions?: WebPushSubscription[];
  teams?: Team[];
  supportChats?: SupportChatThread[];
}

const DATA_DIR = path.join(process.cwd(), ".data");
const STATE_FILE = path.join(DATA_DIR, "zenin-state.json");
const STATE_VERSION = 2;

type StoreGlobal = typeof globalThis & {
  __zeninState?: ZeninState;
  __zeninQueue?: Promise<unknown>;
  __pgSyncStarted?: boolean;
};

const globalStore = globalThis as StoreGlobal;

async function persist(state: ZeninState): Promise<void> {
  state.revision = (state.revision ?? 0) + 1;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch (err) {
    // Read-only filesystem on Vercel is expected
  }

  // Also sync the TypeScript source file if available on disk in local development
  if (process.env.NODE_ENV === "development") {
    try {
      const productsFilePath = path.join(process.cwd(), "src", "data", "products.ts");
      // Write even an empty catalogue so a purged last product cannot come back
      // from the seed array on the next storefront render.
      if (fs.existsSync(productsFilePath) && Array.isArray(state.products)) {
        const content = fs.readFileSync(productsFilePath, "utf8");
        const exportMarker = "export const PRODUCTS: Product[] =";
        const markerIdx = content.indexOf(exportMarker);
        if (markerIdx !== -1) {
          const header = content.substring(0, markerIdx + exportMarker.length);
          const newProductsCode = ` ${JSON.stringify(state.products, null, 2)};\n`;
          fs.writeFileSync(productsFilePath, header + newProductsCode, "utf8");
        }
      }
    } catch {}
  }

  try {
    await persistStateToPostgres(state);
    if (!isLocalOnly()) {
      await redisSet("zenin_state:snapshot", state, 300);
    }
  } catch (err) {
    console.error("[store] Error persisting state to PostgreSQL / Redis:", err);
  }
}

function normalizeRewardRules(rules?: Partial<RewardRulesConfig>): RewardRulesConfig {
  const legacy = (rules ?? {}) as Partial<RewardRulesConfig> & {
    minWithdrawalPoints?: number;
    affiliateCommissionPercent?: number;
  };
  const taxPct = Number(legacy.withdrawalTaxPercent ?? INITIAL_REWARD_RULES.withdrawalTaxPercent ?? 0);
  const orderTaxRaw = Number(legacy.orderTaxPercent);
  const orderTaxPercent =
    Number.isFinite(orderTaxRaw) && orderTaxRaw >= 0 && orderTaxRaw <= 50
      ? orderTaxRaw
      : Number(INITIAL_REWARD_RULES.orderTaxPercent ?? 0);
  const rawShip = legacy.shippingCharge;
  const parsedShip = rawShip !== undefined ? Number(rawShip) : Number.NaN;
  const shippingCharge =
    Number.isFinite(parsedShip) && parsedShip >= 0
      ? parsedShip
      : INITIAL_REWARD_RULES.shippingCharge ?? 79;
  const shippingMode: "ALL_PRODUCTS" | "MIN_AMOUNT" =
    legacy.shippingMode === "ALL_PRODUCTS" ? "ALL_PRODUCTS" : "MIN_AMOUNT";
  const rawMinShip = legacy.freeShippingMinAmount;
  const parsedMinShip = rawMinShip !== undefined ? Number(rawMinShip) : Number.NaN;
  const freeShippingMinAmount =
    Number.isFinite(parsedMinShip) && parsedMinShip >= 0
      ? parsedMinShip
      : INITIAL_REWARD_RULES.freeShippingMinAmount ?? 1299;

  const agentPercentRaw = Number(legacy.agentCommissionPercent);
  const agentCommissionPercent =
    Number.isFinite(agentPercentRaw) && agentPercentRaw >= 0 && agentPercentRaw <= 50
      ? agentPercentRaw
      : Number(INITIAL_REWARD_RULES.agentCommissionPercent ?? 10);

  const agentSlabs: AgentSlabConfig[] | undefined = Array.isArray(legacy.agentSlabs)
    ? legacy.agentSlabs
        .map((slab) => ({
          targetCoins: Math.max(0, Math.round(Number(slab?.targetCoins) || 0)),
          bonusCoins: Math.max(0, Math.round(Number(slab?.bonusCoins) || 0)),
          gift: String(slab?.gift ?? "").trim().slice(0, 80),
        }))
        .filter((slab) => slab.targetCoins > 0)
        .sort((a, b) => a.targetCoins - b.targetCoins)
        .slice(0, MAX_AGENT_SLABS)
    : undefined;

  const merged: RewardRulesConfig = {
    dailyClaimPercent: Number(legacy.dailyClaimPercent ?? INITIAL_REWARD_RULES.dailyClaimPercent),
    minWithdrawalCoins: Number(legacy.minWithdrawalCoins ?? legacy.minWithdrawalPoints ?? INITIAL_REWARD_RULES.minWithdrawalCoins),
    referralCommissionPercent: Number(
      legacy.referralCommissionPercent ?? legacy.affiliateCommissionPercent ?? INITIAL_REWARD_RULES.referralCommissionPercent
    ),
    agentCommissionPercent,
    agentSlabs: agentSlabs?.length ? agentSlabs : DEFAULT_AGENT_SLABS,
    withdrawalTaxPercent: isNaN(taxPct) || taxPct < 0 || taxPct > 100 ? 0 : taxPct,
    orderTaxPercent,
    shippingCharge,
    shippingMode,
    freeShippingMinAmount,
  };
  if (isNaN(merged.dailyClaimPercent) || merged.dailyClaimPercent < 0) {
    merged.dailyClaimPercent = INITIAL_REWARD_RULES.dailyClaimPercent;
  }
  if (isNaN(merged.minWithdrawalCoins) || merged.minWithdrawalCoins < 0) {
    merged.minWithdrawalCoins = INITIAL_REWARD_RULES.minWithdrawalCoins;
  }
  if (isNaN(merged.referralCommissionPercent) || merged.referralCommissionPercent < 0) {
    merged.referralCommissionPercent = INITIAL_REWARD_RULES.referralCommissionPercent;
  }
  return merged;
}

/**
 * Old state files stored reward amounts under `points` and some rupee fields on coin
 * records. Runtime keeps money in INR fields only, so coerce every legacy key once on
 * load rather than spreading `?? points` fallbacks through the whole service layer.
 */
function migrateCoinSchema(state: ZeninState): void {
  const money = state as unknown as Record<string, any>;

  for (const tx of money.transactions ?? []) {
    if (typeof tx.coins !== "number") {
      tx.coins = Number(tx.points ?? tx.coinAmount ?? 0);
    }
    tx.coins = Number(tx.coins ?? 0);
    tx.unit = "COINS";
    if (typeof tx.legacyInrValue !== "number" && typeof tx.rupeeValue === "number") {
      tx.legacyInrValue = tx.rupeeValue;
    }
    delete tx.points;
    delete tx.rupeeValue;
  }

  const sourceTypeOf = (value: unknown): "REFERRAL_COINS" | "CASHBACK_COINS" =>
    String(value ?? "").includes("REFERRAL") ? "REFERRAL_COINS" : "CASHBACK_COINS";

  for (const withdrawal of money.withdrawals ?? []) {
    if (typeof withdrawal.totalCoins !== "number") {
      withdrawal.totalCoins = Number(withdrawal.totalPoints ?? withdrawal.points ?? 0);
    }
    if (typeof withdrawal.legacyInrTotal !== "number" && typeof withdrawal.totalRupees === "number") {
      withdrawal.legacyInrTotal = withdrawal.totalRupees;
    }
    withdrawal.sourceType = sourceTypeOf(withdrawal.sourceType);
    for (const tranche of withdrawal.tranches ?? []) {
      if (typeof tranche.coins !== "number") {
        tranche.coins = Number(tranche.points ?? 0);
      }
      if (typeof tranche.legacyInrAmount !== "number" && typeof tranche.rupeeAmount === "number") {
        tranche.legacyInrAmount = tranche.rupeeAmount;
      }
      delete tranche.points;
      delete tranche.rupeeAmount;
    }
    delete withdrawal.points;
    delete withdrawal.totalPoints;
    delete withdrawal.totalRupees;
  }

  for (const order of money.orders ?? []) {
    if (typeof order.cashbackCoins !== "number") {
      order.cashbackCoins = Number(order.pointsEarned ?? 0);
    }
    order.cashbackCoins = Number(order.cashbackCoins ?? 0);
    if (typeof order.referralCoinsEarned !== "number") {
      order.referralCoinsEarned = Number(order.referralCoins ?? 0);
    }
    order.referralCoinsEarned = Number(order.referralCoinsEarned ?? 0);
    if (typeof order.legacyCoinsRedeemed !== "number") {
      order.legacyCoinsRedeemed = Number(order.pointsRedeemed ?? 0);
    }
    delete order.pointsEarned;
    delete order.pointsRedeemed;
    delete order.pointsRedeemedValue;
    for (const slice of order.cashback ?? []) {
      if (typeof slice.coins !== "number") {
        slice.coins = Number(slice.points ?? 0);
      }
      if (typeof slice.legacyInrAmount !== "number" && typeof slice.rupeeAmount === "number") {
        slice.legacyInrAmount = slice.rupeeAmount;
      }
      delete slice.points;
      delete slice.rupeeAmount;
    }
  }

  for (const customer of money.customers ?? []) {
    if (typeof customer.availableCoins !== "number") {
      customer.availableCoins = Number(customer.availablePoints ?? 0);
    }
    if (typeof customer.pendingCoins !== "number") {
      customer.pendingCoins = Number(customer.pendingPoints ?? 0);
    }
    if (typeof customer.lifetimeEarnedCoins !== "number") {
      customer.lifetimeEarnedCoins = Number(customer.lifetimeEarnedPoints ?? 0);
    }
    customer.availableCoins = Number(customer.availableCoins ?? 0);
    customer.pendingCoins = Number(customer.pendingCoins ?? 0);
    customer.lifetimeEarnedCoins = Number(customer.lifetimeEarnedCoins ?? 0);
    customer.referralCoinBalance = Number(customer.referralCoinBalance ?? customer.referralBalance ?? 0);
    delete customer.availablePoints;
    delete customer.pendingPoints;
    delete customer.lifetimeEarnedPoints;
    delete customer.referralBalance;
  }

  for (const lead of money.referrals ?? []) {
    if (typeof lead.orderAmountInr !== "number" && typeof lead.orderAmount === "number") {
      lead.orderAmountInr = lead.orderAmount;
    }
    delete lead.orderAmount;
    if (typeof lead.commissionCoins !== "number") {
      lead.commissionCoins = Number(lead.commissionEarned ?? lead.commissionPoints ?? 0);
    }
    lead.commissionCoins = Number(lead.commissionCoins ?? 0);
    delete lead.commissionPoints;
    delete lead.commissionEarned;
  }
}

function load(): ZeninState {
  if (globalStore.__zeninState && globalStore.__zeninState.version === STATE_VERSION) {
    // Hot reloads keep this cached object alive, so a state read before the support
    // desk existed still needs its defaults filled in.
    migrateCoinSchema(globalStore.__zeninState);
    if (!globalStore.__zeninState.support) globalStore.__zeninState.support = { ...DEFAULT_SUPPORT };
    if (!globalStore.__zeninState.notifications) globalStore.__zeninState.notifications = [];
    if (!globalStore.__zeninState.pushSubscriptions) globalStore.__zeninState.pushSubscriptions = [];
    if (!globalStore.__zeninState.manualUpi) globalStore.__zeninState.manualUpi = { ...DEFAULT_MANUAL_UPI };
    if (!globalStore.__zeninState.gateways) globalStore.__zeninState.gateways = { ...DEFAULT_GATEWAYS };
    if (!globalStore.__zeninState.qikink) globalStore.__zeninState.qikink = { ...DEFAULT_QIKINK_CONFIG };
    if (!globalStore.__zeninState.teams) globalStore.__zeninState.teams = [];
    if (!globalStore.__zeninState.supportChats) globalStore.__zeninState.supportChats = [];
    if (globalStore.__zeninState.gateways.codEnabled === undefined) globalStore.__zeninState.gateways.codEnabled = true;
    if (!globalStore.__zeninState.gateways.razorpayMode) globalStore.__zeninState.gateways.razorpayMode = "live";
    globalStore.__zeninState.rewardRules = normalizeRewardRules(globalStore.__zeninState.rewardRules);
    return globalStore.__zeninState;
  }

  if (fs.existsSync(STATE_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as ZeninState;
      if (parsed.version === STATE_VERSION) {
        migrateCoinSchema(parsed);
        parsed.support = { ...DEFAULT_SUPPORT, ...(parsed.support ?? {}) };
        parsed.notifications = parsed.notifications ?? [];
        parsed.pushSubscriptions = parsed.pushSubscriptions ?? [];
        parsed.manualUpi = { ...DEFAULT_MANUAL_UPI, ...(parsed.manualUpi ?? {}) };
        parsed.gateways = { ...DEFAULT_GATEWAYS, ...(parsed.gateways ?? {}) };
        parsed.qikink = { ...DEFAULT_QIKINK_CONFIG, ...(parsed.qikink ?? {}) };
        parsed.teams = parsed.teams ?? [];
        parsed.supportChats = parsed.supportChats ?? [];
        if (parsed.gateways.codEnabled === undefined) parsed.gateways.codEnabled = true;
        if (!parsed.gateways.razorpayMode) parsed.gateways.razorpayMode = "live";
        parsed.rewardRules = normalizeRewardRules(parsed.rewardRules);
        backfillSeedData(parsed);
        globalStore.__zeninState = parsed;
        return parsed;
      }
    } catch (error) {
      console.warn("[zenin] state file unreadable", error);
    }
  }

  // Fallback in-memory state until PostgreSQL is awaited. NEVER persist this to DB!
  const seeded = seedState();
  globalStore.__zeninState = seeded;
  return seeded;
}

function backfillSeedData(state: ZeninState): void {
  const seed = seedState();

  // 1. Products: Ensure catalog products exist if empty
  if (!state.products) state.products = [];
  const existingIds = new Set(state.products.map((p) => p.id));
  for (const s of (seed.products || [])) {
    if (!existingIds.has(s.id)) {
      state.products.push({ ...s, stock: s.stock ?? 60, isArchived: false });
      existingIds.add(s.id);
    }
  }

  // 2. Production collections: keep clean empty arrays if empty
  if (!state.orders) state.orders = [];
  if (!state.customers) state.customers = [];
  if (!state.withdrawals) state.withdrawals = [];
  if (!state.transactions) state.transactions = [];
  if (!state.referrals) state.referrals = [];
  if (!state.auditLogs) state.auditLogs = [];
  if (!state.notifications) state.notifications = [];
  if (!state.reviews) state.reviews = [];
  if (!state.pushSubscriptions) state.pushSubscriptions = [];
}

function applyTimeRules(state: ZeninState): void {
  if (!isLocalOnly()) {
    backfillSeedData(state);
  }
  state.rewardRules = normalizeRewardRules(state.rewardRules);
  state.products.forEach((p) => {
    p.category = "T-Shirts";
    p.productType = "tshirt";
  });
  state.withdrawals = (state.withdrawals || []).map(refreshVesting);
  releaseDueCashback(state);

  // Self-healing: if a customer has only unverified/pending orders, ensure premature claims are reverted to pending
  if (state.customers && state.orders) {
    for (const customer of state.customers) {
      const customerOrders = state.orders.filter((o) => o.customerId === customer.id && o.status !== "CANCELLED");
      const hasPaidOrder = customerOrders.some((o) => o.paymentStatus === "PAID");
      if (!hasPaidOrder && customerOrders.length > 0 && customer.availableCoins > 0) {
        const prematureTxs = (state.transactions ?? []).filter(
          (t) =>
            t.customerId === customer.id &&
            t.type === "CASHBACK" &&
            (t.description?.includes("Daily") || t.description?.includes("Auto-Claimed")) &&
            t.status === "COMPLETED"
        );
        if (prematureTxs.length > 0) {
          let refundedToPending = 0;
          prematureTxs.forEach((tx) => {
            tx.status = "REVERSED";
            tx.description = `${tx.description} (Reversed — awaiting admin order verification)`;
            refundedToPending += tx.coins;
          });
          customer.availableCoins = Math.max(0, customer.availableCoins - refundedToPending);
          customer.pendingCoins += refundedToPending;
          customer.lastDailyClaimDate = undefined;
        }
      }

      // Reconcile available points against active & completed withdrawals:
      // A customer's available coins can never exceed (total released cashback - total active/paid withdrawals)
      const customerWithdrawals = (state.withdrawals || []).filter(
        (w) =>
          w.customerId === customer.id &&
          w.sourceType !== "REFERRAL_COINS" &&
          ["PAID", "COMPLETED", "SUBMITTED_TO_BANK", "PENDING", "PROCESSING"].includes(w.overallStatus)
      );
      const totalDebited = customerWithdrawals.reduce((sum, w) => sum + w.totalCoins, 0);
      const totalReleasedCashback = (state.orders || [])
        .filter((o) => o.customerId === customer.id && o.paymentStatus === "PAID")
        .reduce((sum, o) => sum + (o.cashback || []).filter((s) => s.status === "RELEASED").reduce((acc, s) => acc + s.coins, 0), 0);

      if (totalDebited > 0) {
        const legitimateMaxAvailable = Math.max(0, totalReleasedCashback - totalDebited);
        if (customer.availableCoins > legitimateMaxAvailable) {
          customer.availableCoins = legitimateMaxAvailable;
        }
      }
    }
  }

  // Enforce strictly 1 account per mobile number across the store (no duplicate accounts for the same number)
  if (state.customers && state.customers.length > 0) {
    const primaryByPhone = new Map<string, CustomerAccount>();
    const duplicateIds = new Set<string>();

    for (const c of state.customers) {
      const digits = (c.phone || "").replace(/\D/g, "");
      if (digits.length >= 10) {
        const last10 = digits.slice(-10);
        const existing = primaryByPhone.get(last10);
        if (existing) {
          let primary = existing;
          let duplicate = c;
          const cScore = (c.id === "usr-mvxo22lh" ? 1000000 : 0) + (c.availableCoins || 0) + (c.pendingCoins || 0);
          const existingScore = (existing.id === "usr-mvxo22lh" ? 1000000 : 0) + (existing.availableCoins || 0) + (existing.pendingCoins || 0);
          if (cScore > existingScore) {
            primary = c;
            duplicate = existing;
            primaryByPhone.set(last10, primary);
          }
          duplicateIds.add(duplicate.id);

          if (state.orders) {
            for (const o of state.orders) {
              if (o.customerId === duplicate.id) {
                o.customerId = primary.id;
              }
            }
          }
          if (state.transactions) {
            for (const t of state.transactions) {
              if (t.customerId === duplicate.id) {
                t.customerId = primary.id;
              }
            }
          }
        } else {
          primaryByPhone.set(last10, c);
        }
      }
    }

    if (duplicateIds.size > 0) {
      state.customers = state.customers.filter((c) => !duplicateIds.has(c.id));
    }
  }
}

let lastPgSyncTime = 0;
let inFlightLoadPromise: Promise<ZeninState> | null = null;
// In production on serverless, 60s in-memory TTL keeps tab switching and page browsing instant
// without overloading Postgres connection pools. Mutations bypass this cache immediately with forceRefresh=true.
const PG_CACHE_TTL_MS = process.env.NODE_ENV === "development" ? 60 * 60 * 1000 : 60 * 1000;

export async function ensureStateLoaded(forceRefresh = false): Promise<ZeninState> {
  const now = Date.now();
  // Return instant in-memory cached state if within TTL or already in memory in local development
  if (!forceRefresh && globalStore.__zeninState && (now - lastPgSyncTime < PG_CACHE_TTL_MS || process.env.NODE_ENV === "development")) {
    return readState();
  }

  // Stampede protection: reuse in-flight load promise across concurrent requests
  if (!forceRefresh && inFlightLoadPromise) {
    return inFlightLoadPromise;
  }

  const doLoad = async (): Promise<ZeninState> => {
    // 1. Check shared Redis cache across all Vercel distributed instances
    if (!forceRefresh && !isLocalOnly()) {
      try {
        const redisState = await redisGet<ZeninState>("zenin_state:snapshot");
        if (redisState && redisState.version === STATE_VERSION) {
          const currentRev = globalStore.__zeninState?.revision ?? -1;
          const redisRev = redisState.revision ?? 0;
          if (!globalStore.__zeninState || redisRev >= currentRev) {
            globalStore.__zeninState = redisState;
            lastPgSyncTime = Date.now();
            return readState();
          }
        }
      } catch {}
    }

    if (!isLocalOnly()) keepWhatsAppAlive();
    try {
      const pgState = await loadStateFromPostgres();
      lastPgSyncTime = Date.now();
      if (pgState && pgState.version === STATE_VERSION) {
        const currentRev = globalStore.__zeninState?.revision ?? -1;
        const pgRev = pgState.revision ?? 0;
        if (!globalStore.__zeninState || pgRev >= currentRev || forceRefresh) {
          migrateCoinSchema(pgState);
          pgState.notifications = pgState.notifications ?? [];
          pgState.pushSubscriptions = pgState.pushSubscriptions ?? [];
          pgState.support = { ...DEFAULT_SUPPORT, ...(pgState.support ?? {}) };
          pgState.manualUpi = { ...DEFAULT_MANUAL_UPI, ...(pgState.manualUpi ?? {}) };
          pgState.gateways = { ...DEFAULT_GATEWAYS, ...(pgState.gateways ?? {}) };
          pgState.qikink = { ...DEFAULT_QIKINK_CONFIG, ...(pgState.qikink ?? {}) };
          pgState.teams = pgState.teams ?? [];
          pgState.supportChats = pgState.supportChats ?? [];
          if (pgState.gateways.codEnabled === undefined) pgState.gateways.codEnabled = true;
          if (!pgState.gateways.razorpayMode) pgState.gateways.razorpayMode = "live";
          pgState.rewardRules = normalizeRewardRules(pgState.rewardRules);
          backfillSeedData(pgState);
          globalStore.__zeninState = pgState;
          try {
            fs.writeFileSync(STATE_FILE, JSON.stringify(pgState, null, 2), "utf8");
          } catch {}
          await redisSet("zenin_state:snapshot", pgState, 300);
        }
      } else if (!globalStore.__zeninState) {
        // First time database bootstrap only when both Postgres AND disk are completely blank
        const diskState = fs.existsSync(STATE_FILE) ? load() : null;
        if (diskState && (diskState.customers?.length || isLocalOnly())) {
          globalStore.__zeninState = diskState;
        } else {
          const seeded = seedState();
          globalStore.__zeninState = seeded;
          // Do NOT call persist(seeded) here — prevent accidental overwrites of remote database
        }
      }
    } catch (err) {
      console.warn("[store] Error synchronizing state with Postgres:", err);
    }
    return readState();
  };

  if (!forceRefresh) {
    inFlightLoadPromise = doLoad().finally(() => {
      inFlightLoadPromise = null;
    });
    return inFlightLoadPromise;
  }

  return doLoad();
}

export function readState(): ZeninState {
  const state = load();
  applyTimeRules(state);
  return state;
}

export async function mutate<T>(operation: (state: ZeninState) => T | Promise<T>): Promise<T> {
  const run = async () => {
    await ensureStateLoaded(true);
    const state = load();
    applyTimeRules(state);
    const result = await operation(state);
    await persist(state);
    lastPgSyncTime = Date.now();
    return result;
  };

  const previous = globalStore.__zeninQueue ?? Promise.resolve();
  const next = previous.then(run, run);
  globalStore.__zeninQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next as Promise<T>;
}

export function customerById(state: ZeninState, id: string): CustomerAccount | undefined {
  if (id === "usr-mvyq6ejq" || id === "usr-mvxnwbfw" || id === "usr-mvylolxd" || id === "usr-mw7c86bv") {
    id = "usr-mvxo22lh";
  }
  return state.customers.find((c) => c.id === id);
}

export function activeCustomer(state: ZeninState): CustomerAccount {
  const customer = customerById(state, state.activeCustomerId);
  if (!customer) throw new Error("Active customer record missing from store");
  return customer;
}

export function resetStore(): void {
  delete globalStore.__zeninState;
}
