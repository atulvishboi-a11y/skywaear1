import React from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import { ArrowLeft, Coins, Zap, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Terms & Conditions & Sky Cash Rules | Skywear",
  description: "Official terms for INR pricing, cashback coins, referral coins and coin withdrawals.",
};

export default function TermsPolicyPage() {
  return (
    <div className="min-h-screen bg-[#0A0B0E] text-[#F5F5F7] font-mono flex flex-col selection:bg-[#D9362B] selection:text-white">
      <Header />
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <Link href="/" className="inline-flex items-center gap-2 text-xs text-[#8E929B] hover:text-white uppercase transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Storefront
        </Link>

        <div className="border-b border-white/[0.08] pb-6">
          <span className="text-[10px] text-[#D9362B] font-bold uppercase tracking-widest block mb-1">
            LEGAL ARCHIVE &amp; REWARDS CHARTER
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold uppercase text-white tracking-tight" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>
            Terms &amp; Conditions &amp; Cashback Rules
          </h1>
          <p className="text-xs text-[#8E929B] mt-2">
            Last updated: November 2026 • Governing streetwear orders, the coin ledger, and coin withdrawals.
          </p>
        </div>

        <div className="space-y-6 text-xs text-[#C8C5BC] leading-relaxed bg-[#11131A] border border-white/[0.08] p-6 sm:p-8 font-sans">
          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase text-white font-mono flex items-center gap-2">
              <Coins className="w-4 h-4 text-[#00FF66]" /> 1. Two Separate Units: Rupees and Coins
            </h2>
            <p>
              Every product price, cart total, checkout payment, gateway transaction and order refund is in <strong className="text-white">Indian Rupees (INR)</strong>. Cashback, referral rewards, wallet balances, the coin ledger and withdrawal requests are in <strong className="text-white">Sky Coins</strong>. Coins never replace, discount or pay a product price: a ₹4,599 tee is always charged ₹4,599 in INR.
            </p>
            <p className="text-[#8E929B]">
              For general understanding only, the programme notionally treats <strong className="text-[#C8C5BC]">1 INR = 100 Coins</strong>. This line is informational. It is not used to convert balances, compute cashback or referral rewards, process withdrawals, or connect coins to pricing or payments.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase text-white font-mono flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#D9362B]" /> 2. Cashback Coins
            </h2>
            <p>
              Paid orders receive <strong className="text-white">cashback coins</strong> configured per product. Coins are credited to the member&apos;s <strong className="text-amber-300">Pending Coins</strong> wallet and move to <strong className="text-white">Available Coins</strong> as their daily release becomes due. Every cashback amount, balance and ledger entry is recorded in coins only — cashback is never credited in INR.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase text-white font-mono flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#00FF66]" /> 3. Referral Coins
            </h2>
            <p>
              The referrer earns a commission on a referred member&apos;s eligible paid order. The formula is <strong className="text-white">referral coins = referred order amount (INR) × referral percentage ÷ 100</strong>. For example, at the 10% default, a ₹4,599 order credits <strong className="text-white">459.90 Coins</strong>. Referral coins are tracked separately from cashback and are never paid in INR. Each order credits a referral reward at most once.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase text-white font-mono">4. Coins Cannot Pay for Orders</h2>
            <p>
              Checkout accepts card, UPI, net banking or cash on delivery in INR only. Coins cannot be used as payment, a discount or a price modifier. The coin wallet exists solely for cashback, referral rewards and coin withdrawals.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase text-white font-mono">5. Coin Withdrawals</h2>
            <p>
              Available coins can be withdrawn by request to a verified UPI ID or Indian bank account. Every withdrawal is requested, stored, reviewed and reported in coins. The minimum request is set by the store and shown in the app (<strong className="text-white">500 Coins</strong> by default), and the server checks the coin balance before reserving it, so the same coins can never be withdrawn twice. The payout desk records the transaction reference once the transfer is complete.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase text-white font-mono">6. Returns and Cancellations</h2>
            <p>
              Every piece is printed on demand, so all sales are final. If a paid order is cancelled by Skywear, the full INR amount is refunded to the original payment method and any coins spent or earned on it are reversed in the coin ledger.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
