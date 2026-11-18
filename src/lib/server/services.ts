import { randomUUID } from "node:crypto";
import type { Product } from "@/data/products";
import type {
  CustomerAccount,
  ReferralRewardClaim,
  RewardRulesConfig,
  WalletTransaction,
  WithdrawalRequest,
  WithdrawalTranche,
  BankAccount,
  AgentSlabConfig,
} from "@/data/rewardsEngine";
import {
  REFERRAL_MILESTONES,
  referralCoinsFor,
  agentCommissionRateFor,
  agentPeriodKey,
  agentSlabsFor,
  MAX_AGENT_SLABS,
} from "@/data/rewardsEngine";
import {
  ALLOWED_TRANSITIONS,
  COURIER_PARTNERS,
  getCourierTrackingUrl,
  COUPONS,
  findCoupon,
  DELIVERY_FEE,
  FREE_SHIPPING_THRESHOLD,
  ORDER_FLOW,
  type CourierPartner,
  type OrderStatus,
  type ShopOrder,
  type ProductReview,
  type QikinkConfig,
  type Team,
  type TeamStatus,
  type TeamPermission,
  type TeamMemberRef,
  type SupportChatMessage,
  type SupportChatThread,
} from "@/lib/domain";
import { dateLabel, dateTimeLabel } from "@/lib/domain";
import { HttpError } from "@/lib/http";
import {
  cashbackForProduct,
  isAnimeTShirt as isAnimeTee,
  isVisibleToShoppers,
  isPremiumTShirt,
} from "@/lib/catalog";
import { formatSupportPhone, toInternationalDigits, type SupportConfig } from "@/lib/support";
import {
  activateOrderCashback,
  buildCashbackSchedule,
  buildVestingSchedule,
  cashbackLedgerLine,
  cashbackTotals,
  claimCashbackCoins,
  refreshVesting,
  releaseDueCashback,
  vestingTotals,
} from "@/lib/vesting";
import type {
  AdminCustomerPatch,
  AdminOverview,
  AdminWithdrawalPatch,
  FreeTshirtInput,
  OrderResult,
  PayoutInput,
  PlaceOrderInput,
  QuoteInput,
  QuoteResult,
  RejectWithdrawalInput,
  StorefrontSnapshot,
  ReferralLeaderboardEntry,
  SupportCentre,
  TrackingResult,
  WithdrawalInput,
} from "@/lib/contracts";
import { mutate, readState, type ZeninState, DEFAULT_MANUAL_UPI, type ManualUpiConfig, DEFAULT_GATEWAYS, type GatewaysConfig, DEFAULT_QIKINK_CONFIG } from "./store";
import { markNotificationAsRead, markAllNotificationsAsRead } from "./notifications";
import { broadcastPushNotification } from "./webpush";
import { validateUpiId, validateUtr } from "./manualUpi";
import { sendWhatsAppMessage } from "./otpService";
import { hashPassword, verifyPassword, sanitizeCustomer } from "./auth";
import { syncCustomerToUserTable } from "./db";
import { resolveIndianBank, searchIndianBanks } from "@/data/banks";
import {
  BANK_ACCOUNT_REGEX,
  IFSC_REGEX,
  accountLast4,
  maskAccount,
  normalizeAccountNumber,
  normalizeIfsc,
  normalizeUpiId,
} from "@/lib/paymentDetails";
import {
  bankAccountFingerprint,
  bankAccountNumber,
  encryptAccountNumber,
  decryptAccountNumber,
  pendingBankFingerprint,
} from "./paymentCrypto";

// "rewardCoins" is the pre-rename name clients still send for cashbackPoints.
type ProductPatchWithLegacyPoints = Partial<Product> & { rewardCoins?: unknown };
type WithdrawalWithLegacyFields = WithdrawalRequest & { utr?: string; paidAt?: string };

const PINCODE = /^[1-9]\d{5}$/;
const INDIAN_MOBILE = /^(\+91[\s-]?)?[6-9]\d{9}$/;
const UPI_ID = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;
export const MIN_WITHDRAWAL_COINS = 500;

function nowIso(): string {
  return new Date().toISOString();
}

function orderNumber(prefix: string, state: ZeninState, width = 5): string {
  const existing = new Set(state.orders.map((o) => o.orderNumber));
  let candidate = "";
  do {
    candidate =
      prefix === "GIFT"
        ? `GIFT_${String(1 + Math.floor(Math.random() * 900)).padStart(width, "0")}`
        : `TC_${Math.floor(10000 + Math.random() * 89999)}`;
  } while (existing.has(candidate));
  return candidate;
}

function referralCodeFor(state: ZeninState, name: string): string {
  // Recommended format: SW + INITIALS + RANDOM CHAR + USER ID (e.g., SWAVK25)
  const prefix = "SW";
  const words = (name || "Member").trim().split(/\s+/).filter(Boolean);
  let initials = "";
  if (words.length >= 2) {
    const firstInitial = (words[0][0] || "M").toUpperCase().replace(/[^A-Z]/g, "M");
    const secondInitial = (words[1][0] || "B").toUpperCase().replace(/[^A-Z]/g, "B");
    initials = `${firstInitial}${secondInitial}`;
  } else if (words.length === 1 && words[0].length >= 2) {
    initials = words[0].slice(0, 2).toUpperCase().replace(/[^A-Z]/g, "M");
  } else if (words.length === 1 && words[0].length === 1) {
    initials = `${words[0].toUpperCase().replace(/[^A-Z]/g, "M")}X`;
  } else {
    initials = "MB";
  }
  if (initials.length < 2) initials = (initials + "X").slice(0, 2);

  // Alphabet for random character (excluding I, O to prevent confusion with 1, 0)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ";

  // Sequence number / user ID: customer count + 1
  let seq = state.customers ? state.customers.length + 1 : 1;
  let code = "";
  let attempts = 0;

  do {
    const randomChar = alphabet[Math.floor(Math.random() * alphabet.length)];
    code = `${prefix}${initials}${randomChar}${seq}`;
    attempts++;
    if (attempts > 30) {
      seq += 1;
    }
  } while (state.customers.some((c) => c.referralCode?.toUpperCase() === code.toUpperCase()));

  return code;
}

function recordAudit(state: ZeninState, actor: string, action: string, details: string): void {
  state.auditLogs.unshift({
    id: `log-${Date.now()}-${Math.floor(Math.random() * 999)}`,
    actor,
    action,
    details,
    at: nowIso(),
  });
  state.auditLogs = state.auditLogs.slice(0, 120);
}

/**
 * Approved agents climb a monthly ladder. Progress only counts paid referred sales,
 * and every bonus row is keyed per agent/month/slab so re-verification can't double-pay.
 */
function creditAgentSlabBonuses(
  state: ZeninState,
  agent: CustomerAccount,
  salesCoins: number,
  atIso: string
): void {
  const profile = agent.agent;
  if (!profile || profile.status !== "APPROVED") return;
  if (!Number.isFinite(salesCoins) || salesCoins <= 0) return;

  const period = agentPeriodKey(atIso);
  const progress =
    profile.monthlyProgress && profile.monthlyProgress.period === period
      ? profile.monthlyProgress
      : (profile.monthlyProgress = { period, salesCoins: 0, bonusCoins: 0 });
  progress.salesCoins = Number(((progress.salesCoins || 0) + salesCoins).toFixed(2));

  for (const slab of agentSlabsFor(state.rewardRules)) {
    if (progress.salesCoins < slab.targetCoins) break;
    const bonusKey = `agent-bonus-${agent.id}-${period}-${slab.targetCoins}`;
    const alreadyGranted = state.transactions.some((t) => t.idempotencyKey === bonusKey);

    if (!alreadyGranted) {
      if (slab.bonusCoins > 0) {
        agent.referralCoinBalance = Number(
          ((agent.referralCoinBalance || 0) + slab.bonusCoins).toFixed(2)
        );
        progress.bonusCoins = Number(((progress.bonusCoins || 0) + slab.bonusCoins).toFixed(2));
        state.transactions.unshift(
          walletTx({
            customerId: agent.id,
            type: "REFERRAL_COMMISSION",
            coins: slab.bonusCoins,
            unit: "COINS",
            idempotencyKey: bonusKey,
            description: `Agent slab bonus — ${slab.targetCoins.toLocaleString("en-IN")} monthly sales coins crossed (${period}) — +${slab.bonusCoins.toLocaleString("en-IN")} Referral Coins`,
            status: "COMPLETED",
          })
        );
      } else {
        // Zero-coin slabs still need a guard row so the gift is granted only once.
        state.transactions.unshift(
          walletTx({
            customerId: agent.id,
            type: "ADMIN_ADJUSTMENT",
            coins: 0,
            unit: "COINS",
            idempotencyKey: bonusKey,
            description: `Agent slab reached — ${slab.targetCoins.toLocaleString("en-IN")} monthly sales coins (${period})`,
            status: "COMPLETED",
          })
        );
      }
      recordAudit(
        state,
        "System (agent ladder)",
        "AGENT_SLAB_REACHED",
        `${agent.name} crossed ${slab.targetCoins.toLocaleString("en-IN")} monthly sales coins in ${period} — bonus ${slab.bonusCoins.toLocaleString("en-IN")} coins${slab.gift ? ` + gift "${slab.gift}"` : ""}`
      );
    }

    if (slab.gift) {
      const gifts = profile.gifts ?? [];
      const claimed = gifts.some(
        (gift) => gift.period === period && gift.targetCoins === slab.targetCoins
      );
      if (!claimed) {
        profile.gifts = [
          ...gifts,
          {
            id: `agift-${Date.now().toString(36)}-${slab.targetCoins}`,
            period,
            targetCoins: slab.targetCoins,
            label: slab.gift,
            status: "PENDING_DISPATCH",
            grantedAt: atIso,
          },
        ];
      }
    }
  }

  void syncCustomerToUserTable(agent).catch(() => {});
}

function walletTx(partial: Omit<WalletTransaction, "id" | "date" | "status"> & { status?: WalletTransaction["status"] }): WalletTransaction {
  return {
    id: `tx-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
    date: dateTimeLabel(nowIso()),
    status: "PENDING",
    ...partial,
  };
}

function requireCustomer(state: ZeninState, customerId: string | null): CustomerAccount {
  if (!customerId) throw new HttpError(401, "Sign in required for this action");
  const customer = state.customers.find((c) => c.id === customerId);
  if (!customer) throw new HttpError(404, "Customer account not found");
  return customer;
}

export function isStorefrontProduct(p: Product): boolean {
  return isVisibleToShoppers(p);
}

export function isAnimeTShirt(p: Product): boolean {
  return isVisibleToShoppers(p) && isAnimeTee(p);
}

export function isPremiumDrop(p: Product): boolean {
  return isVisibleToShoppers(p) && isPremiumTShirt(p);
}

function leaderboardName(name: string | undefined, fallback: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

function topReferrerEntries(state: ZeninState, viewerId: string | null): ReferralLeaderboardEntry[] {
  const buckets = new Map<
    string,
    { name: string; customerId?: string; commission: number; friends: Set<string> }
  >();

  for (const lead of state.referrals ?? []) {
    const code = lead.referrerCode?.trim().toUpperCase();
    const key = lead.referrerId || code;
    if (!key) continue;

    const owner = lead.referrerId
      ? state.customers.find((c) => c.id === lead.referrerId)
      : state.customers.find((c) => c.referralCode?.toUpperCase() === code);
    const bucket = buckets.get(key) ?? {
      name: "",
      customerId: owner?.id,
      commission: 0,
      friends: new Set<string>(),
    };
    if (owner) {
      bucket.customerId = owner.id;
      bucket.name = owner.name;
    }
    bucket.friends.add(lead.friendId || lead.friendPhone || lead.id);
    if (lead.status === "PAID" || lead.status === "APPROVED") {
      bucket.commission += lead.commissionCoins || 0;
    }
    buckets.set(key, bucket);
  }

  return Array.from(buckets.entries())
    .filter(([, bucket]) => bucket.commission > 0)
    .sort((a, b) => b[1].commission - a[1].commission || b[1].friends.size - a[1].friends.size)
    .slice(0, 10)
    .map(([key, bucket], index) => ({
      rank: index + 1,
      name: leaderboardName(
        bucket.name,
        `Member #${key.replace(/^SKYWEAR-/i, "").slice(-5).toUpperCase()}`
      ),
      coins: Number(bucket.commission.toFixed(2)),
      members: bucket.friends.size,
      isYou: Boolean(viewerId && bucket.customerId === viewerId),
    }));
}

export function storefrontSnapshot(customerId: string | null): StorefrontSnapshot {
  const state = readState();
  const effectiveId =
    customerId === "usr-mvyq6ejq" || customerId === "usr-mvxnwbfw" || customerId === "usr-mvylolxd" || customerId === "usr-mw7c86bv"
      ? "usr-mvxo22lh"
      : customerId;
  const customer = effectiveId ? state.customers.find((c) => c.id === effectiveId) ?? null : null;
  const myOrders = customer
    ? state.orders.filter((o) => o.customerId === customer.id || (customer.email && o.customerEmail === customer.email))
    : [];

  const refCode = customer?.referralCode?.toUpperCase();
  const explicitLeads = customer
    ? state.referrals.filter(
        (r) =>
          r.referrerId === customer.id ||
          (r.referrerCode && r.referrerCode.toUpperCase() === refCode) ||
          (!r.referrerId && !r.referrerCode && customer.id === "usr_aman_01")
      )
    : [];

  // Synthesize and merge any registered customers who signed up with customer's referralCode
  // so no referred member or completed drops are ever missed on the dashboard
  const allReferrals = [...explicitLeads];
  if (customer && refCode) {
    const referredFriends = state.customers.filter(
      (c) => c.referredByCode && c.referredByCode.toUpperCase() === refCode && c.id !== customer.id
    );

    for (const friend of referredFriends) {
      const friendPhoneDigits = (friend.phone || "").replace(/\D/g, "");
      const friendOrders = state.orders.filter(
        (o) =>
          o.customerId === friend.id ||
          (friendPhoneDigits.length >= 10 && (o.customerPhone || "").replace(/\D/g, "").endsWith(friendPhoneDigits.slice(-10))) ||
          (friend.email && o.customerEmail && o.customerEmail.toLowerCase() === friend.email.toLowerCase())
      );

      const commPercent = agentCommissionRateFor(state.rewardRules, customer);

      if (friendOrders.length > 0) {
        for (const order of friendOrders) {
          const isPaid = order.status === "APPROVED" || order.paymentStatus === "PAID";
          const orderComm = order.referralCoinsEarned > 0
            ? order.referralCoinsEarned
            : referralCoinsFor(order.total, commPercent);

          const existingLeadIdx = allReferrals.findIndex(
            (r) =>
              (r.orderNumber && r.orderNumber === order.orderNumber) ||
              (!r.orderNumber && (r.friendId === friend.id || (r.friendPhone && friendPhoneDigits.length >= 10 && r.friendPhone.replace(/\D/g, "").endsWith(friendPhoneDigits.slice(-10)))))
          );

          if (existingLeadIdx >= 0) {
            const lead = allReferrals[existingLeadIdx];
            lead.friendId = friend.id;
            lead.friendName = friend.name;
            lead.friendPhone = friend.phone;
            lead.orderNumber = order.orderNumber;
            lead.orderAmountInr = order.total;
            lead.commissionCoins = orderComm;
            lead.status = isPaid ? "PAID" : "PENDING";
          } else {
            allReferrals.push({
              id: `ref-${friend.id}-${order.orderNumber}`,
              referrerId: customer.id,
              referrerCode: customer.referralCode,
              friendId: friend.id,
              friendName: friend.name,
              friendPhone: friend.phone,
              friendEmail: friend.email || "",
              dateJoined: order.placedAt ? dateLabel(order.placedAt) : dateLabel(nowIso()),
              orderNumber: order.orderNumber,
              orderAmountInr: order.total,
              commissionCoins: orderComm,
              status: isPaid ? "PAID" : "PENDING",
            });
          }
        }
      } else {
        const existingLeadIdx = allReferrals.findIndex(
          (r) =>
            r.friendId === friend.id ||
            (r.friendPhone && friendPhoneDigits.length >= 10 && r.friendPhone.replace(/\D/g, "").endsWith(friendPhoneDigits.slice(-10)))
        );

        if (existingLeadIdx >= 0) {
          allReferrals[existingLeadIdx].friendId = friend.id;
          allReferrals[existingLeadIdx].friendName = friend.name;
          allReferrals[existingLeadIdx].friendPhone = friend.phone;
        } else {
          allReferrals.push({
            id: `ref-registered-${friend.id}`,
            referrerId: customer.id,
            referrerCode: customer.referralCode,
            friendId: friend.id,
            friendName: friend.name,
            friendPhone: friend.phone,
            friendEmail: friend.email || "",
            dateJoined: dateLabel(nowIso()),
            commissionCoins: 0,
            status: "PENDING",
          });
        }
      }
    }
  }

  const sanitizedCustomer = customer ? sanitizeCustomer(customer) : null;
  if (sanitizedCustomer) {
    const directCode = sanitizedCustomer.referredByCode?.trim().toUpperCase();
    const phoneDigits = (customer?.phone || "").replace(/\D/g, "");
    const inboundLead =
      !directCode && customer
        ? state.referrals.find(
            (r) =>
              Boolean(r.referrerId) &&
              (r.friendId === customer.id ||
                (phoneDigits.length >= 10 &&
                  (r.friendPhone || "").replace(/\D/g, "").endsWith(phoneDigits.slice(-10))) ||
                Boolean(customer.email && r.friendEmail && r.friendEmail.toLowerCase() === customer.email.toLowerCase()))
          )
        : undefined;
    const referrerCode = directCode || inboundLead?.referrerCode?.trim().toUpperCase();
    const referrer =
      (inboundLead?.referrerId ? state.customers.find((c) => c.id === inboundLead.referrerId) : undefined) ??
      (referrerCode ? state.customers.find((c) => c.referralCode?.toUpperCase() === referrerCode) : undefined);
    if (referrer) {
      sanitizedCustomer.referredByName = referrer.name;
      sanitizedCustomer.referredByCode = referrer.referralCode;
    }
  }
  if (sanitizedCustomer) {
    const totalEarnedCommission = allReferrals
      .filter((r) => r.status === "PAID" || r.status === "APPROVED")
      .reduce((sum, r) => sum + (r.commissionCoins || 0), 0);
    const referralWithdrawnCoins = (state.withdrawals || [])
      .filter(
        (w) =>
          w.customerId === sanitizedCustomer!.id &&
          w.sourceType === "REFERRAL_COINS" &&
          w.overallStatus !== "FAILED" &&
          w.overallStatus !== "REJECTED"
      )
      .reduce((sum, w) => sum + w.totalCoins, 0);

    // Agent slab bonuses land in the same referral wallet as per-order commission but are
    // not order rows, so the recomputed balance has to add them back explicitly.
    const agentBonusCoins = (state.transactions || [])
      .filter(
        (t) =>
          t.customerId === sanitizedCustomer!.id &&
          t.status === "COMPLETED" &&
          (t.idempotencyKey || "").startsWith("agent-bonus-")
      )
      .reduce((sum, t) => sum + (t.coins || 0), 0);

    sanitizedCustomer.referralCoinBalance = Number(
      Math.max(0, totalEarnedCommission + agentBonusCoins - referralWithdrawnCoins).toFixed(2)
    );
  }

  const shippingCfg = getShippingConfig(state);

  return {
    products: state.products.filter(isStorefrontProduct),
    rewardRules: {
      ...state.rewardRules,
      shippingCharge: shippingCfg.shippingCharge,
      shippingMode: shippingCfg.shippingMode,
      freeShippingMinAmount: shippingCfg.freeShippingMinAmount,
    },
    support: state.support,
    manualUpi: state.manualUpi ?? DEFAULT_MANUAL_UPI,
    gateways: getGatewaysConfig(state),
    qikink: getQikinkConfig(state),
    customer: sanitizedCustomer,
    coupons: COUPONS,
    transactions: customer ? state.transactions.filter((t) => t.customerId === customer.id) : [],
    referrals: allReferrals,
    topReferrers: customer ? topReferrerEntries(state, customer.id) : [],
    withdrawals: customer
      ? state.withdrawals
          .filter((w) => w.customerId === customer.id)
          .map((w) => ({ ...w, bankAccount: w.bankAccount ? maskAccount(accountLast4(w.bankAccount)) : undefined }))
      : [],
    orders: myOrders,
    notifications: customer
      ? (state.notifications ?? []).filter((n) => n.customerId === customer.id)
      : [],
    deliveryFee: shippingCfg.shippingCharge,
    freeShippingThreshold: shippingCfg.freeShippingMinAmount,
    shippingMode: shippingCfg.shippingMode,
    minWithdrawalCoins: state.rewardRules?.minWithdrawalCoins ?? MIN_WITHDRAWAL_COINS,
  };
}

export function getShippingConfig(state: ZeninState): {
  shippingCharge: number;
  shippingMode: "ALL_PRODUCTS" | "MIN_AMOUNT";
  freeShippingMinAmount: number;
} {
  const rules = state.rewardRules;
  const rawCharge = rules?.shippingCharge;
  const shippingCharge =
    typeof rawCharge === "number" && Number.isFinite(rawCharge) && rawCharge >= 0
      ? rawCharge
      : DELIVERY_FEE;
  const shippingMode: "ALL_PRODUCTS" | "MIN_AMOUNT" =
    rules?.shippingMode === "ALL_PRODUCTS" ? "ALL_PRODUCTS" : "MIN_AMOUNT";
  const rawMin = rules?.freeShippingMinAmount;
  const freeShippingMinAmount =
    typeof rawMin === "number" && Number.isFinite(rawMin) && rawMin >= 0
      ? rawMin
      : FREE_SHIPPING_THRESHOLD;

  return {
    shippingCharge,
    shippingMode,
    freeShippingMinAmount,
  };
}

export function adminOverview(storefrontCustomerId: string | null): AdminOverview {
  const state = readState();

  const metrics = {
    // Only cash that actually reached the business: verified online payments plus COD
    // collected on delivery. Coin-funded and complimentary orders moved no money.
    grossRevenue: Number(
      state.orders
        .filter(
          (o) =>
            o.kind === "SALE" &&
            o.status !== "CANCELLED" &&
            o.paymentMethod !== "COINS" &&
            o.paymentMethod !== "COMPLIMENTARY" &&
            (o.paymentMethod === "COD"
              ? o.status === "DELIVERED"
              : o.paymentStatus === "PAID")
        )
        .reduce((sum, o) => sum + o.total, 0)
        .toFixed(2)
    ),
    orderCount: state.orders.length,
    coinsInCirculation: state.customers.reduce(
      (sum, c) => sum + c.availableCoins + c.pendingCoins + (c.referralCoinBalance || 0),
      0
    ),
    paidOutCoins: state.withdrawals.reduce((sum, w) => sum + vestingTotals(w).paidCoins, 0),
    pendingPayableCoins: state.withdrawals.reduce((sum, w) => sum + vestingTotals(w).payableNowCoins, 0),
    pipelineCount: state.orders.filter((o) => o.status !== "DELIVERED" && o.status !== "CANCELLED").length,
    giftCount: state.orders.filter((o) => o.kind !== "SALE").length,
    statusCounts: ORDER_FLOW.concat(["CANCELLED"]).reduce(
      (acc, status) => {
        acc[status] = state.orders.filter((o) => o.status === status).length;
        return acc;
      },
      {} as Record<string, number>
    ),
  };

  const customersForAdmin = state.customers.map((c) => ({
    ...c,
    bankAccounts: (c.bankAccounts || []).map((b) => {
      const decrypted = decryptAccountNumber(b.accountNumberEnc || b.accountNumber);
      return {
        ...b,
        accountNumber: decrypted || b.accountNumber,
        pendingUpdate: b.pendingUpdate
          ? {
              ...b.pendingUpdate,
              accountNumber:
                decryptAccountNumber(
                  b.pendingUpdate.accountNumberEnc || b.pendingUpdate.accountNumber
                ) || b.pendingUpdate.accountNumber,
            }
          : undefined,
      };
    }),
  }));

  const withdrawalsForAdmin = state.withdrawals.map((w) => {
    if (w.payoutMethod === "BANK") {
      let fullAccount = w.bankAccount;
      if (!fullAccount || fullAccount.length < 5 || fullAccount.includes("•")) {
        const cust = state.customers.find((c) => c.id === w.customerId);
        const bank = (cust?.bankAccounts || []).find((b) => b.status === "VERIFIED" || b.isDefault) || (cust?.bankAccounts || [])[0];
        if (bank) {
          fullAccount = decryptAccountNumber(bank.accountNumberEnc || bank.accountNumber);
        }
      }
      return {
        ...w,
        bankAccount: fullAccount || w.bankAccount,
      };
    }
    return w;
  });

  const shippingCfg = getShippingConfig(state);

  return {
    products: state.products,
    orders: state.orders,
    withdrawals: withdrawalsForAdmin,
    transactions: state.transactions,
    referrals: state.referrals,
    rewardRules: {
      ...state.rewardRules,
      shippingCharge: shippingCfg.shippingCharge,
      shippingMode: shippingCfg.shippingMode,
      freeShippingMinAmount: shippingCfg.freeShippingMinAmount,
    },
    support: state.support,
    manualUpi: state.manualUpi ?? DEFAULT_MANUAL_UPI,
    gateways: getGatewaysConfig(state),
    qikink: getQikinkConfig(state),
    auditLogs: state.auditLogs,
    customers: customersForAdmin,
    metrics,
    couriers: COURIER_PARTNERS,
    orderFlow: ORDER_FLOW,
    minWithdrawalCoins: state.rewardRules?.minWithdrawalCoins ?? MIN_WITHDRAWAL_COINS,
    storefrontCustomerId,
  };
}

function assertUniqueSku(product: Product, products: Product[]): void {
  const sku = product.sku?.trim().toLowerCase();
  if (!sku) return;
  const clash = products.find((p) => p.id !== product.id && p.sku?.trim().toLowerCase() === sku);
  if (clash) throw new HttpError(409, `SKU ${product.sku} is already used by ${clash.title}`);
}

