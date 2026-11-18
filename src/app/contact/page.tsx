"use client";

import React, { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, MapPin, MessageSquare, Clock, CheckCircle2, Send, ShieldCheck } from "lucide-react";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    contact: "",
    orderId: "",
    subject: "Order Inquiry",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
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
            CLIENT CONCIERGE &amp; SUPPORT
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold uppercase text-white tracking-tight" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>
            Contact Skywear Studio
          </h1>
          <p className="text-xs text-[#8E929B] mt-2">
            Our support desk is online Monday through Saturday, 10:00 AM – 8:00 PM IST. Average response time: under 2 hours.
          </p>
        </div>

        {/* Contact Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-white/[0.08] bg-[#11131A] rounded-xl p-5 space-y-2 shadow-xl hover:border-white/20 transition-all">
            <div className="w-9 h-9 rounded-lg bg-[#00FF66]/15 text-[#00FF66] flex items-center justify-center font-bold">
              <Phone className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-white text-xs uppercase">WhatsApp &amp; Phone Desk</h3>
            <p className="text-[#A5AAB8] text-[11px] font-mono">+91 98765 43210</p>
            <p className="text-[#8E929B] text-[10px]">Direct priority messaging for tracking &amp; payouts.</p>
          </div>

          <div className="border border-white/[0.08] bg-[#11131A] rounded-xl p-5 space-y-2 shadow-xl hover:border-white/20 transition-all">
            <div className="w-9 h-9 rounded-lg bg-[#D9362B]/15 text-[#D9362B] flex items-center justify-center font-bold">
              <Mail className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-white text-xs uppercase">Official Email</h3>
            <p className="text-[#A5AAB8] text-[11px] font-mono">support@skywear.studio</p>
            <p className="text-[#8E929B] text-[10px]">For orders, corporate gifting &amp; press inquiries.</p>
          </div>

          <div className="border border-white/[0.08] bg-[#11131A] rounded-xl p-5 space-y-2 shadow-xl hover:border-white/20 transition-all">
            <div className="w-9 h-9 rounded-lg bg-[#00F0FF]/15 text-[#00F0FF] flex items-center justify-center font-bold">
              <MapPin className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-white text-xs uppercase">Studio &amp; Dispatch Hub</h3>
            <p className="text-[#A5AAB8] text-[11px]">Bandra West, Mumbai 400050</p>
            <p className="text-[#8E929B] text-[10px]">Maharashtra, Republic of India.</p>
          </div>
        </div>

        {/* Contact Form & Side FAQ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 bg-[#11131A] border border-white/[0.08] rounded-xl p-6 sm:p-8 shadow-2xl">
            <h2 className="text-base font-bold uppercase text-white font-mono mb-4 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#D9362B]" /> Send Us a Message
            </h2>

            {submitted ? (
              <div className="p-6 border border-[#00FF66]/40 bg-[#00FF66]/10 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-[#00FF66] mx-auto" />
                <h3 className="text-sm font-bold text-white uppercase">Inquiry Received</h3>
                <p className="text-xs text-[#C8C5BC] font-sans">
                  Thank you, {formData.name || "Customer"}. Our concierge team has logged ticket #{Math.floor(100000 + Math.random() * 900000)} and will reach out to {formData.contact || "you"} within 2 hours.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="mt-3 px-4 py-2 border border-white/[0.08] text-xs font-mono text-[#F5F5F7] hover:bg-[#0A0B0E]"
                >
                  Send Another Inquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase text-[#8E929B] mb-1 font-bold">Your Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Aman Sharma"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-[#0A0B0E] border border-white/[0.08] p-2.5 text-white focus:outline-none focus:border-[#D9362B]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-[#8E929B] mb-1 font-bold">Email or Phone Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. aman@example.com or 9876543210"
                      value={formData.contact}
                      onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                      className="w-full bg-[#0A0B0E] border border-white/[0.08] p-2.5 text-white focus:outline-none focus:border-[#D9362B]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase text-[#8E929B] mb-1 font-bold">Subject *</label>
                    <select
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full bg-[#0A0B0E] border border-white/[0.08] p-2.5 text-white focus:outline-none focus:border-[#D9362B]"
                    >
                      <option value="Order Tracking">Order Tracking &amp; Delivery</option>
                      <option value="Cashback Coins & Withdrawal">Cashback Coins &amp; Bank Withdrawal</option>
                      <option value="Size & Fit Exchange">Size &amp; Fit Exchange</option>
                      <option value="Damaged / Defect Replacement">Damaged / Defect Replacement</option>
                      <option value="General Question">General Question</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-[#8E929B] mb-1 font-bold">Order ID (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. TC_6140"
                      value={formData.orderId}
                      onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
                      className="w-full bg-[#0A0B0E] border border-white/[0.08] p-2.5 text-white focus:outline-none focus:border-[#D9362B]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-[#8E929B] mb-1 font-bold">Your Message *</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Describe how we can assist you..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full bg-[#0A0B0E] border border-white/[0.08] p-2.5 text-white focus:outline-none focus:border-[#D9362B]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#D9362B] hover:bg-[#F27A6F] text-white font-bold uppercase tracking-wider text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" /> Submit Inquiry
                </button>
              </form>
            )}
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="bg-[#11131A] border border-white/[0.08] p-5 space-y-3 text-xs">
              <h3 className="font-bold text-white uppercase font-mono flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#00FF66]" /> Live Support Hours
              </h3>
              <p className="text-[#A5AAB8] text-[11px] leading-relaxed font-sans">
                Our support team is available live 6 days a week to help with sizing, live tracking, and coins clearance:
              </p>
              <div className="space-y-1 text-[11px] font-mono border-t border-white/[0.08] pt-2">
                <div className="flex justify-between text-[#C8C5BC]">
                  <span>Mon – Fri:</span>
                  <span className="text-white">10:00 AM – 8:00 PM IST</span>
                </div>
                <div className="flex justify-between text-[#C8C5BC]">
                  <span>Saturday:</span>
                  <span className="text-white">11:00 AM – 6:00 PM IST</span>
                </div>
                <div className="flex justify-between text-[#8E929B]">
                  <span>Sunday:</span>
                  <span>Automated Dispatch Only</span>
                </div>
              </div>
            </div>

            <div className="bg-[#11131A] border border-white/[0.08] p-5 space-y-2 text-xs">
              <h3 className="font-bold text-white uppercase font-mono">Instant Self-Service</h3>
              <p className="text-[#A5AAB8] text-[11px] leading-relaxed font-sans">
                Need immediate status on your order or cashback claims? Use these dedicated links:
              </p>
              <div className="space-y-2 pt-2">
                <Link
                  href="/track"
                  className="block p-2.5 bg-[#0A0B0E] hover:bg-[rgba(255,255,255,0.08)] text-white text-[11px] font-mono border border-white/[0.08] transition-colors"
                >
                  → Track Order Delivery Status
                </Link>
                <Link
                  href="/app/account/wallet"
                  className="block p-2.5 bg-[#0A0B0E] hover:bg-[rgba(255,255,255,0.08)] text-[#00FF66] text-[11px] font-mono border border-white/[0.08] transition-colors"
                >
                  → Claim Today&apos;s 3% Cashback Coins
                </Link>
                <Link
                  href="/policies/refund"
                  className="block p-2.5 bg-[#0A0B0E] hover:bg-[rgba(255,255,255,0.08)] text-white text-[11px] font-mono border border-white/[0.08] transition-colors"
                >
                  → Return &amp; Exchange Guidelines
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
