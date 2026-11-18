"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import {
  Wallet,
  Coins,
  ArrowRight,
  TrendingUp,
  Package,
  Share2,
  Check,
  Copy,
  Star,
  RefreshCw,
  ShoppingBag,
  Zap,
  ShieldCheck,
  ArrowUpRight,
  Truck,
  Heart,
  ChevronRight,
  Clock,
  Layers,
  MessageCircle,
  Award,
} from "lucide-react";
import type { CustomerAccount } from "@/data/rewardsEngine";
import type { Product } from "@/data/products";
import { getProductCoins } from "@/lib/catalog";
import { copyText } from "@/lib/clipboard";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { cartLineId } from "@/lib/cart";
import { formatRupees } from "@/lib/domain";

interface MemberStorefrontViewProps {
  customer: CustomerAccount;
  products: Product[];
  cartCount: number;
  wishlistCount: number;
  onAddToCart: (item: any) => void;
  onBuyNow: (item: any) => void;
  inWishlist: (id: string) => boolean;
  onToggleWishlist?: (id: string) => void;
}

// Mask sensitive identifiers (e.g. +91 98*** **321 or vi***@gmail.com)
function maskSensitive(value?: string | null): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    return `+91 ${last10.slice(0, 2)}*** **${last10.slice(-3)}`;
  }
  if (value.includes("@")) {
    const [name, domain] = value.split("@");
    if (name.length <= 2) return `${name}***@${domain}`;
    return `${name.slice(0, 2)}***${name.slice(-1)}@${domain}`;
  }
  if (value.length > 8) {
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
  }
  return value;
}