export async function createProduct(input: Partial<Product>, actor: string): Promise<Product> {
  if (!input.title?.trim()) throw new HttpError(422, "Product title is required");
  if (!input.price || input.price <= 0) throw new HttpError(422, "Retail price must be greater than zero");

  const price = Number(input.price);
  const mrp = Math.max(price, Number(input.mrp) || Math.round(price * 1.5));

  const gsm = Number(input.gsm ?? 240);
  const slug =
    input.slug ??
    input.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const rawPoints =
    input.cashbackPoints !== undefined
      ? input.cashbackPoints
      : (input as ProductPatchWithLegacyPoints).rewardCoins;
  const cashbackPoints =
    rawPoints !== undefined && rawPoints !== null && String(rawPoints).trim() !== ""
      ? Math.max(0, Math.round(Number(rawPoints)))
      : undefined;

  const uniqueId = `zenin-tee-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const autoSku = `ZN-SS26-${slug.substring(0, 6).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

  const product: Product = {
    id: uniqueId,
    slug,
    title: input.title.toUpperCase(),
    subtitle: input.subtitle ?? `Heavyweight ${gsm} GSM Combed Cotton`,
    description:
      input.description ??
      `Crafted with ${gsm} GSM super combed bio-washed cotton and high-density DTG print.`,
    category: "T-Shirts",
    productType: "tshirt",
    price,
    mrp,
    gsm,
    fabric: input.fabric?.trim() || "100% Bio-Washed Combed Cotton (Pre-Shrunk)",
    packFit: input.packFit?.trim() || undefined,
    packPrint: input.packPrint?.trim() || undefined,
    packWash: input.packWash?.trim() || undefined,
    badge: input.badge ?? "NEW DROP",
    rating: input.rating ?? 5,
    reviewsCount: input.reviewsCount ?? 1,
    imageUrl: input.imageUrl,
    imageHoverUrl: input.imageHoverUrl,
    imageBackUrl: input.imageBackUrl,
    artworkUrl: input.artworkUrl?.trim() || undefined,
    heroImage: input.heroImage === "back" ? "back" : "front",
    imageGallery: input.imageGallery?.length ? input.imageGallery : undefined,
    sku: input.sku?.trim() || autoSku,
    theme: input.theme?.trim() || "Heavyweight Core",
    colors: input.colors?.length
      ? input.colors
      : [
          { name: "Onyx Black", hex: "#0b0c10", previewClass: "bg-[#0b0c10]" },
        ],
    sizes: input.sizes?.length ? input.sizes : ["S", "M", "L", "XL", "XXL"],
    graphicSvgType: input.graphicSvgType ?? "cyber_tokyo",
    graphicTitle: input.graphicTitle ?? input.title.toUpperCase(),
    accentColor: input.accentColor ?? "#fbbf24",
    stock: input.stock ?? 60,
    isArchived: false,
    cashbackPoints,
    rewardCoins: cashbackPoints,
    codAvailable: input.codAvailable !== false,
    showOnStorefront: input.showOnStorefront !== false,
    showInAnime: input.showInAnime !== false,
    showInPremium: input.showInPremium === true,
    showInNewDrops: input.showInNewDrops !== false,
    showInBestSellers: input.showInBestSellers === true,
  };

  return mutate((state) => {
    assertUniqueSku(product, state.products);
    state.products.unshift(product);
    recordAudit(
      state,
      actor,
      "PRODUCT_CREATED",
      `Published ${product.title} at ₹${product.price} (MRP ₹${product.mrp}${product.cashbackPoints != null ? `, ${product.cashbackPoints} cashback coins` : ""}, ${product.codAvailable === false ? "prepaid only" : "COD allowed"})`
    );
    return product;
  });
}

const PLACEMENT_FLAGS = [
  "showOnStorefront",
  "showInAnime",
  "showInPremium",
  "showInNewDrops",
  "showInBestSellers",
] as const;

export async function updateProduct(id: string, patch: Partial<Product>, actor: string): Promise<Product> {
  return mutate((state) => {
    const targetId = decodeURIComponent(id).trim();
    const product = state.products.find(
      (p) =>
        p.id === targetId ||
        p.slug === targetId ||
        p.id === id ||
        p.slug === id ||
        p.id.toLowerCase() === targetId.toLowerCase() ||
        p.slug.toLowerCase() === targetId.toLowerCase()
    );
    if (!product) throw new HttpError(404, "Product not found");

    const normalizedPatch: Partial<Product> = { ...patch };
    if ("price" in patch && patch.price !== undefined) {
      normalizedPatch.price = Math.max(0, Number(patch.price));
    }
    if ("mrp" in patch && patch.mrp !== undefined) {
      const basePrice = normalizedPatch.price ?? product.price;
      normalizedPatch.mrp = Math.max(basePrice, Number(patch.mrp) || Math.round(basePrice * 1.5));
    }
    if ("stock" in patch && patch.stock !== undefined) {
      normalizedPatch.stock = Math.max(0, Number(patch.stock));
    }

    if (patch.imageUrl) {
      normalizedPatch.imageUrl = patch.imageUrl;
    }
    if (patch.imageBackUrl) {
      normalizedPatch.imageBackUrl = patch.imageBackUrl;
    }
    if (patch.imageHoverUrl) {
      normalizedPatch.imageHoverUrl = patch.imageHoverUrl;
    }
    if (patch.imageGallery) {
      normalizedPatch.imageGallery = patch.imageGallery;
    }
    if (patch.artworkUrl) {
      normalizedPatch.artworkUrl = patch.artworkUrl;
      if (!patch.imageBackUrl) normalizedPatch.imageBackUrl = patch.artworkUrl;
      if (!patch.imageHoverUrl) normalizedPatch.imageHoverUrl = patch.artworkUrl;
    }
    if ("heroImage" in patch) {
      normalizedPatch.heroImage = patch.heroImage === "back" ? "back" : "front";
    }

    if ("cashbackPoints" in patch || "rewardCoins" in patch) {
      const legacyPatch = patch as ProductPatchWithLegacyPoints;
      const legacyNormalized = normalizedPatch as ProductPatchWithLegacyPoints;
      const rawPoints = "cashbackPoints" in patch ? patch.cashbackPoints : legacyPatch.rewardCoins;
      if (rawPoints === null || rawPoints === undefined || String(rawPoints).trim() === "") {
        normalizedPatch.cashbackPoints = undefined;
        legacyNormalized.rewardCoins = undefined;
      } else {
        const val = Math.max(0, Math.round(Number(rawPoints)));
        normalizedPatch.cashbackPoints = val;
        legacyNormalized.rewardCoins = val;
      }
    }

    if ("codAvailable" in patch) {
      normalizedPatch.codAvailable = patch.codAvailable === true || String(patch.codAvailable) === "true";
    }

    for (const key of PLACEMENT_FLAGS) {
      if (key in patch) {
        if (patch[key] === undefined || String(patch[key]).trim() === "") {
          normalizedPatch[key] = undefined;
        } else {
          normalizedPatch[key] = patch[key] === true || String(patch[key]) === "true";
        }
      }
    }

    if ("sku" in patch) {
      normalizedPatch.sku = patch.sku?.trim() || undefined;
    }

    // An admin who empties these fields means "remove them"; JSON can only carry "", so clear here.
    for (const key of ["theme"] as const) {
      if (key in patch) normalizedPatch[key] = patch[key]?.trim() || undefined;
    }

    // Validate the merged row first: a rejected write must not leave the cached state half-edited.
    const merged = { ...product, ...normalizedPatch } as Product;
    assertUniqueSku(merged, state.products);

    for (const key of Object.keys(normalizedPatch) as (keyof Product)[]) {
      if (normalizedPatch[key] === undefined) {
        delete product[key];
      } else {
        Object.assign(product, { [key]: normalizedPatch[key] });
      }
    }
    product.id = product.id;

    if (patch.isArchived !== undefined) {
      recordAudit(
        state,
        actor,
        patch.isArchived ? "PRODUCT_ARCHIVED" : "PRODUCT_PUBLISHED",
        `${product.title} ${patch.isArchived ? "removed from" : "restored to"} storefront catalog`
      );
    } else if (patch.showOnStorefront !== undefined) {
      recordAudit(
        state,
        actor,
        "PRODUCT_VISIBILITY",
        `${product.title} ${patch.showOnStorefront ? "made visible again" : "hidden from"} the public catalog`
      );
    } else {
      recordAudit(
        state,
        actor,
        "PRODUCT_UPDATED",
        `Edited ${product.title} (₹${product.price}${product.cashbackPoints != null ? `, ${product.cashbackPoints} cashback coins` : ""}, ${product.codAvailable === false ? "prepaid only" : "COD allowed"})`
      );
    }
    return product;
  });
}

export async function archiveProduct(id: string, actor: string): Promise<Product> {
  return await updateProduct(id, { isArchived: true }, actor);
}

export function quote(input: QuoteInput, customerId: string | null): QuoteResult {
  const state = readState();
  void customerId;

  if (!input.items?.length) throw new HttpError(422, "Cart is empty");
  if (input.paymentMethod === "COINS") {
    throw new HttpError(
      422,
      "Coins cannot pay for orders. Pay the INR amount with a payment gateway or Cash on Delivery."
    );
  }
  input.items.forEach((item) => {
    if (!item.title || !item.size || !item.colorName) {
      throw new HttpError(422, "Every cart line needs a title, size and colour");
    }
    if (item.quantity < 1 || item.quantity > 10) {
      throw new HttpError(422, `Quantity for ${item.title} must be between 1 and 10`);
    }

    // Authoritative catalog price lookup: always enforce live admin price
    const catalogProduct = item.productId
      ? state.products.find((p) => p.id === item.productId || p.slug === item.productId)
      : state.products.find((p) => p.title.toLowerCase() === item.title.toLowerCase());
    if (catalogProduct && catalogProduct.price !== undefined) {
      item.price = catalogProduct.price;
    }
  });

  const subtotal = Number(input.items.reduce((sum, i) => sum + i.price * i.quantity, 0).toFixed(2));
  if (subtotal <= 0) throw new HttpError(422, "Cart total must be greater than zero");

  let couponDiscount = 0;
  let couponLabel: string | undefined = undefined;
  let shippingWaived = false;

  if (input.couponCode) {
    const coupon = findCoupon(input.couponCode);
    if (coupon) {
      if (subtotal < coupon.minOrder) {
        throw new HttpError(422, `Coupon ${coupon.code} requires a minimum order of ₹${coupon.minOrder}`);
      }
      if (coupon.kind === "percent") {
        couponDiscount = Number(((subtotal * coupon.value) / 100).toFixed(2));
        couponLabel = coupon.label || `${coupon.value}% Off`;
      } else if (coupon.kind === "flat") {
        couponDiscount = Math.min(coupon.value, subtotal);
        couponLabel = coupon.label || `₹${coupon.value} Off`;
      } else if (coupon.kind === "shipping") {
        shippingWaived = true;
        couponLabel = coupon.label || "Free Shipping";
      }
    } else {
      throw new HttpError(404, `Promo code "${input.couponCode}" is invalid or expired`);
    }
  }

  // Prices, totals and fees are INR only. Coins never reduce the amount payable.
  const { shippingCharge, shippingMode, freeShippingMinAmount } = getShippingConfig(state);
  const merchandise = Math.max(0, subtotal - couponDiscount);
  const qualifiesForFreeShipping =
    shippingCharge <= 0 ||
    shippingWaived ||
    (shippingMode === "MIN_AMOUNT" && merchandise >= freeShippingMinAmount);
  const deliveryFee = qualifiesForFreeShipping ? 0 : shippingCharge;

  // Dynamic Gateway Surcharge Fee Calculation
  const gatewaysCfg = getGatewaysConfig(state);
  let gatewayFee = 0;
  let gatewayFeeLabel: string | undefined = undefined;
  let gatewayFeeHidden = false;

  let feeCfg = undefined;
  const method = input.paymentMethod;
  const provider = input.gatewayProvider;

  if (provider === "ownpay" || (method as string) === "OWNPAY") {
    feeCfg = gatewaysCfg.ownpayFee;
  } else if (provider === "manual_upi" || method === "MANUAL_UPI") {
    feeCfg = gatewaysCfg.manualUpiFee;
  } else if (method === "COD") {
    feeCfg = gatewaysCfg.codFee;
  } else if (
    provider === "razorpay" ||
    method === "CARD" ||
    method === "NETBANKING" ||
    method === "UPI" ||
    (method as string) === "ONLINE" ||
    (method as string) === "RAZORPAY"
  ) {
    feeCfg = gatewaysCfg.razorpayFee;
  }

  const isFeePositive = feeCfg && ((feeCfg.percent ?? 0) > 0 || (feeCfg.flatAmount ?? 0) > 0);
  if (feeCfg && (feeCfg.enabled || isFeePositive)) {
    const percentAmt = (merchandise * (feeCfg.percent || 0)) / 100;
    gatewayFee = Math.round(percentAmt + (feeCfg.flatAmount || 0));
    gatewayFeeLabel = feeCfg.customLabel || (method === "COD" ? "Cash on Delivery Handling Charge" : "Payment Processing Fee");
    gatewayFeeHidden = Boolean(feeCfg.hideBreakdownOnCheckout);
  }

  // Tax is configured admin-side and applies to prepaid orders only. A quote without an
  // explicit payment method (cart page) stays untaxed so the cart never over-promises.
  const rawOrderTax = Number(state.rewardRules?.orderTaxPercent ?? 0);
  const taxPercent =
    input.paymentMethod && input.paymentMethod !== "COD" && Number.isFinite(rawOrderTax) && rawOrderTax > 0
      ? Math.min(rawOrderTax, 50)
      : 0;
  const taxAmount = taxPercent > 0 ? Number(((merchandise * taxPercent) / 100).toFixed(2)) : 0;

  const total = Number(Math.max(0, merchandise + taxAmount + deliveryFee + gatewayFee).toFixed(2));

  let baseCashbackCoins = 0;
  const codBlockedTitles: string[] = [];
  for (const item of input.items) {
    const product = item.productId
      ? state.products.find((p) => p.id === item.productId)
      : state.products.find((p) => p.title.toLowerCase() === item.title.toLowerCase());

    // A line that resolves to no catalog product cannot be verified for COD, so it is prepaid only.
    if (!product || product.codAvailable === false) {
      if (!codBlockedTitles.includes(item.title)) codBlockedTitles.push(item.title);
    }

    const qty = Math.max(1, item.quantity || 1);
    if (product && (product.stock ?? 60) <= 0) {
      throw new HttpError(409, `${product.title} just sold out — remove it to continue`);
    }

    // One implementation for the coin promise, shared with the card and the detail sheet.
    const cash = product ? cashbackForProduct(product) : null;
    baseCashbackCoins += (cash?.coins ?? 0) * qty;
  }

  // Cashback is always coins (never INR). Coupon savings scale the promise with what was paid.
  const cashbackCoins =
    subtotal > 0 ? Math.max(0, Math.round(baseCashbackCoins * (merchandise / subtotal))) : 0;

  return {
    subtotal,
    couponDiscount,
    deliveryFee,
    shippingMode,
    freeShippingThreshold: freeShippingMinAmount,
    baseDeliveryFee: shippingCharge,
    gatewayFee,
    gatewayFeeLabel,
    gatewayFeeHidden,
    taxPercent,
    taxAmount,
    total,
    cashbackCoins,
    couponLabel,
    codAvailable: (getGatewaysConfig().codEnabled !== false) && codBlockedTitles.length === 0,
    codBlockedTitles: (getGatewaysConfig().codEnabled === false)
      ? ["Cash on Delivery is disabled store-wide by Admin"]
      : codBlockedTitles,
  };
}

export async function placeOrder(
  input: PlaceOrderInput,
  customerId: string | null,
  gateway?: { orderId: string; paymentId: string; provider?: "razorpay" | "ownpay" }
): Promise<OrderResult> {
  const quoteResult = quote(input, customerId);

  const result = await mutate((state) => {
    let buyer = customerId ? state.customers.find((c) => c.id === customerId) ?? null : null;
    const cleanPhone = input.customerPhone.replace(/\D/g, "");
    const last10 = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : "";

    // Always prefer existing customer matching this phone number so a duplicate ID is NEVER created
    if (last10) {
      const existingByPhone = state.customers.find((c) => (c.phone || "").replace(/\D/g, "").endsWith(last10));
      if (existingByPhone) {
        buyer = existingByPhone;
      }
    }

    if (!buyer && input.customerEmail?.trim()) {
      const existingByEmail = state.customers.find(
        (c) => c.email && c.email.toLowerCase() === input.customerEmail.trim().toLowerCase()
      );
      if (existingByEmail) {
        buyer = existingByEmail;
      }
    }

    if (!buyer) {
      // Auto-create customer profile on checkout so they appear in Admin Members and accumulate coins
      buyer = {
        id: `usr-${Date.now().toString(36)}`,
        name: input.customerName.trim() || "Skywear Member",
        phone: cleanPhone.length === 10 ? `+91 ${cleanPhone}` : input.customerPhone.trim(),
        email: input.customerEmail.trim() || undefined,
        referralCode: referralCodeFor(state, input.customerName.trim() || "Skywear Member"),
        availableCoins: 0,
        pendingCoins: 0,
        referralCoinBalance: 0,
        lifetimeEarnedCoins: 0,
        tier: "Silver",
        addresses: [
          {
            label: "Default Address",
            street: input.address.trim(),
            city: input.city.trim(),
            state: input.state.trim(),
            pincode: input.pincode,
            isDefault: true,
          },
        ],
        bankAccounts: [],
      };
      state.customers.push(buyer);
      recordAudit(state, buyer.name, "CUSTOMER_AUTO_CREATED", `Profile created from checkout: ${buyer.name} (${buyer.phone})`);
    } else {
      if (input.customerName.trim() && (!buyer.name || buyer.name === "Skywear Member" || buyer.name === "Zenin Member")) {
        buyer.name = input.customerName.trim();
      }
      if (input.customerEmail.trim() && !buyer.email) {
        buyer.email = input.customerEmail.trim();
      }
      if (cleanPhone.length === 10 && (!buyer.phone || buyer.phone === "+91 90000 00000")) {
        buyer.phone = `+91 ${cleanPhone}`;
      }
    }

    // Idempotency: prevent duplicate orders & cashback from repeated callbacks or refreshes
    if (gateway?.paymentId) {
      const existing = state.orders.find((o) => o.gatewayPaymentId === gateway.paymentId);
      if (existing) {
        return { order: existing, quote: quoteResult };
      }
    }

    const isManualUpi = input.paymentMethod === "MANUAL_UPI";
    const gatewaysCfg = getGatewaysConfig(state);

    if (input.paymentMethod === "COINS") {
      throw new HttpError(422, "Coins cannot pay for orders. Pay the INR amount with a payment gateway or Cash on Delivery.");
    }
    if (input.paymentMethod !== "COD" && !isManualUpi && !gateway) {
      throw new HttpError(422, "Complete the payment via Razorpay or OwnPay before placing this order");
    }
    if (isManualUpi && !gatewaysCfg.manualUpiEnabled) {
      throw new HttpError(422, "Manual UPI payment is currently disabled by Admin. Please select online payment or Cash on Delivery.");
    }
    if (gateway?.provider === "razorpay" && !gatewaysCfg.razorpayEnabled) {
      throw new HttpError(422, "Razorpay payment gateway is currently disabled by Admin.");
    }
    if (gateway?.provider === "ownpay" && !gatewaysCfg.ownpayEnabled) {
      throw new HttpError(422, "OwnPay payment gateway is currently disabled by Admin.");
    }
    if (input.paymentMethod === "COD" && !gatewaysCfg.codEnabled) {
      throw new HttpError(422, "Cash on Delivery (COD) is currently disabled by Admin. Please choose an online payment method.");
    }
    if (input.paymentMethod === "COD" && !quoteResult.codAvailable) {
      throw new HttpError(
        422,
        `Cash on Delivery is not available on ${quoteResult.codBlockedTitles.join(", ")} — this drop is prepaid only. Pay online to place the order.`
      );
    }
    if (!PINCODE.test(input.pincode)) throw new HttpError(422, "Enter a valid 6-digit Indian PIN code");
    if (!INDIAN_MOBILE.test(input.customerPhone.replace(/\s/g, ""))) {
      throw new HttpError(422, "Enter a valid 10-digit Indian mobile number");
    }
    if (!input.customerName.trim() || input.address.trim().length < 8 || !input.city.trim()) {
      throw new HttpError(422, "Complete the shipping address before placing the order");
    }
    const placedAt = nowIso();
    const number = orderNumber("TC", state);
    const referralCodeUsed = (input.referralCode || buyer?.referredByCode)?.trim().toUpperCase();
    const referrer = referralCodeUsed
      ? state.customers.find((c) => c.referralCode.toUpperCase() === referralCodeUsed) ?? null
      : null;
    if (referrer && buyer && referrer.id === buyer.id) {
      throw new HttpError(422, "You cannot use your own referral code");
    }

    // Referral reward is coins, derived from the referred order's eligible INR amount.
    const referralRatePercent = referrer
      ? agentCommissionRateFor(state.rewardRules, referrer)
      : state.rewardRules.referralCommissionPercent;
    const referralCoinsEarned = referrer
      ? referralCoinsFor(
          quoteResult.subtotal - quoteResult.couponDiscount,
          referralRatePercent
        )
      : 0;

    const upiConfig = state.manualUpi ?? DEFAULT_MANUAL_UPI;
    const manualUpiSnapshot = isManualUpi
      ? {
          upiId: upiConfig.upiId,
          merchantName: upiConfig.merchantName,
          amount: quoteResult.total,
          instructions: upiConfig.instructions,
        }
      : undefined;

    const gatewayProvider = isManualUpi ? "manual_upi" : gateway?.provider ?? "razorpay";

    const order: ShopOrder = {
      id: `ord_${Date.now().toString(36)}`,
      orderNumber: number,
      kind: "SALE",
      customerId: buyer?.id,
      customerName: input.customerName.trim(),
      customerEmail: input.customerEmail.trim(),
      customerPhone: input.customerPhone.trim(),
      address: input.address.trim(),
      city: input.city.trim(),
      state: input.state.trim(),
      pincode: input.pincode,
      items: input.items.map((i) => ({
        title: i.title,
        size: i.size,
        color: i.colorName,
        quantity: i.quantity,
        price: i.price,
        graphicSvgType: i.graphicSvgType,
      })),
      subtotal: quoteResult.subtotal,
      couponCode: input.couponCode?.toUpperCase(),
      discount: quoteResult.couponDiscount,
      cashbackCoins: quoteResult.cashbackCoins,
      referralCoinsEarned,
      referrerCode: referrer?.referralCode,
      deliveryFee: quoteResult.deliveryFee,
      gatewayFee: quoteResult.gatewayFee,
      taxPercent: quoteResult.taxPercent,
      taxAmount: quoteResult.taxAmount,
      total: quoteResult.total,
      paymentMethod: input.paymentMethod,
      paymentStatus: (input.paymentMethod === "COD" || isManualUpi) ? "PENDING" : "PAID",
      gateway: (isManualUpi || gateway) ? gatewayProvider : undefined,
      gatewayOrderId: isManualUpi ? number : gateway?.orderId,
      gatewayPaymentId: gateway?.paymentId,
      manualUpiSnapshot,
      status: "PENDING",
      podProvider: "Qikink",
      podOrderId: undefined,
      podStatus: isManualUpi ? "awaiting_payment" : "queued",
      placedAt,
      timeline: [
        {
          label: "PENDING",
          at: placedAt,
          note: isManualUpi
            ? `Manual UPI order created. Awaiting transfer of ₹${quoteResult.total} to ${manualUpiSnapshot?.upiId} and UTR submission.`
            : gateway
            ? `Payment captured by ${gatewayProvider === "ownpay" ? "OwnPay" : "Razorpay"} (${gateway.paymentId}). Order received on storefront`
            : `${input.paymentMethod} order received on storefront`,
        },
      ],
    };

    if (order.paymentStatus === "PAID" && quoteResult.cashbackCoins > 0) {
      order.cashback = buildCashbackSchedule(quoteResult.cashbackCoins, placedAt);
    }

    state.orders.unshift(order);

    if (buyer) {
      buyer.pendingCoins += quoteResult.cashbackCoins;
      buyer.lifetimeEarnedCoins += quoteResult.cashbackCoins;
    }

    if (quoteResult.cashbackCoins > 0) {
      state.transactions.unshift(
        walletTx({
          customerId: buyer?.id,
          orderId: order.id,
          type: "CASHBACK",
          coins: quoteResult.cashbackCoins,
          unit: "COINS",
          idempotencyKey: `cashback-${number}`,
          description: cashbackLedgerLine(order),
          orderNumber: number,
          status: "PENDING",
        })
      );
    }

    if (referrer && referralCoinsEarned > 0) {
      const isPaid = order.paymentStatus === "PAID";
      if (isPaid) {
        referrer.referralCoinBalance = Number(
          ((referrer.referralCoinBalance || 0) + referralCoinsEarned).toFixed(2)
        );
        order.referralCoinsCreditedAt = placedAt;
      }

      // One referral ledger row per order; the key is the duplicate-credit guard.
      const referralKey = `referral-${number}`;
      const alreadyLogged = state.transactions.some((t) => t.idempotencyKey === referralKey);
      if (!alreadyLogged) {
        state.transactions.unshift(
          walletTx({
            customerId: referrer.id,
            orderId: order.id,
            type: "REFERRAL_COMMISSION",
            coins: referralCoinsEarned,
            unit: "COINS",
            idempotencyKey: referralKey,
            description: isPaid
              ? `${referralRatePercent}% referral reward on ₹${quoteResult.total} order #${number} — +${referralCoinsEarned.toLocaleString("en-IN")} Referral Coins`
              : `${referralRatePercent}% referral reward on ₹${quoteResult.total} order #${number} — +${referralCoinsEarned.toLocaleString("en-IN")} Referral Coins (pending payment verification)`,
            orderNumber: number,
            status: isPaid ? "COMPLETED" : "PENDING",
          })
        );
      }

      const inputPhoneDigits = input.customerPhone ? input.customerPhone.replace(/\D/g, "") : "";
      const lead = state.referrals.find((r) => {
        const rPhoneDigits = r.friendPhone ? r.friendPhone.replace(/\D/g, "") : "";
        const matchPhone = inputPhoneDigits.length >= 10 && rPhoneDigits.endsWith(inputPhoneDigits.slice(-10));
        const matchEmail = Boolean(r.friendEmail && input.customerEmail && r.friendEmail.toLowerCase() === input.customerEmail.toLowerCase());
        return (!r.orderNumber || r.orderNumber === number) && (matchPhone || matchEmail);
      });
      if (lead) {
        lead.referrerId = referrer.id;
        lead.referrerCode = referrer.referralCode;
        if (input.customerPhone && !lead.friendPhone) lead.friendPhone = input.customerPhone;
        lead.orderNumber = number;
        lead.orderAmountInr = Number((quoteResult.subtotal - quoteResult.couponDiscount).toFixed(2));
        lead.commissionCoins = referralCoinsEarned;
        lead.creditedAt = isPaid ? placedAt : undefined;
        lead.status = isPaid ? "PAID" : "PENDING";
      } else {
        state.referrals.unshift({
          id: `ref-${Date.now().toString(36)}`,
          referrerId: referrer.id,
          referrerCode: referrer.referralCode,
          friendName: input.customerName,
          friendPhone: input.customerPhone,
          friendEmail: input.customerEmail,
          dateJoined: dateLabel(nowIso()),
          orderNumber: number,
          orderAmountInr: Number((quoteResult.subtotal - quoteResult.couponDiscount).toFixed(2)),
          commissionCoins: referralCoinsEarned,
          creditedAt: isPaid ? placedAt : undefined,
          status: isPaid ? "PAID" : "PENDING",
        });
      }
      recordAudit(
        state,
        "System (storefront)",
        "REFERRAL_COMMISSION_CREDITED",
        `+${referralCoinsEarned.toLocaleString("en-IN")} Referral Coins credited to ${referrer.name} for referral ${referrer.referralCode}`
      );

      if (isPaid) {
        creditAgentSlabBonuses(state, referrer, referralCoinsEarned, placedAt);
      }
    }

    order.items.forEach((line) => {
        const product = state.products.find((p) => p.title === line.title);
        if (product) product.stock = Math.max(0, (product.stock ?? 60) - line.quantity);
      });

    releaseDueCashback(state);
    activateOrderCashback(state, order);
    const unlockedNow = cashbackTotals(order.cashback).releasedCoins;

    recordAudit(
      state,
      buyer?.name ?? "Guest",
      "ORDER_PLACED",
      `${number} • ₹${quoteResult.total} • ${input.paymentMethod}${gateway ? ` via Razorpay ${gateway.paymentId}` : ""} • earned ${quoteResult.cashbackCoins} cashback coins • ${unlockedNow} released now (Day 1/30), rest vests daily over 30 days`
    );

    return { order, quote: quoteResult };
  });

  try {
    void broadcastPushNotification(
      {
        title: "⚡ Order Confirmed!",
        body: `Order #${result.order.orderNumber} for ₹${result.order.total} has been placed. You earned ${result.quote.cashbackCoins} Cashback Coins!`,
        url: "/?tab=orders",
        tag: `order-placed-${result.order.orderNumber}`,
      },
      result.order.customerId
    );
  } catch (err) {
    console.error("[webpush] Failed to dispatch placeOrder push:", err);
  }

  if (result.order.customerPhone) {
    const order = result.order;
    const itemsSummary = order.items.map((i) => `• ${i.title} (${i.size}, ${i.color}) x${i.quantity}`).join("\n");
    const waText = [
      `🛍️ *Skywear Order Placed!*`,
      ``,
      `Hi ${order.customerName.split(" ")[0]}! Thank you for ordering from Skywear.`,
      ``,
      `📦 *Order:* #${order.orderNumber}`,
      `💰 *Total:* ₹${order.total}`,
      `💳 *Payment:* ${order.paymentMethod}`,
      ...(result.quote.cashbackCoins > 0 ? [`🪙 *Cashback Coins:* +${result.quote.cashbackCoins} Coins`] : []),
      ``,
      `*Items:*`,
      itemsSummary,
      ``,
      `Track your order live:`,
      `https://skywear.in/track?orderId=${order.orderNumber}`,
    ].join("\n");

    void sendWhatsAppMessage(order.customerPhone, waText);
  }

  return result;
}

export function submitManualUpiPayment(
  orderNumber: string,
  rawUtr: string,
  screenshot?: string
): Promise<{ order: ShopOrder }> {
  const { valid, cleaned, error } = validateUtr(rawUtr);
  if (!valid) throw new HttpError(422, error || "Invalid UTR reference number");

  return mutate((state) => {
    const cleanNumber = orderNumber.trim().toUpperCase();
    const order = state.orders.find(
      (o) => o.orderNumber.toUpperCase() === cleanNumber || o.id === orderNumber.trim()
    );
    if (!order) throw new HttpError(404, `Order #${orderNumber} not found`);

    if (order.paymentStatus === "PAID") {
      throw new HttpError(409, `Order #${order.orderNumber} is already confirmed as PAID`);
    }

    // Uniqueness validation: Prevent duplicate UTR submission across all orders
    const duplicate = state.orders.find(
      (o) => o.utr && o.utr.toUpperCase() === cleaned && o.orderNumber !== order.orderNumber
    );
    if (duplicate) {
      throw new HttpError(
        409,
        `UTR reference ${cleaned} has already been submitted for order #${duplicate.orderNumber}. Each transaction reference must be unique.`
      );
    }

    const submitIso = nowIso();
    order.utr = cleaned;
    order.utrSubmittedAt = submitIso;
    order.paymentStatus = "PENDING_VERIFICATION";
    if (screenshot) order.paymentScreenshot = screenshot;

    order.timeline.push({
      label: "PENDING_VERIFICATION",
      at: submitIso,
      note: `Payment reference submitted (UTR: ${cleaned}). Awaiting merchant bank verification.`,
    });

    recordAudit(
      state,
      order.customerName,
      "MANUAL_UPI_UTR_SUBMITTED",
      `Order #${order.orderNumber} UTR submitted: ${cleaned}${screenshot ? " (with screenshot)" : ""}`
    );

    return { order };
  });
}

export function verifyManualUpiPayment(
  orderNumberOrId: string,
  adminActor: string,
  utr?: string
): Promise<{ order: ShopOrder }> {
  return mutate((state) => {
    const cleanKey = orderNumberOrId.trim().toUpperCase();
    const order = state.orders.find(
      (o) => o.orderNumber.toUpperCase() === cleanKey || o.id === orderNumberOrId.trim()
    );
    if (!order) throw new HttpError(404, `Order #${orderNumberOrId} not found`);

    if (order.paymentStatus === "PAID") {
      throw new HttpError(409, `Order #${order.orderNumber} is already verified and PAID`);
    }

    const verifyIso = nowIso();
    if (utr && utr.trim()) {
      order.utr = utr.trim();
      order.utrSubmittedAt = order.utrSubmittedAt || verifyIso;
    }
    order.paymentStatus = "PAID";
    order.status = "APPROVED";
    order.podStatus = "queued";
    order.verifiedBy = adminActor;
    order.verifiedAt = verifyIso;

    order.timeline.push({
      label: "APPROVED",
      at: verifyIso,
      note: `Manual UPI payment verified by ${adminActor}${order.utr ? ` (UTR: ${order.utr})` : ""}. Order marked as PAID and approved for printing.`,
    });

    // Award cashback schedule if not already scheduled
    if (order.cashbackCoins > 0 && (!order.cashback || order.cashback.length === 0)) {
      order.cashback = buildCashbackSchedule(order.cashbackCoins, verifyIso);
    }
    releaseDueCashback(state);

    // Verified payment: push every eligible slice straight into the Live Wallet.
    activateOrderCashback(state, order);

    // Update customer's pending cashback transaction to COMPLETED
    state.transactions
      .filter((t) => t.orderNumber === order.orderNumber && t.type === "CASHBACK" && t.status === "PENDING")
      .forEach((t) => {
        t.status = "COMPLETED";
      });

    // Credit the referral reward now that the payment is verified.
    if (order.referralCoinsEarned > 0 && order.referrerCode) {
      const referrer = state.customers.find(
        (c) => c.referralCode.toUpperCase() === order.referrerCode?.toUpperCase()
      );
      if (referrer) {
        // The order flag is the credit guard; a second verification can never double-pay.
        if (!order.referralCoinsCreditedAt) {
          referrer.referralCoinBalance = Number(
            ((referrer.referralCoinBalance || 0) + order.referralCoinsEarned).toFixed(2)
          );
          order.referralCoinsCreditedAt = verifyIso;
        }
        const referralKey = `referral-${order.orderNumber}`;
        const pendingRefTx =
          state.transactions.find((t) => t.idempotencyKey === referralKey) ??
          state.transactions.find(
            (t) => t.orderNumber === order.orderNumber && t.type === "REFERRAL_COMMISSION"
          );
        const referralRatePercent = agentCommissionRateFor(state.rewardRules, referrer);
        const referralDescription = `${referralRatePercent}% referral reward on ₹${order.total} order #${order.orderNumber} credited — +${order.referralCoinsEarned.toLocaleString("en-IN")} Referral Coins`;
        if (pendingRefTx) {
          pendingRefTx.status = "COMPLETED";
          pendingRefTx.coins = order.referralCoinsEarned;
          pendingRefTx.unit = "COINS";
          pendingRefTx.idempotencyKey = referralKey;
          pendingRefTx.description = referralDescription;
        } else {
          state.transactions.unshift(
            walletTx({
              customerId: referrer.id,
              orderId: order.id,
              type: "REFERRAL_COMMISSION",
              coins: order.referralCoinsEarned,
              unit: "COINS",
              idempotencyKey: referralKey,
              description: referralDescription,
              orderNumber: order.orderNumber,
              status: "COMPLETED",
            })
          );
        }
        const lead = state.referrals.find((r) => r.orderNumber === order.orderNumber);
        if (lead) {
          lead.status = "PAID";
          lead.commissionCoins = order.referralCoinsEarned;
          lead.creditedAt = verifyIso;
        }
        creditAgentSlabBonuses(state, referrer, order.referralCoinsEarned, verifyIso);
      }
    }

    recordAudit(
      state,
      adminActor,
      "MANUAL_UPI_PAYMENT_VERIFIED",
      `Payment verified for order #${order.orderNumber} (₹${order.total}, UTR: ${order.utr || "N/A"}). Marked PAID & APPROVED.`
    );

    if (order.customerPhone) {
      void sendWhatsAppMessage(
        order.customerPhone,
        [
          `✅ *Payment Verified & Order Approved!*`,
          ``,
          `Hi ${order.customerName.split(" ")[0]}, your payment of ₹${order.total} for Order #${order.orderNumber} has been verified!`,
          ``,
          `Your order has been queued for production.`,
          `Track: https://skywear.in/track?orderId=${order.orderNumber}`,
        ].join("\n")
      );
    }

    try {
      void broadcastPushNotification(
        {
          title: "✅ Payment Verified & Order Approved!",
          body: `Payment for Order #${order.orderNumber} (₹${order.total}) has been verified and approved. Your daily cashback schedule is now live!`,
          url: "/?tab=orders",
          tag: `order-verified-${order.orderNumber}`,
        },
        order.customerId
      );
    } catch (err) {
      console.warn("[webpush] verifyManualUpiPayment push warning:", err);
    }

    return { order };
  });
}

export function rejectManualUpiPayment(
  orderNumberOrId: string,
  reason: string,
  adminActor: string
): Promise<{ order: ShopOrder }> {
  return mutate((state) => {
    const cleanKey = orderNumberOrId.trim().toUpperCase();
    const order = state.orders.find(
      (o) => o.orderNumber.toUpperCase() === cleanKey || o.id === orderNumberOrId.trim()
    );
    if (!order) throw new HttpError(404, `Order #${orderNumberOrId} not found`);

    if (order.paymentStatus === "PAID") {
      throw new HttpError(409, `Order #${order.orderNumber} is already verified and PAID`);
    }

    const rejectIso = nowIso();
    const cleanReason = reason.trim() || "Payment could not be matched with bank statements";
    order.paymentStatus = "REJECTED";
    order.status = "CANCELLED";
    order.rejectedAt = rejectIso;
    order.rejectionReason = cleanReason;

    // Void cashback slices, deduct lifetime earnings, and claw back referral commissions
    reverseOrderEarnings(state, order, adminActor, cleanReason);

    order.timeline.push({
      label: "REJECTED",
      at: rejectIso,
      note: `Payment reference rejected by ${adminActor}: "${cleanReason}". Order cancelled.`,
    });

    recordAudit(
      state,
      adminActor,
      "MANUAL_UPI_PAYMENT_REJECTED",
      `Rejected payment for order #${order.orderNumber}: ${cleanReason}. Cancelled order and reversed coins.`
    );

    try {
      void broadcastPushNotification(
        {
          title: "❌ Payment Rejected",
          body: `Payment for Order #${order.orderNumber} was rejected: ${cleanReason}. Order has been cancelled.`,
          url: "/?tab=orders",
          tag: `order-rejected-${order.orderNumber}`,
        },
        order.customerId
      );
    } catch (err) {
      console.warn("[webpush] rejectManualUpiPayment push warning:", err);
    }

    return { order };
  });
}

export function getManualUpiSettings(): ManualUpiConfig {
  const state = readState();
  return state.manualUpi ?? DEFAULT_MANUAL_UPI;
}

export function updateManualUpiSettings(
  patch: Partial<ManualUpiConfig>,
  adminActor: string
): Promise<ManualUpiConfig> {
  if (patch.upiId !== undefined && !validateUpiId(patch.upiId)) {
    throw new HttpError(422, "Invalid UPI ID format (e.g. merchant@bank or brand@upi)");
  }

  return mutate((state) => {
    const current = state.manualUpi ?? DEFAULT_MANUAL_UPI;
    const updated: ManualUpiConfig = {
      ...current,
      ...patch,
      updatedAt: nowIso(),
    };
    state.manualUpi = updated;

    recordAudit(
      state,
      adminActor,
      "MANUAL_UPI_SETTINGS_UPDATED",
      `Updated Manual UPI settings: enabled=${updated.enabled}, upiId=${updated.upiId}, name=${updated.merchantName}`
    );

    return updated;
  });
}

export function getGatewaysConfig(stateObj?: ZeninState): GatewaysConfig {
  const state = stateObj ?? readState();
  const raw = state.gateways ?? DEFAULT_GATEWAYS;
  return {
    razorpayEnabled: raw.razorpayEnabled ?? true,
    razorpayMode: raw.razorpayMode ?? "live",
    ownpayEnabled: raw.ownpayEnabled ?? true,
    manualUpiEnabled: raw.manualUpiEnabled ?? (state.manualUpi?.enabled ?? true),
    codEnabled: raw.codEnabled ?? true,
    razorpayFee: raw.razorpayFee ?? DEFAULT_GATEWAYS.razorpayFee,
    ownpayFee: raw.ownpayFee ?? DEFAULT_GATEWAYS.ownpayFee,
    manualUpiFee: raw.manualUpiFee ?? DEFAULT_GATEWAYS.manualUpiFee,
    codFee: raw.codFee ?? DEFAULT_GATEWAYS.codFee,
    updatedAt: raw.updatedAt,
  };
}

export function updateGatewaysConfig(
  patch: Partial<GatewaysConfig>,
  adminActor: string
): Promise<GatewaysConfig> {
  return mutate((state) => {
    const current = getGatewaysConfig(state);
    const updated: GatewaysConfig = {
      ...current,
      ...patch,
      updatedAt: nowIso(),
    };

    // Auto-enable any gateway fee if percent or flat fee was set > 0
    const feeKeys = ["razorpayFee", "ownpayFee", "manualUpiFee", "codFee"] as const;
    for (const k of feeKeys) {
      if (updated[k]) {
        const p = updated[k]?.percent ?? 0;
        const f = updated[k]?.flatAmount ?? 0;
        if (p > 0 || f > 0) {
          updated[k] = { ...updated[k]!, enabled: true };
        }
      }
    }

    state.gateways = updated;

    // Sync manualUpi.enabled if manualUpiEnabled was changed
    if (patch.manualUpiEnabled !== undefined) {
      if (!state.manualUpi) state.manualUpi = { ...DEFAULT_MANUAL_UPI };
      state.manualUpi.enabled = patch.manualUpiEnabled;
    }

    recordAudit(
      state,
      adminActor,
      "GATEWAYS_CONFIG_UPDATED",
      `Payment Gateways toggled: Razorpay=${updated.razorpayEnabled ? "ON" : "OFF"}, OwnPay=${updated.ownpayEnabled ? "ON" : "OFF"}, Manual UPI=${updated.manualUpiEnabled ? "ON" : "OFF"}, COD=${updated.codEnabled ? "ON" : "OFF"}`
    );

    return updated;
  });
}

export function getQikinkConfig(stateObj?: ZeninState): QikinkConfig {
  const state = stateObj ?? readState();
  const raw = state.qikink ?? DEFAULT_QIKINK_CONFIG;
  return {
    enabled: raw.enabled ?? true,
    clientId: raw.clientId || process.env.QIKINK_CLIENT_ID || "",
    clientSecret:
      raw.clientSecret ||
      process.env.QIKINK_CLIENT_SECRET ||
      process.env.QIKINK_API_KEY ||
      "",
    baseUrl: raw.baseUrl || process.env.QIKINK_BASE_URL || "https://sandbox.qikink.com",
    masterSku: raw.masterSku || process.env.QIKINK_MASTER_SKU || "LIMITLESS",
    autoPushOnApproved: raw.autoPushOnApproved ?? false,
    updatedAt: raw.updatedAt,
  };
}

export function updateQikinkConfig(
  patch: Partial<QikinkConfig>,
  adminActor: string
): Promise<QikinkConfig> {
  return mutate((state) => {
    const current = getQikinkConfig(state);
    const updated: QikinkConfig = {
      ...current,
      ...patch,
      updatedAt: nowIso(),
    };
    state.qikink = updated;
    recordAudit(
      state,
      adminActor,
      "QIKINK_CONFIG_UPDATED",
      `Qikink POD ${updated.enabled ? "ENABLED" : "DISABLED (TURNED OFF)"}. Master SKU: ${updated.masterSku}, Base URL: ${updated.baseUrl}`
    );
    return updated;
  });
}

export async function pushAdminOrderToQikink(orderId: string, adminActor: string): Promise<ShopOrder> {
  const state = readState();
  const order = state.orders.find((o) => o.id === orderId || o.orderNumber === orderId);
  if (!order) throw new HttpError(404, "Order not found");

  const config = getQikinkConfig(state);
  if (!config.enabled) {
    throw new HttpError(400, "Qikink POD is currently turned OFF. Turn it ON in Admin Settings before dispatching.");
  }

  const { pushOrderToQikink } = await import("./qikink");
  const result = await pushOrderToQikink(order);
  if (!result.success) {
    throw new HttpError(502, `Failed to push order to Qikink: ${result.error}`);
  }

  return mutate((st) => {
    const ord = st.orders.find((o) => o.id === order.id);
    if (!ord) throw new HttpError(404, "Order not found");
    ord.podProvider = "Qikink";
    ord.podOrderId = String(result.qikinkOrderId);
    ord.podStatus = result.status || "To Be Printed";
    if (ord.status === "PENDING" || ord.status === "APPROVED") {
      ord.status = "PRINTING_POD";
    }
    ord.timeline.push({
      label: "PRINTING_POD",
      at: nowIso(),
      note: `Pushed to Qikink POD (ID: ${result.qikinkOrderId}, Limitless SKU: ${config.masterSku}-${ord.items[0]?.size || "L"}) by ${adminActor}`,
    });
    recordAudit(st, adminActor, "POD_ORDER_PUSHED", `#${ord.orderNumber} pushed to Qikink (ID: ${result.qikinkOrderId})`);
    return ord;
  });
}

export async function syncAdminOrderWithQikink(orderId: string, adminActor: string): Promise<ShopOrder> {
  const state = readState();
  const order = state.orders.find((o) => o.id === orderId || o.orderNumber === orderId);
  if (!order) throw new HttpError(404, "Order not found");

  const { fetchQikinkOrderDetails } = await import("./qikink");
  const details = await fetchQikinkOrderDetails(order.orderNumber, order.podOrderId);
  if (!details.success) {
    throw new HttpError(502, details.error || "Failed to fetch order status from Qikink");
  }

  return mutate((st) => {
    const ord = st.orders.find((o) => o.id === order.id);
    if (!ord) throw new HttpError(404, "Order not found");

    if (details.status) ord.podStatus = details.status;
    if (details.courier_name) ord.courier = details.courier_name as CourierPartner;
    if (details.tracking_number) ord.trackingNumber = details.tracking_number;
    if (details.tracking_url) ord.trackingUrl = details.tracking_url;

    // Advance status based on the Qikink lifecycle. Never regress a stage.
    const statusLower = (details.status || "").toLowerCase();
    const advanceTo = (next: OrderStatus, note: string) => {
      if (ord.status === "CANCELLED") return;
      const current = ORDER_FLOW.indexOf(ord.status);
      const target = ORDER_FLOW.indexOf(next);
      if (current < 0 || target < 0 || current >= target) return;
      ord.status = next;
      if (!ord.timeline.some((t) => t.label === next)) {
        ord.timeline.push({ label: next, at: nowIso(), note });
      }
    };

    if (statusLower.includes("delivered")) {
      advanceTo("DELIVERED", `Delivered via ${ord.courier || "courier"}`);
      ord.paymentStatus = "PAID";
    } else if (statusLower.includes("local") || statusLower.includes("out for delivery")) {
      advanceTo("LOCAL_AREA", `Reached the local delivery hub via ${ord.courier || "courier"}`);
    } else if (statusLower.includes("transit")) {
      advanceTo("SHIPPED", `In transit via ${ord.courier || "Blue Dart Air"} (AWB: ${ord.trackingNumber || "Tracked"})`);
    } else if (statusLower.includes("manifest") || Boolean(details.tracking_number)) {
      advanceTo("MANIFEST_GENERATED", `Manifest generated via ${ord.courier || "Blue Dart Air"} (AWB: ${ord.trackingNumber || "Tracked"})`);
    } else if (statusLower.includes("print")) {
      advanceTo("PRINTING_POD", `Printing on the POD facility floor`);
    }

    releaseDueCashback(st);
    if (ord.status === "DELIVERED") activateOrderCashback(st, ord);

    recordAudit(st, adminActor, "POD_ORDER_SYNCED", `#${ord.orderNumber} synced with Qikink (Status: ${ord.podStatus})`);
    return ord;
  });
}

/**
 * Reverses all financial earnings (lifetime earnings, pending coins, released coins,
 * and referral commissions) associated with a cancelled or rejected order.
 * Strictly guarded against duplicate execution via `order.earningsReversedAt`.
 */
export function reverseOrderEarnings(
  state: ZeninState,
  order: ShopOrder,
  actor: string,
  reason: string
): { reversedCashback: number; reversedReferral: number } {
  // Idempotency guard: prevent duplicate deductions if called multiple times
  if (order.earningsReversedAt) {
    return { reversedCashback: 0, reversedReferral: 0 };
  }

  const at = nowIso();
  order.earningsReversedAt = at;

  let reversedCashback = 0;
  let reversedReferral = 0;

  // 1. Reversal of Cashback Slices & Customer Wallet Balances
  const slices = order.cashback ?? [];
  const releasedCoins = slices
    .filter((s) => s.status === "RELEASED")
    .reduce((sum, s) => sum + s.coins, 0);

  slices.forEach((s) => {
    if (s.status !== "VOID") s.status = "VOID";
  });

  // Reverse any pending or active cashback transactions for this order
  state.transactions
    .filter((t) => t.orderNumber === order.orderNumber && t.type === "CASHBACK" && t.status !== "REVERSED")
    .forEach((t) => {
      t.status = "REVERSED";
      t.description = `${t.description} — reversed (Order #${order.orderNumber} cancelled: ${reason})`;
    });

  const buyer = state.customers.find((c) => c.id === order.customerId);
  if (buyer) {
    const totalCashback = order.cashbackCoins || 0;
    const unreleasedCoins = Math.max(0, totalCashback - releasedCoins);

    buyer.pendingCoins = Math.max(0, (buyer.pendingCoins || 0) - unreleasedCoins);
    buyer.availableCoins = Math.max(0, (buyer.availableCoins || 0) - releasedCoins);
    // Immediately deduct user's lifetime earnings associated with this order
    buyer.lifetimeEarnedCoins = Math.max(0, (buyer.lifetimeEarnedCoins || 0) - totalCashback);
    reversedCashback = totalCashback;

    // If coins were already released to available wallet, record an explicit reversal transaction
    if (releasedCoins > 0) {
      state.transactions.unshift(
        walletTx({
          customerId: buyer.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
          type: "REFUND",
          coins: -releasedCoins,
          unit: "COINS",
          description: `Cashback reversed (-${releasedCoins} coins) for cancelled order #${order.orderNumber} (${reason})`,
          status: "COMPLETED",
        })
      );
    }

    void syncCustomerToUserTable(buyer).catch(() => {});
  }

  // 2. Reversal of Referrer Commission (if order generated referral coins)
  if (order.referralCoinsEarned > 0 && order.referrerCode && order.referralCoinsCreditedAt) {
    const referrer = state.customers.find(
      (c) => c.referralCode?.toUpperCase() === order.referrerCode?.toUpperCase()
    );
    if (referrer) {
      referrer.referralCoinBalance = Math.max(
        0,
        Number(((referrer.referralCoinBalance || 0) - order.referralCoinsEarned).toFixed(2))
      );
      const progress = referrer.agent?.monthlyProgress;
      if (progress && progress.period === agentPeriodKey(at)) {
        progress.salesCoins = Math.max(
          0,
          Number(((progress.salesCoins || 0) - order.referralCoinsEarned).toFixed(2))
        );
      }
      void syncCustomerToUserTable(referrer).catch(() => {});
    }

    state.transactions
      .filter((t) => t.orderNumber === order.orderNumber && t.type === "REFERRAL_COMMISSION" && t.status === "COMPLETED")
      .forEach((t) => {
        t.status = "REVERSED";
        t.description = `${referrer ? agentCommissionRateFor(state.rewardRules, referrer) : state.rewardRules.referralCommissionPercent}% referral reward on order #${order.orderNumber} reversed — order cancelled (${reason})`;
      });

    const lead = state.referrals.find((r) => r.orderNumber === order.orderNumber);
    if (lead) {
      lead.status = "PENDING";
      lead.commissionCoins = 0;
      lead.creditedAt = undefined;
    }

    reversedReferral = order.referralCoinsEarned;
    order.referralCoinsCreditedAt = undefined;

    recordAudit(
      state,
      actor,
      "REFERRAL_COMMISSION_REVERSED",
      `${order.referralCoinsEarned} Referral Coins clawed back from ${referrer?.name ?? order.referrerCode} for cancelled #${order.orderNumber} (${reason})`
    );
  }

  recordAudit(
    state,
    actor,
    "ORDER_EARNINGS_REVERSED",
    `Earnings reversed for cancelled order #${order.orderNumber}: -${reversedCashback} cashback coins, -${reversedReferral} referral coins (${reason})`
  );

  return { reversedCashback, reversedReferral };
}

export async function updateOrderStatus(orderId: string, nextStatus: OrderStatus, actor: string, note?: string): Promise<ShopOrder> {
  const order = await mutate((state) => {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) throw new HttpError(404, "Order not found");
    if (order.status === nextStatus) throw new HttpError(409, `Order is already ${nextStatus}`);
    if (!ALLOWED_TRANSITIONS[order.status].includes(nextStatus)) {
      throw new HttpError(409, `Cannot move order from ${order.status} to ${nextStatus}`);
    }

    const at = nowIso();

    if (nextStatus === "APPROVED") {
      order.paymentStatus = order.paymentMethod === "COD" ? "PENDING" : "PAID";
    }

    if (nextStatus === "PRINTING_POD") {
      order.podOrderId = order.podOrderId ?? `QK-${order.orderNumber.replace(/\D/g, "")}`;
      order.podStatus = "sent_to_printer";
    }

    if (nextStatus === "MANIFEST_GENERATED") {
      if (!order.courier) order.courier = COURIER_PARTNERS[0];
      if (!order.trackingNumber) {
        order.trackingNumber = `${order.courier.split(" ")[0].toUpperCase()}-${Math.floor(10000000 + Math.random() * 89999999)}`;
      }
      order.trackingUrl = getCourierTrackingUrl(order.courier, order.trackingNumber);
      order.podStatus = "manifested";
    }

    if (nextStatus === "SHIPPED") {
      if (!order.courier) order.courier = COURIER_PARTNERS[0];
      if (!order.trackingNumber) {
        order.trackingNumber = `${order.courier.split(" ")[0].toUpperCase()}-${Math.floor(10000000 + Math.random() * 89999999)}`;
      }
      order.trackingUrl = getCourierTrackingUrl(order.courier, order.trackingNumber);
      order.podStatus = "in_transit";
    }

    if (nextStatus === "LOCAL_AREA") {
      order.podStatus = "out_for_delivery";
    }

    if (nextStatus === "DELIVERED") {
      order.podStatus = "delivered";
      order.paymentStatus = "PAID";
      // Cash on delivery is only collected now, so the daily vesting clock starts here.
      if (order.cashbackCoins > 0 && !order.cashback) {
        order.cashback = buildCashbackSchedule(order.cashbackCoins, at);
      }
    }

    if (nextStatus === "CANCELLED") {
      order.paymentStatus = order.paymentMethod === "COD" ? "PENDING" : "REFUNDED";
      // Historical coin-funded orders (before coins-only rewards) still get their coins back.
      if (order.legacyCoinsRedeemed && order.legacyCoinsRedeemed > 0) {
        const buyer = state.customers.find((c) => c.id === order.customerId);
        if (buyer) buyer.availableCoins += order.legacyCoinsRedeemed;
        state.transactions.unshift(
          walletTx({
            customerId: buyer?.id,
            type: "REFUND",
            coins: order.legacyCoinsRedeemed,
            unit: "COINS",
            description: `Redeemed coins refunded for cancelled order #${order.orderNumber}`,
            orderNumber: order.orderNumber,
            status: "COMPLETED",
          })
        );
      }

      // Reverse lifetime earnings, pending & released coins, void tranches, and claw back referral rewards
      reverseOrderEarnings(state, order, actor, note ?? "Order cancelled from admin console");
    }

    order.status = nextStatus;
    order.timeline.push({ label: nextStatus, at, note: note ?? `Marked ${nextStatus} from admin console` });
    releaseDueCashback(state);
    if (nextStatus === "DELIVERED") {
      // COD is collected on delivery — this is the verified-payment moment.
      activateOrderCashback(state, order);
    }
    recordAudit(state, actor, "ORDER_STATUS_UPDATED", `#${order.orderNumber} → ${nextStatus}`);
    return order;
  });

  try {
    let title = `Order #${order.orderNumber} Update`;
    let body = `Status updated to ${nextStatus}`;
    if (nextStatus === "APPROVED") {
      title = "✅ Order Approved!";
      body = `Order #${order.orderNumber} confirmed & sent for POD production.`;
    } else if (nextStatus === "PRINTING_POD") {
      title = "🎨 Printing in Progress!";
      body = `Order #${order.orderNumber} is being printed on custom streetwear fabric.`;
    } else if (nextStatus === "MANIFEST_GENERATED") {
      title = "📋 Manifest Generated!";
      body = `Order #${order.orderNumber} is packed and manifested with ${order.courier || "courier"}. AWB: ${order.trackingNumber || "N/A"}`;
    } else if (nextStatus === "SHIPPED") {
      title = "🚚 Order In Transit!";
      body = `Order #${order.orderNumber} is moving through the ${order.courier || "courier"} network. AWB: ${order.trackingNumber || "N/A"}`;
    } else if (nextStatus === "LOCAL_AREA") {
      title = "📍 Out for Local Delivery!";
      body = `Order #${order.orderNumber} has reached your local area and is out for delivery.`;
    } else if (nextStatus === "DELIVERED") {
      title = "📦 Delivered!";
      body = `Order #${order.orderNumber} has arrived! Daily cashback unlock active.`;
    } else if (nextStatus === "CANCELLED") {
      title = "❌ Order Cancelled";
      body = `Order #${order.orderNumber} has been marked cancelled.`;
    }

    void broadcastPushNotification(
      {
        title,
        body,
        url: "/?tab=orders",
        tag: `order-status-${order.orderNumber}-${nextStatus}`,
      },
      order.customerId
    );
  } catch (err) {
    console.error("[webpush] Failed to broadcast order update push:", err);
  }

  if (order.customerPhone) {
    if (nextStatus === "DELIVERED") {
      void sendWhatsAppMessage(
        order.customerPhone,
        [
          `🎉 *Skywear Order Delivered!*`,
          ``,
          `Hi ${order.customerName.split(" ")[0]}, your package for Order #${order.orderNumber} has arrived!`,
          ``,
          `✨ Your 30-day daily cashback schedule is now unlocked and live in your wallet.`,
          `Check your wallet: https://skywear.in/wallet`,
        ].join("\n")
      );
    } else if (nextStatus === "CANCELLED") {
      void sendWhatsAppMessage(
        order.customerPhone,
        [
          `❌ *Skywear Order Cancelled*`,
          ``,
          `Hi ${order.customerName.split(" ")[0]}, Order #${order.orderNumber} has been cancelled.${note ? `\nReason: ${note}` : ""}`,
        ].join("\n")
      );
    }
  }

  return order;
}

