"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
  Building2,
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  CircleCheck,
  Coins,
  Copy,
  DollarSign,
  Eye,
  EyeOff,
  FileText,
  Gift,
  Handshake,
  KeyRound,
  Layers,
  LifeBuoy,
  Lock,
  LogIn,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  MessageSquare,
  Package,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Truck,
  Undo2,
  Upload,
  User,
  UserCheck,
  UserMinus,
  Users,
  Wallet,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { api } from "@/lib/client";
import { copyText } from "@/lib/clipboard";
import type { AdminCustomerPatch, AdminOverview, AdminWithdrawalPatch } from "@/lib/contracts";
import type { Product } from "@/data/products";
import type { AgentSlabConfig, BankAccount, CustomerAccount, RewardRulesConfig, WithdrawalRequest } from "@/data/rewardsEngine";
import { DEFAULT_AGENT_SLABS, MAX_AGENT_SLABS, agentMonthlySalesCoins, agentNextSlabFor, agentPeriodKey, agentSlabsFor } from "@/data/rewardsEngine";
import type { OrderStatus } from "@/lib/domain";
import { DELIVERY_FEE, FREE_SHIPPING_THRESHOLD, dateLabel, dateTimeLabel } from "@/lib/domain";
import { buildVestingSchedule, vestingTotals } from "@/lib/vesting";
import { isAnimeTShirt, isBestseller, isNewDrop, isPremiumTShirt } from "@/lib/catalog";
import {
  callUrl,
  digitsOnly,
  formatSupportPhone,
  isPlaceholderWhatsApp,
  mailUrl,
  whatsappUrl,
  type SupportConfig,
} from "@/lib/support";
import {
  ANIME_THEMES,
  COLOR_SWATCHES,
  GRAPHIC_PRESETS,
  ORDER_TONES,
  PRODUCT_CATEGORIES,
  SIZE_OPTIONS,
  WITHDRAWAL_TONES,
  errorMessage,
  formatCount,
  formatMoney,
  isAuthError,
} from "@/components/admin/shared";
import type {
  AdminController,
  AdminTab,
  ProductEditorRequest,
  RunOptions,
  RunResult,
  ToastItem,
  ToastKind,
} from "@/components/admin/shared";
import {
  AdminButton,
  ConsoleHero,
  EmptyState,
  ErrorNote,
  Field,
  Modal,
  Panel,
  PanelHeader,
  Pill,
  ProductThumb,
  ProgressBar,
  RowCard,
  ScreenLoader,
  SelectInput,
  TextArea,
  TextInput,
  Toaster,
} from "@/components/admin/ui";
import ShopifyProductEditor from "@/components/admin/ShopifyProductEditor";
import GatewaysTab from "@/components/admin/GatewaysTab";
import PushTab from "@/components/admin/PushTab";
import SupportChatTab from "@/components/admin/SupportChatTab";
import { TeamsTab } from "@/components/admin/TeamsTab";
import { AstryxAdminTheme } from "@/components/admin/AstryxAdminTheme";
import { AdminThemeProvider, AdminThemeToggle } from "@/components/admin/AdminTheme";
import { OrdersListing } from "@/components/admin/orders/OrdersListing";
import { OrderDetails } from "@/components/admin/orders/OrderDetails";

type Phase = "boot" | "auth" | "ready";

/** Desks where numbers move during the day — the only ones worth polling. */
const LIVE_POLL_TABS: AdminTab[] = ["overview", "orders", "customers", "bank-reviews", "withdrawals", "support-chat"];
const ADMIN_POLL_MS = 15000;

const TABS: { id: AdminTab; label: string; icon: LucideIcon; href: string }[] = [
  { id: "overview", label: "Metrics", icon: Activity, href: "/admin" },
  { id: "support-chat", label: "Tawk.to Live Chat", icon: MessageSquare, href: "/admin/support-chat" },
  { id: "orders", label: "Orders", icon: Package, href: "/admin/orders" },
  { id: "anime", label: "T-Shirts", icon: Sparkles, href: "/admin/products" },
  { id: "customers", label: "Profiles & Members", icon: Wallet, href: "/admin/customers" },
  { id: "bank-reviews", label: "Bank & UPI Reviews", icon: Building2, href: "/admin/bank-reviews" },
  { id: "withdrawals", label: "Withdrawals", icon: DollarSign, href: "/admin/withdrawals" },
  { id: "teams", label: "Teams", icon: Users, href: "/admin/teams" },
  { id: "rules", label: "Rules & Shipping", icon: Settings, href: "/admin/rules" },
  { id: "support", label: "Support", icon: LifeBuoy, href: "/admin/support" },
  { id: "affiliates", label: "Affiliates", icon: Users, href: "/admin/affiliates" },
  { id: "agents", label: "Agents", icon: Handshake, href: "/admin/agents" },
  { id: "audit", label: "Audit Log", icon: FileText, href: "/admin/audit" },
  { id: "compliance", label: "Compliance", icon: ShieldAlert, href: "/admin/compliance" },
  { id: "gateways", label: "OwnPay & Gateways", icon: Zap, href: "/admin/gateways" },
  { id: "push", label: "Web Push Alerts", icon: Bell, href: "/admin/push" },
];

type PlacementFlag = "showOnStorefront" | "showInAnime" | "showInPremium" | "showInNewDrops" | "showInBestSellers";

/**
 * All drops on the storefront are T-shirts.
 */
function isAnimeDeskRow(product: Product): boolean {
  return true;
}

/** Whatever the card will actually show: raw back-print artwork first, then a real photo. */
function animeThumb(product: Product): string | null {
  return product.artworkUrl ?? product.imageBackUrl ?? product.imageUrl ?? null;
}

/** Readable temporary password the admin can hand over; avoids look-alike 0/O and 1/l. */
function suggestAgentPassword(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const letters = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `sky-${letters}`;
}

const ADMIN_CACHE_KEY = "skywear_admin_snapshot_v1";

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// Hydration gate: the server renders before sessionStorage exists, so the first client paint
// must render the boot shell and only then swap in the cached snapshot.
const subscribeMounted = () => () => {};
const getMountedClient = () => true;
const getMountedServer = () => false;

/** Copy + toast, without the unhandled rejection the raw clipboard API can throw. */
function copyToClipboard(text: string, ctl: AdminController, successMessage: string): void {
  void copyText(text).then((copied) => {
    if (copied) ctl.notify("success", successMessage);
    else ctl.notify("error", "Browser blocked the clipboard — long-press the value to copy it");
  });
}

export default function AdminPage() {
  return (
    <AdminThemeProvider>
      <AstryxAdminTheme>
        <AdminConsole />
      </AstryxAdminTheme>
    </AdminThemeProvider>
  );
}

function AdminConsole() {
  const params = useParams();
  const router = useRouter();

  const slugArray = useMemo(() => {
    const s = params?.slug;
    if (!s) return [];
    if (Array.isArray(s)) return s;
    return [s];
  }, [params?.slug]);

  // Instant hydration from client session storage so admin sees dashboard with 0ms waiting
  const [snapshot, setSnapshot] = useState<AdminOverview | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const cached = sessionStorage.getItem(ADMIN_CACHE_KEY);
      if (cached) return JSON.parse(cached);
    } catch {}
    return null;
  });

  const [phase, setPhase] = useState<Phase>(() => {
    if (typeof window === "undefined") return "boot";
    try {
      const cached = sessionStorage.getItem(ADMIN_CACHE_KEY);
      if (cached) return "ready";
    } catch {}
    return "boot";
  });

  const updateSnapshot = useCallback((data: AdminOverview | null) => {
    setSnapshot(data);
    if (typeof window !== "undefined") {
      try {
        if (data) sessionStorage.setItem(ADMIN_CACHE_KEY, JSON.stringify(data));
        else sessionStorage.removeItem(ADMIN_CACHE_KEY);
      } catch {}
    }
  }, []);

  const [actor, setActor] = useState("Admin (admin@skywear.in)");
  const [pendingMap, setPendingMap] = useState<Record<string, boolean>>({});
  const busyRef = useRef(false);
  useEffect(() => {
    busyRef.current = Object.keys(pendingMap).length > 0;
  }, [pendingMap]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [giftOpen, setGiftOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [memberFocus, setMemberFocus] = useState<string | null>(null);

  // sessionStorage cache is read during state init, so gate rendering until hydration finishes.
  const mounted = useSyncExternalStore(subscribeMounted, getMountedClient, getMountedServer);

  // Derive active tab, Shopify editor state, and member focus directly from URL
  const routeState = useMemo<{
    tab: AdminTab;
    editorMode: { draft: Product | "new"; anime: boolean } | null;
    memberId: string | null;
  }>(() => {
    const first = slugArray[0]?.toLowerCase();
    const second = slugArray[1]?.toLowerCase();

    // 1. Overview / Metrics: /admin or /admin/overview
    if (!first || first === "overview") {
      return { tab: "overview", editorMode: null, memberId: null };
    }

    // 2. T-Shirts & Products desk / Shopify editor:
    // /admin/products, /admin/product, /admin/products/new, /admin/product/add, /admin/products/[id]
    if (first === "products" || first === "product" || first === "anime" || first === "drops") {
      if (second === "new" || second === "add" || second === "create") {
        return { tab: "anime", editorMode: { draft: "new", anime: true }, memberId: null };
      }
      if (slugArray[1]) {
        const rawTarget = slugArray[1];
        const match = snapshot?.products.find(
          (p) =>
            p.id === rawTarget ||
            p.slug === rawTarget ||
            p.slug === decodeURIComponent(rawTarget) ||
            p.id.toLowerCase() === rawTarget.toLowerCase()
        );
        if (match) {
          return { tab: "anime", editorMode: { draft: match, anime: true }, memberId: null };
        }
      }
      return { tab: "anime", editorMode: null, memberId: null };
    }

    // 3. Orders & POD pipeline: /admin/orders or /admin/pod
    if (first === "orders" || first === "order" || first === "pod") {
      return { tab: "orders", editorMode: null, memberId: null };
    }

    // 4. Members & Wallet: /admin/customers or /admin/members
    if (first === "customers" || first === "customer" || first === "members" || first === "wallets") {
      return { tab: "customers", editorMode: null, memberId: slugArray[1] ?? null };
    }

    // 4b. Bank & UPI Reviews: /admin/bank-reviews or /admin/payout-reviews
    if (first === "bank-reviews" || first === "payout-reviews" || first === "bank-review") {
      return { tab: "bank-reviews", editorMode: null, memberId: null };
    }

    // 5. Withdrawals / Payouts: /admin/withdrawals or /admin/payouts
    if (first === "withdrawals" || first === "withdrawal" || first === "payouts" || first === "payout") {
      return { tab: "withdrawals", editorMode: null, memberId: null };
    }

    // 5b. Teams: /admin/teams or /admin/team
    if (first === "teams" || first === "team") {
      return { tab: "teams", editorMode: null, memberId: null };
    }

    // 6. Reward Rules: /admin/rules
    if (first === "rules" || first === "rule" || first === "rewards") {
      return { tab: "rules", editorMode: null, memberId: null };
    }

    // 7a. Live Support Chat: /admin/support-chat, /admin/chat, /admin/live-chat
    if (first === "support-chat" || first === "chat" || first === "live-chat") {
      return { tab: "support-chat", editorMode: null, memberId: null };
    }

    // 7. Support desk: /admin/support
    if (first === "support" || first === "help") {
      return { tab: "support", editorMode: null, memberId: null };
    }

    // 8. Affiliates: /admin/affiliates
    if (first === "affiliates" || first === "affiliate") {
      return { tab: "affiliates", editorMode: null, memberId: null };
    }

    // 8b. Agents: /admin/agents
    if (first === "agents" || first === "agent") {
      return { tab: "agents", editorMode: null, memberId: null };
    }

    // 9. Audit Log: /admin/audit
    if (first === "audit" || first === "logs") {
      return { tab: "audit", editorMode: null, memberId: null };
    }

    // 10. Compliance: /admin/compliance
    if (first === "compliance" || first === "legal") {
      return { tab: "compliance", editorMode: null, memberId: null };
    }

    // 11. OwnPay & Gateways: /admin/gateways or /admin/ownpay
    if (first === "gateways" || first === "gateway" || first === "ownpay") {
      return { tab: "gateways", editorMode: null, memberId: null };
    }

    // 12. Web Push Alerts: /admin/push
    if (first === "push" || first === "notifications" || first === "alerts") {
      return { tab: "push", editorMode: null, memberId: null };
    }

    return { tab: "overview", editorMode: null, memberId: null };
  }, [slugArray, snapshot?.products]);

  const [tab, setTab] = useState<AdminTab>(routeState.tab);
  const [editorMode, setEditorMode] = useState<{ draft: Product | "new"; anime: boolean } | null>(routeState.editorMode);

  // /admin/orders/<orderNumber> opens the dedicated order page; pushState keeps it refresh-safe.
  const orderFocusFromRoute = useMemo(() => {
    const first = slugArray[0]?.toLowerCase();
    if (first === "orders" || first === "order" || first === "pod") {
      return slugArray[1] ? safeDecode(slugArray[1]) : null;
    }
    return null;
  }, [slugArray]);
  const [orderFocus, setOrderFocus] = useState<string | null>(orderFocusFromRoute);

  useEffect(() => {
    setTab(routeState.tab);
    setEditorMode(routeState.editorMode);
  }, [routeState.tab, routeState.editorMode]);

  useEffect(() => {
    if (routeState.memberId) {
      setMemberFocus(routeState.memberId);
    }
  }, [routeState.memberId]);

  const goToTab = useCallback(
    (next: AdminTab) => {
      setNavOpen(false);
      setTab(next);
      setEditorMode(null);
      setOrderFocus(null);
      const url =
        next === "overview"
          ? "/admin"
          : next === "anime"
          ? "/admin/products"
          : next === "gateways"
          ? "/admin/gateways"
          : `/admin/${next}`;
      if (typeof window !== "undefined") {
        window.history.pushState(null, "", url);
      }
    },
    []
  );

  const openOrder = useCallback((orderNumber: string) => {
    setTab("orders");
    setEditorMode(null);
    setOrderFocus(orderNumber);
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", `/admin/orders/${encodeURIComponent(orderNumber)}`);
    }
  }, []);

  const closeOrder = useCallback(() => {
    setTab("orders");
    setEditorMode(null);
    setOrderFocus(null);
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/admin/orders");
    }
  }, []);

  const openMember = useCallback(
    (customerId: string) => {
      setMemberFocus(customerId);
      setTab("customers");
      setEditorMode(null);
      if (typeof window !== "undefined") {
        window.history.pushState(null, "", `/admin/customers/${customerId}`);
      }
    },
    []
  );

  const openProduct = useCallback(
    (draft: Product | "new", _anime?: boolean) => {
      setTab("anime");
      setEditorMode({ draft, anime: Boolean(_anime) });
      const url =
        draft === "new"
          ? "/admin/products/new"
          : `/admin/products/${draft.slug || draft.id}`;
      if (typeof window !== "undefined") {
        window.history.pushState(null, "", url);
      }
    },
    []
  );

  const closeProductEditor = useCallback(() => {
    setEditorMode(null);
    setTab("anime");
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/admin/products");
    }
  }, []);

  // Handle browser back/forward buttons seamlessly
  useEffect(() => {
    const handlePopState = () => {
      const parts = window.location.pathname.replace(/^\/admin\/?/, "").split("/").filter(Boolean);
      const first = parts[0]?.toLowerCase();
      const second = parts[1]?.toLowerCase();
      if (!first || first === "overview") {
        setTab("overview");
        setEditorMode(null);
      } else if (first === "products" || first === "product" || first === "anime" || first === "drops") {
        setTab("anime");
        if (second === "new" || second === "add" || second === "create") {
          setEditorMode({ draft: "new", anime: true });
        } else if (parts[1]) {
          const match = snapshot?.products.find((p) => p.id === parts[1] || p.slug === parts[1]);
          if (match) setEditorMode({ draft: match, anime: true });
          else setEditorMode(null);
        } else {
          setEditorMode(null);
        }
      } else if (first === "orders" || first === "order" || first === "pod") {
        setTab("orders");
        setEditorMode(null);
        setOrderFocus(parts[1] ? safeDecode(parts[1]) : null);
      } else if (first === "customers" || first === "customer" || first === "members" || first === "wallets") {
        setTab("customers");
        setEditorMode(null);
        if (parts[1]) setMemberFocus(parts[1]);
      } else if (first === "withdrawals" || first === "withdrawal" || first === "payouts" || first === "payout") {
        setTab("withdrawals");
        setEditorMode(null);
      } else if (first === "rules" || first === "rule" || first === "rewards") {
        setTab("rules");
        setEditorMode(null);
      } else if (first === "support" || first === "help") {
        setTab("support");
        setEditorMode(null);
      } else if (first === "affiliates" || first === "affiliate") {
        setTab("affiliates");
        setEditorMode(null);
      } else if (first === "agents" || first === "agent") {
        setTab("agents");
        setEditorMode(null);
      } else if (first === "audit" || first === "logs") {
        setTab("audit");
        setEditorMode(null);
      } else if (first === "compliance" || first === "legal") {
        setTab("compliance");
        setEditorMode(null);
      } else if (first === "gateways" || first === "gateway" || first === "ownpay") {
        setTab("gateways");
        setEditorMode(null);
      } else if (first === "push" || first === "notifications" || first === "alerts") {
        setTab("push");
        setEditorMode(null);
      } else {
        setTab("overview");
        setEditorMode(null);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [snapshot?.products]);

  const notify = useCallback((kind: ToastKind, message: string) => {
    const id = `toast-${Date.now()}-${Math.round(Math.random() * 10000)}`;
    setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== id)), 5000);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const refresh = useCallback(async (): Promise<RunResult> => {
    try {
      const next = await api.admin.overview();
      if (next) updateSnapshot(next);
      return { ok: true };
    } catch (error) {
      const message = errorMessage(error);
      if (isAuthError(message)) setPhase("auth");
      else notify("error", message);
      return { ok: false, error: message };
    }
  }, [notify, updateSnapshot]);

  const run = useCallback(
    async (
      key: string,
      task: () => Promise<unknown>,
      options?: RunOptions
    ): Promise<RunResult> => {
      setPendingMap((prev) => ({ ...prev, [key]: true }));
      try {
        await task();
        if (!options?.skipRefresh) {
          const synced = await refresh();
          if (!synced.ok) return { ok: false, error: synced.error };
        }
        if (options?.successMessage) notify("success", options.successMessage);
        return { ok: true };
      } catch (error) {
        const message = errorMessage(error);
        if (!options?.silent) notify("error", message);
        if (isAuthError(message)) setPhase("auth");
        return { ok: false, error: message };
      } finally {
        setPendingMap((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    },
    [notify, refresh]
  );

  const isPending = useCallback((key: string) => Boolean(pendingMap[key]), [pendingMap]);

  // Turbo Parallel Boot: Authenticate and fetch overview simultaneously
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [sessionRes, overviewRes] = await Promise.allSettled([
          api.admin.session(),
          api.admin.overview(),
        ]);
        if (cancelled) return;

        if (sessionRes.status === "rejected" || !sessionRes.value?.authenticated) {
          updateSnapshot(null);
          setPhase("auth");
          return;
        }

        if (sessionRes.value.actor) setActor(sessionRes.value.actor);

        if (overviewRes.status === "fulfilled" && overviewRes.value) {
          updateSnapshot(overviewRes.value);
          setPhase("ready");
        } else if (!snapshot) {
          setPhase("auth");
        }
      } catch {
        if (!cancelled && !snapshot) setPhase("auth");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [snapshot, updateSnapshot]);

  // Live sync: only the desks where figures move, and only while the tab is visible.
  useEffect(() => {
    if (phase !== "ready" || editorMode || !LIVE_POLL_TABS.includes(tab)) return;
    let inFlight = false;
    let stopped = false;
    const pull = async () => {
      if (inFlight || busyRef.current || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const next = await api.admin.overview();
        if (!stopped && next) updateSnapshot(next);
      } catch (error) {
        if (isAuthError(errorMessage(error))) setPhase("auth");
      } finally {
        inFlight = false;
      }
    };
    const timer = window.setInterval(pull, ADMIN_POLL_MS);
    window.addEventListener("focus", pull);
    document.addEventListener("visibilitychange", pull);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", pull);
      document.removeEventListener("visibilitychange", pull);
    };
  }, [phase, editorMode, tab, updateSnapshot]);

  const signIn = useCallback(async (username: string, password: string): Promise<string | null> => {
    try {
      const session = await api.admin.login(username, password);
      setActor(session.actor);
      const next = await api.admin.overview();
      if (next) updateSnapshot(next);
      setPhase("ready");
      return null;
    } catch (error) {
      return errorMessage(error);
    }
  }, [updateSnapshot]);

  const signOut = useCallback(async () => {
    await run("logout", () => api.admin.logout(), { skipRefresh: true, silent: true });
    updateSnapshot(null);
    setGiftOpen(false);
    setPhase("auth");
    router.push("/admin");
    notify("info", "Admin session ended");
  }, [notify, router, run, updateSnapshot]);

  if (!mounted || phase === "boot") {
    return (
      <ConsoleFrame>
        <ScreenLoader label="Restoring admin session" />
      </ConsoleFrame>
    );
  }

  if (phase === "auth" || !snapshot) {
    return <LoginScreen onLogin={signIn} />;
  }

  const payableNow = snapshot.withdrawals.filter((request) =>
    request.tranches.some((tranche) => tranche.status === "UNLOCKED")
  ).length;

  const ctl: AdminController = {
    snapshot,
    actor,
    run,
    refresh,
    notify,
    setTab: goToTab,
    openGiftDispatch: () => setGiftOpen(true),
    openMember,
    isPending,
    anyPending: Object.keys(pendingMap).length > 0,
  };

  const pendingPayoutReviewsCount = snapshot.customers.reduce((count, c) => {
    const hasBank = (c.bankAccounts || []).some((b) => b.status === "PENDING_REVIEW" || Boolean(b.pendingUpdate));
    const hasUpi = c.upiStatus === "PENDING_REVIEW" && Boolean(c.pendingUpiId);
    return count + (hasBank || hasUpi ? 1 : 0);
  }, 0);

  const pendingAgentCount = snapshot.customers.filter(
    (c) => c.agent?.status === "PENDING"
  ).length;

  const badges: Partial<Record<AdminTab, string>> = {
    orders: formatCount(snapshot.orders.length),
    anime: formatCount(
      snapshot.products.filter((product) => !product.isArchived).length
    ),
    customers: formatCount(snapshot.customers.length),
    agents:
      pendingAgentCount > 0
        ? `${pendingAgentCount} to review`
        : undefined,
    "bank-reviews":
      pendingPayoutReviewsCount > 0
        ? `${pendingPayoutReviewsCount} review${pendingPayoutReviewsCount > 1 ? "s" : ""}`
        : undefined,
    withdrawals: payableNow > 0 ? `${payableNow} due` : undefined,
    audit: formatCount(snapshot.auditLogs.length),
  };

  const rail = (
    <AdminRail
      tab={tab}
      onSelect={goToTab}
      badges={badges}
      actor={actor}
      orderCount={snapshot.orders.length}
      walletCount={snapshot.customers.length}
      onGift={() => setGiftOpen(true)}
      onLogout={() => void signOut()}
      logoutPending={isPending("logout")}
    />
  );

  if (editorMode) {
    return (
      <>
        <ShopifyProductEditor
          ctl={ctl}
          draft={editorMode.draft}
          anime={editorMode.anime}
          onClose={closeProductEditor}
        />
        <Toaster toasts={toasts} onDismiss={dismiss} />
      </>
    );
  }

  return (
    <ConsoleFrame rail={rail} navOpen={navOpen} onNavOpen={() => setNavOpen(true)} onNavClose={() => setNavOpen(false)}>
      <main className="flex flex-col gap-4 overflow-x-clip">
        {tab === "overview" ? (
          <OverviewTab ctl={ctl} onNewProduct={() => openProduct("new", true)} />
        ) : null}
        {tab === "support-chat" ? <SupportChatTab ctl={ctl} /> : null}
        {tab === "orders" ? (
          orderFocus ? (
            <OrderDetails ctl={ctl} orderNumber={orderFocus} onBack={closeOrder} />
          ) : (
            <OrdersListing ctl={ctl} onOpenOrder={openOrder} />
          )
        ) : null}
        {tab === "anime" ? <AnimeTeesTab ctl={ctl} onEdit={(draft) => openProduct(draft, true)} /> : null}
        {tab === "customers" ? <MembersTab ctl={ctl} focusId={memberFocus} onFocus={setMemberFocus} /> : null}
        {tab === "bank-reviews" ? <BankReviewsTab ctl={ctl} onFocusMember={openMember} /> : null}
        {tab === "withdrawals" ? <WithdrawalsTab ctl={ctl} /> : null}
        {tab === "teams" ? <TeamsTab ctl={ctl} /> : null}
        {tab === "rules" ? <RulesTab ctl={ctl} /> : null}
        {tab === "support" ? <SupportTab ctl={ctl} /> : null}
        {tab === "affiliates" ? <AffiliatesTab ctl={ctl} /> : null}
        {tab === "agents" ? <AgentsTab ctl={ctl} /> : null}
        {tab === "audit" ? <AuditTab ctl={ctl} /> : null}
        {tab === "compliance" ? <ComplianceTab ctl={ctl} /> : null}
        {tab === "gateways" ? <GatewaysTab ctl={ctl} /> : null}
        {tab === "push" ? <PushTab ctl={ctl} /> : null}
      </main>

      <GiftDispatchModal ctl={ctl} open={giftOpen} onClose={() => setGiftOpen(false)} />
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ConsoleFrame>
  );
}

/* ------------------------------------------------------------------ chrome */

function ConsoleFrame({
  rail,
  navOpen = false,
  onNavOpen,
  onNavClose,
  children,
}: {
  rail?: React.ReactNode;
  navOpen?: boolean;
  onNavOpen?: () => void;
  onNavClose?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-[var(--adm-bg)] font-mono text-[var(--adm-text)]">
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--adm-border)] bg-[var(--adm-bg)] px-3 py-2 lg:hidden">
        <button
          type="button"
          onClick={onNavOpen}
          className="flex shrink-0 items-center gap-2 rounded-none border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text)] hover:border-[var(--adm-accent)]"
        >
          <Menu className="h-4 w-4" />
          Menu
        </button>
        <p className="min-w-0 flex-1 truncate text-xs font-bold uppercase tracking-widest text-[var(--adm-text)]" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>
          Skywear Admin
        </p>
        <AdminThemeToggle compact />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[1800px] items-start">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 overflow-y-auto border-r border-[var(--adm-border)] bg-[var(--adm-bg)] lg:block xl:w-[264px]">
          {rail}
        </aside>
        <div className="min-w-0 flex-1 p-3 sm:p-4">{children}</div>
      </div>

      {navOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden font-mono">
          <button
            type="button"
            aria-label="Close menu"
            onClick={onNavClose}
            className="min-w-0 flex-1 bg-black/80"
          />
          <div className="no-scrollbar relative h-full w-[276px] max-w-[84%] overflow-y-auto border-r border-[var(--adm-border)] bg-[var(--adm-bg)]">
            <button
              type="button"
              aria-label="Close menu"
              onClick={onNavClose}
              className="absolute right-2 top-3 rounded-none border border-[var(--adm-border)] bg-[var(--adm-surface)] p-1.5 text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]"
            >
              <X className="h-4 w-4" />
            </button>
            {rail}
          </div>
        </div>
      ) : null}

      <footer className="relative z-10 border-t border-[var(--adm-border)] bg-[var(--adm-bg)] px-5 py-3 text-center text-[10px] uppercase tracking-widest text-[var(--adm-text-muted)] font-mono">
        SKYWARE COMMERCE OS • REAL-TIME SERVER SNAPSHOT ENFORCED
      </footer>
    </div>
  );
}

function AdminRail({
  tab,
  onSelect,
  badges,
  actor,
  orderCount,
  walletCount,
  onGift,
  onLogout,
  logoutPending,
}: {
  tab: AdminTab;
  onSelect: (tab: AdminTab) => void;
  badges: Partial<Record<AdminTab, string>>;
  actor: string;
  orderCount: number;
  walletCount: number;
  onGift: () => void;
  onLogout: () => void;
  logoutPending: boolean;
}) {
  return (
    <div className="flex min-h-full flex-col gap-3 px-3 py-3 font-mono">
      <div className="relative overflow-hidden rounded-none border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3">
        <p className="text-xl font-bold uppercase tracking-tight text-[var(--adm-text)]" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>
          SKYWARE
        </p>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--adm-accent)] mt-0.5">
          [COMMERCE CORE]
        </p>
        <p className="mt-2.5 truncate text-[10px] text-[var(--adm-text-muted)]">{actor}</p>
        <p className="mt-0.5 text-[10px] text-[var(--adm-text-muted)]">
          {formatCount(orderCount)} ORDERS • {formatCount(walletCount)} WALLETS
        </p>
      </div>

      <Link
        href="/admin/products/new"
        onClick={(e) => {
          e.preventDefault();
          onSelect("anime");
        }}
        className="flex items-center justify-center gap-2 rounded-none border border-[var(--adm-accent)] bg-transparent px-3 py-2 text-xs font-bold uppercase tracking-wider text-[var(--adm-accent)] transition-colors hover:bg-[var(--adm-accent)]/10"
      >
        <Plus className="h-4 w-4" />
        + New T-Shirt Drop
      </Link>

      <nav className="flex flex-1 flex-col gap-0.5" aria-label="Admin sections">
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={(e) => {
                e.preventDefault();
                onSelect(item.id);
              }}
              aria-current={active ? "page" : undefined}
              className={`group relative flex items-center gap-2.5 rounded-none border px-3 py-2 text-left transition-colors cursor-pointer ${
                active
                  ? "border-[var(--adm-accent)] bg-[var(--adm-surface)] text-[var(--adm-text)]"
                  : "border-transparent text-[var(--adm-text-muted)] hover:bg-[var(--adm-surface)] hover:text-[var(--adm-text)]"
              }`}
            >
              {active ? (
                <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--adm-accent)]" />
              ) : null}
              <item.icon
                className={`h-4 w-4 shrink-0 ${active ? "text-[var(--adm-accent)]" : "text-[var(--adm-text-muted)] group-hover:text-[var(--adm-text)]"}`}
              />
              <span className="min-w-0 flex-1 truncate text-xs font-bold uppercase tracking-wider">{item.label}</span>
              {badges[item.id] ? (
                <span
                  className={`shrink-0 rounded-none px-1.5 py-0.5 text-[9px] font-bold border ${
                    badges[item.id]?.includes("review")
                      ? "bg-[var(--adm-warning)] text-[var(--adm-on-accent)] border-[var(--adm-warning)] animate-pulse"
                      : active
                        ? "bg-[var(--adm-accent)] text-[var(--adm-on-accent)] border-[var(--adm-accent)]"
                        : "bg-[var(--adm-bg)] text-[var(--adm-text-muted)] border-[var(--adm-border)]"
                  }`}
                >
                  {badges[item.id]}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-1.5 border-t border-[var(--adm-border)] pt-2.5">
        <AdminThemeToggle />
        <AdminButton variant="outline" icon={Gift} onClick={onGift} className="w-full">
          Gift t-shirt
        </AdminButton>
        <AdminButton variant="outline" icon={LogOut} pending={logoutPending} onClick={onLogout} className="w-full">
          Log out
        </AdminButton>
        <Link
          href="/"
          className="mt-1 flex items-center gap-2 rounded-none px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)] transition-colors hover:bg-[var(--adm-surface)] hover:text-[var(--adm-text)] border border-transparent hover:border-[var(--adm-border)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to storefront
        </Link>
      </div>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (username: string, password: string) => Promise<string | null> }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const checkCapsLock = (e: React.KeyboardEvent) => {
    if (e.getModifierState) {
      setCapsLock(e.getModifierState("CapsLock"));
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError("Please enter both username and password");
      return;
    }
    setPending(true);
    const message = await onLogin(username, password);
    if (message) {
      setError(message);
      setPending(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[var(--adm-bg)] p-4 font-mono text-[var(--adm-text)] selection:bg-[var(--adm-warning)] selection:text-[var(--adm-on-accent)]">
      {/* Dynamic Background Glows */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[var(--adm-warning)]/10 blur-[120px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[var(--adm-violet)]/15 blur-[120px]" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--adm-text) 1px, transparent 1px), linear-gradient(to bottom, var(--adm-text) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />

      {/* Main Brutalist Container */}
      <div className="relative w-full max-w-[440px] space-y-6 overflow-hidden rounded-none border border-[var(--adm-border)] bg-[var(--adm-bg)] p-8 text-[var(--adm-text)] font-mono shadow-2xl">
        {/* Portal Header */}
        <div className="text-center space-y-2.5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-none border border-[var(--adm-accent)]/40 bg-[var(--adm-surface)] text-[var(--adm-accent)]">
            <ShieldCheck className="h-7 w-7" />
          </div>
          
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-none border border-[var(--adm-accent)]/30 bg-[var(--adm-accent)]/10 px-3 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--adm-accent)]">
              <span className="h-1.5 w-1.5 rounded-none bg-[var(--adm-accent)] animate-pulse" />
              Restricted Area · Admin Only
            </div>
            <h1 className="mt-2 text-2xl font-black uppercase tracking-tight text-[var(--adm-text)] font-mono">
              SKYWARE Console
            </h1>
            <p className="mt-1 font-mono text-xs text-[var(--adm-text-muted)] leading-normal">
              Sign in with your verified administrative credentials to manage store orders, products, and customer payouts.
            </p>
          </div>
        </div>

        {/* Security Badges Row */}
        <div className="grid grid-cols-3 gap-2 py-1 text-center font-mono text-[10px] text-[var(--adm-text-muted)]">
          <div className="rounded-none border border-[var(--adm-border)] bg-[var(--adm-surface)] p-2 flex flex-col items-center gap-1">
            <Lock className="h-3.5 w-3.5 text-[var(--adm-accent)]" />
            <span>256-Bit SSL</span>
          </div>
          <div className="rounded-none border border-[var(--adm-border)] bg-[var(--adm-surface)] p-2 flex flex-col items-center gap-1">
            <ShieldAlert className="h-3.5 w-3.5 text-[var(--adm-info)]" />
            <span>Rate Limited</span>
          </div>
          <div className="rounded-none border border-[var(--adm-border)] bg-[var(--adm-surface)] p-2 flex flex-col items-center gap-1">
            <KeyRound className="h-3.5 w-3.5 text-[var(--adm-accent)]" />
            <span>12h Session</span>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={submit} className="space-y-4">
          {/* Username Field */}
          <div className="space-y-1.5 text-left">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)] font-mono">
              Admin Username
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--adm-text-muted)]">
                <User className="h-4 w-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                autoFocus
                required
                className="h-12 w-full rounded-none border border-[var(--adm-border)] bg-[var(--adm-surface)] pl-10 pr-3 font-mono text-xs text-[var(--adm-text)] placeholder-[var(--adm-text-muted)] transition-colors focus:border-[var(--adm-accent)] focus:outline-none"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5 text-left">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)] font-mono">
                Admin Password
              </label>
              {capsLock && (
                <span className="flex items-center gap-1 text-[10px] text-[var(--adm-accent)] font-bold animate-pulse">
                  <AlertTriangle className="h-3 w-3" /> Caps Lock is ON
                </span>
              )}
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--adm-text-muted)]">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={checkCapsLock}
                onKeyUp={checkCapsLock}
                placeholder="••••••••••••"
                autoComplete="current-password"
                required
                className="h-12 w-full rounded-none border border-[var(--adm-border)] bg-[var(--adm-surface)] pl-10 pr-11 font-mono text-xs text-[var(--adm-text)] placeholder-[var(--adm-text-muted)] transition-colors focus:border-[var(--adm-accent)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--adm-text-muted)] hover:text-[var(--adm-text)] transition-colors"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 rounded-none border border-[var(--adm-danger)]/40 bg-[var(--adm-surface)] p-3 text-xs text-[var(--adm-danger)] font-mono">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-[var(--adm-danger)]" />
              <div className="font-mono leading-relaxed">{error}</div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={pending}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-none bg-[var(--adm-accent)] hover:bg-[var(--adm-accent)]/90 px-4 font-mono text-xs font-black uppercase tracking-wider text-[var(--adm-on-accent)] transition-colors disabled:opacity-50"
          >
            {pending ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Verifying Security Token…</span>
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                <span>Log In To Admin Console</span>
              </>
            )}
          </button>
        </form>

        {/* Back to Storefront Link */}
        <Link
          href="/"
          className="flex items-center justify-center gap-1.5 border-t border-[var(--adm-border)] pt-4 font-mono text-[11px] text-[var(--adm-text)] transition-colors hover:text-[var(--adm-text)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to customer storefront
        </Link>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- bank & payout reviews desk */

