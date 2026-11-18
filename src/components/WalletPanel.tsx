"use client";

import { useState, useMemo } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  Coins,
  Copy,
  Gift,
  Landmark,
  Loader2,
  Share2,
  Smartphone,
  X,
} from "lucide-react";
import type {
  WalletTransaction,
  WithdrawalRequest,
  BankAccount,
} from "@/data/rewardsEngine";
import type { StorefrontSnapshot, WithdrawalInput } from "@/lib/contracts";
import type { ShopOrder, ZeninNotification } from "@/lib/domain";
import { dateLabel, dateTimeLabel, errorMessage, formatRupees } from "@/lib/domain";
import { cashbackTotals } from "@/lib/vesting";
import { api } from "@/lib/client";
import { copyText } from "@/lib/clipboard";
import BankSelect from "@/components/BankSelect";
import { triggerHapticFeedback } from "@/lib/haptics";

const UPI_RE = /^[\w.-]{2,256}@[a-zA-Z]{2,64}$/;
const BANK_ACCT_RE = /^\d{9,18}$/;
const IFSC_RE = /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/;

const CARD = "rounded-lg border border-white/[0.08] bg-[#11131A]";
const INPUT =
  "w-full rounded-md border border-white/10 bg-[#0A0B0E] px-3 py-2 text-sm text-white placeholder-[#6B6F7A] focus:border-[#D9362B] focus:outline-none";
const PRIMARY_BTN =
  "inline-flex items-center justify-center gap-2 rounded-md bg-[#D9362B] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#B82B22] disabled:cursor-not-allowed disabled:opacity-40";
const SECONDARY_BTN =
  "inline-flex items-center justify-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40";

interface WalletPanelProps {
  snapshot: StorefrontSnapshot;
  notifications?: ZeninNotification[];
  onSubmitWithdrawal: (input: WithdrawalInput) => Promise<void>;
  onClaimCashback?: (options?: { orderId?: string; week?: number }) => Promise<void>;
  onAddBankAccount?: (input: {
    accountHolderName: string;
    accountNumber: string;
    confirmAccountNumber: string;
    ifscCode: string;
    bankName: string;
  }) => Promise<void>;
  onRemoveBankAccount?: (id: string) => Promise<void>;
  openWithdrawOnMount?: boolean;
  onViewAlerts?: () => void;
  view?: "wallet" | "withdrawals" | "all";
  onOpenWithdrawals?: () => void;
  initialWithdrawSource?: "referral" | "cashback";
}

function coins(value: number): string {
  return Math.round(value || 0).toLocaleString("en-IN");
}

function plainLedgerLine(description: string): string {
  return description
    .replace(
      /vesting coins released back after the payout desk rejected this request/i,
      "Coins from a cancelled payout returned to your wallet"
    )
    .replace(/vests 25% weekly for 4 weeks/i, "paid out weekly")
    .replace(/^cashback/i, "Cashback");
}

function payoutDestination(request: WithdrawalRequest): string {
  if (request.payoutMethod === "BANK") {
    const last4 = (request.bankAccount ?? "").slice(-4);
    return last4 ? `Bank account ••••${last4}` : "Bank account";
  }
  return request.upiId ? `UPI ${request.upiId}` : "UPI";
}

function withdrawalState(status: WithdrawalRequest["overallStatus"]): {
  label: string;
  dot: string;
  text: string;
} {
  if (status === "PAID" || status === "COMPLETED") {
    return { label: "Paid", dot: "bg-[#00FF66]", text: "text-[#00FF66]" };
  }
  if (status === "REJECTED" || status === "FAILED") {
    return { label: "Rejected", dot: "bg-rose-500", text: "text-rose-400" };
  }
  if (status === "REVERSED") {
    return { label: "Reversed", dot: "bg-orange-400", text: "text-orange-400" };
  }
  return { label: "Processing", dot: "bg-amber-400", text: "text-amber-300" };
}

function withdrawalReference(request: WithdrawalRequest): string | undefined {
  return (
    request.transactionRefNumber ||
    request.tranches.slice().reverse().find((t) => t.upiRef)?.upiRef
  );
}