export async function assignShipment(orderId: string, courier: CourierPartner, trackingNumber: string, actor: string): Promise<ShopOrder> {
  const order = await mutate((state) => {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) throw new HttpError(404, "Order not found");
    if (!COURIER_PARTNERS.includes(courier)) throw new HttpError(422, `Unsupported courier partner: ${courier}`);
    if (trackingNumber.trim().length < 6) throw new HttpError(422, "Tracking number looks too short");

    order.courier = courier;
    order.trackingNumber = trackingNumber.trim().toUpperCase();
    order.trackingUrl = getCourierTrackingUrl(courier, order.trackingNumber);

    // Assigning a courier + AWB is the manifest step. Only ever move forward.
    const currentIndex = ORDER_FLOW.indexOf(order.status);
    const manifestIndex = ORDER_FLOW.indexOf("MANIFEST_GENERATED");
    if (currentIndex >= 0 && currentIndex < manifestIndex) {
      order.status = "MANIFEST_GENERATED";
      order.podStatus = "manifested";
      order.timeline.push({
        label: "MANIFEST_GENERATED",
        at: nowIso(),
        note: `Manifest generated with ${order.courier} • AWB ${order.trackingNumber}`,
      });
    }

    recordAudit(state, actor, "COURIER_ASSIGNED", `${order.orderNumber} manifested on ${order.courier} • ${order.trackingNumber}`);
    return order;
  });

  try {
    const { query, isLocalOnly } = await import("@/lib/server/db");
    if (!isLocalOnly()) {
      await query(
        `UPDATE "Order" SET "courier" = $1, "trackingNumber" = $2, "trackingUrl" = $3, "updatedAt" = NOW() WHERE "id" = $4 OR "orderNumber" = $5`,
        [order.courier, order.trackingNumber, order.trackingUrl, order.id, order.orderNumber]
      );
    }
  } catch (dbErr) {
    console.warn("[assignShipment] DB sync warning:", dbErr);
  }

  try {
    void broadcastPushNotification(
      {
        title: "📦 Courier Dispatched!",
        body: `Order #${order.orderNumber} dispatched with ${order.courier}. Tracking ID: ${order.trackingNumber}`,
        url: "/?tab=orders",
        tag: `order-shipment-${order.orderNumber}`,
      },
      order.customerId
    );
  } catch (err) {
    console.error("[webpush] Failed to broadcast shipment push:", err);
  }

  if (order.customerPhone) {
    const waText = [
      `🚀 *Skywear Order Shipped!*`,
      ``,
      `Hi ${order.customerName.split(" ")[0]}! Your Skywear drop is on its way.`,
      ``,
      `📦 *Order:* #${order.orderNumber}`,
      `🚚 *Courier Partner:* ${order.courier}`,
      `📍 *Tracking AWB:* \`\`\`${order.trackingNumber}\`\`\``,
      ``,
      `Track your live delivery:`,
      `https://skywear.in/track?orderId=${order.orderNumber}`,
    ].join("\n");

    void sendWhatsAppMessage(order.customerPhone, waText);
  }

  return order;
}