function BankReviewsTab({
  ctl,
  onFocusMember,
}: {
  ctl: AdminController;
  onFocusMember?: (customerId: string) => void;
}) {
  const [filterType, setFilterType] = useState<"ALL" | "BANK" | "UPI" | "APPROVED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const pendingItems = useMemo(() => {
    const list: {
      customer: CustomerAccount;
      bank?: BankAccount;
      pendingBankUpdate?: NonNullable<BankAccount["pendingUpdate"]>;
      hasPendingUpi: boolean;
      pendingUpiId?: string;
    }[] = [];

    (ctl.snapshot.customers || []).forEach((c) => {
      const bank = (c.bankAccounts || []).find((b) => b.status === "PENDING_REVIEW" || Boolean(b.pendingUpdate));
      const hasPendingUpi = c.upiStatus === "PENDING_REVIEW" && Boolean(c.pendingUpiId);
      const pendingBankUpdate = bank?.pendingUpdate || (bank?.status === "PENDING_REVIEW" ? {
        accountHolderName: bank.accountHolderName,
        accountNumber: bank.accountNumber,
        accountNumberLast4: bank.accountNumberLast4 || bank.maskedAccountNumber || "XXXX",
        ifscCode: bank.ifscCode,
        bankName: bank.bankName,
        requestedAt: bank.addedAt || new Date().toISOString(),
      } : undefined);

      if (pendingBankUpdate || hasPendingUpi) {
        list.push({
          customer: c,
          bank,
          pendingBankUpdate,
          hasPendingUpi,
          pendingUpiId: c.pendingUpiId,
        });
      }
    });

    return list;
  }, [ctl.snapshot.customers]);

  const approvedItems = useMemo(() => {
    const list: {
      customer: CustomerAccount;
      bankAccounts: BankAccount[];
      upiId?: string;
    }[] = [];

    (ctl.snapshot.customers || []).forEach((c) => {
      const verifiedBanks = (c.bankAccounts || []).filter(
        (b) => b.status === "VERIFIED" || (b.verified && b.status !== "PENDING_REVIEW" && !b.pendingUpdate)
      );
      const hasVerifiedUpi = Boolean(
        c.savedUpiId && c.savedUpiId.trim().length > 0 && c.upiStatus !== "PENDING_REVIEW"
      );

      if (verifiedBanks.length > 0 || hasVerifiedUpi) {
        list.push({
          customer: c,
          bankAccounts: verifiedBanks,
          upiId: hasVerifiedUpi ? c.savedUpiId : undefined,
        });
      }
    });

    return list;
  }, [ctl.snapshot.customers]);

  const bankCount = pendingItems.filter((item) => Boolean(item.pendingBankUpdate)).length;
  const upiCount = pendingItems.filter((item) => item.hasPendingUpi).length;

  const filteredItems = useMemo(() => {
    return pendingItems.filter((item) => {
      if (filterType === "APPROVED") return false;
      if (filterType === "BANK" && !item.pendingBankUpdate) return false;
      if (filterType === "UPI" && !item.hasPendingUpi) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = item.customer.name.toLowerCase().includes(q);
      const phoneMatch = item.customer.phone.toLowerCase().includes(q);
      const emailMatch = (item.customer.email || "").toLowerCase().includes(q);
      const idMatch = item.customer.id.toLowerCase().includes(q);
      const ifscMatch = (item.pendingBankUpdate?.ifscCode || item.bank?.ifscCode || "").toLowerCase().includes(q);
      const acctMatch = (item.pendingBankUpdate?.accountNumber || item.pendingBankUpdate?.accountNumberLast4 || item.bank?.accountNumber || item.bank?.accountNumberLast4 || "").toLowerCase().includes(q);
      const upiMatch = (item.pendingUpiId || item.customer.savedUpiId || "").toLowerCase().includes(q);

      return nameMatch || phoneMatch || emailMatch || idMatch || ifscMatch || acctMatch || upiMatch;
    });
  }, [pendingItems, filterType, searchQuery]);

  const filteredApprovedItems = useMemo(() => {
    if (!searchQuery.trim()) return approvedItems;
    const q = searchQuery.toLowerCase().trim();
    return approvedItems.filter((item) => {
      const nameMatch = item.customer.name.toLowerCase().includes(q);
      const phoneMatch = item.customer.phone.toLowerCase().includes(q);
      const emailMatch = (item.customer.email || "").toLowerCase().includes(q);
      const idMatch = item.customer.id.toLowerCase().includes(q);
      const bankMatch = item.bankAccounts.some(
        (b) =>
          b.ifscCode.toLowerCase().includes(q) ||
          b.bankName.toLowerCase().includes(q) ||
          b.accountHolderName.toLowerCase().includes(q) ||
          (b.accountNumber || b.accountNumberLast4 || "").toLowerCase().includes(q)
      );
      const upiMatch = (item.upiId || "").toLowerCase().includes(q);
      return nameMatch || phoneMatch || emailMatch || idMatch || bankMatch || upiMatch;
    });
  }, [approvedItems, searchQuery]);

  const handleApprove = async (customerId: string, type: "UPI" | "BANK", name: string) => {
    await ctl.run(`approve-${type.toLowerCase()}-${customerId}`, async () => {
      const res = await fetch(`/api/admin/customers/${customerId}/payout-method`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", type }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Approval failed" }));
        throw new Error(err.error || "Approval failed");
      }
      return res.json();
    }, { successMessage: `Approved ${type === "BANK" ? "bank account" : "UPI ID"} for ${name} — moved to Approved` });
    void ctl.refresh();
  };

  const handleReject = async (customerId: string, type: "UPI" | "BANK", name: string) => {
    const reason = prompt("Enter rejection reason for customer:") || "Change request rejected by admin.";
    await ctl.run(`reject-${type.toLowerCase()}-${customerId}`, async () => {
      const res = await fetch(`/api/admin/customers/${customerId}/payout-method`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REJECT", type, reason }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Rejection failed" }));
        throw new Error(err.error || "Rejection failed");
      }
      return res.json();
    }, { successMessage: `Rejected ${type === "BANK" ? "bank account" : "UPI ID"} change request for ${name}` });
    void ctl.refresh();
  };

  return (
    <div className="space-y-4">
      <ConsoleHero
        eyebrow="Verification Desk"
        title="Bank & Payout Reviews"
        subtitle="Dedicated portal for reviewing and approving member bank account and UPI change requests. Real, unmasked bank account numbers and IFSC codes are displayed so you can verify credentials and send payments with 100% confidence."
        icon={Building2}
        actions={
          <AdminButton
            variant="ghost"
            size="sm"
            icon={RefreshCw}
            pending={ctl.isPending("refresh")}
            onClick={() => void ctl.refresh()}
          >
            Refresh Desk
          </AdminButton>
        }
      />

      <div className="grid grid-cols-1 gap-px overflow-hidden border border-[var(--adm-border)] bg-[var(--adm-fill)] sm:grid-cols-4">
        <div className="bg-[var(--adm-surface)] px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--adm-text-muted)]">Total Pending Reviews</p>
          <p className="mt-1 font-mono text-xl font-bold leading-none tabular-nums text-[var(--adm-warning)]">
            {pendingItems.length}
          </p>
          <p className="mt-1 truncate text-[10px] text-[var(--adm-text-muted)]">Requires admin approval before payouts</p>
        </div>
        <div className="bg-[var(--adm-surface)] px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--adm-text-muted)]">Bank Account Changes</p>
          <p className="mt-1 font-mono text-xl font-bold leading-none tabular-nums text-[var(--adm-text)]">
            {bankCount}
          </p>
          <p className="mt-1 truncate text-[10px] text-[var(--adm-text-muted)]">IMPS / NEFT accounts under review</p>
        </div>
        <div className="bg-[var(--adm-surface)] px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--adm-text-muted)]">UPI ID Changes</p>
          <p className="mt-1 font-mono text-xl font-bold leading-none tabular-nums text-[var(--adm-warning)]">
            {upiCount}
          </p>
          <p className="mt-1 truncate text-[10px] text-[var(--adm-text-muted)]">VPA address updates</p>
        </div>
        <div className="bg-[var(--adm-surface)] px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--adm-text-muted)]">Approved Accounts</p>
          <p className="mt-1 font-mono text-xl font-bold leading-none tabular-nums text-[var(--adm-accent)]">
            {approvedItems.length}
          </p>
          <p className="mt-1 truncate text-[10px] text-[var(--adm-text-muted)]">Verified & ready for payouts</p>
        </div>
      </div>

      <div className="border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setFilterType("ALL")}
            className={`px-3 py-1.5 font-mono text-xs font-bold uppercase transition-colors ${
              filterType === "ALL"
                ? "bg-[var(--adm-accent)] text-[var(--adm-on-accent)]"
                : "bg-[var(--adm-bg)] text-[var(--adm-text-muted)] hover:text-[var(--adm-text)] border border-[var(--adm-border)]"
            }`}
          >
            All Requests ({pendingItems.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("BANK")}
            className={`px-3 py-1.5 font-mono text-xs font-bold uppercase transition-colors ${
              filterType === "BANK"
                ? "bg-[var(--adm-accent)] text-[var(--adm-on-accent)]"
                : "bg-[var(--adm-bg)] text-[var(--adm-text-muted)] hover:text-[var(--adm-text)] border border-[var(--adm-border)]"
            }`}
          >
            Bank Only ({bankCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("UPI")}
            className={`px-3 py-1.5 font-mono text-xs font-bold uppercase transition-colors ${
              filterType === "UPI"
                ? "bg-[var(--adm-accent)] text-[var(--adm-on-accent)]"
                : "bg-[var(--adm-bg)] text-[var(--adm-text-muted)] hover:text-[var(--adm-text)] border border-[var(--adm-border)]"
            }`}
          >
            UPI Only ({upiCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("APPROVED")}
            className={`px-3 py-1.5 font-mono text-xs font-bold uppercase transition-colors ${
              filterType === "APPROVED"
                ? "bg-[var(--adm-accent)] text-[var(--adm-on-accent)]"
                : "bg-[var(--adm-bg)] text-[var(--adm-accent)] hover:bg-[var(--adm-accent)]/10 border border-[var(--adm-accent)]/30"
            }`}
          >
            Approved ({approvedItems.length})
          </button>
        </div>

        <div className="flex min-w-0 w-full sm:w-80 items-center gap-2 border border-[var(--adm-border)] bg-[var(--adm-bg)] px-2.5 py-1.5 focus-within:border-[var(--adm-accent)]">
          <Search className="h-3.5 w-3.5 shrink-0 text-[var(--adm-text-muted)]" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search member, phone, IFSC, account..."
            className="w-full min-w-0 bg-transparent font-mono text-xs text-[var(--adm-text)] placeholder:text-[var(--adm-text-muted)] focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]"
            >
              <XCircle className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {filterType === "APPROVED" ? (
        filteredApprovedItems.length === 0 ? (
          <div className="border border-[var(--adm-border)] bg-[var(--adm-surface)] p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--adm-accent)]/10 text-[var(--adm-accent)]">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h3 className="mt-4 font-mono text-sm font-bold uppercase tracking-wider text-[var(--adm-text)]">
              {approvedItems.length === 0
                ? "No Approved Payout Methods Yet"
                : "No Approved Accounts Match Search"}
            </h3>
            <p className="mx-auto mt-2 max-w-md font-mono text-xs text-[var(--adm-text-muted)]">
              {approvedItems.length === 0
                ? "Once you approve pending bank account or UPI requests, they will appear here with full copyable payment details."
                : "Try clearing your search filter to see all approved accounts."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredApprovedItems.map((item) => {
              const { customer, bankAccounts, upiId } = item;
              return (
                <div
                  key={customer.id}
                  className="border border-[var(--adm-accent)]/40 bg-[var(--adm-surface)] overflow-hidden"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--adm-border)] bg-[var(--adm-bg)] px-4 py-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <MemberAvatar name={customer.name} tier={customer.tier} />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-bold text-[var(--adm-text)]">
                            {customer.name}
                          </span>
                          <span className="border border-[var(--adm-accent)]/40 bg-[var(--adm-accent)]/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-[var(--adm-accent)]">
                            APPROVED
                          </span>
                          <span
                            className={`border border-[var(--adm-border)] bg-[var(--adm-surface)] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase ${getTierStyle(customer.tier)}`}
                          >
                            {customer.tier}
                          </span>
                          <span className="font-mono text-xs text-[var(--adm-text-muted)]">
                            ID: {customer.id}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-3 font-mono text-xs text-[var(--adm-text-muted)]">
                          <span>📞 {customer.phone}</span>
                          {customer.email && <span>✉️ {customer.email}</span>}
                        </div>
                      </div>
                    </div>

                    {onFocusMember && (
                      <button
                        type="button"
                        onClick={() => onFocusMember(customer.id)}
                        className="inline-flex items-center gap-1 border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-1 font-mono text-xs text-[var(--adm-accent)] hover:bg-[var(--adm-accent)]/10 transition-colors"
                      >
                        <User className="h-3.5 w-3.5" />
                        Open Full Profile →
                      </button>
                    )}
                  </div>

                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {bankAccounts.map((bank) => {
                      const acctText =
                        bank.accountNumber ||
                        (bank.accountNumberLast4
                          ? `••••${bank.accountNumberLast4}`
                          : bank.maskedAccountNumber || "—");
                      return (
                        <div
                          key={bank.id}
                          className="rounded border border-[var(--adm-accent)]/30 bg-[var(--adm-bg)] p-4 space-y-2.5 font-mono text-xs"
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-[var(--adm-border)] pb-2">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-[var(--adm-accent)]" />
                              <span className="font-bold uppercase tracking-wider text-[var(--adm-accent)]">
                                Verified Bank Account
                              </span>
                            </div>
                            <span className="bg-[var(--adm-accent)]/15 text-[var(--adm-accent)] px-1.5 py-0.5 text-[9px] font-bold uppercase">
                              {bank.bankName}
                            </span>
                          </div>

                          <div className="border border-[var(--adm-accent)]/20 bg-[var(--adm-surface)] p-2 rounded flex items-center justify-between gap-2">
                            <div>
                              <span className="text-[10px] text-[var(--adm-text-muted)] block uppercase">Account Number</span>
                              <span className="text-sm font-bold text-[var(--adm-text)] tracking-widest select-all">
                                {acctText}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                copyToClipboard(bank.accountNumber || bank.accountNumberLast4 || "", ctl, "Account number copied");
                              }}
                              className="inline-flex items-center gap-1 bg-[var(--adm-accent)] text-[var(--adm-on-accent)] px-2.5 py-1 text-xs font-bold hover:bg-[var(--adm-accent)] transition-colors"
                            >
                              <Copy className="h-3 w-3" /> Copy
                            </button>
                          </div>

                          <div className="flex items-center justify-between gap-2 border border-[var(--adm-border-soft)] bg-[var(--adm-surface)] p-2 rounded">
                            <div>
                              <span className="text-[10px] text-[var(--adm-text-muted)] block uppercase">IFSC Code</span>
                              <span className="font-bold text-[var(--adm-text)] select-all">{bank.ifscCode}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                copyToClipboard(bank.ifscCode, ctl, "IFSC copied");
                              }}
                              className="inline-flex items-center gap-1 bg-[var(--adm-tint-10)] text-[var(--adm-text)] px-2 py-1 text-xs hover:bg-[var(--adm-tint-20)] transition-colors"
                            >
                              <Copy className="h-3 w-3" /> Copy
                            </button>
                          </div>

                          <div className="flex items-center justify-between gap-2 border border-[var(--adm-border-soft)] bg-[var(--adm-surface)] p-2 rounded">
                            <div>
                              <span className="text-[10px] text-[var(--adm-text-muted)] block uppercase">Account Holder</span>
                              <span className="font-bold text-[var(--adm-text)] select-all">{bank.accountHolderName}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                copyToClipboard(bank.accountHolderName, ctl, "Holder name copied");
                              }}
                              className="inline-flex items-center gap-1 bg-[var(--adm-tint-10)] text-[var(--adm-text)] px-2 py-1 text-xs hover:bg-[var(--adm-tint-20)] transition-colors"
                            >
                              <Copy className="h-3 w-3" /> Copy
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {upiId && (
                      <div className="rounded border border-[var(--adm-accent)]/30 bg-[var(--adm-bg)] p-4 space-y-2.5 font-mono text-xs">
                        <div className="flex items-center justify-between gap-2 border-b border-[var(--adm-border)] pb-2">
                          <div className="flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-[var(--adm-accent)]" />
                            <span className="font-bold uppercase tracking-wider text-[var(--adm-accent)]">
                              Verified UPI ID
                            </span>
                          </div>
                          <span className="bg-[var(--adm-accent)]/15 text-[var(--adm-accent)] px-1.5 py-0.5 text-[9px] font-bold uppercase">
                            ACTIVE VPA
                          </span>
                        </div>

                        <div className="border border-[var(--adm-accent)]/20 bg-[var(--adm-surface)] p-2.5 rounded flex items-center justify-between gap-2">
                          <div>
                            <span className="text-[10px] text-[var(--adm-text-muted)] block uppercase">UPI VPA</span>
                            <span className="text-sm font-bold text-[var(--adm-text)] select-all">{upiId}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              copyToClipboard(upiId, ctl, "UPI ID copied");
                            }}
                            className="inline-flex items-center gap-1 bg-[var(--adm-accent)] text-[var(--adm-on-accent)] px-2.5 py-1 text-xs font-bold hover:bg-[var(--adm-accent)] transition-colors"
                          >
                            <Copy className="h-3 w-3" /> Copy UPI
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : filteredItems.length === 0 ? (
        <div className="border border-[var(--adm-border)] bg-[var(--adm-surface)] p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--adm-accent)]/10 text-[var(--adm-accent)]">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h3 className="mt-4 font-mono text-sm font-bold uppercase tracking-wider text-[var(--adm-text)]">
            {pendingItems.length === 0
              ? "All Payout Methods Verified"
              : "No Requests Match Current Filter"}
          </h3>
          <p className="mx-auto mt-2 max-w-md font-mono text-xs text-[var(--adm-text-muted)]">
            {pendingItems.length === 0
              ? "There are currently zero pending bank account or UPI review requests. Whenever a member updates their payout destination, it will appear here for verification and approval."
              : "Try switching filter tabs or clearing your search term to see pending review requests."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item) => {
            const { customer, bank, pendingBankUpdate, hasPendingUpi, pendingUpiId } = item;
            return (
              <div
                key={customer.id}
                className="border border-[var(--adm-warning)]/50 bg-[var(--adm-surface)] overflow-hidden"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--adm-border)] bg-[var(--adm-bg)] px-4 py-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <MemberAvatar name={customer.name} tier={customer.tier} />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold text-[var(--adm-text)]">
                          {customer.name}
                        </span>
                        <span
                          className={`border border-[var(--adm-border)] bg-[var(--adm-surface)] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase ${getTierStyle(customer.tier)}`}
                        >
                          {customer.tier}
                        </span>
                        <span className="font-mono text-xs text-[var(--adm-text-muted)]">
                          ID: {customer.id}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 font-mono text-xs text-[var(--adm-text-muted)]">
                        <span>📞 {customer.phone}</span>
                        {customer.email && <span>✉️ {customer.email}</span>}
                      </div>
                    </div>
                  </div>

                  {onFocusMember && (
                    <button
                      type="button"
                      onClick={() => onFocusMember(customer.id)}
                      className="inline-flex items-center gap-1 border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-1 font-mono text-xs text-[var(--adm-accent)] hover:bg-[var(--adm-accent)]/10 transition-colors"
                    >
                      <User className="h-3.5 w-3.5" />
                      Open Full Profile →
                    </button>
                  )}
                </div>

                <div className="p-4 space-y-4">
                  {pendingBankUpdate && (
                    <div className="rounded border border-[var(--adm-warning)]/40 bg-[var(--adm-bg)] p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--adm-border)] pb-2.5">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-[var(--adm-warning)]" />
                          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--adm-warning)]">
                            Bank Account Change Request
                          </span>
                        </div>
                        {pendingBankUpdate.requestedAt && (
                          <span className="font-mono text-[11px] text-[var(--adm-text-muted)]">
                            Submitted: {dateTimeLabel(pendingBankUpdate.requestedAt)}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="border border-[var(--adm-border-soft)] bg-[var(--adm-surface)] p-3 space-y-2">
                          <p className="font-mono text-[10px] uppercase font-bold text-[var(--adm-text-muted)] tracking-wider border-b border-[var(--adm-border-soft)] pb-1">
                            Currently Bound Account
                          </p>
                          {bank ? (
                            <div className="space-y-2 text-xs font-mono">
                              <div>
                                <span className="text-[10px] text-[var(--adm-text-muted)] block">Bank Name</span>
                                <span className="text-[var(--adm-text)] font-bold">{bank.bankName}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-[var(--adm-text-muted)] block">Account Number</span>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono text-[var(--adm-text)] font-bold tracking-wider">
                                    {bank.accountNumber || (bank.accountNumberLast4 ? `••••${bank.accountNumberLast4}` : (bank.maskedAccountNumber || "None"))}
                                  </span>
                                  {(bank.accountNumber || bank.accountNumberLast4) && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        copyToClipboard(bank.accountNumber || bank.accountNumberLast4 || "", ctl, "Current account number copied");
                                      }}
                                      className="p-1 hover:text-[var(--adm-accent)] text-[var(--adm-text-muted)]"
                                      title="Copy Account Number"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <span className="text-[10px] text-[var(--adm-text-muted)] block">IFSC Code</span>
                                  <span className="text-[var(--adm-text)] font-bold">{bank.ifscCode}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    copyToClipboard(bank.ifscCode, ctl, "IFSC copied");
                                  }}
                                  className="p-1 hover:text-[var(--adm-accent)] text-[var(--adm-text-muted)]"
                                  title="Copy IFSC"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                              <div>
                                <span className="text-[10px] text-[var(--adm-text-muted)] block">Account Holder</span>
                                <span className="text-[var(--adm-text)]">{bank.accountHolderName}</span>
                              </div>
                            </div>
                          ) : (
                            <p className="font-mono text-xs text-[var(--adm-text-muted)] py-4">No bank account currently bound</p>
                          )}
                        </div>

                        <div className="border border-[var(--adm-warning)]/50 bg-[var(--adm-warning)]/6 p-3 space-y-2">
                          <p className="font-mono text-[10px] uppercase font-bold text-[var(--adm-warning)] tracking-wider border-b border-[var(--adm-warning)]/20 pb-1 flex items-center justify-between">
                            <span>Requested New Bank Details</span>
                            <span className="bg-[var(--adm-warning)]/20 text-[var(--adm-warning)] px-1.5 py-0.5 text-[9px]">PENDING APPROVAL</span>
                          </p>
                          <div className="space-y-2.5 text-xs font-mono">
                            <div>
                              <span className="text-[10px] text-[var(--adm-text-muted)] block">Bank Name</span>
                              <span className="text-[var(--adm-text)] font-bold">{pendingBankUpdate.bankName}</span>
                            </div>

                            <div className="border border-[var(--adm-warning)]/30 bg-[var(--adm-bg)] p-2 rounded">
                              <span className="text-[10px] text-[var(--adm-warning)] font-bold block uppercase tracking-wider">
                                Full Account Number (Decrypted Plaintext)
                              </span>
                              <div className="mt-1 flex items-center justify-between gap-2">
                                <span className="font-mono text-sm font-bold text-[var(--adm-text)] tracking-widest select-all">
                                  {pendingBankUpdate.accountNumber || (pendingBankUpdate.accountNumberLast4 ? `••••${pendingBankUpdate.accountNumberLast4}` : (pendingBankUpdate.maskedAccountNumber || "—"))}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const acct = pendingBankUpdate.accountNumber || pendingBankUpdate.accountNumberLast4 || "";
                                    copyToClipboard(acct, ctl, "Full account number copied to clipboard");
                                  }}
                                  className="inline-flex items-center gap-1.5 bg-[var(--adm-warning)] text-[var(--adm-on-accent)] px-2.5 py-1 text-xs font-bold hover:bg-[var(--adm-warning)] transition-colors"
                                >
                                  <Copy className="h-3 w-3" />
                                  Copy Account No
                                </button>
                              </div>
                            </div>

                            <div className="border border-[var(--adm-border)] bg-[var(--adm-bg)] p-2 rounded flex items-center justify-between gap-2">
                              <div>
                                <span className="text-[10px] text-[var(--adm-text-muted)] block uppercase tracking-wider">IFSC Code</span>
                                <span className="font-mono text-xs font-bold text-[var(--adm-text)] tracking-wider select-all">
                                  {pendingBankUpdate.ifscCode}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  copyToClipboard(pendingBankUpdate.ifscCode, ctl, "IFSC code copied to clipboard");
                                }}
                                className="inline-flex items-center gap-1 bg-[var(--adm-tint-10)] text-[var(--adm-text)] px-2 py-1 text-xs hover:bg-[var(--adm-tint-20)] transition-colors"
                              >
                                <Copy className="h-3 w-3" />
                                Copy IFSC
                              </button>
                            </div>

                            <div className="border border-[var(--adm-border)] bg-[var(--adm-bg)] p-2 rounded flex items-center justify-between gap-2">
                              <div>
                                <span className="text-[10px] text-[var(--adm-text-muted)] block uppercase tracking-wider">Account Holder Name</span>
                                <span className="font-mono text-xs font-bold text-[var(--adm-text)] select-all">
                                  {pendingBankUpdate.accountHolderName}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  copyToClipboard(pendingBankUpdate.accountHolderName, ctl, "Holder name copied");
                                }}
                                className="inline-flex items-center gap-1 bg-[var(--adm-tint-10)] text-[var(--adm-text)] px-2 py-1 text-xs hover:bg-[var(--adm-tint-20)] transition-colors"
                              >
                                <Copy className="h-3 w-3" />
                                Copy Name
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-[var(--adm-border)]">
                        <AdminButton
                          size="sm"
                          variant="outline"
                          pending={ctl.isPending(`reject-bank-${customer.id}`)}
                          onClick={() => void handleReject(customer.id, "BANK", customer.name)}
                        >
                          Reject Bank Request
                        </AdminButton>
                        <AdminButton
                          size="sm"
                          variant="primary"
                          icon={Check}
                          pending={ctl.isPending(`approve-bank-${customer.id}`)}
                          onClick={() => void handleApprove(customer.id, "BANK", customer.name)}
                        >
                          Approve Bank Change
                        </AdminButton>
                      </div>
                    </div>
                  )}

                  {hasPendingUpi && pendingUpiId && (
                    <div className="rounded border border-[var(--adm-accent)]/40 bg-[var(--adm-bg)] p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--adm-border)] pb-2.5">
                        <div className="flex items-center gap-2">
                          <Wallet className="h-4 w-4 text-[var(--adm-accent)]" />
                          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--adm-accent)]">
                            UPI ID Change Request
                          </span>
                        </div>
                        {customer.pendingUpiRequestedAt && (
                          <span className="font-mono text-[11px] text-[var(--adm-text-muted)]">
                            Submitted: {dateTimeLabel(customer.pendingUpiRequestedAt)}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="border border-[var(--adm-border-soft)] bg-[var(--adm-surface)] p-3 space-y-2">
                          <p className="font-mono text-[10px] uppercase font-bold text-[var(--adm-text-muted)] tracking-wider border-b border-[var(--adm-border-soft)] pb-1">
                            Currently Bound UPI ID
                          </p>
                          <p className="font-mono text-sm font-bold text-[var(--adm-text)]">
                            {customer.savedUpiId || "No UPI ID currently linked"}
                          </p>
                        </div>

                        <div className="border border-[var(--adm-accent)]/40 bg-[var(--adm-accent)]/5 p-3 space-y-2">
                          <p className="font-mono text-[10px] uppercase font-bold text-[var(--adm-accent)] tracking-wider border-b border-[var(--adm-accent)]/20 pb-1 flex items-center justify-between">
                            <span>Requested New UPI ID</span>
                            <span className="bg-[var(--adm-accent)]/20 text-[var(--adm-accent)] px-1.5 py-0.5 text-[9px]">PENDING APPROVAL</span>
                          </p>
                          <div className="border border-[var(--adm-accent)]/30 bg-[var(--adm-bg)] p-2.5 rounded flex items-center justify-between gap-2">
                            <span className="font-mono text-sm font-bold text-[var(--adm-text)] select-all">
                              {pendingUpiId}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                copyToClipboard(pendingUpiId, ctl, "UPI ID copied to clipboard");
                              }}
                              className="inline-flex items-center gap-1.5 bg-[var(--adm-accent)] text-[var(--adm-on-accent)] px-2.5 py-1 text-xs font-bold hover:bg-[var(--adm-accent)] transition-colors"
                            >
                              <Copy className="h-3 w-3" />
                              Copy UPI
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-[var(--adm-border)]">
                        <AdminButton
                          size="sm"
                          variant="outline"
                          pending={ctl.isPending(`reject-upi-${customer.id}`)}
                          onClick={() => void handleReject(customer.id, "UPI", customer.name)}
                        >
                          Reject UPI Request
                        </AdminButton>
                        <AdminButton
                          size="sm"
                          variant="primary"
                          icon={Check}
                          pending={ctl.isPending(`approve-upi-${customer.id}`)}
                          onClick={() => void handleApprove(customer.id, "UPI", customer.name)}
                        >
                          Approve UPI Change
                        </AdminButton>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- overview */

