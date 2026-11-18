import React from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import { ArrowLeft, Sparkles, ShieldCheck, Flame, Repeat, Award, Layers } from "lucide-react";

export const metadata = {
  title: "About Skywear Archive | 280 GSM Heavyweight Streetwear",
  description: "Skywear crafts oversized Japanese bio-wash streetwear backed by an unprecedented 100% circular cashback rewards system.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0A0B0E] text-[#F5F5F7] font-mono flex flex-col selection:bg-[#D9362B] selection:text-white">
      <Header />
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        <Link href="/" className="inline-flex items-center gap-2 text-xs text-[#8E929B] hover:text-white uppercase transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Storefront
        </Link>

        {/* Hero Banner */}
        <div className="border border-white/[0.08] bg-[#11131A] rounded-2xl p-8 sm:p-12 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#D9362B]/10 rounded-full blur-3xl pointer-events-none" />
          <span className="text-[10px] text-[#D9362B] font-bold uppercase tracking-[0.25em] block mb-2 font-mono">
            MANUFACTURING MANIFESTO · SKYWEAR STUDIO
          </span>
          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-white max-w-2xl" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>
            HEAVYWEIGHT ARCHIVE STREETWEAR. ZERO COMPROMISE.
          </h1>
          <p className="text-sm text-[#A5AAB8] mt-4 max-w-2xl font-sans leading-relaxed">
            Founded with a singular obsessive focus: craft the finest 280 GSM French Terry streetwear in India, combined with a revolutionary 100% circular cashback ecosystem where your style pays you back daily.
          </p>
        </div>

        {/* Three Core Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border border-white/[0.08] bg-[#11131A] rounded-xl p-6 space-y-3 shadow-xl hover:border-white/20 transition-all">
            <div className="w-10 h-10 rounded-lg bg-[#D9362B]/15 text-[#D9362B] flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white uppercase font-sans">280 GSM French Terry</h3>
            <p className="text-xs text-[#A5AAB8] leading-relaxed font-sans">
              Custom-spun 100% long-staple combed cotton engineered for structural drape, zero cling, and substantial hand-feel that outlasts dozens of standard fast-fashion t-shirts.
            </p>
          </div>

          <div className="border border-white/[0.08] bg-[#11131A] rounded-xl p-6 space-y-3 shadow-xl hover:border-white/20 transition-all">
            <div className="w-10 h-10 rounded-lg bg-[#00FF66]/15 text-[#00FF66] flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white uppercase font-sans">Japanese Bio-Wash</h3>
            <p className="text-xs text-[#A5AAB8] leading-relaxed font-sans">
              Pre-shrunk with an enzymatic cold silicone finish that locks the jet-black color, eliminates pilling, and produces a velvety ultra-soft surface against your skin.
            </p>
          </div>

          <div className="border border-white/[0.08] bg-[#11131A] rounded-xl p-6 space-y-3 shadow-xl hover:border-white/20 transition-all">
            <div className="w-10 h-10 rounded-lg bg-[#00F0FF]/15 text-[#00F0FF] flex items-center justify-center font-bold">
              <Repeat className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white uppercase font-sans">100% Withdrawable Sky Cash</h3>
            <p className="text-xs text-[#A5AAB8] leading-relaxed font-sans">
              Every paid order earns cashback coins in your separate coin wallet. Available coins are 100% withdrawable to your Indian bank account or UPI. Orders are always paid in INR.
            </p>
          </div>
        </div>

        {/* Detailed Story Sections */}
        <div className="space-y-8 bg-[#11131A] border border-white/[0.08] p-6 sm:p-10 font-sans text-xs text-[#C8C5BC] leading-relaxed">
          <section className="space-y-3">
            <span className="text-[10px] text-[#D9362B] font-mono uppercase tracking-widest font-bold">CHAPTER 01</span>
            <h2 className="text-xl font-bold uppercase text-white font-mono">The Rebellion Against Paper-Thin Apparel</h2>
            <p>
              Most commercial t-shirts are made from 160–180 GSM single jersey cotton that loses shape after two washes, shrinks unevenly, and clings uncomfortably. We refused to manufacture disposable clothing.
            </p>
            <p>
              Skywear garments are built from genuine 280 GSM heavyweight French Terry. The dropped shoulder silhouette is tailored with precision ribbing on the collar and reinforced double-needle cover-stitching across the hem and cuffs, ensuring the streetwear boxy drape remains crisp through endless wears.
            </p>
          </section>

          <section className="space-y-3 pt-6 border-t border-white/[0.08]">
            <span className="text-[10px] text-[#00FF66] font-mono uppercase tracking-widest font-bold">CHAPTER 02</span>
            <h2 className="text-xl font-bold uppercase text-white font-mono">How The Circular Cashback Protocol Works</h2>
            <p>
              We believe loyalty should never be rewarded with useless discount coupons that expire. Instead, we built a circular economy:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-[#A5AAB8]">
              <li>
                <strong className="text-white">100% Withdrawable to Bank / UPI:</strong> All Sky Cash rewards earned on your drops can be withdrawn directly into your bank or UPI account without restrictions.
              </li>
              <li>
                <strong className="text-white">Daily 3% Claim:</strong> Each calendar day at 12:00 AM IST, 3% of your pending Sky Cash becomes available to claim with a single tap.
              </li>
              <li>
                <strong className="text-white">Direct Indian Bank &amp; UPI Withdrawals:</strong> Transfer your available coins directly to any verified Indian Bank Account (NEFT/IMPS) or UPI ID without hidden fees.
              </li>
              <li>
                <strong className="text-white">Two separate units:</strong> Product prices and payments are always in INR. Cashback, referral rewards, wallets and withdrawals are tracked in coins only.
              </li>
            </ul>
          </section>

          <section className="space-y-3 pt-6 border-t border-white/[0.08]">
            <span className="text-[10px] text-[#D9362B] font-mono uppercase tracking-widest font-bold">CHAPTER 03</span>
            <h2 className="text-xl font-bold uppercase text-white font-mono">Limited Studio Drops &amp; Quality Control</h2>
            <p>
              We don&apos;t mass-produce thousands of units into warehouses. Each collection is released as a curated drop. Once a drop reaches allocation, the design enters the Skywear Archive. Each parcel is inspected by hand in our Mumbai studio before being packaged in tamper-proof polymer mailers.
            </p>
          </section>

          <div className="pt-6 border-t border-white/[0.08] flex flex-wrap gap-4 items-center justify-between">
            <div>
              <span className="text-white font-bold block text-sm font-mono">READY TO EXPERIENCE HEAVYWEIGHT STREETWEAR?</span>
              <span className="text-[#8E929B] text-[11px] font-mono">Explore our live Drop 001 releases and start earning cashback today.</span>
            </div>
            <Link
              href="/shop"
              className="px-6 py-3 bg-[#D9362B] hover:bg-[#F27A6F] text-white text-xs font-mono font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-2"
            >
              Shop The Drop <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