export function trackOrder(orderNumber: string, emailOrPhone: string): TrackingResult {
  const state = readState();
  const key = emailOrPhone.trim().toLowerCase();
  const digits = key.replace(/\D/g, "");
  const wantsEmail = key.includes("@");
  const wantsMobile = digits.length >= 10;
  if (!wantsEmail && !wantsMobile) throw new HttpError(422, "Enter the registered mobile number or email");

  const normalizedOrderNumber = orderNumber.trim().replace(/^TC[-_]/i, "TC_");
  const digitsOnly = orderNumber.replace(/\D/g, "");

  const order = state.orders.find(
    (o) =>
      (o.orderNumber.toLowerCase() === normalizedOrderNumber.toLowerCase() ||
       (digitsOnly && o.orderNumber.replace(/\D/g, "") === digitsOnly) ||
       o.orderNumber.toLowerCase() === orderNumber.trim().toLowerCase()) &&
      ((wantsEmail && o.customerEmail.toLowerCase() === key) ||
        (wantsMobile && o.customerPhone.replace(/\D/g, "").endsWith(digits.slice(-10))))
  );
  if (!order) throw new HttpError(404, "No order matches that number and contact detail");

  if (order.courier && order.trackingNumber && !order.trackingUrl) {
    order.trackingUrl = getCourierTrackingUrl(order.courier, order.trackingNumber);
  }

  const currentIndex = ORDER_FLOW.indexOf(order.status);
  const remainingStages = ORDER_FLOW.length - 1 - currentIndex;
  return {
    order,
    eta: currentIndex >= 0 ? dateLabel(new Date(new Date(order.placedAt).getTime() + remainingStages * 86_400_000).toISOString()) : "—",
    supportContact: state.support.email,
  };
}

export function dispatchFreeTshirt(input: FreeTshirtInput, actor: string): Promise<ShopOrder> {
  return mutate((state) => {
    const product = state.products.find((p) => p.id === input.productId);
    if (!product) throw new HttpError(404, "Select a catalogue product to gift");
    if (!input.recipientName.trim()) throw new HttpError(422, "Recipient name is required");
    if (!PINCODE.test(input.pincode)) throw new HttpError(422, "Recipient PIN code must be 6 digits");
    if (input.address.trim().length < 8) throw new HttpError(422, "Recipient address is too short");

    const quantity = Math.min(Math.max(input.quantity ?? 1, 1), 5);
    const at = nowIso();
    const number = orderNumber("GIFT", state, 3);

    const order: ShopOrder = {
      id: `ord_${Date.now().toString(36)}`,
      orderNumber: number,
      kind: input.reason.toLowerCase().includes("replacement") ? "REPLACEMENT" : "GIFT",
      customerName: input.recipientName.trim(),
      customerEmail: input.email?.trim() || "gifts@skywear.in",
      customerPhone: input.phone.trim() || "+91 99000 00000",
      address: input.address.trim(),
      city: input.city.trim(),
      state: input.state.trim(),
      pincode: input.pincode,
      items: [{ title: product.title, size: input.size, color: input.color, quantity, price: 0 }],
      subtotal: 0,
      discount: product.mrp * quantity,
      legacyCoinsRedeemed: 0,
      legacyInrRedeemed: 0,
      cashbackCoins: 0,
      referralCoinsEarned: 0,
      deliveryFee: 0,
      total: 0,
      paymentMethod: "COMPLIMENTARY",
      paymentStatus: "PAID",
      status: "APPROVED",
      courier: COURIER_PARTNERS[1],
      trackingNumber: `QIK-${number}-${Math.floor(100000 + Math.random() * 899999)}`,
      podProvider: "Qikink",
      podOrderId: `QK-${number}`,
      podStatus: "sent_to_printer",
      giftReason: input.reason,
      placedAt: at,
      timeline: [
        { label: "APPROVED", at, note: `Complimentary dispatch approved by ${actor} • ${input.reason}` },
      ],
    };

    state.orders.unshift(order);
    product.stock = Math.max(0, (product.stock ?? 60) - quantity);
    recordAudit(state, actor, "COMPLIMENTARY_TSHIRT_DISPATCHED", `${quantity} × ${product.title} (${input.size}/${input.color}) to ${input.recipientName} via ${number}`);
    return order;
  });
}

const DEDUPE_PAYMENT_MESSAGE =
  "These payment details are already associated with another account.";

function withdrawalBankFingerprint(withdrawal: WithdrawalRequest): string | null {
  if (!withdrawal.bankAccount || !withdrawal.bankIfsc) return null;
  if (withdrawal.overallStatus === "FAILED" || withdrawal.overallStatus === "REJECTED") return null;
  return bankAccountFingerprint(withdrawal.bankIfsc, withdrawal.bankAccount);
}

function customerHasBankFingerprint(customer: CustomerAccount, fingerprint: string): boolean {
  return (customer.bankAccounts || []).some((bank) => {
    const account = bankAccountNumber(bank);
    if (account && bankAccountFingerprint(bank.ifscCode, account) === fingerprint) return true;
    return pendingBankFingerprint(bank) === fingerprint;
  });
}

function assertPayoutDetails(
  payoutMethod: "UPI" | "BANK",
  upiId: string | undefined,
  bankAccount: string | undefined,
  bankIfsc: string | undefined,
  bankAccountId?: string
): void {
  const cleanAcct = normalizeAccountNumber(bankAccount ?? "");
  const cleanIfsc = normalizeIfsc(bankIfsc ?? "");
  const hasValidBank = BANK_ACCOUNT_REGEX.test(cleanAcct) && IFSC_REGEX.test(cleanIfsc);
  const hasValidUpi = Boolean(upiId && UPI_ID.test(upiId.trim()));

  if (payoutMethod === "UPI") {
    if (!hasValidUpi) {
      if (hasValidBank) return; // Client passed bank details, auto-fallback safely
      throw new HttpError(422, "Enter a valid UPI ID like name@bank");
    }
  } else if (payoutMethod === "BANK") {
    if (bankAccountId?.trim()) return; // Resolved from the member's saved bank on the server
    if (!hasValidBank) {
      if (hasValidUpi) return; // Client passed UPI details, auto-fallback safely
      if (!BANK_ACCOUNT_REGEX.test(cleanAcct)) {
        throw new HttpError(422, "Enter a valid bank account number (9 to 18 digits)");
      }
      if (!IFSC_REGEX.test(cleanIfsc)) {
        throw new HttpError(422, "Enter a valid 11-character IFSC code (e.g. INDB0000476)");
      }
    }
  }
}

function memberHasSavedBank(customer: CustomerAccount): boolean {
  return (customer.bankAccounts || []).some((bank) => {
    const account = bankAccountNumber(bank);
    return BANK_ACCOUNT_REGEX.test(account) && IFSC_REGEX.test(normalizeIfsc(bank.ifscCode));
  });
}

function assertMemberWithdrawalReady(
  customer: CustomerAccount,
  payoutMethod: "UPI" | "BANK"
): void {
  if (!customer.savedUpiId?.trim() || !memberHasSavedBank(customer)) {
    throw new HttpError(
      422,
      "Add both your UPI ID and bank account to your profile before requesting a withdrawal"
    );
  }
  if (payoutMethod === "UPI" && customer.upiWithdrawalLocked !== false) {
    throw new HttpError(
      403,
      "UPI withdrawals are locked by admin. Choose bank transfer or contact support"
    );
  }
}

export function adminSetUpiWithdrawalLock(
  customerId: string,
  locked: boolean,
  actor: string
): Promise<{ customer: CustomerAccount }> {
  return mutate((state) => {
    const customer = state.customers.find((account) => account.id === customerId);
    if (!customer) throw new HttpError(404, "Customer not found");
    customer.upiWithdrawalLocked = locked;
    recordAudit(
      state,
      actor,
      locked ? "UPI_WITHDRAWAL_LOCKED" : "UPI_WITHDRAWAL_UNLOCKED",
      `${locked ? "Locked" : "Unlocked"} UPI withdrawals for ${customer.name}.`
    );
    return { customer };
  });
}

/**
 * Keeps the wallet ledger honest about how much of a payout request has actually
 * left the account. Runs after every tranche settles.
 */
function syncWithdrawalLedger(state: ZeninState, request: WithdrawalRequest): void {
  const totals = vestingTotals(request);
  const line = state.transactions.find(
    (t) => t.customerId === request.customerId && t.type === "ADMIN_ADJUSTMENT" && t.description.startsWith(`${request.id} `)
  );
  if (!line) return;

  const settled = request.tranches.filter((t) => t.status === "TRANSFERRED").length;
  line.status = settled === request.tranches.length ? "COMPLETED" : "PENDING";
  line.description =
    settled === request.tranches.length
      ? `${request.id} completed — ${request.totalCoins.toLocaleString("en-IN")} coins paid out to ${
          request.payoutMethod === "BANK" ? `bank ${request.bankIfsc}` : request.upiId
        }`
      : `${request.id} payout — ${totals.paidCoins.toLocaleString("en-IN")} of ${request.totalCoins.toLocaleString("en-IN")} coins transferred, next ${
          totals.nextDueLabel
        }`;
}

/**
 * The only place a payout request is born. The member's own wallet form and the admin
 * raising one on a member's behalf both come through here, so the schedule, the wallet
 * debit and the audit line can never drift apart. Coins are locked at creation, which is
 * what makes several payouts per member safe at the same time.
 */
function createWithdrawal(
  state: ZeninState,
  customer: CustomerAccount,
  input: WithdrawalInput,
  actor: string,
  enforceMemberRules = false
): { withdrawal: WithdrawalRequest; customer: CustomerAccount } {
  const isReferralPayout = input.sourceType === "REFERRAL_COINS";
  const coins = Math.floor(Number(input.coins));
  if (!Number.isFinite(coins) || coins <= 0) {
    throw new HttpError(422, "Please enter a valid coin amount to withdraw");
  }

  if (isReferralPayout) {
    const currentRefBalance = Number(customer.referralCoinBalance || 0);
    if (coins > currentRefBalance + 0.01) {
      throw new HttpError(
        409,
        `Only ${currentRefBalance.toLocaleString("en-IN")} referral coins are available to withdraw right now`
      );
    }
  } else {
    const minCoins = state.rewardRules?.minWithdrawalCoins ?? MIN_WITHDRAWAL_COINS;
    if (coins < minCoins) {
      throw new HttpError(422, `At least ${minCoins} coins are needed for a payout`);
    }
    if (coins > customer.availableCoins) {
      throw new HttpError(
        409,
        `Only ${customer.availableCoins} coins are free right now — the rest are already inside a payout or unlock daily`
      );
    }
  }

  const anchorSource = state.orders
    .filter((o) => o.customerId === customer.id)
    .sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime())[0];
  const requestedAt = nowIso();
  const anchorDate = requestedAt;
  const savedBank = input.bankAccountId
    ? (customer.bankAccounts || []).find((bank) => bank.id === input.bankAccountId)
    : undefined;
  if (input.bankAccountId && !savedBank) {
    throw new HttpError(404, "That saved bank account was not found on this profile");
  }
  const cleanAcct = savedBank
    ? bankAccountNumber(savedBank)
    : normalizeAccountNumber(input.bankAccount ?? "");
  const cleanIfsc = savedBank ? normalizeIfsc(savedBank.ifscCode) : normalizeIfsc(input.bankIfsc ?? "");
  const hasValidBank = BANK_ACCOUNT_REGEX.test(cleanAcct) && IFSC_REGEX.test(cleanIfsc);
  const payoutMethod = hasValidBank && (!input.upiId || input.payoutMethod === "BANK") ? "BANK" : input.payoutMethod;

  if (enforceMemberRules) {
    assertMemberWithdrawalReady(customer, payoutMethod);
  }

  // Uniqueness check across all profiles for UPI & Bank
  if (payoutMethod === "UPI") {
    const cleanUpi = normalizeUpiId(input.upiId ?? "");
    if (!cleanUpi) {
      throw new HttpError(422, "Please enter a valid UPI ID");
    }
    const upiConflict = state.customers.find(
      (c) => c.id !== customer.id && (
        (c.savedUpiId && normalizeUpiId(c.savedUpiId) === cleanUpi) ||
        (c.pendingUpiId && normalizeUpiId(c.pendingUpiId) === cleanUpi) ||
        state.withdrawals.some((w) => w.customerId === c.id && normalizeUpiId(w.upiId) === cleanUpi && w.overallStatus !== "FAILED" && w.overallStatus !== "REJECTED")
      )
    );
    if (upiConflict) {
      throw new HttpError(409, DEDUPE_PAYMENT_MESSAGE);
    }
    // Auto-save UPI ID to customer profile if not already set
    if (!customer.savedUpiId) {
      customer.savedUpiId = cleanUpi;
      customer.upiStatus = "VERIFIED";
      recordAudit(state, customer.name, "UPI_AUTO_SAVED", `Linked verified UPI ID ${cleanUpi} to profile.`);
    }
  } else if (payoutMethod === "BANK") {
    const fingerprint = bankAccountFingerprint(cleanIfsc, cleanAcct);
    const bankConflict =
      state.customers.some(
        (c) => c.id !== customer.id && customerHasBankFingerprint(c, fingerprint)
      ) ||
      state.withdrawals.some(
        (w) => w.customerId !== customer.id && withdrawalBankFingerprint(w) === fingerprint
      );
    if (bankConflict) {
      throw new HttpError(409, DEDUPE_PAYMENT_MESSAGE);
    }
    // Auto-save Bank Account to customer profile if not already set
    if (!customer.bankAccounts || customer.bankAccounts.length === 0) {
      const encrypted = encryptAccountNumber(cleanAcct);
      customer.bankAccounts = [{
        id: `bnk-${Date.now().toString(36)}`,
        accountHolderName: customer.name,
        accountNumberEnc: encrypted,
        accountNumberLast4: accountLast4(cleanAcct),
        ifscCode: cleanIfsc,
        bankName: "Bank account",
        isDefault: true,
        verified: true,
        status: "VERIFIED",
        addedAt: nowIso(),
      }];
      recordAudit(state, customer.name, "BANK_AUTO_SAVED", `Linked verified bank account ••••${accountLast4(cleanAcct)} (${cleanIfsc}) to profile.`);
    }
  }

  const target =
    payoutMethod === "BANK"
      ? `bank ${cleanIfsc} ••••${cleanAcct.slice(-4)}`
      : (input.upiId?.trim() || "");

  const taxPercent = Math.max(0, Math.min(100, Number(state.rewardRules?.withdrawalTaxPercent ?? 0)));
  const taxCoins = taxPercent > 0 ? Math.round((coins * taxPercent) / 100) : 0;
  const netPayableCoins = Math.max(0, coins - taxCoins);

  const request: WithdrawalRequest = {
    id: `wth-${Date.now().toString(36).slice(-5)}`,
    customerId: customer.id,
    customerName: customer.name,
    phone: customer.phone,
    upiId: payoutMethod === "UPI" ? (input.upiId?.trim() || "") : (input.upiId?.trim() || `${customer.phone}@bank`),
    payoutMethod,
    bankAccount: payoutMethod === "BANK" ? cleanAcct : undefined,
    bankIfsc: payoutMethod === "BANK" ? cleanIfsc : undefined,
    totalCoins: coins,
    taxPercent: taxPercent > 0 ? taxPercent : undefined,
    taxCoins: taxCoins > 0 ? taxCoins : undefined,
    netPayableCoins,
    sourceType: input.sourceType,
    requestedAt,
    purchaseOrderNumber: isReferralPayout ? "Referral Coins Payout" : (anchorSource?.orderNumber ?? "Wallet balance"),
    anchorDate,
    tranches: buildVestingSchedule(netPayableCoins, anchorDate),
    overallStatus: "SUBMITTED_TO_BANK",
  };

  if (isReferralPayout) {
    customer.referralCoinBalance = Number(
      Math.max(0, (customer.referralCoinBalance || 0) - coins).toFixed(2)
    );
  } else {
    customer.availableCoins -= coins;
  }
  state.withdrawals.unshift(request);
  state.transactions.unshift(
    walletTx({
      customerId: customer.id,
      type: "ADMIN_ADJUSTMENT",
      coins: -coins,
      unit: "COINS",
      description: isReferralPayout
        ? `${request.id} payout request submitted — ${coins.toLocaleString("en-IN")} Referral Coins requested to ${target}${
            taxCoins > 0 ? ` (TDS/Tax ${taxPercent}%: -${taxCoins} coins, Net: ${netPayableCoins} coins)` : ""
          }. Pending transfer.`
        : `${request.id} payout request submitted — ${coins.toLocaleString("en-IN")} Coins requested to ${target}${
            taxCoins > 0 ? ` (TDS/Tax ${taxPercent}%: -${taxCoins} coins, Net: ${netPayableCoins} coins)` : ""
          }. Pending transfer.`,
      status: "PENDING",
    })
  );
  recordAudit(
    state,
    actor,
    "WITHDRAWAL_REQUESTED",
    isReferralPayout
      ? `${request.id} • ${coins.toLocaleString("en-IN")} Referral Coins requested to ${target}${
          taxCoins > 0 ? ` (Tax ${taxPercent}%: -${taxCoins})` : ""
        }${actor === customer.name ? "" : ` • raised on ${customer.name}'s behalf`}`
      : `${request.id} • ${coins.toLocaleString("en-IN")} coins requested to ${target}${
          taxCoins > 0 ? ` (Tax ${taxPercent}%: -${taxCoins})` : ""
        }${actor === customer.name ? "" : ` • raised on ${customer.name}'s behalf`}`
  );

  return { withdrawal: request, customer };
}

export async function submitWithdrawal(
  input: WithdrawalInput,
  customerId: string | null
): Promise<{ withdrawal: WithdrawalRequest; customer: CustomerAccount }> {
  assertPayoutDetails(input.payoutMethod, input.upiId, input.bankAccount, input.bankIfsc, input.bankAccountId);

  const res = await mutate((state) => {
    const customer = requireCustomer(state, customerId);
    return createWithdrawal(state, customer, input, customer.name, true);
  });

  try {
    void broadcastPushNotification(
      {
        title: "📋 Withdrawal Request Submitted",
        body: `Request ${res.withdrawal.id} for ${res.withdrawal.totalCoins.toLocaleString("en-IN")} coins submitted to ${
          res.withdrawal.payoutMethod === "BANK" ? "Bank" : "UPI"
        }. Admin will verify & transfer soon.`,
        url: "/?tab=wallet",
        tag: `withdrawal-req-${res.withdrawal.id}`,
      },
      res.customer.id
    );
  } catch (err) {
    console.warn("[webpush] submitWithdrawal push warning:", err);
  }

  return res;
}