function OverviewTab({ ctl, onNewProduct }: { ctl: AdminController; onNewProduct: () => void }) {
  const snapshot = ctl.snapshot;
  const metrics = snapshot.metrics;
  const pipeline = [...snapshot.orderFlow, "CANCELLED"] as OrderStatus[];
  const dueRequests = snapshot.withdrawals.filter((request) =>
    request.tranches.some((tranche) => tranche.status === "UNLOCKED")
  ).length;

  const tiles: {
    label: string;
    value: string;
    sub: string;
    tone: string;
    go: () => void;
  }[] = [
    {
      label: "Cash received",
      value: formatMoney(metrics.grossRevenue),
      sub: "verified online + COD",
      tone: "text-[var(--adm-accent)]",
      go: () => ctl.setTab("orders"),
    },
    {
      label: "Coins in circulation",
      value: formatCount(metrics.coinsInCirculation),
      sub: "reward liability",
      tone: "text-[var(--adm-text)]",
      go: () => ctl.setTab("customers"),
    },
    {
      label: "Ready to pay",
      value: formatCount(metrics.pendingPayableCoins),
      sub: dueRequests > 0 ? `${dueRequests} payout${dueRequests === 1 ? "" : "s"} due` : "nothing due",
      tone: dueRequests > 0 ? "text-[var(--adm-warning)]" : "text-[var(--adm-text)]",
      go: () => ctl.setTab("withdrawals"),
    },
    {
      label: "Open orders",
      value: formatCount(metrics.pipelineCount),
      sub: `${formatCount(metrics.orderCount)} on record`,
      tone: "text-[var(--adm-text)]",
      go: () => ctl.setTab("orders"),
    },
  ];

  const links: { label: string; hint: string; icon: LucideIcon; go: () => void }[] = [
    { label: "Who to pay", hint: "Withdrawals desk", icon: DollarSign, go: () => ctl.setTab("withdrawals") },
    { label: "Reward & shipping", hint: "Cashback, shipping charge, minimum order", icon: Settings, go: () => ctl.setTab("rules") },
    { label: "Gift a t-shirt", hint: "Complimentary dispatch", icon: Gift, go: ctl.openGiftDispatch },
  ];

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--adm-border)] pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 bg-[var(--adm-accent)]" aria-hidden="true" />
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--adm-text-muted)]">Live from server ledger</p>
          </div>
          <h1
            className="mt-1 text-2xl font-bold uppercase tracking-tight text-[var(--adm-text)]"
            style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
          >
            Overview
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <AdminButton
            variant="ghost"
            size="sm"
            icon={RefreshCw}
            pending={ctl.isPending("refresh")}
            onClick={() => void ctl.refresh()}
          >
            Refresh
          </AdminButton>
          <AdminButton variant="primary" size="sm" icon={Plus} onClick={onNewProduct}>
            New drop
          </AdminButton>
        </div>
      </header>

      {ctl.snapshot.customers.some((c) =>
        (c.bankAccounts || []).some((b) => b.status === "PENDING_REVIEW" || Boolean(b.pendingUpdate)) ||
        (c.upiStatus === "PENDING_REVIEW" && Boolean(c.pendingUpiId))
      ) && (
        <div className="border border-[var(--adm-warning)]/50 bg-[var(--adm-warning)]/8 p-3 text-xs flex flex-wrap items-center justify-between gap-3 font-mono">
          <div className="flex items-center gap-2 text-[var(--adm-warning)]">
            <AlertTriangle className="h-4 w-4 shrink-0 animate-pulse" />
            <span>
              <strong>Bank Account / UPI Change Requests</strong> are pending review.
            </span>
          </div>
          <AdminButton
            size="sm"
            variant="primary"
            onClick={() => ctl.setTab("bank-reviews")}
          >
            Open Bank &amp; UPI Reviews Desk →
          </AdminButton>
        </div>
      )}

      <div className="grid grid-cols-2 gap-px overflow-hidden border border-[var(--adm-border)] bg-[var(--adm-fill)] lg:grid-cols-4">
        {tiles.map((tile) => (
          <button
            key={tile.label}
            type="button"
            onClick={tile.go}
            className="group min-w-0 bg-[var(--adm-surface)] px-4 py-3.5 text-left transition-colors hover:bg-[var(--adm-bg)]"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="truncate text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--adm-text-muted)]">
                {tile.label}
              </span>
              <ChevronRight className="h-3 w-3 shrink-0 text-[var(--adm-on-accent)] transition-colors group-hover:text-[var(--adm-text-muted)]" />
            </span>
            <span className={`mt-1.5 block truncate font-mono text-2xl font-bold leading-none tabular-nums ${tile.tone}`}>
              {tile.value}
            </span>
            <span className="mt-1.5 block truncate text-[10px] text-[var(--adm-text-muted)]">{tile.sub}</span>
          </button>
        ))}
      </div>

      {dueRequests > 0 ? (
        <button
          type="button"
          onClick={() => ctl.setTab("withdrawals")}
          className="flex items-center justify-between gap-3 border border-[var(--adm-warning)]/40 bg-[var(--adm-warning)]/6 px-4 py-2.5 text-left transition-colors hover:bg-[var(--adm-warning)]/10"
        >
          <span className="flex min-w-0 items-center gap-2 text-[11px] text-[var(--adm-warning)]">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {formatCount(metrics.pendingPayableCoins)} coins across {dueRequests} payout
              {dueRequests === 1 ? "" : "s"} are due now.
            </span>
          </span>
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-[var(--adm-warning)]">Pay now</span>
        </button>
      ) : null}

      <Panel>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--adm-border)] px-4 py-2.5">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--adm-text-muted)]">Order pipeline</h2>
          <button
            type="button"
            onClick={() => ctl.setTab("orders")}
            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)] transition-colors hover:text-[var(--adm-text)]"
          >
            Open orders
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-px bg-[var(--adm-fill)] sm:grid-cols-4 xl:grid-cols-8">
          {pipeline.map((status) => {
            const count = metrics.statusCounts[status] ?? 0;
            const shortLabel =
              status === "PRINTING_POD"
                ? "PRINTING"
                : status === "MANIFEST_GENERATED"
                  ? "MANIFEST"
                  : status.replace(/_/g, " ");
            return (
              <button
                key={status}
                type="button"
                onClick={() => ctl.setTab("orders")}
                className="min-w-0 bg-[var(--adm-surface)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--adm-bg)]"
              >
                <span className="flex items-center gap-1.5">
                  {status !== "CANCELLED" ? (
                    <span
                      className={`h-1.5 w-1.5 shrink-0 ${count > 0 ? "bg-[var(--adm-accent)]" : "bg-[var(--adm-fill)]"}`}
                      aria-hidden="true"
                    />
                  ) : null}
                  <span className="truncate text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--adm-text-muted)]">
                    {shortLabel}
                  </span>
                </span>
                <span className="mt-1 block font-mono text-lg font-bold leading-none tabular-nums text-[var(--adm-text)]">
                  {formatCount(count)}
                </span>
              </button>
            );
          })}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--adm-border)] px-4 py-2.5">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--adm-text-muted)]">Latest activity</h2>
            <button
              type="button"
              onClick={() => ctl.setTab("audit")}
              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)] transition-colors hover:text-[var(--adm-text)]"
            >
              Audit log
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="divide-y divide-[var(--adm-border)]">
            {snapshot.auditLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="px-4 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--adm-accent)]">
                    {log.action}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-[var(--adm-text-muted)]">{dateTimeLabel(log.at)}</span>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-[var(--adm-text-dim)]">{log.details}</p>
              </div>
            ))}
            {snapshot.auditLogs.length === 0 ? (
              <p className="px-4 py-6 text-center text-[11px] text-[var(--adm-text-muted)]">No activity yet.</p>
            ) : null}
          </div>
        </Panel>

        <Panel>
          <div className="border-b border-[var(--adm-border)] px-4 py-2.5">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--adm-text-muted)]">Jump to</h2>
          </div>
          <div className="divide-y divide-[var(--adm-border)]">
            {links.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.go}
                className="group flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--adm-bg)]"
              >
                <item.icon className="h-4 w-4 shrink-0 text-[var(--adm-text-muted)] transition-colors group-hover:text-[var(--adm-accent)]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text)]">
                    {item.label}
                  </span>
                  <span className="block truncate text-[10px] text-[var(--adm-text-muted)]">{item.hint}</span>
                </span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--adm-on-accent)] transition-colors group-hover:text-[var(--adm-text-muted)]" />
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ orders */

const TONE_PAID = "border-[var(--adm-accent)]/40 bg-transparent text-[var(--adm-accent)]";
const TONE_UNPAID = "border-[var(--adm-warning)]/40 bg-transparent text-[var(--adm-warning)]";

/* ---------------------------------------------------------------- products */

