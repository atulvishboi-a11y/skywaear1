import type {
  RewardRulesConfig,
  CustomerAccount,
  CustomerAddress,
  BankAccount,
  WithdrawalRequest,
  WithdrawalTranche,
} from "@/data/rewardsEngine";
import type { OrderStatus, CourierPartner, ShopOrder, ZeninNotification, ManualUpiConfig, GatewaysConfig, ProductReview, QikinkConfig, Team, TeamPermission, TeamStatus, SupportChatMessage, SupportChatThread } from "@/lib/domain";
import type { Product } from "@/data/products";
import type {
  AdminCustomerPatch,
  AdminCustomerUpdateResult,
  AdminOverview,
  AdminRaiseWithdrawalInput,
  AdminWithdrawalPatch,
  FreeTshirtInput,
  OrderResult,
  PayoutInput,
  PlaceOrderInput,
  QuoteInput,
  QuoteResult,
  RazorpaySessionInput,
  RazorpaySessionResult,
  RazorpayVerifyInput,
  OwnPaySessionInput,
  OwnPaySessionResult,
  OwnPayVerifyInput,
  StorefrontSnapshot,
  SupportCentre,
  TrackingResult,
  WithdrawalInput,
} from "@/lib/contracts";
import type { SupportConfig } from "@/lib/support";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) {
    if (response.status === 413) {
      throw new Error(payload?.error ?? "Image or payload size is too large (Vercel limit 4.5 MB). Image has been automatically compressed.");
    }
    throw new Error(payload?.error ?? `Request failed with status ${response.status}`);
  }
  return payload as T;
}

const post = <T,>(url: string, body: unknown) =>
  call<T>(url, { method: "POST", body: JSON.stringify(body) });

/**
 * Last overview ETag plus the payload it describes. The admin console polls this endpoint;
 * sending the tag back turns an unchanged poll into a bodyless 304. The cached payload is
 * replayed on 304 so a remounted console still gets its snapshot instead of an empty state.
 */
let adminOverviewEtag: string | null = null;
let adminOverviewCache: AdminOverview | null = null;

async function fetchAdminOverview(): Promise<AdminOverview | null> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (adminOverviewEtag) headers["If-None-Match"] = adminOverviewEtag;

  const response = await fetch("/api/admin/overview", {
    credentials: "include",
    cache: "no-store",
    headers,
  });

  if (response.status === 304) return adminOverviewCache;

  const payload = (await response.json().catch(() => null)) as
    | (AdminOverview & { error?: string })
    | null;

  if (!response.ok || !payload) {
    if (response.status === 401) {
      adminOverviewEtag = null;
      adminOverviewCache = null;
    }
    throw new Error(payload?.error ?? `Request failed with status ${response.status}`);
  }

  adminOverviewEtag = response.headers.get("ETag");
  adminOverviewCache = payload;
  return payload;
}

export interface AddressPayload {
  label?: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}

type AddressResult = { customer: CustomerAccount; addresses: CustomerAddress[] };