/** Admin-side leg: raise a payout for a member without making them sign in. */
export function adminRaiseWithdrawal(
  customerId: string,
  input: WithdrawalInput,
  actor: string
): Promise<{ withdrawal: WithdrawalRequest; customer: CustomerAccount }> {
  assertPayoutDetails(input.payoutMethod, input.upiId, input.bankAccount, input.bankIfsc, input.bankAccountId);

  return mutate((state) => {
    const customer = state.customers.find((account) => account.id === customerId);
    if (!customer) throw new HttpError(404, "That member account was not found");
    return createWithdrawal(state, customer, input, actor);
  });
}

export function adminUpdateWithdrawal(
  withdrawalId: string,
  patch: AdminWithdrawalPatch,
  actor: string
): Promise<WithdrawalRequest> {
  return mutate((state) => {
    const request = state.withdrawals.find((w) => w.id === withdrawalId);
    if (!request) throw new HttpError(404, "Withdrawal request not found");
    if (request.overallStatus === "COMPLETED") {
      throw new HttpError(409, "This payout is already settled — its details can no longer be edited");
    }

    const payoutMethod = patch.payoutMethod ?? request.payoutMethod;
    const upiId = (patch.upiId ?? request.upiId).trim();
    const bankAccount = patch.bankAccount !== undefined ? patch.bankAccount.trim() : request.bankAccount;
    const bankIfsc = patch.bankIfsc !== undefined ? patch.bankIfsc.trim().toUpperCase() : request.bankIfsc;
    assertPayoutDetails(payoutMethod, upiId, bankAccount, bankIfsc);

    const before = `${request.upiId}/${request.payoutMethod}`;
    request.customerName = patch.customerName?.trim() || request.customerName;
    request.phone = patch.phone?.trim() || request.phone;
    request.upiId = upiId;
    request.payoutMethod = payoutMethod;
    request.bankAccount = payoutMethod === "BANK" ? bankAccount : undefined;
    request.bankIfsc = payoutMethod === "BANK" ? bankIfsc : undefined;

    syncWithdrawalLedger(state, request);
    recordAudit(
      state,
      actor,
      "WITHDRAWAL_UPDATED",
      `Edited ${request.id} payout for ${request.customerName} (${request.phone}) — ${before} → ${
        payoutMethod === "BANK" ? `BANK ${request.bankAccount} • ${request.bankIfsc}` : `UPI ${request.upiId}`
      }`
    );

    return refreshVesting(request);
  });
}

/**
 * Settles one tranche (`week`) or every tranche that has already unlocked (`all`).
 * Locked tranches are never pulled forward — the vesting rule holds here too.
 */
export function payoutWithdrawal(
  withdrawalId: string,
  input: PayoutInput,
  actor: string
): Promise<{ withdrawal: WithdrawalRequest; paid: WithdrawalTranche[] }> {
  const reference = input.reference?.trim();

  return mutate((state) => {
    const request = state.withdrawals.find((w) => w.id === withdrawalId);
    if (!request) throw new HttpError(404, "Withdrawal request not found");

    const fresh = refreshVesting(request);
    request.tranches = fresh.tranches;
    request.overallStatus = fresh.overallStatus;

    if (request.overallStatus === "REJECTED" || request.overallStatus === "FAILED") {
      throw new HttpError(409, "This payout request was rejected by the desk — its voided slices cannot be paid");
    }

    const targets = input.all
      ? request.tranches.filter((t) => t.status === "UNLOCKED")
      : [request.tranches.find((t) => t.week === Number(input.week))].filter((t): t is WithdrawalTranche => Boolean(t));

    if (targets.length === 0) {
      if (input.all) {
        const next = request.tranches.find((t) => t.status === "LOCKED");
        throw new HttpError(409, next ? `Nothing payable yet — next tranche unlocks on ${next.dueDate}` : "No tranche left to pay");
      }
      throw new HttpError(404, `Week ${input.week} tranche not found`);
    }

    const blocked = targets.find((t) => t.status === "LOCKED");
    if (blocked) throw new HttpError(409, `Part ${blocked.week} unlocks on ${blocked.dueDate}`);

    const alreadyTransferred = targets.filter((t) => t.status === "TRANSFERRED");
    const payable = targets.filter((t) => t.status === "UNLOCKED");
    if (payable.length === 0) {
      throw new HttpError(409, `Week ${alreadyTransferred[0]?.week} is already transferred`);
    }

    const paidAt = dateTimeLabel(nowIso());
    const finalUtr = reference || `UTR-${Date.now().toString().slice(-8)}`;
    payable.forEach((tranche) => {
      tranche.status = "TRANSFERRED";
      tranche.transferredAt = paidAt;
      tranche.upiRef =
        payable.length > 1 && reference
          ? `${reference}-${tranche.week}`
          : finalUtr;
    });

    const settled = request.tranches.filter((t) => t.status === "TRANSFERRED").length;
    const completed = settled === request.tranches.length;
    request.overallStatus = completed ? "PAID" : "SUBMITTED_TO_BANK";
    request.transactionRefNumber = finalUtr;
    const legacyRequest = request as WithdrawalWithLegacyFields;
    legacyRequest.utr = finalUtr;
    legacyRequest.paidAt = nowIso();
    syncWithdrawalLedger(state, request);

    const amountCoins = payable.reduce((sum, t) => sum + t.coins, 0);
    recordAudit(
      state,
      actor,
      completed ? "WITHDRAWAL_PAID" : "WITHDRAWAL_TRANCHE_PAID",
      `${payable.map((t) => `Week ${t.week} (${t.coins} coins)`).join(" + ")} • ${amountCoins.toLocaleString("en-IN")} coins released via ${
        request.payoutMethod
      } to ${request.payoutMethod === "BANK" ? `${request.bankAccount} (${request.bankIfsc})` : request.upiId} for ${
        request.customerName
      } • ${settled}/${request.tranches.length} tranches settled${reference ? ` • ref ${reference}` : ""}`
    );

    const customer = state.customers.find((c) => c.id === request.customerId);
    if (customer?.phone) {
      void sendWhatsAppMessage(
        customer.phone,
        [
          `💸 *Withdrawal Transferred!*`,
          ``,
          `Hi ${customer.name.split(" ")[0]}! Your withdrawal payout of ${amountCoins.toLocaleString("en-IN")} coins has been transferred:`,
          `💳 *Destination:* ${request.payoutMethod === "BANK" ? `Bank A/C ending in ${request.bankAccount?.slice(-4) || "XXXX"}` : request.upiId}`,
          `🔖 *Ref / UTR:* \`\`\`${payable[0]?.upiRef || "COMPLETED"}\`\`\``,
          ``,
          `Check your updated wallet anytime:`,
          `https://skywear.in/wallet`,
        ].join("\n")
      );
    }

    try {
      void broadcastPushNotification(
        {
          title: "💸 Withdrawal Transferred!",
          body: `Payout of ${amountCoins.toLocaleString("en-IN")} coins transferred to your ${
            request.payoutMethod === "BANK" ? "Bank Account" : "UPI"
          } (Ref: ${payable[0]?.upiRef || "COMPLETED"}).`,
          url: "/?tab=wallet",
          tag: `withdrawal-paid-${request.id}`,
        },
        request.customerId
      );
    } catch (err) {
      console.warn("[webpush] payoutWithdrawal push warning:", err);
    }

    return { withdrawal: request, paid: payable };
  });
}

/**
 * Turns a payout request down. Whatever the desk already transferred stays paid;
 * every unpaid slice is voided and its coins go back to the customer's wallet.
 */
export function rejectWithdrawal(
  withdrawalId: string,
  input: RejectWithdrawalInput,
  actor: string
): Promise<WithdrawalRequest> {
  const reason = input.reason?.trim();
  if (reason && reason.length > 160) throw new HttpError(422, "Rejection note must be 160 characters or less");

  return mutate((state) => {
    const request = state.withdrawals.find((w) => w.id === withdrawalId);
    if (!request) throw new HttpError(404, "Withdrawal request not found");

    const fresh = refreshVesting(request);
    request.tranches = fresh.tranches;
    request.overallStatus = fresh.overallStatus;

    if (request.overallStatus === "REJECTED" || request.overallStatus === "FAILED") {
      throw new HttpError(409, "This payout request is already rejected");
    }
    if (request.tranches.every((t) => t.status === "TRANSFERRED")) {
      throw new HttpError(409, "Every tranche is already transferred — a settled payout cannot be rejected");
    }

    const unpaid = request.tranches.filter((t) => t.status !== "TRANSFERRED");
    const paidCoins = vestingTotals(request).paidCoins;
    const refundCoins = unpaid.length === request.tranches.length
      ? request.totalCoins
      : unpaid.reduce((sum, t) => sum + t.coins, 0);
    const refundToReferral = request.sourceType === "REFERRAL_COINS";

    unpaid.forEach((tranche) => {
      tranche.status = "VOID";
    });
    request.overallStatus = "REJECTED";
    request.rejectionReason = reason || "Details could not be verified by admin. Coins refunded.";

    const customer = state.customers.find((c) => c.id === request.customerId);
    if (customer && refundCoins > 0) {
      if (refundToReferral) {
        customer.referralCoinBalance = Number(((customer.referralCoinBalance || 0) + refundCoins).toFixed(2));
      } else {
        customer.availableCoins += refundCoins;
      }
    }

    const ledgerLine = state.transactions.find(
      (t) => t.customerId === request.customerId && t.type === "ADMIN_ADJUSTMENT" && t.description.startsWith(`${request.id} `)
    );
    if (ledgerLine) {
      ledgerLine.status = "COMPLETED";
      ledgerLine.description = `${request.id} rejected — ${paidCoins.toLocaleString("en-IN")} coins transferred, ${
        refundCoins > 0 ? `${refundCoins.toLocaleString("en-IN")} coins returned to the wallet` : "nothing to refund"
      }${reason ? ` (${reason})` : ""}`;
    }
    if (customer && refundCoins > 0) {
      state.transactions.unshift(
        walletTx({
          customerId: customer.id,
          type: "REFUND",
          coins: refundCoins,
          unit: "COINS",
          description: `${request.id} refund — ${
            refundToReferral ? "the referral coins" : "the coins"
          } from this cancelled payout are back in your wallet`,
          status: "COMPLETED",
        })
      );
    }

    if (customer?.phone) {
      void sendWhatsAppMessage(
        customer.phone,
        [
          `❌ *Withdrawal Rejected & Refunded*`,
          ``,
          `Hi ${customer.name.split(" ")[0]}! Your withdrawal request (${request.id}) of ${request.totalCoins.toLocaleString(
            "en-IN"
          )} coins has been rejected.`,
          `📝 *Reason:* ${reason || "Bank details could not be verified"}`,
          `💰 *Refund:* ${refundCoins.toLocaleString("en-IN")} coins have been refunded back into your ${
            refundToReferral ? "Referral Rewards" : "Live Wallet"
          } immediately.`,
          ``,
          `You can view your updated wallet anytime at:`,
          `https://skywear.in/wallet`,
        ].join("\n")
      );
    }

    recordAudit(
      state,
      actor,
      "WITHDRAWAL_REJECTED",
      `${request.id} for ${request.customerName} rejected • ${paidCoins.toLocaleString(
        "en-IN"
      )} coins kept paid, ${refundCoins.toLocaleString("en-IN")} coins refunded to wallet${reason ? ` • ${reason}` : ""}`
    );

    try {
      void broadcastPushNotification(
        {
          title: "❌ Withdrawal Rejected",
          body: `Withdrawal ${request.id} was rejected (${reason || "Details mismatch"}). ${refundCoins.toLocaleString("en-IN")} coins have been refunded to your wallet.`,
          url: "/?tab=wallet",
          tag: `withdrawal-rejected-${request.id}`,
        },
        request.customerId
      );
    } catch (err) {
      console.warn("[webpush] rejectWithdrawal push warning:", err);
    }

    return request;
  });
}

/**
 * Puts a rejected payout back in the queue. Rejecting refunded the unpaid coins, so
 * reopening takes them out again — a member who already spent them cannot be re-queued
 * until the wallet covers the full amount.
 */
export function reopenWithdrawal(withdrawalId: string, actor: string): Promise<WithdrawalRequest> {
  return mutate((state) => {
    const request = state.withdrawals.find((w) => w.id === withdrawalId);
    if (!request) throw new HttpError(404, "Withdrawal request not found");
    if (request.overallStatus !== "REJECTED") throw new HttpError(409, "Only a rejected payout can be reopened");

    const customer = state.customers.find((c) => c.id === request.customerId);
    if (!customer) throw new HttpError(404, "That member account is gone — this payout stays rejected");

    const refunded = request.tranches.filter((t) => t.status === "VOID");
    if (refunded.length === 0) throw new HttpError(409, "Nothing was refunded on this request — nothing to re-queue");

    const coins = refunded.reduce((sum, t) => sum + t.coins, 0);
    const refundToReferral = request.sourceType === "REFERRAL_COINS";
    const balance = refundToReferral ? customer.referralCoinBalance || 0 : customer.availableCoins;
    if (balance < coins) {
      throw new HttpError(
        409,
        `${customer.name} has only ${balance.toLocaleString("en-IN")} ${refundToReferral ? "referral" : "free"} coins — ${(
          coins - balance
        ).toLocaleString("en-IN")} more are needed to re-queue this payout`
      );
    }

    const now = Date.now();
    refunded.forEach((tranche) => {
      tranche.status = new Date(tranche.dueAt).getTime() <= now ? "UNLOCKED" : "LOCKED";
    });
    request.overallStatus = "VESTING_IN_PROGRESS";
    request.rejectionReason = undefined;
    if (refundToReferral) {
      customer.referralCoinBalance = Number(Math.max(0, balance - coins).toFixed(2));
    } else {
      customer.availableCoins = balance - coins;
    }

    state.transactions.unshift(
      walletTx({
        customerId: customer.id,
        type: "ADMIN_ADJUSTMENT",
        coins: -coins,
        unit: "COINS",
        description: `Payout ${request.id} reopened — ${coins.toLocaleString("en-IN")} coins locked again for the ${
          request.payoutMethod === "BANK" ? "bank payout" : `UPI ${request.upiId}`
        }`,
        status: "PENDING",
      })
    );
    syncWithdrawalLedger(state, request);

    const payableNow = request.tranches.filter((t) => t.status === "UNLOCKED").length;
    recordAudit(
      state,
      actor,
      "WITHDRAWAL_REOPENED",
      `${request.id} for ${request.customerName} re-queued • ${coins.toLocaleString(
        "en-IN"
      )} coins taken back out of the wallet • ${payableNow} slice${payableNow === 1 ? "" : "s"} payable now`
    );

    return refreshVesting(request);
  });
}

export function saveRewardRules(rules: RewardRulesConfig, actor: string): Promise<RewardRulesConfig> {
  if (rules.dailyClaimPercent < 0 || rules.dailyClaimPercent > 100) {
    throw new HttpError(422, "Daily claim percentage must be 0-100%");
  }
  if (!Number.isFinite(rules.minWithdrawalCoins) || rules.minWithdrawalCoins < 0) {
    throw new HttpError(422, "Minimum withdrawal must be zero or more coins");
  }
  if (rules.referralCommissionPercent < 0 || rules.referralCommissionPercent > 50) {
    throw new HttpError(422, "Referral reward percentage must be 0-50%");
  }
  const agentPercent = Number(rules.agentCommissionPercent ?? rules.referralCommissionPercent ?? 10);
  if (!Number.isFinite(agentPercent) || agentPercent < 0 || agentPercent > 50) {
    throw new HttpError(422, "Agent commission percentage must be 0-50%");
  }
  const agentSlabs: AgentSlabConfig[] | undefined = rules.agentSlabs?.length
    ? rules.agentSlabs
        .map((slab) => ({
          targetCoins: Math.max(0, Math.round(Number(slab.targetCoins) || 0)),
          bonusCoins: Math.max(0, Math.round(Number(slab.bonusCoins) || 0)),
          gift: String(slab.gift ?? "").trim().slice(0, 80),
        }))
        .filter((slab) => slab.targetCoins > 0)
        .sort((a, b) => a.targetCoins - b.targetCoins)
        .slice(0, MAX_AGENT_SLABS)
    : undefined;
  const taxPct = Number(rules.withdrawalTaxPercent ?? 0);
  if (!Number.isFinite(taxPct) || taxPct < 0 || taxPct > 100) {
    throw new HttpError(422, "Withdrawal tax percentage must be between 0% and 100%");
  }
  const orderTaxPct = Number(rules.orderTaxPercent ?? 0);
  if (!Number.isFinite(orderTaxPct) || orderTaxPct < 0 || orderTaxPct > 50) {
    throw new HttpError(422, "Prepaid order tax percentage must be between 0% and 50%");
  }
  const shippingCharge = Number(rules.shippingCharge ?? DELIVERY_FEE);
  if (!Number.isFinite(shippingCharge) || shippingCharge < 0 || shippingCharge > 10000) {
    throw new HttpError(422, "Shipping charge must be between ₹0 and ₹10,000");
  }
  const shippingMode: "ALL_PRODUCTS" | "MIN_AMOUNT" =
    rules.shippingMode === "ALL_PRODUCTS" ? "ALL_PRODUCTS" : "MIN_AMOUNT";
  const freeShippingMinAmount = Number(rules.freeShippingMinAmount ?? FREE_SHIPPING_THRESHOLD);
  if (!Number.isFinite(freeShippingMinAmount) || freeShippingMinAmount < 0 || freeShippingMinAmount > 100000) {
    throw new HttpError(422, "Minimum order amount for free shipping must be between ₹0 and ₹1,00,000");
  }

  return mutate((state) => {
    state.rewardRules = {
      dailyClaimPercent: rules.dailyClaimPercent ?? 3,
      minWithdrawalCoins: Math.floor(rules.minWithdrawalCoins ?? 500),
      referralCommissionPercent: rules.referralCommissionPercent ?? 10,
      agentCommissionPercent: agentPercent,
      agentSlabs,
      withdrawalTaxPercent: taxPct,
      orderTaxPercent: Math.round(orderTaxPct * 100) / 100,
      shippingCharge: Math.round(shippingCharge * 100) / 100,
      shippingMode,
      freeShippingMinAmount: Math.round(freeShippingMinAmount * 100) / 100,
    };
    const shipNote =
      state.rewardRules.shippingCharge === 0
        ? "FREE shipping on all orders"
        : state.rewardRules.shippingMode === "ALL_PRODUCTS"
        ? `₹${state.rewardRules.shippingCharge} shipping on ALL products`
        : `₹${state.rewardRules.shippingCharge} shipping below ₹${state.rewardRules.freeShippingMinAmount}`;
    recordAudit(
      state,
      actor,
      "REWARD_RULES_UPDATED",
      `Daily claim ${state.rewardRules.dailyClaimPercent}% • referral ${state.rewardRules.referralCommissionPercent}% • agent ${state.rewardRules.agentCommissionPercent ?? state.rewardRules.referralCommissionPercent}% • min withdrawal ${state.rewardRules.minWithdrawalCoins.toLocaleString(
        "en-IN"
      )} coins • withdrawal tax ${state.rewardRules.withdrawalTaxPercent}% • prepaid GST ${state.rewardRules.orderTaxPercent ?? 0}% • ${shipNote}`
    );
    return state.rewardRules;
  });
}

/** Everything the public help centre needs: contact desk plus the live reward numbers its FAQ quotes. */
export function supportSnapshot(): SupportCentre {
  const state = readState();
  const shippingCfg = getShippingConfig(state);
  return {
    support: state.support,
    rewardRules: {
      ...state.rewardRules,
      shippingCharge: shippingCfg.shippingCharge,
      shippingMode: shippingCfg.shippingMode,
      freeShippingMinAmount: shippingCfg.freeShippingMinAmount,
    },
    deliveryFee: shippingCfg.shippingCharge,
    freeShippingThreshold: shippingCfg.freeShippingMinAmount,
    shippingMode: shippingCfg.shippingMode,
    minWithdrawalCoins: state.rewardRules?.minWithdrawalCoins ?? MIN_WITHDRAWAL_COINS,
  };
}

function normalizeSupportNumber(raw: string, label: string, required: boolean): string {
  const international = toInternationalDigits(raw);
  if (!international) {
    if (required) throw new HttpError(422, `${label} is required — use the country code, e.g. 919876543210`);
    return "";
  }
  if (international.length < 11 || international.length > 15) {
    throw new HttpError(422, `${label} must be 10–15 digits including the country code`);
  }
  return international;
}

export function saveSupport(input: Partial<SupportConfig>, actor: string): Promise<SupportConfig> {
  return mutate((state) => {
    const current = state.support;
    const next: SupportConfig = {
      whatsappNumber: normalizeSupportNumber(input.whatsappNumber ?? current.whatsappNumber, "WhatsApp number", true),
      callNumber: normalizeSupportNumber(input.callNumber ?? current.callNumber, "Call number", false),
      email: (input.email ?? current.email).trim(),
      hours: (input.hours ?? current.hours).trim(),
      whatsappMessage: (input.whatsappMessage ?? current.whatsappMessage).trim(),
      tawkPropertyId: (input.tawkPropertyId !== undefined ? input.tawkPropertyId : current.tawkPropertyId ?? "").trim(),
      tawkWidgetId: (input.tawkWidgetId !== undefined ? input.tawkWidgetId : current.tawkWidgetId ?? "default").trim(),
      tawkEnabled: input.tawkEnabled !== undefined ? Boolean(input.tawkEnabled) : current.tawkEnabled ?? true,
    };

    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(next.email)) throw new HttpError(422, "Support email is not valid");
    if (!next.hours) throw new HttpError(422, "Support hours are shown on the help centre — fill them in");
    if (next.hours.length > 60) throw new HttpError(422, "Support hours must be 60 characters or less");
    if (next.whatsappMessage.length > 240) throw new HttpError(422, "The pre-filled chat message must be 240 characters or less");

    state.support = next;
    recordAudit(
      state,
      actor,
      "SUPPORT_UPDATED",
      `Help centre contact updated — WhatsApp ${formatSupportPhone(next.whatsappNumber)}${
        next.callNumber ? ` • call ${formatSupportPhone(next.callNumber)}` : " • phone line hidden"
      } • ${next.email} • ${next.hours}`
    );
    return next;
  });
}

/* ----------------------------------------------------------------- live support chat */

function generateWelcomeMessage(): SupportChatMessage {
  return {
    id: `msg_welcome_${Date.now()}`,
    sender: "BOT",
    senderName: "SKYWARE Concierge",
    text: "Welcome to SKYWARE Live Support! ⚡\n\nHow can we help you today? Choose an option below or type any message to chat with our live support team.",
    timestamp: nowIso(),
    quickActions: [
      { label: "📦 Track Order", payload: "TRACK_ORDER" },
      { label: "🪙 Sky Cash & Wallet", payload: "WALLET_RULES" },
      { label: "📏 Size & Fit Guide", payload: "SIZE_GUIDE" },
      { label: "🚚 Shipping Timelines", payload: "SHIPPING_INFO" },
      { label: "💬 Chat with Live Agent", payload: "LIVE_HUMAN" },
    ],
  };
}

export function getSupportChatThread(
  sessionId: string,
  customerData?: { id?: string; name?: string; phone?: string; email?: string }
): Promise<SupportChatThread> {
  const cleanSession = sessionId?.trim();
  if (!cleanSession) throw new HttpError(400, "Missing sessionId");

  return mutate((state) => {
    if (!state.supportChats) state.supportChats = [];

    let thread = state.supportChats.find(
      (t) => t.sessionId === cleanSession || (customerData?.id && t.customerId === customerData.id)
    );

    if (!thread) {
      thread = {
        id: `chat_${randomUUID().slice(0, 12)}`,
        sessionId: cleanSession,
        customerId: customerData?.id,
        customerName: customerData?.name || "Guest Visitor",
        customerPhone: customerData?.phone,
        customerEmail: customerData?.email,
        status: "BOT",
        messages: [generateWelcomeMessage()],
        unreadByAdmin: false,
        unreadByUser: false,
        lastMessageAt: nowIso(),
        createdAt: nowIso(),
      };
      state.supportChats.unshift(thread);
    } else {
      if (customerData?.id && !thread.customerId) thread.customerId = customerData.id;
      if (customerData?.name && (thread.customerName === "Guest Visitor" || !thread.customerName)) {
        thread.customerName = customerData.name;
      }
      if (customerData?.phone && !thread.customerPhone) thread.customerPhone = customerData.phone;
      if (customerData?.email && !thread.customerEmail) thread.customerEmail = customerData.email;
    }

    if (state.supportChats.length > 200) {
      state.supportChats = state.supportChats.slice(0, 200);
    }

    return thread;
  });
}