function ProductsTab({ ctl, onEdit }: { ctl: AdminController; onEdit: (draft: Product | "new") => void }) {
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(true);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ctl.snapshot.products.filter((product) => {
      // Anime back-print drops are managed on their own desk.
      if (isAnimeDeskRow(product)) return false;
      if (!showArchived && product.isArchived) return false;
      if (!needle) return true;
      return product.title.toLowerCase().includes(needle) || product.category.toLowerCase().includes(needle);
    });
  }, [ctl.snapshot.products, query, showArchived]);

  const liveCount = visible.filter((product) => !product.isArchived).length;
  const archivedCount = visible.filter((product) => product.isArchived).length;
  const unitsOnHand = visible.reduce((sum, product) => sum + (product.stock ?? 0), 0);
  const inventoryValue = visible.reduce((sum, product) => sum + product.price * (product.stock ?? 0), 0);

  return (
    <>
      <ConsoleHero
        eyebrow="Product desk"
        title="Drop catalogue"
        subtitle="Create, reprice and archive the T-Shirt drops the storefront sells."
        icon={Layers}
        stats={[
          { label: "Live drops", value: formatCount(liveCount), sub: `of ${formatCount(visible.length)} shown` },
          { label: "Archived", value: formatCount(archivedCount), sub: "hidden from store", tone: "text-[var(--adm-danger)]" },
          { label: "Stock on hand", value: formatCount(unitsOnHand), sub: formatMoney(inventoryValue) + " at retail", tone: "text-[var(--adm-success)]" },
        ]}
        search={
          <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-[var(--adm-border)] bg-[var(--adm-inset)] px-3 py-2 focus-within:border-[var(--adm-violet)]/60 focus-within:ring-1 focus-within:ring-[var(--adm-violet)]/30 sm:max-w-sm">
            <Search className="h-4 w-4 shrink-0 text-[var(--adm-text-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title or category"
              aria-label="Search catalogue"
              className="w-full min-w-0 bg-transparent font-mono text-xs text-[var(--adm-text)] placeholder:text-[var(--adm-text-muted)] focus:outline-none"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} className="shrink-0 text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]">
                <XCircle className="h-4 w-4" />
                <span className="sr-only">Clear catalogue search</span>
              </button>
            ) : null}
          </div>
        }
        actions={
          <>
            <AdminButton variant="ghost" icon={Search} onClick={() => setShowArchived((prev) => !prev)}>
              {showArchived ? "Hide archived" : "Show archived"}
            </AdminButton>
            <AdminButton variant="primary" icon={Plus} onClick={() => onEdit("new")}>
              New drop
            </AdminButton>
          </>
        }
      />

      <Panel>
        <PanelHeader
          title="Drops"
          subtitle={`${formatCount(liveCount)} live • ${formatCount(archivedCount)} archived • per-drop coin rule shown on each card`}
          icon={Layers}
        />
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.length === 0 ? (
          <div className="col-span-full">
            <EmptyState icon={Layers} title="No products" message="Publish a drop to make it available on the storefront." />
          </div>
        ) : (
          visible.map((product) => (
            <div
              key={product.id}
              className={`group relative flex min-w-0 flex-col space-y-3 overflow-hidden rounded-2xl border p-4 transition-all duration-200 ${
                product.isArchived
                  ? "border-[var(--adm-border-soft)] bg-[var(--adm-surface-2)] opacity-70 hover:opacity-100"
                  : "border-[var(--adm-border)] bg-[var(--adm-surface)] hover:-translate-y-0.5 hover:border-[var(--adm-violet)]/40 hover:shadow-[var(--adm-shadow)]"
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent to-transparent ${
                  product.isArchived ? "via-[var(--adm-tint-10)]" : "via-[var(--adm-violet)]/40"
                }`}
              />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-black tracking-tight text-[var(--adm-text)]">{product.title}</span>
                    {product.badge ? <Pill tone="border-[var(--adm-violet)]/35 bg-[var(--adm-violet)]/15 text-[var(--adm-violet)]">{product.badge}</Pill> : null}
                    {product.isArchived ? <Pill tone="border-[var(--adm-danger)]/35 bg-[var(--adm-danger)]/15 text-[var(--adm-danger)]">Archived</Pill> : null}
                  </div>
                  <p className="mt-1 font-sans text-[11px] leading-snug text-[var(--adm-text)]">
                    {product.subtitle} • {product.category}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <AdminButton variant="ghost" size="sm" icon={Pencil} onClick={() => onEdit(product)}>
                    Edit
                  </AdminButton>
                  {product.isArchived ? (
                    <AdminButton
                      variant="success"
                      size="sm"
                      icon={Undo2}
                      pending={ctl.isPending(`prod:${product.id}`)}
                      onClick={() =>
                        void ctl.run(`prod:${product.id}`, () => api.admin.updateProduct(product.id, { isArchived: false }), {
                          successMessage: `${product.title} republished`,
                        })
                      }
                    >
                      Publish
                    </AdminButton>
                  ) : (
                    <AdminButton
                      variant="danger"
                      size="sm"
                      icon={Trash2}
                      pending={ctl.isPending(`prod:${product.id}`)}
                      onClick={() =>
                        void ctl.run(`prod:${product.id}`, () => api.admin.archiveProduct(product.id), {
                          successMessage: `${product.title} archived`,
                        })
                      }
                    >
                      Archive
                    </AdminButton>
                  )}
                  <AdminButton
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    className="text-[var(--adm-danger)]"
                    onClick={() => setDeleting(product)}
                  >
                    Delete
                  </AdminButton>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {product.colors.map((color) => (
                  <span
                    key={color.name}
                    title={color.name}
                    className="h-5 w-5 rounded-full border border-[var(--adm-border)] shadow-[0_4px_12px_-4px_rgba(0,0,0,1)] ring-1 ring-inset ring-[var(--adm-border)]"
                    style={{ backgroundColor: color.hex }}
                  />
                ))}
                <span className="ml-auto rounded-full border border-[var(--adm-border)] bg-[var(--adm-inset)] px-2 py-0.5 font-mono text-[10px] text-[var(--adm-text)]">
                  {product.sizes.join(" / ")}
                </span>
              </div>

              <div className="mt-auto flex flex-wrap items-end justify-between gap-2 border-t border-[var(--adm-border)] pt-3">
                <span className="flex items-baseline gap-1.5 font-mono">
                  <span className="text-lg font-black leading-none text-[var(--adm-success)]">{formatMoney(product.price)}</span>
                  <span className="text-[10px] text-[var(--adm-text-muted)] line-through">{formatMoney(product.mrp)}</span>
                </span>
                <span className="rounded-full border border-[var(--adm-success)]/30 bg-[var(--adm-success)]/10 px-2 py-0.5 font-mono text-[10px] font-bold text-[var(--adm-success)]">
                  {Math.round((1 - product.price / product.mrp) * 100)}% OFF
                </span>
              </div>

              <p className="-mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-[var(--adm-text-muted)]">
                <span>
                  {product.gsm} GSM • stock {formatCount(product.stock ?? 0)} • {product.rating}★ ({formatCount(product.reviewsCount)})
                </span>
                <span
                  className={`rounded-full border px-1.5 py-px text-[9px] font-bold uppercase tracking-wider ${
                    product.codAvailable === false
                      ? "border-[var(--adm-danger)]/30 bg-[var(--adm-danger)]/15 text-[var(--adm-danger)]"
                      : "border-[var(--adm-success)]/30 bg-[var(--adm-success)]/10 text-[var(--adm-success)]"
                  }`}
                >
                  {product.codAvailable === false ? "Prepaid only" : "COD ok"}
                </span>
              </p>

              <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-inset)] px-2.5 py-2">
                <span
                  className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-bold ${
                    product.cashbackPoints != null && product.cashbackPoints > 0 ? "text-[var(--adm-warning)]" : "text-[var(--adm-text)]"
                  }`}
                >
                  <Coins className={`h-3.5 w-3.5 ${product.cashbackPoints != null && product.cashbackPoints > 0 ? "text-[var(--adm-warning)]" : "text-[var(--adm-text-muted)]"}`} />
                  {product.cashbackPoints != null && product.cashbackPoints > 0 ? (
                    <>
                      <span>{formatCount(product.cashbackPoints)} coins</span>
                      <span className="rounded-full border border-[var(--adm-warning)]/30 bg-[var(--adm-warning)]/15 px-1.5 py-px text-[9px] uppercase tracking-wider text-[var(--adm-warning)]">
                        Custom
                      </span>
                    </>
                  ) : (
                    <span>0 coins</span>
                  )}
                </span>
                <AdminButton variant="ghost" size="sm" icon={Pencil} onClick={() => onEdit(product)}>
                  Edit Points
                </AdminButton>
              </div>
            </div>
          ))
        )}
      </div>
    </Panel>
    <DeleteProductModal ctl={ctl} product={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}

function DeleteProductModal({
  ctl,
  product,
  onClose,
}: {
  ctl: AdminController;
  product: Product | null;
  onClose: () => void;
}) {
  const runKey = product ? `purge:${product.id}` : "purge";

  const submit = async () => {
    if (!product) return;
    const result = await ctl.run(runKey, () => api.admin.deleteProduct(product.id), {
      successMessage: `${product.title} deleted permanently`,
    });
    if (result.ok) onClose();
  };

  return (
    <Modal
      open={Boolean(product)}
      onClose={onClose}
      icon={Trash2}
      title="Delete product permanently"
      subtitle={product ? `${product.title} • ${product.sku ?? product.id}` : undefined}
      footer={
        <>
          <AdminButton variant="ghost" icon={Undo2} onClick={onClose}>
            Keep product
          </AdminButton>
          <AdminButton
            variant="danger"
            icon={Trash2}
            pending={product ? ctl.isPending(runKey) : false}
            onClick={() => void submit()}
          >
            Delete forever
          </AdminButton>
        </>
      }
    >
      {product ? (
        <div className="space-y-3">
          <p className="text-[11px] leading-relaxed text-[var(--adm-text)]">
            <span className="font-bold">{product.title}</span> is removed from the catalogue, every storefront
            section, its reviews and its coin-claim markers. Orders that already contain this drop keep their
            line items for accounting.
          </p>
          <div className="border border-[var(--adm-danger)]/35 bg-[var(--adm-danger)]/6 p-3.5 text-[11px] leading-relaxed text-[var(--adm-text)]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--adm-danger)]">Cannot be undone</p>
            <ul className="mt-2 space-y-1.5">
              <li>• The product page returns “Drop Not Found”.</li>
              <li>• Archiving is reversible — use Archive instead if the drop may come back.</li>
            </ul>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

/* ---------------------------------------------------------------- anime tees */

function AnimeTeesTab({ ctl, onEdit }: { ctl: AdminController; onEdit: (draft: Product | "new") => void }) {
  const [query, setQuery] = useState("");
  const [showHidden, setShowHidden] = useState(true);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const rows = useMemo(() => ctl.snapshot.products.filter(isAnimeDeskRow), [ctl.snapshot.products]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((product) => {
      if (!showHidden && (product.isArchived || product.showOnStorefront === false)) return false;
      if (!needle) return true;
      return (
        product.title.toLowerCase().includes(needle) ||
        product.category.toLowerCase().includes(needle) ||
        (product.theme ?? "").toLowerCase().includes(needle)
      );
    });
  }, [rows, query, showHidden]);

  const inAnimeSection = rows.filter(
    (product) => isAnimeTShirt(product) && !product.isArchived && product.showOnStorefront !== false
  ).length;
  const missingArtwork = rows.filter((product) => !animeThumb(product)).length;
  const unitsOnHand = rows.reduce((sum, product) => sum + (product.stock ?? 0), 0);

  return (
    <>
      <ConsoleHero
        eyebrow="T-Shirt desk"
        title="T-Shirt drops"
        subtitle="Manage all T-shirt drops, artwork, pricing, and storefront placement."
        icon={Sparkles}
        accent="violet"
        stats={[
          { label: "Active drops", value: formatCount(inAnimeSection), sub: `of ${formatCount(rows.length)} on desk`, tone: "text-[var(--adm-violet)]" },
          { label: "No artwork", value: formatCount(missingArtwork), sub: missingArtwork ? "card falls back to mockup" : "every drop has art", tone: missingArtwork ? "text-[var(--adm-danger)]" : "text-[var(--adm-success)]" },
          { label: "Stock on hand", value: formatCount(unitsOnHand), sub: "pcs across all themes" },
        ]}
        search={
          <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-[var(--adm-border)] bg-[var(--adm-inset)] px-3 py-2 focus-within:border-[var(--adm-violet)]/60 focus-within:ring-1 focus-within:ring-[var(--adm-violet)]/30 sm:max-w-sm">
            <Search className="h-4 w-4 shrink-0 text-[var(--adm-text-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, theme or artwork note"
              aria-label="Search drops"
              className="w-full min-w-0 bg-transparent font-mono text-xs text-[var(--adm-text)] placeholder:text-[var(--adm-text-muted)] focus:outline-none"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} className="shrink-0 text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]">
                <XCircle className="h-4 w-4" />
                <span className="sr-only">Clear search</span>
              </button>
            ) : null}
          </div>
        }
        actions={
          <>
            <AdminButton variant="ghost" icon={Search} onClick={() => setShowHidden((prev) => !prev)}>
              {showHidden ? "Hide unpublished" : "Show unpublished"}
            </AdminButton>
            <AdminButton variant="primary" icon={Plus} onClick={() => onEdit("new")}>
              Add t-shirt
            </AdminButton>
          </>
        }
      />

      <Panel>
        <PanelHeader
          title="Drops on this desk"
          subtitle={`${formatCount(visible.length)} shown • tap a placement chip to move a drop between storefront sections — it saves straight away`}
          icon={Sparkles}
        />
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.length === 0 ? (
            <div className="col-span-full">
              <EmptyState
                icon={Sparkles}
                title="No anime drops"
                message="Add an anime tee to publish a back-print drop into the Anime collection."
              />
            </div>
          ) : (
            visible.map((product) => {
              const thumb = animeThumb(product);
              return (
                <div
                  key={product.id}
                  className={`flex min-w-0 flex-col gap-3 rounded-none border p-4 transition-colors font-mono ${
                    product.isArchived || product.showOnStorefront === false
                      ? "border-[var(--adm-border)] bg-[var(--adm-surface)]/60 opacity-60 hover:opacity-100"
                      : "border-[var(--adm-border)] bg-[var(--adm-surface)] hover:border-[var(--adm-accent)]"
                  }`}
                >
                  <div className="flex min-w-0 gap-3">
                    <div className="h-24 w-20 shrink-0 overflow-hidden rounded-none border border-[var(--adm-border)] bg-[var(--adm-bg)]">
                      {thumb ? (
                        <ProductThumb
                          src={thumb}
                          fallback={
                            <span className="flex h-full w-full items-center justify-center">
                              <Sparkles className="h-5 w-5 text-[var(--adm-text-muted)]" />
                            </span>
                          }
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center">
                          <Sparkles className="h-5 w-5 text-[var(--adm-text-muted)]" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-xs font-bold uppercase tracking-wider text-[var(--adm-text)]" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>{product.title}</span>
                        {product.isArchived ? (
                          <Pill tone="border-[var(--adm-danger)]/40 bg-[var(--adm-danger)]/10 text-[var(--adm-danger)]">Archived</Pill>
                        ) : product.showOnStorefront === false ? (
                          <Pill tone="border-[var(--adm-border)] bg-[var(--adm-bg)] text-[var(--adm-text-muted)]">Hidden</Pill>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[10px] font-mono uppercase tracking-wider text-[var(--adm-info)]">{product.category}</p>
                      <p className="mt-1 line-clamp-1 text-[10px] text-[var(--adm-text-muted)]">{product.subtitle}</p>
                      <div className="mt-2 flex items-baseline gap-1.5 font-mono">
                        <span className="text-sm font-bold text-[var(--adm-accent)]">{formatMoney(product.price)}</span>
                        {product.mrp > product.price && (
                          <span className="text-[10px] text-[var(--adm-text-muted)] line-through">{formatMoney(product.mrp)}</span>
                        )}
                        <span className="ml-auto text-[10px] text-[var(--adm-text-muted)]">stock {formatCount(product.stock ?? 0)}</span>
                      </div>
                    </div>
                  </div>

                  <PlacementChips ctl={ctl} product={product} />

                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--adm-border)] pt-3">
                    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--adm-warning)]">
                      <Coins className="h-3.5 w-3.5 text-[var(--adm-warning)]" />
                      {product.cashbackPoints != null && product.cashbackPoints > 0
                        ? `${formatCount(product.cashbackPoints)} coins`
                        : "0 coins"}
                    </span>
                    <div className="flex shrink-0 gap-1">
                      <AdminButton variant="ghost" size="sm" icon={Pencil} onClick={() => onEdit(product)}>
                        Edit
                      </AdminButton>
                      {product.isArchived ? (
                        <AdminButton
                          variant="success"
                          size="sm"
                          icon={Undo2}
                          pending={ctl.isPending(`prod:${product.id}`)}
                          onClick={() =>
                            void ctl.run(`prod:${product.id}`, () => api.admin.updateProduct(product.id, { isArchived: false }), {
                              successMessage: `${product.title} republished`,
                            })
                          }
                        >
                          Publish
                        </AdminButton>
                      ) : (
                        <AdminButton
                          variant="danger"
                          size="sm"
                          icon={Trash2}
                          pending={ctl.isPending(`prod:${product.id}`)}
                          onClick={() =>
                            void ctl.run(`prod:${product.id}`, () => api.admin.archiveProduct(product.id), {
                              successMessage: `${product.title} archived`,
                            })
                          }
                        >
                          Archive
                        </AdminButton>
                      )}
                      <AdminButton
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        className="text-[var(--adm-danger)]"
                        onClick={() => setDeleting(product)}
                      >
                        Delete
                      </AdminButton>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Panel>
      <DeleteProductModal ctl={ctl} product={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}

const PLACEMENT_CHIPS: { key: PlacementFlag; label: string; hint: string }[] = [
  { key: "showOnStorefront", label: "Store", hint: "Visible to shoppers at all" },
  { key: "showInAnime", label: "Anime", hint: "Anime collection + hero carousel" },
  { key: "showInPremium", label: "Premium", hint: "Premium band on the home page" },
  { key: "showInNewDrops", label: "New", hint: "New drops filter" },
  { key: "showInBestSellers", label: "Best", hint: "Bestseller filter" },
];

function PlacementChips({ ctl, product }: { ctl: AdminController; product: Product }) {
  const on = (flag: PlacementFlag): boolean => {
    if (flag === "showOnStorefront") return product.showOnStorefront !== false;
    if (flag === "showInAnime") return isAnimeTShirt(product);
    if (flag === "showInPremium") return isPremiumTShirt(product);
    if (flag === "showInNewDrops") return isNewDrop(product);
    return isBestseller(product);
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {PLACEMENT_CHIPS.map((chip) => {
        const active = on(chip.key);
        const key = `place:${product.id}:${chip.key}`;
        return (
          <span key={chip.key} title={chip.hint} className={ctl.isPending(key) ? "opacity-60" : undefined}>
            <Chip
              active={active}
              onClick={() => {
                const patch: Partial<Product> = {};
                patch[chip.key] = !active;
                void ctl.run(key, () => api.admin.updateProduct(product.id, patch), {
                  successMessage: `${product.title} — ${chip.label} ${!active ? "on" : "off"}`,
                });
              }}
            >
              {chip.label}
            </Chip>
          </span>
        );
      })}
    </div>
  );
}

interface ProductFormState {
  title: string;
  subtitle: string;
  description: string;
  category: Product["category"];
  price: string;
  mrp: string;
  gsm: string;
  fabric: string;
  packFit: string;
  packPrint: string;
  packWash: string;
  badge: string;
  stock: string;
  sizes: string[];
  colors: string[];
  graphic: string;
  cashbackPoints: string;
  codAllowed: boolean;
  artworkUrl: string;
  theme: string;
  onStore: boolean;
  inAnime: boolean;
  premium: boolean;
  newDrop: boolean;
  bestSeller: boolean;
}

/** The five storefront placements an anime drop can opt into, keyed by form field. */
type FormPlacementField = "onStore" | "inAnime" | "premium" | "newDrop" | "bestSeller";

function emptyProductForm(anime: boolean): ProductFormState {
  return {
    title: "",
    subtitle: anime
      ? "Heavyweight 240 GSM oversized tee with a full back print"
      : "Heavyweight 240 GSM drop-shoulder oversized tee",
    description: "",
    category: "T-Shirts",
    price: "799",
    mrp: "1699",
    gsm: "240",
    fabric: "",
    packFit: "",
    packPrint: "",
    packWash: "",
    badge: "NEW DROP",
    stock: "60",
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Onyx Black", "Bone White"],
    graphic: GRAPHIC_PRESETS[0].type,
    cashbackPoints: "",
    codAllowed: true,
    artworkUrl: "",
    theme: "",
    onStore: true,
    inAnime: true,
    premium: false,
    newDrop: true,
    bestSeller: false,
  };
}

function formFromProduct(product: Product): ProductFormState {
  return {
    title: product.title,
    subtitle: product.subtitle,
    description: product.description,
    category: product.category,
    price: String(product.price),
    mrp: String(product.mrp),
    gsm: String(product.gsm),
    fabric: product.fabric ?? "",
    packFit: product.packFit ?? "",
    packPrint: product.packPrint ?? "",
    packWash: product.packWash ?? "",
    badge: product.badge ?? "",
    stock: String(product.stock ?? 60),
    sizes: product.sizes,
    colors: product.colors.map((color) => color.name),
    graphic: (product as any).graphic || GRAPHIC_PRESETS[0].type,
    cashbackPoints:
      product.cashbackPoints != null
        ? String(product.cashbackPoints)
        : (product as any)?.rewardCoins != null
        ? String((product as any).rewardCoins)
        : "",
    codAllowed: product.codAvailable !== false,
    artworkUrl: product.artworkUrl ?? "",
    theme: product.theme ?? "",
    onStore: product.showOnStorefront !== false,
    inAnime: isAnimeTShirt(product),
    premium: isPremiumTShirt(product),
    newDrop: isNewDrop(product),
    bestSeller: isBestseller(product),
  };
}

function ProductModal({
  ctl,
  draft,
  anime,
  onClose,
}: {
  ctl: AdminController;
  draft: Product | "new";
  anime: boolean;
  onClose: () => void;
}) {
  const isEdit = draft !== "new";
  const [form, setForm] = useState<ProductFormState>(() =>
    isEdit ? formFromProduct(draft as Product) : emptyProductForm(anime)
  );
  const [error, setError] = useState<string | null>(null);
  const [artworkError, setArtworkError] = useState<string | null>(null);
  const [artworkBroken, setArtworkBroken] = useState(false);
  const uploading = ctl.isPending("artwork:upload");

  const coinsEntered = form.cashbackPoints.trim() === "" ? null : Math.max(0, parseInt(form.cashbackPoints, 10) || 0);

  const patch = (values: Partial<ProductFormState>) => setForm((prev) => ({ ...prev, ...values }));

  const toggle = (field: "sizes" | "colors", value: string) =>
    setForm((prev) => {
      const list = prev[field];
      const next = list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
      return { ...prev, [field]: next.length > 0 ? next : list };
    });

  const attachArtwork = async (file: File | undefined) => {
    if (!file) return;
    setArtworkError(null);
    setArtworkBroken(false);
    const result = await ctl.run(
      "artwork:upload",
      async () => {
        const uploaded = await api.admin.uploadArtwork(file);
        patch({ artworkUrl: uploaded.url });
        return uploaded;
      },
      { skipRefresh: true, silent: true, successMessage: `${file.name} attached` }
    );
    if (!result.ok) setArtworkError(result.error ?? "Upload failed");
  };

  const save = async () => {
    setError(null);
    const colors = COLOR_SWATCHES.filter((color) => form.colors.includes(color.name)).map((color) => ({
      name: color.name,
      hex: color.hex,
      previewClass: `bg-[${color.hex}]`,
    }));
    const preset = GRAPHIC_PRESETS.find((item) => item.type === form.graphic) ?? GRAPHIC_PRESETS[0];
    const payload: Partial<Product> = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      description: form.description.trim() || undefined,
      category: form.category,
      price: Number(form.price),
      mrp: Number(form.mrp),
      gsm: Number(form.gsm),
      fabric: form.fabric.trim() || undefined,
      packFit: form.packFit.trim() || undefined,
      packPrint: form.packPrint.trim() || undefined,
      packWash: form.packWash.trim() || undefined,
      badge: form.badge.trim() || undefined,
      stock: Number(form.stock),
      sizes: form.sizes,
      colors: colors.length ? colors : undefined,
      graphicSvgType: preset.type,
      graphicTitle: preset.label,
      cashbackPoints:
        form.cashbackPoints.trim() !== "" ? Math.max(0, parseInt(form.cashbackPoints, 10)) : 0,
      rewardCoins:
        form.cashbackPoints.trim() !== "" ? Math.max(0, parseInt(form.cashbackPoints, 10)) : 0,
      codAvailable: form.codAllowed,
    };
    if (anime) {
      payload.productType = "tshirt";
      payload.artworkUrl = form.artworkUrl.trim();
      payload.theme = form.theme.trim();
      payload.showOnStorefront = form.onStore;
      payload.showInAnime = form.inAnime;
      payload.showInPremium = form.premium;
      payload.showInNewDrops = form.newDrop;
      payload.showInBestSellers = form.bestSeller;
    }

    const result = await ctl.run(
      saveKey,
      () => (isEdit ? api.admin.updateProduct((draft as Product).id, payload) : api.admin.createProduct(payload)),
      { successMessage: isEdit ? `${form.title} updated` : `${form.title} published to the storefront`, silent: true }
    );

    if (result.ok) onClose();
    else setError(result.error ?? "Could not save this product");
  };

  const saveKey = isEdit ? `prod:${(draft as Product).id}` : anime ? "anime:create" : "product:create";

  const placementChoices: [FormPlacementField, string, string][] = [
    ["onStore", "Store", "Visible to shoppers at all"],
    ["inAnime", "Anime", "Anime collection + hero carousel"],
    ["premium", "Premium", "Premium band on the home page"],
    ["newDrop", "New", "New drops filter"],
    ["bestSeller", "Best", "Bestseller filter"],
  ];

  const togglePlacement = (field: FormPlacementField) =>
    setForm((prev) => ({ ...prev, [field]: !prev[field] }));

  return (
    <Modal
      open
      onClose={onClose}
      icon={isEdit ? Pencil : Plus}
      title={isEdit ? `Edit ${form.title}` : anime ? "Add anime tee" : "Publish new drop"}
      subtitle={
        anime
          ? "Anime drops stay on the Anime desk — artwork, theme and where the tee shows up"
          : "Saves through /api/admin/products and re-reads the server snapshot"
      }
      maxWidth="max-w-2xl"
      footer={
        <>
          <AdminButton variant="ghost" onClick={onClose}>
            Cancel
          </AdminButton>
          <AdminButton
            variant="primary"
            icon={Send}
            pending={ctl.isPending(saveKey)}
            onClick={() => void save()}
          >
            {isEdit ? "Save changes" : "Publish drop"}
          </AdminButton>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        className="space-y-4 text-xs"
      >
        <Field label="Title" required>
          <TextInput value={form.title} onChange={(event) => patch({ title: event.target.value })} placeholder="NEO TOKYO 2099" required />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Subtitle">
            <TextInput value={form.subtitle} onChange={(event) => patch({ subtitle: event.target.value })} />
          </Field>
          <Field label={anime ? "Anime theme" : "Category"}>
            <SelectInput value={form.category} onChange={(event) => patch({ category: event.target.value as Product["category"] })}>
              {(anime ? ANIME_THEMES : PRODUCT_CATEGORIES).map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>

        {anime ? (
          <div className="space-y-3 rounded-xl border border-[var(--adm-violet)]/30 bg-[var(--adm-violet)]/10 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--adm-violet)]">
                <Sparkles className="h-4 w-4 text-[var(--adm-violet)]" />
                Back-print artwork
              </span>
              <span className="font-mono text-[10px] text-[var(--adm-text)]">
                {form.artworkUrl.trim() ? "artwork drives the card" : "no artwork — vector mockup only"}
              </span>
            </div>

            <div className="flex gap-3">
              <div className="h-28 w-24 shrink-0 overflow-hidden rounded-xl border border-[var(--adm-border)] bg-[var(--adm-inset-strong)]">
                {form.artworkUrl.trim() && !artworkBroken ? (
                  <ProductThumb
                    src={form.artworkUrl.trim()}
                    alt="Back print preview"
                    onFail={() => setArtworkBroken(true)}
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center px-1 text-center font-mono text-[9px] text-[var(--adm-text-muted)]">
                    {artworkBroken ? "path not found" : "preview"}
                  </span>
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <TextInput
                  value={form.artworkUrl}
                  onChange={(event) => {
                    setArtworkBroken(false);
                    patch({ artworkUrl: event.target.value });
                  }}
                  placeholder="/products/art-neeon-haze.webp"
                />
                <label className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[var(--adm-violet)]/40 bg-[var(--adm-violet)]/20 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[var(--adm-violet)] transition-colors hover:bg-[var(--adm-violet)]/30">
                  {uploading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {uploading ? "Uploading…" : "Upload artwork"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    disabled={uploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      void attachArtwork(file);
                    }}
                  />
                </label>
                {artworkError ? <ErrorNote message={artworkError} /> : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Design theme" hint="Written on the product page, e.g. “Cursed energy · shonen dark fantasy”.">
                <TextInput value={form.theme} onChange={(event) => patch({ theme: event.target.value })} placeholder="Tokyo neon · kanji streetwear" />
              </Field>
              <Field label="Show this drop in" hint="Chips save on tap; “Store” off hides it from shoppers without archiving.">
                <div className="flex flex-wrap gap-1.5">
                  {placementChoices.map(([field, label, hint]) => (
                    <span key={field} title={hint}>
                      <Chip active={form[field]} onClick={() => togglePlacement(field)}>
                        {label}
                      </Chip>
                    </span>
                  ))}
                </div>
              </Field>
            </div>
          </div>
        ) : null}
        <Field label="Description" hint="Left blank, the API writes the standard 240 GSM copy.">
          <TextArea rows={2} value={form.description} onChange={(event) => patch({ description: event.target.value })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Price (₹)" required>
            <TextInput type="number" min={0} value={form.price} onChange={(event) => patch({ price: event.target.value })} required />
          </Field>
          <Field label="MRP (₹)" required>
            <TextInput type="number" min={0} value={form.mrp} onChange={(event) => patch({ mrp: event.target.value })} required />
          </Field>
          <Field label="GSM">
            <TextInput type="number" min={120} value={form.gsm} onChange={(event) => patch({ gsm: event.target.value })} />
          </Field>
          <Field label="Stock">
            <TextInput type="number" min={0} value={form.stock} onChange={(event) => patch({ stock: event.target.value })} />
          </Field>
        </div>

        {/* Product pack — printed verbatim in the "Product pack" table on the product page */}
        <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-inset)] p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--adm-text)]">Product pack</span>
            <span className="font-mono text-[10px] text-[var(--adm-text)]">Shown on product page · blank rows hide</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Fabric">
              <TextInput
                value={form.fabric}
                onChange={(event) => patch({ fabric: event.target.value })}
                placeholder="280 GSM Super-Combed Cotton"
              />
            </Field>
            <Field label="Fit">
              <TextInput
                value={form.packFit}
                onChange={(event) => patch({ packFit: event.target.value })}
                placeholder="Oversized · drop shoulder"
              />
            </Field>
            <Field label="Print">
              <TextInput
                value={form.packPrint}
                onChange={(event) => patch({ packPrint: event.target.value })}
                placeholder="High-density screenprint"
              />
            </Field>
            <Field label="Wash">
              <TextInput
                value={form.packWash}
                onChange={(event) => patch({ packWash: event.target.value })}
                placeholder="Cold machine wash"
              />
            </Field>
          </div>
        </div>

        {/* Cashback Points Editor for specific T-Shirt */}
        <div className="rounded-xl border border-[var(--adm-warning)]/30 bg-[var(--adm-warning)]/10 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[var(--adm-warning)] text-xs flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-[var(--adm-warning)]" />
              Cashback Points (Reward Coins)
            </span>
            {form.cashbackPoints.trim() !== "" && Number(form.cashbackPoints) > 0 ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--adm-warning)]/30 text-[var(--adm-warning)] border border-[var(--adm-warning)]/40">
                Custom points: {form.cashbackPoints}
              </span>
            ) : (
              <span className="text-[10px] font-mono text-[var(--adm-text)]">
                Default: 0 coins
              </span>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Coins per T-Shirt"
              hint="Set specific cashback coins for this t-shirt. Default is 0."
            >
              <TextInput
                type="number"
                min={0}
                value={form.cashbackPoints}
                onChange={(event) => patch({ cashbackPoints: event.target.value })}
                placeholder="Default: 0 coins"
              />
            </Field>
            <div className="flex flex-col justify-center rounded-lg border border-[var(--adm-border-soft)] bg-[var(--adm-inset)] p-2.5 font-mono text-[11px] text-[var(--adm-text)]">
              <span className="text-[10px] uppercase tracking-wider text-[var(--adm-text)]">Customer Earns:</span>
              <div className="mt-1">
                <span className="text-sm font-black text-[var(--adm-warning)]">{Number(form.cashbackPoints) || 0} Sky Cash</span>
              </div>
              {form.cashbackPoints.trim() !== "" && (
                <button
                  type="button"
                  onClick={() => patch({ cashbackPoints: "0" })}
                  className="mt-1 text-left text-[10px] text-[var(--adm-danger)] hover:text-[var(--adm-danger)] hover:underline cursor-pointer"
                >
                  Reset / Set to 0
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Payment mode editor — decides whether this drop may ship on Cash on Delivery */}
        <div className="rounded-xl border border-[var(--adm-success)]/30 bg-[var(--adm-success)]/10 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[var(--adm-success)] text-xs flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-[var(--adm-success)]" />
              Payment Mode (Cash On Delivery)
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                form.codAllowed
                  ? "border-[var(--adm-success)]/40 bg-[var(--adm-success)]/25 text-[var(--adm-success)]"
                  : "border-[var(--adm-danger)]/40 bg-[var(--adm-danger)]/20 text-[var(--adm-danger)]"
              }`}
            >
              {form.codAllowed ? "COD allowed" : "Prepaid only"}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { allowed: true, label: "Cash on Delivery", hint: "Courier collects at the doorstep" },
                { allowed: false, label: "Prepaid only", hint: "UPI / Card / Netbanking before dispatch" },
              ] as const
            ).map((choice) => {
              const active = form.codAllowed === choice.allowed;
              return (
                <button
                  key={choice.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => patch({ codAllowed: choice.allowed })}
                  className={`rounded-lg border p-2.5 text-left transition-all ${
                    active
                      ? "border-[var(--adm-success)]/70 bg-[var(--adm-inset-strong)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]"
                      : "border-[var(--adm-border)] bg-[var(--adm-inset)] hover:border-[var(--adm-border)]"
                  }`}
                >
                  <span className={`block font-mono text-[11px] font-black uppercase tracking-wider ${active ? "text-[var(--adm-success)]" : "text-[var(--adm-text)]"}`}>
                    {choice.label}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] text-[var(--adm-text)]">{choice.hint}</span>
                </button>
              );
            })}
          </div>
          <p className="font-mono text-[10px] text-[var(--adm-text)]">
            {form.codAllowed
              ? "Checkout keeps the COD option on while this drop is in the cart."
              : "Checkout hides COD and the API rejects it whenever this drop is in the cart."}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Badge">
            <TextInput value={form.badge} onChange={(event) => patch({ badge: event.target.value })} placeholder="BEST SELLER" />
          </Field>
          <Field label="Print preset">
            <SelectInput value={form.graphic} onChange={(event) => patch({ graphic: event.target.value })}>
              {GRAPHIC_PRESETS.map((preset) => (
                <option key={preset.type} value={preset.type}>
                  {preset.label}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <Field label="Sizes">
          <div className="flex flex-wrap gap-1.5">
            {SIZE_OPTIONS.map((size) => (
              <Chip key={size} active={form.sizes.includes(size)} onClick={() => toggle("sizes", size)}>
                {size}
              </Chip>
            ))}
          </div>
        </Field>
        <Field label="Colourways">
          <div className="flex flex-wrap gap-1.5">
            {COLOR_SWATCHES.map((color) => (
              <Chip key={color.name} active={form.colors.includes(color.name)} onClick={() => toggle("colors", color.name)}>
                <span className="h-3 w-3 rounded-full border border-[var(--adm-border)]" style={{ backgroundColor: color.hex }} />
                {color.name}
              </Chip>
            ))}
          </div>
        </Field>
        {error ? <ErrorNote message={error} /> : null}
      </form>
    </Modal>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-none border px-2 py-1 text-[10px] font-mono font-bold uppercase transition-colors cursor-pointer ${
        active
          ? "border-[var(--adm-accent)] bg-[var(--adm-accent)]/15 text-[var(--adm-accent)]"
          : "border-[var(--adm-border)] bg-[var(--adm-bg)] text-[var(--adm-text-muted)] hover:text-[var(--adm-text)] hover:border-[var(--adm-border-strong)]"
      }`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------- withdrawals */

function payoutTarget(request: WithdrawalRequest): string {
  return request.payoutMethod === "BANK"
    ? `Bank ${request.bankAccount || "No Account"} · ${request.bankIfsc ?? "no IFSC"}`
    : `UPI ${request.upiId}`;
}

/** One grid string for the header row and the data rows, so the columns can never drift apart. */
const DESK_GRID = "md:grid-cols-[1.5fr_0.85fr_1.15fr_1.15fr_1.05fr_auto]";

/** Plain-word status — nobody at the desk should need a glossary to read this ledger. */
function deskStatus(request: WithdrawalRequest): string {
  if (request.overallStatus === "COMPLETED" || request.overallStatus === "PAID") return "Fully paid";
  if (request.overallStatus === "REJECTED") return "Rejected";
  return vestingTotals(request).payableNowCoins > 0 ? "Ready to pay" : "Weekly payouts";
}

/** What the admin actually has to do with this request today. */
function deskNextStep(request: WithdrawalRequest): string {
  const totals = vestingTotals(request);
  if (request.overallStatus === "COMPLETED" || request.overallStatus === "PAID") return `Closed — ${formatCount(totals.paidCoins)} coins paid out`;
  if (request.overallStatus === "REJECTED")
    return `${formatCount(totals.voidedCoins)} coins went back to ${request.customerName}`;
  if (totals.payableNowCoins > 0) return `Pay ${formatCount(totals.payableNowCoins)} coins now`;
  const next = request.tranches.find((tranche) => tranche.status === "LOCKED");
  return next ? `Next ${formatCount(next.coins)} coins unlocks ${next.dueDate}` : "Nothing left to pay";
}

/** Plain words for the four internal slice states. */
const TRANCHE_WORD = {
  TRANSFERRED: "Paid",
  UNLOCKED: "Ready to pay",
  LOCKED: "Not due yet",
  VOID: "Refunded",
} as const;

const TRANCHE_TEXT: Record<string, string> = {
  TRANSFERRED: "text-[var(--adm-accent)]",
  UNLOCKED: "text-[var(--adm-warning)]",
  LOCKED: "text-[var(--adm-text-muted)]",
  VOID: "text-[var(--adm-danger)]",
};

/** Left status bar for a request row. */
function requestBar(request: WithdrawalRequest): string {
  if (request.overallStatus === "REJECTED" || request.overallStatus === "FAILED") return "bg-[var(--adm-danger)]";
  if (request.overallStatus === "COMPLETED" || request.overallStatus === "PAID") return "bg-[var(--adm-accent)]";
  return vestingTotals(request).payableNowCoins > 0 ? "bg-[var(--adm-warning)]" : "bg-[var(--adm-fill)]";
}

/** Open request that has nothing payable today — waiting on a future weekly part. */
function inWeeklySchedule(request: WithdrawalRequest): boolean {
  if (request.overallStatus === "COMPLETED" || request.overallStatus === "PAID") return false;
  if (request.overallStatus === "REJECTED") return false;
  return vestingTotals(request).payableNowCoins === 0;
}

function PayoutRequestCard({
  ctl,
  request,
  onEdit,
  onPay,
  onReject,
}: {
  ctl: AdminController;
  request: WithdrawalRequest;
  onEdit: (id: string) => void;
  onPay?: (request: WithdrawalRequest) => void;
  onReject?: (id: string) => void;
}) {
  const [reference, setReference] = useState("");
  const totals = vestingTotals(request);
  const settled = request.tranches.filter((tranche) => tranche.status === "TRANSFERRED");
  const unlocked = request.tranches.filter((tranche) => tranche.status === "UNLOCKED");
  const completed = request.overallStatus === "COMPLETED" || request.overallStatus === "PAID";
  const rejected = request.overallStatus === "REJECTED";
  const payable = totals.payableNowCoins > 0 ? totals.payableNowCoins : request.totalCoins;
  const nextLocked = request.tranches.find((tranche) => tranche.status === "LOCKED");
  const lastPaid = settled[settled.length - 1];

  const settleAll = async () => {
    if (onPay) {
      onPay(request);
      return;
    }
    const result = await ctl.run(
      `pay:${request.id}`,
      () => api.admin.settlePayout(request.id, reference.trim() || undefined),
      {
        successMessage: `${request.customerName} • ${formatCount(payable)} coins marked as paid to ${payoutTarget(request)}`,
        silent: true,
      }
    );
    if (result.ok) setReference("");
    else ctl.notify("error", result.error ?? "Payout could not be released");
  };

  const payOne = (week: number, amount: number) => {
    if (onPay) {
      onPay(request);
      return;
    }
    void ctl.run(`pay:${request.id}:${week}`, () => api.admin.payTranche(request.id, week, reference.trim() || undefined), {
      successMessage: `Part ${week} • ${formatCount(amount)} coins marked as paid to ${payoutTarget(request)}`,
      silent: true,
    });
  };

  const reopenThis = () =>
    void ctl.run(`reopen:${request.id}`, () => api.admin.reopenWithdrawal(request.id), {
      successMessage: `${request.id} is back in the queue for ${request.customerName}`,
    });

  return (
    <Panel>
      <PanelHeader
        title={`${request.customerName} — ${formatCount(request.totalCoins)} coins`}
        subtitle={`${payoutTarget(request)} • asked on ${dayLabel(request.requestedAt)} • ${request.phone}`}
        icon={DollarSign}
        tone={completed ? "emerald" : rejected ? "rose" : "amber"}
        actions={
          <>
            <Pill tone={completed ? TONE_PAID : rejected ? WITHDRAWAL_TONES.REJECTED : TONE_UNPAID}>
              {deskStatus(request)}
            </Pill>
            <Pill>{formatCount(request.totalCoins)} coins</Pill>
            <Pill>order {request.purchaseOrderNumber}</Pill>
            {!completed && !rejected && onPay ? (
              <AdminButton
                variant="success"
                size="sm"
                icon={CircleCheck}
                onClick={() => onPay(request)}
              >
                Pay &amp; Enter UTR
              </AdminButton>
            ) : null}
            {!completed && !rejected && onReject ? (
              <AdminButton
                variant="outline"
                size="sm"
                icon={XCircle}
                onClick={() => onReject(request.id)}
              >
                Reject &amp; refund
              </AdminButton>
            ) : null}
            {rejected ? (
              <AdminButton
                variant="outline"
                size="sm"
                icon={RotateCcw}
                pending={ctl.isPending(`reopen:${request.id}`)}
                onClick={reopenThis}
              >
                Reopen &amp; pay again
              </AdminButton>
            ) : null}
            <AdminButton
              variant="ghost"
              size="sm"
              icon={Pencil}
              disabled={completed}
              onClick={() => onEdit(request.id)}
            >
              Edit payout
            </AdminButton>
          </>
        }
      />
      <div className="divide-y divide-[var(--adm-border)]">
        <div className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3">
          <span className="whitespace-nowrap font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)]">
            {settled.length}/{request.tranches.length} paid
          </span>
          <span className="min-w-[80px] flex-1">
            <ProgressBar
              done={settled.length}
              total={request.tranches.length}
              tone={settled.length === request.tranches.length ? "emerald" : "amber"}
            />
          </span>
          <span className="whitespace-nowrap font-mono text-[10px] text-[var(--adm-text-muted)]">
            paid <span className="font-bold text-[var(--adm-text)]">{formatCount(totals.paidCoins)}</span> coins •{" "}
            {rejected ? (
              <span className="text-[var(--adm-danger)]">{formatCount(totals.voidedCoins)} coins refunded</span>
            ) : (
              <>{formatCount(totals.remainingCoins)} coins still to pay</>
            )}
          </span>
        </div>

        {completed ? (
          <div className="flex items-start gap-2 border-l-2 border-[var(--adm-accent)] bg-[var(--adm-accent)]/6 px-3.5 py-3 text-[11px] text-[var(--adm-accent)]">
            <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p className="font-mono leading-relaxed text-[var(--adm-text)]">
              <span className="font-bold uppercase tracking-wider text-[var(--adm-accent)]">All paid.</span> Every weekly part of{" "}
              {formatCount(request.totalCoins)} coins reached {payoutTarget(request)}. Last one went out{" "}
              <span className="font-mono">
                {lastPaid?.transferredAt} • ref {lastPaid?.upiRef}
              </span>
            </p>
          </div>
        ) : null}

        {rejected ? (
          <div className="flex items-start gap-2 border-l-2 border-[var(--adm-danger)] bg-[var(--adm-danger)]/6 px-3.5 py-3 text-[11px] text-[var(--adm-danger)]">
            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p className="font-mono leading-relaxed text-[var(--adm-text)]">
              <span className="font-bold uppercase tracking-wider text-[var(--adm-danger)]">Rejected.</span>{" "}
              {formatCount(totals.voidedCoins)} coins are back in{" "}
              {request.customerName}&apos;s wallet.{" "}
              {totals.paidCoins > 0 ? `${formatCount(totals.paidCoins)} coins already paid stay paid. ` : ""}
              {request.rejectionReason ? <span className="text-[var(--adm-text-muted)]">Note: {request.rejectionReason}</span> : null}{" "}
              Fix the payout details or press <span className="font-bold">Reopen &amp; pay again</span> to put this
              request back in the queue — the server takes the coins out of the wallet again and refuses if the member
              has already spent them.
            </p>
          </div>
        ) : null}

        <div
          className={`grid grid-cols-1 gap-px bg-[var(--adm-fill)] ${
            request.tranches.length > 1 ? "sm:grid-cols-2 xl:grid-cols-4" : ""
          }`}
        >
          {request.tranches.map((tranche) => (
            <div key={tranche.week} className="flex min-w-0 flex-col gap-2 bg-[var(--adm-bg)] p-3.5">
              <div className="flex items-center justify-between gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--adm-text-muted)]">
                <span>Part {tranche.week} of {request.tranches.length}</span>
                <span className="border border-[var(--adm-border)] bg-[var(--adm-surface)] px-1.5 py-px text-[9px] text-[var(--adm-text)]">
                  {tranche.percent}%
                </span>
              </div>
              <div className="font-mono text-lg font-bold leading-none tabular-nums text-[var(--adm-text)]">
                {formatCount(tranche.coins)}
                <span className="ml-1.5 text-[10px] font-normal text-[var(--adm-text-muted)]">coins</span>
              </div>
              <p className={`font-mono text-[10px] uppercase tracking-wider ${TRANCHE_TEXT[tranche.status]}`}>
                {TRANCHE_WORD[tranche.status]}
              </p>
              <p className="-mt-1 font-mono text-[10px] text-[var(--adm-text-muted)]">on {tranche.dueDate}</p>
              {tranche.status === "TRANSFERRED" ? (
                <p className="mt-auto border-t border-[var(--adm-border)] pt-1.5 font-mono text-[10px] text-[var(--adm-accent)]">
                  {tranche.upiRef} • {tranche.transferredAt}
                </p>
              ) : tranche.status === "UNLOCKED" ? (
                <AdminButton
                  variant="success"
                  size="sm"
                  className="mt-auto w-full"
                  pending={ctl.isPending(`pay:${request.id}:${tranche.week}`)}
                  onClick={() => payOne(tranche.week, tranche.coins)}
                >
                  Mark paid
                </AdminButton>
              ) : tranche.status === "VOID" ? (
                <p className="mt-auto border border-[var(--adm-danger)]/30 bg-[var(--adm-surface)] px-2 py-1.5 text-center font-mono text-[10px] text-[var(--adm-danger)]">
                  Refunded • {formatCount(tranche.coins)} coins back with the member
                </p>
              ) : (
                <p className="mt-auto border border-[var(--adm-border)] bg-[var(--adm-surface)] px-2 py-1.5 text-center font-mono text-[10px] text-[var(--adm-text-muted)]">
                  Cannot be paid before {tranche.dueDate}
                </p>
              )}
            </div>
          ))}
        </div>

        {!completed && !rejected ? (
          <div className="flex flex-col gap-3 bg-[var(--adm-surface)] p-4 sm:flex-row sm:items-end">
            <Field
              label="Payment reference"
              hint="Paste the UTR from your payment app. Leave it blank and the system stamps a reference for you."
              className="sm:flex-1"
            >
              <TextInput
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="e.g. UTR-40217748"
                aria-label={`Payment reference for ${request.id}`}
              />
            </Field>
            <div className="flex min-w-0 flex-col gap-1.5 sm:items-end">
              <AdminButton
                variant="success"
                icon={CircleCheck}
                disabled={payable === 0}
                pending={ctl.isPending(`pay:${request.id}`)}
                onClick={() => void settleAll()}
              >
                Mark payment done • {formatCount(payable)} coins
              </AdminButton>
              <p className="font-mono text-[10px] leading-relaxed text-[var(--adm-text-muted)] sm:text-right">
                {payable > 0
                  ? `Pays all ${unlocked.length} ready part${unlocked.length === 1 ? "" : "s"} in one click${
                      settled.length + unlocked.length === request.tranches.length ? " and closes this request" : ""
                    }.`
                  : nextLocked
                    ? `Nothing to pay today — the next ${formatCount(nextLocked.coins)} coins are due on ${nextLocked.dueDate}.`
                    : "Nothing payable yet."}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function PayoutEditModal({
  ctl,
  request,
  onClose,
}: {
  ctl: AdminController;
  request: WithdrawalRequest;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    customerName: request.customerName,
    phone: request.phone ?? "",
    payoutMethod: request.payoutMethod,
    upiId: request.upiId,
    bankAccount: request.bankAccount ?? "",
    bankIfsc: request.bankIfsc ?? "",
  });
  const [error, setError] = useState<string | null>(null);

  const patch = (values: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...values }));

  const buildPatch = (): AdminWithdrawalPatch => {
    const next: AdminWithdrawalPatch = {};
    if (form.customerName.trim() !== request.customerName) next.customerName = form.customerName.trim();
    if (form.phone.trim() !== (request.phone ?? "")) next.phone = form.phone.trim();
    if (form.payoutMethod !== request.payoutMethod) next.payoutMethod = form.payoutMethod;
    if (form.upiId.trim() !== request.upiId) next.upiId = form.upiId.trim();
    if (form.bankAccount.trim() !== (request.bankAccount ?? "")) next.bankAccount = form.bankAccount.trim();
    if (form.bankIfsc.trim().toUpperCase() !== (request.bankIfsc ?? "")) {
      next.bankIfsc = form.bankIfsc.trim().toUpperCase();
    }
    return next;
  };

  const dirty = Object.keys(buildPatch()).length > 0;

  const save = async () => {
    setError(null);
    const result = await ctl.run(`edit:${request.id}`, () => api.admin.updateWithdrawal(request.id, buildPatch()), {
      successMessage: `${request.id} payout details corrected — the weekly dates were not touched`,
      silent: true,
    });
    if (result.ok) onClose();
    else setError(result.error ?? "Could not save these payout details");
  };

  const paidCount = request.tranches.filter((tranche) => tranche.status === "TRANSFERRED").length;

  return (
    <Modal
      open
      onClose={onClose}
      icon={Pencil}
      title={`Fix payout details • ${request.customerName}`}
      subtitle={`${formatCount(request.totalCoins)} coins • ${paidCount} of ${request.tranches.length} part${
        request.tranches.length === 1 ? "" : "s"
      } already paid${
        request.overallStatus === "REJECTED"
          ? " • this request is rejected — saving only corrects where the money goes, press Reopen in the row to queue it again"
          : ""
      }`}
      footer={
        <>
          <AdminButton variant="ghost" icon={RotateCcw} onClick={onClose}>
            Close
          </AdminButton>
          <AdminButton
            variant="primary"
            icon={Send}
            disabled={!dirty}
            pending={ctl.isPending(`edit:${request.id}`)}
            onClick={() => void save()}
          >
            Save payout details
          </AdminButton>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Customer name">
          <TextInput value={form.customerName} onChange={(event) => patch({ customerName: event.target.value })} />
        </Field>
        <Field label="Phone">
          <TextInput value={form.phone} onChange={(event) => patch({ phone: event.target.value })} />
        </Field>
        <Field label="Payout method" hint="Switching to bank asks for an account number and IFSC.">
          <SelectInput
            value={form.payoutMethod}
            onChange={(event) => patch({ payoutMethod: event.target.value as WithdrawalRequest["payoutMethod"] })}
          >
            <option value="UPI">UPI</option>
            <option value="BANK">Bank transfer</option>
          </SelectInput>
        </Field>
        <Field label="UPI ID" required hint="Format name@bank — the server rejects anything else.">
          <TextInput value={form.upiId} onChange={(event) => patch({ upiId: event.target.value })} />
        </Field>
        {form.payoutMethod === "BANK" ? (
          <>
            <Field label="Bank account" required>
              <TextInput
                value={form.bankAccount}
                onChange={(event) => patch({ bankAccount: event.target.value })}
                inputMode="numeric"
              />
            </Field>
            <Field label="IFSC code" required>
              <TextInput
                value={form.bankIfsc}
                onChange={(event) => patch({ bankIfsc: event.target.value.toUpperCase() })}
                maxLength={11}
              />
            </Field>
          </>
        ) : null}
      </div>
      <p className="mt-4 border border-[var(--adm-border)] bg-[var(--adm-bg)] p-3 font-mono text-[11px] leading-relaxed text-[var(--adm-text-muted)]">
        Only the payout address changes here. The payout dates, the parts already paid and the member&apos;s coin
        balance are left exactly as they are.
      </p>
      {error ? <ErrorNote message={error} /> : null}
    </Modal>
  );
}

function PayPayoutModal({
  ctl,
  request,
  onClose,
}: {
  ctl: AdminController;
  request: WithdrawalRequest;
  onClose: () => void;
}) {
  const [utr, setUtr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const totals = vestingTotals(request);
  const payableAmount = totals.payableNowCoins > 0 ? totals.payableNowCoins : request.totalCoins;

  const submit = async () => {
    setError(null);
    if (!utr.trim()) {
      setError("Please enter the Bank / UPI UTR reference number.");
      return;
    }
    const result = await ctl.run(`pay:${request.id}`, () => api.admin.settlePayout(request.id, utr.trim()), {
      successMessage: `${request.customerName} • Payout marked as PAID (UTR: ${utr.trim()})`,
    });
    if (result.ok) onClose();
    else setError(result.error ?? "Payment could not be marked as paid");
  };

  return (
    <Modal
      open
      onClose={onClose}
      icon={CircleCheck}
      title={`Confirm & Enter UTR • ${request.customerName}`}
      subtitle={`Request ID: ${request.id} • ${formatCount(payableAmount)} coins`}
      footer={
        <>
          <AdminButton variant="ghost" icon={RotateCcw} onClick={onClose}>
            Cancel
          </AdminButton>
          <AdminButton
            variant="success"
            icon={CircleCheck}
            pending={ctl.isPending(`pay:${request.id}`)}
            onClick={() => void submit()}
          >
            Confirm &amp; Mark Paid • {formatCount(payableAmount)} coins
          </AdminButton>
        </>
      }
    >
      <div className="grid gap-px border border-[var(--adm-border)] bg-[var(--adm-fill)] text-xs">
        <div className="flex items-center justify-between gap-3 bg-[var(--adm-bg)] px-3.5 py-2.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--adm-text-muted)]">Customer</span>
          <span className="min-w-0 truncate font-mono font-bold text-[var(--adm-text)]">
            {request.customerName} ({request.phone})
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 bg-[var(--adm-bg)] px-3.5 py-2.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--adm-text-muted)]">Transfer amount</span>
          <span className="font-mono text-sm font-bold tabular-nums text-[var(--adm-accent)]">
            ₹{payableAmount} ({formatCount(payableAmount)} coins)
          </span>
        </div>
      </div>

      {request.payoutMethod === "BANK" ? (
        <div className="mt-3 border border-[var(--adm-accent)]/40 bg-[var(--adm-accent)]/5 p-3 space-y-2.5 font-mono">
          <div className="flex items-center justify-between border-b border-[var(--adm-accent)]/20 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--adm-accent)] flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Transfer Destination Details (Bank IMPS / NEFT)
            </span>
            <span className="text-[10px] text-[var(--adm-text-muted)]">Copy to your netbanking app</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="border border-[var(--adm-border)] bg-[var(--adm-bg)] p-2 flex items-center justify-between">
              <div>
                <span className="block text-[9px] uppercase text-[var(--adm-text-muted)]">Account Number</span>
                <span className="font-bold text-[var(--adm-text)] tracking-wide text-sm select-all">
                  {request.bankAccount || "Missing account"}
                </span>
              </div>
              {request.bankAccount && (
                <button
                  type="button"
                  onClick={() => {
                    copyToClipboard(request.bankAccount || "", ctl, "Account number copied to clipboard");
                  }}
                  className="px-2 py-1 bg-[var(--adm-tint-10)] hover:bg-[var(--adm-accent)] hover:text-[var(--adm-on-accent)] text-[var(--adm-text)] text-[10px] font-bold transition-colors"
                >
                  Copy
                </button>
              )}
            </div>

            <div className="border border-[var(--adm-border)] bg-[var(--adm-bg)] p-2 flex items-center justify-between">
              <div>
                <span className="block text-[9px] uppercase text-[var(--adm-text-muted)]">IFSC Code</span>
                <span className="font-bold text-[var(--adm-accent)] tracking-wider text-sm select-all">
                  {request.bankIfsc || "—"}
                </span>
              </div>
              {request.bankIfsc && (
                <button
                  type="button"
                  onClick={() => {
                    copyToClipboard(request.bankIfsc || "", ctl, "IFSC code copied to clipboard");
                  }}
                  className="px-2 py-1 bg-[var(--adm-tint-10)] hover:bg-[var(--adm-accent)] hover:text-[var(--adm-on-accent)] text-[var(--adm-text)] text-[10px] font-bold transition-colors"
                >
                  Copy
                </button>
              )}
            </div>

            <div className="border border-[var(--adm-border)] bg-[var(--adm-bg)] p-2 flex items-center justify-between">
              <div>
                <span className="block text-[9px] uppercase text-[var(--adm-text-muted)]">Account Holder</span>
                <span className="font-bold text-[var(--adm-text)] text-xs truncate select-all">
                  {request.customerName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  copyToClipboard(request.customerName, ctl, "Holder name copied to clipboard");
                }}
                className="px-2 py-1 bg-[var(--adm-tint-10)] hover:bg-[var(--adm-accent)] hover:text-[var(--adm-on-accent)] text-[var(--adm-text)] text-[10px] font-bold transition-colors"
              >
                Copy
              </button>
            </div>

            <div className="border border-[var(--adm-border)] bg-[var(--adm-bg)] p-2 flex items-center justify-between">
              <div>
                <span className="block text-[9px] uppercase text-[var(--adm-text-muted)]">Amount to Send</span>
                <span className="font-bold text-[var(--adm-accent)] text-sm select-all">
                  ₹{payableAmount}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  copyToClipboard(String(payableAmount), ctl, "Transfer amount copied");
                }}
                className="px-2 py-1 bg-[var(--adm-tint-10)] hover:bg-[var(--adm-accent)] hover:text-[var(--adm-on-accent)] text-[var(--adm-text)] text-[10px] font-bold transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 border border-[var(--adm-accent)]/40 bg-[var(--adm-accent)]/5 p-3 space-y-2.5 font-mono">
          <div className="flex items-center justify-between border-b border-[var(--adm-accent)]/20 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--adm-accent)] flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" /> Transfer Destination Details (UPI)
            </span>
            <span className="text-[10px] text-[var(--adm-text-muted)]">Copy to your UPI app</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="border border-[var(--adm-border)] bg-[var(--adm-bg)] p-2 flex items-center justify-between">
              <div>
                <span className="block text-[9px] uppercase text-[var(--adm-text-muted)]">UPI ID / VPA</span>
                <span className="font-bold text-[var(--adm-text)] tracking-wide text-sm truncate select-all">
                  {request.upiId}
                </span>
              </div>
              {request.upiId && (
                <button
                  type="button"
                  onClick={() => {
                    copyToClipboard(request.upiId || "", ctl, "UPI ID copied to clipboard");
                  }}
                  className="px-2 py-1 bg-[var(--adm-tint-10)] hover:bg-[var(--adm-accent)] hover:text-[var(--adm-on-accent)] text-[var(--adm-text)] text-[10px] font-bold transition-colors"
                >
                  Copy
                </button>
              )}
            </div>

            <div className="border border-[var(--adm-border)] bg-[var(--adm-bg)] p-2 flex items-center justify-between">
              <div>
                <span className="block text-[9px] uppercase text-[var(--adm-text-muted)]">Amount to Send</span>
                <span className="font-bold text-[var(--adm-accent)] text-sm select-all">
                  ₹{payableAmount}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  copyToClipboard(String(payableAmount), ctl, "Transfer amount copied");
                }}
                className="px-2 py-1 bg-[var(--adm-tint-10)] hover:bg-[var(--adm-accent)] hover:text-[var(--adm-on-accent)] text-[var(--adm-text)] text-[10px] font-bold transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4">
        <Field
          label="Bank / UPI UTR Number (Transaction Reference)"
          required
          hint="Enter the 12-digit UTR, IMPS Ref or UPI Transaction ID from your banking app. This will be shown to the user on their dashboard and sent to their WhatsApp."
        >
          <TextInput
            value={utr}
            onChange={(event) => setUtr(event.target.value)}
            placeholder="e.g. 412345678901 or UPI/IMPS reference"
            autoFocus
          />
        </Field>
      </div>

      <p className="mt-4 border border-[var(--adm-border)] bg-[var(--adm-bg)] p-3 font-mono text-[11px] leading-relaxed text-[var(--adm-text-muted)]">
        Once confirmed, this payout will be marked as <strong className="font-bold text-[var(--adm-accent)]">PAID</strong>, the UTR
        reference will be saved, and the customer will see it on their live wallet screen.
      </p>

      {error ? <ErrorNote message={error} /> : null}
    </Modal>
  );
}

function RejectPayoutModal({
  ctl,
  request,
  onClose,
}: {
  ctl: AdminController;
  request: WithdrawalRequest;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const totals = vestingTotals(request);
  const refundCoins = totals.remainingCoins > 0 ? totals.remainingCoins : request.totalCoins;

  const submit = async () => {
    setError(null);
    if (!reason.trim()) {
      setError("Please provide a reason for rejecting this payout.");
      return;
    }
    const result = await ctl.run(`reject:${request.id}`, () => api.admin.rejectWithdrawal(request.id, reason.trim()), {
      successMessage: `${request.id} rejected — ${formatCount(refundCoins)} coins returned to ${request.customerName}'s Live Wallet`,
    });
    if (result.ok) onClose();
    else setError(result.error ?? "This payout request could not be rejected");
  };

  return (
    <Modal
      open
      onClose={onClose}
      icon={XCircle}
      title={`Reject Payout & Refund Coins • ${request.id}`}
      subtitle={`${request.customerName} • ${formatCount(refundCoins)} coins • ${payoutTarget(request)}`}
      footer={
        <>
          <AdminButton variant="ghost" icon={RotateCcw} onClick={onClose}>
            Keep the request
          </AdminButton>
          <AdminButton
            variant="danger"
            icon={XCircle}
            pending={ctl.isPending(`reject:${request.id}`)}
            onClick={() => void submit()}
          >
            Reject &amp; refund {formatCount(refundCoins)} coins
          </AdminButton>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Why is this payout rejected?" required hint="Required (up to 160 characters). Shown prominently to the customer on their wallet screen and WhatsApp.">
          <TextArea
            value={reason}
            maxLength={160}
            rows={3}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Bank IFSC code mismatch or invalid account number. Please verify."
            autoFocus
          />
        </Field>
        <div className="border border-[var(--adm-danger)]/35 bg-[var(--adm-danger)]/6 p-3.5 font-mono text-[11px] leading-relaxed text-[var(--adm-text)]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--adm-danger)]">Action details</p>
          <ul className="mt-2 space-y-1.5">
            <li>• {formatCount(refundCoins)} coins go back into {request.customerName}&apos;s Live Wallet right away.</li>
            <li>• The member will see this exact rejection note on their wallet dashboard.</li>
            <li>• A WhatsApp notification will be sent to {request.phone}.</li>
          </ul>
        </div>
        {error ? <ErrorNote message={error} /> : null}
      </div>
    </Modal>
  );
}

