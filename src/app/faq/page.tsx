"use client";

import React, { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Sparkles, Coins, Truck, ShieldCheck, HelpCircle } from "lucide-react";

interface FAQItem {
  q: string;
  a: string;
}

interface FAQCategory {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: FAQItem[];
}

const FAQ_DATA: FAQCategory[] = [
  {
    title: "Sky Cash Rewards Protocol",
    icon: Coins,
    items: [
      {
        q: "How does the 100% Withdrawable Sky Cash system work?",
        a: "Every paid order earns cashback coins, configured per product. Available coins are 100% withdrawable to your UPI ID or Indian bank account. Coins cannot be used to pay for a tee — every order is priced and paid in INR.",
      },
      {
        q: "Can I use coins for store purchases?",
        a: "No. Product prices, cart totals and checkout are always in INR, paid by card, UPI, net banking or cash on delivery. Coins are reward units only and never discount, modify or pay a price.",
      },
      {
        q: "What is the Daily 3% Claim feature?",
        a: "To sustain a circular economic model, your pending Sky Cash unlocks at a predictable daily rate of 3% every single calendar day. Every night at 12:00 AM IST, your 3% daily tranche unlocks. Simply tap 'Claim Today's 3%' in your Account or Wallet to transfer Sky Cash into your Live Available Wallet.",
      },
      {
        q: "How are referral coins calculated?",
        a: "Referral coins = the referred member's eligible paid order amount in INR × the referral percentage ÷ 100. At the 10% default, a ₹4,599 order credits 459.90 coins to the referrer. Referral coins are separate from cashback and are never credited in rupees.",
      },
    ],
  },
  {
    title: "Indian Bank Account & UPI Withdrawals",
    icon: Sparkles,
    items: [
      {
        q: "How do I withdraw my Sky Cash?",
        a: "Go to your Cashback Wallet, tap 'Withdraw Sky Cash', choose between UPI (e.g. yourname@okhdfcbank) or Indian Bank Transfer (Account Number + IFSC Code), and enter the coin amount. The coins are reserved from your balance when you submit, and the payout desk releases them in the scheduled tranches shown on the request.",
      },
      {
        q: "What is the minimum withdrawal limit?",
        a: "The minimum withdrawal is set by the store and shown in your wallet before you confirm (500 Coins by default). There is no upper limit on withdrawals.",
      },
      {
        q: "How long does payout clearance take and how do I track UTR?",
        a: "UPI transfers are typically cleared within 2 to 6 hours during banking hours. Bank NEFT/IMPS transfers clear within 12–24 hours. Once transferred, the official 12-digit bank UTR reference number is permanently logged in your Payout History.",
      },
      {
        q: "Can I save multiple bank accounts?",
        a: "Yes. You can save your Indian bank accounts in your Profile or Cashback Wallet. All account numbers are masked for your security (e.g. ••••••••5019) with automated IFSC verification.",
      },
    ],
  },
  {
    title: "Heavyweight 280 GSM Cotton & Sizing",
    icon: ShieldCheck,
    items: [
      {
        q: "What makes Skywear 280 GSM French Terry unique?",
        a: "Standard retail t-shirts range between 160–180 GSM and feel limp and thin. Skywear uses genuine 280 GSM high-density French Terry cotton. This produces a structural, non-clinging boxy silhouette that drapes cleanly over your shoulders and body.",
      },
      {
        q: "Are the garments pre-shrunk?",
        a: "Yes. Every batch undergoes a Japanese bio-wash and enzymatic silicone pre-shrinking process. They will not shrink or lose their drape when washed according to care instructions (cold machine wash, line dry in shade).",
      },
      {
        q: "How does the sizing fit?",
        a: "All Skywear silhouettes are tailored with an intentional, relaxed streetwear oversized drop-shoulder cut. If you want the modern aesthetic drop-shoulder look, order your standard true-to-size. For a standard regular fit, size down one size.",
      },
    ],
  },
  {
    title: "Shipping, Tracking & Returns",
    icon: Truck,
    items: [
      {
        q: "How fast is shipping and which couriers are used?",
        a: "We ship nationwide via air cargo using BlueDart Express and Delhivery. Metro cities receive delivery in 2–3 business days; rest of India takes 3–5 business days. Real-time GPS tracking is provided via SMS and on our Tracking page.",
      },
      {
        q: "What is your return & exchange policy?",
        a: "We provide a 7-day hassle-free size exchange and defect replacement window from the date of delivery. If you have sizing issues or receive a defective unit, simply reach out to our concierge desk or WhatsApp hotline for a doorstep reverse pickup.",
      },
    ],
  },
];

