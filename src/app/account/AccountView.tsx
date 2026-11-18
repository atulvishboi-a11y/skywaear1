"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import {
  ShoppingBag,
  Wallet,
  Award,
  Users,
  User,
  Bell,
  ArrowLeft,
  ArrowRight,
  Coins,
  Check,
  Copy,
  Share2,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  LogOut,
  RefreshCw,
  X,
  Package,
  Sparkles,
  Phone,
  Lock,
  Loader2,
  KeyRound,
  Banknote,
  Trophy,
  TrendingUp,
  Handshake,
  Gift,
  Plus,
  Pencil,
  Trash2,
  Landmark,
  Smartphone,
} from "lucide-react";
import { api } from "@/lib/client";
import { copyText } from "@/lib/clipboard";
import type { AddressPayload } from "@/lib/client";
import type { StorefrontSnapshot, WithdrawalInput } from "@/lib/contracts";
import type { OrderStatus } from "@/lib/domain";
import {
  agentCommissionRateFor,
  agentMonthlySalesCoins,
  agentNextSlabFor,
  agentPeriodKey,
} from "@/data/rewardsEngine";
import BankSelect from "@/components/BankSelect";
import {
  BANK_ACCOUNT_REGEX,
  IFSC_REGEX,
  UPI_ID_REGEX,
  normalizeAccountNumber,
  normalizeIfsc,
  normalizeUpiId,
} from "@/lib/paymentDetails";
import { dateLabel, dateTimeLabel, errorMessage, formatRupees, getCourierTrackingUrl } from "@/lib/domain";
import { orderStatusLabel, stageLabel, statusStageIndex, TRACKING_STAGES } from "@/lib/tracking";
import WalletPanel from "@/components/WalletPanel";
import Header from "@/components/Header";

import { PRODUCTS, type Product } from "@/data/products";
import { getProductCoins } from "@/lib/catalog";
import { useCart, cartLineId } from "@/lib/cart";
import { AuthUI } from "@/components/ui/auth-ui";

type AccountTab = "orders" | "shop" | "wallet" | "withdrawals" | "rewards" | "affiliate" | "leaderboard" | "notifications" | "profile";

const ACCOUNT_TABS: { id: AccountTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "orders", label: "My Orders", icon: ShoppingBag },
  { id: "shop", label: "Product", icon: Sparkles },
  { id: "wallet", label: "Cashback Wallet", icon: Wallet },
  { id: "withdrawals", label: "Withdrawals", icon: Banknote },
  { id: "rewards", label: "Reward Engine", icon: Award },
  { id: "affiliate", label: "Affiliate & Referrals", icon: Users },
  { id: "leaderboard", label: "Top Referrers", icon: Trophy },
  { id: "notifications", label: "Notification", icon: Bell },
  { id: "profile", label: "Profile & Addresses", icon: User },
];

function celebrateCoins() {
  if (typeof window === "undefined") return;
  if ("vibrate" in navigator) {
    try {
      // Forceful heavy coin feedback
      navigator.vibrate([120, 40, 160, 40, 220]);
    } catch {}
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const colors = ["#00FF66", "#D9362B", "#FFD84D", "#F5F5F7"];
  const base = { particleCount: 80, spread: 70, startVelocity: 36, colors, disableForReducedMotion: true, zIndex: 9999 };
  void confetti({ ...base, angle: 60, origin: { x: 0.06, y: 0.72 } });
  void confetti({ ...base, angle: 120, origin: { x: 0.94, y: 0.72 } });
  window.setTimeout(() => {
    void confetti({ particleCount: 50, spread: 100, startVelocity: 24, origin: { x: 0.5, y: 0.35 }, colors, disableForReducedMotion: true, zIndex: 9999 });
  }, 180);
}

function statusClasses(status: OrderStatus): string {
  switch (status) {
    case "DELIVERED":
      return "bg-[#00FF66]/15 text-[#00FF66] border-[#00FF66]/40";
    case "SHIPPED":
      return "bg-[#00F0FF]/15 text-[#00F0FF] border-[#00F0FF]/40";
    case "LOCAL_AREA":
      return "bg-teal-400/15 text-teal-300 border-teal-400/40";
    case "MANIFEST_GENERATED":
      return "bg-indigo-400/15 text-indigo-300 border-indigo-400/40";
    case "PRINTING_POD":
      return "bg-amber-400/20 text-amber-300 border-amber-400/40";
    case "APPROVED":
      return "bg-white/10 text-white border-white/[0.08]";
    case "CANCELLED":
      return "bg-rose-500/20 text-rose-400 border-rose-500/40";
    case "PENDING":
    default:
      return "bg-[#11131A] text-[#A0A5B5] border-white/[0.08]";
  }
}

function paymentStatusBadge(method: string, status: string): { label: string; className: string } {
  if (status === "PAID") return { label: "PAID", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" };
  if (status === "PENDING_VERIFICATION") return { label: "AWAITING VERIFICATION", className: "bg-amber-400/20 text-amber-300 border-amber-400/40 animate-pulse" };
  if (status === "REJECTED") return { label: "PAYMENT REJECTED", className: "bg-rose-500/20 text-rose-300 border-rose-500/40" };
  if (method === "COD") return { label: "COD", className: "bg-[#11131A] text-[#A0A5B5] border-white/[0.08]" };
  return { label: "UNPAID", className: "bg-amber-500/10 text-amber-400 border-amber-500/30" };
}

type OrderCashbackSummary = { unlockedToday: number; claimedToday: number; pending: number };

function summarizeOrderCashback(
  order: StorefrontSnapshot["orders"][number],
  todayKolkata: string
): OrderCashbackSummary {
  const summary: OrderCashbackSummary = { unlockedToday: 0, claimedToday: 0, pending: 0 };
  for (const slice of order.cashback ?? []) {
    if (slice.status === "LOCKED") summary.pending += slice.coins;
    if (slice.status === "VOID") continue;
    const dueKolkata = new Date(slice.dueAt).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    if (dueKolkata === todayKolkata) summary.unlockedToday += slice.coins;
    if (
      slice.releasedAt &&
      new Date(slice.releasedAt).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) === todayKolkata
    ) {
      summary.claimedToday += slice.coins;
    }
  }
  return summary;
}


let cachedAccountSnapshot: StorefrontSnapshot | null = null;

function getCachedSnapshot(): StorefrontSnapshot | null {
  if (cachedAccountSnapshot?.customer) return cachedAccountSnapshot;
  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem("skywear_account_snapshot");
      if (stored) {
        const parsed = JSON.parse(stored) as StorefrontSnapshot;
        if (parsed?.customer) {
          cachedAccountSnapshot = parsed;
          return parsed;
        }
      }
    } catch {}
  }
  return null;
}

export interface AccountViewProps {
  initialSnapshot?: StorefrontSnapshot | null;
  basePath?: string;
  initialWithdrawSource?: "referral" | "cashback";
  siteOrigin?: string;
}