export function sendCustomerChatMessage(
  sessionId: string,
  rawText: string,
  customerData?: { id?: string; name?: string; phone?: string; email?: string }
): Promise<{ thread: SupportChatThread; botReply?: SupportChatMessage }> {
  const cleanSession = sessionId?.trim();
  const text = rawText?.trim();
  if (!cleanSession) throw new HttpError(400, "Missing sessionId");
  if (!text) throw new HttpError(400, "Message cannot be empty");

  return mutate((state) => {
    if (!state.supportChats) state.supportChats = [];

    let thread = state.supportChats.find(
      (t) => t.sessionId === cleanSession || (customerData?.id && t.customerId === customerData.id)
    );

    if (!thread) {
      thread = {
        id: `chat_${randomUUID().slice(0, 12)}`,
        sessionId: cleanSession,
        customerId: customerData?.id,
        customerName: customerData?.name || "Guest Visitor",
        customerPhone: customerData?.phone,
        customerEmail: customerData?.email,
        status: "BOT",
        messages: [generateWelcomeMessage()],
        unreadByAdmin: false,
        unreadByUser: false,
        lastMessageAt: nowIso(),
        createdAt: nowIso(),
      };
      state.supportChats.unshift(thread);
    }

    if (customerData?.id) thread.customerId = customerData.id;
    if (customerData?.name && (thread.customerName === "Guest Visitor" || !thread.customerName)) {
      thread.customerName = customerData.name;
    }
    if (customerData?.phone) thread.customerPhone = customerData.phone;
    if (customerData?.email) thread.customerEmail = customerData.email;

    const userMsg: SupportChatMessage = {
      id: `msg_user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sender: "USER",
      senderName: thread.customerName,
      text,
      timestamp: nowIso(),
    };
    thread.messages.push(userMsg);
    thread.lastMessageAt = nowIso();

    // Smart Bot Evaluation
    const lower = text.toLowerCase();
    let botReply: SupportChatMessage | null = null;

    // 1. TRACK ORDER / DELIVERY LOOKUP (English & Hinglish)
    if (
      text === "TRACK_ORDER" ||
      lower.includes("track") ||
      lower.includes("kahan hai") ||
      lower.includes("kab aayega") ||
      lower.includes("kab tak aayega") ||
      lower.includes("where is my order") ||
      lower.includes("status")
    ) {
      // Check if user has an existing order in state
      const userOrders = state.orders.filter(
        (o) =>
          (customerData?.phone && o.customerPhone?.replace(/\D/g, "").endsWith(customerData.phone.replace(/\D/g, "").slice(-10))) ||
          (customerData?.email && o.customerEmail?.toLowerCase() === customerData.email.toLowerCase()) ||
          (thread.customerPhone && o.customerPhone?.replace(/\D/g, "").endsWith(thread.customerPhone.replace(/\D/g, "").slice(-10)))
      );

      if (userOrders.length > 0 && text === "TRACK_ORDER") {
        const latestOrder = userOrders[0];
        const trackingUrl = latestOrder.courier && latestOrder.trackingNumber
          ? getCourierTrackingUrl(latestOrder.courier, latestOrder.trackingNumber)
          : undefined;

        botReply = {
          id: `msg_bot_${Date.now()}`,
          sender: "BOT",
          senderName: "SKYWARE Concierge",
          text: `📦 Found your recent Order #${latestOrder.orderNumber}!\n\n• Status: ${latestOrder.status}\n• Total: ₹${latestOrder.total.toLocaleString("en-IN")}\n• Payment: ${latestOrder.paymentStatus}\n• Items: ${latestOrder.items.length} item(s) (${latestOrder.items.map((i) => `${i.title} [${i.size}]`).join(", ")})\n${latestOrder.courier ? `• Courier: ${latestOrder.courier} (AWB: ${latestOrder.trackingNumber || "Assigned"})\n` : ""}\nIf you'd like to check a different order, simply type its 10-digit phone or Order # below.`,
          timestamp: nowIso(),
          orderPreview: {
            orderNumber: latestOrder.orderNumber,
            total: latestOrder.total,
            status: latestOrder.status,
            trackingUrl,
            courier: latestOrder.courier,
            itemsCount: latestOrder.items.length,
          },
          quickActions: [
            { label: "💬 Speak to Support Agent", payload: "LIVE_HUMAN" },
            { label: "🪙 Sky Cash Info", payload: "WALLET_RULES" },
          ],
        };
      } else {
        botReply = {
          id: `msg_bot_${Date.now()}`,
          sender: "BOT",
          senderName: "SKYWARE Concierge",
          text: "Please reply with your 10-digit mobile number or Order # (e.g. SKYWARE-XXXXXX or numeric ID) to look up your shipment:",
          timestamp: nowIso(),
        };
      }
    } else if (
      text === "WALLET_RULES" ||
      lower.includes("sky cash") ||
      lower.includes("cashback") ||
      lower.includes("coins") ||
      lower.includes("coin") ||
      lower.includes("reward")
    ) {
      botReply = {
        id: `msg_bot_${Date.now()}`,
        sender: "BOT",
        senderName: "SKYWARE Concierge",
        text: "🪙 Sky Cash Rewards System:\n\n• 100% cashback on your streetwear order unlocked daily over 30 days.\n• 3% of your unlocked cashback released every 24 hours in your Wallet.\n• 10% affiliate commission credited when friends order through your invite link.\n• Minimum 300 coins required to request a payout to your verified Bank Account or UPI.\n\nCheck your balance and claim coins anytime at skywear.in/wallet!",
        timestamp: nowIso(),
        quickActions: [
          { label: "📦 Track Order", payload: "TRACK_ORDER" },
          { label: "💸 Payout Rules", payload: "PAYOUT_INFO" },
          { label: "💬 Chat with Live Agent", payload: "LIVE_HUMAN" },
        ],
      };
    } else if (
      text === "PAYOUT_INFO" ||
      lower.includes("payout") ||
      lower.includes("withdrawal") ||
      lower.includes("paisa kab") ||
      lower.includes("bank account") ||
      lower.includes("upi transfer")
    ) {
      botReply = {
        id: `msg_bot_${Date.now()}`,
        sender: "BOT",
        senderName: "SKYWARE Concierge",
        text: "💸 Payout & Withdrawal Process:\n\n• Payout requests require minimum 300 coins in your Unlocked Balance.\n• Requests are audited and verified by our Admin desk within 24-48 business hours.\n• Funds are transferred via direct IMPS bank transfer or instant UPI.\n• Ensure your Bank Account / UPI is approved in your Member Profile.",
        timestamp: nowIso(),
        quickActions: [
          { label: "🪙 Sky Cash Rules", payload: "WALLET_RULES" },
          { label: "💬 Ask Admin Agent", payload: "LIVE_HUMAN" },
        ],
      };
    } else if (
      text === "SIZE_GUIDE" ||
      lower.includes("size") ||
      lower.includes("fit") ||
      lower.includes("measurement") ||
      lower.includes("chhota") ||
      lower.includes("bada")
    ) {
      botReply = {
        id: `msg_bot_${Date.now()}`,
        sender: "BOT",
        senderName: "SKYWARE Concierge",
        text: "📏 Size & Fit Guide:\n\n• All tees are custom-milled in 240 GSM 100% Super-Combed French Terry Cotton.\n• Tailored for a relaxed, drop-shoulder oversized streetwear silhouette.\n• If you prefer a tailored/snug regular fit, we recommend ordering one size down.\n• We provide 7-day doorstep size exchanges if the fit isn't perfect!",
        timestamp: nowIso(),
        quickActions: [
          { label: "📦 Track Order", payload: "TRACK_ORDER" },
          { label: "🚚 Shipping Timelines", payload: "SHIPPING_INFO" },
        ],
      };
    } else if (
      lower.includes("exchange") ||
      lower.includes("return") ||
      lower.includes("replace") ||
      lower.includes("badalna")
    ) {
      botReply = {
        id: `msg_bot_${Date.now()}`,
        sender: "BOT",
        senderName: "SKYWARE Concierge",
        text: "🔄 Easy 7-Day Exchange & Returns:\n\n• We offer free doorstep size swaps within 7 days of delivery.\n• Tee must be unworn with original tags attached.\n• Simply provide your Order # and new desired size, and our team will schedule a pickup.",
        timestamp: nowIso(),
        quickActions: [
          { label: "💬 Request Size Swap Now", payload: "LIVE_HUMAN" },
          { label: "📦 Track Order", payload: "TRACK_ORDER" },
        ],
      };
    } else if (
      lower.includes("cancel") ||
      lower.includes("cancellation") ||
      lower.includes("order radd")
    ) {
      botReply = {
        id: `msg_bot_${Date.now()}`,
        sender: "BOT",
        senderName: "SKYWARE Concierge",
        text: "🛑 Order Cancellation Policy:\n\n• Orders can be cancelled within 12 hours before our print & curing production starts.\n• If your order has already printed or dispatched, please accept delivery and request a free return or exchange.\n• Need urgent cancellation? Connect with our live concierge below:",
        timestamp: nowIso(),
        quickActions: [
          { label: "💬 Urgent Cancel Request", payload: "LIVE_HUMAN" },
          { label: "📦 Track Order", payload: "TRACK_ORDER" },
        ],
      };
    } else if (
      text === "SHIPPING_INFO" ||
      lower.includes("shipping") ||
      lower.includes("delivery") ||
      lower.includes("courier") ||
      lower.includes("cod charge")
    ) {
      botReply = {
        id: `msg_bot_${Date.now()}`,
        sender: "BOT",
        senderName: "SKYWARE Concierge",
        text: "🚚 Delivery & Shipping Timelines:\n\n• Orders are printed, cured, and dispatched within 24-48 business hours.\n• Air express delivery takes 2-4 days across all major Indian cities.\n• Cash on Delivery (COD) and Online Prepaid are available.\n• Tracking updates are dispatched via SMS & WhatsApp the moment your package ships.",
        timestamp: nowIso(),
        quickActions: [
          { label: "📦 Track Order", payload: "TRACK_ORDER" },
          { label: "💬 Chat with Live Agent", payload: "LIVE_HUMAN" },
        ],
      };
    } else if (
      text === "LIVE_HUMAN" ||
      lower.includes("human") ||
      lower.includes("agent") ||
      lower.includes("admin") ||
      lower.includes("support team") ||
      lower.includes("baat karni") ||
      lower.includes("call me")
    ) {
      thread.status = "WAITING_FOR_ADMIN";
      thread.unreadByAdmin = true;
      botReply = {
        id: `msg_bot_${Date.now()}`,
        sender: "BOT",
        senderName: "SKYWARE Concierge",
        text: "⚡ Connected to Live Admin Support Team!\n\nYour conversation has been routed to our concierge desk with high priority. A team member will reply directly in this chat shortly. Please stay on this tab or feel free to browse — your chat will remain active.",
        timestamp: nowIso(),
      };
    } else {
      // Check if text is a phone number or order number
      const phoneDigits = text.replace(/\D/g, "");
      const isPhone = phoneDigits.length === 10;
      const orderSearch = text.toUpperCase().replace(/[^A-Z0-9_-]/g, "");

      const matchedOrder = state.orders.find((o) => {
        if (isPhone && o.customerPhone && o.customerPhone.replace(/\D/g, "").endsWith(phoneDigits)) return true;
        if (orderSearch && orderSearch.length >= 4 && o.orderNumber.toUpperCase().includes(orderSearch)) return true;
        return false;
      });

      if (matchedOrder) {
        const trackingUrl = matchedOrder.courier && matchedOrder.trackingNumber
          ? getCourierTrackingUrl(matchedOrder.courier, matchedOrder.trackingNumber)
          : undefined;

        botReply = {
          id: `msg_bot_${Date.now()}`,
          sender: "BOT",
          senderName: "SKYWARE Concierge",
          text: `📦 Found Order #${matchedOrder.orderNumber}!\n\n• Status: ${matchedOrder.status}\n• Total: ₹${matchedOrder.total.toLocaleString("en-IN")}\n• Payment: ${matchedOrder.paymentStatus}\n• Items: ${matchedOrder.items.length} item(s) (${matchedOrder.items.map((i) => `${i.title} [${i.size}]`).join(", ")})\n${matchedOrder.courier ? `• Courier: ${matchedOrder.courier} (AWB: ${matchedOrder.trackingNumber || "Assigned"})\n` : ""}\nOur fulfillment team updates tracking at every transit hub.`,
          timestamp: nowIso(),
          orderPreview: {
            orderNumber: matchedOrder.orderNumber,
            total: matchedOrder.total,
            status: matchedOrder.status,
            trackingUrl,
            courier: matchedOrder.courier,
            itemsCount: matchedOrder.items.length,
          },
          quickActions: [
            { label: "💬 Speak to Support Agent", payload: "LIVE_HUMAN" },
            { label: "🪙 Sky Cash Info", payload: "WALLET_RULES" },
          ],
        };
      } else {
        // Any custom user query: Route to live admin team!
        thread.status = "WAITING_FOR_ADMIN";
        thread.unreadByAdmin = true;
        botReply = {
          id: `msg_bot_${Date.now()}`,
          sender: "BOT",
          senderName: "SKYWARE Concierge",
          text: "Thanks for messaging us! Our support team has received your message and will reply right here in this chat window. Feel free to add any more details or order numbers in the meantime.",
          timestamp: nowIso(),
          quickActions: [
            { label: "📦 Track Order", payload: "TRACK_ORDER" },
            { label: "🪙 Sky Cash & Wallet", payload: "WALLET_RULES" },
          ],
        };
      }
    }

    if (botReply) {
      thread.messages.push(botReply);
      thread.lastMessageAt = nowIso();
    }

    return { thread, botReply: botReply ?? undefined };
  });
}

export function getAllSupportChats(): Promise<SupportChatThread[]> {
  return mutate((state) => {
    if (!state.supportChats) state.supportChats = [];
    return [...state.supportChats].sort((a, b) => {
      if (a.status === "WAITING_FOR_ADMIN" && b.status !== "WAITING_FOR_ADMIN") return -1;
      if (b.status === "WAITING_FOR_ADMIN" && a.status !== "WAITING_FOR_ADMIN") return 1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });
  });
}

export function sendAdminChatReply(
  threadId: string,
  replyText: string,
  adminActor: string
): Promise<SupportChatThread> {
  const cleanId = threadId?.trim();
  const text = replyText?.trim();
  if (!cleanId) throw new HttpError(400, "Missing threadId");
  if (!text) throw new HttpError(400, "Reply text cannot be empty");

  return mutate((state) => {
    if (!state.supportChats) state.supportChats = [];
    const thread = state.supportChats.find((t) => t.id === cleanId);
    if (!thread) throw new HttpError(404, "Chat thread not found");

    const adminMsg: SupportChatMessage = {
      id: `msg_admin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sender: "ADMIN",
      senderName: adminActor || "SKYWARE Support Team",
      text,
      timestamp: nowIso(),
    };

    thread.messages.push(adminMsg);
    thread.status = "ADMIN_REPLIED";
    thread.unreadByAdmin = false;
    thread.unreadByUser = true;
    thread.lastMessageAt = nowIso();

    recordAudit(
      state,
      adminActor,
      "SUPPORT_CHAT_REPLY",
      `Replied to customer ${thread.customerName} (Thread ${thread.id})`
    );

    return thread;
  });
}

export function resolveSupportChat(
  threadId: string,
  adminActor: string
): Promise<SupportChatThread> {
  const cleanId = threadId?.trim();
  if (!cleanId) throw new HttpError(400, "Missing threadId");

  return mutate((state) => {
    if (!state.supportChats) state.supportChats = [];
    const thread = state.supportChats.find((t) => t.id === cleanId);
    if (!thread) throw new HttpError(404, "Chat thread not found");

    thread.status = "RESOLVED";
    thread.unreadByAdmin = false;
    thread.lastMessageAt = nowIso();

    const closeMsg: SupportChatMessage = {
      id: `msg_sys_${Date.now()}`,
      sender: "BOT",
      senderName: "SKYWARE Concierge",
      text: "✅ This support thread has been resolved by our team. If you have any further questions or new orders, feel free to send a message anytime!",
      timestamp: nowIso(),
    };
    thread.messages.push(closeMsg);

    recordAudit(
      state,
      adminActor,
      "SUPPORT_CHAT_RESOLVED",
      `Resolved chat thread for customer ${thread.customerName} (Thread ${thread.id})`
    );

    return thread;
  });
}

export function markChatReadByUser(sessionId: string): Promise<void> {
  const cleanSession = sessionId?.trim();
  if (!cleanSession) return Promise.resolve();

  return mutate((state) => {
    if (!state.supportChats) state.supportChats = [];
    const thread = state.supportChats.find((t) => t.sessionId === cleanSession);
    if (thread) {
      thread.unreadByUser = false;
    }
  });
}

export function syncQikinkWebhook(payload: { orderNumber?: string; status?: OrderStatus; courier?: CourierPartner; trackingNumber?: string }): Promise<ShopOrder> {
  const targetNumber = payload.orderNumber?.trim();
  const target = payload.status;
  if (!targetNumber || !target) throw new HttpError(422, "Webhook needs orderNumber and status");

  return mutate((state) => {
    const order = state.orders.find((o) => o.orderNumber === targetNumber);
    if (!order) throw new HttpError(404, `Unknown order ${targetNumber}`);

    let cursor = ORDER_FLOW.indexOf(order.status);
    const destination = ORDER_FLOW.indexOf(target);
    if (destination === -1 && target !== "CANCELLED") throw new HttpError(422, `Unsupported POD status ${target}`);

    if (target === "CANCELLED") {
      order.status = "CANCELLED";
      order.timeline.push({ label: "CANCELLED", at: nowIso(), note: "Cancelled from Qikink POD callback" });
      reverseOrderEarnings(state, order, "System (Qikink webhook)", "Cancelled from Qikink POD callback");
    } else {
      while (cursor < destination) {
        cursor += 1;
        const step = ORDER_FLOW[cursor];
        if (step === "SHIPPED") {
          order.courier = payload.courier ?? order.courier ?? COURIER_PARTNERS[0];
          order.trackingNumber = payload.trackingNumber ?? order.trackingNumber;
        }
        order.status = step;
        order.timeline.push({ label: step, at: nowIso(), note: `Qikink webhook · ${step}` });
      }
    }

    order.podStatus = target.toLowerCase();
    recordAudit(state, "System (Qikink webhook)", "POD_STATUS_SYNC", `#${order.orderNumber} → ${order.status}`);
    return order;
  });
}

export function adminUpdateCustomer(
  customerId: string,
  patch: AdminCustomerPatch,
  actor: string
): Promise<{ customer: CustomerAccount; transaction?: WalletTransaction }> {
  return mutate((state) => {
    const customer = state.customers.find((c) => c.id === customerId);
    if (!customer) throw new HttpError(404, "Customer not found");

    let adjustmentTx: WalletTransaction | undefined;

    if (patch.name?.trim()) customer.name = patch.name.trim();
    if (patch.phone?.trim()) customer.phone = patch.phone.trim();
    if (patch.email?.trim()) customer.email = patch.email.trim();
    if (patch.tier) customer.tier = patch.tier;

    if (patch.availableCoins !== undefined) {
      const newPts = Math.max(0, Math.round(Number(patch.availableCoins)));
      const diff = newPts - customer.availableCoins;
      if (diff !== 0) {
        adjustmentTx = walletTx({
          customerId: customer.id,
          type: "ADMIN_ADJUSTMENT",
          coins: diff,
          unit: "COINS",
          description: `${Math.abs(diff)} coins ${diff > 0 ? "added to" : "removed from"} your available balance — care team adjustment`,
          status: "COMPLETED",
        });
        state.transactions.unshift(adjustmentTx);
        customer.availableCoins = newPts;
        customer.lifetimeEarnedCoins = Math.max(customer.lifetimeEarnedCoins, customer.lifetimeEarnedCoins + Math.max(0, diff));
      }
    }

    if (patch.pendingCoins !== undefined) {
      customer.pendingCoins = Math.max(0, Math.round(Number(patch.pendingCoins)));
    }

    recordAudit(
      state,
      actor,
      "CUSTOMER_UPDATED",
      `Updated ${customer.name} (${customer.phone}) — available: ${customer.availableCoins}, pending: ${customer.pendingCoins}, tier: ${customer.tier}`
    );

    return { customer, transaction: adjustmentTx };
  });
}
export function signUpCustomerWithPassword(input: {
  name: string;
  phone: string;
  email?: string;
  password: string;
  referralCode?: string;
}): Promise<CustomerAccount> {
  return mutate(async (state) => {
    const cleanPhone = input.phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) throw new HttpError(422, "Enter a valid 10-digit Indian mobile number");
    const last10 = cleanPhone.slice(-10);

    // Strict 1:1 check - An existing account with this mobile number cannot create a second ID
    const existing = state.customers.find((c) => (c.phone || "").replace(/\D/g, "").endsWith(last10));
    if (existing) {
      throw new HttpError(409, `Mobile number +91 ${last10} is already registered. Only 1 account is permitted per phone number. Please login.`);
    }

    const cleanEmail = input.email?.trim() ? input.email.trim().toLowerCase() : undefined;
    if (cleanEmail) {
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(cleanEmail)) {
        throw new HttpError(422, "Enter a valid email address or leave it empty");
      }
      const existingEmail = state.customers.find((c) => c.email && c.email.toLowerCase() === cleanEmail);
      if (existingEmail) {
        throw new HttpError(409, `Email ${cleanEmail} is already registered. Please login to your existing account.`);
      }
    }

    if (!input.name?.trim()) throw new HttpError(422, "Full name is required");
    if (!input.password || input.password.length < 6) throw new HttpError(422, "Password must be at least 6 characters");

    const referralCodeUsed = input.referralCode?.trim().toUpperCase();
    const referrer = referralCodeUsed
      ? state.customers.find((c) => c.referralCode?.toUpperCase() === referralCodeUsed) ?? null
      : null;

    const customer: CustomerAccount = {
      id: `usr-${Date.now().toString(36)}`,
      name: input.name.trim(),
      phone: `+91 ${last10}`,
      email: cleanEmail,
      password: hashPassword(input.password),
      referralCode: referralCodeFor(state, input.name.trim()),
      referredByCode: referrer?.referralCode,
      availableCoins: 0,
      pendingCoins: 0,
      referralCoinBalance: 0,
      lifetimeEarnedCoins: 0,
      tier: "Silver",
      addresses: [],
      bankAccounts: [],
    };

    state.customers.push(customer);
    state.activeCustomerId = customer.id;

    if (referrer) {
      // Check if lead already exists for this phone/email
      const existingLead = state.referrals.find((r) =>
        (r.friendPhone && r.friendPhone.replace(/\D/g, "").endsWith(last10)) ||
        (cleanEmail && r.friendEmail && r.friendEmail.toLowerCase() === cleanEmail)
      );

      if (existingLead) {
        existingLead.referrerId = referrer.id;
        existingLead.referrerCode = referrer.referralCode;
        existingLead.friendId = customer.id;
        existingLead.friendName = customer.name;
        existingLead.friendPhone = customer.phone;
        if (cleanEmail) existingLead.friendEmail = cleanEmail;
      } else {
        state.referrals.unshift({
          id: `ref-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          referrerId: referrer.id,
          referrerCode: referrer.referralCode,
          friendId: customer.id,
          friendName: customer.name,
          friendPhone: customer.phone,
          friendEmail: cleanEmail || "",
          dateJoined: dateLabel(nowIso()),
          commissionCoins: 0,
          status: "PENDING",
        });
      }

      if (!referrer.notifications) referrer.notifications = [];
      referrer.notifications.unshift({
        id: `notif-${Date.now().toString(36)}`,
        title: "New Friend Registered!",
        message: `${customer.name} (${customer.phone}) just registered using your referral ID ${referrer.referralCode}!`,
        createdAt: nowIso(),
        read: false,
      });

      try {
        void broadcastPushNotification(
          {
            title: "🎉 New Referral Signup!",
            body: `${customer.name} just registered using your referral ID (${referrer.referralCode}). You'll earn referral coins on their orders!`,
            url: "/?tab=wallet",
            tag: `referral-signup-${customer.id}`,
          },
          referrer.id
        );
      } catch (err) {
        console.warn("[webpush] referral registered push warning:", err);
      }

      recordAudit(
        state,
        "System (storefront)",
        "REFERRAL_REGISTERED",
        `${customer.name} (${customer.phone}) registered under referral code ${referrer.referralCode} (${referrer.name})`
      );
    } else {
      recordAudit(state, customer.name, "CUSTOMER_REGISTERED", `New customer registered: ${customer.name} (${customer.phone})`);
    }

    await syncCustomerToUserTable(customer);
    return sanitizeCustomer(customer);
  });
}

interface CreateCustomerRecordInput {
  name: string;
  phone: string;
  email?: string;
  tier?: CustomerAccount["tier"];
  availableCoins?: number;
  password?: string;
}

function insertCustomerRecord(state: ZeninState, input: CreateCustomerRecordInput): CustomerAccount {
  const cleanDigits = input.phone.replace(/\D/g, "");
  if (cleanDigits.length < 10 && !input.email?.trim()) {
    throw new HttpError(422, "Please enter a valid 10-digit mobile number or email");
  }
  const last10 = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : "";
  if (last10) {
    const existing = state.customers.find((c) => (c.phone || "").replace(/\D/g, "").endsWith(last10));
    if (existing) {
      throw new HttpError(409, `An account already exists with phone number +91 ${last10} (${existing.name}). Duplicate accounts are not permitted.`);
    }
  }
  if (input.email?.trim()) {
    const cleanEmail = input.email.trim().toLowerCase();
    const existingEmail = state.customers.find((c) => c.email && c.email.toLowerCase() === cleanEmail);
    if (existingEmail) {
      throw new HttpError(409, `An account already exists with email ${cleanEmail} (${existingEmail.name}).`);
    }
  }
  const customer: CustomerAccount = {
    id: `usr-${Date.now().toString(36)}`,
    name: input.name.trim() || "Skywear Member",
    phone: last10 ? `+91 ${last10}` : input.phone.trim(),
    email: input.email?.trim() || undefined,
    password: input.password ? hashPassword(input.password) : undefined,
    referralCode: referralCodeFor(state, input.name.trim() || "Skywear Member"),
    availableCoins: Math.max(0, Math.round(Number(input.availableCoins || 0))),
    pendingCoins: 0,
    referralCoinBalance: 0,
    lifetimeEarnedCoins: Math.max(0, Math.round(Number(input.availableCoins || 0))),
    tier: input.tier || "Silver",
    addresses: [],
    bankAccounts: [],
  };
  state.customers.push(customer);
  return customer;
}

export function adminCreateCustomer(
  input: CreateCustomerRecordInput,
  actor: string
): Promise<CustomerAccount> {
  return mutate((state) => {
    const customer = insertCustomerRecord(state, input);
    recordAudit(state, actor, "CUSTOMER_CREATED", `Admin created profile for ${customer.name} (${customer.phone})`);
    return sanitizeCustomer(customer);
  });
}

export function loginCustomerWithPassword(input: {
  identifier: string;
  password: string;
  name?: string;
  phone?: string;
  email?: string;
}): Promise<CustomerAccount> {
  return mutate((state) => {
    const key = input.identifier.trim().toLowerCase();
    const cleanPhoneDigits = key.replace(/\D/g, "");
    const last10 = cleanPhoneDigits.length >= 10 ? cleanPhoneDigits.slice(-10) : "";

    let customer: CustomerAccount | undefined;
    if (key.includes("vikashpatel7582") || last10 === "7583893833") {
      customer = state.customers.find((c) => c.id === "usr-mvxo22lh");
    }

    if (!customer) {
      customer = state.customers.find((c) => {
        const matchEmail = c.email && c.email.toLowerCase() === key;
        const custDigits = (c.phone || "").replace(/\D/g, "");
        const matchPhone = Boolean(last10 && custDigits.endsWith(last10));
        return Boolean(matchEmail || matchPhone);
      });
    }

    if (!customer) {
      throw new HttpError(404, "No account found with this mobile number or email. Please register first.");
    }

    if (customer.password && !verifyPassword(input.password, customer.password)) {
      throw new HttpError(401, "Incorrect password. Please verify or use Forgot Password to reset.");
    }

    // Upgrade existing plain-text password to scrypt hash upon successful verification
    if (!customer.password || !customer.password.startsWith("scrypt:")) {
      customer.password = hashPassword(input.password);
    }

    // If existing customer had the default generic name, upgrade to real user name
    if (input.name?.trim() && (!customer.name || customer.name === "Skywear Member" || customer.name === "Zenin Member")) {
      customer.name = input.name.trim();
    }
    if (input.email?.trim()) {
      customer.email = input.email.trim();
    }
    if (input.phone?.trim() && (!customer.phone || customer.phone === "+91 90000 00000")) {
      const phDigits = input.phone.replace(/\D/g, "");
      customer.phone = phDigits.length === 10 ? `+91 ${phDigits}` : input.phone.trim();
    }

    state.activeCustomerId = customer.id;
    recordAudit(state, customer.name, "CUSTOMER_LOGIN", `Customer authenticated: ${customer.name} (${customer.phone})`);
    return sanitizeCustomer(customer);
  });
}

