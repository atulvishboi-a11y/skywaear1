import type {
  CustomerAccount,
  WalletTransaction,
  WithdrawalRequest,
  WithdrawalTranche,
} from "../data/rewardsEngine";
import type { CashbackTranche, ShopOrder } from "./domain";

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function dateTimeLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export const VESTING_INSTALLMENTS = [
  { week: 1, dayOffset: 0 },
] as const;

export const CASHBACK_CYCLE_DAYS = 30;

export function buildVestingSchedule(
  totalCoins: number,
  anchorIso: string,
  _upiRef?: string
): WithdrawalTranche[] {
  return [
    {
      week: 1,
      percent: 100,
      coins: totalCoins,
      dueAt: anchorIso,
      dueDate: dateLabel(anchorIso),
      status: "UNLOCKED",
    },
  ];
}

export function refreshVesting(request: WithdrawalRequest): WithdrawalRequest {
  // A rejected or failed payout is terminal — its voided slices must never re-unlock with time.
  if (
    request.overallStatus === "REJECTED" ||
    request.overallStatus === "FAILED" ||
    request.overallStatus === "REVERSED" ||
    request.overallStatus === "PAID" ||
    request.overallStatus === "COMPLETED"
  ) {
    return request;
  }

  const list = request.tranches ?? [];
  const allTransferred = list.length > 0 && list.every((t) => t.status === "TRANSFERRED");
  if (allTransferred) {
    return { ...request, overallStatus: "PAID" };
  }

  return request;
}

export function vestingTotals(request: WithdrawalRequest) {
  const list = request.tranches ?? [];
  const transferred = list.filter((t: WithdrawalTranche) => t.status === "TRANSFERRED");
  const unlocked = list.filter((t: WithdrawalTranche) => t.status === "UNLOCKED");
  const open = list.filter((t: WithdrawalTranche) => t.status === "LOCKED" || t.status === "UNLOCKED");
  const voided = list.filter((t: WithdrawalTranche) => t.status === "VOID");

  return {
    paidCoins: transferred.reduce((sum: number, t: WithdrawalTranche) => sum + t.coins, 0),
    payableNowCoins: unlocked.reduce((sum: number, t: WithdrawalTranche) => sum + t.coins, 0),
    remainingCoins: open.reduce((sum: number, t: WithdrawalTranche) => sum + t.coins, 0),
    voidedCoins: voided.reduce((sum: number, t: WithdrawalTranche) => sum + t.coins, 0),
    nextDueLabel:
      open.find((t: WithdrawalTranche) => t.status === "LOCKED")?.dueDate ??
      open.find((t: WithdrawalTranche) => t.status === "UNLOCKED")?.dueDate ??
      "All tranches settled",
  };
}

export function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

export function buildCashbackSchedule(totalCoins: number, anchorIso: string): CashbackTranche[] {
  const coins = Math.max(0, Math.round(totalCoins));
  const days = CASHBACK_CYCLE_DAYS; // 30-day monthly cycle
  const baseCoins = Math.floor(coins / days);
  const remainderCoins = coins % days;

  let accumulatedCoins = 0;

  const slices: CashbackTranche[] = [];
  for (let day = 1; day <= days; day++) {
    const isFinal = day === days;
    const sliceCoins = isFinal
      ? Math.max(0, coins - accumulatedCoins)
      : (day <= remainderCoins ? baseCoins + 1 : baseCoins);
    accumulatedCoins += sliceCoins;

    // Day 1 has dayOffset = 0 (same day as order placement/confirmation)
    const dayOffset = day - 1;
    const dueAt = dayOffset === 0 ? anchorIso : addDays(anchorIso, dayOffset);

    slices.push({
      week: day,
      percent: Number((100 / days).toFixed(2)),
      coins: sliceCoins,
      dueAt,
      dueDate: dateLabel(dueAt),
      status: "LOCKED" as const,
    });
  }

  return slices;
}

