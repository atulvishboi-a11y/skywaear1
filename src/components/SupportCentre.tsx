"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, Clock, Coins, Mail, MessageCircle, MessageSquare, Phone, ShieldCheck, Sparkles, Truck } from "lucide-react";
import type { SupportCentre as SupportCentreData } from "@/lib/contracts";
import { api } from "@/lib/client";
import { formatRupees } from "@/lib/domain";
import { callUrl, digitsOnly, formatSupportPhone, mailUrl, whatsappUrl } from "@/lib/support";

export default function SupportCentre() {
  const [data, setData] = useState<SupportCentreData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await api.support());
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Support details failed to load");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const support = data?.support;
  const rules = data?.rewardRules;
  const faq = rules
    ? [
        {
          group: "Orders & delivery",
          icon: Truck,
          items: [
            {
              q: "Where is my order right now?",
              a: `Every tee is printed to order at our Tirupur POD unit — printing takes about 48 hours, then 4-7 working days in transit. Use the Track Order button on the store with your order number and the mobile or email you checked out with. Send us the TC_ number on WhatsApp and a human checks the live POD queue for you.`,
            },
            {
              q: "Is there free delivery?",
              a: data
                ? data.deliveryFee <= 0
                  ? "Yes! Delivery is currently FREE on all orders."
                  : data.shippingMode === "ALL_PRODUCTS"
                  ? `A flat shipping charge of ${formatRupees(data.deliveryFee)} applies to all orders.`
                  : `Delivery is ${formatRupees(data.deliveryFee)} per order and free above ${formatRupees(data.freeShippingThreshold)}.`
                : "Delivery charges are shown at checkout.",
            },
            {
              q: "Can I change the address or PIN code after ordering?",
              a: "Yes, if it has not been printed yet. Message us the order number with the new PIN code — while the order is still PENDING we can update it. Once it moves to PRINTING_POD the courier route is locked.",
            },
          ],
        },
        {
          group: "Sky Cash, cashback & payouts",
          icon: Coins,
          items: [
            {
              q: "How much cashback do I earn?",
              a: "Each drop carries its own cashback in coins. The coin amount shown on the product page is exactly what gets credited to your pending wallet once the order is paid.",
            },
            {
              q: "When do my coins unlock?",
              a: "Cashback coins unlock daily across a 30-day cycle starting on Day 1 after payment. Unlocked coins move from the pending wallet to your live wallet automatically.",
            },
            {
              q: "Can I pay for an order with coins?",
              a: "No. Product prices, checkout and payments are always in rupees through the payment gateway. Coins are a reward balance you can withdraw directly to your bank account.",
            },
            {
              q: "Can I withdraw coins to my bank account?",
              a: data
                ? `Yes — open your account wallet and request a payout to your verified Bank Account from ${data.minWithdrawalCoins} coins upwards. Payouts are transferred via NEFT/IMPS.`
                : "Yes — request a direct bank transfer payout from your wallet.",
            },
            {
              q: "What happens if I cancel an order?",
              a: "Cashback that had not been released yet is reversed and any referral commission earned on that order is clawed back.",
            },
          ],
        },
        {
          group: "Returns, replacements & refunds",
          icon: ShieldCheck,
          items: [
            {
              q: "Can I return or exchange a tee?",
              a: "No. Every SKYWARE piece is printed on demand for you, so all sales are final — there are no returns or exchanges, including on size or colour. Please check the size guide before you order.",
            },
            {
              q: "What if it arrives damaged or the wrong print?",
              a: "That is on us. Message this number on WhatsApp with a photo of the tag and the print within 7 days of delivery and we ship a replacement free — no return pickup, no waiting for a refund.",
            },
            {
              q: "Do prepaid orders get refunded?",
              a: "If we cancel an order you paid for online, the full amount is refunded to the original payment method within 5-7 working days, ",
            },
          ],
        },
        {
          group: "Sizing & fabric",
          icon: Sparkles,
          items: [
            {
              q: "How does the fit run?",
              a: "All our tees are drop-shoulder oversized in 240 GSM bio-washed combed cotton. They run roomy — if you want a regular fit, go one size down. The exact chest and length chart is on every product page under Size & Fit Guide.",
            },
            {
              q: "Will the print fade?",
              a: "We print with high-density DTG on pre-shrunk fabric. It is built to hold through 50+ washes; wash cold, inside out, and skip the iron on the print.",
            },
            {
              q: "How do referral coins work?",
              a: rules
                ? `Share your SKYWARE code and you earn ${rules.referralCommissionPercent}% of what your friend pays, credited as coins as soon as their order is paid. Your friend earns their own cashback coins, set per product.`
                : "Share your SKYWARE code from your account wallet.",
            },
          ],
        },
      ]
    : [];

  return (
    <main className="min-h-screen bg-[#0B0C10] font-mono text-[#F5F5F7]">
      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4 border-b border-[#282C34] py-5">
          <Link href="/" className="text-2xl font-black tracking-[0.25em] text-[#F5F5F7]">
            SKYWARE
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-none border border-[#282C34] bg-[#16181D] px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#F5F5F7] hover:bg-[#282C34] hover:text-[#00FF66] transition-all"
          >
            <ArrowLeft className="h-4 w-4" /> Back to store
          </Link>
        </header>

        {loadError ? (
          <p className="mt-10 rounded-none border border-[#FF4D4D]/40 bg-[#16181D] p-4 text-sm text-[#FF4D4D] font-mono">{loadError}</p>
        ) : !support ? (
          <p className="mt-10 animate-pulse rounded-none border border-[#282C34] bg-[#16181D] p-6 text-sm text-[#8E929B] font-mono">
            Loading the support desk…
          </p>
        ) : (
          <>
            <section className="mt-8 sm:mt-12">
              <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#8E929B]">Customer support</p>
              <h1 className="mt-2 text-3xl sm:text-5xl font-black uppercase tracking-tight text-[#F5F5F7] leading-none">
                Talk to a human, not a bot
              </h1>
              <p className="mt-3 max-w-2xl text-xs sm:text-sm text-[#A0A5B5] font-mono leading-relaxed">
                Order stuck in printing, coins not unlocking, or a wrong size shipped — message us and we sort it on the
                same channel.
              </p>
              <p className="mt-3 inline-flex items-center gap-2 rounded-none border border-[#282C34] bg-[#16181D] px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-[#00FF66]">
                <Clock className="h-3.5 w-3.5" /> {support.hours}
              </p>
            </section>

            <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined" && window.Tawk_API) {
                    try {
                      window.Tawk_API.showWidget?.();
                      window.Tawk_API.maximize?.();
                    } catch {}
                  }
                }}
                className="group rounded-none border border-[#00FF66]/50 bg-[#16181D] p-5 text-left text-[#F5F5F7] transition-all hover:border-[#00FF66] hover:bg-[#1E222B] cursor-pointer shadow-[0_0_15px_rgba(0,255,102,0.1)] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#00FF66]">
                    <MessageSquare className="h-4 w-4" /> Live Web Chat — Instant
                  </div>
                  <p className="mt-3 text-xl font-black text-[#F5F5F7] font-mono">Talk to Concierge</p>
                  <p className="mt-2 text-xs font-mono text-[#A0A5B5]">
                    Chat live with our human support team directly in your browser.
                  </p>
                </div>
                <span className="mt-4 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#00FF66] group-hover:gap-2 transition-all">
                  Open Live Chat →
                </span>
              </button>

              <a
                href={whatsappUrl(support)}
                target="_blank"
                rel="noreferrer"
                className="group rounded-none border border-[#00FF66]/40 bg-[#16181D] p-5 text-[#F5F5F7] transition-all hover:border-[#00FF66]"
              >
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#00FF66]">
                  <MessageCircle className="h-4 w-4" /> WhatsApp — fastest
                </div>
                <p className="mt-3 text-xl font-black text-[#F5F5F7] font-mono">{formatSupportPhone(support.whatsappNumber)}</p>
                <p className="mt-2 text-xs font-mono text-[#A0A5B5]">
                  Chat opens with your first line already typed. Include your order number for a faster reply.
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#00FF66] group-hover:gap-2 transition-all">
                  Start chat →
                </span>
              </a>

              {digitsOnly(support.callNumber) ? (
                <a
                  href={callUrl(support)}
                  className="group rounded-none border border-[#282C34] bg-[#16181D] p-5 transition-all hover:border-[#F5F5F7]"
                >
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#8E929B] group-hover:text-[#F5F5F7]">
                    <Phone className="h-4 w-4" /> Call the desk
                  </div>
                  <p className="mt-3 text-xl font-black text-[#F5F5F7] font-mono">{formatSupportPhone(support.callNumber)}</p>
                  <p className="mt-2 text-xs font-mono text-[#8E929B]">{support.hours}</p>
                </a>
              ) : null}

              <a
                href={mailUrl(support, "SKYWARE order help")}
                className="rounded-none border border-[#282C34] bg-[#16181D] p-5 transition-all hover:border-[#F5F5F7]"
              >
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#8E929B]">
                  <Mail className="h-4 w-4" /> Email
                </div>
                <p className="mt-3 text-xl font-black text-[#F5F5F7] font-mono break-all">{support.email}</p>
                <p className="mt-2 text-xs font-mono text-[#8E929B]">
                  Best for invoices, bulk or press queries — we reply within one working day.
                </p>
              </a>
            </section>

            <section className="mt-12 mb-16 space-y-8">
              {faq.map((block) => (
                <div key={block.group}>
                  <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.25em] text-[#00FF66] font-mono">
                    <block.icon className="h-4 w-4" /> {block.group}
                  </h2>
                  <div className="mt-3 divide-y divide-[#282C34] rounded-none border border-[#282C34] bg-[#16181D]">
                    {block.items.map((item) => (
                      <details key={item.q} className="group">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 text-xs font-bold text-[#F5F5F7] uppercase tracking-wide hover:bg-[#0B0C10] transition-colors">
                          <span>{item.q}</span>
                          <ChevronDown className="h-4 w-4 shrink-0 text-[#8E929B] transition-transform group-open:rotate-180" />
                        </summary>
                        <p className="px-4 pb-4 text-xs font-mono leading-relaxed text-[#A0A5B5]">{item.a}</p>
                      </details>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          </>
        )}

        <footer className="border-t border-[#282C34] py-6 text-[11px] font-mono text-[#8E929B]">
          © 2026 SKYWARE Clothing Co. — all sales final, no returns or exchanges.
        </footer>
      </div>
    </main>
  );
}