function SectionHeading({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-2">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      {note ? <p className="mt-0.5 text-xs text-[#8E929B]">{note}</p> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            Cashback release row                            */
/* -------------------------------------------------------------------------- */

function CashbackOrderRow({
  order,
  isClaimedToday,
  onClaimCashback,
  onError,
}: {
  order: ShopOrder;
  isClaimedToday?: boolean;
  onClaimCashback?: (options?: { orderId?: string; week?: number }) => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const totals = cashbackTotals(order.cashback);
  const [claiming, setClaiming] = useState<number | "all" | null>(null);

  const releasedPct =
    order.cashbackCoins > 0
      ? Math.min(100, Math.round((totals.releasedCoins / order.cashbackCoins) * 100))
      : 0;
  const productSummary = order.items.map((i) => i.title).join(", ") || "Streetwear order";
  const hasClaimable = totals.unlockedCoins > 0;
  const isUnverified = order.paymentStatus !== "PAID";
  const slices = order.cashback ?? [];

  const handleClaim = async (week?: number) => {
    if (!onClaimCashback || claiming !== null) return;
    setClaiming(week ?? "all");
    onError(null);
    try {
      await onClaimCashback({ orderId: order.id, week });
      triggerHapticFeedback("coin");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not claim cashback");
    } finally {
      setClaiming(null);
    }
  };

  return (
    <div className={`${CARD} p-3.5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">Order #{order.orderNumber}</p>
          <p className="mt-0.5 truncate text-xs text-[#8E929B]">
            {productSummary} · {dateLabel(order.placedAt)}
          </p>
        </div>
        <div className="shrink-0 whitespace-nowrap text-right leading-tight">
          <p className="text-sm font-bold text-[#00FF66]">
            {coins(totals.releasedCoins)}
            <span className="font-normal text-[#8E929B]"> / {coins(order.cashbackCoins)}</span>
          </p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[#8E929B]">coins claimed</p>
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#0A0B0E]">
        <div
          className="h-full rounded-full bg-[#00FF66] transition-all duration-500"
          style={{ width: `${releasedPct}%` }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[#8E929B]">
          {isUnverified
            ? "Cashback starts releasing once payment is verified."
            : isClaimedToday
              ? "Today's daily slice claimed. Next tranche unlocks tomorrow at 12:00 AM IST."
              : hasClaimable
                ? `${coins(totals.unlockedCoins)} coins are ready to claim.`
                : totals.nextSlice
                  ? `Next ${coins(totals.nextSlice.coins)} coins release on ${totals.nextSlice.dueDate}.`
                  : "All coins claimed."}
        </p>

        {isClaimedToday ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#00FF66]/20 bg-[#00FF66]/10 px-3 py-1.5 text-xs font-semibold text-[#00FF66]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Claimed today
          </span>
        ) : hasClaimable && onClaimCashback ? (
          <button
            type="button"
            onClick={() => void handleClaim()}
            disabled={claiming !== null}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#00FF66] px-3 py-1.5 text-xs font-semibold text-[#0A0B0E] transition-colors hover:bg-[#00FF66]/90 disabled:opacity-50"
          >
            {claiming === "all" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Coins className="h-3.5 w-3.5" />
            )}
            Claim {coins(totals.unlockedCoins)} coins
          </button>
        ) : null}
      </div>

      {slices.length > 0 && (
        <details className="group mt-3 border-t border-white/[0.06] pt-3">
          <summary className="flex cursor-pointer list-none items-center justify-between text-xs text-[#8E929B] transition-colors hover:text-white [&::-webkit-details-marker]:hidden">
            <span>Daily release plan</span>
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>

          <div className="mt-2 max-h-64 space-y-1 overflow-y-auto pr-1">
            {slices.map((slice) => {
              const isReleased = slice.status === "RELEASED";
              const isUnlocked = slice.status === "UNLOCKED";
              const isVoid = slice.status === "VOID";
              return (
                <div
                  key={`${order.id}-day-${slice.week}`}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-xs hover:bg-white/[0.03]"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="w-12 shrink-0 text-[#8E929B]">Day {slice.week}</span>
                    <span className={isVoid ? "text-[#6B6F7A] line-through" : "text-[#F5F5F7]"}>
                      {coins(slice.coins)} coins
                    </span>
                  </div>

                  {isReleased ? (
                    <span className="flex items-center gap-1 text-[11px] text-[#00FF66]">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Claimed
                    </span>
                  ) : isUnlocked ? (
                    onClaimCashback ? (
                      <button
                        type="button"
                        onClick={() => void handleClaim(slice.week)}
                        disabled={claiming !== null}
                        className="inline-flex items-center gap-1 rounded-md border border-[#00FF66]/40 px-2 py-0.5 text-[11px] font-semibold text-[#00FF66] transition-colors hover:bg-[#00FF66]/10 disabled:opacity-50"
                      >
                        {claiming === slice.week ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : null}
                        Claim
                      </button>
                    ) : (
                      <span className="text-[11px] text-amber-300">Ready</span>
                    )
                  ) : isVoid ? (
                    <span className="text-[11px] text-[#6B6F7A]">Void</span>
                  ) : (
                    <span className="text-[11px] text-[#6B6F7A]">{slice.dueDate}</span>
                  )}
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Main wallet                                  */
/* -------------------------------------------------------------------------- */

export default function WalletPanel({
  snapshot,
  onSubmitWithdrawal,
  onClaimCashback,
  openWithdrawOnMount = false,
  view = "all",
  onOpenWithdrawals,
  initialWithdrawSource = "cashback",
}: WalletPanelProps) {
  const showWallet = view !== "withdrawals";
  const showWithdrawals = view !== "wallet";
  const forceWithdrawForm = view === "withdrawals";
  const customer = snapshot.customer;
  const rewardRules = snapshot.rewardRules;
  const orders = snapshot.orders;
  const transactions = snapshot.transactions;
  const withdrawals = snapshot.withdrawals;
  const bankAccounts: BankAccount[] = customer?.bankAccounts ?? [];
  const primaryBank = bankAccounts[0];
  const payoutProfileReady = Boolean(primaryBank);

  const available = customer?.availableCoins ?? 0;
  const minPoints = snapshot.minWithdrawalCoins ?? 500;
  const pendingCashbackCoins = customer?.pendingCoins ?? 0;

  const referralCoins =
    customer?.referralCoinBalance ??
    snapshot.referrals
      .filter((r) => r.status === "PAID" || r.status === "APPROVED")
      .reduce((sum, r) => sum + (r.commissionCoins || 0), 0);

  const totalWithdrawalsCoins = useMemo(() => {
    const customerWithdrawals = (withdrawals ?? []).filter(
      (w) => !customer?.id || w.customerId === customer.id
    );
    return customerWithdrawals
      .filter((w) => w.overallStatus !== "REJECTED" && w.overallStatus !== "FAILED")
      .reduce((sum, w) => {
        const tranchesTransferred = (w.tranches ?? [])
          .filter((t) => t.status === "TRANSFERRED")
          .reduce((tSum, t) => tSum + (t.coins || 0), 0);
        return sum + (tranchesTransferred > 0 ? tranchesTransferred : (w.totalCoins || w.coins || 0));
      }, 0);
  }, [withdrawals, customer?.id]);

  const lifetimeEarnings = useMemo(() => {
    const baseLifetime = customer?.lifetimeEarnedCoins ?? 0;
    const calculatedLifetime = available + pendingCashbackCoins + referralCoins + totalWithdrawalsCoins;
    return Math.max(baseLifetime, calculatedLifetime);
  }, [customer?.lifetimeEarnedCoins, available, pendingCashbackCoins, referralCoins, totalWithdrawalsCoins]);

  const verifiedPaidOrders = orders.filter(
    (o) => o.paymentStatus === "PAID" && o.status !== "CANCELLED"
  );
  const hasUnverifiedOrders = orders.some(
    (o) => o.paymentStatus !== "PAID" && o.status !== "CANCELLED" && o.cashbackCoins > 0
  );
  const verifiedPaidPendingCoins = verifiedPaidOrders.reduce((sum, o) => {
    if (o.cashback && o.cashback.length > 0) {
      return (
        sum +
        o.cashback
          .filter((s) => s.status === "LOCKED" || s.status === "UNLOCKED")
          .reduce((acc, s) => acc + s.coins, 0)
      );
    }
    return sum + (o.cashbackCoins || 0);
  }, 0);
  const isAwaitingVerificationOnly =
    pendingCashbackCoins > 0 && verifiedPaidPendingCoins <= 0 && hasUnverifiedOrders;

  const todayKolkata = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  // Independent product daily claim checks:
  const isOrderClaimedToday = (o: ShopOrder) => customer?.productDailyClaims?.[o.id] === todayKolkata;
  const unclaimedOrders = verifiedPaidOrders.filter((o) => !isOrderClaimedToday(o));
  const hasClaimedAllToday = verifiedPaidOrders.length > 0 && unclaimedOrders.length === 0;

  const todayClaimableCoins = unclaimedOrders.reduce((sum, o) => {
    if (o.cashback && o.cashback.length > 0) {
      return (
        sum +
        o.cashback
          .filter((s) => s.status === "UNLOCKED")
          .reduce((acc, s) => acc + s.coins, 0)
      );
    }
    return sum + Math.max(1, Math.floor((o.cashbackCoins || 0) / 30));
  }, 0);

  const walletReferralCode = useMemo(() => {
    if (customer?.referralCode) return customer.referralCode;
    const words = (customer?.name || "Member").trim().split(/\s+/).filter(Boolean);
    const inits = words.length >= 2
      ? `${(words[0][0] || "M").toUpperCase()}${(words[1][0] || "B").toUpperCase()}`
      : (words[0] || "MB").slice(0, 2).toUpperCase();
    const idDigits = (customer?.id || "1").replace(/\D/g, "").slice(-2) || "1";
    return `SW${inits}K${idDigits}`;
  }, [customer]);

  const walletReferralUrl = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://skywear.in";
    return `${origin}/invite/${walletReferralCode}`;
  }, [walletReferralCode]);

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyReferralCode = () => {
    if (!walletReferralCode) return;
    void copyText(walletReferralCode).then((copied) => {
      if (!copied) return;
      setCopiedCode(true);
      triggerHapticFeedback("coin");
      setTimeout(() => setCopiedCode(false), 2000);
    });
  };

  const handleCopyReferralLink = () => {
    if (!walletReferralUrl) return;
    void copyText(walletReferralUrl).then((copied) => {
      if (!copied) return;
      setCopiedLink(true);
      triggerHapticFeedback("coin");
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const handleShareReferralLink = async () => {
    const shareText = `Join SKYWEAR Heavyweight Streetwear with my exclusive invite link and claim 100% Instant Cashback: ${walletReferralUrl}`;
    const shareData = {
      title: "Skywear Heavyweight Streetwear",
      text: shareText,
      url: walletReferralUrl,
    };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
        triggerHapticFeedback("coin");
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
        }
      }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
    }
  };

  const ordersWithCashback = orders.filter((o) => (o.cashback?.length ?? 0) > 0);

  const [withdrawOpen, setWithdrawOpen] = useState(openWithdrawOnMount);
  const [withdrawSource, setWithdrawSource] = useState<"REFERRAL_COINS" | "CASHBACK_COINS">(
    initialWithdrawSource === "referral" ? "REFERRAL_COINS" : "CASHBACK_COINS"
  );
  const [pointsInput, setPointsInput] = useState(() => String(available || ""));
  const [referralCoinsInput, setReferralCoinsInput] = useState(() =>
    String(referralCoins > 0 ? referralCoins : "")
  );
  const [submitting, setSubmitting] = useState(false);
  const [claimingAll, setClaimingAll] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [bankAccount, setBankAccount] = useState("");
  const [bankIfsc, setBankIfsc] = useState(primaryBank?.ifscCode ?? "");
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [newHolderName, setNewHolderName] = useState(
    primaryBank?.accountHolderName || customer?.name || ""
  );
  const [newBankName, setNewBankName] = useState(primaryBank?.bankName || "");
  const [newAccountNum, setNewAccountNum] = useState("");
  const [confirmAccountNum, setConfirmAccountNum] = useState("");
  const [newIfsc, setNewIfsc] = useState(primaryBank?.ifscCode || "");
  const [savingBank, setSavingBank] = useState(false);
  const [bankActionError, setBankActionError] = useState<string | null>(null);

  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  const points = Math.max(0, Math.floor(Number(pointsInput) || 0));
  const withdrawReferralCoins = Math.max(0, parseInt(referralCoinsInput, 10) || 0);
  // Referral coins settle at ₹1 each, so 10 coins keeps the old ₹10 payout floor.
  const minReferralCoins = 10;

  const belowMinReferral = withdrawReferralCoins < minReferralCoins;
  const aboveAvailReferral = withdrawReferralCoins > referralCoins;
  const belowMinCoins = points < minPoints;
  const aboveAvailCoins = points > available;

  const bankValid = primaryBank
    ? true
    : BANK_ACCT_RE.test(bankAccount.replace(/\s/g, "")) &&
    IFSC_RE.test(bankIfsc.trim().toUpperCase());
  const payoutValid = bankValid;
  const payoutAllowed = payoutProfileReady;

  const canSubmit =
    withdrawSource === "REFERRAL_COINS"
      ? withdrawReferralCoins > 0 &&
      !belowMinReferral &&
      !aboveAvailReferral &&
      payoutValid &&
      payoutAllowed &&
      !submitting
      : points > 0 && !belowMinCoins && !aboveAvailCoins && payoutValid && payoutAllowed && !submitting;

  const openWithdraw = (source: "REFERRAL_COINS" | "CASHBACK_COINS") => {
    setWithdrawSource(source);
    if (source === "REFERRAL_COINS") {
      setReferralCoinsInput(String(referralCoins > 0 ? referralCoins : ""));
    } else {
      setPointsInput(String(available || ""));
    }
    setFormError(null);
    setWithdrawOpen(true);
  };

  const handleDailyClaim = async () => {
    if (
      !onClaimCashback ||
      claimingAll ||
      hasClaimedAllToday ||
      todayClaimableCoins <= 0 ||
      pendingCashbackCoins <= 0 ||
      isAwaitingVerificationOnly
    ) {
      return;
    }
    setClaimingAll(true);
    setSuccessMsg(null);
    setFormError(null);
    try {
      await onClaimCashback();
      triggerHapticFeedback("coin");
      setSuccessMsg(`Claimed ${coins(todayClaimableCoins)} coins into your wallet.`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to claim cashback");
    } finally {
      setClaimingAll(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setFormError(null);
    setSuccessMsg(null);
    try {
      const cleanBankAcct = bankAccount.replace(/\s/g, "");
      const cleanIfsc = bankIfsc.trim().toUpperCase();

      const amountCoins =
        withdrawSource === "REFERRAL_COINS" ? withdrawReferralCoins : points;

      await onSubmitWithdrawal({
        coins: amountCoins,
        sourceType: withdrawSource,
        payoutMethod: "BANK",
        ...(primaryBank
          ? { bankAccountId: primaryBank.id }
          : { bankAccount: cleanBankAcct, bankIfsc: cleanIfsc }),
      });

      setWithdrawOpen(false);
      setSuccessMsg(
        `Withdrawal request for ${coins(amountCoins)} coins submitted. Admin will transfer to bank account ending ••••${primaryBank?.accountNumberLast4 || cleanBankAcct.slice(-4)} after review.`
      );

      if (forceWithdrawForm) {
        setPointsInput("");
        setReferralCoinsInput("");
      } else if (withdrawSource === "REFERRAL_COINS") {
        setReferralCoinsInput(String(Math.max(0, referralCoins - amountCoins)));
      } else {
        setPointsInput(available > 0 ? String(Math.max(0, available - amountCoins)) : "");
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Withdrawal failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setBankActionError(null);
    if (!newHolderName.trim()) {
      setBankActionError("Account holder name is required.");
      return;
    }
    if (!newBankName.trim()) {
      setBankActionError("Bank name is required.");
      return;
    }
    const cleanNum = newAccountNum.replace(/\s/g, "");
    if (!BANK_ACCT_RE.test(cleanNum)) {
      setBankActionError("Enter a valid 9-18 digit account number.");
      return;
    }
    if (cleanNum !== confirmAccountNum.replace(/\s/g, "")) {
      setBankActionError("Account numbers do not match.");
      return;
    }
    if (!IFSC_RE.test(newIfsc.trim().toUpperCase())) {
      setBankActionError("Enter a valid 11-character IFSC code (e.g. INDB0000476).");
      return;
    }

    setSavingBank(true);
    try {
      const res = await api.addBankAccount({
        accountHolderName: newHolderName.trim(),
        accountNumber: cleanNum,
        confirmAccountNumber: confirmAccountNum.replace(/\s/g, ""),
        bankName: newBankName.trim(),
        ifscCode: newIfsc.trim().toUpperCase(),
      });
      setIsEditingBank(false);
      setBankAccount("");
      setBankIfsc(newIfsc.trim().toUpperCase());
      setNewAccountNum("");
      setConfirmAccountNum("");
      setSuccessMsg(
        res.pendingReview
          ? "Bank account change submitted for admin review."
          : "Bank account linked to your profile."
      );
    } catch (err) {
      setBankActionError(errorMessage(err, "Failed to save bank account"));
    } finally {
      setSavingBank(false);
    }
  };

  const copyReference = (reference: string) => {
    void copyText(reference).then((copied) => {
      if (!copied) return;
      setCopiedRef(reference);
      setTimeout(() => setCopiedRef(null), 2000);
    });
  };

  const amountCoins = withdrawSource === "REFERRAL_COINS" ? withdrawReferralCoins : points;
  const maxWithdrawCoins = withdrawSource === "REFERRAL_COINS" ? referralCoins : available;
  const showWithdrawForm = forceWithdrawForm || (view === "all" && withdrawOpen);
  const amountError =
    withdrawSource === "REFERRAL_COINS"
      ? belowMinReferral && withdrawReferralCoins > 0
        ? `Minimum referral withdrawal is ${coins(minReferralCoins)} coins.`
        : aboveAvailReferral
          ? `You have ${coins(referralCoins)} referral coins available.`
          : null
      : belowMinCoins && points > 0
        ? `Minimum withdrawal is ${coins(minPoints)} coins.`
        : aboveAvailCoins
          ? `You have ${coins(available)} coins available.`
          : null;

  return (
    <div className="mx-auto max-w-5xl space-y-3 text-[#F5F5F7]">
      {successMsg && (
        <div className="flex items-start gap-2.5 rounded-md border border-[#00FF66]/30 bg-[#00FF66]/[0.08] p-2.5 text-xs text-[#00FF66]">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="flex-1">{successMsg}</p>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-[#00FF66]/70 transition-colors hover:text-[#00FF66]"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {formError && (
        <div className="flex items-start gap-2.5 rounded-md border border-rose-500/30 bg-rose-500/[0.08] p-2.5 text-xs text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="flex-1">{formError}</p>
          <button
            type="button"
            onClick={() => setFormError(null)}
            className="text-rose-300/70 transition-colors hover:text-rose-200"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Balance */}
      {showWallet && (
        <section className={`${CARD} p-3.5`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-[#8E929B]">
                Total Coins
              </p>
              <p className="mt-1 text-3xl font-bold tracking-tight text-white">
                {coins(available)}{" "}
                <span className="text-sm font-medium text-[#8E929B]">coins</span>
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#00FF66]/25 bg-[#00FF66]/[0.08] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#00FF66]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00FF66]" />
              Live
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:max-w-md">
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
              <p className="text-[9px] font-medium uppercase tracking-wider text-[#6B6F7A]">
                Pending Coins
              </p>
              <p
                className={`text-sm font-bold tracking-tight ${pendingCashbackCoins > 0 ? "text-amber-300" : "text-white"
                  }`}
              >
                {coins(pendingCashbackCoins)}
              </p>
            </div>
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
              <p className="text-[9px] font-medium uppercase tracking-wider text-[#6B6F7A]">
                Lifetime Earnings
              </p>
              <p className="text-sm font-bold tracking-tight text-white">
                {coins(lifetimeEarnings)}
              </p>
            </div>
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
              <p className="text-[9px] font-medium uppercase tracking-wider text-[#6B6F7A]">
                Referral Earnings
              </p>
              <p className="text-sm font-bold tracking-tight text-[#00FF66]">
                {coins(referralCoins)}
              </p>
            </div>
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
              <p className="text-[9px] font-medium uppercase tracking-wider text-[#6B6F7A]">
                Total Withdrawals
              </p>
              <p className="text-sm font-bold tracking-tight text-[#00F0FF]">
                {coins(totalWithdrawalsCoins)}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (onOpenWithdrawals) {
                  onOpenWithdrawals();
                  return;
                }
                openWithdraw("CASHBACK_COINS");
              }}
              disabled={!onOpenWithdrawals && available < minPoints && referralCoins <= 0}
              className={PRIMARY_BTN}
            >
              Withdraw coins
            </button>

            {onClaimCashback && todayClaimableCoins > 0 && !hasClaimedAllToday && (
              <button
                type="button"
                onClick={() => void handleDailyClaim()}
                disabled={claimingAll || isAwaitingVerificationOnly}
                className={SECONDARY_BTN}
              >
                {claimingAll ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Coins className="h-4 w-4 text-[#00FF66]" />
                )}
                Claim {coins(todayClaimableCoins)} coins
              </button>
            )}

            {hasClaimedAllToday && todayClaimableCoins === 0 && ordersWithCashback.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs text-[#8E929B]">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#00FF66]" />
                All claimed for today
              </span>
            )}
          </div>

          <p className="mt-2 text-[10px] text-[#6B6F7A]">
            Minimum {coins(minPoints)} coins.
          </p>
        </section>
      )}

      {/* Live balances */}
      {forceWithdrawForm && (
        <section className={`${CARD} overflow-hidden`}>
          <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
            <div className="min-w-0 px-3 py-2">
              <p className="text-[9px] font-medium uppercase tracking-wider text-[#8E929B]">
                Wallet coins
              </p>
              <p className="truncate text-base font-bold tracking-tight text-white">
                {coins(available)}
              </p>
            </div>
            <div className="min-w-0 px-3 py-2">
              <p className="text-[9px] font-medium uppercase tracking-wider text-[#8E929B]">
                Referral coins
              </p>
              <p className="truncate text-base font-bold tracking-tight text-[#00FF66]">
                {coins(referralCoins)}
              </p>
            </div>
            <div className="min-w-0 px-3 py-2">
              <p className="text-[9px] font-medium uppercase tracking-wider text-[#8E929B]">
                Pending coins
              </p>
              <p
                className={`truncate text-base font-bold tracking-tight ${pendingCashbackCoins > 0 ? "text-amber-300" : "text-white"
                  }`}
              >
                {coins(pendingCashbackCoins)}
              </p>
            </div>
          </div>
          <p className="border-t border-white/[0.06] px-3 py-1.5 text-[10px] text-[#6B6F7A]">
            Pending coins unlock daily and move into your wallet.
          </p>
        </section>
      )}

      {/* Withdraw form */}
      {showWithdrawForm && (
        <section className={`${CARD} p-3.5`}>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Withdraw coins</h2>
              <p className="mt-0.5 text-xs text-[#8E929B]">
                Minimum{" "}
                {coins(withdrawSource === "REFERRAL_COINS" ? minReferralCoins : minPoints)} coins
              </p>
            </div>
            {!forceWithdrawForm && (
              <button
                type="button"
                onClick={() => {
                  setWithdrawOpen(false);
                  setFormError(null);
                }}
                className="rounded-lg p-1.5 text-[#8E929B] transition-colors hover:bg-white/[0.06] hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: "CASHBACK_COINS", label: "Wallet coins", icon: Coins },
                  { value: "REFERRAL_COINS", label: "Referral coins", icon: Gift },
                ] as const
              ).map((source) => {
                const active = withdrawSource === source.value;
                const Icon = source.icon;
                return (
                  <button
                    key={source.value}
                    type="button"
                    onClick={() => {
                      setWithdrawSource(source.value);
                      if (source.value === "REFERRAL_COINS") {
                        setReferralCoinsInput(String(referralCoins > 0 ? referralCoins : ""));
                      } else {
                        setPointsInput(String(available || ""));
                      }
                      setFormError(null);
                    }}
                    className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition-colors ${active
                      ? "border-[#D9362B]/50 bg-[#D9362B]/[0.08] text-white"
                      : "border-white/[0.08] text-[#8E929B] hover:border-white/15 hover:text-white"
                      }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${active ? "text-[#D9362B]" : "text-[#8E929B]"}`}
                    />
                    <span className="flex-1 truncate">{source.label}</span>
                    {active && <Check className="h-3.5 w-3.5 shrink-0 text-[#D9362B]" />}
                  </button>
                );
              })}
            </div>

            <div>
              <label
                htmlFor="withdraw-amount"
                className="mb-2 block text-xs font-medium text-[#8E929B]"
              >
                Amount
              </label>
              <div className="relative">
                <input
                  id="withdraw-amount"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={withdrawSource === "REFERRAL_COINS" ? referralCoinsInput : pointsInput}
                  onChange={(e) =>
                    withdrawSource === "REFERRAL_COINS"
                      ? setReferralCoinsInput(e.target.value)
                      : setPointsInput(e.target.value)
                  }
                  placeholder="0"
                  className={`${INPUT} pr-16 text-lg font-semibold tabular-nums`}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-xs font-medium text-[#6B6F7A]">
                  coins
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-1.5">
                  {[25, 50, 100].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => {
                        const value = Math.floor((maxWithdrawCoins * pct) / 100);
                        if (withdrawSource === "REFERRAL_COINS") {
                          setReferralCoinsInput(String(value));
                        } else {
                          setPointsInput(String(value));
                        }
                        setFormError(null);
                      }}
                      className="rounded-lg border border-white/[0.08] px-2.5 py-1 text-[11px] font-medium text-[#8E929B] transition-colors hover:border-white/15 hover:text-white"
                    >
                      {pct === 100 ? "Max" : `${pct}%`}
                    </button>
                  ))}
                </div>
                {amountCoins > 0 && (
                  <span className="text-xs font-medium tabular-nums text-white">
                    {amountCoins.toLocaleString("en-IN")} Coins
                  </span>
                )}
              </div>
              {amountError && <p className="mt-2 text-xs text-rose-400">{amountError}</p>}

              {amountCoins > 0 && Number(rewardRules?.withdrawalTaxPercent || 0) > 0 && (() => {
                const taxRate = Number(rewardRules?.withdrawalTaxPercent || 0);
                const taxAmount = Math.round((amountCoins * taxRate) / 100);
                const netAmount = Math.max(0, amountCoins - taxAmount);
                return (
                  <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-xs font-mono">
                    <div className="flex items-center justify-between text-[#8E929B]">
                      <span>Gross withdrawal:</span>
                      <span className="font-semibold text-white">{amountCoins.toLocaleString("en-IN")} coins</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-amber-400">
                      <span>TDS / Tax deduction ({taxRate}%):</span>
                      <span className="font-semibold">-{taxAmount.toLocaleString("en-IN")} coins</span>
                    </div>
                    <div className="mt-2 border-t border-white/10 pt-2 flex items-center justify-between font-bold">
                      <span className="text-white">Net transfer to account:</span>
                      <span className="text-[#00FF66] text-sm">{netAmount.toLocaleString("en-IN")} coins</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-[#8E929B]">Payout method</p>
              <div className="flex items-center gap-2 rounded-xl border border-[#D9362B]/50 bg-[#D9362B]/[0.08] px-3.5 py-2.5 text-xs font-semibold text-white">
                <Landmark className="h-4 w-4 text-[#D9362B]" />
                <span>Direct Bank Transfer (NEFT / IMPS)</span>
              </div>
              {!payoutProfileReady && (
                <p className="mt-1.5 text-[11px] text-[#D9362B]">
                  Link a bank account in Profile or enter your bank details below before withdrawing.
                </p>
              )}
            </div>

            {primaryBank ? (
              <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#0A0B0E] px-3.5 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
                  <Landmark className="h-4 w-4 text-[#8E929B]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-[#6B6F7A]">
                    Linked bank account
                  </p>
                  <p className="mt-0.5 truncate text-sm font-medium text-white">
                    {primaryBank.bankName} ••••{primaryBank.accountNumberLast4 || primaryBank.maskedAccountNumber}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[#8E929B]">
                    IFSC {primaryBank.ifscCode} · {primaryBank.accountHolderName}
                  </p>
                  {primaryBank.status === "PENDING_REVIEW" && (
                    <p className="mt-0.5 text-xs text-amber-300">
                      A bank account change is under review.
                    </p>
                  )}
                </div>
                {primaryBank.status === "PENDING_REVIEW" ? (
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-300" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#00FF66]" />
                )}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="withdraw-bank-account"
                    className="mb-2 block text-xs font-medium text-[#8E929B]"
                  >
                    Account number
                  </label>
                  <input
                    id="withdraw-bank-account"
                    type="text"
                    inputMode="numeric"
                    placeholder="9 to 18 digits"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value.replace(/\D/g, ""))}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label
                    htmlFor="withdraw-bank-ifsc"
                    className="mb-2 block text-xs font-medium text-[#8E929B]"
                  >
                    IFSC code
                  </label>
                  <input
                    id="withdraw-bank-ifsc"
                    type="text"
                    maxLength={11}
                    placeholder="INDB0000476"
                    value={bankIfsc}
                    onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                    className={`${INPUT} uppercase`}
                  />
                </div>
              </div>
            )}

            <div className="border-t border-white/[0.06] pt-3">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {!forceWithdrawForm && (
                  <button
                    type="button"
                    onClick={() => setWithdrawOpen(false)}
                    className={`${SECONDARY_BTN} w-full sm:w-auto`}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={`${PRIMARY_BTN} w-full sm:w-auto sm:min-w-[180px]`}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Processing...
                    </>
                  ) : (
                    "Request withdrawal"
                  )}
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      {showWallet && (
        <section>
          <SectionHeading
            title="Cashback releases"
          />
          {ordersWithCashback.length === 0 ? (
            <div className={`${CARD} p-4 text-sm text-[#8E929B]`}>
              No cashback releases yet.
            </div>
          ) : (
            <div className="space-y-2">
              {ordersWithCashback.map((order) => (
                <CashbackOrderRow
                  key={order.id}
                  order={order}
                  isClaimedToday={isOrderClaimedToday(order)}
                  onClaimCashback={onClaimCashback}
                  onError={setFormError}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Dedicated Referral & Invite Section */}
      {customer && (
        <section className={`${CARD} p-4 sm:p-5 relative overflow-hidden border-[#00FF66]/20 bg-gradient-to-br from-[#11131A] via-[#11131A] to-[#0A1A12]`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#00FF66]/10 text-[#00FF66] border border-[#00FF66]/20 shrink-0">
                <Gift className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Your Referral Program</h3>
                <p className="text-xs text-[#8E929B]">
                  Share your link & earn 10% instant commission on every friend&apos;s purchase.
                </p>
              </div>
            </div>
            {referralCoins > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#00FF66]/10 px-2.5 py-0.5 text-xs font-semibold text-[#00FF66]">
                {coins(referralCoins)} coins earned
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Referral Code Box */}
            <div className="rounded-lg border border-white/[0.08] bg-[#0A0B0E] p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8E929B]">
                Your Referral Code
              </p>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="font-mono text-base font-bold text-[#00FF66] tracking-wider">
                  {walletReferralCode}
                </span>
                <button
                  type="button"
                  onClick={handleCopyReferralCode}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-white/[0.08]"
                >
                  {copiedCode ? <Check className="h-3.5 w-3.5 text-[#00FF66]" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedCode ? "Copied" : "Copy Code"}
                </button>
              </div>
            </div>

            {/* Referral URL Box */}
            <div className="rounded-lg border border-white/[0.08] bg-[#0A0B0E] p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8E929B]">
                Your Invite Link
              </p>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="truncate font-mono text-xs text-neutral-300">
                  {walletReferralUrl}
                </span>
                <button
                  type="button"
                  onClick={handleCopyReferralLink}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-white/[0.08]"
                >
                  {copiedLink ? <Check className="h-3.5 w-3.5 text-[#00FF66]" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedLink ? "Copied" : "Copy Link"}
                </button>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/[0.06]">
            <p className="text-[11px] text-[#8E929B]">
              Friends get 100% instant cashback on streetwear drops when they join through you.
            </p>
            <button
              type="button"
              onClick={handleShareReferralLink}
              className="inline-flex items-center gap-2 rounded-lg bg-[#00FF66] px-4 py-2 text-xs font-bold text-[#0A0B0E] transition-colors hover:bg-[#00FF66]/90 active:translate-y-px"
            >
              <Share2 className="h-4 w-4" />
              Share Invite Link
            </button>
          </div>
        </section>
      )}

      {showWithdrawals && (
        <section>
          <SectionHeading title="Payout history" />
          {withdrawals.length === 0 ? (
            <div className={`${CARD} p-4 text-sm text-[#8E929B]`}>
              No payouts yet.
            </div>
          ) : (
            <div className={`${CARD} divide-y divide-white/[0.06]`}>
              {withdrawals.map((request) => {
                const state = withdrawalState(request.overallStatus);
                const reference = withdrawalReference(request);
                const rejected =
                  request.overallStatus === "REJECTED" || request.overallStatus === "FAILED";
                return (
                  <div key={request.id} className="flex flex-wrap items-start justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">
                        {coins(request.totalCoins)} coins
                      </p>
                      <p className="mt-0.5 text-xs text-[#8E929B]">
                        {payoutDestination(request)} · {dateTimeLabel(request.requestedAt)}
                      </p>

                      {rejected && request.rejectionReason && (
                        <p className="mt-1.5 text-xs text-rose-400">
                          {request.rejectionReason} Refunded to your wallet.
                        </p>
                      )}
                      {reference &&
                        (request.overallStatus === "PAID" ||
                          request.overallStatus === "COMPLETED") && (
                          <div className="mt-1.5 flex items-center gap-2 text-xs">
                            <span className="text-[#8E929B]">UTR {reference}</span>
                            <button
                              type="button"
                              onClick={() => copyReference(reference)}
                              className="text-[#8E929B] transition-colors hover:text-white"
                              aria-label="Copy UTR"
                            >
                              {copiedRef === reference ? (
                                <Check className="h-3.5 w-3.5 text-[#00FF66]" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        )}
                    </div>

                    <span className={`flex items-center gap-1.5 text-xs font-medium ${state.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${state.dot}`} />
                      {state.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {showWithdrawals && (
        <section>
          <SectionHeading
            title="Payout methods"
          />
          <div className="grid gap-3">
            {/* Bank */}
            <div className={`${CARD} p-4`}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium text-white">
                  <Landmark className="h-4 w-4 text-[#8E929B]" /> Bank account
                </span>
                {!isEditingBank && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingBank(true);
                      setBankActionError(null);
                    }}
                    className="text-xs font-medium text-[#D9362B] transition-colors hover:text-[#F05245]"
                  >
                    {primaryBank ? "Change" : "Add"}
                  </button>
                )}
              </div>

              {isEditingBank ? (
                <form onSubmit={handleSaveBankAccount} className="mt-3 space-y-2.5">
                  {bankActionError && <p className="text-xs text-rose-400">{bankActionError}</p>}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      type="text"
                      placeholder="Account holder name"
                      value={newHolderName}
                      onChange={(e) => setNewHolderName(e.target.value)}
                      onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 120)}
                      className={INPUT}
                      aria-label="Account holder name"
                    />
                    <BankSelect value={newBankName} onChange={setNewBankName} />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Account number"
                      value={newAccountNum}
                      onChange={(e) => setNewAccountNum(e.target.value.replace(/\D/g, ""))}
                      onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 120)}
                      className={INPUT}
                      aria-label="Account number"
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Confirm account number"
                      value={confirmAccountNum}
                      onChange={(e) => setConfirmAccountNum(e.target.value.replace(/\D/g, ""))}
                      onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 120)}
                      className={INPUT}
                      aria-label="Confirm account number"
                    />
                  </div>
                  <input
                    type="text"
                    maxLength={11}
                    placeholder="IFSC code"
                    value={newIfsc}
                    onChange={(e) => setNewIfsc(e.target.value.toUpperCase())}
                    onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 120)}
                    className={`${INPUT} uppercase`}
                    aria-label="IFSC code"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingBank(false);
                        setBankActionError(null);
                      }}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#8E929B] transition-colors hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingBank}
                      className="rounded-lg bg-[#D9362B] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#B82B22] disabled:opacity-50"
                    >
                      {savingBank ? "Saving..." : "Save"}
                    </button>
                  </div>
                </form>
              ) : primaryBank ? (
                <div className="mt-2">
                  <p className="text-sm text-white">
                    {primaryBank.bankName} ••••{primaryBank.accountNumberLast4 || primaryBank.maskedAccountNumber}
                  </p>
                  <p className="mt-1 text-xs text-[#8E929B]">
                    IFSC {primaryBank.ifscCode} · {primaryBank.accountHolderName}
                  </p>
                  {primaryBank.status === "PENDING_REVIEW" && (
                    <p className="mt-1 text-xs text-amber-300">A change is under review.</p>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-xs text-[#8E929B]">No bank account linked yet.</p>
              )}
            </div>
          </div>
        </section>
      )}

      {showWallet && (
        <section>
          <SectionHeading title="Coin activity" />
          {transactions.length === 0 ? (
            <div className={`${CARD} p-4 text-sm text-[#8E929B]`}>No coin activity yet.</div>
          ) : (
            <div className={`${CARD} divide-y divide-white/[0.06]`}>
              {transactions.map((tx) => (
                <ActivityRow key={tx.id} tx={tx} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function ActivityRow({ tx }: { tx: WalletTransaction }) {
  const displayCoins = tx.coins;
  const positive = displayCoins > 0;

  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-pretty break-words text-sm leading-snug text-[#F5F5F7]">{plainLedgerLine(tx.description)}</p>
        <p className="mt-0.5 text-[11px] text-[#8E929B]">
          {tx.date} · {tx.status.toLowerCase()}
        </p>
      </div>
      <p
        className={`shrink-0 whitespace-nowrap text-sm font-semibold ${positive ? "text-[#00FF66]" : "text-rose-400"
          }`}
      >
        {positive ? "+" : ""}
        {coins(displayCoins)} coins
      </p>
    </div>
  );
}
