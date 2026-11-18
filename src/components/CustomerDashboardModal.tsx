"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Wallet,
  ShoppingBag,
  Award,
  Users,
  User,
  Copy,
  Check,
  Share2,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  Smartphone,
  Coins,
  Info,
  Percent,
  Bell,
  MessageCircle,
  Mail,
  Sparkles,
  BellRing,
  Phone,
} from "lucide-react";
import WalletPanel from "@/components/WalletPanel";
import WebPushNotificationPrompt from "@/components/WebPushNotificationPrompt";
import type { StorefrontSnapshot, WithdrawalInput } from "@/lib/contracts";
import type { OrderStatus, ShopOrder, ZeninNotification } from "@/lib/domain";
import type { WithdrawalRequest, ReferralMilestoneConfig, ReferralRewardClaim } from "@/data/rewardsEngine";
import { REFERRAL_MILESTONES } from "@/data/rewardsEngine";
import { dateLabel, dateTimeLabel, formatRupees } from "@/lib/domain";
import { cashbackTotals } from "@/lib/vesting";
import { api } from "@/lib/client";
import { copyText } from "@/lib/clipboard";

type Tab = "orders" | "wallet" | "notifications" | "rewards" | "affiliate" | "profile";

interface CustomerDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab: Tab;
  snapshot: StorefrontSnapshot | null;
  onSubmitWithdrawal: (input: WithdrawalInput) => Promise<void>;
  onClaimCashback?: (options?: { orderId?: string; week?: number }) => Promise<void>;
}


const ORDER_TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "orders", label: "Orders", icon: ShoppingBag },
  { id: "wallet", label: "Wallet", icon: Wallet },
  { id: "notifications", label: "Alerts", icon: Bell },
  { id: "rewards", label: "Rewards", icon: Award },
  { id: "affiliate", label: "Affiliate", icon: Users },
  { id: "profile", label: "Profile", icon: User },
];