export interface CashbackTotals {
  releasedCoins: number;
  unlockedCoins: number;
  lockedCoins: number;
  nextSlice: CashbackTranche | null;
}

export function cashbackTotals(tranches: CashbackTranche[] | undefined): CashbackTotals {
  const list = tranches ?? [];
  const released = list.filter((t) => t.status === "RELEASED");
  const unlocked = list.filter((t) => t.status === "UNLOCKED");
  const locked = list.filter((t) => t.status === "LOCKED");
  const nextSlice = locked.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())[0] ?? null;

  return {
    releasedCoins: released.reduce((sum, t) => sum + t.coins, 0),
    unlockedCoins: unlocked.reduce((sum, t) => sum + t.coins, 0),
    lockedCoins: locked.reduce((sum, t) => sum + t.coins, 0),
    nextSlice,
  };
}

export function cashbackLedgerLine(order: ShopOrder): string {
  const totals = cashbackTotals(order.cashback);
  const prefix = `${order.cashbackCoins} cashback coins on #${order.orderNumber}`;

  if (order.paymentStatus !== "PAID") {
    return `${prefix} — unlocks daily across a 30-day cycle once payment is confirmed`;
  }
  if (totals.releasedCoins === 0 && totals.unlockedCoins === 0) {
    return `${prefix} — unlocks daily across 30 days starting on Day 1`;
  }
  if (!totals.nextSlice && totals.unlockedCoins === 0) {
    return `${prefix} — all 30 daily parts claimed into Live Wallet`;
  }
  return `${prefix} — ${totals.releasedCoins} coins in Live Wallet, ${totals.unlockedCoins} coins ready to claim`;
}

export interface CashbackVestingContext {
  orders: ShopOrder[];
  customers: CustomerAccount[];
  transactions: WalletTransaction[];
  notifications?: any[];
}

/**
 * Transitions due cashback slices from LOCKED to UNLOCKED (ready for manual collection by customer).
 * Does NOT auto-credit coins into availableCoins, letting the user collect them.
 */
export function releaseDueCashback(state: CashbackVestingContext): number {
  const now = Date.now();
  const todayKolkata = new Date(now).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  let newlyUnlocked = 0;

  for (const order of state.orders) {
    if (order.cashbackCoins <= 0) continue;

    if (order.status === "CANCELLED" || order.paymentStatus === "REJECTED") {
      order.cashback?.forEach((slice) => {
        if (slice.status === "LOCKED" || slice.status === "UNLOCKED") slice.status = "VOID";
      });
      continue;
    }

    // Cashback vesting only runs once payment is verified and PAID
    if (order.paymentStatus !== "PAID") {
      continue;
    }

    const buyer = state.customers.find((c) => c.id === order.customerId);
    if (!buyer) continue;

    // Vesting starts when payment is confirmed: Day 1 unlocks on order date, Day 2 on next calendar day, etc.
    if (!order.cashback || order.cashback.length === 0) {
      order.cashback = buildCashbackSchedule(order.cashbackCoins, order.placedAt);
    }

    order.cashback?.forEach((slice) => {
      if (slice.status !== "LOCKED") return;
      const sliceDateKolkata = new Date(slice.dueAt).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      if (todayKolkata >= sliceDateKolkata) {
        slice.status = "UNLOCKED";
        newlyUnlocked += slice.coins;

        // Record multi-channel customer notification that slice is unlocked & ready to collect
        if (state.notifications) {
          const notifId = `notif-cb-${order.orderNumber}-d${slice.week}`;
          const alreadyNotified = state.notifications.some((n: any) => n.id === notifId);
          if (!alreadyNotified) {
            state.notifications.unshift({
              id: notifId,
              customerId: buyer.id,
              type: "CASHBACK_UNLOCKED",
              title: `🎉 Day ${slice.week}/30 Cashback Ready: ${slice.coins} Coins`,
              message: `${slice.coins} Coins on Order #${order.orderNumber} is unlocked! Tap Claim in your wallet to transfer to Live Wallet.`,
              createdAt: new Date(now).toISOString(),
              read: false,
            });
          }
        }
      }
    });

    const ledgerLine = state.transactions.find(
      (t) => t.orderNumber === order.orderNumber && t.type === "CASHBACK" && !t.id.startsWith("tx-unlock-") && t.status !== "REVERSED"
    );
    if (ledgerLine) {
      ledgerLine.description = cashbackLedgerLine(order);
    }
  }

  return newlyUnlocked;
}

