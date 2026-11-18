/**
 * Wallet ledger row. `coins` is always a reward-coin amount; it is never money.
 * `legacyInrValue` exists only so historical invoices keep their old label and is
 * never read by balances, payouts or reward math.
 */
export interface WalletTransaction {
  id: string;
  customerId?: string;
  orderId?: string;
  orderNumber?: string;
  type: "CASHBACK" | "REFERRAL_COMMISSION" | "REDEMPTION" | "REFUND" | "ADMIN_ADJUSTMENT";
  coins: number; // positive or negative, unit = COINS
  unit: "COINS";
  legacyInrValue?: number;
  description: string;
  date: string;
  createdAt?: string;
  /** Stable key that makes every reward credit idempotent. */
  idempotencyKey?: string;
  status: "COMPLETED" | "PENDING" | "REVERSED";
}

export interface ReferralLead {
  id: string;
  referrerId?: string;
  referrerCode?: string;
  friendId?: string;
  friendName: string;
  friendPhone?: string;
  friendEmail?: string;
  dateJoined: string;
  orderNumber?: string;
  /** The referred order's eligible purchase amount in INR. */
  orderAmountInr?: number;
  /** Referral reward in coins: orderAmountInr × referral % ÷ 100. */
  commissionCoins: number;
  /** When the coins were credited; absent means still pending payment. */
  creditedAt?: string;
  status: "PENDING" | "APPROVED" | "PAID";
}

/** A monthly referred-sales milestone for approved agents. */
export interface AgentSlabConfig {
  /** Monthly referred-sales volume in coins that unlocks this slab. */
  targetCoins: number;
  /** One-time bonus coins credited when the slab is crossed. */
  bonusCoins: number;
  /** Physical gift the admin dispatches once the slab is crossed. */
  gift: string;
}

export const DEFAULT_AGENT_SLABS: AgentSlabConfig[] = [
  { targetCoins: 5000, bonusCoins: 500, gift: "SKYWARE Heavyweight Tee" },
  { targetCoins: 15000, bonusCoins: 2000, gift: "SKYWARE Hoodie Drop" },
  { targetCoins: 30000, bonusCoins: 5000, gift: "SKYWARE VIP Archive Kit" },
];

/** Admin can extend the 3 default milestones; keep the monthly ladder bounded. */
export const MAX_AGENT_SLABS = 10;

export type AgentStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface AgentGift {
  id: string;
  /** Calendar month in Asia/Kolkata, e.g. 2026-11. */
  period: string;
  targetCoins: number;
  label: string;
  status: "PENDING_DISPATCH" | "DISPATCHED";
  grantedAt: string;
  dispatchedAt?: string;
}

export interface AgentProfile {
  status: AgentStatus;
  /** What the member wrote when applying. */
  pitch?: string;
  appliedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectReason?: string;
  /** Current calendar-month referred-sales progress, in coins. */
  monthlyProgress?: { period: string; salesCoins: number; bonusCoins: number };
  gifts?: AgentGift[];
}

export interface BankAccount {
  id: string;
  accountHolderName: string;
  /** Legacy plaintext value; new writes keep only ciphertext + last four digits. */
  accountNumber?: string;
  /** AES-256-GCM ciphertext written by the payout-details service. */
  accountNumberEnc?: string;
  accountNumberLast4?: string;
  /** Server-derived mask included in API responses. */
  maskedAccountNumber?: string;
  ifscCode: string;
  bankName: string;
  isDefault?: boolean;
  verified?: boolean;
  addedAt?: string;
  status?: "VERIFIED" | "PENDING_REVIEW";
  pendingUpdate?: {
    accountHolderName: string;
    accountNumber?: string;
    accountNumberEnc?: string;
    accountNumberLast4?: string;
    maskedAccountNumber?: string;
    ifscCode: string;
    bankName: string;
    requestedAt: string;
  };
}

/**
 * Reward configuration. Every value describes coins or a rate — never a rupee
 * price. Product prices stay in `Product.price` and order money stays in INR.
 */