type DeskFilter = "all" | "payable" | "vesting" | "settled" | "rejected";

const DESK_FILTERS: { id: DeskFilter; label: string }[] = [
  { id: "all", label: "All requests" },
  { id: "payable", label: "Pay now" },
  { id: "vesting", label: "Weekly payouts" },
  { id: "settled", label: "Fully paid" },
  { id: "rejected", label: "Rejected" },
];

function DeskCell({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex min-w-0 items-center justify-between gap-2 md:block ${className}`}>
      <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--adm-text-muted)] md:hidden">{label}</span>
      <div className="min-w-0 md:mt-0">{children}</div>
    </div>
  );
}

function WithdrawalsTab({ ctl }: { ctl: AdminController }) {
  const requests = ctl.snapshot.withdrawals;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [payingRequest, setPayingRequest] = useState<WithdrawalRequest | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DeskFilter>("all");

  const editing = requests.find((request) => request.id === editingId) ?? null;
  const rejecting = requests.find((request) => request.id === rejectingId) ?? null;

  const desk = requests.reduce(
    (acc, request) => {
      const totals = vestingTotals(request);
      return {
        released: acc.released + totals.paidCoins,
        payable: acc.payable + totals.payableNowCoins,
        locked: acc.locked + (totals.remainingCoins - totals.payableNowCoins),
        remaining: acc.remaining + totals.remainingCoins,
        refunded: acc.refunded + totals.voidedCoins,
        settled: acc.settled + (request.overallStatus === "COMPLETED" || request.overallStatus === "PAID" ? 1 : 0),
        rejected: acc.rejected + (request.overallStatus === "REJECTED" ? 1 : 0),
      };
    },
    { released: 0, payable: 0, locked: 0, remaining: 0, refunded: 0, settled: 0, rejected: 0 }
  );

  /** Members whose money has unlocked and is sitting in the desk's way. */
  const payFirst = useMemo(
    () =>
      requests
        .filter((request) => vestingTotals(request).payableNowCoins > 0)
        .sort(
          (a, b) => vestingTotals(b).payableNowCoins - vestingTotals(a).payableNowCoins
        ),
    [requests]
  );

  const walletOf = (customerId: string) => ctl.snapshot.customers.find((member) => member.id === customerId);

  const counts: Record<DeskFilter, number> = {
    all: requests.length,
    payable: requests.filter((request) => vestingTotals(request).payableNowCoins > 0).length,
    vesting: requests.filter(inWeeklySchedule).length,
    settled: desk.settled,
    rejected: desk.rejected,
  };

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return requests.filter((request) => {
      const matchesNeedle =
        !needle ||
        [request.customerName, request.id, request.upiId, request.phone, request.bankIfsc, request.purchaseOrderNumber].some(
          (value) => (value ?? "").toLowerCase().includes(needle)
        );
      const totals = vestingTotals(request);
      const matchesFilter =
        filter === "all"
          ? true
          : filter === "payable"
            ? totals.payableNowCoins > 0
            : filter === "vesting"
              ? inWeeklySchedule(request)
              : filter === "settled"
                ? request.overallStatus === "COMPLETED" || request.overallStatus === "PAID"
                : request.overallStatus === "REJECTED";
      return matchesNeedle && matchesFilter;
    });
  }, [requests, query, filter]);

  const quickPay = (request: WithdrawalRequest) =>
    void ctl.run(`pay:${request.id}`, () => api.admin.settlePayout(request.id), {
      successMessage: `${request.customerName} • ${formatCount(
        vestingTotals(request).payableNowCoins
      )} coins marked paid with an auto reference — paste the real UTR from the weekly-parts panel if you have one`,
      silent: true,
    });

  /**
   * A rejection refunded the coins, so reopening takes them back out of the wallet. The
   * server refuses when the member has spent them; that reason is what the toast shows.
   */
  const reopen = (request: WithdrawalRequest) =>
    void ctl.run(`reopen:${request.id}`, () => api.admin.reopenWithdrawal(request.id), {
      successMessage: `${request.id} is back in the queue — ${formatCount(
        vestingTotals(request).voidedCoins
      )} coins locked again, pay it from the row`,
    });

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--adm-border)] pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 bg-[var(--adm-warning)]" aria-hidden="true" />
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--adm-text-muted)]">Payouts desk</p>
          </div>
          <h1
            className="mt-1 text-2xl font-bold uppercase tracking-tight text-[var(--adm-text)]"
            style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
          >
            Withdrawals
          </h1>
        </div>
        <AdminButton
          variant="ghost"
          size="sm"
          icon={RefreshCw}
          pending={ctl.isPending("refresh")}
          onClick={() => void ctl.refresh()}
        >
          Refresh
        </AdminButton>
      </header>

      <div className="grid grid-cols-1 gap-px overflow-hidden border border-[var(--adm-border)] bg-[var(--adm-fill)] sm:grid-cols-2 xl:grid-cols-4">
        <div className="bg-[var(--adm-surface)] px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--adm-text-muted)]">Pay now</p>
          <p
            className={`mt-1 font-mono text-xl font-bold leading-none tabular-nums ${
              desk.payable > 0 ? "text-[var(--adm-warning)]" : "text-[var(--adm-text)]"
            }`}
          >
            {formatCount(desk.payable)} <span className="text-[10px] font-normal text-[var(--adm-text-muted)]">coins</span>
          </p>
          <p className="mt-1 truncate text-[10px] text-[var(--adm-text-muted)]">
            {formatCount(payFirst.length)} request{payFirst.length === 1 ? "" : "s"} unlocked
          </p>
        </div>
        <div className="bg-[var(--adm-surface)] px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--adm-text-muted)]">Still locked</p>
          <p className="mt-1 font-mono text-xl font-bold leading-none tabular-nums text-[var(--adm-text)]">
            {formatCount(desk.locked)} <span className="text-[10px] font-normal text-[var(--adm-text-muted)]">coins</span>
          </p>
          <p className="mt-1 truncate text-[10px] text-[var(--adm-text-muted)]">not payable before its date</p>
        </div>
        <div className="bg-[var(--adm-surface)] px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--adm-text-muted)]">Paid out</p>
          <p className="mt-1 font-mono text-xl font-bold leading-none tabular-nums text-[var(--adm-accent)]">
            {formatCount(desk.released)} <span className="text-[10px] font-normal text-[var(--adm-text-muted)]">coins</span>
          </p>
          <p className="mt-1 truncate text-[10px] text-[var(--adm-text-muted)]">
            {formatCount(desk.settled)} request{desk.settled === 1 ? "" : "s"} fully closed
          </p>
        </div>
        <div className="bg-[var(--adm-surface)] px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--adm-text-muted)]">Refunded</p>
          <p
            className={`mt-1 font-mono text-xl font-bold leading-none tabular-nums ${
              desk.refunded > 0 ? "text-[var(--adm-danger)]" : "text-[var(--adm-text)]"
            }`}
          >
            {formatCount(desk.refunded)} <span className="text-[10px] font-normal text-[var(--adm-text-muted)]">coins</span>
          </p>
          <p className="mt-1 truncate text-[10px] text-[var(--adm-text-muted)]">
            {formatCount(desk.rejected)} rejected request{desk.rejected === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <section className="border border-[var(--adm-border)] bg-[var(--adm-surface)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--adm-border)] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 bg-[var(--adm-warning)]" aria-hidden="true" />
            <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--adm-text-muted)]">Pay these first</h2>
          </div>
          <p className="font-mono text-[10px] text-[var(--adm-text-muted)]">
            {formatCount(payFirst.length)} ready • {formatCount(desk.payable)} coins due
          </p>
        </div>
        {payFirst.length === 0 ? (
          <p className="px-4 py-4 font-mono text-[11px] leading-relaxed text-[var(--adm-text-muted)]">
            Nothing is payable today.{" "}
            {desk.locked > 0
              ? `${formatCount(desk.locked)} coins are still locked to future dates and will appear here automatically when they unlock.`
              : "No payout has reached its pay date yet. A request appears here on the morning its next weekly part is due."}
          </p>
        ) : (
          <div className="divide-y divide-[var(--adm-border)]">
            {payFirst.map((request) => {
              const totals = vestingTotals(request);
              return (
                <div
                  key={`pay-${request.id}`}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs font-bold text-[var(--adm-text)]">
                      {request.customerName} • {formatCount(totals.payableNowCoins)} coins
                    </p>
                    <p className="truncate font-mono text-[10px] text-[var(--adm-text-muted)]">
                      {payoutTarget(request)} • {request.phone} • {request.id}
                    </p>
                    <p className="truncate font-mono text-[10px] text-[var(--adm-text-muted)]">
                      {deskNextStep(request)}
                      {totals.remainingCoins - totals.payableNowCoins > 0
                        ? ` • ${formatCount(totals.remainingCoins - totals.payableNowCoins)} coins still locked`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <AdminButton variant="ghost" size="sm" icon={Pencil} onClick={() => setEditingId(request.id)}>
                      Fix details
                    </AdminButton>
                    <AdminButton
                      variant="success"
                      size="sm"
                      icon={CircleCheck}
                      onClick={() => setPayingRequest(request)}
                    >
                      Mark paid • {formatCount(totals.payableNowCoins)} coins
                    </AdminButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="border border-[var(--adm-border)] bg-[var(--adm-surface)]">
        <div className="flex flex-col gap-2 p-2.5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 border border-[var(--adm-border)] bg-[var(--adm-bg)] px-2.5 py-1.5 focus-within:border-[var(--adm-accent)]">
            <Search className="h-3.5 w-3.5 shrink-0 text-[var(--adm-text-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, request ID, UPI, phone or order"
              aria-label="Search withdrawal requests"
              className="w-full min-w-0 bg-transparent font-mono text-xs text-[var(--adm-text)] placeholder:text-[var(--adm-text-muted)] focus:outline-none"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="shrink-0 text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]"
                aria-label="Clear payout search"
              >
                <XCircle className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <p className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-[var(--adm-text-muted)]">
            {formatCount(visible.length)} shown
          </p>
        </div>
        <div className="flex gap-1.5 overflow-x-auto border-t border-[var(--adm-border)] p-2">
          {DESK_FILTERS.map((option) => {
            const active = filter === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setFilter(option.id)}
                aria-pressed={active}
                className={`flex shrink-0 items-center gap-1.5 border px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  active
                    ? "border-[var(--adm-accent)] bg-[var(--adm-accent)] text-[var(--adm-on-accent)]"
                    : "border-[var(--adm-border)] bg-[var(--adm-bg)] text-[var(--adm-text-muted)] hover:border-[var(--adm-border-strong)] hover:text-[var(--adm-text)]"
                }`}
              >
                {option.label}
                <span className={`tabular-nums ${active ? "opacity-70" : "opacity-60"}`}>{counts[option.id]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--adm-border)] px-4 py-2.5">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--adm-text-muted)]">Request ledger</h2>
          <p className="font-mono text-[10px] text-[var(--adm-text-muted)]">Fix details → pay → weekly parts</p>
        </div>

        <div
          className={`hidden gap-3 border-b border-[var(--adm-border)] bg-[var(--adm-bg)] px-4 py-2 font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--adm-text-muted)] md:grid ${DESK_GRID}`}
        >
          <span>Who</span>
          <span>Request</span>
          <span>Money goes to</span>
          <span>Paid / ready / locked</span>
          <span>Status</span>
          <span className="text-right">Actions</span>
        </div>

        {visible.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={DollarSign}
              title={requests.length === 0 ? "No withdrawal requests yet" : "Nothing matches this filter"}
              message={
                requests.length === 0
                  ? "Customers can cash out from the storefront wallet once they hold at least 100 coins."
                  : "Clear the search or switch the status filter to see the rest of the ledger."
              }
            />
          </div>
        ) : (
          visible.map((request) => {
            const totals = vestingTotals(request);
            const settled = request.tranches.filter((tranche) => tranche.status === "TRANSFERRED").length;
            const openRow = openId === request.id;
            return (
              <div
                key={request.id}
                className="relative border-b border-[var(--adm-border)] transition-colors last:border-b-0 hover:bg-[var(--adm-bg)]"
              >
                <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-[3px] ${requestBar(request)}`} />
                <div className={`grid gap-2 px-4 py-3 pl-[18px] ${DESK_GRID} md:items-center md:gap-3`}>
                  <DeskCell label="Who">
                    <button
                      type="button"
                      onClick={() => ctl.openMember(request.customerId)}
                      title={`Open ${request.customerName}'s member account`}
                      className="group/member flex min-w-0 flex-col items-start text-left"
                    >
                      <span className="truncate font-mono text-xs font-bold text-[var(--adm-text)] underline-offset-2 group-hover/member:text-[var(--adm-accent)] group-hover/member:underline">
                        {request.customerName}
                      </span>
                      <span className="truncate font-mono text-[10px] text-[var(--adm-text-muted)]">{request.phone}</span>
                      <span className="truncate font-mono text-[10px] text-[var(--adm-text-muted)]">
                        wallet {formatCount(walletOf(request.customerId)?.availableCoins ?? 0)} coins free
                      </span>
                    </button>
                  </DeskCell>
                  <DeskCell label="Request">
                    <p className="truncate font-mono text-[11px] text-[var(--adm-text)]">{request.id}</p>
                    <p className="truncate font-mono text-[10px] text-[var(--adm-text-muted)]">
                      Gross: {formatCount(request.totalCoins)} coins
                    </p>
                    {Boolean(request.taxCoins && request.taxCoins > 0) && (
                      <p className="truncate font-mono text-[10px] text-[var(--adm-warning)]">
                        Tax ({request.taxPercent ?? 0}%): -{formatCount(request.taxCoins ?? 0)} (Net: {formatCount(request.netPayableCoins ?? request.totalCoins)})
                      </p>
                    )}
                    <p
                      className="truncate font-mono text-[10px] text-[var(--adm-text-muted)]"
                      title={request.purchaseOrderNumber}
                    >
                      {request.purchaseOrderNumber}
                    </p>
                  </DeskCell>
                  <DeskCell label="Money goes to">
                    {request.payoutMethod === "BANK" ? (
                      <div className="font-mono space-y-0.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--adm-text)]">
                          <Building2 className="h-3 w-3 text-[var(--adm-accent)] shrink-0" />
                          <span className="truncate select-all">{request.bankAccount || "No Account"}</span>
                          {request.bankAccount && (
                            <button
                              type="button"
                              onClick={() => {
                                copyToClipboard(request.bankAccount || "", ctl, "Account number copied");
                              }}
                              className="text-[var(--adm-text-muted)] hover:text-[var(--adm-accent)] transition-colors shrink-0"
                              title="Copy account number"
                            >
                              <Copy className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </div>
                        <p className="truncate text-[10px] text-[var(--adm-text-muted)]">
                          IFSC: <span className="text-[var(--adm-text)] font-bold select-all">{request.bankIfsc || "—"}</span>
                          {request.bankIfsc && (
                            <button
                              type="button"
                              onClick={() => {
                                copyToClipboard(request.bankIfsc || "", ctl, "IFSC copied");
                              }}
                              className="ml-1 text-[var(--adm-text-muted)] hover:text-[var(--adm-accent)] transition-colors"
                              title="Copy IFSC"
                            >
                              <Copy className="h-2 w-2 inline" />
                            </button>
                          )}
                        </p>
                        <p className="truncate text-[9px] text-[var(--adm-text-muted)]">
                          {settled}/{request.tranches.length} paid • {dayLabel(request.anchorDate)}
                        </p>
                      </div>
                    ) : (
                      <div className="font-mono space-y-0.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--adm-text)]">
                          <Zap className="h-3 w-3 text-[var(--adm-accent)] shrink-0" />
                          <span className="truncate select-all">{request.upiId}</span>
                          {request.upiId && (
                            <button
                              type="button"
                              onClick={() => {
                                copyToClipboard(request.upiId || "", ctl, "UPI ID copied");
                              }}
                              className="text-[var(--adm-text-muted)] hover:text-[var(--adm-accent)] transition-colors shrink-0"
                              title="Copy UPI ID"
                            >
                              <Copy className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </div>
                        <p className="truncate text-[10px] text-[var(--adm-text-muted)]">
                          {settled}/{request.tranches.length} paid • {dayLabel(request.anchorDate)}
                        </p>
                      </div>
                    )}
                  </DeskCell>
                  <DeskCell label="Paid / ready / locked">
                    <div className="flex min-w-0 flex-col gap-0.5 font-mono text-[11px] leading-tight tabular-nums">
                      <span className={totals.paidCoins > 0 ? "font-bold text-[var(--adm-accent)]" : "text-[var(--adm-text-muted)]"}>
                        paid {formatCount(totals.paidCoins)} coins
                      </span>
                      {request.overallStatus === "REJECTED" ? (
                        <span className="font-bold text-[var(--adm-danger)]">refunded {formatCount(totals.voidedCoins)} coins</span>
                      ) : (
                        <>
                          <span className={totals.payableNowCoins > 0 ? "font-bold text-[var(--adm-warning)]" : "text-[var(--adm-text-muted)]"}>
                            ready {formatCount(totals.payableNowCoins)} coins
                          </span>
                          <span className="text-[var(--adm-text-muted)]">
                            locked {formatCount(totals.remainingCoins - totals.payableNowCoins)} coins
                          </span>
                        </>
                      )}
                    </div>
                  </DeskCell>
                  <DeskCell label="Status">
                    <div className="flex min-w-0 flex-col items-start gap-1 md:items-end">
                      <Pill tone={WITHDRAWAL_TONES[request.overallStatus]}>{deskStatus(request)}</Pill>
                      <span className="truncate text-[10px] text-[var(--adm-text-muted)] md:text-right">{deskNextStep(request)}</span>
                    </div>
                  </DeskCell>
                  <DeskCell label="Actions" className="md:justify-end">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {totals.payableNowCoins > 0 && (
                        <AdminButton
                          variant="success"
                          size="sm"
                          icon={CircleCheck}
                          onClick={() => setPayingRequest(request)}
                        >
                          Pay {formatCount(totals.payableNowCoins)} coins
                        </AdminButton>
                      )}
                      <AdminButton
                        variant="ghost"
                        size="sm"
                        icon={Pencil}
                        disabled={request.overallStatus === "COMPLETED" || request.overallStatus === "PAID"}
                        onClick={() => setEditingId(request.id)}
                      >
                        Edit
                      </AdminButton>
                      {request.overallStatus === "REJECTED" ? (
                        <AdminButton
                          variant="outline"
                          size="sm"
                          icon={RotateCcw}
                          pending={ctl.isPending(`reopen:${request.id}`)}
                          onClick={() => void reopen(request)}
                        >
                          Reopen
                        </AdminButton>
                      ) : (
                        <AdminButton
                          variant="outline"
                          size="sm"
                          icon={XCircle}
                          disabled={request.overallStatus === "COMPLETED" || request.overallStatus === "PAID"}
                          onClick={() => setRejectingId(request.id)}
                        >
                          Reject
                        </AdminButton>
                      )}
                      <AdminButton
                        variant="ghost"
                        size="sm"
                        onClick={() => setOpenId(openRow ? null : request.id)}
                      >
                        {openRow ? "Hide" : "Weekly parts"}
                      </AdminButton>
                    </div>
                  </DeskCell>
                </div>
                {openRow ? (
                  <div className="border-t border-[var(--adm-border)] bg-[var(--adm-bg)] p-3">
                    <PayoutRequestCard
                      ctl={ctl}
                      request={request}
                      onEdit={setEditingId}
                      onPay={setPayingRequest}
                      onReject={setRejectingId}
                    />
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </Panel>

      {editing ? <PayoutEditModal ctl={ctl} request={editing} onClose={() => setEditingId(null)} /> : null}
      {rejecting ? <RejectPayoutModal ctl={ctl} request={rejecting} onClose={() => setRejectingId(null)} /> : null}
      {payingRequest ? <PayPayoutModal ctl={ctl} request={payingRequest} onClose={() => setPayingRequest(null)} /> : null}
    </>
  );
}

/* -------------------------------------------------------------------- rules */

function RulesTab({ ctl }: { ctl: AdminController }) {
  const serverRules: RewardRulesConfig = {
    ...ctl.snapshot.rewardRules,
    shippingCharge: ctl.snapshot.rewardRules?.shippingCharge ?? DELIVERY_FEE,
    shippingMode: ctl.snapshot.rewardRules?.shippingMode === "ALL_PRODUCTS" ? "ALL_PRODUCTS" : "MIN_AMOUNT",
    freeShippingMinAmount: ctl.snapshot.rewardRules?.freeShippingMinAmount ?? FREE_SHIPPING_THRESHOLD,
    orderTaxPercent: ctl.snapshot.rewardRules?.orderTaxPercent ?? 0,
  };
  const [overrides, setOverrides] = useState<Partial<RewardRulesConfig>>({});
  const draft: RewardRulesConfig = { ...serverRules, ...overrides };

  const dirty = JSON.stringify(draft) !== JSON.stringify(serverRules);
  const patch = (values: Partial<RewardRulesConfig>) => setOverrides((prev) => ({ ...prev, ...values }));

  const shippingCharge = draft.shippingCharge ?? DELIVERY_FEE;
  const shippingMode = draft.shippingMode === "ALL_PRODUCTS" ? "ALL_PRODUCTS" : "MIN_AMOUNT";
  const freeShippingMinAmount = draft.freeShippingMinAmount ?? FREE_SHIPPING_THRESHOLD;
  const orderTaxPercent = Math.min(50, Math.max(0, draft.orderTaxPercent ?? 0));

  const saveAll = () =>
    void ctl
      .run("rules", () => api.admin.saveRules(draft), {
        successMessage: "Rules & shipping settings saved — storefront & checkout updated immediately",
      })
      .then((res) => {
        if (res.ok) setOverrides({});
      });

  const shippingPreview =
    shippingCharge <= 0
      ? "Free shipping on every order"
      : shippingMode === "ALL_PRODUCTS"
      ? `${formatMoney(shippingCharge)} shipping on every order`
      : `${formatMoney(shippingCharge)} under ${formatMoney(freeShippingMinAmount)} · free above`;
  const taxPreview = orderTaxPercent > 0 ? `${orderTaxPercent}% GST on prepaid` : "No GST";

  return (
    <div className="space-y-4">
      <ConsoleHero
        eyebrow="Store rules"
        title="Shipping & rewards"
        subtitle="One save applies everywhere — cart, checkout, Razorpay, OwnPay, UPI and COD."
        icon={Settings}
        accent="emerald"
        actions={
          <>
            {dirty ? (
              <Pill tone="border-[var(--adm-warning)]/35 bg-[var(--adm-warning)]/10 text-[var(--adm-warning)]">Unsaved</Pill>
            ) : (
              <Pill tone={TONE_PAID}>In sync</Pill>
            )}
            <AdminButton variant="ghost" icon={RotateCcw} disabled={!dirty} onClick={() => setOverrides({})}>
              Discard
            </AdminButton>
            <AdminButton
              variant="primary"
              icon={Send}
              disabled={!dirty}
              pending={ctl.isPending("rules")}
              onClick={saveAll}
            >
              Save changes
            </AdminButton>
          </>
        }
      />

      <Panel className="max-w-3xl">
        <PanelHeader
          title="Shipping & tax"
          subtitle="What checkout adds to every order"
          icon={Truck}
          tone="sky"
        />

        <div className="space-y-4 p-5">
          <div>
            <span className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--adm-text-muted)]">
              Shipping mode
            </span>
            <div
              role="group"
              aria-label="Shipping mode"
              className="inline-grid w-full grid-cols-2 border border-[var(--adm-border)] sm:w-auto"
            >
              {(
                [
                  { id: "ALL_PRODUCTS", label: "Flat on every order" },
                  { id: "MIN_AMOUNT", label: "Free above minimum" },
                ] as const
              ).map((mode) => {
                const active = shippingMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => patch({ shippingMode: mode.id })}
                    className={`px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wide transition-colors active:translate-y-px ${
                      active
                        ? "bg-[var(--adm-accent)] text-[var(--adm-bg)]"
                        : "bg-[var(--adm-bg)] text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]"
                    }`}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Shipping charge (₹)" hint="Set 0 for free shipping.">
              <TextInput
                type="number"
                min={0}
                max={10000}
                step="1"
                value={shippingCharge}
                onChange={(event) => patch({ shippingCharge: Math.max(0, Number(event.target.value) || 0) })}
              />
            </Field>

            <Field
              label="Free shipping above (₹)"
              hint={shippingMode === "ALL_PRODUCTS" ? "Not used in flat mode." : "Free at or above this total."}
            >
              <TextInput
                type="number"
                min={0}
                max={100000}
                step="1"
                disabled={shippingMode === "ALL_PRODUCTS"}
                value={freeShippingMinAmount}
                onChange={(event) => patch({ freeShippingMinAmount: Math.max(0, Number(event.target.value) || 0) })}
                className={shippingMode === "ALL_PRODUCTS" ? "opacity-40 cursor-not-allowed" : ""}
              />
            </Field>

            <Field label="Prepaid GST (%)" hint="Prepaid orders only — COD is never taxed.">
              <TextInput
                type="number"
                min={0}
                max={50}
                step="0.5"
                value={orderTaxPercent}
                onChange={(event) =>
                  patch({ orderTaxPercent: Math.min(50, Math.max(0, Number(event.target.value) || 0)) })
                }
              />
            </Field>
          </div>

          <p className="border-t border-[var(--adm-border)] pt-3 font-mono text-[11px] text-[var(--adm-text-muted)]">
            <span className="text-[var(--adm-text)]">{shippingPreview}</span> · {taxPreview}
          </p>
        </div>
      </Panel>

      <Panel className="max-w-3xl">
        <PanelHeader
          title="Rewards"
          subtitle="Coins, referrals and payouts"
          icon={Coins}
          tone="emerald"
        />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Daily claim release (%)" hint="Unlocked coins a member can claim per day.">
            <TextInput
              type="number"
              step="0.5"
              value={draft.dailyClaimPercent}
              onChange={(event) => patch({ dailyClaimPercent: Number(event.target.value) })}
            />
          </Field>
          <Field label="Minimum withdrawal (coins)" hint="Smallest payout request.">
            <TextInput
              type="number"
              min={0}
              value={draft.minWithdrawalCoins}
              onChange={(event) => patch({ minWithdrawalCoins: Number(event.target.value) })}
            />
          </Field>
          <Field label="Affiliate commission (%)" hint="Referred order value paid back as coins.">
            <TextInput
              type="number"
              value={draft.referralCommissionPercent}
              onChange={(event) => patch({ referralCommissionPercent: Number(event.target.value) })}
            />
          </Field>
          <Field label="Withdrawal TDS (%)" hint="Deducted from every payout.">
            <TextInput
              type="number"
              min={0}
              max={100}
              step="0.5"
              value={draft.withdrawalTaxPercent ?? 0}
              onChange={(event) => patch({ withdrawalTaxPercent: Number(event.target.value) })}
            />
          </Field>
        </div>
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------- support */

function SupportTab({ ctl }: { ctl: AdminController }) {
  const serverSupport = ctl.snapshot.support;
  const [overrides, setOverrides] = useState<Partial<SupportConfig>>({});
  const draft: SupportConfig = { ...serverSupport, ...overrides };

  const dirty = JSON.stringify(draft) !== JSON.stringify(serverSupport);
  const patch = (values: Partial<SupportConfig>) => setOverrides((prev) => ({ ...prev, ...values }));
  const hasCallLine = Boolean(digitsOnly(draft.callNumber));

  return (
    <>
      <ConsoleHero
        eyebrow="Customer support"
        title="The desk shoppers reach you on"
        subtitle="One saved record drives the storefront header Support menu, the footer support column and the /support help centre. Nothing changes for customers until it is saved server-side."
        icon={LifeBuoy}
        accent="sky"
        stats={[
          {
            label: "WhatsApp",
            value: formatSupportPhone(draft.whatsappNumber),
            sub: "click-to-chat link",
            tone: "text-[var(--adm-success)]",
          },
          {
            label: "Call line",
            value: hasCallLine ? formatSupportPhone(draft.callNumber) : "Hidden",
            sub: "tap-to-dial",
            tone: "text-[var(--adm-info)]",
          },
          { label: "Email", value: draft.email, sub: draft.hours, tone: "text-[var(--adm-warning)]" },
        ]}
      />

      {isPlaceholderWhatsApp(draft) ? (
        <Panel className="border-[var(--adm-warning)]/30">
          <div className="flex items-start gap-3 p-5">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[var(--adm-warning)]" />
            <p className="text-sm leading-relaxed text-[var(--adm-warning)]">
              <span className="font-bold uppercase tracking-wider">Placeholder number.</span> This demo ships with{" "}
              {formatSupportPhone(draft.whatsappNumber)}. Save your real business WhatsApp and the storefront switches
              to it immediately — note that a wa.me chat only opens if that number is actually registered on WhatsApp.
            </p>
          </div>
        </Panel>
      ) : null}

      <Panel className="max-w-3xl">
        <PanelHeader
          title="Contact details"
          subtitle="Validated by the API — a bad number or email is rejected before anything is persisted"
          icon={LifeBuoy}
          tone="sky"
          actions={
            <>
              {dirty ? (
                <Pill tone="border-[var(--adm-warning)]/35 bg-[var(--adm-warning)]/10 text-[var(--adm-warning)]">Unsaved</Pill>
              ) : (
                <Pill tone={TONE_PAID}>In sync</Pill>
              )}
              <AdminButton variant="ghost" icon={RotateCcw} disabled={!dirty} onClick={() => setOverrides({})}>
                Discard
              </AdminButton>
              <AdminButton
                variant="primary"
                icon={Send}
                disabled={!dirty}
                pending={ctl.isPending("support")}
                onClick={() =>
                  void ctl.run(
                    "support",
                    async () => {
                      // Keep the local draft aligned with the canonical number the server stored,
                      // otherwise the field stays visibly "unsaved" after a successful publish.
                      setOverrides(await api.admin.saveSupport(draft));
                    },
                    {
                      successMessage: `Support desk published — customers now reach you on ${formatSupportPhone(
                        draft.whatsappNumber
                      )}`,
                    }
                  )
                }
              >
                Save support details
              </AdminButton>
            </>
          }
        />

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="WhatsApp number" required hint="Country code included. A 10-digit mobile is stored as 91 + number.">
            <TextInput
              inputMode="tel"
              value={draft.whatsappNumber}
              onChange={(event) => patch({ whatsappNumber: event.target.value })}
              placeholder="919876543210"
            />
          </Field>
          <Field label="Call number" hint="Leave empty to hide the call button everywhere on the storefront.">
            <TextInput
              inputMode="tel"
              value={draft.callNumber}
              onChange={(event) => patch({ callNumber: event.target.value })}
              placeholder="919876543210"
            />
          </Field>
          <Field label="Support email" required hint="Also used as the reply address on order tracking.">
            <TextInput type="email" value={draft.email} onChange={(event) => patch({ email: event.target.value })} />
          </Field>
          <Field label="Hours shown to customers" required hint="60 characters or less.">
            <TextInput value={draft.hours} onChange={(event) => patch({ hours: event.target.value })} />
          </Field>
          <Field
            className="sm:col-span-2"
            label="Pre-filled WhatsApp message"
            hint="The first line a customer sends when they tap WhatsApp. Keep it short — 240 characters or less."
          >
            <TextArea
              rows={2}
              value={draft.whatsappMessage}
              onChange={(event) => patch({ whatsappMessage: event.target.value })}
            />
          </Field>
        </div>

        <div className="border-t border-[var(--adm-border)] p-5">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--adm-text)]">
            Live preview of this draft
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a
              href={whatsappUrl(draft)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--adm-success)]/40 bg-[var(--adm-success)]/15 px-3 py-2 font-sans text-[11px] font-bold uppercase tracking-wider text-[var(--adm-success)] transition hover:bg-[var(--adm-success)]/25"
            >
              <MessageCircle className="h-4 w-4" /> Open WhatsApp
            </a>
            {hasCallLine ? (
              <a
                href={callUrl(draft)}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--adm-border)] px-3 py-2 font-sans text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text)] transition hover:border-[var(--adm-info)]/50 hover:text-[var(--adm-info)]"
              >
                <Phone className="h-4 w-4" /> Dial {formatSupportPhone(draft.callNumber)}
              </a>
            ) : null}
            <a
              href={mailUrl(draft, "SKYWARE order help")}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--adm-border)] px-3 py-2 font-sans text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text)] transition hover:border-[var(--adm-warning)]/50 hover:text-[var(--adm-warning)]"
            >
              <Mail className="h-4 w-4" /> {draft.email}
            </a>
            <a
              href="/support"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--adm-border)] px-3 py-2 font-sans text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text)] transition hover:border-[var(--adm-violet)]/50 hover:text-[var(--adm-violet)]"
            >
              <LifeBuoy className="h-4 w-4" /> Help centre
            </a>
          </div>
          <p className="mt-3 font-sans text-[11px] leading-relaxed text-[var(--adm-text-muted)]">
            These details render on the storefront header Support menu, the footer support column, the /support help
            centre and the order-tracking reply address. FAQ answers quote the live reward rules from the Reward Rules
            tab, so coin and payout copy stays honest on its own.
          </p>
        </div>
      </Panel>
    </>
  );
}

