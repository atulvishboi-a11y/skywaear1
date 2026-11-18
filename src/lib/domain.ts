export type OrderStatus =
  | "PENDING"
  | "APPROVED"
  | "PRINTING_POD"
  | "MANIFEST_GENERATED"
  | "SHIPPED"
  | "LOCAL_AREA"
  | "DELIVERED"
  | "CANCELLED";

export const ORDER_FLOW: OrderStatus[] = [
  "PENDING",
  "APPROVED",
  "PRINTING_POD",
  "MANIFEST_GENERATED",
  "SHIPPED",
  "LOCAL_AREA",
  "DELIVERED",
];

export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["APPROVED", "CANCELLED"],
  APPROVED: ["PRINTING_POD", "CANCELLED"],
  PRINTING_POD: ["MANIFEST_GENERATED", "CANCELLED"],
  MANIFEST_GENERATED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["LOCAL_AREA", "DELIVERED", "CANCELLED"],
  LOCAL_AREA: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export const COURIER_PARTNERS = [
  "Blue Dart Air",
  "Delhivery Air",
  "ATS (Amazon)",
  "Ekart",
  "Blue Dart Surface",
  "Delhivery Surface",
  "BlueDart",
  "Delhivery",
  "DTDC",
  "Ecom Express",
] as const;
export type CourierPartner = (typeof COURIER_PARTNERS)[number];

export interface CourierRecommendation {
  priority: number;
  courier: CourierPartner;
  transitType: "Air Express" | "Surface Express";
  estimatedTransit: string;
  badge: string;
  trackingBaseUrl: string;
}

export const COURIER_RECOMMENDATIONS: CourierRecommendation[] = [
  {
    priority: 1,
    courier: "Blue Dart Air",
    transitType: "Air Express",
    estimatedTransit: "24 - 48 Hours",
    badge: "RECOMMENDED #1",
    trackingBaseUrl: "https://www.bluedart.com/tracking?trackFor=0&trackNo=",
  },
  {
    priority: 2,
    courier: "Delhivery Air",
    transitType: "Air Express",
    estimatedTransit: "48 - 72 Hours",
    badge: "EXPRESS AIR",
    trackingBaseUrl: "https://www.delhivery.com/track/package/",
  },
  {
    priority: 3,
    courier: "ATS (Amazon)",
    transitType: "Air Express",
    estimatedTransit: "2 - 3 Days",
    badge: "AMAZON LOGISTICS",
    trackingBaseUrl: "https://track.amazon.in/tracking/",
  },
  {
    priority: 4,
    courier: "Ekart",
    transitType: "Surface Express",
    estimatedTransit: "3 - 4 Days",
    badge: "RELIABLE GROUND",
    trackingBaseUrl: "https://ekartlogistics.com/shipmenttrack/",
  },
  {
    priority: 5,
    courier: "Blue Dart Surface",
    transitType: "Surface Express",
    estimatedTransit: "4 - 5 Days",
    badge: "HEAVYWEIGHT SURFACE",
    trackingBaseUrl: "https://www.bluedart.com/tracking?trackFor=0&trackNo=",
  },
  {
    priority: 6,
    courier: "Delhivery Surface",
    transitType: "Surface Express",
    estimatedTransit: "5 - 6 Days",
    badge: "ECONOMY SURFACE",
    trackingBaseUrl: "https://www.delhivery.com/track/package/",
  },
];

export function getCourierTrackingUrl(courier: string | undefined, trackingNumber: string | undefined): string {
  if (!trackingNumber) return "";
  const cleanTrack = trackingNumber.trim();
  const c = courier?.toLowerCase() || "";
  if (c.includes("blue dart") || c.includes("bluedart")) {
    return `https://www.bluedart.com/tracking?trackFor=0&trackNo=${encodeURIComponent(cleanTrack)}`;
  }
  if (c.includes("delhivery")) {
    return `https://www.delhivery.com/track/package/${encodeURIComponent(cleanTrack)}`;
  }
  if (c.includes("ats") || c.includes("amazon")) {
    return `https://track.amazon.in/tracking/${encodeURIComponent(cleanTrack)}`;
  }
  if (c.includes("ekart")) {
    return `https://ekartlogistics.com/shipmenttrack/${encodeURIComponent(cleanTrack)}`;
  }
  return `https://www.bluedart.com/tracking?trackFor=0&trackNo=${encodeURIComponent(cleanTrack)}`;
}