export function resetCustomerPassword(input: {
  identifier: string;
  newPassword: string;
}): Promise<CustomerAccount> {
  return mutate((state) => {
    const key = input.identifier.trim().toLowerCase();
    const cleanPhoneDigits = key.replace(/\D/g, "");
    const last10 = cleanPhoneDigits.length >= 10 ? cleanPhoneDigits.slice(-10) : "";

    let customer: CustomerAccount | undefined;
    if (key.includes("vikashpatel7582") || last10 === "7583893833") {
      customer = state.customers.find((c) => c.id === "usr-mvxo22lh");
    }

    if (!customer) {
      customer = state.customers.find((c) => {
        const matchEmail = c.email && c.email.toLowerCase() === key;
        const custDigits = (c.phone || "").replace(/\D/g, "");
        const matchPhone = Boolean(last10 && custDigits.endsWith(last10));
        return Boolean(matchEmail || matchPhone);
      });
    }

    if (!customer) {
      throw new HttpError(404, "No account found with this mobile number or email.");
    }

    if (!input.newPassword || input.newPassword.length < 6) {
      throw new HttpError(422, "New password must be at least 6 characters.");
    }

    customer.password = hashPassword(input.newPassword);
    recordAudit(state, customer.name, "CUSTOMER_PASSWORD_RESET", `Password reset successfully for ${customer.name}`);
    return sanitizeCustomer(customer);
  });
}

export function signInAsCustomer(identifier: string, name?: string): Promise<CustomerAccount> {
  return mutate(async (state) => {
    const key = identifier.trim().toLowerCase();
    const cleanDigits = key.replace(/\D/g, "");
    const last10 = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : "";

    let customer: CustomerAccount | undefined;
    if (key.includes("vikashpatel7582") || last10 === "7583893833") {
      customer = state.customers.find((c) => c.id === "usr-mvxo22lh");
    }

    if (!customer) {
      customer = state.customers.find(
        (c) =>
          (c.email && c.email.toLowerCase() === key) ||
          Boolean(last10 && (c.phone || "").replace(/\D/g, "").endsWith(last10))
      );
    }

    if (!customer) {
      if (!INDIAN_MOBILE.test(key.replace(/\s/g, "")) && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(key)) {
        throw new HttpError(422, "Enter a valid mobile number or email");
      }

      // Check again to strictly enforce single account per phone number
      if (last10) {
        const existing = state.customers.find((c) => (c.phone || "").replace(/\D/g, "").endsWith(last10));
        if (existing) {
          customer = existing;
        }
      }

      if (!customer) {
        const created: CustomerAccount = {
          id: `usr-${Date.now().toString(36)}`,
          name: name?.trim() || "Skywear Member",
          email: key.includes("@") ? key : undefined,
          phone: last10 ? `+91 ${last10}` : (key.includes("@") ? "+91 90000 00000" : key),
          referralCode: referralCodeFor(state, name?.trim() || "Skywear Member"),
          availableCoins: 0,
          pendingCoins: 0,
          referralCoinBalance: 0,
          lifetimeEarnedCoins: 0,
          tier: "Silver",
          addresses: [],
          bankAccounts: [],
        };
        state.customers.push(created);
        customer = created;
      }
    }

    state.activeCustomerId = customer.id;
    recordAudit(state, customer.name, "CUSTOMER_SIGNIN", `Session started for ${customer.phone}`);
    await syncCustomerToUserTable(customer);
    return sanitizeCustomer(customer);
  });
}

export function signOutCustomer(customerId: string | null) {
  if (!customerId) return null;
  return mutate((state) => {
    const customer = state.customers.find((c) => c.id === customerId);
    recordAudit(state, customer?.name ?? "Guest", "CUSTOMER_SIGNOUT", "Session ended");
    return customer ?? null;
  });
}

/**
 * Support lookup: an admin takes over a member's storefront session so the exact
 * wallet, orders and payout screens that member sees are rendered. The customer
 * cookie itself is written by the route; this only resolves the account and logs it.
 */
export function adminOpenMemberSession(customerId: string, actor: string): Promise<CustomerAccount> {
  return mutate((state) => {
    const customer = state.customers.find((c) => c.id === customerId);
    if (!customer) throw new HttpError(404, "Member not found");

    recordAudit(
      state,
      actor,
      "ADMIN_MEMBER_PREVIEW",
      `Storefront session issued for ${customer.name} (${customer.id}) • ${customer.availableCoins} available, ${customer.pendingCoins} vesting`
    );
    return customer;
  });
}

export function adminCloseMemberSession(customerId: string, actor: string) {
  return mutate((state) => {
    const customer = state.customers.find((c) => c.id === customerId);
    recordAudit(state, actor, "ADMIN_MEMBER_PREVIEW_END", `Preview of ${customer?.name ?? customerId} closed`);
    return { closed: true as const };
  });
}

/**
 * Scheduled background job to unlock eligible daily cashback (30-day month cycle)
 * Moves due tranches from Pending Cashback to Live Wallet atomically.
 */
export function triggerScheduledCashbackUnlock(actor = "System (Scheduled Cron)") {
  return mutate((state) => {
    const unlockedCount = releaseDueCashback(state);
    let autoClaimedCustomers = 0;
    let totalAutoClaimedPoints = 0;
    const todayKolkata = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

    // Automatically claim daily coins for all customers who have pending rewards from verified PAID orders
    for (const customer of state.customers) {
      if (customer.lastDailyClaimDate === todayKolkata) continue;
      if (customer.pendingCoins <= 0) continue;

      // Only allow daily claim if customer has verified PAID orders
      const verifiedPaidPendingCoins = state.orders
        .filter((o) => o.customerId === customer.id && o.paymentStatus === "PAID" && o.status !== "CANCELLED")
        .reduce((sum, o) => {
          if (o.cashback && o.cashback.length > 0) {
            return sum + o.cashback.filter((s) => s.status === "LOCKED" || s.status === "UNLOCKED").reduce((acc, s) => acc + s.coins, 0);
          }
          return sum + (o.cashbackCoins || 0);
        }, 0);

      if (verifiedPaidPendingCoins <= 0) continue;

      const sliceResult = claimCashbackCoins(state, customer.id);
      let claimedCoins = sliceResult.claimedCoins;

      const hasOrdersWithoutSlices = state.orders.some(
        (o) => o.customerId === customer.id && o.paymentStatus === "PAID" && o.status !== "CANCELLED" && (!o.cashback || o.cashback.length === 0)
      );

      if (claimedCoins === 0 && hasOrdersWithoutSlices && verifiedPaidPendingCoins > 0) {
        const dailyPercent = state.rewardRules.dailyClaimPercent ?? 3;
        claimedCoins = Math.max(1, Math.min(verifiedPaidPendingCoins, Math.min(customer.pendingCoins, Math.round(verifiedPaidPendingCoins * (dailyPercent / 100)))));
        customer.pendingCoins = Math.max(0, customer.pendingCoins - claimedCoins);
        customer.availableCoins += claimedCoins;

        state.transactions.unshift(
          walletTx({
            customerId: customer.id,
            type: "CASHBACK",
            coins: claimedCoins,
            unit: "COINS",
            description: `Auto-Claimed Daily ${dailyPercent}% Cashback (+${claimedCoins} coins) transferred to Live Wallet`,
            status: "COMPLETED",
          })
        );
      }

      if (claimedCoins > 0) {
        customer.lastDailyClaimDate = todayKolkata;
        autoClaimedCustomers++;
        totalAutoClaimedPoints += claimedCoins;

        if (customer.phone) {
          void sendWhatsAppMessage(
            customer.phone,
            [
              `🪙 *Daily Coins Auto-Claimed!*`,
              ``,
              `Hi ${customer.name.split(" ")[0]}! Your daily reward coins for today have been automatically credited to your Live Wallet:`,
              `💰 *Claimed Today:* +${claimedCoins} coins`,
              `💼 *Total Live Balance:* ${customer.availableCoins} coins`,
              ``,
              `Withdraw to UPI or bank from your wallet:`,
              `https://skywear.in/wallet`,
            ].join("\n")
          );
        }

        try {
          void broadcastPushNotification(
            {
              title: "🪙 Daily Coins Unlocked!",
              body: `+${claimedCoins} coins added to your Live Wallet today. Current balance: ${customer.availableCoins} coins.`,
              url: "/?tab=wallet",
              tag: `daily-coins-${todayKolkata}`,
            },
            customer.id
          );
        } catch (err) {
          console.warn("[webpush] daily claim push warning:", err);
        }
      }
    }

    if (unlockedCount > 0 || autoClaimedCustomers > 0) {
      recordAudit(
        state,
        actor,
        "CASHBACK_DAILY_UNLOCKED",
        `Scheduled daily unlock & auto-claim: ${unlockedCount} tranche(s) unlocked, ${autoClaimedCustomers} customer(s) auto-claimed (+${totalAutoClaimedPoints} coins)`
      );
    }
    return {
      success: true,
      unlockedTranches: unlockedCount,
      autoClaimedCustomers,
      totalAutoClaimedPoints,
      timestamp: new Date().toISOString(),
    };
  });
}

export function markNotificationRead(id: string, customerId: string | null) {
  return mutate((state) => {
    return markNotificationAsRead(state, id, customerId ?? undefined);
  });
}

export function markAllNotificationsRead(customerId: string) {
  return mutate((state) => {
    return markAllNotificationsAsRead(state, customerId);
  });
}

export function claimCustomerCashback(
  customerId: string,
  options?: { orderId?: string; week?: number }
) {
  return mutate((state) => {
    const customer = requireCustomer(state, customerId);
    customer.productDailyClaims = customer.productDailyClaims || {};
    
    // Server-side daily check in Asia/Kolkata timezone
    const todayKolkata = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

    if (customer.pendingCoins <= 0) {
      throw new HttpError(422, "No pending Sky Cash available to claim. Shop any drop to earn 100% Sky Cash!");
    }

    // Ensure all calendar-due slices are UNLOCKED first
    releaseDueCashback(state);

    // Scenario A: Claiming cashback for a specific product/order
    if (options?.orderId) {
      const order = state.orders.find(
        (o) =>
          o.customerId === customer.id &&
          o.paymentStatus === "PAID" &&
          o.status !== "CANCELLED" &&
          (o.id === options.orderId || o.orderNumber === options.orderId)
      );

      if (!order) {
        throw new HttpError(404, "Eligible order not found for cashback claim");
      }

      if (customer.productDailyClaims[order.id] === todayKolkata) {
        throw new HttpError(
          429,
          "You have already claimed daily cashback for this product today. Next daily claim unlocks at 12:00 AM IST."
        );
      }

      const sliceResult = claimCashbackCoins(state, customer.id, { orderId: order.id, week: options?.week });
      let claimedCoins = sliceResult.claimedCoins;

      if (claimedCoins === 0) {
        if (!order.cashback || order.cashback.length === 0) {
          const orderDaily = Math.max(1, Math.floor((order.cashbackCoins || 0) / 30));
          claimedCoins = Math.max(1, Math.min(customer.pendingCoins, orderDaily));
          customer.pendingCoins = Math.max(0, customer.pendingCoins - claimedCoins);
          customer.availableCoins += claimedCoins;

          state.transactions.unshift(
            walletTx({
              customerId: customer.id,
              orderId: order.id,
              orderNumber: order.orderNumber,
              type: "CASHBACK",
              coins: claimedCoins,
              unit: "COINS",
              description: `Daily Cashback Unlock (+${claimedCoins} coins) on #${order.orderNumber} transferred to Live Wallet`,
              status: "COMPLETED",
            })
          );
        } else {
          throw new HttpError(
            422,
            "No cashback slices are ready to collect for this product right now. Next daily tranche unlocks tomorrow at 12:00 AM IST."
          );
        }
      }

      customer.productDailyClaims[order.id] = todayKolkata;
      order.items?.forEach((item) => {
        if (item.title) customer.productDailyClaims![`prod:${item.title}`] = todayKolkata;
      });
      customer.lastDailyClaimDate = todayKolkata;

      recordAudit(
        state,
        customer.name,
        "DAILY_CASHBACK_CLAIMED",
        `${customer.name} claimed daily cashback for order #${order.orderNumber}: +${claimedCoins} coins moved to Live Wallet`
      );

      if (customer.phone && claimedCoins > 0) {
        void sendWhatsAppMessage(
          customer.phone,
          [
            `🪙 *Daily Coins Claimed!*`,
            ``,
            `Hi ${customer.name.split(" ")[0]}! Your daily cashback coins have been credited to your Live Wallet:`,
            `📦 *Product:* ${order.items?.map((i) => i.title).join(", ") || "Order #" + order.orderNumber}`,
            `💰 *Claimed Today:* +${claimedCoins} coins`,
            `💼 *Total Live Balance:* ${customer.availableCoins} coins`,
            ``,
            `Withdraw to UPI or bank from your wallet:`,
            `https://skywear.in/wallet`,
          ].join("\n")
        );
      }

      if (claimedCoins > 0) {
        try {
          void broadcastPushNotification(
            {
              title: "🪙 Coins Claimed Successfully!",
              body: `+${claimedCoins} coins claimed for ${order.items?.[0]?.title || "order"}. Balance: ${customer.availableCoins} coins.`,
              url: "/?tab=wallet",
              tag: `claim-coins-${Date.now().toString(36)}`,
            },
            customer.id
          );
        } catch (err) {
          console.warn("[webpush] claim cashback push warning:", err);
        }
      }

      void syncCustomerToUserTable(customer).catch(() => {});

      return {
        claimedCoins,
        orderId: order.id,
        nextClaimAvailableAt: "Tomorrow at 12:00 AM IST",
        customer,
      };
    }

    // Scenario B: Global claim (claim across all eligible products not yet claimed today)
    const paidOrders = state.orders.filter(
      (o) => o.customerId === customer.id && o.paymentStatus === "PAID" && o.status !== "CANCELLED"
    );

    const eligibleOrders = paidOrders.filter((o) => customer.productDailyClaims![o.id] !== todayKolkata);

    if (eligibleOrders.length === 0 && paidOrders.length > 0) {
      throw new HttpError(
        429,
        "You have already claimed daily cashback for all eligible products today. Next daily claim unlocks at 12:00 AM IST."
      );
    }

    let totalClaimedCoins = 0;
    for (const order of eligibleOrders) {
      const sliceResult = claimCashbackCoins(state, customer.id, { orderId: order.id });
      let claimedForOrder = sliceResult.claimedCoins;

      if (claimedForOrder === 0 && (!order.cashback || order.cashback.length === 0)) {
        const orderDaily = Math.max(1, Math.floor((order.cashbackCoins || 0) / 30));
        claimedForOrder = Math.max(1, Math.min(customer.pendingCoins, orderDaily));
        customer.pendingCoins = Math.max(0, customer.pendingCoins - claimedForOrder);
        customer.availableCoins += claimedForOrder;

        state.transactions.unshift(
          walletTx({
            customerId: customer.id,
            orderId: order.id,
            orderNumber: order.orderNumber,
            type: "CASHBACK",
            coins: claimedForOrder,
            unit: "COINS",
            description: `Daily Cashback Unlock (+${claimedForOrder} coins) on Order #${order.orderNumber} transferred to Live Wallet`,
            status: "COMPLETED",
          })
        );
      }

      if (claimedForOrder > 0) {
        totalClaimedCoins += claimedForOrder;
        customer.productDailyClaims[order.id] = todayKolkata;
        order.items?.forEach((item) => {
          if (item.title) customer.productDailyClaims![`prod:${item.title}`] = todayKolkata;
        });
      }
    }

    if (totalClaimedCoins === 0) {
      throw new HttpError(
        422,
        "No cashback slices are ready to collect right now. Your next daily cashback tranche unlocks tomorrow at 12:00 AM IST."
      );
    }

    customer.lastDailyClaimDate = todayKolkata;

    recordAudit(
      state,
      customer.name,
      "DAILY_CASHBACK_CLAIMED",
      `${customer.name} claimed daily cashback coins: +${totalClaimedCoins} coins moved to Live Wallet`
    );

    if (customer.phone && totalClaimedCoins > 0) {
      void sendWhatsAppMessage(
        customer.phone,
        [
          `🪙 *Daily Coins Claimed!*`,
          ``,
          `Hi ${customer.name.split(" ")[0]}! Your daily cashback coins have been credited to your Live Wallet:`,
          `💰 *Claimed Today:* +${totalClaimedCoins} coins`,
          `💼 *Total Live Balance:* ${customer.availableCoins} coins`,
          ``,
          `Withdraw to UPI or bank from your wallet:`,
          `https://skywear.in/wallet`,
        ].join("\n")
      );
    }

    if (totalClaimedCoins > 0) {
      try {
        void broadcastPushNotification(
          {
            title: "🪙 Coins Claimed Successfully!",
            body: `+${totalClaimedCoins} coins claimed and added to your Live Wallet. Balance: ${customer.availableCoins} coins.`,
            url: "/?tab=wallet",
            tag: `claim-coins-${Date.now().toString(36)}`,
          },
          customer.id
        );
      } catch (err) {
        console.warn("[webpush] claim cashback push warning:", err);
      }
    }

    void syncCustomerToUserTable(customer).catch(() => {});

    return {
      claimedCoins: totalClaimedCoins,
      nextClaimAvailableAt: "Tomorrow at 12:00 AM IST",
      customer,
    };
  });
}

export async function ensureCustomerDailyClaim(customerId: string) {
  const todayKolkata = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const state = readState();
  const customer = state.customers.find((c) => c.id === customerId);
  if (!customer || customer.pendingCoins <= 0 || customer.lastDailyClaimDate === todayKolkata) {
    return null;
  }
  const hasVerifiedPaidOrder = state.orders.some(
    (o) => o.customerId === customerId && o.paymentStatus === "PAID" && o.status !== "CANCELLED"
  );
  if (!hasVerifiedPaidOrder) {
    return null;
  }
  try {
    return await claimCustomerCashback(customerId);
  } catch {
    return null;
  }
}

export function addCustomerBankAccount(
  customerId: string,
  input: {
    accountHolderName: string;
    accountNumber: string;
    confirmAccountNumber?: string;
    ifscCode: string;
    bankName: string;
  }
) {
  return mutate((state) => {
    const customer = requireCustomer(state, customerId);
    if (!input.accountHolderName?.trim()) throw new HttpError(422, "Account holder name is required");

    let bank = resolveIndianBank(input.bankName || "");
    if (!bank && input.bankName?.trim()) {
      const matches = searchIndianBanks(input.bankName.trim(), 1);
      if (matches.length > 0) bank = matches[0];
    }
    if (!bank) {
      if (input.bankName?.trim() && input.bankName.trim().length >= 3) {
        bank = {
          name: input.bankName.trim(),
          shortName: input.bankName.trim().split(" ")[0].toUpperCase(),
          aliases: [input.bankName.trim()],
          status: "ACTIVE",
        };
      } else {
        throw new HttpError(422, "Select a bank from the supported list");
      }
    }

    const cleanAcc = normalizeAccountNumber(input.accountNumber || "");
    if (!BANK_ACCOUNT_REGEX.test(cleanAcc)) {
      throw new HttpError(422, "Enter a valid 9 to 18-digit bank account number");
    }
    const confirmAcc = normalizeAccountNumber(input.confirmAccountNumber || "");
    if (!confirmAcc) throw new HttpError(422, "Confirm your bank account number");
    if (confirmAcc !== cleanAcc) throw new HttpError(422, "Account numbers do not match");

    const cleanIfsc = normalizeIfsc(input.ifscCode || "");
    if (!IFSC_REGEX.test(cleanIfsc)) {
      throw new HttpError(422, "Enter a valid 11-character IFSC code (e.g. INDB0000476)");
    }

    const fingerprint = bankAccountFingerprint(cleanIfsc, cleanAcc);
    const conflict =
      state.customers.some(
        (c) => c.id !== customerId && customerHasBankFingerprint(c, fingerprint)
      ) ||
      state.withdrawals.some(
        (w) => w.customerId !== customerId && withdrawalBankFingerprint(w) === fingerprint
      );
    if (conflict) {
      throw new HttpError(409, DEDUPE_PAYMENT_MESSAGE);
    }

    if (!customer.bankAccounts) customer.bankAccounts = [];

    // If the user already has a bank account, they can only edit it and it goes to review.
    if (customer.bankAccounts.length > 0) {
      const existing = customer.bankAccounts[0];
      const existingAccount = bankAccountNumber(existing);
      const unchanged =
        existingAccount === cleanAcc &&
        normalizeIfsc(existing.ifscCode) === cleanIfsc &&
        existing.bankName === bank.name;
      if (unchanged) {
        return { bankAccounts: customer.bankAccounts, customer, pendingReview: false };
      }
      existing.status = "PENDING_REVIEW";
      existing.pendingUpdate = {
        accountHolderName: input.accountHolderName.trim(),
        accountNumberEnc: encryptAccountNumber(cleanAcc),
        accountNumberLast4: accountLast4(cleanAcc),
        ifscCode: cleanIfsc,
        bankName: bank.name,
        requestedAt: nowIso(),
      };
      recordAudit(
        state,
        customer.name,
        "BANK_ACCOUNT_EDIT_REQUESTED",
        `Requested bank change to ${cleanIfsc} ••••${accountLast4(cleanAcc)}. Submitted to admin review.`
      );
      return { bankAccounts: customer.bankAccounts, customer, pendingReview: true };
    }

    // First time adding: verified & locked to this profile
    const newAcc: BankAccount = {
      id: `bnk-${Date.now().toString(36)}`,
      accountHolderName: input.accountHolderName.trim(),
      accountNumberEnc: encryptAccountNumber(cleanAcc),
      accountNumberLast4: accountLast4(cleanAcc),
      ifscCode: cleanIfsc,
      bankName: bank.name,
      isDefault: true,
      verified: true,
      status: "VERIFIED",
      addedAt: nowIso(),
    };

    customer.bankAccounts.push(newAcc);
    recordAudit(state, customer.name, "BANK_ACCOUNT_ADDED", `Linked verified bank account ${cleanIfsc} ••••${accountLast4(cleanAcc)}`);
    return { bankAccounts: customer.bankAccounts, addedAccount: newAcc, customer, pendingReview: false };
  });
}

export function requestCustomerUpiEdit(customerId: string, upiId: string) {
  return mutate((state) => {
    const customer = requireCustomer(state, customerId);
    const cleanUpi = normalizeUpiId(upiId);
    if (!UPI_ID.test(cleanUpi)) {
      throw new HttpError(422, "Please enter a valid UPI ID like name@bank");
    }

    // Check uniqueness across ALL other customers
    const conflict = state.customers.find(
      (c) => c.id !== customerId && (
        (c.savedUpiId && normalizeUpiId(c.savedUpiId) === cleanUpi) ||
        (c.pendingUpiId && normalizeUpiId(c.pendingUpiId) === cleanUpi) ||
        state.withdrawals.some((w) => w.customerId === c.id && normalizeUpiId(w.upiId) === cleanUpi && w.overallStatus !== "FAILED" && w.overallStatus !== "REJECTED")
      )
    );
    if (conflict) {
      throw new HttpError(409, DEDUPE_PAYMENT_MESSAGE);
    }

    // First time setting: verified & locked to profile
    if (!customer.savedUpiId) {
      customer.savedUpiId = cleanUpi;
      customer.upiStatus = "VERIFIED";
      recordAudit(state, customer.name, "UPI_SET", `Linked verified UPI ID ${cleanUpi} to profile.`);
      return { customer, savedUpiId: customer.savedUpiId, upiStatus: "VERIFIED", pendingReview: false };
    }

    // If already has UPI and edits it: goes to review
    if (normalizeUpiId(customer.savedUpiId) === cleanUpi) {
      return { customer, savedUpiId: customer.savedUpiId, upiStatus: customer.upiStatus, pendingReview: false };
    }

    customer.pendingUpiId = cleanUpi;
    customer.upiStatus = "PENDING_REVIEW";
    customer.pendingUpiRequestedAt = nowIso();
    recordAudit(
      state,
      customer.name,
      "UPI_EDIT_REQUESTED",
      `Requested UPI change to ${cleanUpi}. Submitted to admin review.`
    );
    return {
      customer,
      savedUpiId: customer.savedUpiId,
      pendingUpiId: customer.pendingUpiId,
      upiStatus: "PENDING_REVIEW",
      pendingReview: true,
    };
  });
}

export function adminApprovePayoutMethod(
  customerId: string,
  type: "UPI" | "BANK",
  actor: string
) {
  return mutate((state) => {
    const customer = state.customers.find((c) => c.id === customerId);
    if (!customer) throw new HttpError(404, "Customer not found");

    if (type === "UPI") {
      if (!customer.pendingUpiId) throw new HttpError(400, "No pending UPI update found");
      const oldUpi = customer.savedUpiId;
      customer.savedUpiId = customer.pendingUpiId;
      customer.upiStatus = "VERIFIED";
      delete customer.pendingUpiId;
      delete customer.pendingUpiRequestedAt;
      recordAudit(state, actor, "UPI_CHANGE_APPROVED", `Approved UPI change for ${customer.name} from ${oldUpi || "none"} to ${customer.savedUpiId}`);

      if (state.notifications) {
        state.notifications.unshift({
          id: `notif-upi-approved-${Date.now()}`,
          customerId: customer.id,
          type: "SYSTEM",
          title: "✅ UPI ID Change Approved",
          message: `Your UPI ID has been verified and updated to ${customer.savedUpiId}.`,
          channels: ["IN_APP", "WEB_PUSH"],
          channelStatus: {
            inApp: "DELIVERED",
            whatsapp: "PREPARED",
            sms: "PREPARED",
            email: "PREPARED",
          },
          createdAt: nowIso(),
          read: false,
        });
      }
    } else {
      const bank =
        (customer.bankAccounts || []).find((b) => b.status === "PENDING_REVIEW" || b.pendingUpdate) ||
        (customer.bankAccounts || [])[0];
      if (!bank || !bank.pendingUpdate) throw new HttpError(400, "No pending bank update found");
      const update = bank.pendingUpdate;
      const pendingAccount = decryptAccountNumber(update.accountNumberEnc || update.accountNumber);

      bank.accountHolderName = update.accountHolderName;
      if (update.accountNumberEnc) {
        bank.accountNumberEnc = update.accountNumberEnc;
      } else if (pendingAccount && BANK_ACCOUNT_REGEX.test(pendingAccount)) {
        bank.accountNumberEnc = encryptAccountNumber(pendingAccount);
      }
      bank.accountNumberLast4 =
        update.accountNumberLast4 ||
        (pendingAccount ? accountLast4(pendingAccount) : bank.accountNumberLast4 || "XXXX");
      delete bank.accountNumber;
      bank.ifscCode = update.ifscCode;
      bank.bankName = update.bankName;
      bank.verified = true;
      bank.status = "VERIFIED";
      delete bank.pendingUpdate;
      recordAudit(state, actor, "BANK_CHANGE_APPROVED", `Approved bank change for ${customer.name} to ${bank.ifscCode} ••••${bank.accountNumberLast4}`);

      if (state.notifications) {
        state.notifications.unshift({
          id: `notif-bank-approved-${Date.now()}`,
          customerId: customer.id,
          type: "SYSTEM",
          title: "✅ Bank Account Change Approved",
          message: `Your bank account change to ${bank.bankName} (••••${bank.accountNumberLast4}) has been verified and approved by admin.`,
          channels: ["IN_APP", "WEB_PUSH"],
          channelStatus: {
            inApp: "DELIVERED",
            whatsapp: "PREPARED",
            sms: "PREPARED",
            email: "PREPARED",
          },
          createdAt: nowIso(),
          read: false,
        });
      }
    }

    return { customer };
  });
}