export interface RewardRulesConfig {
  dailyClaimPercent: number; // Daily share of pending cashback coins released to the live wallet
  minWithdrawalCoins: number; // Smallest payout request, in coins
  referralCommissionPercent: number; // Referral reward rate applied to the referred order's INR amount
  /** Approved agents use this rate instead of the standard referral rate. */
  agentCommissionPercent?: number;
  /** Monthly agent milestone ladder. Empty or missing falls back to DEFAULT_AGENT_SLABS. */
  agentSlabs?: AgentSlabConfig[];
  withdrawalTaxPercent: number; // Withdrawal tax / TDS / processing fee percentage (0-100%, e.g. 5%)
  /** GST / tax percentage added to prepaid (non-COD) order totals. 0 disables it. */
  orderTaxPercent?: number;
  shippingCharge?: number; // Manual shipping fee in INR (0 = free shipping)
  shippingMode?: "ALL_PRODUCTS" | "MIN_AMOUNT"; // "ALL_PRODUCTS" = apply on every order; "MIN_AMOUNT" = free above freeShippingMinAmount
  freeShippingMinAmount?: number; // Minimum order amount in INR for free shipping when shippingMode === "MIN_AMOUNT"
}

export interface ReferralRewardClaim {
  id: string;
  milestoneId: "IPHONE_17_PRO_MAX";
  milestoneTitle: string;
  targetCount: number;
  recipientName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  claimedAt: string;
  status: "PENDING_DISPATCH" | "DISPATCHED" | "DELIVERED";
  trackingNumber?: string;
}

export interface ReferralMilestoneConfig {
  id: "IPHONE_17_PRO_MAX";
  targetCount: number; // 100
  title: string;
  subtitle: string;
  marketValue: number;
  badge: string;
  accent: "cyan" | "emerald";
  features: string[];
}

export const REFERRAL_MILESTONES: ReferralMilestoneConfig[] = [
  {
    id: "IPHONE_17_PRO_MAX",
    targetCount: 100,
    title: "Apple iPhone 17 Pro Max",
    subtitle: "Flagship Titanium Edition 256GB with A19 Pro Bionic & ProMotion Display",
    marketValue: 159900,
    badge: "100 FRIEND ORDERS",
    accent: "emerald",
    features: [
      "Aerospace-Grade Titanium Finish",
      "Next-Gen A19 Pro Bionic High Performance",
      "256GB High-Speed Storage",
      "100% Free on 100 Friend Purchases",
    ],
  },
];

