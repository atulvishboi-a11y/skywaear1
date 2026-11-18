"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, LogIn, RefreshCw, TriangleAlert, Wallet, Coins, Zap } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AuthModal from "@/components/AuthModal";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import WalletPanel from "@/components/WalletPanel";
import type { StorefrontSnapshot, WithdrawalInput } from "@/lib/contracts";
import { formatRupees } from "@/lib/domain";
import { api } from "@/lib/client";

export default function WalletPage() {
  const [snapshot, setSnapshot] = useState<StorefrontSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isAuthOpen, setAuthOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await api.storefront());
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Wallet failed to load");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submitWithdrawal = useCallback(
    async (input: WithdrawalInput) => {
      await api.withdraw(input);
      await refresh();
    },
    [refresh]
  );

  const claimCashback = useCallback(
    async (options?: { orderId?: string; week?: number }) => {
      await api.claimCashback(options);
      await refresh();
    },
    [refresh]
  );

  const addBankAccount = useCallback(
    async (input: { accountHolderName: string; accountNumber: string; confirmAccountNumber: string; ifscCode: string; bankName: string }) => {
      await api.addBankAccount(input);
      await refresh();
    },
    [refresh]
  );

  const removeBankAccount = useCallback(
    async (id: string) => {
      await api.removeBankAccount(id);
      await refresh();
    },
    [refresh]
  );

  const customer = snapshot?.customer ?? null;
  const coins = customer?.availableCoins ?? 0;
  const wantWithdraw =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("withdraw") === "1";

  return (
    <div className="min-h-screen bg-[#0A0B0E] font-mono text-[#F5F5F7] flex flex-col selection:bg-[#D9362B] selection:text-white antialiased">
      <Header customer={customer} walletPoints={coins} />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <section className="border-b border-white/[0.08] pb-4 mb-6">
          <h1
            className="text-2xl sm:text-3xl font-bold uppercase tracking-tight text-white"
            style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
          >
            Rewards Wallet
          </h1>
          <p className="mt-1 text-xs text-[#8E929B] font-mono">
            {customer ? `Logged in as ${customer.name || customer.phone || "Member"} · Instant UPI & Bank Payouts` : "Sign in to view your balance, claim daily unlocks, and request payouts."}
          </p>
        </section>

        <div>
          {loadError ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-300 font-mono shadow-xl">
              <p className="flex items-center gap-2 font-bold">
                <TriangleAlert className="h-4 w-4 shrink-0 text-rose-400" /> {loadError}
              </p>
              <button
                onClick={() => void refresh()}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-black hover:bg-[#00FF66] transition-colors active:scale-95"
              >
                <RefreshCw className="h-4 w-4" /> Retry
              </button>
            </div>
          ) : !snapshot ? (
            <div className="rounded-xl border border-white/[0.08] bg-[#11131A] p-12 text-center text-sm text-[#8E929B] font-mono shadow-xl">
              Loading your wallet ledger…
            </div>
          ) : !customer ? (
            <div className="rounded-xl border border-white/[0.08] bg-[#11131A] p-8 sm:p-14 text-center max-w-xl mx-auto shadow-2xl">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0A0B0E] border border-white/[0.08] text-[#00FF66] mb-4">
                <Wallet className="h-7 w-7" />
              </div>
              <h2
                className="text-xl font-bold uppercase tracking-tight text-white mb-2"
                style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
              >
                Sign in to view rewards
              </h2>
              <p className="mx-auto max-w-md text-xs font-sans text-[#8E929B] leading-relaxed mb-6">
                Sky Cash is linked to your order mobile number. Sign in to withdraw your earnings directly to your UPI ID or Bank account.
              </p>
              <button
                onClick={() => setAuthOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-[#00FF66] px-6 py-3.5 text-xs font-bold uppercase tracking-widest text-[#0A0B0E] hover:bg-[#00FF66]/90 transition-all font-mono active:scale-95 shadow-lg shadow-[#00FF66]/20 cursor-pointer"
              >
                <LogIn className="h-4 w-4" /> Sign In / Create Account
              </button>
            </div>
          ) : (
            <WalletPanel
              snapshot={snapshot}
              notifications={snapshot.notifications ?? []}
              onSubmitWithdrawal={submitWithdrawal}
              onClaimCashback={claimCashback}
              onAddBankAccount={addBankAccount}
              onRemoveBankAccount={removeBankAccount}
              openWithdrawOnMount={wantWithdraw}
            />
          )}
        </div>
      </main>

      <Footer />

      {snapshot?.support && <FloatingWhatsApp support={snapshot.support} />}

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setAuthOpen(false)}
        onSignedIn={() => {
          void refresh();
        }}
      />
    </div>
  );
}