export type PaymentMethod = "UPI" | "CARD" | "NETBANKING" | "COD" | "COMPLIMENTARY" | "MANUAL_UPI" | "COINS";
export type PaymentStatus = "PAID" | "PENDING" | "PENDING_VERIFICATION" | "REFUNDED" | "REJECTED";
export type OrderKind = "SALE" | "GIFT" | "REPLACEMENT";

export interface ManualUpiConfig {
  enabled: boolean;
  upiId: string;
  merchantName: string;
  instructions: string;
  autoReconciliationEnabled?: boolean;
  updatedAt?: string;
}

export interface GatewayFeeConfig {
  enabled: boolean;
  percent: number; // e.g. 2.0 (for 2%)
  flatAmount: number; // e.g. 20 (for ₹20 flat)
  hideBreakdownOnCheckout?: boolean; // if true, hides "+2% fee" breakdown line and quietly includes in total
  customLabel?: string; // e.g. "Payment Processing Fee" or "Convenience Fee"
}

export interface GatewaysConfig {
  razorpayEnabled: boolean;
  razorpayMode?: "test" | "live";
  ownpayEnabled: boolean;
  manualUpiEnabled: boolean;
  codEnabled: boolean;
  razorpayFee?: GatewayFeeConfig;
  ownpayFee?: GatewayFeeConfig;
  manualUpiFee?: GatewayFeeConfig;
  codFee?: GatewayFeeConfig;
  updatedAt?: string;
}

export interface QikinkConfig {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  masterSku: string;
  autoPushOnApproved?: boolean;
  updatedAt?: string;
}

export interface OrderLine {
  title: string;
  size: string;
  color: string;
  quantity: number;
  price: number;
  graphicSvgType?: string;
}

export interface TimelineEvent {
  label: string;
  at: string;
  note: string;
}

/**
 * One daily slice of the cashback coins earned by an order. Vesting is tracked
 * purely in coins; no rupee amount is derived or stored.
 */
export interface CashbackTranche {
  week: number;
  percent: number;
  coins: number;
  dueAt: string;
  dueDate: string;
  status: "LOCKED" | "UNLOCKED" | "RELEASED" | "VOID";
  releasedAt?: string;
}

export interface ShopOrder {
  id: string;
  orderNumber: string;
  kind: OrderKind;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  items: OrderLine[];
  subtotal: number;
  couponCode?: string;
  discount: number;
  /** Legacy only — coin discounts are no longer offered at checkout. */
  legacyCoinsRedeemed?: number;
  /** Legacy only — the old rupee value of `legacyCoinsRedeemed`. */
  legacyInrRedeemed?: number;
  /** Cashback promised by this order, in coins. Never money. */
  cashbackCoins: number;
  cashback?: CashbackTranche[];
  /** Referral reward earned by the referrer on this order, in coins. */
  referralCoinsEarned: number;
  referrerCode?: string;
  /** Set once the referral reward has been credited, making the credit idempotent. */
  referralCoinsCreditedAt?: string;
  deliveryFee: number;
  gatewayFee?: number;
  /** Tax snapshot taken at checkout; absent on orders placed before tax was configured. */
  taxPercent?: number;
  taxAmount?: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  gateway?: string;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  status: OrderStatus;
  courier?: CourierPartner;
  trackingNumber?: string;
  trackingUrl?: string;
  updatedAt?: string;
  podProvider: string;
  podOrderId?: string;
  podStatus?: string;
  giftReason?: string;
  placedAt: string;
  timeline: TimelineEvent[];
  manualUpiSnapshot?: {
    upiId: string;
    merchantName: string;
    amount: number;
    instructions?: string;
  };
  utr?: string;
  utrSubmittedAt?: string;
  paymentScreenshot?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  earningsReversedAt?: string;
}

export type TeamStatus = "ACTIVE" | "INACTIVE";