/**
 * Manually collects unlocked cashback slices for an order (or all orders of a customer)
 * and transfers coins into their Live Wallet (availableCoins).
 */
export function claimCashbackCoins(
  state: CashbackVestingContext,
  customerId: string,
  options?: { orderId?: string; week?: number }
): { claimedCoins: number; slicesClaimed: number } {
  const buyer = state.customers.find((c) => c.id === customerId);
  if (!buyer) throw new Error("Customer not found");

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  let claimedCoins = 0;
  let slicesClaimed = 0;

  const targetOrders = state.orders.filter(
    (o) =>
      o.customerId === customerId &&
      o.paymentStatus === "PAID" &&
      o.status !== "CANCELLED" &&
      (!options?.orderId || o.id === options.orderId || o.orderNumber === options.orderId)
  );

  for (const order of targetOrders) {
    if (!order.cashback) continue;

    for (const slice of order.cashback) {
      if (slice.status !== "UNLOCKED") continue;
      if (options?.week && slice.week !== options.week) continue;

      slice.status = "RELEASED";
      slice.releasedAt = nowIso;
      buyer.pendingCoins = Math.max(0, buyer.pendingCoins - slice.coins);
      buyer.availableCoins += slice.coins;
      claimedCoins += slice.coins;
      slicesClaimed += 1;

      // Unique ledger row per slice; the id is the idempotency key.
      const unlockTxId = `tx-unlock-${order.orderNumber}-d${slice.week}`;
      const alreadyLogged = state.transactions.some((t) => t.id === unlockTxId);
      if (!alreadyLogged) {
        state.transactions.unshift({
          id: unlockTxId,
          customerId: buyer.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
          type: "CASHBACK",
          coins: slice.coins,
          unit: "COINS",
          idempotencyKey: unlockTxId,
          description: `Day ${slice.week}/30 cashback claimed on #${order.orderNumber} — moved to Live Wallet`,
          status: "COMPLETED",
          date: dateLabel(nowIso),
          createdAt: nowIso,
        });
      }
    }

    const ledgerLine = state.transactions.find(
      (t) => t.orderNumber === order.orderNumber && t.type === "CASHBACK" && !t.id.startsWith("tx-unlock-") && t.status !== "REVERSED"
    );
    if (ledgerLine) {
      ledgerLine.description = cashbackLedgerLine(order);
    }
  }

  return { claimedCoins, slicesClaimed };
}

/**
 * Activates every cashback slice that has become eligible for one verified order.
 * Idempotent: slices flip to RELEASED and the wallet ledger row is keyed by
 * `tx-unlock-<order>-d<day>`, so re-running this can never double-credit.
 */
export function activateOrderCashback(
  state: CashbackVestingContext,
  order: ShopOrder
): { claimedCoins: number; slicesClaimed: number } {
  const empty = { claimedCoins: 0, slicesClaimed: 0 };
  // Only verified, non-cancelled payments may ever move coins into the Live Wallet.
  if (order.paymentStatus !== "PAID" || order.status === "CANCELLED") {
    return empty;
  }
  if (!order.customerId || order.cashbackCoins <= 0) return empty;

  if (!order.cashback || order.cashback.length === 0) {
    order.cashback = buildCashbackSchedule(order.cashbackCoins, order.verifiedAt ?? order.placedAt);
  }

  releaseDueCashback(state);
  return claimCashbackCoins(state, order.customerId, { orderId: order.id });
}