export interface CustomerAddress {
  label: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export interface CustomerAccount {
  id: string;
  name: string;
  email?: string;
  phone: string;
  password?: string;
  /** Server-computed flag; the hash itself never leaves the backend. */
  hasPassword?: boolean;
  referralCode: string;
  referredByCode?: string;
  /** Server-resolved display name of the member whose code referred this account. */
  referredByName?: string;
  availableCoins: number; // Cashback coins available to withdraw
  pendingCoins: number; // Cashback coins still vesting
  /** Referral reward balance, in coins. Always separate from cashback coins. */
  referralCoinBalance: number;
  lifetimeEarnedCoins: number;
  tier: "Silver" | "Gold" | "Platinum" | "VIP" | string;
  addresses: CustomerAddress[];
  bankAccounts?: BankAccount[];
  savedUpiId?: string;
  upiStatus?: "VERIFIED" | "PENDING_REVIEW";
  /** Missing = locked by admin. Only an explicit false unlocks UPI withdrawals. */
  upiWithdrawalLocked?: boolean;
  pendingUpiId?: string;
  pendingUpiRequestedAt?: string;
  lastDailyClaimDate?: string; // YYYY-MM-DD in Asia/Kolkata
  /** Per-product/per-order daily claim records: key can be productId or orderId, value is YYYY-MM-DD */
  productDailyClaims?: Record<string, string>;
  claimedReferralRewards?: ReferralRewardClaim[];
  /** Agent programme state; absent means the member never applied. */
  agent?: AgentProfile;
  notifications?: any[];
}

export const INITIAL_REWARD_RULES: RewardRulesConfig = {
  dailyClaimPercent: 3,
  minWithdrawalCoins: 500,
  referralCommissionPercent: 10,
  agentCommissionPercent: 10,
  agentSlabs: DEFAULT_AGENT_SLABS,
  withdrawalTaxPercent: 0,
  orderTaxPercent: 0,
  shippingCharge: 79,
  shippingMode: "MIN_AMOUNT",
  freeShippingMinAmount: 1299,
};

export const INITIAL_CUSTOMER: CustomerAccount = {
  id: "usr_aman_01",
  name: "Aman Sharma",
  email: "aman.sharma@example.com",
  phone: "+91 98765 43210",
  password: "Password123!",
  referralCode: "SKYWARE-AMAN99",
  availableCoins: 1000,
  pendingCoins: 2000,
  referralCoinBalance: 0,
  lifetimeEarnedCoins: 3000,
  tier: "Gold",
  addresses: [
    {
      label: "Home",
      street: "Flat 402, Skyline Residency, Linking Road, Bandra West",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400050",
      isDefault: true,
    },
    {
      label: "Studio / Office",
      street: "WeWork Enam Sambhav, BKC G Block",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400051",
      isDefault: false,
    }
  ],
  bankAccounts: [
    {
      id: "bnk-01",
      accountHolderName: "Aman Sharma",
      accountNumber: "918273645019",
      ifscCode: "HDFC0001234",
      bankName: "HDFC Bank (Bandra West)",
      isDefault: true,
      verified: true,
      addedAt: "2026-10-15T10:00:00Z",
    }
  ]
};

export const INITIAL_TRANSACTIONS: WalletTransaction[] = [
  {
    id: "tx-101",
    type: "CASHBACK",
    coins: 80,
    unit: "COINS",
    description: "Cashback on Streetwear Order #TC-84920",
    orderNumber: "TC-84920",
    date: "12 Oct 2026, 04:20 PM",
    status: "COMPLETED",
  },
  {
    id: "tx-102",
    type: "REFERRAL_COMMISSION",
    coins: 150,
    unit: "COINS",
    description: "Referral reward from Rohan K. (Order #TC-83110)",
    orderNumber: "TC-83110",
    date: "09 Oct 2026, 01:15 PM",
    status: "COMPLETED",
  },
  {
    id: "tx-103",
    type: "REDEMPTION",
    coins: -200,
    unit: "COINS",
    description: "Coins redeemed at checkout on #TC-79402 (legacy)",
    orderNumber: "TC-79402",
    date: "28 Sep 2026, 07:45 PM",
    status: "COMPLETED",
  },
  {
    id: "tx-104",
    type: "CASHBACK",
    coins: 100,
    unit: "COINS",
    description: "Promotional cashback on 240 GSM Oversized Drop",
    orderNumber: "TC-75210",
    date: "15 Sep 2026, 11:30 AM",
    status: "COMPLETED",
  },
  {
    id: "tx-105",
    type: "ADMIN_ADJUSTMENT",
    coins: 200,
    unit: "COINS",
    description: "Early member welcome bonus",
    date: "01 Sep 2026, 10:00 AM",
    status: "COMPLETED",
  },
];

export const INITIAL_REFERRALS: ReferralLead[] = [
  {
    id: "ref-1",
    referrerId: "usr_aman_01",
    referrerCode: "SKYWARE-AMAN99",
    friendName: "Rohan Kapoor",
    friendPhone: "+91 98201 23456",
    friendEmail: "rohan.k@gmail.com",
    dateJoined: "08 Oct 2026",
    orderNumber: "TC-83110",
    orderAmountInr: 1599,
    commissionCoins: 159.9,
    status: "PAID",
  },
  {
    id: "ref-2",
    referrerId: "usr_aman_01",
    referrerCode: "SKYWARE-AMAN99",
    friendName: "Priya Varma",
    friendPhone: "+91 98112 34567",
    friendEmail: "priya.v@outlook.com",
    dateJoined: "11 Oct 2026",
    orderNumber: "TC-84905",
    orderAmountInr: 899,
    commissionCoins: 89.9,
    status: "APPROVED",
  },
  {
    id: "ref-3",
    referrerId: "usr_aman_01",
    referrerCode: "SKYWARE-AMAN99",
    friendName: "Sameer Joshi",
    friendPhone: "+91 99345 67890",
    friendEmail: "sameer.j@gmail.com",
    dateJoined: "13 Oct 2026",
    orderNumber: "TC-85012",
    orderAmountInr: 799,
    commissionCoins: 79.9,
    status: "PENDING",
  },
  {
    id: "ref-4",
    referrerId: "usr_aman_01",
    referrerCode: "SKYWARE-AMAN99",
    friendName: "Ananya Mehta",
    friendPhone: "+91 97654 32109",
    friendEmail: "ananya.m@yahoo.com",
    dateJoined: "14 Oct 2026",
    commissionCoins: 0,
    status: "PENDING",
  },
];

/**
 * Referral reward in coins. The referred order's eligible INR amount is
 * multiplied by the referral percentage and the result becomes coins — it is
 * never converted with a coin-to-rupee rate.
 *
 * ₹4,599 eligible × 10% = 459.90 Referral Coins.
 */
export function referralCoinsFor(orderAmountInr: number, referralPercent: number): number {
  const amount = Math.max(0, Number(orderAmountInr) || 0);
  const percent = Math.max(0, Number(referralPercent) || 0);
  return Number(((amount * percent) / 100).toFixed(2));
}

/** Approved agents earn the agent rate; everyone else stays on the standard referral rate. */
export function agentCommissionRateFor(
  rules: Partial<RewardRulesConfig> | null | undefined,
  customer: Pick<CustomerAccount, "agent"> | null | undefined
): number {
  const standard = Math.max(0, Number(rules?.referralCommissionPercent) || 0);
  if (customer?.agent?.status !== "APPROVED") return standard;
  const agentRate = Number(rules?.agentCommissionPercent);
  return Number.isFinite(agentRate) && agentRate > 0 ? agentRate : standard;
}

/** Ladder order matters: bonuses are granted bottom-up as monthly sales climb. */
export function agentSlabsFor(rules: Partial<RewardRulesConfig> | null | undefined): AgentSlabConfig[] {
  const configured = (rules?.agentSlabs ?? []).filter((slab) => Number(slab?.targetCoins) > 0);
  const slabs = configured.length ? configured : DEFAULT_AGENT_SLABS;
  return [...slabs].sort((a, b) => a.targetCoins - b.targetCoins);
}

/** Calendar month in Asia/Kolkata, e.g. 2026-11. */
export function agentPeriodKey(at: string | Date = new Date()): string {
  const date = typeof at === "string" ? new Date(at) : at;
  const iso = Number.isNaN(date.getTime()) ? new Date() : date;
  return iso.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);
}