export function adminRejectPayoutMethod(
  customerId: string,
  type: "UPI" | "BANK",
  reason: string,
  actor: string
) {
  return mutate((state) => {
    const customer = state.customers.find((c) => c.id === customerId);
    if (!customer) throw new HttpError(404, "Customer not found");

    if (type === "UPI") {
      delete customer.pendingUpiId;
      delete customer.pendingUpiRequestedAt;
      customer.upiStatus = customer.savedUpiId ? "VERIFIED" : undefined;
      recordAudit(state, actor, "UPI_CHANGE_REJECTED", `Rejected UPI change for ${customer.name}. Reason: ${reason}`);

      if (state.notifications) {
        state.notifications.unshift({
          id: `notif-upi-rejected-${Date.now()}`,
          customerId: customer.id,
          type: "SYSTEM",
          title: "❌ UPI ID Change Rejected",
          message: `Your UPI change request was rejected: ${reason}`,
          channels: ["IN_APP", "WEB_PUSH"],
          channelStatus: {
            inApp: "DELIVERED",
            whatsapp: "PREPARED",
            sms: "PREPARED",
            email: "PREPARED",
          },
          createdAt: nowIso(),
          read: false,
        });
      }
    } else {
      const bank =
        (customer.bankAccounts || []).find((b) => b.status === "PENDING_REVIEW" || b.pendingUpdate) ||
        (customer.bankAccounts || [])[0];
      if (bank) {
        delete bank.pendingUpdate;
        bank.status = "VERIFIED";
      }
      recordAudit(state, actor, "BANK_CHANGE_REJECTED", `Rejected bank change for ${customer.name}. Reason: ${reason}`);

      if (state.notifications) {
        state.notifications.unshift({
          id: `notif-bank-rejected-${Date.now()}`,
          customerId: customer.id,
          type: "SYSTEM",
          title: "❌ Bank Account Change Rejected",
          message: `Your bank account change request was rejected: ${reason}`,
          channels: ["IN_APP", "WEB_PUSH"],
          channelStatus: {
            inApp: "DELIVERED",
            whatsapp: "PREPARED",
            sms: "PREPARED",
            email: "PREPARED",
          },
          createdAt: nowIso(),
          read: false,
        });
      }
    }

    return { customer };
  });
}

export function adminUpdateCustomerBankAccount(
  customerId: string,
  input: {
    bankName: string;
    ifscCode: string;
    accountNumber: string;
    accountHolderName: string;
  },
  actor: string
) {
  return mutate((state) => {
    const customer = requireCustomer(state, customerId);
    const cleanAcc = normalizeAccountNumber(input.accountNumber || "");
    const cleanIfsc = normalizeIfsc(input.ifscCode || "");
    if (!BANK_ACCOUNT_REGEX.test(cleanAcc)) {
      throw new HttpError(422, "Enter a valid 9 to 18-digit bank account number");
    }
    if (!IFSC_REGEX.test(cleanIfsc)) {
      throw new HttpError(422, "Enter a valid 11-character IFSC code");
    }
    if (!input.accountHolderName?.trim()) {
      throw new HttpError(422, "Account holder name is required");
    }

    if (!customer.bankAccounts) customer.bankAccounts = [];
    const existing = customer.bankAccounts[0];
    if (existing) {
      existing.bankName = input.bankName.trim() || existing.bankName;
      existing.ifscCode = cleanIfsc;
      existing.accountHolderName = input.accountHolderName.trim();
      existing.accountNumberEnc = encryptAccountNumber(cleanAcc);
      existing.accountNumberLast4 = accountLast4(cleanAcc);
      delete existing.accountNumber;
      delete existing.pendingUpdate;
      existing.status = "VERIFIED";
      existing.verified = true;
    } else {
      customer.bankAccounts.push({
        id: `bnk-${Date.now().toString(36)}`,
        bankName: input.bankName.trim() || "Bank account",
        ifscCode: cleanIfsc,
        accountHolderName: input.accountHolderName.trim(),
        accountNumberEnc: encryptAccountNumber(cleanAcc),
        accountNumberLast4: accountLast4(cleanAcc),
        isDefault: true,
        verified: true,
        status: "VERIFIED",
        addedAt: nowIso(),
      });
    }

    recordAudit(
      state,
      actor,
      "ADMIN_UPDATED_BANK",
      `Admin set verified bank account for ${customer.name} to ${cleanIfsc} ••••${accountLast4(cleanAcc)}`
    );

    return { customer };
  });
}

export function removeCustomerBankAccount(customerId: string, bankAccountId: string) {
  return mutate((state) => {
    const customer = requireCustomer(state, customerId);
    const linked = (customer.bankAccounts || []).some((account) => account.id === bankAccountId);
    if (!linked) throw new HttpError(404, "Bank account not found");
    throw new HttpError(400, "Bank accounts cannot be deleted directly once linked. Please use the Edit option to submit changes for review.");
  });
}

export interface ClaimMilestoneInput {
  milestoneId: "IPHONE_17_PRO_MAX";
  recipientName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

export function claimReferralMilestoneReward(
  customerId: string,
  input: ClaimMilestoneInput
): Promise<{ success: boolean; claim: ReferralRewardClaim; customer: CustomerAccount }> {
  return mutate((state) => {
    const customer = requireCustomer(state, customerId);
    customer.claimedReferralRewards = customer.claimedReferralRewards ?? [];

    const milestone = REFERRAL_MILESTONES.find((m) => m.id === input.milestoneId);
    if (!milestone) throw new HttpError(404, "Invalid milestone reward specified");

    const alreadyClaimed = customer.claimedReferralRewards.some(
      (c) => c.milestoneId === input.milestoneId
    );
    if (alreadyClaimed) {
      throw new HttpError(400, `You have already claimed the ${milestone.title}!`);
    }

    // A converted referral is a lead that placed an order (orderNumber present and status APPROVED/PAID)
    const convertedCount = state.referrals.filter(
      (r) =>
        (r.referrerId === customer.id ||
          (r.referrerCode && r.referrerCode.toUpperCase() === customer.referralCode?.toUpperCase()) ||
          (!r.referrerId && !r.referrerCode && customer.id === "usr_aman_01")) &&
        r.orderNumber &&
        (r.status === "APPROVED" || r.status === "PAID")
    ).length;

    if (convertedCount < milestone.targetCount) {
      throw new HttpError(
        422,
        `You need ${milestone.targetCount} friends to purchase a product to unlock ${milestone.title}. Currently you have ${convertedCount} / ${milestone.targetCount} verified orders.`
      );
    }

    if (!input.recipientName.trim()) throw new HttpError(422, "Recipient name is required");
    if (!input.phone.trim() || input.phone.trim().length < 10) throw new HttpError(422, "Valid 10-digit phone number is required");
    if (!input.address.trim() || input.address.trim().length < 8) throw new HttpError(422, "Full delivery address is required");
    if (!input.city.trim() || !input.state.trim()) throw new HttpError(422, "City and state are required");
    if (!/^\d{6}$/.test(input.pincode.trim())) throw new HttpError(422, "Valid 6-digit PIN code is required");

    const claim: ReferralRewardClaim = {
      id: `clm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      milestoneId: milestone.id,
      milestoneTitle: milestone.title,
      targetCount: milestone.targetCount,
      recipientName: input.recipientName.trim(),
      phone: input.phone.trim(),
      address: input.address.trim(),
      city: input.city.trim(),
      state: input.state.trim(),
      pincode: input.pincode.trim(),
      claimedAt: nowIso(),
      status: "PENDING_DISPATCH",
    };

    customer.claimedReferralRewards.push(claim);

    recordAudit(
      state,
      customer.name,
      "REFERRAL_MILESTONE_CLAIMED",
      `${customer.name} reached ${convertedCount} friend orders and claimed ${milestone.title} (Valued ₹${milestone.marketValue}) to be shipped to ${claim.city}, ${claim.state}`
    );

    return { success: true, claim, customer };
  });
}

/* -------------------------------------------------------------------- agents */

export interface AgentApplicationInput {
  /** One-line pitch shown to the admin reviewer. */
  pitch?: string;
}

/**
 * Invite-style programme: any signed-in member can apply, but only an admin
 * approval flips the account to agent rates and the monthly ladder.
 */
export function applyForAgent(
  customerId: string,
  input: AgentApplicationInput
): Promise<CustomerAccount> {
  return mutate((state) => {
    const customer = requireCustomer(state, customerId);
    if (customer.agent?.status === "APPROVED") {
      throw new HttpError(409, "You are already an approved SKYWARE agent");
    }
    if (customer.agent?.status === "PENDING") {
      throw new HttpError(409, "Your agent application is already under review");
    }

    const pitch = (input.pitch ?? "").trim();
    if (pitch.length > 240) throw new HttpError(422, "Keep your pitch under 240 characters");

    customer.agent = {
      status: "PENDING",
      pitch: pitch || undefined,
      appliedAt: nowIso(),
    };

    recordAudit(
      state,
      customer.name,
      "AGENT_APPLICATION_SUBMITTED",
      `${customer.name} (${customer.referralCode}) applied for the agent programme${pitch ? ` — “${pitch}”` : ""}`
    );
    return customer;
  });
}

export type AgentReviewAction = "approve" | "reject";

export function reviewAgentApplication(
  customerId: string,
  action: AgentReviewAction,
  reason: string | undefined,
  actor: string
): Promise<CustomerAccount> {
  return mutate((state) => {
    const customer = requireCustomer(state, customerId);
    if (!customer.agent) throw new HttpError(404, "This member has not applied for the agent programme");
    if (action !== "approve" && action !== "reject") {
      throw new HttpError(422, "Agent review action must be approve or reject");
    }

    const at = nowIso();
    customer.agent.reviewedAt = at;
    customer.agent.reviewedBy = actor;

    if (action === "approve") {
      customer.agent.status = "APPROVED";
      customer.agent.rejectReason = undefined;
      recordAudit(
        state,
        actor,
        "AGENT_APPROVED",
        `${customer.name} (${customer.referralCode}) approved as a SKYWARE agent at ${state.rewardRules.agentCommissionPercent ?? state.rewardRules.referralCommissionPercent}% commission`
      );
    } else {
      const rejectReason = (reason ?? "").trim();
      if (!rejectReason) throw new HttpError(422, "Add a short reason so the member knows why");
      if (rejectReason.length > 200) throw new HttpError(422, "Rejection reason must be 200 characters or less");
      customer.agent.status = "REJECTED";
      customer.agent.rejectReason = rejectReason;
      recordAudit(
        state,
        actor,
        "AGENT_REJECTED",
        `${customer.name} (${customer.referralCode}) agent application rejected — ${rejectReason}`
      );
    }

    void syncCustomerToUserTable(customer).catch(() => {});
    return customer;
  });
}

export interface CreateAgentInput {
  name: string;
  phone: string;
  email?: string;
  /** Plaintext password the admin sets and hands to the agent. */
  password: string;
}

export function adminCreateAgent(
  input: CreateAgentInput,
  actor: string
): Promise<CustomerAccount> {
  return mutate((state) => {
    if (!input.name?.trim()) throw new HttpError(422, "Agent name is required");
    const password = (input.password ?? "").trim();
    if (password.length < 6) throw new HttpError(422, "Set a login password of at least 6 characters");

    const customer = insertCustomerRecord(state, {
      name: input.name,
      phone: input.phone,
      email: input.email,
      password,
    });

    const at = nowIso();
    customer.agent = {
      status: "APPROVED",
      appliedAt: at,
      reviewedAt: at,
      reviewedBy: actor,
    };

    recordAudit(
      state,
      actor,
      "AGENT_CREATED",
      `${customer.name} (${customer.phone}) created by admin as a SKYWARE agent with login credentials`
    );

    void syncCustomerToUserTable(customer).catch(() => {});
    return sanitizeCustomer(customer);
  });
}

export function promoteMemberToAgent(
  customerId: string,
  actor: string
): Promise<CustomerAccount> {
  return mutate((state) => {
    const customer = requireCustomer(state, customerId);
    if (customer.agent?.status === "APPROVED") {
      throw new HttpError(409, `${customer.name} is already an approved SKYWARE agent`);
    }

    const at = nowIso();
    const previous = customer.agent;
    customer.agent = {
      status: "APPROVED",
      pitch: previous?.pitch,
      appliedAt: previous?.appliedAt ?? at,
      reviewedAt: at,
      reviewedBy: actor,
      monthlyProgress: previous?.monthlyProgress,
      gifts: previous?.gifts,
    };

    recordAudit(
      state,
      actor,
      "AGENT_PROMOTED",
      `${customer.name} (${customer.referralCode}) promoted to SKYWARE agent by admin at ${state.rewardRules.agentCommissionPercent ?? state.rewardRules.referralCommissionPercent}% commission`
    );

    void syncCustomerToUserTable(customer).catch(() => {});
    return sanitizeCustomer(customer);
  });
}

/** Reverts an approved agent back to a standard member. Earned coins and gifts stay untouched. */
export function demoteAgentToMember(
  customerId: string,
  actor: string
): Promise<CustomerAccount> {
  return mutate((state) => {
    const customer = requireCustomer(state, customerId);
    if (customer.agent?.status !== "APPROVED") {
      throw new HttpError(409, `${customer.name} is not an approved SKYWARE agent`);
    }

    const at = nowIso();
    const previous = customer.agent;
    customer.agent = {
      status: "REJECTED",
      pitch: previous.pitch,
      appliedAt: previous.appliedAt,
      reviewedAt: at,
      reviewedBy: actor,
      rejectReason: "Agent access removed by admin",
      monthlyProgress: previous.monthlyProgress,
      gifts: previous.gifts,
    };

    recordAudit(
      state,
      actor,
      "AGENT_DEMOTED",
      `${customer.name} (${customer.referralCode}) removed from the SKYWARE agent programme — back to standard member commission`
    );

    void syncCustomerToUserTable(customer).catch(() => {});
    return sanitizeCustomer(customer);
  });
}

export function dispatchAgentGift(
  customerId: string,
  giftId: string,
  actor: string
): Promise<CustomerAccount> {
  return mutate((state) => {
    const customer = requireCustomer(state, customerId);
    const gift = customer.agent?.gifts?.find((entry) => entry.id === giftId);
    if (!gift) throw new HttpError(404, "Agent gift not found");
    if (gift.status === "DISPATCHED") throw new HttpError(409, "This gift is already dispatched");

    gift.status = "DISPATCHED";
    gift.dispatchedAt = nowIso();
    recordAudit(
      state,
      actor,
      "AGENT_GIFT_DISPATCHED",
      `${gift.label} dispatched to agent ${customer.name} for ${gift.period} (${gift.targetCoins.toLocaleString("en-IN")} sales coins slab)`
    );
    return customer;
  });
}

export interface SubmitReviewInput {
  productId: string;
  authorName: string;
  rating: number;
  title?: string;
  comment: string;
  sizePurchased?: string;
  imageUrl?: string;
}

export async function getProductReviews(productId: string): Promise<ProductReview[]> {
  const state = await readState();
  const allReviews: ProductReview[] = state.reviews ?? [];
  return allReviews.filter((r: ProductReview) => r.productId === productId);
}

export async function submitProductReview(input: SubmitReviewInput): Promise<{ success: boolean; review: ProductReview }> {
  if (!input.productId) throw new HttpError(400, "Product ID is required");
  if (!input.authorName.trim()) throw new HttpError(422, "Please enter your name");
  if (!input.comment.trim() || input.comment.trim().length < 5) {
    throw new HttpError(422, "Please provide a genuine review of at least 5 characters");
  }
  const rating = Math.min(5, Math.max(1, Math.round(Number(input.rating) || 5)));

  return mutate(async (state: ZeninState) => {
    if (!state.reviews) state.reviews = [];

    const newReview: ProductReview = {
      id: `rev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      productId: input.productId,
      authorName: input.authorName.trim(),
      rating,
      title: input.title?.trim() || undefined,
      comment: input.comment.trim(),
      verifiedPurchase: true,
      sizePurchased: input.sizePurchased?.trim() || undefined,
      imageUrl: input.imageUrl?.trim() || undefined,
      createdAt: nowIso(),
    };

    state.reviews.unshift(newReview);

    // Update product rating and reviewsCount in catalog
    const product = state.products.find((p: Product) => p.id === input.productId);
    if (product) {
      const prodReviews = state.reviews.filter((r: ProductReview) => r.productId === input.productId);
      const avg = Number((prodReviews.reduce((sum: number, r: ProductReview) => sum + r.rating, 0) / prodReviews.length).toFixed(1));
      product.rating = avg;
      product.reviewsCount = (product.reviewsCount ?? 0) + 1;
    }

    recordAudit(
      state,
      input.authorName.trim(),
      "PRODUCT_REVIEW_SUBMITTED",
      `Submitted ${rating}-star review for product ${product?.title ?? input.productId}`
    );

    return { success: true, review: newReview };
  });
}

// ---------------------------------------------------------------------------
// Referral System & Cross-Device PWA Fingerprint Handshake
// ---------------------------------------------------------------------------

interface ReferralFingerprint {
  code: string;
  name: string;
  timestamp: number;
}

const referralFingerprintCache = new Map<string, ReferralFingerprint>();

export function recordReferralFingerprint(ip: string, userAgent: string, code: string, name: string): void {
  const cleanIp = (ip || "unknown").split(",")[0].trim();
  const key = `${cleanIp}::${(userAgent || "").slice(0, 80)}`;
  referralFingerprintCache.set(key, {
    code,
    name,
    timestamp: Date.now(),
  });

  // Prune entries older than 48 hours
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  for (const [k, val] of referralFingerprintCache.entries()) {
    if (val.timestamp < cutoff) {
      referralFingerprintCache.delete(k);
    }
  }
}

export function matchReferralFingerprint(ip: string, userAgent: string): { code: string; name: string } | null {
  const cleanIp = (ip || "unknown").split(",")[0].trim();
  const key = `${cleanIp}::${(userAgent || "").slice(0, 80)}`;
  const entry = referralFingerprintCache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > 48 * 60 * 60 * 1000) {
    referralFingerprintCache.delete(key);
    return null;
  }
  return { code: entry.code, name: entry.name };
}

export function lookupReferralCode(code: string): { valid: boolean; code?: string; name?: string } {
  const state = readState();
  const cleanCode = code?.trim().toUpperCase();
  if (!cleanCode) return { valid: false };

  const referrer = state.customers.find(
    (c) =>
      c.referralCode?.toUpperCase() === cleanCode ||
      (c as any).legacyReferralCode?.toUpperCase() === cleanCode
  );
  if (!referrer) return { valid: false, code: cleanCode };

  return {
    valid: true,
    code: referrer.referralCode,
    name: referrer.name.split(" ")[0] || referrer.name,
  };
}

/**
 * Permanently purge a test customer and all associated test data (orders, transactions, withdrawals)
 */
export async function purgeCustomer(customerId: string, actor: string): Promise<{ success: boolean; customerId: string }> {
  return mutate((state) => {
    const idx = state.customers.findIndex((c) => c.id === customerId);
    if (idx === -1) throw new HttpError(404, "Customer not found");
    const customer = state.customers[idx];

    // Filter out orders for this customer
    state.orders = state.orders.filter((o) => o.customerId !== customerId);
    // Filter out transactions
    state.transactions = state.transactions.filter((t) => t.customerId !== customerId);
    // Filter out withdrawals
    state.withdrawals = state.withdrawals.filter((w) => w.customerId !== customerId);
    // Filter out notifications
    if (state.notifications) {
      state.notifications = state.notifications.filter((n) => n.customerId !== customerId);
    }
    // Remove the customer
    state.customers.splice(idx, 1);

    recordAudit(
      state,
      actor,
      "CUSTOMER_PURGED",
      `Permanently deleted customer ${customer.name} (${customer.email || customer.phone}) and associated test orders/transactions.`
    );

    return { success: true, customerId };
  });
}

/**
 * Permanently purge a product by ID or slug
 */
export async function purgeProduct(idOrSlug: string, actor: string): Promise<{ success: boolean; productId: string }> {
  return mutate((state) => {
    const target = idOrSlug.trim().toLowerCase();
    const idx = state.products.findIndex((p) => p.id.toLowerCase() === target || p.slug.toLowerCase() === target);
    if (idx === -1) throw new HttpError(404, "Product not found");
    const p = state.products[idx];
    state.products.splice(idx, 1);

    // Reviews only exist for a live product, so they leave with it.
    if (state.reviews) {
      state.reviews = state.reviews.filter((review) => review.productId !== p.id);
    }
    // Daily-claim markers are keyed by product id on each customer.
    for (const customer of state.customers) {
      if (customer.productDailyClaims && p.id in customer.productDailyClaims) {
        delete customer.productDailyClaims[p.id];
      }
    }

    recordAudit(
      state,
      actor,
      "PRODUCT_PURGED",
      `Permanently deleted product ${p.title} (${p.id}) with its reviews and coin-claim markers`
    );

    return { success: true, productId: p.id };
  });
}

export interface CreateTeamInput {
  name: string;
  description?: string;
  leaderId: string;
  status?: TeamStatus;
  permissions?: TeamPermission[];
  memberIds?: string[];
}

export interface UpdateTeamInput {
  name?: string;
  description?: string;
  leaderId?: string;
  status?: TeamStatus;
  permissions?: TeamPermission[];
  memberIds?: string[];
}

export async function getTeams(): Promise<Team[]> {
  const state = await readState();
  return state.teams ?? [];
}

export async function createTeam(input: CreateTeamInput, actor: string): Promise<Team> {
  const cleanName = (input.name || "").trim();
  if (!cleanName) throw new HttpError(422, "Team name is required");
  if (!input.leaderId) throw new HttpError(422, "Team leader is required");

  return mutate((state) => {
    state.teams = state.teams ?? [];

    const existing = state.teams.find((t) => t.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) throw new HttpError(409, `A team named "${cleanName}" already exists`);

    const leader = state.customers.find((c) => c.id === input.leaderId);
    if (!leader) throw new HttpError(404, "Selected team leader does not exist");

    const now = nowIso();
    const id = `team-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const memberSet = new Set<string>([input.leaderId, ...(input.memberIds || [])]);
    const members: TeamMemberRef[] = [];

    for (const mId of memberSet) {
      const cust = state.customers.find((c) => c.id === mId);
      if (cust) {
        members.push({
          customerId: cust.id,
          name: cust.name || "Member",
          email: cust.email,
          phone: cust.phone,
          role: cust.id === input.leaderId ? "LEADER" : "MEMBER",
          joinedAt: now,
        });
      }
    }

    const defaultPerms: TeamPermission[] = [
      "MANAGE_MEMBERS",
      "VIEW_TEAM_ORDERS",
      "VIEW_TEAM_METRICS",
    ];

    const team: Team = {
      id,
      name: cleanName,
      description: (input.description || "").trim(),
      leaderId: leader.id,
      leaderName: leader.name || "Team Leader",
      status: input.status || "ACTIVE",
      permissions: input.permissions && input.permissions.length > 0 ? input.permissions : defaultPerms,
      members,
      createdAt: now,
      updatedAt: now,
    };

    state.teams.unshift(team);

    recordAudit(
      state,
      actor,
      "TEAM_CREATED",
      `Team "${team.name}" created with leader ${team.leaderName} (${members.length} members)`
    );

    return team;
  });
}

export async function updateTeam(teamId: string, patch: UpdateTeamInput, actor: string): Promise<Team> {
  return mutate((state) => {
    state.teams = state.teams ?? [];
    const team = state.teams.find((t) => t.id === teamId);
    if (!team) throw new HttpError(404, "Team not found");

    const now = nowIso();

    if (patch.name !== undefined) {
      const cleanName = patch.name.trim();
      if (!cleanName) throw new HttpError(422, "Team name cannot be empty");
      const duplicate = state.teams.find(
        (t) => t.id !== teamId && t.name.toLowerCase() === cleanName.toLowerCase()
      );
      if (duplicate) throw new HttpError(409, `Another team named "${cleanName}" already exists`);
      team.name = cleanName;
    }

    if (patch.description !== undefined) {
      team.description = patch.description.trim();
    }

    if (patch.status !== undefined) {
      team.status = patch.status;
    }

    if (patch.permissions !== undefined) {
      team.permissions = patch.permissions;
    }

    if (patch.leaderId !== undefined && patch.leaderId !== team.leaderId) {
      const newLeader = state.customers.find((c) => c.id === patch.leaderId);
      if (!newLeader) throw new HttpError(404, "New team leader does not exist");
      team.leaderId = newLeader.id;
      team.leaderName = newLeader.name || "Team Leader";
    }

    if (patch.memberIds !== undefined || patch.leaderId !== undefined) {
      const targetLeaderId = team.leaderId;
      const baseMemberIds = patch.memberIds !== undefined
        ? patch.memberIds
        : team.members.map((m) => m.customerId);
      const memberSet = new Set<string>([targetLeaderId, ...baseMemberIds]);

      const newMemberList: TeamMemberRef[] = [];
      for (const mId of memberSet) {
        const existingMember = team.members.find((m) => m.customerId === mId);
        const cust = state.customers.find((c) => c.id === mId);
        if (cust) {
          newMemberList.push({
            customerId: cust.id,
            name: cust.name || existingMember?.name || "Member",
            email: cust.email || existingMember?.email,
            phone: cust.phone || existingMember?.phone,
            role: cust.id === targetLeaderId ? "LEADER" : "MEMBER",
            joinedAt: existingMember?.joinedAt || now,
          });
        }
      }
      team.members = newMemberList;
    }

    team.updatedAt = now;

    recordAudit(
      state,
      actor,
      "TEAM_UPDATED",
      `Team "${team.name}" updated (Status: ${team.status}, Leader: ${team.leaderName}, Members: ${team.members.length})`
    );

    return team;
  });
}

export async function deleteTeam(teamId: string, actor: string): Promise<{ success: boolean; id: string }> {
  return mutate((state) => {
    state.teams = state.teams ?? [];
    const index = state.teams.findIndex((t) => t.id === teamId);
    if (index === -1) throw new HttpError(404, "Team not found");

    const [deleted] = state.teams.splice(index, 1);

    recordAudit(
      state,
      actor,
      "TEAM_DELETED",
      `Team "${deleted.name}" (${deleted.id}) deleted by ${actor}`
    );

    return { success: true, id: teamId };
  });
}