/* --------------------------------------------------------------- affiliates */

function AffiliatesTab({ ctl }: { ctl: AdminController }) {
  const referrals = ctl.snapshot.referrals;
  const earned = referrals.reduce((sum, lead) => sum + lead.commissionCoins, 0);
  const converted = referrals.filter((lead) => lead.orderNumber).length;

  return (
    <>
      <ConsoleHero
        eyebrow="Referral programme"
        title="Affiliate earnings"
        subtitle="Every delivered referred order credits the referrer a commission into their vesting wallet — never cash out before it unlocks."
        icon={Users}
        accent="sky"
        stats={[
          { label: "Commission accrued", value: `${formatCount(Math.round(earned))} coins`, sub: `${ctl.snapshot.rewardRules.referralCommissionPercent}% programme`, tone: "text-[var(--adm-info)]" },
          { label: "Referred leads", value: formatCount(referrals.length), sub: `${converted} already ordered` },
          { label: "Awaiting payout", value: formatCount(referrals.filter((lead) => lead.status !== "PAID").length), sub: "via vesting wallet", tone: "text-[var(--adm-warning)]" },
        ]}
      />

      <Panel>
        <PanelHeader
          title="Affiliate ledger"
          subtitle={`${formatCount(referrals.length)} referral record(s) read from the server`}
          icon={Users}
          tone="sky"
        />
        <div className="space-y-2 p-4">
          {referrals.length === 0 ? (
            <EmptyState icon={Users} title="No referrals yet" message="Referral codes are shown on the storefront wallet dashboard." />
          ) : (
            referrals.map((lead) => (
              <RowCard key={lead.id} tone={lead.status === "PAID" ? "emerald" : "amber"} className="p-3.5 pl-4">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-[var(--adm-text)]">
                      {lead.friendName} <span className="font-normal text-[var(--adm-text-muted)]">({lead.friendEmail})</span>
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-[var(--adm-text-muted)]">
                      joined {lead.dateJoined} •{" "}
                      {lead.orderNumber ? `order ${lead.orderNumber} · ${formatMoney(lead.orderAmountInr ?? 0)}` : "no order yet"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-mono text-sm font-black text-[var(--adm-success)]">{formatCount(Math.round(lead.commissionCoins))} coins</span>
                    <Pill tone={lead.status === "PAID" ? TONE_PAID : TONE_UNPAID}>{lead.status}</Pill>
                  </div>
                </div>
              </RowCard>
            ))
          )}
        </div>
      </Panel>
    </>
  );
}

/* -------------------------------------------------------------------- agents */

function AgentsTab({ ctl }: { ctl: AdminController }) {
  const rules = ctl.snapshot.rewardRules;
  const customers = ctl.snapshot.customers;
  const period = agentPeriodKey();
  const agents = customers.filter((customer) => customer.agent?.status === "APPROVED");
  const pending = customers.filter((customer) => customer.agent?.status === "PENDING");
  const monthSales = agents.reduce((sum, customer) => sum + agentMonthlySalesCoins(customer, period), 0);
  const pendingGifts = agents.reduce(
    (sum, customer) => sum + (customer.agent?.gifts ?? []).filter((gift) => gift.status === "PENDING_DISPATCH").length,
    0
  );

  const serverConfig = {
    agentCommissionPercent: rules.agentCommissionPercent ?? rules.referralCommissionPercent,
    agentSlabs: agentSlabsFor(rules),
  };
  const [configDraft, setConfigDraft] = useState<typeof serverConfig | null>(null);
  const draft = configDraft ?? serverConfig;
  const configDirty = JSON.stringify(draft) !== JSON.stringify(serverConfig);

  const patchConfig = (values: Partial<typeof serverConfig>) =>
    setConfigDraft({ ...draft, ...values });

  const patchSlab = (index: number, values: Partial<AgentSlabConfig>) =>
    patchConfig({
      agentSlabs: draft.agentSlabs.map((slab, i) => (i === index ? { ...slab, ...values } : slab)),
    });

  const addSlab = () => {
    if (draft.agentSlabs.length >= MAX_AGENT_SLABS) return;
    const last = draft.agentSlabs[draft.agentSlabs.length - 1];
    patchConfig({
      agentSlabs: [
        ...draft.agentSlabs,
        {
          targetCoins: (last?.targetCoins ?? 0) + Math.max(5000, last?.targetCoins ?? 0),
          bonusCoins: 0,
          gift: "",
        },
      ],
    });
  };

  const removeSlab = (index: number) =>
    patchConfig({
      agentSlabs: draft.agentSlabs.filter((_, i) => i !== index),
    });

  const saveConfig = () =>
    void ctl
      .run(
        "agent-config",
        () =>
          api.admin.saveRules({
            ...rules,
            agentCommissionPercent: draft.agentCommissionPercent,
            agentSlabs: draft.agentSlabs,
          }),
        { successMessage: "Agent commission & ladder saved" }
      )
      .then((res) => {
        if (res.ok) setConfigDraft(null);
      });

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const review = (customerId: string, action: "approve" | "reject", reason?: string) =>
    void ctl
      .run(
        `agent-${action}-${customerId}`,
        () => api.admin.reviewAgent({ customerId, action, reason }),
        { successMessage: action === "approve" ? "Agent approved — new rate is live" : "Application rejected" }
      )
      .then((res) => {
        if (res.ok) {
          setRejectingId(null);
          setRejectReason("");
        }
      });

  const dispatchGift = (customerId: string, giftId: string) =>
    void ctl.run(
      `agent-gift-${giftId}`,
      () => api.admin.dispatchAgentGift({ customerId, giftId }),
      { successMessage: "Gift marked dispatched" }
    );

  const [newAgent, setNewAgent] = useState({ name: "", phone: "", email: "" });
  const [newPassword, setNewPassword] = useState(() => suggestAgentPassword());
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [handoff, setHandoff] = useState<{ name: string; login: string; phone: string; password: string } | null>(null);
  const [copiedHandoff, setCopiedHandoff] = useState(false);
  const [promoteQuery, setPromoteQuery] = useState("");
  const [confirmDemote, setConfirmDemote] = useState<string | null>(null);

  const canCreateAgent =
    newAgent.name.trim().length >= 2 &&
    (newAgent.phone.trim().length >= 10 || newAgent.email.trim().length > 3) &&
    newPassword.trim().length >= 6;

  const createAgent = () => {
    const password = newPassword;
    void ctl
      .run(
        "agent-create",
        async () => {
          const res = await api.admin.createAgent({
            name: newAgent.name.trim(),
            phone: newAgent.phone.trim(),
            email: newAgent.email.trim() || undefined,
            password,
          });
          setHandoff({
            name: res.customer.name,
            login: res.customer.email || res.customer.phone,
            phone: res.customer.phone,
            password,
          });
          return res;
        },
        { successMessage: "Agent account created — send the login details" }
      )
      .then((res) => {
        if (res.ok) {
          setNewAgent({ name: "", phone: "", email: "" });
          setNewPassword(suggestAgentPassword());
          setPasswordVisible(false);
        }
      });
  };

  const promote = (customerId: string) =>
    void ctl.run(
      `agent-promote-${customerId}`,
      () => api.admin.promoteAgent({ customerId }),
      { successMessage: "Member promoted to agent" }
    );

  const demote = (customerId: string) => {
    setConfirmDemote(null);
    void ctl.run(
      `agent-demote-${customerId}`,
      () => api.admin.demoteAgent({ customerId }),
      { successMessage: "Agent removed — back to a normal member account" }
    );
  };

  const requestDemote = (customerId: string) => {
    if (confirmDemote !== customerId) {
      setConfirmDemote(customerId);
      window.setTimeout(
        () => setConfirmDemote((current) => (current === customerId ? null : current)),
        4000
      );
      return;
    }
    demote(customerId);
  };

  const handoffText = handoff
    ? `Hi ${handoff.name}, you're now a SKYWARE agent.\nLogin: ${handoff.login}\nPassword: ${handoff.password}`
    : "";
  const handoffDigits = (handoff?.phone || "").replace(/\D/g, "").slice(-10);
  const whatsappHref = `https://wa.me/${handoffDigits ? `91${handoffDigits}` : ""}?text=${encodeURIComponent(handoffText)}`;

  const copyHandoff = () => {
    if (!handoffText) return;
    void copyText(handoffText).then((copied) => {
      if (copied) {
        setCopiedHandoff(true);
        setTimeout(() => setCopiedHandoff(false), 1600);
      } else {
        ctl.notify("error", "Copy blocked by the browser — select the details and copy manually");
      }
    });
  };

  const promoteCandidates = customers
    .filter((customer) => customer.agent?.status !== "APPROVED")
    .filter((customer) => {
      const query = promoteQuery.trim().toLowerCase();
      if (!query) return true;
      return [customer.name, customer.phone, customer.email, customer.referralCode]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    })
    .slice(0, 8);

  return (
    <div className="space-y-4">
      <ConsoleHero
        eyebrow="Agent programme"
        title="People who sell for you"
        subtitle="Agents refer buyers on their own network. They earn a higher commission than the standard affiliate rate, unlock monthly slab bonuses and receive a gift each time a slab is cleared. Applications stay hidden until you approve them."
        icon={Handshake}
        accent="sky"
        stats={[
          { label: "Awaiting review", value: formatCount(pending.length), sub: "applications", tone: "text-[var(--adm-warning)]" },
          { label: "Active agents", value: formatCount(agents.length), sub: `${draft.agentCommissionPercent}% commission`, tone: "text-[var(--adm-accent)]" },
          { label: "Sales this month", value: `${formatCount(Math.round(monthSales))} coins`, sub: period, tone: "text-[var(--adm-info)]" },
          { label: "Gifts to ship", value: formatCount(pendingGifts), sub: "pending dispatch", tone: "text-[var(--adm-danger)]" },
        ]}
      />

      <Panel>
        <PanelHeader
          title="Add agent"
          subtitle="Create a login for a new agent, or promote an existing member. Both go live instantly at the agent rate."
          icon={UserCheck}
          tone="sky"
        />
        <div className="grid gap-6 p-5 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--adm-text-muted)]">New agent login</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Agent name">
                <TextInput
                  maxLength={80}
                  value={newAgent.name}
                  placeholder="e.g. Priya Verma"
                  onChange={(event) => setNewAgent({ ...newAgent, name: event.target.value })}
                />
              </Field>
              <Field label="Mobile number" hint="This becomes their login ID.">
                <TextInput
                  type="tel"
                  maxLength={16}
                  value={newAgent.phone}
                  placeholder="+91 98765 43210"
                  onChange={(event) => setNewAgent({ ...newAgent, phone: event.target.value })}
                />
              </Field>
            </div>
            <Field label="Email (optional)" hint="Agents can log in with either the number or the email.">
              <TextInput
                type="email"
                maxLength={120}
                value={newAgent.email}
                placeholder="agent@example.com"
                onChange={(event) => setNewAgent({ ...newAgent, email: event.target.value })}
              />
            </Field>
            <Field label="Login password" hint="6+ characters. Share it with the agent once; they can change it later.">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <TextInput
                    type={passwordVisible ? "text" : "password"}
                    maxLength={64}
                    value={newPassword}
                    className="pr-9"
                    onChange={(event) => setNewPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={passwordVisible ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-[var(--adm-text-muted)] transition hover:text-[var(--adm-text)]"
                    onClick={() => setPasswordVisible((visible) => !visible)}
                  >
                    {passwordVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <AdminButton
                  variant="ghost"
                  icon={Sparkles}
                  onClick={() => {
                    setNewPassword(suggestAgentPassword());
                    setPasswordVisible(true);
                  }}
                >
                  Generate
                </AdminButton>
              </div>
            </Field>
            <AdminButton
              variant="primary"
              icon={Plus}
              disabled={!canCreateAgent}
              pending={ctl.isPending("agent-create")}
              onClick={createAgent}
            >
              Create agent
            </AdminButton>

            {handoff ? (
              <div className="space-y-3 border border-[var(--adm-success)]/25 bg-[var(--adm-success)]/6 p-3.5">
                <p className="text-[11px] font-black text-[var(--adm-success)]">
                  Login created for {handoff.name} — send these once
                </p>
                <div className="grid gap-1 font-mono text-[11px] text-[var(--adm-text)]">
                  <span>
                    <span className="text-[var(--adm-text-muted)]">ID </span>
                    {handoff.login}
                  </span>
                  <span>
                    <span className="text-[var(--adm-text-muted)]">PW </span>
                    {handoff.password}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <AdminButton variant="ghost" icon={copiedHandoff ? Check : Copy} onClick={copyHandoff}>
                    {copiedHandoff ? "Copied" : "Copy details"}
                  </AdminButton>
                  <AdminButton
                    variant="primary"
                    icon={MessageCircle}
                    onClick={() => window.open(whatsappHref, "_blank", "noopener")}
                  >
                    Send on WhatsApp
                  </AdminButton>
                  <button
                    type="button"
                    className="font-mono text-[10px] text-[var(--adm-text-muted)] underline-offset-2 hover:text-[var(--adm-text)] hover:underline"
                    onClick={() => setHandoff(null)}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-3 lg:border-l lg:border-[var(--adm-border)] lg:pl-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--adm-text-muted)]">Promote an existing member</p>
            <TextInput
              value={promoteQuery}
              placeholder="Search members by name, phone or code"
              onChange={(event) => setPromoteQuery(event.target.value)}
            />
            <div className="space-y-2">
              {promoteCandidates.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No members match"
                  message={promoteQuery.trim() ? "Try a different name or number." : "Everyone with an account is already an agent."}
                />
              ) : (
                promoteCandidates.map((customer) => (
                  <RowCard key={customer.id} tone="sky" className="p-3 pl-4">
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black text-[var(--adm-text)]">
                          {customer.name}{" "}
                          <span className="font-normal text-[var(--adm-text-muted)]">({customer.phone})</span>
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[10px] text-[var(--adm-text-muted)]">
                          {customer.referralCode ?? "no code"}
                          {customer.agent?.status === "PENDING" ? " · application pending" : ""}
                          {customer.agent?.status === "REJECTED"
                            ? customer.agent.rejectReason === "Agent access removed by admin"
                              ? " · agent access removed"
                              : " · previously rejected"
                            : ""}
                        </p>
                      </div>
                      <AdminButton
                        variant="ghost"
                        icon={Handshake}
                        pending={ctl.isPending(`agent-promote-${customer.id}`)}
                        onClick={() => promote(customer.id)}
                      >
                        Make agent
                      </AdminButton>
                    </div>
                  </RowCard>
                ))
              )}
            </div>
            <p className="font-mono text-[10px] text-[var(--adm-text-muted)]">
              Showing {formatCount(promoteCandidates.length)} of {formatCount(customers.filter((c) => c.agent?.status !== "APPROVED").length)} eligible member(s).
            </p>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Applications"
          subtitle={
            pending.length
              ? `${pending.length} waiting on your decision`
              : "No applications waiting"
          }
          icon={UserCheck}
          tone="amber"
        />
        <div className="space-y-2 p-4">
          {pending.length === 0 ? (
            <EmptyState
              icon={Handshake}
              title="No pending applications"
              message="Customers apply from their account page. Approved agents show up in the roster below."
            />
          ) : (
            pending.map((customer) => {
              const profile = customer.agent!;
              return (
                <RowCard key={customer.id} tone="amber" className="p-3.5 pl-4">
                  <div className="flex min-w-0 flex-col gap-3">
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black text-[var(--adm-text)]">
                          {customer.name}{" "}
                          <span className="font-normal text-[var(--adm-text-muted)]">({customer.phone})</span>
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[10px] text-[var(--adm-text-muted)]">
                          applied {dateLabel(profile.appliedAt)} · code {customer.referralCode ?? "—"}
                        </p>
                        {profile.pitch ? (
                          <p className="mt-2 max-w-2xl font-mono text-[11px] leading-relaxed text-[var(--adm-text-muted)]">
                            &ldquo;{profile.pitch}&rdquo;
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <AdminButton
                          variant="ghost"
                          icon={X}
                          onClick={() => {
                            setRejectingId(rejectingId === customer.id ? null : customer.id);
                            setRejectReason("");
                          }}
                        >
                          Reject
                        </AdminButton>
                        <AdminButton
                          variant="primary"
                          icon={Check}
                          pending={ctl.isPending(`agent-approve-${customer.id}`)}
                          onClick={() => review(customer.id, "approve")}
                        >
                          Approve
                        </AdminButton>
                      </div>
                    </div>

                    {rejectingId === customer.id ? (
                      <div className="flex flex-col gap-2 border-t border-[var(--adm-border)] pt-3 sm:flex-row sm:items-end">
                        <Field label="Reason (shown to the customer)" className="flex-1">
                          <TextArea
                            rows={2}
                            maxLength={200}
                            value={rejectReason}
                            placeholder="Needs an active audience before reapplying"
                            onChange={(event) => setRejectReason(event.target.value)}
                          />
                        </Field>
                        <AdminButton
                          variant="danger"
                          icon={XCircle}
                          disabled={rejectReason.trim().length < 3}
                          pending={ctl.isPending(`agent-reject-${customer.id}`)}
                          onClick={() => review(customer.id, "reject", rejectReason.trim())}
                        >
                          Confirm reject
                        </AdminButton>
                      </div>
                    ) : null}
                  </div>
                </RowCard>
              );
            })
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Commission & ladder"
          subtitle="Agents earn this rate on every paid referred order. Each slab pays a one-time monthly bonus plus a gift once that month's agent sales cross the target."
          icon={Coins}
          tone="violet"
          actions={
            <>
              {configDirty ? (
                <Pill tone="border-[var(--adm-warning)]/35 bg-[var(--adm-warning)]/10 text-[var(--adm-warning)]">Unsaved</Pill>
              ) : null}
              <AdminButton
                variant="ghost"
                icon={RotateCcw}
                disabled={!configDirty}
                onClick={() => setConfigDraft(null)}
              >
                Discard
              </AdminButton>
              <AdminButton
                variant="primary"
                icon={Send}
                disabled={!configDirty}
                pending={ctl.isPending("agent-config")}
                onClick={saveConfig}
              >
                Save
              </AdminButton>
            </>
          }
        />
        <div className="space-y-4 p-5">
          <Field
            label="Agent commission (%)"
            hint={`Standard affiliates earn ${rules.referralCommissionPercent}%. Server accepts 0–50%.`}
            className="max-w-xs"
          >
            <TextInput
              type="number"
              min={0}
              max={50}
              value={draft.agentCommissionPercent}
              onChange={(event) =>
                patchConfig({ agentCommissionPercent: Number(event.target.value) })
              }
            />
          </Field>

          <div className="space-y-2">
            {draft.agentSlabs.map((slab, index) => (
              <div
                key={index}
                className="grid gap-2 border border-[var(--adm-border)] bg-[var(--adm-bg)] p-3 sm:grid-cols-[110px_110px_1fr_auto]"
              >
                <Field label={`Slab ${index + 1} target`}>
                  <TextInput
                    type="number"
                    min={1}
                    value={slab.targetCoins}
                    onChange={(event) => patchSlab(index, { targetCoins: Number(event.target.value) })}
                  />
                </Field>
                <Field label="Bonus coins">
                  <TextInput
                    type="number"
                    min={0}
                    value={slab.bonusCoins}
                    onChange={(event) => patchSlab(index, { bonusCoins: Number(event.target.value) })}
                  />
                </Field>
                <Field label="Gift">
                  <TextInput
                    maxLength={80}
                    value={slab.gift}
                    placeholder="Optional gift name"
                    onChange={(event) => patchSlab(index, { gift: event.target.value })}
                  />
                </Field>
                <div className="flex items-end justify-end">
                  <button
                    type="button"
                    title="Remove this target"
                    aria-label={`Remove target ${index + 1}`}
                    onClick={() => removeSlab(index)}
                    className="p-2 text-[var(--adm-text-muted)] transition-colors hover:text-[var(--adm-danger)]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <AdminButton
                variant="ghost"
                icon={Plus}
                disabled={draft.agentSlabs.length >= MAX_AGENT_SLABS}
                onClick={addSlab}
              >
                Add target
              </AdminButton>
              <p className="font-mono text-[10px] text-[var(--adm-text-muted)]">
                Up to {MAX_AGENT_SLABS} targets · clearing a target removes that slab.
              </p>
            </div>
            <p className="font-mono text-[10px] text-[var(--adm-text-muted)]">
              Defaults are {DEFAULT_AGENT_SLABS.map((slab) => `${formatCount(slab.targetCoins)} → ${formatCount(slab.bonusCoins)}`).join(" · ")} coins.
            </p>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Agent roster"
          subtitle={`${formatCount(agents.length)} approved agent(s) · period ${period}`}
          icon={Handshake}
          tone="emerald"
        />
        <div className="space-y-2 p-4">
          {agents.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No agents yet"
              message="Approve an application above to start the programme."
            />
          ) : (
            agents.map((customer) => {
              const sales = agentMonthlySalesCoins(customer, period);
              const next = agentNextSlabFor(rules, sales);
              const gifts = customer.agent?.gifts ?? [];
              return (
                <RowCard key={customer.id} tone="emerald" className="p-3.5 pl-4">
                  <div className="flex min-w-0 flex-col gap-3">
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black text-[var(--adm-text)]">
                          {customer.name}{" "}
                          <span className="font-normal text-[var(--adm-text-muted)]">({customer.phone})</span>
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[10px] text-[var(--adm-text-muted)]">
                          {customer.referralCode ?? "no code"} · {formatCount(Math.round(customer.referralCoinBalance ?? 0))} coins earned
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-sm font-black text-[var(--adm-success)]">
                          {formatCount(Math.round(sales))} coins
                        </span>
                        <Pill tone={TONE_PAID}>APPROVED</Pill>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <ProgressBar done={sales} total={next?.targetCoins ?? Math.max(sales, 1)} tone="emerald" />
                      <p className="font-mono text-[10px] text-[var(--adm-text-muted)]">
                        {next
                          ? `${formatCount(Math.round(next.targetCoins - sales))} coins to ${formatCount(next.targetCoins)} — bonus ${formatCount(next.bonusCoins)}${next.gift ? ` + ${next.gift}` : ""}`
                          : "All monthly slabs cleared"}
                      </p>
                    </div>

                    {gifts.length ? (
                      <div className="space-y-1.5 border-t border-[var(--adm-border)] pt-2.5">
                        {gifts.map((gift) => (
                          <div key={gift.id} className="flex flex-wrap items-center justify-between gap-2">
                            <p className="min-w-0 truncate font-mono text-[11px] text-[var(--adm-text)]">
                              {gift.label} <span className="text-[var(--adm-text-muted)]">· {gift.period}</span>
                            </p>
                            {gift.status === "PENDING_DISPATCH" ? (
                              <AdminButton
                                variant="ghost"
                                icon={Truck}
                                pending={ctl.isPending(`agent-gift-${gift.id}`)}
                                onClick={() => dispatchGift(customer.id, gift.id)}
                              >
                                Mark dispatched
                              </AdminButton>
                            ) : (
                              <Pill tone={TONE_PAID}>DISPATCHED</Pill>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className="flex items-center justify-end border-t border-[var(--adm-border)] pt-2.5">
                      <AdminButton
                        variant={confirmDemote === customer.id ? "danger" : "ghost"}
                        icon={UserMinus}
                        pending={ctl.isPending(`agent-demote-${customer.id}`)}
                        onClick={() => requestDemote(customer.id)}
                      >
                        {confirmDemote === customer.id ? "Confirm — remove agent" : "Make user"}
                      </AdminButton>
                    </div>
                  </div>
                </RowCard>
              );
            })
          )}
        </div>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------- members */

const TIER_STYLES: Record<string, string> = {
  Silver: "text-[var(--adm-text-muted)]",
  Gold: "text-[var(--adm-warning)]",
  Platinum: "text-[var(--adm-info)]",
  VIP: "text-[var(--adm-accent)]",
};

function getTierStyle(tier?: string | null): string {
  if (!tier) return TIER_STYLES.Silver;
  const normalized = tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
  return TIER_STYLES[tier] || TIER_STYLES[normalized] || TIER_STYLES.Silver;
}

const TIER_OPTIONS: CustomerAccount["tier"][] = ["Silver", "Gold", "Platinum", "VIP"];

function coinTypeTone(type: string): string {
  if (type === "CASHBACK") return "border-[var(--adm-success)]/30 bg-[var(--adm-success)]/10 text-[var(--adm-success)]";
  if (type === "REFERRAL_COMMISSION") return "border-[var(--adm-danger)]/30 bg-[var(--adm-danger)]/10 text-[var(--adm-danger)]";
  if (type === "REDEMPTION") return "border-[var(--adm-danger)]/30 bg-[var(--adm-danger)]/10 text-[var(--adm-danger)]";
  if (type === "REFUND") return "border-[var(--adm-info)]/30 bg-[var(--adm-info)]/10 text-[var(--adm-info)]";
  return "border-[var(--adm-warning)]/30 bg-[var(--adm-warning)]/10 text-[var(--adm-warning)]";
}

function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const initials = parts.map((part) => part.charAt(0).toUpperCase()).join("");
  return initials || "Z★";
}

function MemberAvatar({
  name,
  tier,
  size = "md",
}: {
  name: string;
  tier: CustomerAccount["tier"];
  size?: "md" | "lg";
}) {
  const box = size === "lg" ? "h-14 w-14 text-base" : "h-10 w-10 text-xs";
  return (
    <span
      className={`flex ${box} shrink-0 items-center justify-center rounded-none border border-[var(--adm-border)] bg-[var(--adm-bg)] font-mono font-bold ${getTierStyle(tier)}`}
      aria-hidden="true"
    >
      {memberInitials(name)}
    </span>
  );
}

function CoinSplitBar({ available, pending }: { available: number; pending: number }) {
  const total = available + pending;
  const availableShare = total > 0 ? (available / total) * 100 : 0;
  return (
    <div className="mt-2 flex h-1 w-full overflow-hidden border border-[var(--adm-border)] bg-[var(--adm-bg)]" aria-hidden="true">
      {total > 0 ? (
        <>
          <div
            className="h-full bg-[var(--adm-accent)] transition-all duration-300"
            style={{ width: `${availableShare}%` }}
          />
          <div className="h-full flex-1 bg-[var(--adm-warning)]/40" />
        </>
      ) : null}
    </div>
  );
}

function MembersTab({
  ctl,
  focusId,
  onFocus,
}: {
  ctl: AdminController;
  focusId: string | null;
  onFocus: (customerId: string | null) => void;
}) {
  const customers = ctl.snapshot.customers;
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const digits = query.replace(/\D/g, "");
    if (!needle) return customers;
    return customers.filter(
      (customer) =>
        customer.id.toLowerCase() === needle ||
        (digits.length >= 3 && customer.phone.replace(/\D/g, "").includes(digits)) ||
        customer.name.toLowerCase().includes(needle) ||
        Boolean(customer.email && customer.email.toLowerCase().includes(needle)) ||
        customer.referralCode.toLowerCase().includes(needle) ||
        customer.id.toLowerCase().includes(needle)
    );
  }, [customers, query]);

  const exactIdHit = customers.find((customer) => customer.id.toLowerCase() === query.trim().toLowerCase()) ?? null;
  const focused =
    exactIdHit ??
    customers.find((customer) => customer.id === focusId) ??
    (results.length === 1 ? results[0] : null);

  const [isCreating, setIsCreating] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberPhone, setNewMemberPhone] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberCoins, setNewMemberCoins] = useState("0");
  const [newMemberTier, setNewMemberTier] = useState<CustomerAccount["tier"]>("Silver");
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!newMemberName.trim()) {
      setCreateError("Name is required");
      return;
    }
    if (!newMemberPhone.trim() && !newMemberEmail.trim()) {
      setCreateError("Mobile number or Email is required");
      return;
    }
    const res = await ctl.run(
      "create-member",
      async () => {
        return await api.admin.createCustomer({
          name: newMemberName.trim(),
          phone: newMemberPhone.trim(),
          email: newMemberEmail.trim() || undefined,
          tier: newMemberTier,
          availableCoins: Number(newMemberCoins) || 0,
        });
      },
      {
        successMessage: `Profile created for ${newMemberName.trim()}`,
      }
    );
    if (res.ok) {
      setIsCreating(false);
      setCreateError(null);
      setNewMemberName("");
      setNewMemberPhone("");
      setNewMemberEmail("");
      setNewMemberCoins("0");
      setNewMemberTier("Silver");
    } else {
      setCreateError(res.error || "Failed to create profile");
    }
  };

  const openMemberDirect = async (customerId: string, customerName: string) => {
    const tab = window.open("about:blank", "_blank");
    const result = await ctl.run(`preview-${customerId}`, () => api.admin.openMemberSession(customerId), {
      successMessage: `Opening live account & wallet for ${customerName}...`,
    });
    if (!result.ok) {
      tab?.close();
      return;
    }
    if (tab) tab.location.href = "/account";
    else window.location.href = "/account";
  };

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--adm-border)] pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 bg-[var(--adm-accent)]" aria-hidden="true" />
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--adm-text-muted)]">
              Members and wallets
            </p>
          </div>
          <h1
            className="mt-1 text-2xl font-bold uppercase tracking-tight text-[var(--adm-text)]"
            style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
          >
            Members
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <AdminButton
            variant="ghost"
            size="sm"
            icon={RefreshCw}
            pending={ctl.isPending("refresh")}
            onClick={() => void ctl.refresh()}
          >
            Refresh
          </AdminButton>
          <AdminButton variant="primary" size="sm" icon={Plus} onClick={() => setIsCreating(true)}>
            New profile
          </AdminButton>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-px overflow-hidden border border-[var(--adm-border)] bg-[var(--adm-fill)] sm:grid-cols-3">
        <div className="bg-[var(--adm-surface)] px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--adm-text-muted)]">Profiles</p>
          <p className="mt-1 font-mono text-xl font-bold leading-none tabular-nums text-[var(--adm-text)]">
            {formatCount(customers.length)}
          </p>
          <p className="mt-1 truncate text-[10px] text-[var(--adm-text-muted)]">{formatCount(results.length)} in view</p>
        </div>
        <div className="bg-[var(--adm-surface)] px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--adm-text-muted)]">Coins in circulation</p>
          <p className="mt-1 font-mono text-xl font-bold leading-none tabular-nums text-[var(--adm-warning)]">
            {formatCount(ctl.snapshot.metrics.coinsInCirculation)}
          </p>
          <p className="mt-1 truncate text-[10px] text-[var(--adm-text-muted)]">reward liability</p>
        </div>
        <div className="bg-[var(--adm-surface)] px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--adm-text-muted)]">Ready to pay</p>
          <p className="mt-1 font-mono text-xl font-bold leading-none tabular-nums text-[var(--adm-accent)]">
            {formatCount(ctl.snapshot.metrics.pendingPayableCoins)}
          </p>
          <p className="mt-1 truncate text-[10px] text-[var(--adm-text-muted)]">payout parts due today</p>
        </div>
      </div>

      <div className="border border-[var(--adm-border)] bg-[var(--adm-surface)]">
        <div className="flex flex-col gap-2 p-2.5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 border border-[var(--adm-border)] bg-[var(--adm-bg)] px-2.5 py-1.5 focus-within:border-[var(--adm-accent)]">
            <Search className="h-3.5 w-3.5 shrink-0 text-[var(--adm-text-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Member ID, mobile, email, name or SKYWARE code"
              aria-label="Search members by ID, mobile number, email, name or referral code"
              className="w-full min-w-0 bg-transparent font-mono text-xs text-[var(--adm-text)] placeholder:text-[var(--adm-text-muted)] focus:outline-none"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="shrink-0 text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]"
                aria-label="Clear member search"
              >
                <XCircle className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <p className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-[var(--adm-text-muted)]">
            {query.trim() ? `${formatCount(results.length)} match${results.length === 1 ? "" : "es"}` : "Paste a full member ID to jump to it"}
          </p>
        </div>
      </div>

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--adm-border)] px-4 py-2.5">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--adm-text-muted)]">Directory</h2>
          <p className="font-mono text-[10px] text-[var(--adm-text-muted)]">Open a row to edit wallet, payouts and orders</p>
        </div>
        {results.length === 0 ? (
          <div className="p-3">
            <EmptyState
              icon={Search}
              title="No member matches"
              message="Paste a full member ID like usr-mv93zpgd, the last six digits of the mobile number, or the exact email used at checkout."
            />
          </div>
        ) : (
          <div className="divide-y divide-[var(--adm-border)]">
            {results.map((customer) => {
              const active = focused?.id === customer.id;
              const total = customer.availableCoins + customer.pendingCoins;
              const hasBankReview = (customer.bankAccounts || []).some((b) => b.status === "PENDING_REVIEW" || Boolean(b.pendingUpdate));
              const hasUpiReview = customer.upiStatus === "PENDING_REVIEW" && Boolean(customer.pendingUpiId);
              return (
                <div
                  key={customer.id}
                  className={`relative transition-colors ${active ? "bg-[var(--adm-accent)]/5" : "hover:bg-[var(--adm-bg)]"}`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute inset-y-0 left-0 w-[3px] ${hasBankReview || hasUpiReview ? "bg-[var(--adm-warning)]" : active ? "bg-[var(--adm-accent)]" : "bg-transparent"}`}
                  />
                  <div className="flex flex-col gap-2.5 p-3 pl-4 lg:flex-row lg:items-center lg:gap-4">
                    <button
                      type="button"
                      onClick={() => onFocus(customer.id)}
                      aria-pressed={active}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <MemberAvatar name={customer.name} tier={customer.tier} />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-xs font-bold text-[var(--adm-text)]">{customer.name}</span>
                          <span
                            className={`inline-flex items-center border border-[var(--adm-border)] bg-[var(--adm-bg)] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${getTierStyle(customer.tier)}`}
                          >
                            {customer.tier}
                          </span>
                          {(hasBankReview || hasUpiReview) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                ctl.setTab("bank-reviews");
                              }}
                              className="inline-flex items-center gap-1 border border-[var(--adm-warning)] bg-[var(--adm-warning)]/15 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--adm-warning)] hover:bg-[var(--adm-warning)]/30 transition-colors"
                              title="Go to Bank & UPI Reviews Desk"
                            >
                              <AlertTriangle className="h-2.5 w-2.5 animate-pulse" />
                              Review in Bank Desk →
                            </button>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate font-mono text-[10px] text-[var(--adm-text-muted)]">
                          {customer.phone}
                          {customer.email ? ` · ${customer.email}` : ""}
                        </span>
                        <span className="mt-0.5 block truncate font-mono text-[10px] text-[var(--adm-text-muted)]">
                          ID {customer.id} · {customer.referralCode}
                        </span>
                      </span>
                    </button>

                    <div className="min-w-0 pl-[52px] lg:w-44 lg:shrink-0 lg:pl-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-mono text-sm font-bold tabular-nums text-[var(--adm-accent)]">
                          {formatCount(customer.availableCoins)}
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)]">ready</span>
                      </div>
                      <p className="mt-0.5 font-mono text-[10px] text-[var(--adm-text-muted)]">
                        <span className="text-[var(--adm-warning)]">{formatCount(customer.pendingCoins)} locked</span>
                        <span> · {formatCount(total)} total</span>
                      </p>
                      <CoinSplitBar available={customer.availableCoins} pending={customer.pendingCoins} />
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5 pl-[52px] lg:pl-0">
                      <AdminButton
                        size="sm"
                        variant={active ? "primary" : "ghost"}
                        onClick={() => onFocus(customer.id)}
                      >
                        {active ? "Editing" : "Open"}
                      </AdminButton>
                      <AdminButton
                        size="sm"
                        variant="outline"
                        icon={LogIn}
                        pending={ctl.isPending(`preview-${customer.id}`)}
                        onClick={() => void openMemberDirect(customer.id, customer.name)}
                        title="Sign into this member's account and view their wallet"
                      >
                        Wallet
                      </AdminButton>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Modal
        open={isCreating}
        onClose={() => setIsCreating(false)}
        icon={User}
        title="New member profile"
        subtitle="Creates an account with a live wallet ledger from day one."
        maxWidth="max-w-md"
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setIsCreating(false)}>
              Cancel
            </AdminButton>
            <AdminButton
              type="submit"
              form="create-member-form"
              variant="primary"
              icon={Plus}
              pending={ctl.isPending("create-member")}
            >
              Create profile
            </AdminButton>
          </>
        }
      >
        <form id="create-member-form" onSubmit={handleCreateMember} className="space-y-3">
          {createError ? <ErrorNote message={createError} /> : null}
          <Field label="Full name" required>
            <TextInput
              value={newMemberName}
              onChange={(event) => setNewMemberName(event.target.value)}
              placeholder="Rahul Verma"
              autoComplete="off"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Mobile number">
              <TextInput
                type="tel"
                inputMode="numeric"
                value={newMemberPhone}
                onChange={(event) => setNewMemberPhone(event.target.value)}
                placeholder="9876543210"
              />
            </Field>
            <Field label="Email">
              <TextInput
                type="email"
                value={newMemberEmail}
                onChange={(event) => setNewMemberEmail(event.target.value)}
                placeholder="rahul@example.com"
              />
            </Field>
          </div>
          <p className="-mt-1 font-mono text-[10px] text-[var(--adm-text-muted)]">Mobile or email — at least one is required.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Membership tier">
              <SelectInput
                value={newMemberTier}
                onChange={(event) => setNewMemberTier(event.target.value as CustomerAccount["tier"])}
              >
                {TIER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Starting coins">
              <TextInput
                type="number"
                min={0}
                inputMode="numeric"
                value={newMemberCoins}
                onChange={(event) => setNewMemberCoins(event.target.value)}
              />
            </Field>
          </div>
        </form>
      </Modal>

      {focused ? <MemberProfile key={focused.id} ctl={ctl} customer={focused} /> : null}
    </>
  );
}

function MemberProfile({ ctl, customer }: { ctl: AdminController; customer: CustomerAccount }) {
  const [draft, setDraft] = useState({
    name: customer.name,
    phone: customer.phone,
    email: customer.email ?? "",
    tier: customer.tier,
    availableCoins: customer.availableCoins,
    pendingCoins: customer.pendingCoins,
  });

  const orders = ctl.snapshot.orders.filter(
    (order) => order.customerId === customer.id || (!!customer.email && order.customerEmail === customer.email)
  );
  const transactions = ctl.snapshot.transactions.filter((tx) => tx.customerId === customer.id);
  const withdrawals = ctl.snapshot.withdrawals.filter((request) => request.customerId === customer.id);
  const runningPayouts = withdrawals.filter((request) => request.overallStatus === "VESTING_IN_PROGRESS");
  const [raisingPayout, setRaisingPayout] = useState(false);
  const [editingBank, setEditingBank] = useState(false);

  const dirty =
    draft.name !== customer.name ||
    draft.phone !== customer.phone ||
    draft.email !== (customer.email ?? "") ||
    draft.tier !== customer.tier ||
    draft.availableCoins !== customer.availableCoins ||
    draft.pendingCoins !== customer.pendingCoins;

  const patch = (values: Partial<typeof draft>) => setDraft((prev) => ({ ...prev, ...values }));
  const shiftCoins = (delta: number) =>
    patch({ availableCoins: Math.max(0, Math.round(draft.availableCoins + delta)) });

  const coinDelta = draft.availableCoins - customer.availableCoins;
  const pendingDelta = draft.pendingCoins - customer.pendingCoins;
  const walletTotal = customer.availableCoins + customer.pendingCoins;

  const copyId = (id: string) => copyToClipboard(id, ctl, `Member ID ${id} copied`);

  const previewOpen = ctl.snapshot.storefrontCustomerId === customer.id;

  const openPreview = async () => {
    const tab = window.open("about:blank", "_blank");
    const result = await ctl.run(`preview-${customer.id}`, () => api.admin.openMemberSession(customer.id), {
      successMessage: `Storefront opened as ${customer.name} — the new tab shows their live wallet, orders and payouts.`,
    });
    if (!result.ok) {
      tab?.close();
      return;
    }
    if (tab) tab.location.href = "/account";
    else ctl.notify("info", `Preview session for ${customer.name} is live — your browser blocked the tab, so open /account yourself.`);
  };

  const endPreview = async () => {
    await ctl.run(`preview-end-${customer.id}`, () => api.admin.closeMemberSession(customer.id), {
      successMessage: "Member preview closed — that browser session is signed out of the storefront again.",
    });
  };

  const save = () => {
    const body: AdminCustomerPatch = {};
    if (draft.name.trim() && draft.name.trim() !== customer.name) body.name = draft.name.trim();
    if (draft.phone.trim() && draft.phone.trim() !== customer.phone) body.phone = draft.phone.trim();
    if (draft.email.trim() !== (customer.email ?? "").trim()) body.email = draft.email.trim() || undefined;
    if (draft.tier !== customer.tier) body.tier = draft.tier;
    if (draft.availableCoins !== customer.availableCoins) body.availableCoins = draft.availableCoins;
    if (draft.pendingCoins !== customer.pendingCoins) body.pendingCoins = draft.pendingCoins;

    void ctl.run(`member-${customer.id}`, () => api.admin.patchCustomer(customer.id, body), {
      successMessage: `${customer.name}'s wallet saved — ledger and audit log updated`,
    });
  };

  return (
    <>
      <section className="border border-[var(--adm-border)] bg-[var(--adm-surface)]">
        {/* Pending Payout Banner if this member has an active change request */}
        {((customer.bankAccounts || []).some((b) => b.status === "PENDING_REVIEW" || Boolean(b.pendingUpdate)) ||
          (customer.upiStatus === "PENDING_REVIEW" && Boolean(customer.pendingUpiId))) && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--adm-warning)]/40 bg-[var(--adm-warning)]/10 px-4 py-2.5">
            <div className="flex items-center gap-2 text-[var(--adm-warning)]">
              <AlertTriangle className="h-4 w-4 shrink-0 animate-pulse" />
              <span className="font-mono text-xs font-bold">
                Payout Method Change Request Pending Review for this member
              </span>
            </div>
            <AdminButton
              size="sm"
              variant="primary"
              onClick={() => ctl.setTab("bank-reviews")}
            >
              Open in Bank Reviews Desk →
            </AdminButton>
          </div>
        )}
        <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <MemberAvatar name={customer.name} tier={customer.tier} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  className="truncate text-lg font-bold uppercase tracking-tight text-[var(--adm-text)]"
                  style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
                >
                  {customer.name}
                </h2>
                <span
                  className={`inline-flex items-center border border-[var(--adm-border)] bg-[var(--adm-bg)] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${getTierStyle(customer.tier)}`}
                >
                  {customer.tier}
                </span>
              </div>
              <p className="mt-1 truncate font-mono text-[11px] text-[var(--adm-text)]">
                {customer.phone}
                {customer.email ? <span className="text-[var(--adm-text-muted)]"> · {customer.email}</span> : null}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] text-[var(--adm-text-muted)]">
                <span>ID {customer.id}</span>
                <span className="text-[var(--adm-on-accent)]">·</span>
                <span>code {customer.referralCode}</span>
                <button
                  type="button"
                  onClick={() => void copyId(customer.id)}
                  className="inline-flex items-center gap-1 border border-[var(--adm-border)] bg-[var(--adm-bg)] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)] transition-colors hover:border-[var(--adm-accent)] hover:text-[var(--adm-accent)]"
                >
                  <Copy className="h-3 w-3" /> Copy
                </button>
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <AdminButton
                  variant="outline"
                  size="sm"
                  icon={LogIn}
                  pending={ctl.isPending(`preview-${customer.id}`)}
                  onClick={() => void openPreview()}
                >
                  {previewOpen ? "Preview live" : "Sign in as member"}
                </AdminButton>
                {previewOpen ? (
                  <AdminButton
                    variant="ghost"
                    size="sm"
                    icon={X}
                    pending={ctl.isPending(`preview-end-${customer.id}`)}
                    onClick={() => void endPreview()}
                  >
                    End preview
                  </AdminButton>
                ) : null}
              </div>
              <p className="mt-1.5 max-w-xl font-mono text-[10px] leading-relaxed text-[var(--adm-text-muted)]">
                Opens the storefront signed in as this member in a new tab — it replaces any sign-in this browser
                already holds.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-end justify-between gap-3 border-t border-[var(--adm-border)] pt-3 lg:flex-col lg:items-end lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
            <div className="text-left lg:text-right">
              <p className="font-mono text-2xl font-bold leading-none tabular-nums text-[var(--adm-text)]">
                {formatCount(walletTotal)}
              </p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--adm-text-muted)]">coins on book</p>
            </div>
            {dirty ? <Pill tone={TONE_UNPAID}>Unsaved draft</Pill> : <Pill tone={TONE_PAID}>In sync</Pill>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px border-t border-[var(--adm-border)] bg-[var(--adm-fill)] sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Available", value: formatCount(customer.availableCoins), tone: "text-[var(--adm-accent)]" },
            { label: "Unlocks weekly", value: formatCount(customer.pendingCoins), tone: "text-[var(--adm-warning)]" },
            { label: "Lifetime earned", value: formatCount(customer.lifetimeEarnedCoins), tone: "text-[var(--adm-text)]" },
            { label: "Orders", value: formatCount(orders.length), tone: "text-[var(--adm-text)]" },
            { label: "Wallet movements", value: formatCount(transactions.length), tone: "text-[var(--adm-text)]" },
            { label: "Payout requests", value: formatCount(withdrawals.length), tone: "text-[var(--adm-info)]" },
          ].map((cell) => (
            <div key={cell.label} className="min-w-0 bg-[var(--adm-bg)] px-3 py-2.5">
              <p className="truncate font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--adm-text-muted)]">{cell.label}</p>
              <p className={`mt-1 truncate font-mono text-base font-bold leading-none tabular-nums ${cell.tone}`}>{cell.value}</p>
            </div>
          ))}
        </div>
      </section>

      <Panel>
        <PanelHeader
          title="Wallet console"
          subtitle="Every balance change writes a wallet transaction and an audit entry, then re-syncs the storefront."
          icon={Pencil}
          tone="rose"
          actions={
            <>
              <AdminButton
                variant="ghost"
                icon={RotateCcw}
                disabled={!dirty}
                onClick={() =>
                  setDraft({
                    name: customer.name,
                    phone: customer.phone,
                    email: customer.email ?? "",
                    tier: customer.tier,
                    availableCoins: customer.availableCoins,
                    pendingCoins: customer.pendingCoins,
                  })
                }
              >
                Discard
              </AdminButton>
              <AdminButton
                variant="primary"
                icon={Send}
                disabled={!dirty}
                pending={ctl.isPending(`member-${customer.id}`)}
                onClick={save}
              >
                Save wallet
              </AdminButton>
            </>
          }
        />

        <div className="grid gap-px bg-[var(--adm-fill)] lg:grid-cols-2">
          <div className="bg-[var(--adm-surface)] p-4">
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--adm-text-muted)]">
              Available coins
            </p>
            <div className="mt-2 flex items-end gap-2">
              <input
                type="number"
                value={draft.availableCoins}
                onChange={(event) => patch({ availableCoins: Math.max(0, Math.round(Number(event.target.value) || 0)) })}
                aria-label="Available coins"
                className="w-36 border border-[var(--adm-border)] bg-[var(--adm-bg)] px-2.5 py-1.5 font-mono text-2xl font-bold tabular-nums text-[var(--adm-accent)] focus:border-[var(--adm-accent)] focus:outline-none"
              />
              <span className="pb-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--adm-text-muted)]">coins</span>
            </div>
            <p className="mt-1.5 font-mono text-[10px]">
              {coinDelta === 0 ? (
                <span className="text-[var(--adm-text-muted)]">No balance change</span>
              ) : (
                <span className={coinDelta > 0 ? "text-[var(--adm-accent)]" : "text-[var(--adm-danger)]"}>
                  {formatCount(customer.availableCoins)} → {formatCount(draft.availableCoins)} ·{" "}
                  {coinDelta > 0 ? "+" : ""}
                  {formatCount(coinDelta)} coins
                </span>
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[500, 100, 25].map((amount) => (
                <span key={amount} className="flex gap-1">
                  <AdminButton size="sm" variant="ghost" onClick={() => shiftCoins(-amount)}>
                    −{amount}
                  </AdminButton>
                  <AdminButton size="sm" variant="ghost" onClick={() => shiftCoins(amount)}>
                    +{amount}
                  </AdminButton>
                </span>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-[var(--adm-border)] pt-3">
              <div className="min-w-0">
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--adm-text-muted)]">
                  Unlocks weekly
                </p>
                <p className="mt-1 max-w-xs font-mono text-[10px] leading-relaxed text-[var(--adm-text-muted)]">
                  Coins arrive 7 / 14 / 21 days after payment — only the engine moves these
                  {pendingDelta !== 0 ? ` · ${pendingDelta > 0 ? "+" : ""}${pendingDelta}` : ""}
                </p>
              </div>
              <input
                type="number"
                value={draft.pendingCoins}
                onChange={(event) => patch({ pendingCoins: Math.max(0, Math.round(Number(event.target.value) || 0)) })}
                aria-label="Pending coins"
                className="w-24 border border-[var(--adm-border)] bg-[var(--adm-bg)] px-2 py-1 text-right font-mono text-lg font-bold tabular-nums text-[var(--adm-warning)] focus:border-[var(--adm-warning)] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid content-start gap-3 bg-[var(--adm-surface)] p-4 sm:grid-cols-2">
            <Field label="Member name">
              <TextInput value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
            </Field>
            <Field label="Mobile number" hint="Orders track against this number.">
              <TextInput value={draft.phone} onChange={(event) => patch({ phone: event.target.value })} />
            </Field>
            <Field label="Email" className="sm:col-span-2">
              <TextInput value={draft.email} onChange={(event) => patch({ email: event.target.value })} />
            </Field>
            <div className="min-w-0 font-mono sm:col-span-2">
              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)]">
                Tier
              </span>
              <div role="group" aria-label="Membership tier" className="grid grid-cols-4 gap-px border border-[var(--adm-border)] bg-[var(--adm-fill)]">
                {TIER_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => patch({ tier: option })}
                    aria-pressed={draft.tier === option}
                    className={`px-2 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      draft.tier === option
                        ? "bg-[var(--adm-accent)] text-[var(--adm-on-accent)]"
                        : "bg-[var(--adm-bg)] text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Payouts to this member"
          subtitle={
            runningPayouts.length
              ? `${formatCount(runningPayouts.length)} running — each one pays in 4 weekly parts from its own locked coins`
              : "No payout is running right now. Raise one here, or the member can ask from their own wallet screen."
          }
          icon={DollarSign}
          tone="sky"
          actions={
            <AdminButton variant="primary" size="sm" icon={Plus} onClick={() => setRaisingPayout(true)}>
              Raise payout
            </AdminButton>
          }
        />
        {withdrawals.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={DollarSign}
              title="No payout raised yet"
              message="Press Raise payout to send coins out for this member, or wait for them to ask from the storefront."
            />
          </div>
        ) : (
          <div className="divide-y divide-[var(--adm-border)]">
            {withdrawals.map((request) => {
              const totals = vestingTotals(request);
              return (
                <div key={request.id} className="flex items-start justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--adm-bg)]">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[11px] font-bold text-[var(--adm-text)]">
                      {request.id} · {formatCount(request.totalCoins)} coins
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-[var(--adm-text-muted)]">
                      {payoutTarget(request)} · {deskNextStep(request)}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-[var(--adm-text-muted)]">
                      asked on {dateLabel(request.requestedAt)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Pill tone={WITHDRAWAL_TONES[request.overallStatus]}>{deskStatus(request)}</Pill>
                    <p className="mt-1 font-mono text-[10px] text-[var(--adm-text-muted)]">
                      {request.overallStatus === "REJECTED"
                        ? `refunded ${formatCount(totals.voidedCoins)} coins`
                        : `paid ${formatCount(totals.paidCoins)} · ready ${formatCount(totals.payableNowCoins)} coins`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* ---------------- Linked Payout Methods & Change Approvals ---------------- */}
      <Panel>
        <PanelHeader
          title="Payout accounts"
          subtitle="UPI and bank details bound to this profile, with change reviews."
          icon={Building2}
          tone="emerald"
        />
        <div className="grid gap-3 p-3 sm:grid-cols-2">
          {/* UPI Box */}
          <div className="border border-[var(--adm-border)] bg-[var(--adm-bg)] p-3">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--adm-border)] pb-2">
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--adm-text-muted)]">UPI VPA</span>
              {customer.savedUpiId ? (
                <span className="border border-[var(--adm-accent)]/40 bg-[var(--adm-accent)]/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--adm-accent)]">
                  Bound
                </span>
              ) : (
                <span className="border border-[var(--adm-border)] bg-[var(--adm-surface)] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)]">
                  None
                </span>
              )}
            </div>
            <p className="mt-2 break-all font-mono text-xs font-bold text-[var(--adm-text)]">
              {customer.savedUpiId || "No UPI linked"}
            </p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] text-[var(--adm-text-muted)]">
                Withdrawals{" "}
                <strong className={customer.upiWithdrawalLocked !== false ? "text-[var(--adm-warning)]" : "text-[var(--adm-accent)]"}>
                  {customer.upiWithdrawalLocked !== false ? "locked" : "unlocked"}
                </strong>
              </span>
              <AdminButton
                size="sm"
                variant={customer.upiWithdrawalLocked !== false ? "primary" : "outline"}
                onClick={async () => {
                  const locked = customer.upiWithdrawalLocked !== false;
                  await ctl.run(
                    `${locked ? "unlock" : "lock"}-upi-withdrawals-${customer.id}`,
                    async () => {
                      const res = await fetch(`/api/admin/customers/${customer.id}/payout-method`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: locked ? "UNLOCK_UPI" : "LOCK_UPI" }),
                      });
                      if (!res.ok) throw new Error(await res.text());
                      return res.json();
                    },
                    { successMessage: `${locked ? "Unlocked" : "Locked"} UPI withdrawals` }
                  );
                  void ctl.refresh();
                }}
              >
                {customer.upiWithdrawalLocked !== false ? "Unlock UPI" : "Lock UPI"}
              </AdminButton>
            </div>
            {customer.upiStatus === "PENDING_REVIEW" && customer.pendingUpiId && (
              <div className="mt-3 border border-[var(--adm-warning)]/40 bg-[var(--adm-warning)]/6 p-2.5">
                <p className="flex items-start gap-1.5 font-mono text-[10px] font-bold text-[var(--adm-warning)]">
                  <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                  <span className="min-w-0 break-all">
                    Change request: <span className="text-[var(--adm-text)]">{customer.pendingUpiId}</span>
                  </span>
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  <AdminButton
                    size="sm"
                    variant="primary"
                    pending={ctl.isPending(`approve-upi-${customer.id}`)}
                    onClick={async () => {
                      await ctl.run(`approve-upi-${customer.id}`, async () => {
                        const res = await fetch(`/api/admin/customers/${customer.id}/payout-method`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "APPROVE", type: "UPI" }),
                        });
                        if (!res.ok) {
                          const err = await res.json().catch(() => ({ error: "Approval failed" }));
                          throw new Error(err.error || "Approval failed");
                        }
                        return res.json();
                      }, { successMessage: `Approved UPI change to ${customer.pendingUpiId}` });
                      void ctl.refresh();
                    }}
                  >
                    Approve UPI
                  </AdminButton>
                  <AdminButton
                    size="sm"
                    variant="outline"
                    pending={ctl.isPending(`reject-upi-${customer.id}`)}
                    onClick={async () => {
                      const reason = prompt("Enter rejection reason:") || "Change request rejected by admin.";
                      await ctl.run(`reject-upi-${customer.id}`, async () => {
                        const res = await fetch(`/api/admin/customers/${customer.id}/payout-method`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "REJECT", type: "UPI", reason }),
                        });
                        if (!res.ok) {
                          const err = await res.json().catch(() => ({ error: "Rejection failed" }));
                          throw new Error(err.error || "Rejection failed");
                        }
                        return res.json();
                      }, { successMessage: "Rejected UPI change request" });
                      void ctl.refresh();
                    }}
                  >
                    Reject
                  </AdminButton>
                </div>
              </div>
            )}
          </div>

          {/* Bank Box */}
          {(() => {
            const pendingBankAcc = (customer.bankAccounts || []).find((b) => b.status === "PENDING_REVIEW" || Boolean(b.pendingUpdate));
            const boundBankAcc = (customer.bankAccounts || []).find((b) => b.status === "VERIFIED" || b.isDefault) || (customer.bankAccounts || [])[0];
            const pendingBankUpdate = pendingBankAcc?.pendingUpdate;

            return (
              <div className="border border-[var(--adm-border)] bg-[var(--adm-bg)] p-3">
                <div className="flex items-center justify-between gap-2 border-b border-[var(--adm-border)] pb-2">
                  <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--adm-text-muted)]">Bank account</span>
                  <div className="flex items-center gap-2">
                    {boundBankAcc ? (
                      <span className="border border-[var(--adm-accent)]/40 bg-[var(--adm-accent)]/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--adm-accent)]">
                        Bound & Verified
                      </span>
                    ) : (
                      <span className="border border-[var(--adm-border)] bg-[var(--adm-surface)] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)]">
                        None
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingBank(true)}
                      className="inline-flex items-center gap-1 border border-[var(--adm-border)] bg-[var(--adm-surface)] px-2 py-0.5 font-mono text-[9px] text-[var(--adm-accent)] hover:bg-[var(--adm-accent)]/10 transition-colors"
                      title="Directly edit or set bank details as Admin"
                    >
                      <Pencil className="h-2.5 w-2.5" />
                      {boundBankAcc ? "Edit Bank" : "Add Bank"}
                    </button>
                  </div>
                </div>

                {boundBankAcc ? (
                  <div className="mt-2 space-y-2 font-mono text-[10px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[var(--adm-text-muted)]">Bank</span>
                      <span className="font-bold text-[var(--adm-text)]">{boundBankAcc.bankName}</span>
                    </div>

                    <div className="border border-[var(--adm-border-soft)] bg-[var(--adm-surface)] p-2 rounded flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[9px] text-[var(--adm-text-muted)] block">Account Number (Plaintext)</span>
                        <span className="font-bold text-[var(--adm-text)] text-xs tracking-wider select-all">
                          {boundBankAcc.accountNumber || (boundBankAcc.accountNumberLast4 ? `••••${boundBankAcc.accountNumberLast4}` : (boundBankAcc.maskedAccountNumber || "None"))}
                        </span>
                      </div>
                      {(boundBankAcc.accountNumber || boundBankAcc.accountNumberLast4) && (
                        <button
                          type="button"
                          onClick={() => {
                            copyToClipboard(boundBankAcc.accountNumber || boundBankAcc.accountNumberLast4 || "", ctl, "Bank account number copied");
                          }}
                          className="inline-flex items-center gap-1 bg-[var(--adm-tint-10)] px-2 py-0.5 text-[9px] text-[var(--adm-text)] hover:bg-[var(--adm-tint-20)] transition-colors"
                          title="Copy Account Number"
                        >
                          <Copy className="h-2.5 w-2.5" /> Copy
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[var(--adm-text-muted)]">IFSC</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[var(--adm-text)] font-bold select-all">{boundBankAcc.ifscCode}</span>
                        <button
                          type="button"
                          onClick={() => {
                            copyToClipboard(boundBankAcc.ifscCode, ctl, "IFSC copied");
                          }}
                          className="p-1 hover:text-[var(--adm-accent)] text-[var(--adm-text-muted)]"
                          title="Copy IFSC"
                        >
                          <Copy className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[var(--adm-text-muted)]">Holder</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[var(--adm-text)] select-all">{boundBankAcc.accountHolderName}</span>
                        <button
                          type="button"
                          onClick={() => {
                            copyToClipboard(boundBankAcc.accountHolderName, ctl, "Holder name copied");
                          }}
                          className="p-1 hover:text-[var(--adm-accent)] text-[var(--adm-text-muted)]"
                          title="Copy Holder Name"
                        >
                          <Copy className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 text-center py-2">
                    <p className="font-mono text-xs text-[var(--adm-text-muted)]">No bank account linked</p>
                    <button
                      type="button"
                      onClick={() => setEditingBank(true)}
                      className="mt-2 inline-flex items-center gap-1 text-[10px] font-mono text-[var(--adm-accent)] hover:underline"
                    >
                      <Plus className="h-3 w-3" /> Link Bank Account Now
                    </button>
                  </div>
                )}

                {pendingBankUpdate && (
                  <div className="mt-3 border border-[var(--adm-warning)]/40 bg-[var(--adm-warning)]/6 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-start gap-1.5 font-mono text-[10px] font-bold text-[var(--adm-warning)]">
                        <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                        <span>Change request pending review</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => ctl.setTab("bank-reviews")}
                        className="font-mono text-[9px] text-[var(--adm-warning)] hover:underline"
                      >
                        Open Desk →
                      </button>
                    </div>
                    <div className="mt-2 space-y-1.5 font-mono text-[10px]">
                      <p className="text-[var(--adm-text-muted)]">
                        Bank: <span className="text-[var(--adm-text)] font-bold">{pendingBankUpdate.bankName}</span>
                      </p>
                      <div className="flex items-center justify-between gap-2 border border-[var(--adm-warning)]/20 bg-[var(--adm-bg)] p-1.5 rounded">
                        <span className="text-[var(--adm-text)] font-bold select-all">
                          {pendingBankUpdate.accountNumber || (pendingBankUpdate.accountNumberLast4 ? `••••${pendingBankUpdate.accountNumberLast4}` : (pendingBankUpdate.maskedAccountNumber || "—"))}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const acct = pendingBankUpdate.accountNumber || pendingBankUpdate.accountNumberLast4 || "";
                            copyToClipboard(acct, ctl, "Account number copied");
                          }}
                          className="inline-flex items-center gap-1 bg-[var(--adm-warning)] text-[var(--adm-on-accent)] px-1.5 py-0.5 text-[9px] font-bold"
                        >
                          <Copy className="h-2.5 w-2.5" /> Copy
                        </button>
                      </div>
                      <p className="text-[var(--adm-text-muted)]">
                        IFSC: <span className="text-[var(--adm-text)] font-bold">{pendingBankUpdate.ifscCode}</span> · Holder: <span className="text-[var(--adm-text)]">{pendingBankUpdate.accountHolderName}</span>
                      </p>
                    </div>
                    <div className="mt-2.5 flex items-center justify-end gap-1.5">
                      <AdminButton
                        size="sm"
                        variant="outline"
                        pending={ctl.isPending(`reject-bank-${customer.id}`)}
                        onClick={async () => {
                          const reason = prompt("Enter rejection reason:") || "Change request rejected by admin.";
                          await ctl.run(`reject-bank-${customer.id}`, async () => {
                            const res = await fetch(`/api/admin/customers/${customer.id}/payout-method`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "REJECT", type: "BANK", reason }),
                            });
                            if (!res.ok) {
                              const err = await res.json().catch(() => ({ error: "Rejection failed" }));
                              throw new Error(err.error || "Rejection failed");
                            }
                            return res.json();
                          }, { successMessage: `Rejected bank account change request for ${customer.name}` });
                          void ctl.refresh();
                        }}
                      >
                        Reject
                      </AdminButton>
                      <AdminButton
                        size="sm"
                        variant="primary"
                        icon={Check}
                        pending={ctl.isPending(`approve-bank-${customer.id}`)}
                        onClick={async () => {
                          await ctl.run(`approve-bank-${customer.id}`, async () => {
                            const res = await fetch(`/api/admin/customers/${customer.id}/payout-method`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "APPROVE", type: "BANK" }),
                            });
                            if (!res.ok) {
                              const err = await res.json().catch(() => ({ error: "Approval failed" }));
                              throw new Error(err.error || "Approval failed");
                            }
                            return res.json();
                          }, { successMessage: `Approved bank account change for ${customer.name}` });
                          void ctl.refresh();
                        }}
                      >
                        Approve Bank Change
                      </AdminButton>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Wallet ledger"
            subtitle={`${formatCount(transactions.length)} entries — cashback, redemption, payout and adjustments`}
            icon={Coins}
            tone="amber"
          />
          <div className="max-h-96 divide-y divide-[var(--adm-border)] overflow-y-auto">
            {transactions.length === 0 ? (
              <div className="p-4">
                <EmptyState icon={Coins} title="No wallet activity" message="Cashback appears here the moment a payment lands." />
              </div>
            ) : (
              transactions.map((tx) => (
                <div key={tx.id} className="flex items-start justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--adm-bg)]">
                  <div className="min-w-0">
                    <span
                      className={`inline-flex border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${coinTypeTone(tx.type)}`}
                    >
                      {tx.type.replace(/_/g, " ")}
                    </span>
                    <p className="mt-1 truncate font-mono text-[11px] text-[var(--adm-text)]">{tx.description}</p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-[var(--adm-text-muted)]">
                      {tx.date}
                      {tx.orderNumber ? ` · ${tx.orderNumber}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`font-mono text-sm font-bold tabular-nums ${tx.coins >= 0 ? "text-[var(--adm-accent)]" : "text-[var(--adm-danger)]"}`}>
                      {tx.coins >= 0 ? "+" : ""}
                      {formatCount(tx.coins)} coins
                    </p>
                    <p
                      className={`mt-1 font-mono text-[9px] font-bold uppercase tracking-wider ${
                        tx.status === "COMPLETED" ? "text-[var(--adm-accent)]" : tx.status === "PENDING" ? "text-[var(--adm-warning)]" : "text-[var(--adm-text-muted)]"
                      }`}
                    >
                      {tx.status}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Orders"
            subtitle={`${formatCount(orders.length)} placed by this member`}
            icon={Package}
            tone="emerald"
          />
          <div className="max-h-96 divide-y divide-[var(--adm-border)] overflow-y-auto">
            {orders.length === 0 ? (
              <div className="p-4">
                <EmptyState icon={Package} title="No orders yet" message="This account has not checked out." />
              </div>
            ) : (
              orders.map((order) => (
                <div
                  key={order.id}
                  className={`flex items-start justify-between gap-3 border-l-[3px] px-4 py-2.5 transition-colors hover:bg-[var(--adm-bg)] ${
                    order.paymentStatus === "PAID" ? "border-[var(--adm-accent)]" : order.paymentStatus === "REFUNDED" ? "border-[var(--adm-border)]" : "border-[var(--adm-warning)]"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs font-bold text-[var(--adm-text)]">{order.orderNumber}</p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-[var(--adm-text-muted)]">
                      {dateTimeLabel(order.placedAt)} ·{" "}
                      {(() => {
                        const units = order.items.reduce((sum, line) => sum + line.quantity, 0);
                        return `${formatCount(units)} unit${units === 1 ? "" : "s"}`;
                      })()}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-[var(--adm-text-muted)]">
                      {order.paymentMethod}
                      {order.gateway ? ` via ${order.gateway}` : ""} · {order.kind}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm font-bold tabular-nums text-[var(--adm-text)]">{formatMoney(order.total)}</p>
                    <div className="mt-1 flex justify-end gap-1">
                      <Pill tone={order.paymentStatus === "PAID" ? TONE_PAID : TONE_UNPAID}>{order.paymentStatus}</Pill>
                      <Pill tone={ORDER_TONES[order.status]}>{order.status}</Pill>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      {raisingPayout ? <RaisePayoutModal ctl={ctl} customer={customer} onClose={() => setRaisingPayout(false)} /> : null}
      {editingBank ? <AdminEditBankModal ctl={ctl} customer={customer} open={editingBank} onClose={() => setEditingBank(false)} /> : null}
    </>
  );
}

/* ----------------------------------------------------------------- direct bank account setup */

function AdminEditBankModal({
  ctl,
  customer,
  open,
  onClose,
}: {
  ctl: AdminController;
  customer: CustomerAccount;
  open: boolean;
  onClose: () => void;
}) {
  const currentBank = (customer.bankAccounts || []).find((b) => b.status === "VERIFIED" || b.isDefault) || (customer.bankAccounts || [])[0];
  const [bankName, setBankName] = useState(currentBank?.bankName || "State Bank of India");
  const [ifscCode, setIfscCode] = useState(currentBank?.ifscCode || "");
  const [accountNumber, setAccountNumber] = useState(currentBank?.accountNumber || "");
  const [accountHolderName, setAccountHolderName] = useState(currentBank?.accountHolderName || customer.name || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setBankName(currentBank?.bankName || "State Bank of India");
      setIfscCode(currentBank?.ifscCode || "");
      setAccountNumber(currentBank?.accountNumber || "");
      setAccountHolderName(currentBank?.accountHolderName || customer.name || "");
    }
  }, [open, currentBank, customer.name]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!accountNumber.trim()) {
      ctl.notify("error", "Bank account number is required");
      return;
    }
    if (!ifscCode.trim()) {
      ctl.notify("error", "IFSC code is required");
      return;
    }
    if (!accountHolderName.trim()) {
      ctl.notify("error", "Account holder name is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/customers/${customer.id}/payout-method`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_BANK",
          bankName: bankName.trim() || "Bank account",
          ifscCode: ifscCode.trim().toUpperCase(),
          accountNumber: accountNumber.trim(),
          accountHolderName: accountHolderName.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to update bank details" }));
        throw new Error(err.error || "Failed to update bank details");
      }

      ctl.notify("success", `Updated and verified bank details for ${customer.name}`);
      await ctl.refresh();
      onClose();
    } catch (err) {
      ctl.notify("error", err instanceof Error ? err.message : "Failed to update bank account");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={Building2}
      title={`Direct Bank Account Setup • ${customer.name}`}
      subtitle="Directly link or correct the verified bank account number for manual IMPS/NEFT payouts."
      footer={
        <>
          <AdminButton variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </AdminButton>
          <AdminButton
            variant="primary"
            icon={Check}
            pending={saving}
            onClick={() => void handleSubmit()}
          >
            Save & Verify Bank Details
          </AdminButton>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Account Holder Name" hint="As registered in the customer's bank branch">
          <TextInput
            value={accountHolderName}
            onChange={(e) => setAccountHolderName(e.target.value)}
            placeholder="e.g. Vikash Patel"
            required
          />
        </Field>

        <Field label="Bank Name" hint="Bank or institution name">
          <TextInput
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="e.g. State Bank of India, HDFC Bank"
          />
        </Field>

        <Field label="Account Number (Decrypted Plaintext)" hint="Full unmasked account number for sending payments">
          <TextInput
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.replace(/\s+/g, ""))}
            placeholder="e.g. 123456789012"
            required
            className="font-mono"
          />
        </Field>

        <Field label="IFSC Code" hint="11-character Indian Financial System Code">
          <TextInput
            value={ifscCode}
            onChange={(e) => setIfscCode(e.target.value.toUpperCase().replace(/\s+/g, ""))}
            placeholder="e.g. SBIN0001234"
            maxLength={11}
            required
            className="font-mono uppercase"
          />
        </Field>
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------------------- raise payout */

/**
 * Raising a payout for a member without making them sign in. It posts to the same server
 * path the member's own wallet form uses, so the schedule, the wallet debit and the audit
 * line are identical either way.
 */
function RaisePayoutModal({
  ctl,
  customer,
  onClose,
}: {
  ctl: AdminController;
  customer: CustomerAccount;
  onClose: () => void;
}) {
  const minCoins = ctl.snapshot.minWithdrawalCoins;
  const withdrawals = ctl.snapshot.withdrawals.filter((request) => request.customerId === customer.id);
  const running = withdrawals.filter((request) => request.overallStatus === "VESTING_IN_PROGRESS");
  const anchorDate =
    ctl.snapshot.orders
      .filter((order) => order.customerId === customer.id)
      .sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime())[0]?.placedAt ??
    new Date().toISOString();

  const [form, setForm] = useState({
    coins: Math.max(minCoins, customer.availableCoins),
    payoutMethod: "UPI" as WithdrawalRequest["payoutMethod"],
    upiId: "",
    bankAccount: "",
    bankIfsc: "",
  });
  const [error, setError] = useState<string | null>(null);

  const patch = (values: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...values }));
  const coins = Math.floor(form.coins);
  const belowMin = coins < minCoins;
  const aboveFree = coins > customer.availableCoins;
  const preview = belowMin || aboveFree ? [] : buildVestingSchedule(coins, anchorDate);
  const bankValid =
    form.payoutMethod === "UPI" ||
    (form.bankAccount.replace(/\s/g, "").length >= 11 && form.bankIfsc.trim().length === 11);
  const canSend = !belowMin && !aboveFree && form.upiId.trim().length > 3 && bankValid;

  const send = async () => {
    setError(null);
    const result = await ctl.run(
      `raise:${customer.id}`,
      () =>
        api.admin.raiseWithdrawal({
          customerId: customer.id,
          coins,
          sourceType: "CASHBACK_COINS",
          payoutMethod: form.payoutMethod,
          upiId: form.upiId.trim(),
          ...(form.payoutMethod === "BANK"
            ? { bankAccount: form.bankAccount.replace(/\s/g, ""), bankIfsc: form.bankIfsc.trim().toUpperCase() }
            : {}),
        }),
      {
        successMessage: `Payout raised for ${customer.name} — ${formatCount(coins)} coins locked from their wallet for payout`,
        silent: true,
      }
    );
    if (result.ok) onClose();
    else setError(result.error ?? "That payout could not be raised");
  };

  return (
    <Modal
      open
      onClose={onClose}
      icon={DollarSign}
      title={`Raise payout — ${customer.name}`}
      subtitle={`${formatCount(customer.availableCoins)} coins free · ${formatCount(withdrawals.length)} payout request${withdrawals.length === 1 ? "" : "s"} so far`}
      footer={
        <>
          <AdminButton variant="ghost" icon={RotateCcw} onClick={onClose}>
            Cancel
          </AdminButton>
          <AdminButton
            variant="primary"
            icon={Send}
            disabled={!canSend}
            pending={ctl.isPending(`raise:${customer.id}`)}
            onClick={() => void send()}
          >
            Raise payout • {formatCount(coins)} coins
          </AdminButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Coins to pay out" hint={`At least ${minCoins} coins`}>
            <TextInput
              value={String(form.coins)}
              inputMode="numeric"
              onChange={(event) => patch({ coins: Math.max(0, Math.round(Number(event.target.value) || 0)) })}
            />
          </Field>
          <Field label="Payout method" hint="Bank transfer also needs the account number and IFSC.">
            <SelectInput
              value={form.payoutMethod}
              onChange={(event) => patch({ payoutMethod: event.target.value as WithdrawalRequest["payoutMethod"] })}
            >
              <option value="UPI">UPI</option>
              <option value="BANK">Bank transfer</option>
            </SelectInput>
          </Field>
          <Field label="UPI ID" required hint="Format name@bank — the server rejects anything else.">
            <TextInput
              value={form.upiId}
              onChange={(event) => patch({ upiId: event.target.value })}
              placeholder="member@okhdfcbank"
            />
          </Field>
          {form.payoutMethod === "BANK" ? (
            <>
              <Field label="Bank account" required>
                <TextInput
                  value={form.bankAccount}
                  inputMode="numeric"
                  onChange={(event) => patch({ bankAccount: event.target.value })}
                />
              </Field>
              <Field label="IFSC code" required>
                <TextInput
                  value={form.bankIfsc}
                  maxLength={11}
                  onChange={(event) => patch({ bankIfsc: event.target.value.toUpperCase() })}
                />
              </Field>
            </>
          ) : null}
        </div>

        <div className="border border-[var(--adm-border)] bg-[var(--adm-bg)] p-3 font-mono text-[10px] leading-relaxed text-[var(--adm-text-muted)]">
          <p className="font-bold uppercase tracking-[0.16em] text-[var(--adm-warning)]">What happens</p>
          <ul className="mt-2 space-y-1.5">
            <li>
              {aboveFree ? (
                <>
                  • This wallet has only{" "}
                  <span className="font-bold text-[var(--adm-text)]">{formatCount(customer.availableCoins)} coins free</span> — fix
                  the amount above before sending.
                </>
              ) : (
                <>
                  • {formatCount(coins)} coins leave {customer.name}&apos;s wallet the moment
                  you send this —{" "}
                  <span className="font-bold text-[var(--adm-text)]">
                    {formatCount(Math.max(0, customer.availableCoins - coins))} coins stay free
                  </span>
                  .
                </>
              )}
            </li>
            <li>
              • The money goes out in 4 weekly parts.{" "}
              {running.length
                ? `They already have ${running.length} payout${running.length === 1 ? "" : "s"} running — every schedule pays side by side, each from its own locked coins.`
                : "Nothing else is running for this member right now."}
            </li>
            <li>
              • Dates count from their latest order. Afterwards you can fix the payout details, pay each part as it
              comes due, or reject and send the coins back.
            </li>
          </ul>
        </div>

        {preview.length ? (
          <div className="grid gap-1.5 sm:grid-cols-4">
            {preview.map((part) => (
              <div key={part.week} className="border border-[var(--adm-border)] bg-[var(--adm-bg)] p-2.5">
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--adm-text-muted)]">
                  Part {part.week} of 4
                </p>
                <p className="mt-1 font-mono text-sm font-bold tabular-nums text-[var(--adm-text)]">{formatCount(part.coins)} coins</p>
                <p className="mt-0.5 font-mono text-[10px] text-[var(--adm-text-muted)]">on {part.dueDate}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="border border-[var(--adm-warning)]/40 bg-[var(--adm-warning)]/6 p-3 font-mono text-[10px] leading-relaxed text-[var(--adm-warning)]">
            {belowMin
              ? `A payout needs at least ${minCoins} coins.`
              : `This wallet has only ${formatCount(customer.availableCoins)} coins free — the rest are already inside a payout or unlock weekly.`}
          </p>
        )}

        {error ? <ErrorNote message={error} /> : null}
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------- audit */

function AuditTab({ ctl }: { ctl: AdminController }) {
  const [query, setQuery] = useState("");
  const logs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ctl.snapshot.auditLogs.filter(
      (log) => !needle || log.action.toLowerCase().includes(needle) || log.details.toLowerCase().includes(needle) || log.actor.toLowerCase().includes(needle)
    );
  }, [ctl.snapshot.auditLogs, query]);

  return (
    <>
      <ConsoleHero
        eyebrow="Security journal"
        title="Immutable audit log"
        subtitle="Append-only server journal — the last 120 entries are retained. Console actions, gateway captures and POD webhooks all land here."
        icon={FileText}
        accent="sky"
        stats={[
          { label: "Entries", value: formatCount(ctl.snapshot.auditLogs.length), sub: "on the journal", tone: "text-[var(--adm-info)]" },
          { label: "In view", value: formatCount(logs.length), sub: query.trim() ? "filtered" : "unfiltered" },
          { label: "Retention", value: "120", sub: "newest first" },
        ]}
        search={
          <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-[var(--adm-border)] bg-[var(--adm-inset)] px-3 py-2 focus-within:border-[var(--adm-violet)]/60 focus-within:ring-1 focus-within:ring-[var(--adm-violet)]/30 sm:max-w-sm">
            <Search className="h-4 w-4 shrink-0 text-[var(--adm-text-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter actions, details or actor"
              aria-label="Filter audit log"
              className="w-full min-w-0 bg-transparent font-mono text-xs text-[var(--adm-text)] placeholder:text-[var(--adm-text-muted)] focus:outline-none"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} className="shrink-0 text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]">
                <XCircle className="h-4 w-4" />
                <span className="sr-only">Clear audit filter</span>
              </button>
            ) : null}
          </div>
        }
      />

      <Panel>
        <PanelHeader
          title="Journal"
          subtitle={`${formatCount(logs.length)} entr${logs.length === 1 ? "y" : "ies"} • newest first`}
          icon={FileText}
          tone="sky"
          actions={
            <AdminButton variant="ghost" icon={RefreshCw} pending={ctl.isPending("refresh")} onClick={() => void ctl.refresh()}>
              Sync
            </AdminButton>
          }
        />
        <div className="space-y-2 p-4">
          {logs.length === 0 ? (
            <EmptyState icon={FileText} title="Nothing recorded" message="Console actions and storefront events land here automatically." />
          ) : (
            logs.map((log) => (
              <RowCard key={log.id} tone="violet" className="p-3.5 pl-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-[var(--adm-violet)]">{log.action}</span>
                  <span className="shrink-0 font-mono text-[10px] text-[var(--adm-text-muted)]">{dateTimeLabel(log.at)}</span>
                </div>
                <p className="mt-1 font-sans text-[11px] leading-relaxed text-[var(--adm-text)]">{log.details}</p>
                <p className="font-mono text-[10px] text-[var(--adm-text-muted)]">{log.actor}</p>
              </RowCard>
            ))
          )}
        </div>
      </Panel>
    </>
  );
}

/* --------------------------------------------------------------- compliance */

function ComplianceTab({ ctl }: { ctl: AdminController }) {
  const rules = ctl.snapshot.rewardRules;

  return (
    <>
      <ConsoleHero
        eyebrow="Risk posture"
        title="Regulatory controls"
        subtitle="Cashback and referral coins are reward units only — they never discount, modify or pay a product price. Each control below is enforced by the API, not by policy alone."
        icon={ShieldAlert}
        accent="rose"
        stats={[
          { label: "Coins out", value: formatCount(ctl.snapshot.metrics.coinsInCirculation), sub: "in circulation" },
          { label: "Liability", value: `${formatCount(ctl.snapshot.metrics.coinsInCirculation)} coins`, sub: "reward liability, never rupee value", tone: "text-[var(--adm-warning)]" },
          { label: "Referral rate", value: `${rules.referralCommissionPercent}%`, sub: "of the referred order, paid in coins", tone: "text-[var(--adm-danger)]" },
        ]}
        actions={<Pill tone="border-[var(--adm-danger)]/40 bg-[var(--adm-danger)]/15 text-[var(--adm-danger)]">Cashback-only programme</Pill>}
      />

      <Panel className="max-w-4xl">
        <PanelHeader
          title="Enforced in code"
          subtitle="What the reward, fulfilment and payout routes refuse to do"
          icon={ShieldAlert}
          tone="rose"
        />
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <RowCard tone="amber" className="p-4 pl-4">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--adm-warning)]/30 bg-gradient-to-br from-[var(--adm-warning)]/25 to-transparent text-[var(--adm-warning)]">
                <Coins className="h-4 w-4" />
              </span>
              <p className="font-sans text-[11px] leading-relaxed text-[var(--adm-text)]">
                Circulating liability is {formatCount(ctl.snapshot.metrics.coinsInCirculation)} coins. Coins are tracked only in
                the coin ledger and are never converted into rupees by any pricing, payment, cashback, referral or withdrawal
                flow. Orders are always priced and paid in INR through the payment gateway.
              </p>
            </div>
          </RowCard>
          <RowCard tone="emerald" className="p-4 pl-4">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--adm-success)]/30 bg-gradient-to-br from-[var(--adm-success)]/25 to-transparent text-[var(--adm-success)]">
                <DollarSign className="h-4 w-4" />
              </span>
              <p className="font-sans text-[11px] leading-relaxed text-[var(--adm-text)]">
                When a member takes coins out as cash, payouts are unlocked 100% on the request date for same-day settlement. Every payment is verified and saved with its transaction reference.
              </p>
            </div>
          </RowCard>
          <RowCard tone="sky" className="p-4 pl-4">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--adm-info)]/30 bg-gradient-to-br from-[var(--adm-info)]/25 to-transparent text-[var(--adm-info)]">
                <FileText className="h-4 w-4" />
              </span>
              <p className="font-sans text-[11px] leading-relaxed text-[var(--adm-text)]">
                Fulfilment webhooks require a matching HMAC signature header, and order tracking only matches a full 10-digit mobile
                or an email address against the order number.
              </p>
            </div>
          </RowCard>
        </div>
      </Panel>
    </>
  );
}