function statusLabel(status: OrderStatus): string {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "APPROVED":
      return "Approved";
    case "PRINTING_POD":
      return "Printing at POD";
    case "MANIFEST_GENERATED":
      return "Manifest Generated";
    case "SHIPPED":
      return "In Transit";
    case "LOCAL_AREA":
      return "In Local Area";
    case "DELIVERED":
      return "Delivered";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

function statusClasses(status: OrderStatus): string {
  switch (status) {
    case "DELIVERED":
      return "bg-[#00FF66]/15 text-[#00FF66] border-[#00FF66]/40";
    case "SHIPPED":
      return "bg-[#00F0FF]/15 text-[#00F0FF] border-[#00F0FF]/40";
    case "PRINTING_POD":
      return "bg-amber-400/20 text-amber-300 border-amber-400/40";
    case "MANIFEST_GENERATED":
      return "bg-indigo-400/15 text-indigo-300 border-indigo-400/40";
    case "LOCAL_AREA":
      return "bg-teal-400/15 text-teal-300 border-teal-400/40";
    case "APPROVED":
      return "bg-white/10 text-white border-[#282C34]";
    case "CANCELLED":
      return "bg-rose-500/20 text-rose-400 border-rose-500/40";
    case "PENDING":
    default:
      return "bg-[#0B0C10] text-[#A0A5B5] border-[#282C34]";
  }
}

function referralStatusClasses(status: WithdrawalRequest["overallStatus"] | "PENDING" | "APPROVED" | "PAID"): string {
  if (status === "PAID" || status === "COMPLETED") return "bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/40";
  if (status === "APPROVED") return "bg-amber-400/20 text-amber-300 border border-amber-400/40";
  if (status === "REJECTED") return "bg-rose-500/20 text-rose-400 border border-rose-500/40";
  return "bg-[#0B0C10] text-[#A0A5B5] border border-[#282C34]";
}

function CashbackLine({ order }: { order: ShopOrder }) {
  if (order.status === "CANCELLED") {
    return (
      <div className="text-[11px] text-rose-400 font-mono">
        Cashback voided — cancelled order earns no coins
      </div>
    );
  }

  const totals = cashbackTotals(order.cashback);

  if (order.paymentStatus !== "PAID") {
    return (
      <div className="text-[11px] text-amber-300 font-mono">
        +{order.cashbackCoins} coins cashback · one quarter arrives upon courier payment
      </div>
    );
  }

  if (!totals.nextSlice) {
    return (
      <div className="text-[11px] text-[#00FF66] font-mono">
        +{order.cashbackCoins} coins cashback · all 30 daily parts arrived
      </div>
    );
  }

  return (
    <div className="text-[11px] font-mono">
      <span className="text-[#00FF66]">+{totals.releasedCoins} coins unlocked</span>
      <span className="text-[#8E929B]">
        {" "}
        of {order.cashbackCoins} · next {totals.nextSlice.coins} coins on {totals.nextSlice.dueDate}
      </span>
    </div>
  );
}

function OrderCard({ order }: { order: ShopOrder }) {
  return (
    <div className="rounded-none border border-[#282C34] bg-[#16181D] p-4 sm:p-5 space-y-4 text-[#F5F5F7]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-[#282C34]">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8E929B] font-mono">Order</div>
          <div className="text-base font-black font-mono">
            #{order.orderNumber}
            <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-[#8E929B]">
              {order.kind === "SALE" ? "Purchase" : order.kind === "GIFT" ? "Complimentary" : "Replacement"}
            </span>
          </div>
          <div className="text-[11px] text-[#8E929B] mt-0.5 font-mono">Placed on {dateLabel(order.placedAt)}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-none border px-2.5 py-1 text-[11px] font-mono font-bold uppercase ${statusClasses(order.status)}`}>
            {order.status === "SHIPPED" ? (
              <Truck className="h-3.5 w-3.5" />
            ) : order.status === "DELIVERED" ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : order.status === "CANCELLED" ? (
              <AlertCircle className="h-3.5 w-3.5" />
            ) : (
              <Clock className="h-3.5 w-3.5" />
            )}
            {statusLabel(order.status)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs font-mono">
        <div className="space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8E929B]">Line items</div>
          <ul className="space-y-1.5">
            {order.items.map((line, idx) => (
              <li key={`${order.id}-line-${idx}`} className="flex items-baseline justify-between gap-2 border-b border-[#282C34]/40 pb-1">
                <div className="min-w-0">
                  <div className="font-bold truncate text-[#F5F5F7]">{line.title}</div>
                  <div className="text-[11px] text-[#8E929B]">
                    {line.size} · {line.color} · Qty {line.quantity}
                  </div>
                </div>
                <div className="font-mono font-bold shrink-0 text-[#F5F5F7]">{formatRupees(line.price * line.quantity)}</div>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-1 text-xs sm:text-right">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8E929B]">Payment</div>
          <div>Total paid: <span className="font-black text-[#00FF66]">{formatRupees(order.total)}</span></div>
          <div className="text-[11px] text-[#A0A5B5]">{order.paymentMethod} · {order.paymentStatus}</div>
          {order.courier && order.trackingNumber && (
            <div className="text-[11px] font-mono text-[#A0A5B5]">
              <span className="text-[#8E929B]">Courier </span>
              <span className="font-bold text-[#F5F5F7]">{order.courier}</span>
              <span className="text-[#8E929B]"> · </span>
              <span className="font-bold text-[#F5F5F7]">{order.trackingNumber}</span>
            </div>
          )}
          {order.cashbackCoins > 0 && <CashbackLine order={order} />}
        </div>
      </div>

      {order.timeline.length > 0 && (
        <div className="pt-3 border-t border-[#282C34]">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8E929B] mb-2 font-mono">Journey</div>
          <ol className="relative space-y-3 pl-4">
            <span className="absolute left-1 top-1 bottom-1 w-px bg-[#282C34]" aria-hidden="true" />
            {order.timeline.map((ev, idx) => {
              const isLast = idx === order.timeline.length - 1;
              return (
                <li key={`${order.id}-tl-${idx}`} className="relative">
                  <span
                    className={`absolute -left-[13px] top-1 h-2.5 w-2.5 rounded-none border ${
                      isLast ? "bg-[#00FF66] border-[#00FF66]" : "bg-[#282C34] border-[#8E929B]"
                    }`}
                    aria-hidden="true"
                  />
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#F5F5F7]">
                      {ev.label}
                    </div>
                    <div className="text-[10px] text-[#8E929B] font-mono">{dateTimeLabel(ev.at)}</div>
                  </div>
                  <div className="text-[11px] text-[#A0A5B5]">{ev.note}</div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

export default function CustomerDashboardModal({
  isOpen,
  onClose,
  initialTab,
  snapshot,
  onSubmitWithdrawal,
  onClaimCashback,
}: CustomerDashboardModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [formError, setFormError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const [referralUrl, setReferralUrl] = useState("");
  const [notifications, setNotifications] = useState<ZeninNotification[]>(snapshot?.notifications ?? []);

  useEffect(() => {
    setNotifications(snapshot?.notifications ?? []);
  }, [snapshot?.notifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkNotificationRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true, channelStatus: { ...n.channelStatus, inApp: "READ" } } : n))
    );
    try {
      await api.notifications.markRead(id);
    } catch (e) {
      console.error("Failed to mark notification read", e);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true, channelStatus: { ...n.channelStatus, inApp: "READ" } }))
    );
    try {
      await api.notifications.markAllRead();
    } catch (e) {
      console.error("Failed to mark all notifications read", e);
    }
  };

  const customer = snapshot?.customer ?? null;
  const rewardRules = snapshot?.rewardRules;

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
    setFormError(null);
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setReferralUrl(`${window.location.origin}/register?ref=${customer?.referralCode ?? ""}`);
    }
  }, [customer?.referralCode]);

  const [claimingMilestone, setClaimingMilestone] = useState<ReferralMilestoneConfig | null>(null);
  const [claimAddress, setClaimAddress] = useState({
    recipientName: customer?.name ?? "",
    phone: customer?.phone ?? "",
    address: customer?.addresses?.find((a) => a.isDefault)?.street ?? "",
    city: customer?.addresses?.find((a) => a.isDefault)?.city ?? "",
    state: customer?.addresses?.find((a) => a.isDefault)?.state ?? "",
    pincode: customer?.addresses?.find((a) => a.isDefault)?.pincode ?? "",
  });
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
  const [claimedRewards, setClaimedRewards] = useState<ReferralRewardClaim[]>(
    customer?.claimedReferralRewards ?? []
  );
  const [claimSuccessMessage, setClaimSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (customer?.claimedReferralRewards) {
      setClaimedRewards(customer.claimedReferralRewards);
    }
  }, [customer?.claimedReferralRewards]);

  const handleClaimMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimingMilestone) return;

    if (!claimAddress.recipientName.trim()) {
      setFormError("Recipient name is required");
      return;
    }
    if (!claimAddress.phone.trim() || claimAddress.phone.trim().length < 10) {
      setFormError("Valid 10-digit mobile number is required");
      return;
    }
    if (!claimAddress.address.trim() || claimAddress.address.trim().length < 8) {
      setFormError("Detailed delivery address is required");
      return;
    }
    if (!claimAddress.city.trim() || !claimAddress.state.trim()) {
      setFormError("City and State are required");
      return;
    }
    if (!/^\d{6}$/.test(claimAddress.pincode.trim())) {
      setFormError("Valid 6-digit PIN code is required");
      return;
    }

    setIsSubmittingClaim(true);
    setFormError(null);
    try {
      const res = await api.claimReferralReward({
        milestoneId: claimingMilestone.id,
        recipientName: claimAddress.recipientName.trim(),
        phone: claimAddress.phone.trim(),
        address: claimAddress.address.trim(),
        city: claimAddress.city.trim(),
        state: claimAddress.state.trim(),
        pincode: claimAddress.pincode.trim(),
      });
      if (res?.claim) {
        setClaimedRewards((prev) => [...prev, res.claim]);
        setClaimSuccessMessage(`🎉 ${claimingMilestone.title} claimed! Dispatch details logged.`);
        setClaimingMilestone(null);
      }
    } catch (err: any) {
      setFormError(err.message || "Failed to submit milestone claim");
    } finally {
      setIsSubmittingClaim(false);
    }
  };

  if (!isOpen) return null;



  const totalReferralCommission = (snapshot?.referrals ?? []).reduce(
    (sum, r) => sum + r.commissionCoins,
    0
  );
  const approvedCommission = (snapshot?.referrals ?? [])
    .filter((r) => r.status === "APPROVED" || r.status === "PAID")
    .reduce((sum, r) => sum + r.commissionCoins, 0);

  const handleCopy = async (kind: "link" | "code", value: string) => {
    const copied = await copyText(value);
    if (!copied) {
      setFormError("Clipboard blocked by the browser — long-press the field to copy manually.");
      return;
    }
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  };


  const orders = snapshot?.orders ?? [];
  const referrals = snapshot?.referrals ?? [];


  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Customer dashboard"
        className="relative flex w-full max-h-[90dvh] flex-col overflow-hidden rounded-none border border-[#282C34] bg-[#0B0C10] text-[#F5F5F7] shadow-2xl zenin-sheet sm:max-w-4xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[#282C34] bg-[#16181D] px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 shrink-0 rounded-none bg-[#0B0C10] border border-[#282C34] text-[#00FF66] flex items-center justify-center font-black font-mono text-base">
              {(customer?.name ?? "Z").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-black tracking-tight truncate text-[#F5F5F7]">
                  {customer?.name ?? "Guest"}
                </h2>
                {customer && (
                  <span className="rounded-none border border-[#00FF66]/40 bg-[#00FF66]/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-[#00FF66]">
                    {customer.tier.toUpperCase()} MEMBER
                  </span>
                )}
              </div>
              {customer ? (
                <p className="text-[11px] font-mono text-[#8E929B] truncate">
                  {customer.email} · Code {customer.referralCode}
                </p>
              ) : (
                <p className="text-[11px] font-mono text-[#8E929B]">
                  Session inactive — sign in to load your snapshot.
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setActiveTab("notifications")}
              aria-label="View alerts and notifications"
              className={`relative min-h-[44px] w-11 rounded-none flex items-center justify-center transition-colors border border-transparent ${
                activeTab === "notifications" ? "bg-[#0B0C10] text-[#00FF66] border-[#282C34]" : "text-[#8E929B] hover:text-white hover:bg-[#282C34]"
              }`}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                  <span className="relative inline-flex rounded-none h-2 w-2 bg-[#00FF66]"></span>
                </span>
              )}
            </button>
            <button
              onClick={onClose}
              aria-label="Close dashboard"
              className="min-h-[44px] w-11 rounded-none text-[#8E929B] hover:text-white hover:bg-[#282C34] flex items-center justify-center"
            >
              <X className="mx-auto h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-[#282C34] bg-[#0B0C10] px-2 no-scrollbar">
          {ORDER_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const badge =
              tab.id === "wallet" && customer
                ? `${customer.availableCoins}`
                : tab.id === "orders" && snapshot
                ? `${orders.length}`
                : tab.id === "notifications"
                ? (unreadCount > 0 ? `${unreadCount} new` : null)
                : tab.id === "affiliate" && rewardRules
                ? `${rewardRules.referralCommissionPercent}%`
                : null;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-[11px] font-mono font-bold uppercase tracking-wider transition-all min-h-[44px] rounded-none ${
                  isActive
                    ? "border-[#00FF66] text-[#00FF66] bg-[#16181D]"
                    : "border-transparent text-[#8E929B] hover:text-white hover:bg-[#16181D]/50"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {badge && (
                  <span
                    className={`ml-1 rounded-none px-1.5 py-0.5 text-[10px] font-mono ${
                      tab.id === "notifications" && unreadCount > 0
                        ? "bg-[#00FF66] text-[#0B0C10] font-black"
                        : isActive
                        ? "bg-[#00FF66]/20 text-[#00FF66] border border-[#00FF66]/40"
                        : "bg-[#16181D] text-[#8E929B] border border-[#282C34]"
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-[#0B0C10] p-4 sm:p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {formError && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-none border border-rose-500/40 bg-rose-500/10 p-3 text-xs font-mono text-rose-400"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}
          {!snapshot || !customer ? (
            <div className="rounded-none border border-[#282C34] bg-[#16181D] p-8 text-center">
              <Info className="mx-auto h-6 w-6 text-[#8E929B]" />
              <p className="mt-2 text-sm font-bold text-[#F5F5F7]">You are not signed in yet</p>
              <p className="mt-1 text-xs text-[#8E929B] font-mono">
                {snapshot
                  ? "Sign in with your phone number to see your orders, your coins, and the cash payouts we are sending you."
                  : "Your account is loading — give it a second."}
              </p>
            </div>
          ) : !rewardRules ? null : (
            <>
              {/* ORDERS TAB */}
              {activeTab === "orders" && (
                <div className="space-y-4">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-sm font-black uppercase tracking-wider text-[#F5F5F7] font-mono">Order history</h3>
                    <span className="text-[11px] font-mono text-[#8E929B]">{orders.length} orders</span>
                  </div>
                  {orders.length === 0 ? (
                    <div className="rounded-none border border-[#282C34] bg-[#16181D] p-8 text-center text-sm text-[#8E929B] font-mono">
                      No orders on this account yet.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {orders.map((o) => (
                        <OrderCard key={o.id} order={o} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* WALLET TAB */}
              {activeTab === "wallet" && snapshot && (
                <WalletPanel
                  snapshot={snapshot}
                  notifications={notifications}
                  onSubmitWithdrawal={onSubmitWithdrawal}
                  onClaimCashback={onClaimCashback}
                  onViewAlerts={() => setActiveTab("notifications")}
                />
              )}

              {/* NOTIFICATIONS / ALERTS TAB */}
              {activeTab === "notifications" && (
                <div className="space-y-6">
                  {/* Top Notification Summary Card */}
                  <div className="rounded-none border border-[#282C34] bg-[#16181D] p-5 sm:p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.14em] text-[#8E929B]">
                          <span>Multi-Channel Cashback Delivery</span>
                          <span className="inline-block h-1.5 w-1.5 rounded-none bg-[#00FF66]"></span>
                          <span className="text-[#00FF66] font-bold">Active</span>
                        </div>
                        <h3 className="text-xl font-black tracking-tight mt-1 text-[#F5F5F7]">
                          Cashback Unlock & Payout Alerts
                        </h3>
                        <p className="text-xs text-[#A0A5B5] mt-1 max-w-xl font-mono leading-relaxed">
                          Every week when a cashback tranche unlocks into your Live Wallet, alerts are generated across WhatsApp, SMS, Email, and In-App so you never miss your funds.
                        </p>
                      </div>

                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllNotificationsRead}
                          className="self-start sm:self-center px-3 py-1.5 rounded-none border border-[#282C34] bg-[#0B0C10] hover:bg-[#282C34] text-[11px] font-mono font-bold text-[#F5F5F7] transition-colors"
                        >
                          Mark all as read ({unreadCount})
                        </button>
                      )}
                    </div>

                    {/* Channel Indicators */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-[#282C34]">
                      <div className="rounded-none border border-[#282C34] bg-[#0B0C10] p-3 flex items-start gap-3">
                        <div className="h-8 w-8 rounded-none bg-[#00FF66]/10 text-[#00FF66] border border-[#00FF66]/30 flex items-center justify-center shrink-0">
                          <MessageCircle className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold font-mono text-[#F5F5F7]">WhatsApp Alerts</div>
                          <div className="text-[10px] text-[#8E929B] truncate font-mono">{customer.phone}</div>
                          <div className="mt-1 text-[10px] text-[#00FF66] font-mono font-bold">wa.me Instant Links</div>
                        </div>
                      </div>

                      <div className="rounded-none border border-[#282C34] bg-[#0B0C10] p-3 flex items-start gap-3">
                        <div className="h-8 w-8 rounded-none bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30 flex items-center justify-center shrink-0">
                          <Smartphone className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold font-mono text-[#F5F5F7]">Transactional SMS</div>
                          <div className="text-[10px] text-[#8E929B] truncate font-mono">{customer.phone}</div>
                          <div className="mt-1 text-[10px] text-[#00F0FF] font-mono font-bold">160-Char DLT Compliant</div>
                        </div>
                      </div>

                      <div className="rounded-none border border-[#282C34] bg-[#0B0C10] p-3 flex items-start gap-3">
                        <div className="h-8 w-8 rounded-none bg-purple-500/10 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
                          <Mail className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold font-mono text-[#F5F5F7]">Receipt Email</div>
                          <div className="text-[10px] text-[#8E929B] truncate font-mono">{customer.email}</div>
                          <div className="mt-1 text-[10px] text-purple-400 font-mono font-bold">HTML & Plain Text</div>
                        </div>
                      </div>

                      <div className="rounded-none border border-[#282C34] bg-[#0B0C10] p-3 flex items-start gap-3">
                        <div className="h-8 w-8 rounded-none bg-amber-400/10 text-amber-300 border border-amber-400/30 flex items-center justify-center shrink-0">
                          <BellRing className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold font-mono text-[#F5F5F7]">Web Push Alerts</div>
                          <div className="text-[10px] text-[#8E929B] truncate font-mono">Chrome, Edge & Safari</div>
                          <div className="mt-1 text-[10px] text-amber-300 font-mono font-bold">Instant Lock Screen</div>
                        </div>
                      </div>
                    </div>

                    {/* Interactive Web Push Subscription Toggle */}
                    <div className="pt-2">
                      <WebPushNotificationPrompt customerId={customer.id} variant="inline" />
                    </div>
                  </div>

                  {/* Notification List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-[#8E929B] px-1">
                      <span>Recent Alerts ({notifications.length})</span>
                      <span>{unreadCount} unread</span>
                    </div>

                    {notifications.length === 0 ? (
                      <div className="rounded-none border border-[#282C34] bg-[#16181D] p-8 text-center space-y-2">
                        <div className="mx-auto h-12 w-12 rounded-none bg-[#0B0C10] border border-[#282C34] flex items-center justify-center text-[#8E929B]">
                          <Bell className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-bold text-[#F5F5F7]">No notifications yet</p>
                        <p className="text-xs text-[#8E929B] max-w-sm mx-auto font-mono">
                          When you place qualifying orders, your daily cashback unlocks (30-day cycle) and withdrawal updates will be reported here.
                        </p>
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`rounded-none border p-4 sm:p-5 transition-all ${
                            !notif.read
                              ? "border-[#00FF66]/50 bg-[#00FF66]/[0.04]"
                              : "border-[#282C34] bg-[#16181D]"
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="space-y-1.5 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {!notif.read ? (
                                  <span className="rounded-none bg-[#00FF66] text-[#0B0C10] px-1.5 py-0.5 text-[9px] font-mono font-black uppercase tracking-wider">
                                    NEW
                                  </span>
                                ) : (
                                  <span className="rounded-none bg-[#282C34] text-[#8E929B] px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider">
                                    READ
                                  </span>
                                )}
                                <h4 className="text-sm font-black text-[#F5F5F7] tracking-tight">
                                  {notif.title}
                                </h4>
                                <span className="text-[11px] text-[#8E929B] font-mono">
                                  {dateLabel(notif.createdAt)}
                                </span>
                              </div>

                              <p className="text-xs text-[#A0A5B5] leading-relaxed font-mono">
                                {notif.message}
                              </p>

                              {/* Multi-Channel Delivery Badges */}
                              <div className="flex items-center gap-2 pt-2 flex-wrap text-[10px] font-mono">
                                <span className="inline-flex items-center gap-1 rounded-none bg-[#0B0C10] border border-[#00FF66]/30 text-[#00FF66] px-2 py-0.5">
                                  <MessageCircle className="h-3 w-3 text-[#00FF66]" />
                                  WhatsApp Prepared
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-none bg-[#0B0C10] border border-[#00F0FF]/30 text-[#00F0FF] px-2 py-0.5">
                                  <Smartphone className="h-3 w-3 text-[#00F0FF]" />
                                  SMS Logged
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-none bg-[#0B0C10] border border-purple-500/30 text-purple-400 px-2 py-0.5">
                                  <Mail className="h-3 w-3 text-purple-400" />
                                  Email Ready
                                </span>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center sm:flex-col gap-2 shrink-0 pt-2 sm:pt-0">
                              {notif.whatsappUrl && (
                                <a
                                  href={notif.whatsappUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-none border border-[#00FF66]/40 bg-[#00FF66]/10 hover:bg-[#00FF66]/20 text-[#00FF66] text-[11px] font-mono font-bold transition-colors"
                                >
                                  <MessageCircle className="h-3.5 w-3.5" />
                                  <span>WhatsApp</span>
                                  <ArrowUpRight className="h-3 w-3 opacity-60" />
                                </a>
                              )}

                              <button
                                onClick={() => {
                                  onClose();
                                  router.push("/wallet?withdraw=1");
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-none bg-[#00FF66] hover:bg-[#00FF66]/90 text-[#0B0C10] text-[11px] font-mono font-bold transition-colors"
                              >
                                <Wallet className="h-3.5 w-3.5" />
                                <span>Withdraw</span>
                              </button>

                              {!notif.read && (
                                <button
                                  onClick={() => handleMarkNotificationRead(notif.id)}
                                  className="text-[10px] font-mono text-[#8E929B] hover:text-[#F5F5F7] underline px-1 py-1"
                                >
                                  Mark read
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* REWARDS TAB */}
              {activeTab === "rewards" && (
                <div className="space-y-5">
                  <div className="rounded-none border border-[#282C34] bg-[#16181D] p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#8E929B]">Membership tier</div>
                        <div className="text-2xl font-black text-[#F5F5F7] font-mono">{customer.tier}</div>
                      </div>
                      <Award className="h-10 w-10 text-[#00FF66]" />
                    </div>
                    <div className="text-[11px] text-[#A0A5B5] font-mono">
                      Lifetime earned: <strong className="font-mono text-[#00FF66]">{customer.lifetimeEarnedCoins.toLocaleString("en-IN")}</strong> Sky Cash.
                    </div>
                  </div>

                  <div className="rounded-none border border-[#282C34] bg-[#16181D] p-5 space-y-4">
                    <h4 className="text-sm font-black uppercase tracking-wider text-[#F5F5F7] font-mono">How Sky Cash works</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                      <div className="rounded-none border border-[#282C34] bg-[#0B0C10] p-3">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#8E929B] mb-1">
                          <Percent className="h-3.5 w-3.5 text-[#00FF66]" />
                          <span>Cashback on orders</span>
                        </div>
                        <div className="text-lg font-black text-[#00FF66]">Coins per product</div>
                        <div className="text-[11px] text-[#8E929B] font-mono mt-0.5">
                          Every drop carries its own cashback coins, unlocked daily across 30 days from Day 1.
                        </div>
                      </div>
                      <div className="rounded-none border border-[#282C34] bg-[#0B0C10] p-3">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#8E929B] mb-1">
                          <Coins className="h-3.5 w-3.5 text-[#00F0FF]" />
                          <span>Sky Cash Liquidity</span>
                        </div>
                        <div className="text-lg font-black text-[#00F0FF]">100% Withdrawable</div>
                        <div className="text-[11px] text-[#8E929B] font-mono mt-0.5">
                          Direct withdrawals to bank account in coins.
                        </div>
                      </div>
                      <div className="rounded-none border border-[#282C34] bg-[#0B0C10] p-3">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#8E929B] mb-1">
                          <ShoppingBag className="h-3.5 w-3.5 text-amber-400" />
                          <span>Daily release</span>
                        </div>
                        <div className="text-lg font-black text-amber-400">{rewardRules.dailyClaimPercent}% / day</div>
                        <div className="text-[11px] text-[#8E929B] font-mono mt-0.5">
                          A slice of your pending coins moves to the live wallet every day for 30 days.
                        </div>
                      </div>
                      <div className="rounded-none border border-[#282C34] bg-[#0B0C10] p-3">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#8E929B] mb-1">
                          <Users className="h-3.5 w-3.5 text-purple-400" />
                          <span>Affiliate commission</span>
                        </div>
                        <div className="text-lg font-black text-purple-400">{rewardRules.referralCommissionPercent}%</div>
                        <div className="text-[11px] text-[#8E929B] font-mono mt-0.5">
                          Paid as coins the moment a referred friend pays.
                        </div>
                      </div>
                    </div>

                    <div className="rounded-none border border-[#00FF66]/40 bg-[#00FF66]/10 p-3 flex items-start gap-2 text-[11px] font-mono text-[#00FF66]">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <div>
                        <strong className="block text-[#00FF66] font-bold">Daily Cashback Unlock (30-Day Cycle)</strong>
                        100% of your earned cashback is credited to your Pending Cashback on purchase. It unlocks daily across a 30-day month cycle, starting on Day 1 immediately upon payment confirmation directly into your Live Wallet, where it is immediately eligible for same-day withdrawal.
                      </div>
                    </div>

                    <div className="text-[10px] text-[#8E929B] font-mono uppercase tracking-widest">
                      Daily release · {rewardRules.dailyClaimPercent}% — Affiliate · {rewardRules.referralCommissionPercent}% in coins
                    </div>
                  </div>
                </div>
              )}

              {/* AFFILIATE TAB */}
              {activeTab === "affiliate" && (
                <div className="space-y-5">
                  <div className="rounded-none border border-[#282C34] bg-[#16181D] p-5 space-y-4">
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#8E929B]">
                        Skywear affiliate program
                      </div>
                      <h4 className="text-xl font-black tracking-tight mt-1 text-[#F5F5F7]">
                        Share style. Earn {rewardRules.referralCommissionPercent}% cash on every friend.
                      </h4>
                      <p className="text-xs text-[#A0A5B5] mt-1 font-mono">
                        Commissions land in your wallet as coins when a referred friend pays. Your friend
                        earns their own cashback coins, set per product, on the store&apos;s release rules.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                      <div className="flex-1 truncate rounded-none border border-[#282C34] bg-[#0B0C10] px-3 py-2.5 font-mono text-xs text-[#00FF66]">
                        {referralUrl}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCopy("link", referralUrl)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-none bg-[#F5F5F7] px-3 py-2.5 text-xs font-mono font-bold text-[#0B0C10] hover:bg-[#00FF66] transition-colors min-h-[44px]"
                        >
                          {copied === "link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          <span>{copied === "link" ? "Copied" : "Copy link"}</span>
                        </button>
                        <a
                          href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                            `Check out Skywear heavyweight streetwear. Use my code ${customer.referralCode}: ${referralUrl}`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 rounded-none bg-[#00FF66] px-3 py-2.5 text-xs font-mono font-bold text-[#0B0C10] hover:bg-[#00FF66]/90 transition-colors min-h-[44px]"
                        >
                          <Share2 className="h-4 w-4" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                    <div className="rounded-none border border-[#282C34] bg-[#16181D] p-3">
                      <div className="text-[10px] uppercase tracking-wider text-[#8E929B]">Referred</div>
                      <div className="mt-1 text-2xl font-black text-[#F5F5F7]">{referrals.length}</div>
                      <div className="text-[10px] text-[#8E929B]">Leads on file</div>
                    </div>
                    <div className="rounded-none border border-[#282C34] bg-[#16181D] p-3">
                      <div className="text-[10px] uppercase tracking-wider text-[#8E929B]">Converted</div>
                      <div className="mt-1 text-2xl font-black text-[#00FF66]">
                        {referrals.filter((r) => r.orderNumber).length}
                      </div>
                      <div className="text-[10px] text-[#8E929B]">Friends who ordered</div>
                    </div>
                    <div className="rounded-none border border-[#282C34] bg-[#16181D] p-3">
                      <div className="text-[10px] uppercase tracking-wider text-[#8E929B]">Lifetime commission</div>
                      <div className="mt-1 text-2xl font-black text-[#F5F5F7]">
                        {Math.round(totalReferralCommission).toLocaleString("en-IN")} Coins
                      </div>
                      <div className="text-[10px] text-[#8E929B]">All statuses</div>
                    </div>
                    <div className="rounded-none border border-[#282C34] bg-[#16181D] p-3">
                      <div className="text-[10px] uppercase tracking-wider text-[#8E929B]">Settled</div>
                      <div className="mt-1 text-2xl font-black text-amber-300">
                        {Math.round(approvedCommission).toLocaleString("en-IN")} Coins
                      </div>
                      <div className="text-[10px] text-[#8E929B]">Approved + paid</div>
                    </div>
                  </div>

                  {/* REFERRAL MEGA MILESTONES (IPHONE 17 PRO MAX) */}
                  <div className="rounded-none border border-[#00FF66]/40 bg-[#0B0C10] p-4 sm:p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#282C34] pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#00FF66]">
                            AMBASSADOR MEGA MILESTONES
                          </span>
                          <span className="bg-[#00FF66]/20 border border-[#00FF66]/40 text-[#00FF66] text-[9px] font-mono font-black px-2 py-0.5 uppercase">
                            PHYSICAL REWARDS GUARANTEED
                          </span>
                        </div>
                        <h4 className="text-base sm:text-lg font-black tracking-tight text-[#F5F5F7] mt-0.5 font-mono">
                          Refer Friends to Buy &amp; Unlock a Free Apple Flagship
                        </h4>
                        <p className="text-xs text-[#8E929B] font-mono mt-0.5">
                          Get 100 friends to purchase ➔ Win an Apple iPhone 17 Pro Max!
                        </p>
                      </div>
                      <div className="shrink-0 bg-[#16181D] border border-[#282C34] px-3 py-1.5 font-mono text-left sm:text-right">
                        <div className="text-[10px] uppercase text-[#8E929B]">Your Converted Orders</div>
                        <div className="text-lg font-black text-[#00FF66]">
                          {referrals.filter((r) => r.orderNumber).length} <span className="text-xs text-[#8E929B] font-normal">Orders</span>
                        </div>
                      </div>
                    </div>

                    {claimSuccessMessage && (
                      <div className="p-3 bg-[#00FF66]/10 border border-[#00FF66]/40 text-[#00FF66] text-xs font-mono flex items-center gap-2">
                        <Check className="w-4 h-4 shrink-0" />
                        <span>{claimSuccessMessage}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-4">
                      {/* IPHONE 17 PRO MAX */}
                      {(() => {
                        const milestone = REFERRAL_MILESTONES[0];
                        const convertedCount = referrals.filter((r) => r.orderNumber).length;
                        const isClaimed = claimedRewards.some((c) => c.milestoneId === milestone.id);
                        const isUnlocked = convertedCount >= milestone.targetCount;
                        const pct = Math.min(100, Math.round((convertedCount / milestone.targetCount) * 100));
                        const remaining = Math.max(0, milestone.targetCount - convertedCount);

                        return (
                          <div
                            key={milestone.id}
                            className={`rounded-none border p-4 font-mono relative flex flex-col justify-between ${
                              isClaimed
                                ? "border-[#00FF66]/50 bg-[#16181D]"
                                : isUnlocked
                                ? "border-emerald-400/60 bg-[#16181D] shadow-[0_0_15px_rgba(0,255,102,0.2)]"
                                : "border-[#282C34] bg-[#16181D]"
                            }`}
                          >
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-10 h-10 border border-[#00FF66]/40 bg-[#00FF66]/10 text-[#00FF66] flex items-center justify-center text-xl shrink-0 font-bold">
                                    📱
                                  </div>
                                  <div>
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#00FF66] bg-[#00FF66]/10 border border-[#00FF66]/30 px-1.5 py-0.5">
                                      {milestone.badge}
                                    </span>
                                    <h5 className="text-sm font-black text-white mt-1 leading-snug">
                                      {milestone.title}
                                    </h5>
                                  </div>
                                </div>
                                <span className="text-[10px] text-[#00FF66] font-bold bg-[#0B0C10] border border-[#282C34] px-2 py-0.5 shrink-0">
                                  ₹1,59,900 Value
                                </span>
                              </div>

                              <p className="text-[11px] text-[#8E929B] leading-relaxed">
                                {milestone.subtitle}
                              </p>

                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="text-white font-bold">
                                    {convertedCount} / {milestone.targetCount} Friend Orders
                                  </span>
                                  <span className={isUnlocked ? "text-[#00FF66] font-bold" : "text-[#8E929B]"}>
                                    {isClaimed
                                      ? "Claimed"
                                      : isUnlocked
                                      ? "100% Unlocked!"
                                      : `${remaining} more friend purchases needed`}
                                  </span>
                                </div>
                                <div className="h-2 w-full bg-[#0B0C10] border border-[#282C34]">
                                  <div
                                    className="h-full bg-[#00FF66] transition-all duration-300"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="pt-3 mt-3 border-t border-[#282C34]">
                              {isClaimed ? (
                                <div className="w-full py-2 bg-[#00FF66]/15 border border-[#00FF66]/40 text-[#00FF66] text-xs font-bold text-center flex items-center justify-center gap-1.5">
                                  <Check className="w-4 h-4" />
                                  <span>REWARD CLAIMED — DISPATCH PENDING</span>
                                </div>
                              ) : isUnlocked ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormError(null);
                                    setClaimingMilestone(milestone);
                                  }}
                                  className="w-full py-2.5 bg-[#00FF66] hover:bg-[#00FF66]/90 text-[#0B0C10] text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(0,255,102,0.4)]"
                                >
                                  <Sparkles className="w-4 h-4" />
                                  <span>CLAIM IPHONE 17 PRO MAX NOW</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled
                                  className="w-full py-2 bg-[#0B0C10] border border-[#282C34] text-[#8E929B] text-xs font-bold uppercase tracking-wider opacity-60 cursor-not-allowed"
                                >
                                  LOCKED ({remaining} MORE ORDERS NEEDED)
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="rounded-none border border-[#282C34] bg-[#16181D] p-4 sm:p-5">
                    <h4 className="text-sm font-black uppercase tracking-wider mb-3 text-[#F5F5F7] font-mono">Referral ledger</h4>
                    {referrals.length === 0 ? (
                      <p className="text-xs text-[#8E929B] font-mono text-center py-6">No referrals yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px] font-mono">
                          <thead className="text-[#8E929B] border-b border-[#282C34]">
                            <tr>
                              <th className="py-2 pr-2">Friend</th>
                              <th className="py-2 pr-2">Joined</th>
                              <th className="py-2 pr-2">Order</th>
                              <th className="py-2 pr-2 text-right">Order value</th>
                              <th className="py-2 pr-2 text-right">Commission</th>
                              <th className="py-2 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#282C34]/40">
                            {referrals.map((r) => (
                              <tr key={r.id} className="hover:bg-[#282C34]/30">
                                <td className="py-2.5 pr-2 font-mono font-bold text-[#F5F5F7]">
                                  {r.friendName}
                                  {r.friendPhone && (
                                    <div className="text-[10px] font-mono text-[#00FF66] font-semibold flex items-center gap-1 mt-0.5">
                                      <Phone className="w-2.5 h-2.5 text-[#00FF66]" />
                                      <span>{r.friendPhone}</span>
                                    </div>
                                  )}
                                  {r.friendEmail && (
                                    <div className="text-[10px] font-mono text-[#8E929B]">{r.friendEmail}</div>
                                  )}
                                </td>
                                <td className="py-2.5 pr-2 text-[#A0A5B5]">{r.dateJoined}</td>
                                <td className="py-2.5 pr-2 text-[#A0A5B5]">{r.orderNumber ?? "—"}</td>
                                <td className="py-2.5 pr-2 text-right text-[#F5F5F7]">
                                  {r.orderAmountInr ? formatRupees(r.orderAmountInr) : "—"}
                                </td>
                                <td className="py-2.5 pr-2 text-right font-bold text-[#00FF66]">
                                  {r.commissionCoins > 0 ? `${Math.round(r.commissionCoins).toLocaleString("en-IN")} Coins` : "—"}
                                </td>
                                <td className="py-2.5 text-right">
                                  <span className={`rounded-none px-1.5 py-0.5 text-[10px] font-bold ${referralStatusClasses(r.status)}`}>
                                    {r.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* PROFILE TAB */}
              {activeTab === "profile" && (
                <div className="space-y-5">
                  <div className="rounded-none border border-[#282C34] bg-[#16181D] p-4 sm:p-5 space-y-4">
                    <h4 className="text-sm font-black uppercase tracking-wider text-[#F5F5F7] font-mono">Personal information</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-[#8E929B] mb-1">Full name</div>
                        <div className="rounded-none border border-[#282C34] bg-[#0B0C10] px-3 py-2.5 min-h-[44px] flex items-center text-[#F5F5F7]">
                          {customer.name}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-[#8E929B] mb-1">Email</div>
                        <div className="rounded-none border border-[#282C34] bg-[#0B0C10] px-3 py-2.5 min-h-[44px] flex items-center break-all text-[#F5F5F7]">
                          {customer.email}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-[#8E929B] mb-1">Phone</div>
                        <div className="rounded-none border border-[#282C34] bg-[#0B0C10] px-3 py-2.5 min-h-[44px] flex items-center text-[#F5F5F7]">
                          {customer.phone}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-[#8E929B] mb-1">Referral code</div>
                        <div className="flex items-center justify-between gap-2 rounded-none border border-[#282C34] bg-[#0B0C10] px-3 py-2.5 min-h-[44px]">
                          <span className="font-black text-[#00FF66]">{customer.referralCode}</span>
                          <button
                            onClick={() => handleCopy("code", customer.referralCode)}
                            aria-label="Copy referral code"
                            className="rounded-none p-1.5 text-[#8E929B] hover:text-[#00FF66] hover:bg-[#282C34] min-h-[32px]"
                          >
                            {copied === "code" ? (
                              <Check className="h-4 w-4 text-[#00FF66]" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-[#8E929B] mb-1">Tier</div>
                        <div className="rounded-none border border-[#00FF66]/40 bg-[#00FF66]/10 px-3 py-2.5 min-h-[44px] flex items-center font-black text-[#00FF66]">
                          {customer.tier}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-[#8E929B] mb-1">Wallet</div>
                        <div className="rounded-none border border-[#282C34] bg-[#0B0C10] px-3 py-2.5 min-h-[44px] flex items-center justify-between font-mono">
                          <span className="font-bold text-[#F5F5F7]">{(customer.availableCoins ?? 0).toLocaleString("en-IN")} Coins</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-none border border-[#282C34] bg-[#16181D] p-4 sm:p-5 space-y-4">
                    <h4 className="text-sm font-black uppercase tracking-wider text-[#F5F5F7] font-mono">Saved shipping addresses</h4>
                    {customer.addresses.length === 0 ? (
                      <p className="text-xs text-[#8E929B] font-mono">No saved addresses yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                        {customer.addresses.map((addr, idx) => (
                          <div
                            key={`${customer.id}-addr-${idx}`}
                            className={`rounded-none border p-3 ${
                              addr.isDefault ? "border-[#00FF66]/50 bg-[#00FF66]/10" : "border-[#282C34] bg-[#0B0C10]"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-mono font-bold uppercase tracking-wider text-[10px] text-[#F5F5F7]">{addr.label}</span>
                              {addr.isDefault && (
                                <span className="rounded-none border border-[#00FF66]/50 bg-[#00FF66]/20 px-1.5 py-0.5 text-[9px] font-mono font-bold text-[#00FF66]">
                                  DEFAULT
                                </span>
                              )}
                            </div>
                            <p className="text-[#F5F5F7]">{addr.street}</p>
                            <p className="text-[#8E929B] mt-0.5">
                              {addr.city}, {addr.state} — {addr.pincode}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* MILESTONE CLAIM MODAL */}
      {claimingMilestone && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#16181D] border border-[#00FF66] p-6 space-y-4 font-mono text-[#F5F5F7] shadow-[0_0_40px_rgba(0,255,102,0.25)]">
            <div className="flex items-start justify-between border-b border-[#282C34] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#00FF66]">
                  OFFICIAL MILESTONE CLAIM
                </span>
                <h3 className="text-lg font-black text-white mt-0.5">
                  Claim {claimingMilestone.title}
                </h3>
                <p className="text-xs text-[#8E929B] mt-0.5">
                  Confirm your shipping address for 100% free doorstep delivery across India
                </p>
              </div>
              <button
                type="button"
                onClick={() => setClaimingMilestone(null)}
                className="text-neutral-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleClaimMilestone} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#8E929B] uppercase mb-1">
                  Recipient Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={claimAddress.recipientName}
                  onChange={(e) => setClaimAddress({ ...claimAddress, recipientName: e.target.value })}
                  placeholder="e.g. Aman Sharma"
                  className="w-full bg-[#0B0C10] border border-[#282C34] focus:border-[#00FF66] p-2.5 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#8E929B] uppercase mb-1">
                  Mobile Number (For Courier Delivery Call) *
                </label>
                <input
                  type="tel"
                  required
                  value={claimAddress.phone}
                  onChange={(e) => setClaimAddress({ ...claimAddress, phone: e.target.value })}
                  placeholder="e.g. 9876543210"
                  className="w-full bg-[#0B0C10] border border-[#282C34] focus:border-[#00FF66] p-2.5 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#8E929B] uppercase mb-1">
                  Street Address &amp; House / Flat No. *
                </label>
                <textarea
                  required
                  rows={2}
                  value={claimAddress.address}
                  onChange={(e) => setClaimAddress({ ...claimAddress, address: e.target.value })}
                  placeholder="e.g. Flat 402, Skyline Residency, Linking Road, Bandra West"
                  className="w-full bg-[#0B0C10] border border-[#282C34] focus:border-[#00FF66] p-2.5 text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-[#8E929B] uppercase mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={claimAddress.city}
                    onChange={(e) => setClaimAddress({ ...claimAddress, city: e.target.value })}
                    placeholder="Mumbai"
                    className="w-full bg-[#0B0C10] border border-[#282C34] focus:border-[#00FF66] p-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#8E929B] uppercase mb-1">State *</label>
                  <input
                    type="text"
                    required
                    value={claimAddress.state}
                    onChange={(e) => setClaimAddress({ ...claimAddress, state: e.target.value })}
                    placeholder="Maharashtra"
                    className="w-full bg-[#0B0C10] border border-[#282C34] focus:border-[#00FF66] p-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#8E929B] uppercase mb-1">PIN Code *</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={claimAddress.pincode}
                    onChange={(e) => setClaimAddress({ ...claimAddress, pincode: e.target.value })}
                    placeholder="400050"
                    className="w-full bg-[#0B0C10] border border-[#282C34] focus:border-[#00FF66] p-2 text-white outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setClaimingMilestone(null)}
                  className="px-4 py-2 bg-[#0B0C10] border border-[#282C34] hover:text-white text-[#8E929B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingClaim}
                  className="px-5 py-2 bg-[#00FF66] hover:bg-[#00FF66]/90 text-[#0B0C10] font-black uppercase flex items-center gap-1.5"
                >
                  {isSubmittingClaim ? "Submitting Claim..." : "Confirm & Ship My Reward"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
