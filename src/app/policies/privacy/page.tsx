import React from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import { ArrowLeft, Lock, Shield, EyeOff } from "lucide-react";

export const metadata = {
  title: "Privacy Policy | Skywear",
  description: "Learn how we protect your customer data, masked bank details, and transactions.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#0A0B0E] text-[#F5F5F7] font-mono flex flex-col selection:bg-[#D9362B] selection:text-white">
      <Header />
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <Link href="/" className="inline-flex items-center gap-2 text-xs text-[#8E929B] hover:text-white uppercase transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Storefront
        </Link>

        <div className="border-b border-white/[0.08] pb-6">
          <span className="text-[10px] text-[#D9362B] font-bold uppercase tracking-widest block mb-1">
            DATA SECURITY &amp; ENCRYPTION
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold uppercase text-white tracking-tight" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>
            Privacy Policy
          </h1>
          <p className="text-xs text-[#8E929B] mt-2">
            Last updated: October 2026 • 256-bit SSL encrypted customer and payout records.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="border border-white/[0.08] bg-[#11131A] p-4 space-y-2">
            <Lock className="w-5 h-5 text-[#D9362B]" />
            <h3 className="font-bold text-white uppercase font-sans">Bank Masking</h3>
            <p className="text-[#A5AAB8] text-[11px]">Account numbers are securely masked across all customer interfaces.</p>
          </div>
          <div className="border border-white/[0.08] bg-[#11131A] p-4 space-y-2">
            <EyeOff className="w-5 h-5 text-[#00FF66]" />
            <h3 className="font-bold text-white uppercase font-sans">Zero Third-Party Ad Sharing</h3>
            <p className="text-[#A5AAB8] text-[11px]">We never sell, rent, or trade your personal or shopping information.</p>
          </div>
          <div className="border border-white/[0.08] bg-[#11131A] p-4 space-y-2">
            <Shield className="w-5 h-5 text-[#D9362B]" />
            <h3 className="font-bold text-white uppercase font-sans">PCI-DSS Compliant</h3>
            <p className="text-[#A5AAB8] text-[11px]">Card and gateway processing handled by certified payment partners.</p>
          </div>
        </div>

        <div className="space-y-6 text-xs text-[#C8C5BC] leading-relaxed bg-[#11131A] border border-white/[0.08] p-6 sm:p-8 font-sans">
          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase text-white font-mono">1. Information We Collect</h2>
            <p>
              We collect information required to fulfill your orders and reward your wallet: contact details (name, email, mobile phone number), shipping addresses, bank account/UPI identifiers for payouts, and order history.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase text-white font-mono">2. Bank &amp; Payout Security</h2>
            <p>
              When you add a bank account for coin withdrawals, your account details are transmitted using end-to-end encryption. On screen, your account number is always masked (e.g., ••••••••1234) for privacy.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase text-white font-mono">3. Contacting the Data Protection Desk</h2>
            <p>
              If you have any questions or wish to request data erasure, reach out to our team at <span className="text-[#D9362B] font-mono">privacy@skywear.in</span> or via the <Link href="/support" className="text-[#D9362B] hover:underline">Support Desk</Link>.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