/** This month's referred-sales coins, with stale periods reading as zero. */
export function agentMonthlySalesCoins(
  customer: Pick<CustomerAccount, "agent"> | null | undefined,
  period: string = agentPeriodKey()
): number {
  const progress = customer?.agent?.monthlyProgress;
  if (!progress || progress.period !== period) return 0;
  return Math.max(0, Number(progress.salesCoins) || 0);
}

export function agentNextSlabFor(
  rules: Partial<RewardRulesConfig> | null | undefined,
  salesCoins: number
): AgentSlabConfig | null {
  return agentSlabsFor(rules).find((slab) => slab.targetCoins > salesCoins) ?? null;
}

export interface WithdrawalTranche {
  week: number;
  percent: number;
  coins: number;
  /** Historical display only — never used for balances or conversion. */
  legacyInrAmount?: number;
  dueAt: string;
  dueDate: string;
  status: "LOCKED" | "UNLOCKED" | "TRANSFERRED" | "VOID";
  transferredAt?: string;
  upiRef?: string;
}

export interface WithdrawalRequest {
  id: string;
  customerId: string;
  customerName: string;
  phone: string;
  upiId: string;
  payoutMethod: "UPI" | "BANK";
  bankAccount?: string;
  bankIfsc?: string;
  bankName?: string;
  accountHolderName?: string;
  /** Total gross payout request, in coins. Never a rupee amount. */
  totalCoins: number;
  /** Tax / TDS percentage applied to this withdrawal. */
  taxPercent?: number;
  /** Coins withheld as tax / TDS deduction. */
  taxCoins?: number;
  /** Net coins payable to member after tax deduction. */
  netPayableCoins?: number;
  coins?: number;
  /** Historical display only — never used for balances or conversion. */
  legacyInrTotal?: number;
  legacyInrAmount?: number;
  sourceType?: "REFERRAL_COINS" | "CASHBACK_COINS";
  requestedAt: string;
  purchaseOrderNumber: string;
  anchorDate: string;
  tranches: WithdrawalTranche[];
  overallStatus:
    | "PENDING"
    | "UNDER_REVIEW"
    | "PROCESSING"
    | "SUBMITTED_TO_BANK"
    | "PAID"
    | "REJECTED"
    | "FAILED"
    | "REVERSED"
    | "VESTING_IN_PROGRESS"
    | "COMPLETED";
  rejectionReason?: string;
  adminRemarks?: string;
  transactionRefNumber?: string;
}