export type TeamPermission =
  | "MANAGE_MEMBERS"
  | "VIEW_TEAM_ORDERS"
  | "VIEW_TEAM_METRICS"
  | "MANAGE_TEAM_LEADS"
  | "APPROVE_WITHDRAWALS_PREVIEW";

export interface TeamMemberRef {
  customerId: string;
  name: string;
  email?: string;
  phone?: string;
  role: "LEADER" | "MEMBER";
  joinedAt: string;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  leaderId: string;
  leaderName: string;
  status: TeamStatus;
  permissions: TeamPermission[];
  members: TeamMemberRef[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  details: string;
  at: string;
}

export type CouponKind = "percent" | "flat" | "shipping";

export interface Coupon {
  code: string;
  kind: CouponKind;
  value: number;
  minOrder: number;
  label: string;
}

export const COUPONS: Coupon[] = [];

export const DELIVERY_FEE = 79;
export const FREE_SHIPPING_THRESHOLD = 1299;

export function findCoupon(code?: string | null): Coupon | undefined {
  if (!code) return undefined;
  const clean = code.trim().toUpperCase();
  if (!clean) return undefined;

  return COUPONS.find((c) => c.code === clean);
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

export function formatRupees(amount: number): string {
  const fractionDigits = Number.isInteger(amount) ? 0 : 2;
  return (
    "₹" +
    amount.toLocaleString("en-IN", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
  );
}

export function formatPaise(amountInRupees: number, points?: number): string {
  const paise = points !== undefined ? Math.abs(Math.round(points)) : Math.abs(Math.round((amountInRupees || 0) * 100));
  return `${paise} Paise`;
}

export function formatRupeesOrPaise(amount: number): string {
  if (Math.abs(amount) > 0 && Math.abs(amount) < 1) {
    const paise = Math.round(amount * 100);
    return `${paise} Paise`;
  }
  return formatRupees(amount);
}

export function formatCoins(coins: number): string {
  const rounded = Math.max(0, Math.round(coins || 0));
  return `${rounded.toLocaleString("en-IN")} coins`;
}

export function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
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

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export type NotificationChannel = "IN_APP" | "WHATSAPP" | "SMS" | "EMAIL" | "WEB_PUSH";

export interface WebPushSubscription {
  id: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  customerId?: string;
  userAgent?: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

export interface ZeninNotification {
  id: string;
  customerId: string;
  type: "CASHBACK_UNLOCKED" | "WITHDRAWAL_UPDATE" | "ORDER_UPDATE" | "SYSTEM";
  title: string;
  message: string;
  channels: NotificationChannel[];
  channelStatus: {
    inApp: "DELIVERED" | "READ";
    whatsapp: "PREPARED" | "SENT";
    sms: "PREPARED" | "SENT";
    email: "PREPARED" | "SENT";
  };
  whatsappUrl?: string;
  emailContent?: { subject: string; html: string; text: string };
  smsContent?: string;
  createdAt: string;
  read: boolean;
  metadata?: {
    orderNumber?: string;
    week?: number;
    points?: number;
    legacyInrAmount?: number;
    [key: string]: unknown;
  };
}

export interface ProductReview {
  id: string;
  productId: string;
  authorName: string;
  rating: number; // 1 to 5
  title?: string;
  comment: string;
  verifiedPurchase: boolean;
  sizePurchased?: string;
  imageUrl?: string;
  createdAt: string;
}

export interface SupportChatMessage {
  id: string;
  sender: "USER" | "BOT" | "ADMIN";
  senderName: string;
  text: string;
  timestamp: string;
  quickActions?: { label: string; payload: string }[];
  orderPreview?: {
    orderNumber: string;
    total: number;
    status: string;
    trackingUrl?: string;
    courier?: string;
    itemsCount: number;
  };
}

export interface SupportChatThread {
  id: string;
  sessionId: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  status: "BOT" | "WAITING_FOR_ADMIN" | "ADMIN_REPLIED" | "RESOLVED";
  messages: SupportChatMessage[];
  unreadByAdmin: boolean;
  unreadByUser: boolean;
  lastMessageAt: string;
  createdAt: string;
}