export const api = {
  storefront: () => call<StorefrontSnapshot>("/api/storefront", { cache: "no-store" }),

  support: () => call<SupportCentre>("/api/support", { cache: "no-store" }),

  chat: {
    getThread: (sessionId: string) =>
      call<{ thread: SupportChatThread }>(`/api/support/chat?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" }),
    sendMessage: (body: { sessionId: string; message: string; customerName?: string; customerPhone?: string; customerEmail?: string }) =>
      post<{ thread: SupportChatThread; botReply?: SupportChatMessage }>("/api/support/chat", body),
  },

  notifications: {
    list: () => call<{ notifications: ZeninNotification[] }>("/api/notifications", { cache: "no-store" }),
    markRead: (id: string) => post<{ success: boolean; notification: ZeninNotification | null }>(`/api/notifications/${encodeURIComponent(id)}/read`, {}),
    markAllRead: () => post<{ success: boolean; count: number }>("/api/notifications", { all: true }),
    preview: (params?: { week?: number; orderNumber?: string; amount?: number; points?: number }) => {
      const qs = new URLSearchParams();
      if (params?.week) qs.set("week", String(params.week));
      if (params?.orderNumber) qs.set("orderNumber", params.orderNumber);
      if (params?.amount) qs.set("amount", String(params.amount));
      if (params?.points) qs.set("points", String(params.points));
      return call<{ preview: any; sampleCustomer: any }>(`/api/notifications/preview?${qs.toString()}`, { cache: "no-store" });
    },
  },

  placeOrder: (input: PlaceOrderInput) => post<OrderResult>("/api/orders", input),
  quoteOrder: (input: QuoteInput) => post<QuoteResult>("/api/orders/quote", input),

  razorpaySession: (input: RazorpaySessionInput) =>
    post<RazorpaySessionResult>("/api/payments/razorpay/order", input),
  verifyRazorpayPayment: (input: RazorpayVerifyInput) =>
    post<OrderResult>("/api/payments/razorpay/verify", input),

  ownpaySession: (input: OwnPaySessionInput) =>
    post<OwnPaySessionResult>("/api/payments/ownpay/order", input),
  verifyOwnPayPayment: (input: OwnPayVerifyInput) =>
    post<OrderResult>("/api/payments/ownpay/verify", input),

  manualUpiOrder: (input: PlaceOrderInput) =>
    post<{
      order: ShopOrder;
      quote: QuoteResult;
      qrCodeDataUrl: string;
      upiUri: string;
      manualUpiSnapshot?: ShopOrder["manualUpiSnapshot"];
    }>("/api/payments/manual-upi/order", input),
  submitUtr: (orderNumber: string, utr: string, screenshot?: string) =>
    post<{ order: ShopOrder }>("/api/payments/manual-upi/submit-utr", { orderNumber, utr, screenshot }),
  uploadPaymentProof: async (file: File): Promise<{ url: string }> => {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/payments/manual-upi/upload-proof", { method: "POST", body: form });
    const payload = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
    if (!response.ok || !payload?.url) {
      throw new Error(payload?.error ?? `Screenshot upload failed with status ${response.status}`);
    }
    return { url: payload.url };
  },

  track: (orderNumber: string, contact?: string) =>
    call<TrackingResult>(
      `/api/track?orderNumber=${encodeURIComponent(orderNumber)}${contact ? `&contact=${encodeURIComponent(contact)}` : ""}`,
      { cache: "no-store" }
    ),

  getMyTrackedOrders: () =>
    call<{ userOrders: ShopOrder[]; customer?: { id: string; name: string; phone: string } }>("/api/track", {
      cache: "no-store",
    }),

  withdraw: (input: WithdrawalInput) =>
    post<{ withdrawal: WithdrawalRequest; customer: CustomerAccount }>("/api/withdrawals", input),

  claimCashback: (options?: { orderId?: string; week?: number }) =>
    post<{ claimedPoints: number; claimedRupees: number; nextClaimAvailableAt?: string; customer: CustomerAccount }>(
      "/api/wallet/claim",
      options ?? {}
    ),

  addBankAccount: (input: {
    accountHolderName: string;
    accountNumber: string;
    confirmAccountNumber: string;
    ifscCode: string;
    bankName: string;
  }) =>
    post<{ bankAccounts: BankAccount[]; addedAccount?: BankAccount; customer: CustomerAccount; pendingReview?: boolean }>(
      "/api/wallet/bank-accounts",
      input
    ),

  getBankAccounts: () => call<BankAccount[]>("/api/wallet/bank-accounts", { cache: "no-store" }),

  getUpiDetails: () =>
    call<{
      savedUpiId?: string;
      upiStatus?: "VERIFIED" | "PENDING_REVIEW";
      pendingUpiId?: string;
      pendingUpiRequestedAt?: string;
    }>("/api/wallet/upi", { cache: "no-store" }),

  updateUpi: (upiId: string) =>
    post<{ customer: CustomerAccount; savedUpiId?: string; pendingUpiId?: string; upiStatus?: string; pendingReview?: boolean }>("/api/wallet/upi", { upiId }),

  removeBankAccount: (id: string) =>
    call<{ bankAccounts: BankAccount[]; customer: CustomerAccount }>(`/api/wallet/bank-accounts?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  claimReferralReward: (input: {
    milestoneId: "IPHONE_17_PRO_MAX";
    recipientName: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
  }) =>
    post<{ success: boolean; claim: any; customer: CustomerAccount }>(
      "/api/referrals/claim-reward",
      input
    ),

  agents: {
    apply: (pitch?: string) => post<{ customer: CustomerAccount }>("/api/agents/apply", { pitch }),
  },

  getReviews: (productId: string) =>
    call<{ reviews: ProductReview[] }>(`/api/reviews?productId=${encodeURIComponent(productId)}`, {
      cache: "no-store",
    }),

  submitReview: (input: {
    productId: string;
    authorName: string;
    rating: number;
    title?: string;
    comment: string;
    sizePurchased?: string;
    imageUrl?: string;
  }) =>
    post<{ success: boolean; review: ProductReview }>("/api/reviews", input),

  uploadReviewPhoto: async (file: File): Promise<{ url: string }> => {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/reviews/upload", { method: "POST", body: form });
    const payload = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
    if (!response.ok || !payload?.url) {
      throw new Error(payload?.error ?? `Photo upload failed with status ${response.status}`);
    }
    return { url: payload.url };
  },

  session: () => call<{ customer: CustomerAccount | null }>("/api/session", { cache: "no-store" }),

  addresses: {
    list: () =>
      call<{ customer: CustomerAccount | null; addresses: CustomerAddress[] }>("/api/account/addresses", {
        cache: "no-store",
      }),
    add: (input: AddressPayload) => post<AddressResult>("/api/account/addresses", input),
    update: (index: number, input: Partial<AddressPayload>) =>
      call<AddressResult>("/api/account/addresses", {
        method: "PATCH",
        body: JSON.stringify({ index, ...input }),
      }),
    setDefault: (index: number) =>
      call<AddressResult>("/api/account/addresses", {
        method: "PATCH",
        body: JSON.stringify({ index, isDefault: true }),
      }),
    remove: (index: number) =>
      call<AddressResult>(`/api/account/addresses?index=${index}`, { method: "DELETE" }),
  },

  signIn: async (
    identifier: string,
    name?: string,
    otp?: string,
    password?: string,
    extra?: { phone?: string; email?: string }
  ) => {
    const res = await post<{ customer: CustomerAccount }>("/api/session", {
      identifier,
      name,
      otp,
      password,
      phone: extra?.phone,
      email: extra?.email,
    });
    if (typeof window !== "undefined") window.dispatchEvent(new Event("zenin:auth_change"));
    return res;
  },
  updateProfile: async (data: { name?: string; email?: string }) => {
    const res = await call<{ customer: CustomerAccount }>("/api/session", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    if (typeof window !== "undefined") window.dispatchEvent(new Event("zenin:auth_change"));
    return res;
  },
  signOut: async () => {
    const res = await call<{ signedOut: boolean }>("/api/session", { method: "DELETE" });
    if (typeof window !== "undefined") window.dispatchEvent(new Event("zenin:auth_change"));
    return res;
  },

  sendOtp: (target: string, type?: "signup" | "reset" | "login") =>
    post<{ success: boolean; message: string; simulated?: boolean; otp?: string }>("/api/auth/send-otp", { target, type }),

  auth: {
    check: (identifier: string) =>
      post<{ exists: boolean; name?: string }>("/api/auth/check", { identifier }),
    sendOtp: (input: { target: string; type?: "signup" | "reset" | "login" }) =>
      post<{ success: boolean; message: string; simulated?: boolean; otp?: string }>("/api/auth/send-otp", input),
    signUp: async (input: {
      name: string;
      phone: string;
      email?: string;
      password: string;
      otp: string;
      referralCode?: string;
    }) => {
      const res = await post<{ success: boolean; customer: CustomerAccount }>("/api/auth/signup", input);
      if (typeof window !== "undefined") window.dispatchEvent(new Event("zenin:auth_change"));
      return res;
    },
    login: async (input: { identifier: string; password?: string; otp?: string; name?: string; email?: string }) => {
      const res = await post<{ success: boolean; customer: CustomerAccount }>("/api/auth/login", input);
      if (typeof window !== "undefined") window.dispatchEvent(new Event("zenin:auth_change"));
      return res;
    },
    resetPassword: async (input: { identifier: string; otp: string; newPassword: string }) => {
      const res = await post<{ success: boolean; message: string; customer: CustomerAccount }>("/api/auth/reset-password", input);
      if (typeof window !== "undefined") window.dispatchEvent(new Event("zenin:auth_change"));
      return res;
    },
    updatePassword: async (input: { currentPassword?: string; newPassword: string }) => {
      const res = await post<{ success: boolean; message: string; customer: CustomerAccount }>("/api/auth/update-password", input);
      if (typeof window !== "undefined") window.dispatchEvent(new Event("zenin:auth_change"));
      return res;
    },
  },

  admin: {
    login: (username: string, password: string) => {
      adminOverviewEtag = null;
      adminOverviewCache = null;
      return post<{ authenticated: boolean; actor: string }>("/api/admin/session", { username, password });
    },
    logout: () => {
      adminOverviewEtag = null;
      adminOverviewCache = null;
      return call<{ authenticated: boolean }>("/api/admin/session", { method: "DELETE" });
    },
    session: () => call<{ authenticated: boolean; actor?: string }>("/api/admin/session", { cache: "no-store" }),
    overview: () => fetchAdminOverview(),

    openMemberSession: (customerId: string) =>
      post<{ customer: CustomerAccount }>(
        `/api/admin/members/${encodeURIComponent(customerId)}/session`,
        {}
      ),
    closeMemberSession: (customerId: string) =>
      call<{ closed: boolean }>(`/api/admin/members/${encodeURIComponent(customerId)}/session`, { method: "DELETE" }),

    createProduct: (product: Partial<Product>) => post<Product>("/api/admin/products", product),
    updateProduct: (id: string, patch: Partial<Product>) =>
      call<Product>(`/api/admin/products/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    archiveProduct: (id: string) => call<Product>(`/api/admin/products/${id}`, { method: "DELETE" }),
    deleteProduct: (id: string) =>
      call<{ success: boolean; productId: string }>(
        `/api/admin/products/${encodeURIComponent(id)}?permanent=true`,
        { method: "DELETE" }
      ),

    uploadArtwork: async (file: File): Promise<{ url: string }> => {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/admin/assets", { method: "POST", body: form });
      const payload = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error ?? `Upload failed with status ${response.status}`);
      }
      return { url: payload.url };
    },

    setOrderStatus: (id: string, status: OrderStatus, note?: string) =>
      call<ShopOrder>(`/api/orders/${id}`, { method: "PATCH", body: JSON.stringify({ status, note }) }),
    assignShipment: (id: string, courier: CourierPartner, trackingNumber: string) =>
      call<ShopOrder>(`/api/orders/${id}`, { method: "PATCH", body: JSON.stringify({ courier, trackingNumber }) }),

    dispatchGift: (input: FreeTshirtInput) => post<ShopOrder>("/api/admin/gifts", input),
    createCustomer: (input: { name: string; phone: string; email?: string; tier?: string; availableCoins?: number }) =>
      post<CustomerAccount>("/api/admin/customers", input),
    patchCustomer: (id: string, patch: AdminCustomerPatch) =>
      call<AdminCustomerUpdateResult>(`/api/admin/customers/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    saveRules: (rules: RewardRulesConfig) =>
      call<RewardRulesConfig>("/api/admin/reward-rules", { method: "PUT", body: JSON.stringify(rules) }),
    reviewAgent: (input: { customerId: string; action: "approve" | "reject"; reason?: string }) =>
      post<{ customer: CustomerAccount }>("/api/admin/agents/review", input),
    createAgent: (input: { name: string; phone: string; email?: string; password: string }) =>
      post<{ customer: CustomerAccount }>("/api/admin/agents/create", input),
    promoteAgent: (input: { customerId: string }) =>
      post<{ customer: CustomerAccount }>("/api/admin/agents/promote", input),
    demoteAgent: (input: { customerId: string }) =>
      post<{ customer: CustomerAccount }>("/api/admin/agents/demote", input),
    dispatchAgentGift: (input: { customerId: string; giftId: string }) =>
      post<{ customer: CustomerAccount }>("/api/admin/agents/gifts/dispatch", input),
    saveSupport: (patch: Partial<SupportConfig>) =>
      call<SupportConfig>("/api/admin/support", { method: "PUT", body: JSON.stringify(patch) }),
    raiseWithdrawal: (input: AdminRaiseWithdrawalInput) =>
      post<{ withdrawal: WithdrawalRequest; customer: CustomerAccount }>("/api/admin/withdrawals", input),
    payTranche: (withdrawalId: string, week: number, reference?: string) =>
      post<{ withdrawal: WithdrawalRequest; paid: WithdrawalTranche[] }>(
        `/api/admin/withdrawals/${encodeURIComponent(withdrawalId)}/pay`,
        { week, reference } satisfies PayoutInput
      ),
    settlePayout: (withdrawalId: string, reference?: string) =>
      post<{ withdrawal: WithdrawalRequest; paid: WithdrawalTranche[] }>(
        `/api/admin/withdrawals/${encodeURIComponent(withdrawalId)}/pay`,
        { all: true, reference } satisfies PayoutInput
      ),
    updateWithdrawal: (withdrawalId: string, patch: AdminWithdrawalPatch) =>
      call<WithdrawalRequest>(`/api/admin/withdrawals/${encodeURIComponent(withdrawalId)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    rejectWithdrawal: (withdrawalId: string, reason?: string) =>
      post<WithdrawalRequest>(`/api/admin/withdrawals/${encodeURIComponent(withdrawalId)}/reject`, {
        reason
      }),
    reopenWithdrawal: (withdrawalId: string) =>
      post<WithdrawalRequest>(`/api/admin/withdrawals/${encodeURIComponent(withdrawalId)}/reopen`, {}),

    getGateways: () => call<GatewaysConfig>("/api/admin/gateways", { cache: "no-store" }),
    updateGateways: (patch: Partial<GatewaysConfig>) =>
      call<GatewaysConfig>("/api/admin/gateways", { method: "PATCH", body: JSON.stringify(patch) }),
    getManualUpi: () => call<ManualUpiConfig>("/api/admin/manual-upi", { cache: "no-store" }),
    updateManualUpi: (patch: Partial<ManualUpiConfig>) =>
      call<ManualUpiConfig>("/api/admin/manual-upi", { method: "PATCH", body: JSON.stringify(patch) }),
    verifyManualUpi: (orderNumber: string, utr?: string) =>
      post<{ order: ShopOrder }>("/api/admin/manual-upi/verify", { orderNumber, utr }),
    rejectManualUpi: (orderNumber: string, reason: string) =>
      post<{ order: ShopOrder }>("/api/admin/manual-upi/reject", { orderNumber, reason }),

    getQikink: () => call<QikinkConfig>("/api/admin/qikink", { cache: "no-store" }),
    updateQikink: (patch: Partial<QikinkConfig>) =>
      call<QikinkConfig>("/api/admin/qikink", { method: "PATCH", body: JSON.stringify(patch) }),
    pushOrderToQikink: (orderId: string) =>
      post<{ success: boolean; order: ShopOrder; error?: string }>(`/api/admin/orders/${encodeURIComponent(orderId)}/qikink`, {}),
    syncOrderWithQikink: (orderId: string) =>
      call<{ success: boolean; order: ShopOrder; error?: string }>(`/api/admin/orders/${encodeURIComponent(orderId)}/qikink`, { cache: "no-store" }),

    teams: {
      list: () => call<Team[]>("/api/admin/teams", { cache: "no-store" }),
      create: (input: { name: string; description?: string; leaderId: string; status?: TeamStatus; permissions?: TeamPermission[]; memberIds?: string[] }) =>
        post<Team>("/api/admin/teams", input),
      update: (id: string, patch: Partial<{ name: string; description: string; leaderId: string; status: TeamStatus; permissions: TeamPermission[]; memberIds: string[] }>) =>
        call<Team>(`/api/admin/teams/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) }),
      delete: (id: string) =>
        call<{ success: boolean; id: string }>(`/api/admin/teams/${encodeURIComponent(id)}`, { method: "DELETE" }),
    },

    supportChats: {
      list: () => call<{ chats: SupportChatThread[] }>("/api/admin/support/chats", { cache: "no-store" }),
      reply: (id: string, message: string) =>
        post<{ thread: SupportChatThread }>(`/api/admin/support/chats/${encodeURIComponent(id)}/reply`, { message }),
      resolve: (id: string) =>
        post<{ thread: SupportChatThread }>(`/api/admin/support/chats/${encodeURIComponent(id)}/resolve`, {}),
    },
  },
};