export const INITIAL_WITHDRAWAL_REQUESTS: WithdrawalRequest[] = [
  {
    id: "WTH-8901",
    customerId: "cust-01",
    customerName: "Aman Sharma",
    phone: "+91 98765 43210",
    upiId: "aman.sharma@okaxis",
    payoutMethod: "UPI",
    totalCoins: 200,
    requestedAt: "10 Oct 2026",
    purchaseOrderNumber: "ORD-8491",
    anchorDate: "3 Oct 2026 (7 Days ago)",
    overallStatus: "VESTING_IN_PROGRESS",
    tranches: [
      {
        week: 1,
        percent: 25,
        coins: 50,
        dueAt: "2026-10-10T00:00:00Z",
        dueDate: "Week 1 (Day 7) • 10 Oct 2026",
        status: "TRANSFERRED",
        transferredAt: "10 Oct 2026, 04:30 PM",
        upiRef: "UPI-AXIS-94820194",
      },
      {
        week: 2,
        percent: 25,
        coins: 50,
        dueAt: "2026-10-17T00:00:00Z",
        dueDate: "Week 2 (Day 14) • 17 Oct 2026",
        status: "UNLOCKED",
      },
      {
        week: 3,
        percent: 25,
        coins: 50,
        dueAt: "2026-10-24T00:00:00Z",
        dueDate: "Week 3 (Day 21) • 24 Oct 2026",
        status: "LOCKED",
      },
      {
        week: 4,
        percent: 25,
        coins: 50,
        dueAt: "2026-10-31T00:00:00Z",
        dueDate: "Week 4 (Day 28) • 31 Oct 2026",
        status: "LOCKED",
      },
    ],
  },
  {
    id: "WTH-8850",
    customerId: "cust-02",
    customerName: "Pooja Verma",
    phone: "+91 98221 00998",
    upiId: "pooja.v@paytm",
    payoutMethod: "UPI",
    totalCoins: 400,
    requestedAt: "08 Oct 2026",
    purchaseOrderNumber: "ORD-8302",
    anchorDate: "1 Oct 2026 (7 Days ago)",
    overallStatus: "VESTING_IN_PROGRESS",
    tranches: [
      {
        week: 1,
        percent: 25,
        coins: 100,
        dueAt: "2026-10-08T00:00:00Z",
        dueDate: "Week 1 (Day 7) • 8 Oct 2026",
        status: "TRANSFERRED",
        transferredAt: "08 Oct 2026, 02:15 PM",
        upiRef: "UPI-PAYTM-74829104",
      },
      {
        week: 2,
        percent: 25,
        coins: 100,
        dueAt: "2026-10-15T00:00:00Z",
        dueDate: "Week 2 (Day 14) • 15 Oct 2026",
        status: "UNLOCKED",
      },
      {
        week: 3,
        percent: 25,
        coins: 100,
        dueAt: "2026-10-22T00:00:00Z",
        dueDate: "Week 3 (Day 21) • 22 Oct 2026",
        status: "LOCKED",
      },
      {
        week: 4,
        percent: 25,
        coins: 100,
        dueAt: "2026-10-29T00:00:00Z",
        dueDate: "Week 4 (Day 28) • 29 Oct 2026",
        status: "LOCKED",
      },
    ],
  },
];