export default function MemberStorefrontView({
  customer: initialCustomer,
  products,
  cartCount,
  wishlistCount,
  onAddToCart,
  onBuyNow,
  inWishlist,
  onToggleWishlist,
}: MemberStorefrontViewProps) {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerAccount>(initialCustomer);
  const [copiedLink, setCopiedLink] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [addedItemIds, setAddedItemIds] = useState<Record<string, boolean>>({});

  // Selected sizes per product card
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({
    "zenin-choso-oversized-tee": "L",
    "zenin-limitless-gojo-tee": "L",
    "zenin-butterfly-luxury-tee": "L",
    "zenin-betrayed-oversized-tee": "L",
  });

  // Front/Back interactive view state per product
  const [previewSides, setPreviewSides] = useState<Record<string, "front" | "back">>({
    "zenin-choso-oversized-tee": "front",
    "zenin-limitless-gojo-tee": "front",
    "zenin-butterfly-luxury-tee": "front",
    "zenin-betrayed-oversized-tee": "front",
  });

  // Real-time coin & balance values
  const availableCoins = customer.availableCoins || 0;
  const pendingCoins = customer.pendingCoins || 0;
  const lifetimeEarned = customer.lifetimeEarnedCoins || 0;
  const referralCode = customer.referralCode || "";
  const referralCash = customer.referralCoinBalance || 0;

  // Check if daily claim is available today (Asia/Kolkata timezone)
  const todayKolkata = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const isDailyClaimClaimed = customer.lastDailyClaimDate === todayKolkata;

  // Approximate today's daily 3% unlock slice (1/30th of pending)
  const todaysExpectedUnlockCoins = Math.max(1, Math.ceil(pendingCoins * 0.033));

  // Toggle front/back product mockups
  const handleToggleSide = (productId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPreviewSides((prev) => ({
      ...prev,
      [productId]: prev[productId] === "back" ? "front" : "back",
    }));
  };

  // Select size
  const handleSizeSelect = (productId: string, size: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedSizes((prev) => ({ ...prev, [productId]: size }));
  };

  // Add to Bag with tactile feedback and temporary checkmark state
  const handleAdd = (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const size = selectedSizes[product.id] || product.sizes[0] || "L";
    const side = previewSides[product.id] || "front";
    const color = product.colors?.[0] || { name: "Onyx Black", hex: "#0B0C10" };
    const lineId = cartLineId(product.id, size, color.name, side);
    const itemImg = side === "back" ? (product.imageBackUrl || product.imageUrl) : product.imageUrl;

    onAddToCart({
      id: lineId,
      productId: product.id,
      title: product.title,
      price: product.price,
      quantity: 1,
      size,
      colorName: color.name,
      colorHex: color.hex,
      side,
      imageUrl: itemImg,
    });

    setAddedItemIds((prev) => ({ ...prev, [product.id]: true }));
    setTimeout(() => {
      setAddedItemIds((prev) => ({ ...prev, [product.id]: false }));
    }, 1500);

    toast.success("Added to Bag", {
      description: `${product.title} (Size ${size}) reserved in bag.`,
      duration: 2000,
    });
  };

  // Buy Now
  const handleBuy = (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const size = selectedSizes[product.id] || product.sizes[0] || "L";
    const side = previewSides[product.id] || "front";
    const color = product.colors?.[0] || { name: "Onyx Black", hex: "#0B0C10" };
    const lineId = cartLineId(product.id, size, color.name, side);
    const itemImg = side === "back" ? (product.imageBackUrl || product.imageUrl) : product.imageUrl;

    onBuyNow({
      id: lineId,
      productId: product.id,
      title: product.title,
      price: product.price,
      quantity: 1,
      size,
      colorName: color.name,
      colorHex: color.hex,
      side,
      imageUrl: itemImg,
    });
    router.push("/checkout");
  };

  // Instant 1-Tap Daily Cashback Claim
  const handleDailyClaim = async () => {
    if (claiming || isDailyClaimClaimed || pendingCoins <= 0) return;
    setClaiming(true);
    try {
      const res = await fetch("/api/wallet/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.customer) {
        setCustomer(data.customer);

        void confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.55 },
          colors: ["#00FF66", "#00F0FF", "#F59E0B", "#FFFFFF"],
        });

        toast.success("Daily Sky Cash Unlocked!", {
          description: `${(data.claimedPoints || 0).toLocaleString("en-IN")} Coins moved to live withdrawable balance.`,
          duration: 3500,
        });
      } else {
        toast.error("Claim Status", {
          description: data?.error || "Your daily claim is complete for today. Next slice unlocks tomorrow at 00:00 IST.",
        });
      }
    } catch {
      toast.error("Network issue. Please check your connection and retry.");
    } finally {
      setClaiming(false);
    }
  };

  // Copy referral invite
  const copyReferralInvite = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://skywear.in";
    const inviteUrl = `${origin}/invite/${referralCode}`;
    void copyText(inviteUrl).then((copied) => {
      if (!copied) return;
      setCopiedLink(true);
      toast.success("Invite Link Copied!", {
        description: inviteUrl,
        duration: 2500,
      });
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  // WhatsApp 1-tap share with pre-filled message
  const shareViaWhatsApp = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://skywear.in";
    const inviteUrl = `${origin}/invite/${referralCode}`;
    const text = `Hey! Check out SKYWEAR — luxury 240-280 GSM oversized streetwear. Use my VIP link to get 100% daily cashback on your order:\n${inviteUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
  };

  // Filter products
  const filteredProducts =
    activeCategory === "ALL"
      ? products
      : activeCategory === "ANIME"
      ? products.filter(
          (p) =>
            p.category?.toLowerCase().includes("anime") ||
            p.theme?.toLowerCase().includes("jujutsu") ||
            p.title?.toLowerCase().includes("choso") ||
            p.title?.toLowerCase().includes("gojo")
        )
      : products.filter((p) => (p.gsm ?? 0) >= 280);

  return (
    <div className="min-h-screen bg-[#0B0C10] text-[#F5F5F7] flex flex-col font-mono selection:bg-[#00FF66] selection:text-[#0B0C10] antialiased relative overflow-x-hidden">
      {/* Brand Header */}
      <Header
        cartCount={cartCount}
        wishlistCount={wishlistCount}
        customer={customer}
        isLoggedIn={true}
      />

      {/* Main Container with generous bottom safe area for fixed bottom navigation */}
      <main className="relative z-10 flex-1 max-w-[1440px] mx-auto w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 sm:space-y-8 pb-24 md:pb-12">
        {/* ========================================================= */}
        {/* 1. COMPACT MEMBER DASHBOARD & WALLET COMMAND MODULE       */}
        {/* ========================================================= */}
        <section className="rounded-2xl bg-[#12141A] border border-white/[0.08] p-4 sm:p-5 shadow-xl space-y-5">
          {/* Top Row: Greeting, Status Pill & Daily Claim Action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#00FF66]/10 text-[#00FF66] border border-[#00FF66]/30 inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00FF66] animate-pulse" />
                  {customer.tier || "VIP"} MEMBER
                </span>
                <span className="text-[11px] font-mono text-[#8E929B]">
                  {maskSensitive(customer.phone || customer.email)}
                </span>
              </div>
              <h1
                className="text-xl sm:text-2xl font-extrabold uppercase text-white tracking-tight leading-tight"
                style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
              >
                Welcome back, {customer.name?.split(" ")[0] || "VIP"}
              </h1>
            </div>

            {/* Daily Cashback Claim Action */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDailyClaim}
                disabled={claiming || isDailyClaimClaimed || pendingCoins <= 0}
                className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 transition-all duration-150 active:scale-[0.98] cursor-pointer shadow-sm ${
                  isDailyClaimClaimed
                    ? "bg-[#1A1D24] text-[#8E929B] border border-white/[0.06] cursor-not-allowed"
                    : pendingCoins <= 0
                    ? "bg-[#1A1D24] text-[#8E929B] border border-white/[0.06] cursor-not-allowed"
                    : "bg-[#00FF66] hover:bg-[#00e65c] text-[#0B0C10] shadow-[0_0_15px_rgba(0,255,102,0.25)]"
                }`}
              >
                <Zap className={`w-4 h-4 ${claiming ? "animate-spin" : isDailyClaimClaimed ? "text-[#8E929B]" : "fill-current"}`} />
                <span>
                  {claiming
                    ? "CLAIMING..."
                    : isDailyClaimClaimed
                    ? "TODAY'S SLICE CLAIMED ✓"
                    : pendingCoins > 0
                    ? `CLAIM DAILY SLICE (+${todaysExpectedUnlockCoins})`
                    : "SHOP TO START 100% CASHBACK"}
                </span>
              </button>
            </div>
          </div>

          {/* Financial Telemetry Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
            {/* Primary Card: Available Withdrawable Balance */}
            <div className="rounded-xl bg-[#161922] border border-[#00FF66]/30 p-4 relative flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between text-[#8E929B] mb-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#00FF66]">
                    Live Withdrawable Balance
                  </span>
                  <Coins className="w-4 h-4 text-[#00FF66]" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {availableCoins.toLocaleString("en-IN")}{" "}
                  <span className="text-sm sm:text-base font-bold text-[#00FF66]">Coins</span>
                </div>
                <div className="text-[11px] text-[#8E929B] mt-0.5 font-semibold">
                  Live Sky Cash
                </div>
              </div>

              {/* Primary Withdrawal CTA */}
              <Link
                href="/wallet"
                className="w-full min-h-[40px] px-3 rounded-lg bg-[#00FF66] hover:bg-[#00e65c] text-[#0B0C10] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-[0.98] shadow-sm"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Withdraw to UPI ↗</span>
              </Link>
            </div>

            {/* Stat Card 2: Pending Cashback Vault */}
            <div className="rounded-xl bg-[#161922] border border-white/[0.06] p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between text-[#8E929B] mb-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider">
                    Pending Vault
                  </span>
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {pendingCoins.toLocaleString("en-IN")}{" "}
                  <span className="text-sm sm:text-base font-bold text-amber-400">Coins</span>
                </div>
                <div className="text-[11px] text-amber-400 mt-0.5 font-semibold">
                  Locked Coins
                </div>
              </div>

              <div className="text-[10px] text-[#8E929B] border-t border-white/[0.06] pt-2 flex items-center justify-between">
                <span>Vesting: ~3.3%/day</span>
                <span className="text-white font-semibold">30-day cycle</span>
              </div>
            </div>

            {/* Stat Card 3: Referral Cash Bounty */}
            <div className="rounded-xl bg-[#161922] border border-white/[0.06] p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between text-[#8E929B] mb-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider">
                    Referral Coins
                  </span>
                  <Share2 className="w-4 h-4 text-[#00F0FF]" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-[#00F0FF] tracking-tight">
                  {Math.round(referralCash).toLocaleString("en-IN")}{" "}
                  <span className="text-sm sm:text-base font-bold text-[#00F0FF]">Coins</span>
                </div>
                <div className="text-[11px] text-[#8E929B] mt-0.5 font-semibold">
                  10% Direct Reward
                </div>
              </div>

              <div className="text-[10px] text-[#8E929B] border-t border-white/[0.06] pt-2 flex items-center justify-between">
                <span>Status: Withdrawable</span>
                <Link href="/app/account/affiliate" className="text-[#00F0FF] hover:underline font-bold flex items-center gap-0.5">
                  <span>Hub ↗</span>
                </Link>
              </div>
            </div>

            {/* Stat Card 4: Lifetime Value Returned */}
            <div className="rounded-xl bg-[#161922] border border-white/[0.06] p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between text-[#8E929B] mb-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider">
                    Lifetime Cashback
                  </span>
                  <Award className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {lifetimeEarned.toLocaleString("en-IN")}{" "}
                  <span className="text-sm sm:text-base font-bold text-emerald-400">Coins</span>
                </div>
                <div className="text-[11px] text-[#8E929B] mt-0.5 font-semibold">
                  Total Issued
                </div>
              </div>

              <div className="text-[10px] text-[#8E929B] border-t border-white/[0.06] pt-2 flex items-center justify-between">
                <span>Direct UPI Payouts</span>
                <span className="text-[#00FF66] font-bold">100% Back</span>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 2. COMPACT REFERRAL REWARD CARD                           */}
        {/* ========================================================= */}
        <section className="rounded-2xl bg-[#12141A] border border-white/[0.08] p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#00FF66]/10 border border-[#00FF66]/30 flex items-center justify-center text-[#00FF66] shrink-0">
              <Share2 className="w-5 h-5" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold uppercase text-white tracking-tight truncate">
                  Referral Program: Earn 10% Cash + Give 100% Rebate
                </span>
              </div>
              <p className="text-xs text-[#8E929B] font-mono truncate sm:overflow-visible sm:whitespace-normal">
                Share your VIP link. When friends order, you get 10% instant withdrawable cash and they get 100% cashback.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full md:w-auto shrink-0">
            {/* Referral Code Badge */}
            <div className="px-3 py-2 rounded-xl bg-[#0B0C10] border border-white/10 text-xs font-mono font-bold text-[#00FF66]">
              {referralCode || "SKYWEAR-VIP"}
            </div>

            {/* Primary Action: Copy Invite Link */}
            <button
              type="button"
              onClick={copyReferralInvite}
              className="flex-1 sm:flex-none min-h-[40px] px-4 rounded-xl bg-[#00FF66] hover:bg-[#00e65c] text-[#0B0C10] text-xs font-mono font-bold uppercase flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-[0.98] cursor-pointer shadow-sm"
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? "Link Copied!" : "Copy Link"}</span>
            </button>

            {/* WhatsApp 1-Tap */}
            <button
              type="button"
              onClick={shareViaWhatsApp}
              className="min-h-[40px] px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-[#0B0C10] text-xs font-mono font-bold uppercase flex items-center justify-center gap-1 transition-all duration-150 active:scale-[0.98] cursor-pointer"
              title="Share on WhatsApp"
            >
              <MessageCircle className="w-4 h-4 fill-current" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>

            {/* Secondary CTA: Affiliate Hub */}
            <Link
              href="/app/account/affiliate"
              className="min-h-[40px] px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/10 text-xs font-mono font-semibold flex items-center justify-center gap-1 transition-all"
            >
              <span>Hub</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#8E929B]" />
            </Link>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 3. PRODUCT CATALOG (CLEAN, PROPORTIONAL, UNCLUTTERED)     */}
        {/* ========================================================= */}
        <section className="space-y-4">
          {/* Header & Filter Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
            <div>
              <span className="text-[10px] font-mono font-bold tracking-widest text-[#00FF66] uppercase block">
                // STREETWEAR ARCHIVE
              </span>
              <h2
                className="text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-white"
                style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
              >
                Heavyweight Oversized Drops
              </h2>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: "ALL", label: `ALL (${products.length})` },
                { id: "280 GSM", label: "280 GSM TERRY" },
                { id: "ANIME", label: "ANIME CAPSULES" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all duration-150 cursor-pointer whitespace-nowrap active:scale-[0.98] ${
                    activeCategory === cat.id
                      ? "bg-[#00FF66] text-[#0B0C10] font-black"
                      : "bg-[#161922] text-[#8E929B] hover:text-white border border-white/[0.06]"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2-Column Mobile (320px+ compatible), 3-Column Tablet, 4-Column Desktop */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-5">
            {filteredProducts.map((product) => {
              const currentSide = previewSides[product.id] || "front";
              const activeSize = selectedSizes[product.id] || product.sizes[0] || "L";
              const displayImage =
                currentSide === "back"
                  ? product.imageBackUrl || product.imageUrl
                  : product.imageUrl;
              const coins = getProductCoins(product);
              const isWishlisted = inWishlist(product.id);
              const isAdded = addedItemIds[product.id];

              return (
                <div
                  key={product.id}
                  className="rounded-xl bg-[#12141A] border border-white/[0.08] hover:border-white/20 transition-all duration-150 flex flex-col justify-between overflow-hidden group shadow-md"
                >
                  {/* Clean Proportional Image Container (aspect-[3/4]) */}
                  <div className="relative aspect-[3/4] bg-[#0E1017] p-2.5 sm:p-3 flex items-center justify-center overflow-hidden border-b border-white/[0.06]">
                    <Link
                      href={`/product/${product.slug}`}
                      className="w-full h-full flex items-center justify-center cursor-pointer"
                    >
                      <img
                        src={displayImage}
                        alt={product.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-105"
                      />
                    </Link>

                    {/* Single Minimal Badge (Top Left) */}
                    <div className="absolute top-2 left-2 z-10 pointer-events-none">
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-[#0B0C10]/90 text-white border border-white/10 shadow-sm">
                        {product.gsm || 240} GSM
                      </span>
                    </div>

                    {/* Controls (Top Right): Wishlist & Flip */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                      {onToggleWishlist && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onToggleWishlist(product.id);
                            toast(isWishlisted ? "Removed from Wishlist" : "Saved to Wishlist", {
                              icon: isWishlisted ? "💔" : "❤️",
                              duration: 1500,
                            });
                          }}
                          className={`min-w-[32px] min-h-[32px] rounded-lg flex items-center justify-center transition-all duration-150 active:scale-90 cursor-pointer shadow-sm ${
                            isWishlisted
                              ? "bg-rose-500 text-white"
                              : "bg-[#0B0C10]/90 text-[#8E929B] hover:text-white border border-white/10"
                          }`}
                          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                        >
                          <Heart className={`w-3.5 h-3.5 ${isWishlisted ? "fill-current" : ""}`} />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => handleToggleSide(product.id, e)}
                        className="min-h-[32px] px-2 rounded-lg bg-[#0B0C10]/90 hover:bg-[#161922] text-[#8E929B] hover:text-white border border-white/10 text-[9px] font-mono font-bold uppercase transition-colors flex items-center gap-1 active:scale-95 cursor-pointer shadow-sm"
                        title="Toggle Front/Back View"
                      >
                        <RefreshCw className="w-2.5 h-2.5" />
                        <span>{currentSide === "front" ? "BACK" : "FRONT"}</span>
                      </button>
                    </div>

                    {/* Subtle Cashback Badge (Bottom) */}
                    <div className="absolute bottom-2 left-2 right-2 bg-[#0B0C10]/90 backdrop-blur-sm border border-white/10 px-2 py-0.5 rounded-md flex items-center justify-between text-[9px] z-10 pointer-events-none">
                      <span className="text-[#00FF66] font-mono font-bold">
                        +{coins.toLocaleString("en-IN")} Coins
                      </span>
                      <span className="text-white/70 font-mono font-semibold">
                        100% Back
                      </span>
                    </div>
                  </div>

                  {/* Card Content & Interactive Controls */}
                  <div className="p-2.5 sm:p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Product Title (Max 2 lines, strictly enforced) */}
                      <Link href={`/product/${product.slug}`} className="block">
                        <h3
                          className="text-xs sm:text-sm font-bold uppercase text-white tracking-tight leading-snug line-clamp-2 min-h-[2.25rem] hover:text-[#00FF66] transition-colors"
                          style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
                        >
                          {product.title}
                        </h3>
                      </Link>

                      {/* Price Strip */}
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-sm sm:text-base font-extrabold text-white font-sans">
                          {formatRupees(product.price)}
                        </span>
                        <span className="text-xs text-[#8E929B] line-through font-sans">
                          {formatRupees(product.mrp)}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-[#00FF66] ml-auto">
                          Net ₹0
                        </span>
                      </div>
                    </div>

                    {/* Mobile-Comfortable Size Selection */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[9px] text-[#8E929B] font-mono">
                        <span>SIZE</span>
                        <span className="text-white font-bold">{activeSize}</span>
                      </div>
                      <div className="grid grid-cols-5 gap-1">
                        {product.sizes.slice(0, 5).map((sz) => (
                          <button
                            key={sz}
                            type="button"
                            onClick={(e) => handleSizeSelect(product.id, sz, e)}
                            className={`min-h-[32px] sm:min-h-[34px] rounded-md text-[10px] font-mono font-bold uppercase transition-all duration-100 flex items-center justify-center cursor-pointer ${
                              activeSize === sz
                                ? "bg-[#00FF66] text-[#0B0C10] font-black"
                                : "bg-[#161922] text-[#8E929B] hover:text-white border border-white/[0.06]"
                            }`}
                          >
                            {sz}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Action Controls: Compact Add to Bag + Prominent Buy Now */}
                    <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={(e) => handleAdd(product, e)}
                        className={`min-h-[38px] rounded-lg border text-xs font-mono font-bold uppercase flex items-center justify-center gap-1 transition-all duration-150 active:scale-[0.98] cursor-pointer ${
                          isAdded
                            ? "bg-[#00FF66]/20 border-[#00FF66] text-[#00FF66]"
                            : "bg-[#161922] hover:bg-[#1E222E] border-white/10 text-white"
                        }`}
                      >
                        {isAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#00FF66]" />
                            <span>Added</span>
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="w-3.5 h-3.5 text-[#8E929B]" />
                            <span>Bag</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleBuy(product, e)}
                        className="min-h-[38px] rounded-lg bg-[#00FF66] hover:bg-[#00e65c] text-[#0B0C10] text-xs font-mono font-extrabold uppercase flex items-center justify-center transition-all duration-150 active:scale-[0.98] shadow-sm cursor-pointer"
                      >
                        Buy Now
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ========================================================= */}
        {/* 4. MEMBER PROTOCOL STRIP (QUICK ACCESS NAVIGATION)        */}
        {/* ========================================================= */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 pt-2">
          <Link
            href="/app/account/orders"
            className="group p-3 sm:p-4 rounded-xl bg-[#12141A] border border-white/[0.08] hover:border-[#00FF66]/40 transition-colors flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white uppercase tracking-tight truncate flex items-center gap-1">
                <span>Orders</span>
                <ChevronRight className="w-3 h-3 text-[#8E929B] group-hover:translate-x-0.5 transition-transform" />
              </div>
              <div className="text-[10px] text-[#8E929B] font-mono truncate">BlueDart tracking</div>
            </div>
          </Link>

          <Link
            href="/wallet"
            className="group p-3 sm:p-4 rounded-xl bg-[#12141A] border border-white/[0.08] hover:border-[#00FF66]/40 transition-colors flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-lg bg-[#00FF66]/10 flex items-center justify-center text-[#00FF66] shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white uppercase tracking-tight truncate flex items-center gap-1">
                <span>UPI Payouts</span>
                <ChevronRight className="w-3 h-3 text-[#8E929B] group-hover:translate-x-0.5 transition-transform" />
              </div>
              <div className="text-[10px] text-[#8E929B] font-mono truncate">Instant bank cashouts</div>
            </div>
          </Link>

          <Link
            href="/app/account/rewards"
            className="group p-3 sm:p-4 rounded-xl bg-[#12141A] border border-white/[0.08] hover:border-[#00FF66]/40 transition-colors flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-lg bg-amber-400/10 flex items-center justify-center text-amber-400 shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white uppercase tracking-tight truncate flex items-center gap-1">
                <span>Vesting Ledger</span>
                <ChevronRight className="w-3 h-3 text-[#8E929B] group-hover:translate-x-0.5 transition-transform" />
              </div>
              <div className="text-[10px] text-[#8E929B] font-mono truncate">30-day schedule</div>
            </div>
          </Link>

          <Link
            href="/size-guide"
            className="group p-3 sm:p-4 rounded-xl bg-[#12141A] border border-white/[0.08] hover:border-[#00FF66]/40 transition-colors flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white uppercase tracking-tight truncate flex items-center gap-1">
                <span>240-280 GSM</span>
                <ChevronRight className="w-3 h-3 text-[#8E929B] group-hover:translate-x-0.5 transition-transform" />
              </div>
              <div className="text-[10px] text-[#8E929B] font-mono truncate">Sizing chart</div>
            </div>
          </Link>
        </section>
      </main>

      {/* Global Footer */}
      <Footer />
    </div>
  );
}
