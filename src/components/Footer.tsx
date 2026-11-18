"use client";

import React from "react";
import Link from "next/link";
import { Coins, ShieldCheck, Truck, RotateCcw, ArrowRight } from "lucide-react";
import { type SupportConfig } from "@/lib/support";
import SkywearLogo from "@/components/SkywearLogo";
import { useSession } from "@/context/SessionContext";

interface FooterProps {
  support?: SupportConfig;
  isLoggedIn?: boolean;
  onOpenTrackOrder?: () => void;
  onOpenSizeChart?: () => void;
  onSelectCategory?: (category: string) => void;
}

export default function Footer({
  support,
  isLoggedIn: initialIsLoggedIn,
  onOpenTrackOrder,
  onOpenSizeChart,
  onSelectCategory,
}: FooterProps) {
  const { loggedIn } = useSession();
  const isLoggedIn = initialIsLoggedIn ?? loggedIn;

  // When user is logged in, do not show footer section
  if (isLoggedIn) {
    return null;
  }

  return (
    <footer id="footer-section" className="border-t border-white/[0.08] bg-[#07080B] text-[#8E929B] font-mono mt-20 select-none transition-colors">
      {/* Reassurance Strip */}
      <div className="border-b border-white/[0.06] py-8">
        <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-xs">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-[#D9362B] shrink-0" />
            <div>
              <p className="font-bold text-white uppercase">280 GSM Heavyweight</p>
              <p className="text-[11px] text-[#717684]">Pure combed French Terry cotton</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Coins className="w-5 h-5 text-[#00FF66] shrink-0" />
            <div>
              <p className="font-bold text-[#00FF66] uppercase">100% Sky Cash</p>
              <p className="text-[11px] text-[#717684]">Direct bank transfer rebate</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Truck className="w-5 h-5 text-blue-400 shrink-0" />
            <div>
              <p className="font-bold text-white uppercase">Express Air Dispatch</p>
              <p className="text-[11px] text-[#717684]">48-Hour BlueDart tracked delivery</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <RotateCcw className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="font-bold text-white uppercase">7-Day Free Exchange</p>
              <p className="text-[11px] text-[#717684]">Zero friction doorstep replacement</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12">
          {/* Brand info */}
          <div className="md:col-span-4 space-y-4">
            <Link href="/" className="inline-block group active:scale-[0.98] transition-transform">
              <SkywearLogo size="md" />
            </Link>
            <p className="text-xs text-[#8E929B] max-w-sm leading-relaxed">
              Original heavyweight streetwear engineered with 280 GSM pure combed cotton. Every order unlocks 100% Sky Cash withdrawable straight to UPI.
            </p>
          </div>

          {/* Explore */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Explore
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/shop" className="hover:text-white transition-colors">
                  Shop All Drops
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-white transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/size-guide" className="hover:text-white transition-colors">
                  Size Guide
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-white transition-colors">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Support */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Customer Support
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/track" className="hover:text-white transition-colors">
                  Track Order
                </Link>
              </li>
              <li>
                <Link href="/support" className="hover:text-white transition-colors">
                  Help &amp; Support
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/wallet" className="hover:text-[#00FF66] transition-colors flex items-center gap-1">
                  <span>Sky Cash Wallet</span>
                  <span className="text-[9px] px-1 bg-[#00FF66]/20 text-[#00FF66] rounded font-bold">UPI</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & Policies */}
          <div className="md:col-span-2 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Legal &amp; Policies
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/policies/shipping" className="hover:text-white transition-colors">
                  Shipping Policy
                </Link>
              </li>
              <li>
                <Link href="/policies/refund" className="hover:text-white transition-colors">
                  Refund &amp; Exchange
                </Link>
              </li>
              <li>
                <Link href="/policies/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/policies/terms" className="hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#717684]">
          <div>© {new Date().getFullYear()} SKYWEAR STUDIO. 280 GSM Pure Combed French Terry Cotton.</div>
          <div className="flex items-center gap-4 text-[11px] flex-wrap">
            <span>Made in India</span>
            <span>•</span>
            <span className="text-[#00FF66] font-bold">100% Cash Rebate Protocol</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
