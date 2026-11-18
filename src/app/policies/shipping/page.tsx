import React from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import { ArrowLeft, Truck, Clock, ShieldCheck, MapPin } from "lucide-react";

export const metadata = {
  title: "Shipping & Delivery Policy | Skywear",
  description: "Learn about our nationwide express delivery via BlueDart Express & Delhivery.",
};

export default function ShippingPolicyPage() {
  return (
    <div className="min-h-screen bg-[#0A0B0E] text-[#F5F5F7] font-mono flex flex-col selection:bg-[#D9362B] selection:text-white">
      <Header />
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <Link href="/" className="inline-flex items-center gap-2 text-xs text-[#8E929B] hover:text-white uppercase transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Storefront
        </Link>

        <div className="border-b border-white/[0.08] pb-6">
          <span className="text-[10px] text-[#D9362B] font-bold uppercase tracking-widest block mb-1">
            SKYWEAR LOGISTICS MANIFEST
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold uppercase text-white tracking-tight" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>
            Shipping &amp; Delivery Policy
          </h1>
          <p className="text-xs text-[#8E929B] mt-2">
            Last updated: October 2026 • Real-time courier dispatch via BlueDart Express &amp; Delhivery Air.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="border border-white/[0.08] bg-[#11131A] p-4 space-y-2">
            <Truck className="w-5 h-5 text-[#D9362B]" />
            <h3 className="font-bold text-white uppercase font-sans">Dispatch TAT</h3>
            <p className="text-[#A5AAB8] text-[11px]">Orders enter POD print queue immediately and dispatch within 24–48 hours.</p>
          </div>
          <div className="border border-white/[0.08] bg-[#11131A] p-4 space-y-2">
            <Clock className="w-5 h-5 text-[#00FF66]" />
            <h3 className="font-bold text-white uppercase font-sans">Delivery Timeline</h3>
            <p className="text-[#A5AAB8] text-[11px]">Metro cities: 2–3 business days. Rest of India: 3–5 business days.</p>
          </div>
          <div className="border border-white/[0.08] bg-[#11131A] p-4 space-y-2">
            <ShieldCheck className="w-5 h-5 text-[#D9362B]" />
            <h3 className="font-bold text-white uppercase font-sans">Tamper-Proof Pack</h3>
            <p className="text-[#A5AAB8] text-[11px]">High-grade polymailer packaging with verifiable security seal.</p>
          </div>
        </div>

        <div className="space-y-6 text-xs text-[#C8C5BC] leading-relaxed bg-[#11131A] border border-white/[0.08] p-6 sm:p-8 font-sans">
          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase text-white font-mono">1. Shipping Charges</h2>
            <p>
              We offer <strong className="text-white">Free Express Shipping</strong> on all prepaid orders (UPI, Credit/Debit Cards, NetBanking, and Coin Payments). A nominal standard handling fee of ₹99 may apply to Cash on Delivery (COD) orders depending on customer destination pincode.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase text-white font-mono">2. Real-Time Order Tracking</h2>
            <p>
              Once your heavyweight garment is dispatched, you will receive an automated tracking link with an Air Waybill (AWB) number via SMS, WhatsApp, and email. You can also track your live shipment manifest anytime directly on our <Link href="/track" className="text-[#D9362B] hover:underline font-bold">Order Tracking Page</Link>.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase text-white font-mono">3. Serviceable Pincodes</h2>
            <p>
              We deliver to over 19,000+ pin codes across India through our premium logistics partners (BlueDart, Delhivery, DTDC, and Ecom Express). If your pin code is remote or non-serviceable by private courier, we dispatch via India Post Speed Post.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
