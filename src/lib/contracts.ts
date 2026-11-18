import type { Product } from "@/data/products";
import type {
  CustomerAccount,
  ReferralLead,
  RewardRulesConfig,
  WalletTransaction,
  WithdrawalRequest,
} from "@/data/rewardsEngine";
import type {
  AuditLogEntry,
  CourierPartner,
  Coupon,
  OrderStatus,
  PaymentMethod,
  ShopOrder,
  QikinkConfig,
  ZeninNotification,
  ManualUpiConfig,
  GatewaysConfig,
} from "@/lib/domain";
import type { SupportConfig } from "@/lib/support";

export interface ReferralLeaderboardEntry {
  rank: number;
  name: string;
  coins: number;
  members: number;
  isYou: boolean;
}

export interface StorefrontSnapshot {
  products: Product[];
  rewardRules: RewardRulesConfig;
  support: SupportConfig;
  manualUpi?: ManualUpiConfig;
  gateways?: GatewaysConfig;
  qikink?: QikinkConfig;
  customer: CustomerAccount | null;
  coupons: Coupon[];
  transactions: WalletTransaction[];
  referrals: ReferralLead[];
  topReferrers?: ReferralLeaderboardEntry[];
  withdrawals: WithdrawalRequest[];
  orders: ShopOrder[];
  notifications?: ZeninNotification[];
  deliveryFee: number;
  freeShippingThreshold: number;
  shippingMode?: "ALL_PRODUCTS" | "MIN_AMOUNT";
  minWithdrawalCoins: number;
}

/** What the public help centre reads: the contact desk plus the reward numbers its FAQ quotes. */
export interface SupportCentre {
  support: SupportConfig;
  rewardRules: RewardRulesConfig;
  deliveryFee: number;
  freeShippingThreshold: number;
  shippingMode?: "ALL_PRODUCTS" | "MIN_AMOUNT";
  minWithdrawalCoins: number;
}

export interface AdminMetrics {
  grossRevenue: number;
  orderCount: number;
  coinsInCirculation: number;
  paidOutCoins: number;
  pendingPayableCoins: number;
  pipelineCount: number;
  giftCount: number;
  statusCounts: Record<string, number>;
}

export interface AdminOverview {
  products: Product[];
  orders: ShopOrder[];
  withdrawals: WithdrawalRequest[];
  transactions: WalletTransaction[];
  referrals: ReferralLead[];
  rewardRules: RewardRulesConfig;
  support: SupportConfig;
  manualUpi?: ManualUpiConfig;
  gateways?: GatewaysConfig;
  qikink?: QikinkConfig;
  auditLogs: AuditLogEntry[];
  customers: CustomerAccount[];
  metrics: AdminMetrics;
  couriers: readonly CourierPartner[];
  orderFlow: OrderStatus[];
  /** Smallest payout the server will accept, in coins. */
  minWithdrawalCoins: number;
  /** Which member this browser's storefront cookie is currently signed in as. */
  storefrontCustomerId: string | null;
}

export interface AdminCustomerPatch {
  name?: string;
  phone?: string;
  email?: string;
  tier?: CustomerAccount["tier"];
  availableCoins?: number;
  pendingCoins?: number;
}

export interface AdminCustomerUpdateResult {
  customer: CustomerAccount;
  transaction?: WalletTransaction;
}

export interface CartLinePayload {
  productId?: string;
  title: string;
  price: number;
  quantity: number;
  size: string;
  colorName: string;
  graphicSvgType?: string;
}

export interface PlaceOrderInput {
  items: CartLinePayload[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  paymentMethod: PaymentMethod;
  couponCode?: string;
  referralCode?: string;
  gatewayFee?: number;
  gatewayProvider?: "razorpay" | "ownpay" | "manual_upi";
}

export type QuoteInput = Pick<PlaceOrderInput, "items" | "couponCode"> & {
  paymentMethod?: PaymentMethod;
  gatewayProvider?: "razorpay" | "ownpay" | "manual_upi";
};

export interface RazorpaySessionInput extends QuoteInput {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

export interface RazorpaySessionResult {
  keyId: string;
  orderId: string;
  amountInPaise: number;
  currency: "INR";
  receipt: string;
  prefill: { name: string; email: string; contact: string };
}

export interface RazorpayVerifyInput extends PlaceOrderInput {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface OwnPaySessionInput extends QuoteInput {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

export interface OwnPaySessionResult {
  paymentId: string;
  reference: string;
  /** Checkout amount in INR. */
  amountInr: number;
  currency: string;
  checkoutUrl: string;
  isSimulated?: boolean;
}

export interface OwnPayVerifyInput extends PlaceOrderInput {
  ownpayPaymentId: string;
  ownpayReference: string;
}

export interface QuoteResult {
  subtotal: number;
  couponDiscount: number;
  deliveryFee: number;
  shippingMode?: "ALL_PRODUCTS" | "MIN_AMOUNT";
  freeShippingThreshold?: number;
  baseDeliveryFee?: number;
  gatewayFee?: number;
  gatewayFeeLabel?: string;
  gatewayFeeHidden?: boolean;
  /** Prepaid-order tax percentage and its INR amount; both 0 for COD/cart quotes. */
  taxPercent?: number;
  taxAmount?: number;
  /** Checkout total, in INR. Coin balances never reduce this. */
  total: number;
  /** Cashback promised for this order, in coins. */
  cashbackCoins: number;
  couponLabel?: string;
  codAvailable: boolean;
  codBlockedTitles: string[];
}

export interface OrderResult {
  order: ShopOrder;
  quote: QuoteResult;
}

export interface FreeTshirtInput {
  recipientName: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  productId: string;
  size: string;
  color: string;
  quantity?: number;
  reason: string;
}

export interface WithdrawalInput {
  /** Withdrawal amount in coins. No rupee amount is accepted or derived. */
  coins: number;
  sourceType: "REFERRAL_COINS" | "CASHBACK_COINS";
  upiId?: string;
  payoutMethod: "UPI" | "BANK";
  bankAccount?: string;
  bankIfsc?: string;
  /** Use the member's saved bank account instead of re-sending its number. */
  bankAccountId?: string;
}

/** The admin raising a payout on a member's behalf — same fields, plus whose wallet. */
export interface AdminRaiseWithdrawalInput extends WithdrawalInput {
  customerId: string;
}

/** Payout desk edits — only the fields needed to route the money correctly. */
export interface AdminWithdrawalPatch {
  customerName?: string;
  phone?: string;
  upiId?: string;
  payoutMethod?: "UPI" | "BANK";
  bankAccount?: string;
  bankIfsc?: string;
}

export interface PayoutInput {
  /** Release one tranche. */
  week?: number;
  /** Release every tranche that has already unlocked. */
  all?: boolean;
  /** UPI/bank reference from the payment app; auto-generated when omitted. */
  reference?: string;
}

export interface RejectWithdrawalInput {
  /** Why the payout desk turned this request down; shown to the customer. */
  reason?: string;
}

export interface TrackingResult {
  order: ShopOrder;
  eta: string;
  supportContact: string;
}