export default function FAQPage() {
  const [openItems, setOpenItems] = useState<{ [key: string]: boolean }>({
    "0-0": true,
    "0-1": true,
  });

  const toggle = (catIndex: number, itemIndex: number) => {
    const key = `${catIndex}-${itemIndex}`;
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="min-h-screen bg-[#0A0B0E] text-[#F5F5F7] font-mono flex flex-col selection:bg-[#D9362B] selection:text-white">
      <Header />
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
        <Link href="/" className="inline-flex items-center gap-2 text-xs text-[#8E929B] hover:text-white uppercase transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Storefront
        </Link>

        <div className="border-b border-white/[0.08] pb-6">
          <span className="text-[10px] text-[#D9362B] font-bold uppercase tracking-widest block mb-1">
            KNOWLEDGE BASE &amp; PROTOCOL GUIDE
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold uppercase text-white tracking-tight" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>
            Frequently Asked Questions
          </h1>
          <p className="text-xs text-[#8E929B] mt-2">
            Clear, transparent answers about our 280 GSM heavyweight apparel, 100% circular cashback, daily 3% claims, and bank withdrawals.
          </p>
        </div>

        {/* Categories */}
        <div className="space-y-8">
          {FAQ_DATA.map((cat, catIdx) => {
            const Icon = cat.icon;
            return (
              <div key={cat.title} className="space-y-4">
                <div className="flex items-center gap-2 text-white font-mono text-sm font-bold uppercase tracking-wider border-b border-white/[0.08] pb-2">
                  <Icon className="w-4 h-4 text-[#D9362B]" />
                  <span>{cat.title}</span>
                </div>

                <div className="space-y-2">
                  {cat.items.map((item, itemIdx) => {
                    const isOpen = Boolean(openItems[`${catIdx}-${itemIdx}`]);
                    return (
                      <div
                        key={item.q}
                        className="border border-white/[0.08] bg-[#11131A] rounded-xl transition-all overflow-hidden shadow-sm"
                      >
                        <button
                          onClick={() => toggle(catIdx, itemIdx)}
                          className="w-full p-4 text-left flex items-center justify-between gap-4 text-xs font-bold text-white uppercase hover:text-[#D9362B] transition-colors"
                        >
                          <span className="font-mono">{item.q}</span>
                          <ChevronDown
                            className={`w-4 h-4 text-[#8E929B] shrink-0 transition-transform duration-200 ${
                              isOpen ? "rotate-180 text-[#D9362B]" : ""
                            }`}
                          />
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-4 pt-1 text-xs text-[#A5AAB8] font-sans leading-relaxed border-t border-white/[0.08]">
                            {item.a}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Help Box */}
        <div className="bg-[#11131A] border border-white/[0.08] rounded-xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div>
            <h3 className="text-sm font-bold uppercase text-white font-mono">Still have questions?</h3>
            <p className="text-xs text-[#8E929B] font-mono mt-1">Our Mumbai studio team is ready to assist you on WhatsApp.</p>
          </div>
          <Link
            href="/contact"
            className="px-5 py-3 bg-[#D9362B] hover:bg-[#B82B22] text-white text-xs font-mono font-bold uppercase tracking-widest rounded-lg transition-all active:scale-95 shadow-lg shadow-[#D9362B]/20 shrink-0"
          >
            Contact Support Desk
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