export default function AccountPage({
  initialSnapshot,
  basePath = "/account",
  initialWithdrawSource = "cashback",
  siteOrigin = "https://skywear.in",
}: AccountViewProps = {}) {
  const pathname = usePathname();
  const router = useRouter();

  const routeTab: AccountTab = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    const first = (segments[segments.length - 1] ?? "").toLowerCase();
    if (first === "shop" || first === "buy" || first === "drops" || first === "tshirts") return "shop";
    if (first === "claims" || first === "claim" || first === "daily") return "wallet";
    if (first === "wallet" || first === "cashback") return "wallet";
    if (first === "withdrawal" || first === "withdrawals" || first === "payout" || first === "payouts" || first === "withdraw") return "withdrawals";
    if (first === "rewards" || first === "rules") return "rewards";
    if (first === "affiliate" || first === "referral") return "affiliate";
    if (first === "leaderboard" || first === "top-referrers" || first === "topreferrers") return "leaderboard";
    if (first === "notifications" || first === "alerts") return "notifications";
    if (first === "profile") return "profile";
    return "orders";
  }, [pathname]);

  const [activeTab, setActiveTab] = useState<AccountTab>(routeTab);

  useEffect(() => {
    setActiveTab(routeTab);
  }, [routeTab]);

  const handleTabChange = useCallback((tab: AccountTab) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", `${basePath}/${tab}`);
    }
  }, [basePath]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const segments = window.location.pathname.split("/").filter(Boolean);
      const first = (segments[segments.length - 1] ?? "").toLowerCase();
      if (first === "shop" || first === "buy" || first === "drops" || first === "tshirts") setActiveTab("shop");
      else if (first === "claims" || first === "claim" || first === "daily") setActiveTab("wallet");
      else if (first === "wallet" || first === "cashback") setActiveTab("wallet");
      else if (first === "withdrawal" || first === "withdrawals" || first === "payout" || first === "payouts" || first === "withdraw") setActiveTab("withdrawals");
      else if (first === "rewards" || first === "rules") setActiveTab("rewards");
      else if (first === "affiliate" || first === "referral") setActiveTab("affiliate");
      else if (first === "leaderboard" || first === "top-referrers" || first === "topreferrers") setActiveTab("leaderboard");
      else if (first === "notifications" || first === "alerts") setActiveTab("notifications");
      else if (first === "profile") setActiveTab("profile");
      else setActiveTab("orders");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Listen for bottom-nav custom tab switch events
  useEffect(() => {
    const handleCustomTabSwitch = (e: Event) => {
      const custom = e as CustomEvent<AccountTab>;
      if (custom.detail) {
        handleTabChange(custom.detail);
      }
    };
    window.addEventListener("skywear:switch-account-tab", handleCustomTabSwitch);
    return () => window.removeEventListener("skywear:switch-account-tab", handleCustomTabSwitch);
  }, [handleTabChange]);

  const [snapshot, setSnapshot] = useState<StorefrontSnapshot | null>(() => initialSnapshot ?? getCachedSnapshot());
  const [loading, setLoading] = useState(() => {
    if (initialSnapshot?.customer) return false;
    const cached = getCachedSnapshot();
    if (cached?.customer) return false;
    return true;
  });
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [agentApplyOpen, setAgentApplyOpen] = useState(false);
  const [agentPitch, setAgentPitch] = useState("");
  const [agentSubmitting, setAgentSubmitting] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);

  // Profile Password Setting & Update State
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [profileCurrentPass, setProfileCurrentPass] = useState("");
  const [profileNewPass, setProfileNewPass] = useState("");
  const [profileConfirmPass, setProfileConfirmPass] = useState("");
  const [profilePassLoading, setProfilePassLoading] = useState(false);
  const [profilePassSuccess, setProfilePassSuccess] = useState<string | null>(null);
  const [profilePassError, setProfilePassError] = useState<string | null>(null);

  // Profile Info Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // Payout bank account state
  const [isEditingPayoutBank, setIsEditingPayoutBank] = useState(false);
  const [payoutHolder, setPayoutHolder] = useState("");
  const [payoutBankName, setPayoutBankName] = useState("");
  const [payoutAccount, setPayoutAccount] = useState("");
  const [payoutConfirm, setPayoutConfirm] = useState("");
  const [payoutIfsc, setPayoutIfsc] = useState("");
  const [payoutSaving, setPayoutSaving] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [payoutSuccess, setPayoutSuccess] = useState<string | null>(null);

  // Delivery address management
  const [editingAddressIndex, setEditingAddressIndex] = useState<number | "new" | null>(null);
  const [addressForm, setAddressForm] = useState<AddressPayload>({
    label: "Home",
    street: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [addressSuccess, setAddressSuccess] = useState<string | null>(null);
  const [pendingDeleteAddress, setPendingDeleteAddress] = useState<number | null>(null);

  const startAddAddress = () => {
    setAddressForm({ label: "Home", street: "", city: "", state: "", pincode: "" });
    setAddressError(null);
    setAddressSuccess(null);
    setPendingDeleteAddress(null);
    setEditingAddressIndex("new");
  };

  const startEditAddress = (index: number) => {
    const address = customer?.addresses?.[index];
    if (!address) return;
    setAddressForm({
      label: address.label,
      street: address.street,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
    });
    setAddressError(null);
    setAddressSuccess(null);
    setPendingDeleteAddress(null);
    setEditingAddressIndex(index);
  };

  const cancelAddressForm = () => {
    setEditingAddressIndex(null);
    setAddressError(null);
  };

  const validateAddressForm = (): string | null => {
    if (!addressForm.street.trim() || addressForm.street.trim().length < 8) {
      return "Enter a complete street address (at least 8 characters).";
    }
    if (!addressForm.city.trim()) return "City is required.";
    if (!addressForm.state.trim()) return "State is required.";
    if (!/^[1-9]\d{5}$/.test(addressForm.pincode.trim())) return "Enter a valid 6-digit Indian PIN code.";
    return null;
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddressError(null);
    setAddressSuccess(null);
    const validationError = validateAddressForm();
    if (validationError) {
      setAddressError(validationError);
      return;
    }

    setAddressSaving(true);
    try {
      const payload: AddressPayload = {
        label: (addressForm.label ?? "").trim() || "Home",
        street: addressForm.street.trim(),
        city: addressForm.city.trim(),
        state: addressForm.state.trim(),
        pincode: addressForm.pincode.trim(),
      };
      const res =
        editingAddressIndex === "new"
          ? await api.addresses.add(payload)
          : await api.addresses.update(editingAddressIndex as number, payload);

      if (res?.customer) {
        setSnapshot((prev) => (prev ? { ...prev, customer: res.customer } : prev));
      }
      setAddressSuccess(editingAddressIndex === "new" ? "Address added successfully!" : "Address updated successfully!");
      setEditingAddressIndex(null);
      await loadSnapshot();
      setTimeout(() => setAddressSuccess(null), 4000);
    } catch (err) {
      setAddressError(errorMessage(err, "Failed to save address."));
    } finally {
      setAddressSaving(false);
    }
  };

  const handleSetDefaultAddress = async (index: number) => {
    setAddressError(null);
    setAddressSuccess(null);
    try {
      const res = await api.addresses.setDefault(index);
      if (res?.customer) {
        setSnapshot((prev) => (prev ? { ...prev, customer: res.customer } : prev));
      }
      setAddressSuccess("Default delivery address updated.");
      await loadSnapshot();
      setTimeout(() => setAddressSuccess(null), 4000);
    } catch (err) {
      setAddressError(errorMessage(err, "Failed to set default address."));
    }
  };

  const handleDeleteAddress = async (index: number) => {
    if (pendingDeleteAddress !== index) {
      setPendingDeleteAddress(index);
      return;
    }
    setAddressError(null);
    setAddressSuccess(null);
    try {
      const res = await api.addresses.remove(index);
      if (res?.customer) {
        setSnapshot((prev) => (prev ? { ...prev, customer: res.customer } : prev));
      }
      setPendingDeleteAddress(null);
      setAddressSuccess("Address removed.");
      await loadSnapshot();
      setTimeout(() => setAddressSuccess(null), 4000);
    } catch (err) {
      setAddressError(errorMessage(err, "Failed to remove address."));
      setPendingDeleteAddress(null);
    }
  };

  const startEditingProfile = () => {
    if (customer) {
      setProfileName(customer.name || "");
      setProfileEmail(customer.email || "");
    }
    setProfileError(null);
    setProfileSuccess(null);
    setIsEditingProfile(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);
    if (!profileName.trim()) {
      setProfileError("Full Name is required.");
      return;
    }
    setProfileSaving(true);
    try {
      const res = await api.updateProfile({
        name: profileName.trim(),
        email: profileEmail.trim() || undefined,
      });
      if (res?.customer) {
        setSnapshot((prev) => (prev ? { ...prev, customer: res.customer } : prev));
      }
      setProfileSuccess("Profile details updated successfully!");
      setIsEditingProfile(false);
      await loadSnapshot();
      setTimeout(() => setProfileSuccess(null), 4000);
    } catch (err) {
      setProfileError(errorMessage(err, "Failed to update profile details."));
    } finally {
      setProfileSaving(false);
    }
  };

  const openPayoutBankForm = () => {
    const bank = customer?.bankAccounts?.[0];
    setPayoutHolder(bank?.accountHolderName || customer?.name || "");
    setPayoutBankName(bank?.bankName || "");
    setPayoutAccount("");
    setPayoutConfirm("");
    setPayoutIfsc(bank?.ifscCode || "");
    setPayoutError(null);
    setPayoutSuccess(null);
    setIsEditingPayoutBank(true);
  };

  const handleSavePayoutBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayoutError(null);
    setPayoutSuccess(null);
    if (!payoutHolder.trim()) {
      setPayoutError("Account holder name is required.");
      return;
    }
    if (!payoutBankName.trim()) {
      setPayoutError("Select your bank from the list.");
      return;
    }
    const cleanAccount = normalizeAccountNumber(payoutAccount);
    if (!BANK_ACCOUNT_REGEX.test(cleanAccount)) {
      setPayoutError("Enter a valid 9 to 18-digit account number.");
      return;
    }
    if (cleanAccount !== normalizeAccountNumber(payoutConfirm)) {
      setPayoutError("Account numbers do not match.");
      return;
    }
    const cleanIfsc = normalizeIfsc(payoutIfsc);
    if (!IFSC_REGEX.test(cleanIfsc)) {
      setPayoutError("Enter a valid 11-character IFSC code (e.g. INDB0000476).");
      return;
    }

    setPayoutSaving(true);
    try {
      const res = await api.addBankAccount({
        accountHolderName: payoutHolder.trim(),
        accountNumber: cleanAccount,
        confirmAccountNumber: normalizeAccountNumber(payoutConfirm),
        bankName: payoutBankName.trim(),
        ifscCode: cleanIfsc,
      });
      if (res?.customer) {
        setSnapshot((prev) => (prev ? { ...prev, customer: res.customer } : prev));
      }
      setIsEditingPayoutBank(false);
      setPayoutAccount("");
      setPayoutConfirm("");
      setPayoutSuccess(
        res.pendingReview
          ? "Bank account change submitted for admin review. Your current account stays active until approval."
          : "Bank account linked to your profile."
      );
      await loadSnapshot();
      setTimeout(() => setPayoutSuccess(null), 5000);
    } catch (err) {
      setPayoutError(errorMessage(err, "Failed to save bank account."));
    } finally {
      setPayoutSaving(false);
    }
  };

  const startPasswordChange = () => {
    setProfileCurrentPass("");
    setProfileNewPass("");
    setProfileConfirmPass("");
    setProfilePassError(null);
    setProfilePassSuccess(null);
    setIsChangingPassword(true);
  };

  const cancelPasswordChange = () => {
    setProfileCurrentPass("");
    setProfileNewPass("");
    setProfileConfirmPass("");
    setProfilePassError(null);
    setIsChangingPassword(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfilePassError(null);
    setProfilePassSuccess(null);

    const hasExistingPassword = Boolean(customer?.hasPassword);
    if (hasExistingPassword && !profileCurrentPass) {
      setProfilePassError("Enter your current password.");
      return;
    }
    if (profileNewPass.length < 8) {
      setProfilePassError("New password must be at least 8 characters.");
      return;
    }
    if (!/[A-Za-z]/.test(profileNewPass) || !/\d/.test(profileNewPass)) {
      setProfilePassError("New password must include at least one letter and one number.");
      return;
    }
    if (profileNewPass !== profileConfirmPass) {
      setProfilePassError("New password and confirmation do not match.");
      return;
    }
    if (hasExistingPassword && profileNewPass === profileCurrentPass) {
      setProfilePassError("New password must be different from your current password.");
      return;
    }

    setProfilePassLoading(true);
    try {
      await api.auth.updatePassword({
        currentPassword: hasExistingPassword ? profileCurrentPass : undefined,
        newPassword: profileNewPass,
      });
      setProfileCurrentPass("");
      setProfileNewPass("");
      setProfileConfirmPass("");
      setIsChangingPassword(false);
      setProfilePassSuccess("Password updated successfully!");
      await loadSnapshot();
      setTimeout(() => setProfilePassSuccess(null), 4000);
    } catch (err) {
      setProfilePassError(errorMessage(err, "Failed to update password."));
    } finally {
      setProfilePassLoading(false);
    }
  };

  // Cart & Quick-Add state for Buy Another T-Shirt
  const { add: addToCart, buyNow: buyNowCart, items: cartItems } = useCart();
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({
    "zenin-choso-oversized-tee": "L",
    "zenin-limitless-gojo-tee": "L",
    "zenin-butterfly-luxury-tee": "L",
  });
  const [previewSides, setPreviewSides] = useState<Record<string, "front" | "back">>({
    "zenin-choso-oversized-tee": "front",
    "zenin-limitless-gojo-tee": "front",
    "zenin-butterfly-luxury-tee": "front",
  });
  const [cartToast, setCartToast] = useState<{ title: string; size: string } | null>(null);

  const handleQuickAdd = (product: Product, buyNow = false) => {
    const size = selectedSizes[product.id] || "L";
    const side = previewSides[product.id] || product.heroImage || "front";
    const color = product.colors[0] || { name: "Onyx Black", hex: "#0B0C10" };
    const lineId = cartLineId(product.id, size, color.name, side);
    const itemImg =
      side === "back"
        ? product.imageBackUrl || product.artworkUrl || product.imageUrl
        : product.imageUrl;

    const item = {
      id: lineId,
      productId: product.id,
      title: product.title,
      price: product.price,
      quantity: 1,
      size,
      colorName: color.name,
      colorHex: color.hex,
      side,
      imageUrl: itemImg,
    };

    if (buyNow) {
      // Buy Now: strictly single product instant checkout (no past items)
      buyNowCart(item);
      router.push("/checkout");
      setTimeout(() => {
        if (typeof window !== "undefined" && window.location.pathname !== "/checkout") {
          window.location.assign("/checkout");
        }
      }, 350);
    } else {
      addToCart(item);
      setCartToast({ title: product.title, size });
      setTimeout(() => setCartToast(null), 4000);
    }
  };

  // Auth Form State for the logged-out fallback screen
  const [authError, setAuthError] = useState<string | null>(null);
  const [authPending, setAuthPending] = useState(false);

  const loadSnapshot = useCallback(async () => {
    try {
      const data = await api.storefront();
      if (data?.customer) {
        cachedAccountSnapshot = data;
        if (typeof window !== "undefined") {
          try {
            sessionStorage.setItem("skywear_account_snapshot", JSON.stringify(data));
          } catch {}
        }
        setSnapshot(data);
      }
    } catch (err) {
      console.error("Failed to load user account snapshot:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialSnapshot?.customer) {
      void loadSnapshot();
    }
  }, [initialSnapshot, loadSnapshot]);

  const handleWithdrawal = async (input: WithdrawalInput) => {
    await api.withdraw(input);
    await loadSnapshot();
  };

  const handleClaim = async (options?: { orderId?: string; week?: number }) => {
    const result = await api.claimCashback(options);
    await loadSnapshot();
    if (result.claimedPoints > 0) celebrateCoins();
  };

  const handleAgentApply = async () => {
    setAgentSubmitting(true);
    setAgentError(null);
    try {
      await api.agents.apply(agentPitch.trim() || undefined);
      setAgentApplyOpen(false);
      setAgentPitch("");
      await loadSnapshot();
    } catch (error) {
      setAgentError(errorMessage(error, "Could not submit your application."));
    } finally {
      setAgentSubmitting(false);
    }
  };

  const handleAddBankAccount = async (input: {
    accountHolderName: string;
    accountNumber: string;
    confirmAccountNumber: string;
    ifscCode: string;
    bankName: string;
  }) => {
    await api.addBankAccount(input);
    await loadSnapshot();
  };

  const handleRemoveBankAccount = async (id: string) => {
    await api.removeBankAccount(id);
    await loadSnapshot();
  };

  const handleSignOut = async () => {
    try {
      cachedAccountSnapshot = null;
      if (typeof window !== "undefined") {
        try {
          sessionStorage.removeItem("skywear_account_snapshot");
        } catch {}
      }
      await api.signOut();
      setSnapshot(null);
      setLoading(false);
      setAuthError(null);
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  const [resubmittingOrderId, setResubmittingOrderId] = useState<string | null>(null);
  const [resubmitUtr, setResubmitUtr] = useState("");
  const [isSubmittingResubmit, setIsSubmittingResubmit] = useState(false);
  const [resubmitError, setResubmitError] = useState<string | null>(null);

  const handleResubmitUtr = async (orderNumber: string) => {
    if (!resubmitUtr.trim() || resubmitUtr.trim().length < 6) {
      setResubmitError("Please enter a valid 12-digit UTR reference");
      return;
    }
    setIsSubmittingResubmit(true);
    setResubmitError(null);
    try {
      await api.submitUtr(orderNumber, resubmitUtr.trim());
      setResubmittingOrderId(null);
      setResubmitUtr("");
      await loadSnapshot();
    } catch (err) {
      setResubmitError(errorMessage(err, "Failed to submit UTR reference"));
    } finally {
      setIsSubmittingResubmit(false);
    }
  };

  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [markingNotificationId, setMarkingNotificationId] = useState<string | null>(null);

  const handleMarkRead = async (id: string) => {
    setMarkingNotificationId(id);
    try {
      await api.notifications.markRead(id);
      await loadSnapshot();
    } catch {
      // keep the item unread if the request fails
    } finally {
      setMarkingNotificationId(null);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAllRead(true);
    try {
      await api.notifications.markAllRead();
      await loadSnapshot();
    } catch {
      // leave unread counts untouched on failure
    } finally {
      setMarkingAllRead(false);
    }
  };

  const customer = snapshot?.customer;
  const payoutBank = customer?.bankAccounts?.[0];
  const orders = useMemo(() => snapshot?.orders ?? [], [snapshot?.orders]);
  const todayKolkata = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const orderCashback = useMemo(() => {
    const byId = new Map<string, OrderCashbackSummary>();
    const totals: OrderCashbackSummary = { unlockedToday: 0, claimedToday: 0, pending: 0 };
    for (const order of orders) {
      const summary = summarizeOrderCashback(order, todayKolkata);
      byId.set(order.id, summary);
      totals.unlockedToday += summary.unlockedToday;
      totals.claimedToday += summary.claimedToday;
      totals.pending += summary.pending;
    }
    return { byId, totals };
  }, [orders, todayKolkata]);
  const rules = snapshot?.rewardRules;
  const notifications = snapshot?.notifications ?? [];
  const referrals = useMemo(() => snapshot?.referrals ?? [], [snapshot?.referrals]);
  const topReferrers = snapshot?.topReferrers ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;
  const profileInitials = (customer?.name || "Skywear")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  const profileAddresses = customer?.addresses ?? [];
  const catalogProducts = snapshot?.products ?? PRODUCTS;
  const productHrefByTitle = new Map(
    catalogProducts.map((product) => [product.title.trim().toLowerCase(), `/product/${product.slug}`])
  );
  const productHref = (title: string) => productHrefByTitle.get(title.trim().toLowerCase()) ?? null;
  const uniqueFriendsCount = useMemo(() => {
    const s = new Set(referrals.map((r) => r.friendPhone || r.friendId || r.friendName));
    return s.size;
  }, [referrals]);

  const convertedCount = useMemo(() => {
    return referrals.filter((r) => r.orderNumber && (r.status === "APPROVED" || r.status === "PAID")).length;
  }, [referrals]);

  const totalReferralCommission = useMemo(() => {
    return referrals.reduce((sum, r) => sum + (r.commissionCoins || 0), 0);
  }, [referrals]);

  const confirmedReferralCoins = Math.round(
    referrals
      .filter((r) => r.status === "PAID" || r.status === "APPROVED")
      .reduce((sum, r) => sum + (r.commissionCoins || 0), 0)
  );

  const customerId = customer?.id;
  const completedWithdrawalsCoins = Math.round(
    (snapshot?.withdrawals ?? [])
      .filter(
        (w) =>
          w.customerId === customerId &&
          (w.overallStatus === "PAID" || w.overallStatus === "COMPLETED")
      )
      .reduce((sum, w) => {
        const transferredCoins = (w.tranches ?? [])
          .filter((t) => t.status === "TRANSFERRED")
          .reduce((total, t) => total + t.coins, 0);
        if (transferredCoins > 0) return sum + transferredCoins;
        return sum + w.totalCoins;
      }, 0)
  );

  const totals = (() => {
    if (!customer || !rules) return { totalCoins: 0, pendingVesting: 0, referralCoins: 0, totalReferralCommissionCoins: 0 };
    const coins = customer.availableCoins ?? 0;
    const refCoins = customer.referralCoinBalance ?? totalReferralCommission;
    return {
      totalCoins: coins,
      pendingVesting: customer.pendingCoins ?? 0,
      referralCoins: Math.round(refCoins),
      totalReferralCommissionCoins: Math.round(totalReferralCommission),
    };
  })();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0B0E] text-[#F5F5F7] font-mono flex flex-col items-center justify-center p-4">
        <div className="flex items-center gap-3 border border-white/[0.08] bg-[#11131A] px-6 py-4">
          <RefreshCw className="w-5 h-5 animate-spin text-[#D9362B]" />
          <span className="text-xs font-bold uppercase tracking-wider">Syncing Skywear Account…</span>
        </div>
      </div>
    );
  }

  // ---------------- NOT LOGGED IN: SHOW MODERN AUTH SCREEN ----------------
  if (!customer) {
    return (
      <div className="relative min-h-screen bg-background">
        <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-30 flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-1.5 border border-border bg-background/80 backdrop-blur-md text-xs font-mono text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Store</span>
          </Link>
        </div>

        <AuthUI
          initialIsSignIn={true}
          onSignInSubmit={async (data) => {
            setAuthError(null);
            setAuthPending(true);
            try {
              await api.auth.login({
                identifier: data.identifier.trim(),
                password: data.password,
                otp: data.otp,
              });
              await loadSnapshot();
            } catch (err) {
              setAuthError(errorMessage(err, "Sign in failed."));
              throw err;
            } finally {
              setAuthPending(false);
            }
          }}
          onSignUpSubmit={async (data) => {
            setAuthError(null);
            setAuthPending(true);
            const cleanPhone = data.phone.replace(/\D/g, "");
            try {
              await api.auth.signUp({
                name: data.name.trim(),
                phone: cleanPhone,
                email: data.email?.trim() || undefined,
                password: data.password || ("Skywear@" + cleanPhone.slice(-4)),
                otp: data.otp.trim(),
                referralCode: data.referralCode,
              });
              await loadSnapshot();
            } catch (err) {
              setAuthError(errorMessage(err, "Registration failed."));
            } finally {
              setAuthPending(false);
            }
          }}
          isLoading={authPending}
          error={authError}
        />
      </div>
    );
  }

  const renderProductCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {(snapshot?.products ?? PRODUCTS).map((product) => {
        const currentSide = previewSides[product.id] || product.heroImage || "front";
        const selectedSize = selectedSizes[product.id] || "L";
        const displayImage =
          currentSide === "back"
            ? product.imageBackUrl || product.artworkUrl || product.imageUrl
            : product.imageUrl;

        return (
          <div
            key={product.id}
            className="border border-white/[0.08] bg-[#11131A] hover:border-[#D9362B] transition-all duration-200 flex flex-col group shadow-lg"
          >
            {/* Image Preview with Desktop Mockups */}
            <div className="relative aspect-[4/5] bg-[#0A0B0E] overflow-hidden flex items-center justify-center p-3">
              <Link
                href={`/product/${product.slug}`}
                className="w-full h-full flex items-center justify-center"
                title={`View ${product.title} single product page`}
              >
                {/* Product art is admin-managed and can live on any host, which next/image blocks without a domain allowlist. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={displayImage}
                  alt={product.title}
                  className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105 cursor-pointer"
                />
              </Link>

              {/* Badges */}
              <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
                <span className="px-2 py-0.5 bg-[#0A0B0E]/90 text-[#F5F5F7] border border-white/[0.08] text-[9px] font-mono">
                  {product.gsm} GSM
                </span>
              </div>

              {/* Front / Back Flip Button */}
              <div className="absolute top-2.5 right-2.5 z-10">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewSides((prev) => ({
                      ...prev,
                      [product.id]: currentSide === "front" ? "back" : "front",
                    }));
                  }}
                  className="px-2 py-1 bg-[#11131A]/90 hover:bg-[#D9362B] text-white border border-white/[0.08] hover:border-[#D9362B] text-[9px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1 shadow-md cursor-pointer"
                  title="Flip Mockup Front / Back"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  <span>{currentSide === "front" ? "VIEW BACK" : "VIEW FRONT"}</span>
                </button>
              </div>

              {/* Sky Cash Tag */}
              <div className="absolute bottom-2.5 left-2.5 bg-[#11131A]/95 border border-white/[0.08] px-2.5 py-1.5 flex items-center text-[10px] z-10 pointer-events-none">
                <span className="text-[#00FF66] font-bold flex items-center gap-1">
                  <Coins className="w-3 h-3 text-[#00FF66]" /> +{getProductCoins(product).toLocaleString("en-IN")} coins back
                </span>
              </div>
            </div>

            {/* Product Meta */}
            <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
              <div>
                <Link href={`/product/${product.slug}`} className="block group/title">
                  <h3
                    className="text-sm font-bold text-white uppercase tracking-tight line-clamp-1 group-hover/title:text-[#D9362B] transition-colors"
                    style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
                  >
                    {product.title}
                  </h3>
                </Link>

                {/* Price */}
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-base font-bold text-white font-sans">{formatRupees(product.price)}</span>
                  <span className="text-xs text-[#8E929B] line-through">{formatRupees(product.mrp)}</span>
                </div>
              </div>

              {/* Size Selector */}
              <div>
                <div className="flex items-center justify-between text-[10px] text-[#A5AAB8] uppercase mb-1.5 font-bold">
                  <span>Size</span>
                  <span className="text-white">{selectedSize}</span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {product.sizes.map((size) => {
                    const isSelected = selectedSize === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setSelectedSizes((prev) => ({ ...prev, [product.id]: size }))}
                        className={`py-1 text-[11px] font-bold uppercase transition-colors border ${
                          isSelected
                            ? "border-[#D9362B] bg-[#D9362B] text-white"
                            : "border-white/[0.08] bg-[#0A0B0E] text-[#A5AAB8] hover:border-white hover:text-white"
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Actions: Add To Bag & Buy Now */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => handleQuickAdd(product, false)}
                  className="py-2.5 px-2 bg-[#0A0B0E] hover:bg-[rgba(255,255,255,0.08)] text-white border border-white/[0.08] hover:border-white text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Add To Bag</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAdd(product, true)}
                  className="py-2.5 px-2 bg-[#D9362B] hover:bg-[#B82B22] text-white text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1"
                >
                  <span>Buy Now ↘</span>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  // ---------------- LOGGED IN: SHOW CUSTOMER ACCOUNT DASHBOARD ----------------
  return (
    <div className="min-h-screen bg-[#0A0B0E] text-[#F5F5F7] font-mono flex flex-col selection:bg-[#D9362B] selection:text-white">
      {/* Same storefront header shown on all public pages */}
      <Header cartCount={cartItems.length} customer={customer} isLoggedIn />

      {/* ---------------- Account Layout ---------------- */}
      <div className="flex-1 max-w-[1600px] w-full mx-auto flex flex-col lg:flex-row items-start">
        {/* Sidebar Navigation (desktop) */}
        <aside className="sticky top-16 z-30 hidden h-[calc(100vh-4rem)] w-60 shrink-0 flex-col justify-between border-r border-white/[0.08] bg-[#11131A] p-3 lg:flex">
          <div className="space-y-4">
            {/* User Profile Card */}
            <Link
              href={`${basePath}/profile`}
              onClick={(e) => {
                e.preventDefault();
                handleTabChange("profile");
              }}
              className="block border border-white/[0.08] bg-[#0A0B0E] p-3.5 space-y-1 hover:border-white/25 transition-colors"
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#8E929B]">
                Account
              </span>
              <p className="text-sm font-bold text-white uppercase truncate" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>
                {customer?.name || "Skywear Member"}
              </p>
              <p className="text-[10px] text-[#8E929B] truncate">{customer?.phone || customer?.email || "customer@skywear.in"}</p>
            </Link>

            {/* Nav Links */}
            <nav className="space-y-0.5">
              {ACCOUNT_TABS.map((tab) => {
                const active = activeTab === tab.id;
                const Icon = tab.icon;
                const inBottomNav = tab.id === "shop" || tab.id === "wallet";
                return (
                  <Link
                    key={tab.id}
                    href={`${basePath}/${tab.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      handleTabChange(tab.id);
                    }}
                    data-active={active ? "true" : "false"}
                    className={`${inBottomNav ? "hidden lg:flex" : "flex"} items-center justify-between px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                      active
                        ? "bg-white/[0.06] text-white"
                        : "text-[#8E929B] hover:bg-white/[0.03] hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${tab.id === "withdrawals" ? "-rotate-12" : ""} ${active ? "text-[#D9362B]" : "text-[#8E929B]"}`} />
                      <span>{tab.label}</span>
                    </div>
                    {tab.id === "notifications" && unreadCount > 0 && (
                      <span className="min-w-[16px] h-4 px-1 rounded-full bg-[#D9362B] text-white text-[9px] font-black flex items-center justify-center">
                        {unreadCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="pt-4 border-t border-white/[0.08] space-y-2">
            <Link
              href={`${basePath}/shop`}
              onClick={(e) => {
                e.preventDefault();
                handleTabChange("shop");
              }}
              className="flex items-center justify-center gap-2 w-full p-2 text-xs font-bold uppercase tracking-wider text-[#8E929B] hover:text-white border border-white/[0.08] hover:border-white transition-colors bg-[#0A0B0E]"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              Shop the archive
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center justify-center gap-2 w-full p-2 text-xs font-bold uppercase tracking-wider text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:border-rose-500/40 transition-colors bg-rose-500/10 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 w-full p-3 sm:p-5 lg:p-6 min-w-0 overflow-x-clip">
          
          {/* ---------------- ORDERS TAB ---------------- */}
          {activeTab === "orders" && (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-2 border-b border-white/[0.08] pb-2">
                <h1 className="text-base sm:text-lg font-bold uppercase text-white tracking-tight" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>
                  My Orders &amp; Tracking
                </h1>
                {orders.length > 0 && (
                  <span className="shrink-0 text-[10px] font-mono uppercase tracking-wider text-[#8E929B]">
                    {orders.length} {orders.length === 1 ? "order" : "orders"}
                  </span>
                )}
              </div>

              {orders.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border border-white/[0.08] bg-[#11131A] px-3 py-2 text-[10px] uppercase tracking-wider">
                  <span className="text-[#8E929B]">
                    Total coins{" "}
                    <strong className="font-bold text-white">
                      {((customer?.availableCoins ?? 0) + (customer?.pendingCoins ?? 0)).toLocaleString("en-IN")}
                    </strong>
                  </span>
                  <span className="text-[#00FF66]">+{orderCashback.totals.unlockedToday} unlocked today</span>
                  <span className="text-[#8E929B]">{orderCashback.totals.claimedToday} claimed today</span>
                </div>
              )}

              {orders.length === 0 ? (
                <div className="border border-white/[0.08] bg-[#11131A] p-8 text-center space-y-3">
                  <Package className="w-8 h-8 mx-auto text-[#8E929B]" />
                  <p className="text-sm font-bold uppercase text-white font-sans">No orders yet</p>
                  <Link
                    href={`${basePath}/shop`}
                    className="inline-flex items-center gap-2 bg-[#D9362B] hover:bg-[#B82B22] text-white px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    Shop the archive
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {orders.map((order) => {
                    const cashback = orderCashback.byId.get(order.id);
                    const payment = paymentStatusBadge(order.paymentMethod, order.paymentStatus);
                    const stageIdx = statusStageIndex(order.status, order.paymentStatus);
                    return (
                      <div key={order.id} className="border border-white/[0.08] bg-[#11131A]">
                        <div className="flex items-center justify-between gap-2 px-3 py-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-xs font-bold text-white uppercase" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>
                              #{order.orderNumber}
                            </span>
                            <span className={`shrink-0 px-1.5 py-0.5 text-[9px] font-bold uppercase border ${statusClasses(order.status)}`}>
                              {orderStatusLabel(order.status)}
                            </span>
                          </div>
                          <span className="shrink-0 text-xs font-bold text-white font-sans">{formatRupees(order.total)}</span>
                        </div>

                        <div className="divide-y divide-white/[0.04] border-t border-white/[0.06] py-1">
                          {order.items.map((it, idx) => {
                            const href = productHref(it.title);
                            const rowClass = "flex items-center gap-2 px-3 py-2 text-[11px] transition-colors";
                            const content = (
                              <>
                                <span className="min-w-0 flex-1 truncate text-white font-bold uppercase font-sans group-hover:text-[#00FF66]">
                                  {it.title}
                                </span>
                                <span className="shrink-0 text-[10px] text-[#8E929B]">
                                  {it.size} · ×{it.quantity}
                                </span>
                                <span className="shrink-0 font-bold text-white">{formatRupees(it.price * it.quantity)}</span>
                              </>
                            );
                            return href ? (
                              <Link
                                key={idx}
                                href={href}
                                title={`View ${it.title}`}
                                className={`group ${rowClass} hover:bg-white/[0.05]`}
                              >
                                {content}
                              </Link>
                            ) : (
                              <div key={idx} className={rowClass}>
                                {content}
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-white/[0.06] px-3 py-1.5 text-[10px] uppercase tracking-wider">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 text-[9px] font-bold border ${payment.className}`}>
                              {payment.label}
                            </span>
                            <span className="text-[#8E929B]">{dateLabel(order.placedAt)}</span>
                          </div>
                          {cashback && order.cashback && order.cashback.length > 0 && (
                            <div className="flex flex-wrap items-center gap-x-3 text-[#8E929B]">
                              <span className="text-[#00FF66]">+{cashback.unlockedToday} today</span>
                              <span>{cashback.claimedToday} claimed</span>
                              <span>{cashback.pending} pending</span>
                            </div>
                          )}
                        </div>

                        {/* Six-stage progress tracker */}
                        <div className="border-t border-white/[0.06] px-3 py-2">
                          <div className="flex items-center gap-1">
                            {TRACKING_STAGES.map((stage, idx) => {
                              const isDone = stageIdx >= idx;
                              const isCurrent = stageIdx === idx;
                              return (
                                <span
                                  key={stage.key}
                                  title={stage.label}
                                  className={`h-1 flex-1 ${
                                    isCurrent ? "bg-[#D9362B]" : isDone ? "bg-[#00FF66]" : "bg-white/10"
                                  }`}
                                />
                              );
                            })}
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2 text-[9px] uppercase tracking-wider">
                            <span className={order.status === "CANCELLED" ? "text-rose-400" : "text-white font-bold"}>
                              {order.status === "CANCELLED"
                                ? "Order cancelled"
                                : `${stageIdx + 1}/6 · ${stageLabel(stageIdx, order.paymentStatus)}`}
                            </span>
                            {order.status !== "CANCELLED" && (
                              <span className="text-[#8E929B]">{TRACKING_STAGES[stageIdx]?.short}</span>
                            )}
                          </div>
                        </div>

                        {/* Payment verification */}
                        {(order.paymentMethod === "UPI" || order.paymentMethod === "MANUAL_UPI") &&
                          (order.paymentStatus === "PENDING_VERIFICATION" || order.paymentStatus === "REJECTED") && (
                          <div className="m-2.5 border border-amber-400/30 bg-amber-400/[0.06] p-2.5 space-y-2">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                              <div>
                                <p className="text-xs font-bold text-amber-300 uppercase">
                                  {order.paymentStatus === "PENDING_VERIFICATION"
                                    ? "Payment verification pending"
                                    : "Payment not matched"}
                                </p>
                                <p className="text-[11px] text-[#A0A5B5] mt-0.5">
                                  Submit the 12-digit UTR from your UPI app. Verification usually takes under 24 hours.
                                </p>
                              </div>
                            </div>

                            {resubmittingOrderId === order.id ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  maxLength={12}
                                  placeholder="12-digit UTR reference"
                                  value={resubmitUtr}
                                  onChange={(e) => setResubmitUtr(e.target.value.replace(/\D/g, ""))}
                                  className="w-full bg-[#0A0B0E] border border-white/[0.12] px-3 py-2 text-xs text-white font-mono placeholder:text-[#5A5E68] focus:border-amber-400/60 focus:outline-none"
                                />
                                {resubmitError && <p className="text-[10px] text-rose-400">{resubmitError}</p>}
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleResubmitUtr(order.orderNumber)}
                                    disabled={isSubmittingResubmit}
                                    className="inline-flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-black px-3 py-1.5 text-[10px] font-bold uppercase transition-colors"
                                  >
                                    {isSubmittingResubmit ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                    Submit for review
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setResubmittingOrderId(null);
                                      setResubmitError(null);
                                    }}
                                    className="px-3 py-1.5 text-[10px] font-bold uppercase text-[#8E929B] hover:text-white transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-[10px] font-mono text-[#8E929B]">
                                  {order.utr ? `UTR ${order.utr}` : "No UTR submitted yet"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setResubmittingOrderId(order.id);
                                    setResubmitUtr(order.utr || "");
                                    setResubmitError(null);
                                  }}
                                  className="text-[10px] font-bold uppercase text-amber-300 hover:text-white transition-colors"
                                >
                                  {order.utr ? "Update UTR" : "Add UTR"}
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Courier + tracking */}
                        {order.trackingNumber && (
                          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] px-3 py-1.5">
                            <div className="flex items-center gap-2 text-[10px]">
                              <Truck className="w-3.5 h-3.5 text-[#D9362B]" />
                              <span className="font-bold uppercase text-white">{order.courier || "Courier"}</span>
                              <span className="font-mono text-[#8E929B]">{order.trackingNumber}</span>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] font-bold uppercase">
                              <Link href="/app/track" className="text-[#00F0FF] hover:text-white transition-colors">
                                Track order
                              </Link>
                              {getCourierTrackingUrl(order.courier, order.trackingNumber) && (
                                <a
                                  href={getCourierTrackingUrl(order.courier, order.trackingNumber)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[#8E929B] hover:text-white transition-colors"
                                >
                                  Courier site
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Timeline */}
                        {order.timeline && order.timeline.length > 0 && (
                          <div className="flex items-center gap-2 border-t border-white/[0.06] px-3 py-1.5 text-[10px] text-[#8E929B]">
                            <Clock className="w-3.5 h-3.5 shrink-0 text-[#D9362B]" />
                            <span className="truncate">Latest: {order.timeline[order.timeline.length - 1].note || order.status}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ---------------- SHOP / BUY ANOTHER TEE TAB ---------------- */}
          {activeTab === "shop" && (
            <div className="space-y-6">
              <div className="border-b border-white/[0.08] pb-3">
                <h1 className="text-lg sm:text-xl font-bold uppercase text-white tracking-tight" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>
                  Shop the Archive
                </h1>
              </div>

              {renderProductCards()}
            </div>
          )}



          {/* ---------------- WALLET TAB ---------------- */}
          {activeTab === "wallet" && (
            <div className="space-y-6">
              <div className="border-b border-white/[0.08] pb-3">
                <h1 className="text-lg sm:text-xl font-bold uppercase text-white tracking-tight" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>
                  Cashback Wallet
                </h1>
              </div>

              {snapshot && (
                <WalletPanel
                  snapshot={snapshot}
                  view="wallet"
                  onOpenWithdrawals={() => handleTabChange("withdrawals")}
                  onClaimCashback={handleClaim}
                  onSubmitWithdrawal={handleWithdrawal}
                  onAddBankAccount={handleAddBankAccount}
                  onRemoveBankAccount={handleRemoveBankAccount}
                />
              )}
            </div>
          )}

          {/* ---------------- WITHDRAWALS TAB ---------------- */}
          {activeTab === "withdrawals" && (
            <div className="space-y-6">
              <div className="border-b border-white/[0.08] pb-3">
                <h1 className="text-lg sm:text-xl font-bold uppercase text-white tracking-tight" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>
                  Withdrawals & Payouts
                </h1>
              </div>

              {snapshot && (
                <WalletPanel
                  snapshot={snapshot}
                  view="withdrawals"
                  initialWithdrawSource={initialWithdrawSource}
                  onClaimCashback={handleClaim}
                  onSubmitWithdrawal={handleWithdrawal}
                  onAddBankAccount={handleAddBankAccount}
                  onRemoveBankAccount={handleRemoveBankAccount}
                />
              )}
            </div>
          )}

          {/* ---------------- REWARDS TAB ---------------- */}
          {activeTab === "rewards" && (
            <div className="space-y-6">
              <div className="border-b border-white/[0.08] pb-3">
                <h1 className="text-lg sm:text-xl font-bold uppercase text-white tracking-tight" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>
                  Reward Engine
                </h1>
              </div>

              <div className="border border-white/[0.08] bg-[#11131A] p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#8E929B]">Membership tier</p>
                <p className="mt-2 text-xl font-black text-white uppercase">
                  {customer?.tier || "Silver"}
                </p>
                <p className="mt-1 text-xs text-[#8E929B]">
                  {(customer?.lifetimeEarnedCoins || 0).toLocaleString("en-IN")} coins earned lifetime
                </p>
              </div>

              <div className="border border-white/[0.08] bg-[#11131A]">
                <div className="px-5 py-4 border-b border-white/[0.08]">
                  <h2 className="text-sm font-bold uppercase text-white">Included perks</h2>
                </div>
                <ul className="divide-y divide-white/[0.06]">
                  {[
                    {
                      title: "100% purchase cashback",
                      body: "Every order is credited back into your coin wallet.",
                    },
                    {
                      title: "Daily unlock",
                      body: "Pending coins release into your available balance every day.",
                    },
                    {
                      title: "Direct bank payout",
                      body: "Withdraw unlocked coins directly to your verified bank account.",
                    },
                    {
                      title: "7-day exchange",
                      body: "Doorstep size replacement on every order.",
                    },
                  ].map((perk) => (
                    <li key={perk.title} className="px-5 py-3.5">
                      <p className="text-xs font-bold text-white uppercase">{perk.title}</p>
                      <p className="text-[11px] text-[#8E929B] mt-0.5">{perk.body}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* ---------------- AFFILIATE TAB ---------------- */}
          {activeTab === "affiliate" && (() => {
            const referralCode = customer?.referralCode || "";
            const origin = siteOrigin;
            const referralUrl = `${origin}/invite/${referralCode}`;
            const whatsappText = `Join SKYWEAR Heavyweight Streetwear with my exclusive invite link and claim 100% Instant Cashback: ${referralUrl}`;
            const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappText)}`;

            const agentProfile = customer?.agent;
            const agentPeriod = agentPeriodKey();
            const agentRate = agentCommissionRateFor(snapshot?.rewardRules, customer);
            const agentSales = agentMonthlySalesCoins(customer, agentPeriod);
            const agentBonus =
              agentProfile?.monthlyProgress?.period === agentPeriod
                ? agentProfile.monthlyProgress.bonusCoins || 0
                : 0;
            const agentNext = agentNextSlabFor(snapshot?.rewardRules, agentSales);
            const agentGifts = agentProfile?.gifts ?? [];

            return (
              <div className="space-y-6">
                <div className="border-b border-white/[0.08] pb-3">
                  <h1 className="text-lg sm:text-xl font-bold uppercase text-white tracking-tight" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>
                    Affiliate &amp; Referrals
                  </h1>
                </div>

                {/* Referral ID, invite link and performance */}
                <div className="border border-white/[0.08] bg-[#11131A] p-5 space-y-4">
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-[#8E929B]">
                      Your referral code
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-3 bg-[#0A0B0E] border border-white/[0.08] p-3">
                      <span className="min-w-0 break-all font-mono font-black text-sm sm:text-lg text-white tracking-wider select-all">
                        {referralCode || "—"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (!referralCode) return;
                          void copyText(referralCode).then((copied) => {
                            if (!copied) return;
                            setCopiedCode(true);
                            setTimeout(() => setCopiedCode(false), 2000);
                          });
                        }}
                        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 border border-white/[0.12] hover:border-white text-white text-xs font-bold uppercase transition-colors"
                      >
                        {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedCode ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-[#8E929B]">
                      Invite link
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={referralUrl}
                        className="flex-1 min-w-0 bg-[#0A0B0E] border border-white/[0.08] px-3 py-2.5 text-xs text-white font-mono truncate focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          void copyText(referralUrl).then((copied) => {
                            if (!copied) return;
                            setCopiedLink(true);
                            setTimeout(() => setCopiedLink(false), 2000);
                          });
                        }}
                        aria-label={copiedLink ? "Invite link copied" : "Copy invite link"}
                        title="Copy invite link"
                        className="px-3 py-2.5 border border-white/[0.12] hover:border-white text-white transition-colors shrink-0"
                      >
                        {copiedLink ? <Check className="w-4 h-4 text-[#00FF66]" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 bg-[#D9362B] hover:bg-[#B82B22] text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share on WhatsApp</span>
                  </a>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 bg-[#11131A] border border-white/[0.08]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E929B] block">Members</span>
                    <p className="text-2xl font-black text-white font-mono mt-1">{uniqueFriendsCount}</p>
                  </div>
                  <div className="p-4 bg-[#11131A] border border-white/[0.08]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E929B] block">Orders</span>
                    <p className="text-2xl font-black text-white font-mono mt-1">{convertedCount}</p>
                  </div>
                  <div className="p-4 bg-[#11131A] border border-white/[0.08]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E929B] block">Commission</span>
                    <p className="text-2xl font-black text-white font-mono mt-1">
                      {totals.totalReferralCommissionCoins.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="p-4 bg-[#11131A] border border-white/[0.08]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E929B] block">Referral balance</span>
                    <p className="text-2xl font-black text-[#00FF66] font-mono mt-1">
                      {totals.referralCoins.toLocaleString("en-IN")}
                    </p>
                    <Link
                      href={`${basePath}/withdrawals?withdraw=referral`}
                      className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold uppercase text-white hover:text-[#00FF66] transition-colors"
                    >
                      Withdraw coins
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>

                {/* ---------------- REFERRED USERS DIRECTORY (WITH PHONE NUMBERS) ---------------- */}
                <div className="border border-white/[0.08] bg-[#11131A] p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
                    <div>
                      <h3 className="text-sm font-bold uppercase text-white font-sans flex items-center gap-2">
                        <Users className="w-4 h-4 text-[#00FF66]" />
                        <span>Referred Members Directory ({uniqueFriendsCount})</span>
                      </h3>
                    </div>
                    <span className="text-[10px] text-[#A5AAB8] font-mono">
                      Real-time Network Sync
                    </span>
                  </div>

                  {referrals.length === 0 ? (
                    <div className="p-10 text-center space-y-3 bg-[#0A0B0E]/40 border border-dashed border-white/[0.08]">
                      <Users className="w-10 h-10 mx-auto text-[#8E929B]" />
                      <div className="space-y-1">
                        <p className="text-sm font-bold uppercase text-white font-sans">
                          No members registered with your code yet
                        </p>
                        <p className="text-xs text-[#8E929B] max-w-md mx-auto">
                          Share your referral ID <span className="text-[#00FF66] font-mono font-bold">{referralCode}</span> with friends! As soon as they register, their name, mobile number, and purchases will be listed here.
                        </p>
                      </div>
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            void copyText(referralUrl).then((copied) => {
                              if (!copied) return;
                              setCopiedLink(true);
                              setTimeout(() => setCopiedLink(false), 2000);
                            });
                          }}
                          className="px-4 py-2 bg-[#D9362B] hover:bg-[#B82B22] text-white text-xs font-bold uppercase inline-flex items-center gap-1.5 transition-colors"
                        >
                          {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedLink ? "COPIED INVITE LINK" : "COPY YOUR INVITE LINK"}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Desktop Table View */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left text-xs font-mono">
                          <thead className="text-[#8E929B] border-b border-white/[0.08] uppercase text-[10px]">
                            <tr>
                              <th className="py-2.5 pr-4">Member Name</th>
                              <th className="py-2.5 pr-4">Mobile Number</th>
                              <th className="py-2.5 pr-4">Date Joined</th>
                              <th className="py-2.5 pr-4">Order Details</th>
                              <th className="py-2.5 pr-4 text-right">Commission</th>
                              <th className="py-2.5 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.08]/60">
                            {referrals.map((r) => {
                              const cleanDigits = (r.friendPhone || "").replace(/\D/g, "");
                              const waUrl = cleanDigits.length >= 10 ? `https://api.whatsapp.com/send?phone=91${cleanDigits.slice(-10)}` : null;

                              return (
                                <tr key={r.id} className="hover:bg-[#0A0B0E] transition-colors">
                                  <td className="py-3 pr-4">
                                    <div className="font-bold text-white uppercase">{r.friendName}</div>
                                    {r.friendEmail && (
                                      <div className="text-[10px] text-[#8E929B] truncate max-w-[180px]">{r.friendEmail}</div>
                                    )}
                                  </td>
                                  <td className="py-3 pr-4">
                                    {r.friendPhone ? (
                                      <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1.5 font-bold text-[#00FF66] bg-[#00FF66]/10 px-2 py-1 border border-[#00FF66]/20">
                                          <Phone className="w-3 h-3 text-[#00FF66] shrink-0" />
                                          <span>{r.friendPhone}</span>
                                        </div>
                                        {waUrl && (
                                          <a
                                            href={waUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            title="Chat with friend on WhatsApp"
                                            className="text-[10px] text-[#00FF66] hover:underline uppercase font-bold"
                                          >
                                            Chat
                                          </a>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-[#8E929B]">—</span>
                                    )}
                                  </td>
                                  <td className="py-3 pr-4 text-[#A5AAB8]">{r.dateJoined || "Recent"}</td>
                                  <td className="py-3 pr-4">
                                    {r.orderNumber ? (
                                      <div>
                                        <span className="text-white font-bold">#{r.orderNumber}</span>
                                        {r.orderAmountInr && (
                                          <span className="text-[#8E929B] block text-[10px]">{formatRupees(r.orderAmountInr)}</span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-[#8E929B] text-[10px] italic">Account Created (No order yet)</span>
                                    )}
                                  </td>
                                  <td className="py-3 pr-4 text-right">
                                    <span className={r.commissionCoins > 0 ? "font-bold text-[#00FF66]" : "text-[#8E929B]"}>
                                      {r.commissionCoins > 0 ? `${Math.round(r.commissionCoins).toLocaleString("en-IN")} Coins` : "0 Coins"}
                                    </span>
                                  </td>
                                  <td className="py-3 text-right">
                                    {r.orderNumber ? (
                                      <span className="px-2 py-0.5 text-[9px] font-bold uppercase bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/30">
                                        {r.status === "PAID" ? "PAID" : "APPROVED"}
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 text-[9px] font-bold uppercase bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                                        REGISTERED
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Card View */}
                      <div className="md:hidden space-y-2.5">
                        {referrals.map((r) => {
                          const cleanDigits = (r.friendPhone || "").replace(/\D/g, "");
                          const waUrl = cleanDigits.length >= 10 ? `https://api.whatsapp.com/send?phone=91${cleanDigits.slice(-10)}` : null;

                          return (
                            <div key={r.id} className="p-3.5 bg-[#0A0B0E] border border-white/[0.08] space-y-2 text-xs font-mono">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-bold text-white uppercase text-sm">{r.friendName}</div>
                                  <div className="text-[10px] text-[#8E929B] mt-0.5">Joined {r.dateJoined || "Recent"}</div>
                                </div>
                                {r.orderNumber ? (
                                  <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/30">
                                    {r.status}
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                                    REGISTERED
                                  </span>
                                )}
                              </div>

                              {/* Mobile Phone Number Highlight */}
                              <div className="flex items-center justify-between p-2 bg-[#11131A] border border-white/[0.08]">
                                <div className="flex items-center gap-1.5 text-[#00FF66] font-bold">
                                  <Phone className="w-3.5 h-3.5 text-[#00FF66]" />
                                  <span>{r.friendPhone || "No phone on record"}</span>
                                </div>
                                {waUrl && (
                                  <a
                                    href={waUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2 py-0.5 bg-[#00FF66]/20 text-[#00FF66] text-[10px] font-bold uppercase hover:bg-[#00FF66] hover:text-black transition-colors"
                                  >
                                    WhatsApp
                                  </a>
                                )}
                              </div>

                              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/[0.08]">
                                <span className="text-[#8E929B]">
                                  {r.orderNumber ? `Order #${r.orderNumber}` : "No purchases yet"}
                                </span>
                                <span className="text-[#00FF66] font-bold">
                                  {r.commissionCoins > 0 ? `+${Math.round(r.commissionCoins).toLocaleString("en-IN")} Coins` : "0 Coins"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* ---------------- AGENT PROGRAMME ---------------- */}
                {customer && agentProfile?.status === "APPROVED" ? (
                  <div className="border border-[#00FF66]/25 bg-[#11131A] p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
                      <h2 className="text-sm font-bold uppercase text-white flex items-center gap-2">
                        <Handshake className="w-4 h-4 text-[#00FF66]" />
                        <span>Agent dashboard</span>
                      </h2>
                      <span className="px-2 py-1 border border-[#00FF66]/30 bg-[#00FF66]/10 text-[10px] font-bold uppercase text-[#00FF66]">
                        {agentRate}% commission
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E929B] block">Month sales</span>
                        <p className="text-xl font-black font-mono text-white mt-1">{Math.round(agentSales).toLocaleString("en-IN")}</p>
                        <span className="text-[10px] text-[#8E929B] font-mono">coins · {agentPeriod}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E929B] block">Slab bonus</span>
                        <p className="text-xl font-black font-mono text-[#00FF66] mt-1">{Math.round(agentBonus).toLocaleString("en-IN")}</p>
                        <span className="text-[10px] text-[#8E929B] font-mono">coins this month</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E929B] block">Gifts</span>
                        <p className="text-xl font-black font-mono text-white mt-1">{agentGifts.length}</p>
                        <span className="text-[10px] text-[#8E929B] font-mono">
                          {agentGifts.filter((gift) => gift.status === "PENDING_DISPATCH").length} to ship
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="h-1.5 w-full bg-[#0A0B0E] overflow-hidden">
                        <div
                          className="h-full bg-[#00FF66]"
                          style={{ width: `${Math.min(100, agentNext ? (agentSales / agentNext.targetCoins) * 100 : 100)}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-[#A5AAB8] font-mono">
                        {agentNext
                          ? `${Math.max(0, Math.round(agentNext.targetCoins - agentSales)).toLocaleString("en-IN")} coins to ${agentNext.targetCoins.toLocaleString("en-IN")} — unlocks ${agentNext.bonusCoins.toLocaleString("en-IN")} bonus coins${agentNext.gift ? ` + ${agentNext.gift}` : ""}`
                          : "All monthly slabs cleared. Gift dispatch is tracked above."}
                      </p>
                    </div>

                    {agentGifts.length > 0 && (
                      <div className="space-y-1.5 border-t border-white/[0.08] pt-3">
                        {agentGifts.map((gift) => (
                          <div key={gift.id} className="flex items-center justify-between gap-2 text-xs">
                            <span className="min-w-0 truncate text-white flex items-center gap-2">
                              <Gift className="w-3.5 h-3.5 text-[#00FF66] shrink-0" />
                              {gift.label} <span className="text-[#8E929B] font-mono text-[10px]">{gift.period}</span>
                            </span>
                            <span
                              className={`shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 border ${
                                gift.status === "DISPATCHED"
                                  ? "border-[#00FF66]/30 text-[#00FF66]"
                                  : "border-amber-400/30 text-amber-300"
                              }`}
                            >
                              {gift.status === "DISPATCHED" ? "Dispatched" : "Preparing"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="text-[11px] text-[#A5AAB8] border-t border-white/[0.08] pt-3">
                      Agent payouts skip the minimum coin threshold. Withdraw anytime from{" "}
                      <Link href={`${basePath}/withdrawals?withdraw=referral`} className="text-[#00FF66] font-bold hover:underline">
                        Withdrawals
                      </Link>
                      .
                    </p>
                  </div>
                ) : agentProfile?.status === "PENDING" ? (
                  <div className="border border-amber-400/25 bg-[#11131A] p-5 flex items-start gap-3">
                    <Clock className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold uppercase text-white">Agent application under review</p>
                      <p className="text-xs text-[#A5AAB8] mt-1">
                        Submitted {dateLabel(agentProfile.appliedAt)}. You become an agent once the team approves it.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="border border-white/[0.08] bg-[#11131A] p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <Handshake className="w-4 h-4 text-[#00FF66]" />
                      <h2 className="text-sm font-bold uppercase text-white">Become a SKYWARE agent</h2>
                    </div>
                    <p className="text-xs text-[#A5AAB8] leading-relaxed">
                      Sell to your own network and earn {agentRate}% on every paid order, monthly slab bonuses, gifts on target and faster payouts. Applications are reviewed by the team before activation.
                    </p>
                    {agentProfile?.status === "REJECTED" && agentProfile.rejectReason && (
                      <p className="text-xs text-rose-300 border border-rose-400/25 bg-rose-400/5 px-3 py-2">
                        Last application: {agentProfile.rejectReason}
                      </p>
                    )}
                    {agentError && <p className="text-xs text-rose-300">{agentError}</p>}
                    {agentApplyOpen ? (
                      <div className="space-y-2">
                        <textarea
                          rows={3}
                          maxLength={240}
                          value={agentPitch}
                          onChange={(event) => setAgentPitch(event.target.value)}
                          placeholder="Where do you sell? Audience size, platform, city…"
                          className="w-full bg-[#0A0B0E] border border-white/[0.08] px-3 py-2.5 text-xs text-white placeholder:text-[#8E929B]/60 focus:outline-none focus:border-[#00FF66]"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void handleAgentApply()}
                            disabled={agentSubmitting}
                            className="px-4 py-2 bg-[#D9362B] hover:bg-[#B82B22] disabled:opacity-60 text-white text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 transition-colors"
                          >
                            {agentSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            <span>Submit application</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAgentApplyOpen(false);
                              setAgentError(null);
                            }}
                            className="px-4 py-2 border border-white/[0.12] hover:border-white text-white text-xs font-bold uppercase transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAgentApplyOpen(true)}
                        className="px-4 py-2 border border-[#00FF66]/40 text-[#00FF66] hover:bg-[#00FF66]/10 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Apply to become an agent</span>
                      </button>
                    )}
                  </div>
                )}

                {/* ---------------- TOP REFERRAL EARNERS ---------------- */}
                <div className="border border-white/[0.08] bg-[#11131A] p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
                    <h3 className="text-sm font-bold uppercase text-white font-sans flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-[#00FF66]" />
                      <span>Top Referral Earners</span>
                    </h3>
                    <span className="px-2 py-0.5 border border-[#00FF66]/30 bg-[#00FF66]/10 text-[10px] font-bold uppercase text-[#00FF66]">
                      Top 5 win Manali trip
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8E929B]">
                    Ranked by referral earnings from approved and paid orders. Top 5 when the campaign closes win a 100% sponsored Manali trip.
                  </p>

                    {topReferrers.length === 0 ? (
                      <div className="border border-dashed border-white/[0.08] bg-[#0A0B0E]/40 p-6 text-center">
                        <Trophy className="w-6 h-6 mx-auto text-[#6B6F7A]" />
                        <p className="mt-2 text-xs text-[#8E929B]">
                          No referral coins earned yet. The first scores will claim this board.
                        </p>
                      </div>
                    ) : (
                      <ol className="divide-y divide-white/[0.06] border border-white/[0.08] bg-[#0A0B0E]">
                        {topReferrers.slice(0, 10).map((entry) => (
                          <li
                            key={`manali-${entry.rank}-${entry.name}`}
                            className={`flex items-center gap-3 px-3 py-2.5 ${entry.isYou ? "bg-[#00FF66]/[0.05]" : ""}`}
                          >
                            <span
                              className={`w-5 shrink-0 text-center font-mono text-xs font-bold ${
                                entry.rank <= 5 ? "text-[#00FF66]" : "text-[#6B6F7A]"
                              }`}
                            >
                              {entry.rank}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="flex items-center gap-1.5 truncate text-xs font-bold text-white">
                                {entry.name}
                                {entry.isYou && (
                                  <span className="shrink-0 bg-[#00FF66]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#00FF66]">
                                    You
                                  </span>
                                )}
                                {entry.rank <= 5 && (
                                  <span className="shrink-0 border border-[#00FF66]/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#00FF66]">
                                    Manali
                                  </span>
                                )}
                              </p>
                              <p className="text-[10px] text-[#8E929B]">
                                {entry.members} {entry.members === 1 ? "member" : "members"} referred
                              </p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                </div>
              </div>
            );
          })()}

          {/* ---------------- NOTIFICATIONS TAB ---------------- */}
          {/* ---------------- TOP REFERRERS TAB ---------------- */}
          {activeTab === "leaderboard" && (
            <div className="space-y-6">
              <div className="border-b border-white/[0.08] pb-3">
                <h1 className="text-lg sm:text-xl font-bold uppercase text-white tracking-tight" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>
                  Top Referrers
                </h1>
              </div>

              <div className="border border-white/[0.08] bg-[#11131A]">
                <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3">
                  <h3 className="flex items-center gap-2 text-sm font-bold uppercase text-white">
                    <Trophy className="h-4 w-4 text-[#00FF66]" />
                    Leaderboard
                  </h3>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#8E929B]">
                    All-time earnings
                  </span>
                </div>
                {topReferrers.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-[#8E929B]">
                    No referral earnings yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-white/[0.06]">
                    {topReferrers.map((entry) => (
                      <li
                        key={`${entry.rank}-${entry.name}`}
                        className={`flex items-center gap-3 px-4 py-3 ${
                          entry.isYou ? "bg-[#00FF66]/[0.04]" : ""
                        }`}
                      >
                        <span
                          className={`w-6 shrink-0 text-center font-mono text-xs font-bold ${
                            entry.rank <= 3 ? "text-[#00FF66]" : "text-[#6B6F7A]"
                          }`}
                        >
                          {entry.rank}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-white">
                            {entry.name}
                            {entry.isYou && (
                              <span className="shrink-0 rounded bg-[#00FF66]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#00FF66]">
                                You
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-[#8E929B]">
                            {entry.members} {entry.members === 1 ? "member" : "members"}
                          </p>
                        </div>
                        <p className="shrink-0 text-right">
                          <span className="block text-sm font-bold tabular-nums text-[#00FF66]">
                            {entry.coins.toLocaleString("en-IN")}
                          </span>
                          <span className="block text-[10px] uppercase tracking-wider text-[#8E929B]">
                            coins
                          </span>
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-6">
              <div className="border-b border-white/[0.08] pb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h1 className="text-lg sm:text-xl font-bold uppercase text-white tracking-tight" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>
                    Alerts &amp; Updates
                  </h1>
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    disabled={markingAllRead}
                    className="inline-flex items-center gap-1.5 px-3 py-2 border border-white/[0.08] bg-[#11131A] hover:border-white disabled:opacity-60 text-[10px] font-bold uppercase tracking-wider text-white transition-colors"
                  >
                    {markingAllRead ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Mark all as read
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="border border-white/[0.08] bg-[#11131A] p-12 text-center text-[#8E929B]">
                  <Bell className="w-8 h-8 mx-auto mb-2 text-[#8E929B]" />
                  <p className="text-xs uppercase font-bold">No notifications right now</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`border p-4 flex items-start gap-3 transition-colors ${
                        n.read
                          ? "border-white/[0.06] bg-[#0D0F14] opacity-70"
                          : "border-white/[0.08] bg-[#11131A]"
                      }`}
                    >
                      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${n.read ? "bg-[#3A3E48]" : "bg-[#D9362B]"}`} />
                      <div className="flex-1 min-w-0 text-xs">
                        <p className={`font-bold ${n.read ? "text-[#C6CAD3]" : "text-white"}`}>{n.title}</p>
                        <p className="text-[#A5AAB8] mt-0.5">{n.message}</p>
                        <span className="text-[10px] text-[#8E929B] block mt-1">{dateTimeLabel(n.createdAt)}</span>
                      </div>
                      {!n.read && (
                        <button
                          type="button"
                          onClick={() => handleMarkRead(n.id)}
                          disabled={markingNotificationId === n.id}
                          className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase text-[#8E929B] hover:text-white disabled:opacity-60 transition-colors"
                        >
                          {markingNotificationId === n.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          Read
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ---------------- PROFILE TAB ---------------- */}
          {activeTab === "profile" && (
            <div className="space-y-3">
              <div className="border-b border-white/[0.08] pb-2">
                <h1 className="text-base sm:text-lg font-bold uppercase text-white tracking-tight" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>
                  Profile &amp; Addresses
                </h1>
              </div>

              {/* Identity + key details */}
              <div className="border border-white/[0.08] bg-[#11131A] p-3.5">
                <div className="flex items-start gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-[#00FF66]/30 bg-[#00FF66]/10 text-sm font-bold uppercase text-[#00FF66]">
                    {profileInitials || "S"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-bold text-white">{customer.name || "Skywear Collector"}</p>
                      <span className="border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#00FF66]">
                        {customer.tier || "Silver"}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-[#8E929B]">
                      {customer.phone || "No phone"} · {customer.email || "No email"}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[#8E929B]">
                      <Users className="h-3 w-3 shrink-0 text-[#00FF66]" />
                      <span className="truncate">
                        {customer.referredByName || customer.referredByCode ? (
                          <>
                            Referred by{" "}
                            <span className="font-semibold text-white">
                              {customer.referredByName || customer.referredByCode}
                            </span>
                          </>
                        ) : (
                          "Joined directly · no referrer"
                        )}
                      </span>
                    </p>
                  </div>
                  {!isEditingProfile && (
                    <button
                      type="button"
                      onClick={startEditingProfile}
                      className="shrink-0 border border-white/[0.08] px-2 py-1 text-[10px] font-bold uppercase text-[#D9362B] hover:border-white hover:text-white transition-colors"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {!isEditingProfile && (
                  <div className="mt-3 divide-y divide-white/[0.06] border-t border-white/[0.06] pt-1">
                    <div className="flex items-center justify-between gap-3 py-2">
                      <span className="flex items-center gap-2 text-[11px] font-medium text-[#A5AAB8]">
                        <Coins className="h-3.5 w-3.5 shrink-0 text-[#8E929B]" />
                        Total Coins
                      </span>
                      <span className="flex items-baseline gap-1 text-xs font-bold tabular-nums text-white">
                        {(customer.availableCoins ?? 0).toLocaleString("en-IN")}
                        <span className="text-[10px] font-medium text-[#8E929B]">coins</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 py-2">
                      <span className="flex items-center gap-2 text-[11px] font-medium text-[#A5AAB8]">
                        <Clock className="h-3.5 w-3.5 shrink-0 text-[#8E929B]" />
                        Pending Coins
                      </span>
                      <span className="flex items-baseline gap-1 text-xs font-bold tabular-nums text-white">
                        {(customer.pendingCoins ?? 0).toLocaleString("en-IN")}
                        <span className="text-[10px] font-medium text-[#8E929B]">coins</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 py-2">
                      <span className="flex items-center gap-2 text-[11px] font-medium text-[#A5AAB8]">
                        <TrendingUp className="h-3.5 w-3.5 shrink-0 text-[#8E929B]" />
                        Lifetime Earnings
                      </span>
                      <span className="flex items-baseline gap-1 text-xs font-bold tabular-nums text-white">
                        {(customer.lifetimeEarnedCoins ?? 0).toLocaleString("en-IN")}
                        <span className="text-[10px] font-medium text-[#8E929B]">coins</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 py-2">
                      <span className="flex items-center gap-2 text-[11px] font-medium text-[#A5AAB8]">
                        <Users className="h-3.5 w-3.5 shrink-0 text-[#8E929B]" />
                        Referral Earnings
                      </span>
                      <span className="flex items-baseline gap-1 text-xs font-bold tabular-nums text-white">
                        {confirmedReferralCoins.toLocaleString("en-IN")}
                        <span className="text-[10px] font-medium text-[#8E929B]">coins</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 py-2">
                      <span className="flex items-center gap-2 text-[11px] font-medium text-[#A5AAB8]">
                        <Wallet className="h-3.5 w-3.5 shrink-0 text-[#8E929B]" />
                        Total Withdrawals
                      </span>
                      <span className="flex items-baseline gap-1 text-xs font-bold tabular-nums text-white">
                        {completedWithdrawalsCoins.toLocaleString("en-IN")}
                        <span className="text-[10px] font-medium text-[#8E929B]">coins</span>
                      </span>
                    </div>
                  </div>
                )}

                {(profileSuccess || profileError) && (
                  <p className={`mt-3 text-[11px] ${profileError ? "text-[#D9362B]" : "text-[#00FF66]"}`}>
                    {profileError || profileSuccess}
                  </p>
                )}

                {isEditingProfile && (
                  <form onSubmit={handleSaveProfile} className="mt-3 space-y-2 border-t border-white/[0.06] pt-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-[#8E929B]">Full name</label>
                        <input
                          type="text"
                          required
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          placeholder="Your name"
                          className="w-full border border-white/[0.08] bg-[#0A0B0E] px-2.5 py-1.5 text-xs text-white focus:border-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[#8E929B]">
                          <Lock className="h-2.5 w-2.5" /> Registered mobile
                        </label>
                        <div className="w-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-xs text-[#8E929B]">
                          {customer.phone || "Not linked"}
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-[#8E929B]">Email</label>
                        <input
                          type="email"
                          value={profileEmail}
                          onChange={(e) => setProfileEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="w-full border border-white/[0.08] bg-[#0A0B0E] px-2.5 py-1.5 text-xs text-white focus:border-white focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={profileSaving}
                        className="inline-flex items-center gap-1.5 bg-[#D9362B] hover:bg-[#B82B22] px-3 py-1.5 text-[10px] font-bold uppercase text-white transition-colors disabled:opacity-50"
                      >
                        {profileSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingProfile(false)}
                        className="border border-white/[0.08] px-3 py-1.5 text-[10px] font-bold uppercase text-[#8E929B] hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Bank account details */}
              <div className="border border-white/[0.08] bg-[#11131A] p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-[#00FF66]" />
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-[#8E929B]">Bank account details</p>
                    </div>
                  </div>
                  {!isEditingPayoutBank && (
                    <button
                      type="button"
                      onClick={openPayoutBankForm}
                      className="shrink-0 border border-white/[0.08] px-2 py-1 text-[10px] font-bold uppercase text-[#D9362B] transition-colors hover:border-white hover:text-white"
                    >
                      {payoutBank ? "Change" : "Add"}
                    </button>
                  )}
                </div>

                {payoutBank && !isEditingPayoutBank && (
                  <div className="mt-3 border-t border-white/[0.06] pt-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{payoutBank.bankName}</p>
                        <p className="mt-0.5 truncate text-xs text-[#8E929B]">
                          A/C ••••{payoutBank.accountNumberLast4 || "····"} · IFSC {payoutBank.ifscCode}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-[#8E929B]">{payoutBank.accountHolderName}</p>
                      </div>
                      <span
                        className={`shrink-0 border px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                          payoutBank.status === "PENDING_REVIEW"
                            ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                            : "border-[#00FF66]/30 bg-[#00FF66]/10 text-[#00FF66]"
                        }`}
                      >
                        {payoutBank.status === "PENDING_REVIEW" ? "In review" : "Active"}
                      </span>
                    </div>
                    {payoutBank.pendingUpdate && (
                      <p className="mt-2 border border-amber-400/30 bg-amber-400/10 px-2 py-1.5 text-[11px] leading-snug text-amber-300">
                        Change to {payoutBank.pendingUpdate.bankName} ••••
                        {payoutBank.pendingUpdate.accountNumberLast4 || "····"} is pending admin review.
                      </p>
                    )}
                  </div>
                )}

                {isEditingPayoutBank && (
                  <form onSubmit={handleSavePayoutBank} className="mt-3 space-y-2 border-t border-white/[0.06] pt-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-[#8E929B]">Account holder name</label>
                        <input
                          type="text"
                          value={payoutHolder}
                          onChange={(e) => setPayoutHolder(e.target.value)}
                          onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 120)}
                          placeholder="Name as per bank"
                          className="w-full border border-white/[0.08] bg-[#0A0B0E] px-2.5 py-1.5 text-base sm:text-xs text-white focus:border-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-[#8E929B]">Bank</label>
                        <BankSelect value={payoutBankName} onChange={setPayoutBankName} />
                      </div>
                      <div>
                        <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-[#8E929B]">Account number</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          value={payoutAccount}
                          onChange={(e) => setPayoutAccount(e.target.value.replace(/\D/g, ""))}
                          onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 120)}
                          placeholder="9 to 18 digits"
                          className="w-full border border-white/[0.08] bg-[#0A0B0E] px-2.5 py-1.5 text-base sm:text-xs text-white focus:border-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-[#8E929B]">Confirm account number</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          value={payoutConfirm}
                          onChange={(e) => setPayoutConfirm(e.target.value.replace(/\D/g, ""))}
                          onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 120)}
                          placeholder="Re-enter account number"
                          className="w-full border border-white/[0.08] bg-[#0A0B0E] px-2.5 py-1.5 text-base sm:text-xs text-white focus:border-white focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-[#8E929B]">IFSC code</label>
                      <input
                        type="text"
                        maxLength={11}
                        value={payoutIfsc}
                        onChange={(e) => setPayoutIfsc(e.target.value.toUpperCase())}
                        onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 120)}
                        placeholder="INDB0000476"
                        className="w-full border border-white/[0.08] bg-[#0A0B0E] px-2.5 py-1.5 text-base sm:text-xs uppercase text-white focus:border-white focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={payoutSaving}
                        className="inline-flex items-center gap-1.5 bg-[#D9362B] px-3 py-1.5 text-[10px] font-bold uppercase text-white transition-colors hover:bg-[#B82B22] disabled:opacity-50"
                      >
                        {payoutSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                        Save bank
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingPayoutBank(false);
                          setPayoutError(null);
                        }}
                        className="border border-white/[0.08] px-3 py-1.5 text-[10px] font-bold uppercase text-[#8E929B] transition-colors hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {(payoutError || payoutSuccess) && (
                  <p className={`mt-2 text-[11px] leading-snug ${payoutError ? "text-[#D9362B]" : "text-[#00FF66]"}`}>
                    {payoutError || payoutSuccess}
                  </p>
                )}
              </div>

              {/* Delivery addresses */}
              <div className="border border-white/[0.08] bg-[#11131A] p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-[#8E929B]">Delivery addresses</p>
                    <p className="mt-0.5 text-[10px] text-[#8E929B]">
                      {profileAddresses.length} saved · default used at checkout
                    </p>
                  </div>
                  {editingAddressIndex === null && (
                    <button
                      type="button"
                      onClick={startAddAddress}
                      className="inline-flex shrink-0 items-center gap-1 border border-white/[0.08] px-2 py-1 text-[10px] font-bold uppercase text-[#D9362B] transition-colors hover:border-white hover:text-white"
                    >
                      <Plus className="h-3 w-3" />
                      Add
                    </button>
                  )}
                </div>

                {(addressSuccess || addressError) && (
                  <p className={`text-[11px] ${addressError ? "text-[#D9362B]" : "text-[#00FF66]"}`}>
                    {addressError || addressSuccess}
                  </p>
                )}

                {profileAddresses.length === 0 ? (
                  <p className="text-xs text-[#8E929B]">No address saved yet. Add one to speed up checkout.</p>
                ) : (
                  <div className="space-y-1.5">
                    {profileAddresses.map((address, index) => (
                      <div
                        key={`${address.label}-${index}`}
                        className="border border-white/[0.06] bg-[#0A0B0E] px-2.5 py-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-[11px] font-bold uppercase text-white">
                                {address.label || "Address"}
                              </span>
                              {address.isDefault && (
                                <span className="shrink-0 border border-[#00FF66]/30 px-1 py-0.5 text-[8px] font-bold uppercase text-[#00FF66]">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-[11px] text-[#A5AAB8]">{address.street}</p>
                            <p className="text-[10px] text-[#8E929B]">
                              {address.city}, {address.state} - {address.pincode}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {!address.isDefault && (
                              <button
                                type="button"
                                onClick={() => handleSetDefaultAddress(index)}
                                className="text-[9px] font-bold uppercase text-[#00FF66] transition-colors hover:text-white"
                              >
                                Set default
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => startEditAddress(index)}
                              aria-label="Edit address"
                              className="text-[#8E929B] transition-colors hover:text-white"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAddress(index)}
                              aria-label="Delete address"
                              className={`text-[9px] font-bold uppercase transition-colors ${
                                pendingDeleteAddress === index
                                  ? "text-rose-400 hover:text-rose-300"
                                  : "text-[#8E929B] hover:text-rose-400"
                              }`}
                            >
                              {pendingDeleteAddress === index ? "Confirm" : <Trash2 className="h-3 w-3" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {editingAddressIndex !== null && (
                  <form onSubmit={handleSaveAddress} className="space-y-2 border-t border-white/[0.06] pt-2.5">
                    <p className="text-[10px] font-bold uppercase text-white">
                      {editingAddressIndex === "new" ? "Add new address" : "Edit address"}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-[#8E929B]">Label</label>
                        <input
                          type="text"
                          value={addressForm.label ?? ""}
                          onChange={(e) => setAddressForm((prev) => ({ ...prev, label: e.target.value }))}
                          placeholder="Home / Office"
                          className="w-full border border-white/[0.08] bg-[#0A0B0E] px-2.5 py-1.5 text-xs text-white focus:border-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-[#8E929B]">PIN code</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={addressForm.pincode}
                          onChange={(e) => setAddressForm((prev) => ({ ...prev, pincode: e.target.value.replace(/\D/g, "") }))}
                          placeholder="400050"
                          className="w-full border border-white/[0.08] bg-[#0A0B0E] px-2.5 py-1.5 text-xs text-white focus:border-white focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-[#8E929B]">Street address</label>
                      <input
                        type="text"
                        value={addressForm.street}
                        onChange={(e) => setAddressForm((prev) => ({ ...prev, street: e.target.value }))}
                        placeholder="Flat, building, street, area"
                        className="w-full border border-white/[0.08] bg-[#0A0B0E] px-2.5 py-1.5 text-xs text-white focus:border-white focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-[#8E929B]">City</label>
                        <input
                          type="text"
                          value={addressForm.city}
                          onChange={(e) => setAddressForm((prev) => ({ ...prev, city: e.target.value }))}
                          placeholder="Mumbai"
                          className="w-full border border-white/[0.08] bg-[#0A0B0E] px-2.5 py-1.5 text-xs text-white focus:border-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-[#8E929B]">State</label>
                        <input
                          type="text"
                          value={addressForm.state}
                          onChange={(e) => setAddressForm((prev) => ({ ...prev, state: e.target.value }))}
                          placeholder="Maharashtra"
                          className="w-full border border-white/[0.08] bg-[#0A0B0E] px-2.5 py-1.5 text-xs text-white focus:border-white focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        type="submit"
                        disabled={addressSaving}
                        className="inline-flex items-center gap-1.5 bg-[#D9362B] px-3 py-1.5 text-[10px] font-bold uppercase text-white transition-colors hover:bg-[#B82B22] disabled:opacity-50"
                      >
                        {addressSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                        Save address
                      </button>
                      <button
                        type="button"
                        onClick={cancelAddressForm}
                        className="border border-white/[0.08] px-3 py-1.5 text-[10px] font-bold uppercase text-[#8E929B] transition-colors hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Password & security */}
              <div className="border border-white/[0.08] bg-[#11131A] p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-3.5 w-3.5 text-[#00FF66]" />
                    <p className="text-[11px] font-bold uppercase text-white font-sans">Password &amp; security</p>
                  </div>
                  {!isChangingPassword && (
                    <button
                      type="button"
                      onClick={startPasswordChange}
                      className="inline-flex items-center gap-1.5 border border-white/[0.08] px-3 py-1.5 text-[10px] font-bold uppercase text-white transition-colors hover:border-[#D9362B] hover:text-[#D9362B]"
                    >
                      <KeyRound className="h-3 w-3" />
                      {customer?.hasPassword ? "Reset password" : "Set password"}
                    </button>
                  )}
                </div>
                {!isChangingPassword && (
                  <p className="text-[11px] text-[#8E929B]">
                    {customer?.hasPassword
                      ? "Update your login password. WhatsApp OTP login still works."
                      : "You log in via WhatsApp OTP. Set a password to log in directly too."}
                  </p>
                )}
                {profilePassSuccess && <p className="text-[11px] text-[#00FF66]">{profilePassSuccess}</p>}
                {isChangingPassword && (
                  <form onSubmit={handleUpdatePassword} className="space-y-2 pt-1">
                    {customer?.hasPassword && (
                      <label className="block">
                        <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-[#8E929B]">Current password</span>
                        <input
                          type="password"
                          autoComplete="current-password"
                          placeholder="Enter current password"
                          value={profileCurrentPass}
                          onChange={(e) => setProfileCurrentPass(e.target.value)}
                          className="w-full border border-white/[0.08] bg-[#0A0B0E] px-2.5 py-1.5 text-xs text-white transition-colors focus:border-white focus:outline-none"
                        />
                      </label>
                    )}
                    <label className="block">
                      <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-[#8E929B]">New password</span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        placeholder="Min 8 characters, letter + number"
                        value={profileNewPass}
                        onChange={(e) => setProfileNewPass(e.target.value)}
                        className="w-full border border-white/[0.08] bg-[#0A0B0E] px-2.5 py-1.5 text-xs text-white transition-colors focus:border-white focus:outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-[#8E929B]">Confirm new password</span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        placeholder="Re-enter new password"
                        value={profileConfirmPass}
                        onChange={(e) => setProfileConfirmPass(e.target.value)}
                        className="w-full border border-white/[0.08] bg-[#0A0B0E] px-2.5 py-1.5 text-xs text-white transition-colors focus:border-white focus:outline-none"
                      />
                    </label>
                    {profilePassError && <p className="text-[11px] text-[#D9362B]">{profilePassError}</p>}
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={profilePassLoading}
                        className="inline-flex items-center justify-center gap-1.5 bg-[#D9362B] px-3 py-1.5 text-[10px] font-bold uppercase text-white transition-colors hover:bg-[#B82B22] disabled:opacity-50"
                      >
                        {profilePassLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                        Save changes
                      </button>
                      <button
                        type="button"
                        onClick={cancelPasswordChange}
                        className="border border-white/[0.08] px-3 py-1.5 text-[10px] font-bold uppercase text-[#8E929B] transition-colors hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center justify-center gap-2 border border-white/[0.08] bg-[#11131A] py-3 text-[11px] font-bold uppercase tracking-wider text-[#8E929B] transition-colors hover:border-[#D9362B] hover:text-[#D9362B]"
              >
                <LogOut className="h-3.5 w-3.5" />
                Log out
              </button>
            </div>
          )}

        </main>
      </div>

      {/* Floating Add to Bag Notification Toast */}
      {cartToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#11131A] border-2 border-[#00FF66] p-4 shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-3 duration-200 max-w-md">
          <CheckCircle2 className="w-5 h-5 text-[#00FF66] shrink-0" />
          <div className="text-xs flex-1 min-w-0">
            <p className="font-bold text-white uppercase truncate">
              {cartToast.title} (Size {cartToast.size}) added!
            </p>
            <p className="text-[10px] text-[#A5AAB8] mt-0.5">
              100% Sky Cash will unlock on order delivery.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 pl-2 border-l border-white/[0.08]">
            <Link
              href="/cart"
              className="px-3 py-1.5 bg-[#0A0B0E] hover:bg-[rgba(255,255,255,0.08)] border border-white/[0.08] text-white text-[10px] font-bold uppercase transition-colors"
            >
              Bag
            </Link>
            <Link
              href="/checkout"
              className="px-3 py-1.5 bg-[#D9362B] hover:bg-[#B82B22] text-white text-[10px] font-bold uppercase transition-colors"
            >
              Checkout ↘
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
