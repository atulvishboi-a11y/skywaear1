import React from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import { ArrowLeft, RotateCcw, ShieldAlert, CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "Return & Refund Policy | Skywear",
  description: "Learn about our 7-day hassle-free size replacement and cashback reversal rules.",
};

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-[#0A0B0E] text-[#F5F5F7] font-mono flex flex-col selection:bg-[#D9362B] selection:text-white">
      <Header />
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <Link href="/" className="inline-flex items-center gap-2 text-xs text-[#8E929B] hover:text-white uppercase transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Storefront
        </Link>

        <div className="border-b border-white/[0.08] pb-6">
          <span className="text-[10px] text-[#D9362B] font-bold uppercase tracking-widest block mb-1">
            CUSTOMER SATISFACTION GUARANTEE
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold uppercase text-white tracking-tight" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>
            Return, Exchange &amp; Refund Policy
          </h1>
          <p className="text-xs text-[#8E929B] mt-2">
            Last updated: October 2026 • 7-day doorstep size replacement on all drops.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="border border-white/[0.08] bg-[#11131A] p-4 space-y-2">
            <RotateCcw className="w-5 h-5 text-[#D9362B]" />
            <h3 className="font-bold text-white uppercase font-sans">7-Day Free Exchange</h3>
            <p className="text-[#A5AAB8] text-[11px]">Incorrect size? We arrange free reverse pickup and dispatch the right size.</p>
          </div>
          <div className="border border-white/[0.08] bg-[#11131A] p-4 space-y-2">
            <CheckCircle2 className="w-5 h-5 text-[#00FF66]" />
            <h3 className="font-bold text-white uppercase font-sans">Defect Guarantee</h3>
            <p className="text-[#A5AAB8] text-[11px]">Instant replacement or 100% refund for manufacturing defects or damaged shipments.</p>
          </div>
          <div className="border border-white/[0.08] bg-[#11131A] p-4 space-y-2">
            <ShieldAlert className="w-5 h-5 text-[#D9362B]" />
            <h3 className="font-bold text-white uppercase font-sans">Cashback Adjustment</h3>
            <p className="text-[#A5AAB8] text-[11px]">When an order is refunded, any associated pending cashback coins are reversed.</p>
          </div>
        </div>

        <div className="space-y-6 text-xs text-[#C8C5BC] leading-relaxed bg-[#11131A] border border-white/[0.08] p-6 sm:p-8 font-sans">
          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase text-white font-mono">1. Size Exchange Eligibility</h2>
            <p>
              To be eligible for an exchange, your garment must be unused, unwashed, with all original tags attached and in its original polymailer packaging. Requests must be raised within <strong className="text-white">7 days</strong> of delivery confirmation.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase text-white font-mono">2. How to Request an Exchange or Return</h2>
            <p>
              Visit our <Link href="/support" className="text-[#D9362B] hover:underline font-bold">Support Desk</Link> or WhatsApp our dedicated support executive with your Order ID (e.g. #TC_10492) and photos of the garment. Our team will book a reverse pickup within 24 hours.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase text-white font-mono">3. Refunds &amp; Coin Reversals</h2>
            <p>
              Approved refunds are credited to the original payment source (UPI, Card, Bank Account) within 3–5 business days. Coins are not used to pay for orders, so no coin balance is spent at checkout. Any pending cashback coins issued on a refunded order are automatically voided according to our anti-abuse policy.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