function pickValue(stored: string, options: string[], fallback: string): string {
  return options.includes(stored) ? stored : fallback;
}

/** Older seeded records store plain labels, newer ones store ISO — render whichever it is. */
function dayLabel(value: string): string {
  return Number.isNaN(Date.parse(value)) ? value : dateLabel(value);
}

/* ---------------------------------------------------------------- gift modal */

function GiftDispatchModal({ ctl, open, onClose }: { ctl: AdminController; open: boolean; onClose: () => void }) {
  const products = ctl.snapshot.products;
  const catalogue = useMemo(() => products.filter((product) => !product.isArchived), [products]);
  const [productId, setProductId] = useState("");
  const product = useMemo(
    () => catalogue.find((item) => item.id === productId) ?? catalogue[0],
    [catalogue, productId]
  );
  const [form, setForm] = useState({
    recipientName: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    size: "",
    color: "",
    quantity: "1",
    reason: "VIP loyalty gift",
  });

  const size = pickValue(
    form.size,
    product?.sizes ?? [],
    product?.sizes.includes("L") ? "L" : product?.sizes[0] ?? "L"
  );
  const color = pickValue(
    form.color,
    (product?.colors ?? []).map((item) => item.name),
    product?.colors[0]?.name ?? "Onyx Black"
  );

  const patch = (values: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...values }));

  const submit = async () => {
    if (!product) return;
    const result = await ctl.run(
      "gift",
      () =>
        api.admin.dispatchGift({
          recipientName: form.recipientName.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          address: form.address.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          pincode: form.pincode.trim(),
          productId: product.id,
          size,
          color,
          quantity: Number(form.quantity),
          reason: form.reason.trim() || "Complimentary dispatch",
        }),
      { successMessage: `${product.title} dispatched to ${form.recipientName}` }
    );
    if (result.ok) {
      setForm((prev) => ({ ...prev, recipientName: "", phone: "", email: "", address: "", city: "", state: "", pincode: "" }));
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={Gift}
      title="Dispatch complimentary t-shirt"
      subtitle="Creates a ₹0 order with payment method COMPLIMENTARY and an audit entry"
      maxWidth="max-w-xl"
      footer={
        <>
          <AdminButton variant="ghost" onClick={onClose}>
            Cancel
          </AdminButton>
          <AdminButton
            variant="success"
            icon={Send}
            pending={ctl.isPending("gift")}
            disabled={!product}
            onClick={() => void submit()}
          >
            Dispatch free t-shirt
          </AdminButton>
        </>
      }
    >
      {product ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="space-y-3 text-xs"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Recipient name" required>
              <TextInput value={form.recipientName} onChange={(event) => patch({ recipientName: event.target.value })} required placeholder="Aman Sharma" />
            </Field>
            <Field label="Mobile">
              <TextInput value={form.phone} onChange={(event) => patch({ phone: event.target.value })} placeholder="+91 98765 43210" />
            </Field>
          </div>
          <Field label="Email" hint="Optional — defaults to gifts@skywear.in for tracking lookups.">
            <TextInput type="email" value={form.email} onChange={(event) => patch({ email: event.target.value })} placeholder="recipient@example.com" />
          </Field>
          <Field label="Address" required>
            <TextArea rows={2} value={form.address} onChange={(event) => patch({ address: event.target.value })} required placeholder="Flat, street, landmark" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="City" required>
              <TextInput value={form.city} onChange={(event) => patch({ city: event.target.value })} required />
            </Field>
            <Field label="State" required>
              <TextInput value={form.state} onChange={(event) => patch({ state: event.target.value })} required />
            </Field>
            <Field label="PIN code" required>
              <TextInput value={form.pincode} onChange={(event) => patch({ pincode: event.target.value })} required inputMode="numeric" placeholder="400050" />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Product">
              <SelectInput value={product.id} onChange={(event) => setProductId(event.target.value)}>
                {catalogue.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Reason" required>
              <TextInput value={form.reason} onChange={(event) => patch({ reason: event.target.value })} placeholder="Replacement for damaged print" />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Size">
              <SelectInput value={size} onChange={(event) => patch({ size: event.target.value })}>
                {product.sizes.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Colourway">
              <SelectInput value={color} onChange={(event) => patch({ color: event.target.value })}>
                {product.colors.map((option) => (
                  <option key={option.name} value={option.name}>
                    {option.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Quantity" hint="1–5 per dispatch">
              <TextInput type="number" min={1} max={5} value={form.quantity} onChange={(event) => patch({ quantity: event.target.value })} />
            </Field>
          </div>
          <p className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-tint-05)] p-3 font-sans text-[11px] leading-relaxed text-[var(--adm-text)]">
            Dispatching reserves stock ({product.stock ?? 0} left) and pushes the order to APPROVED on the Qikink pipeline.
          </p>
        </form>
      ) : (
        <EmptyState icon={Gift} title="Catalogue is empty" message="Publish a product before dispatching a complimentary t-shirt." />
      )}
    </Modal>
  );
}
