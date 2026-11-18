"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { toCartLinePayload, useCart, useWishlist } from "@/lib/cart";
import { api } from "@/lib/client";
import type { QuoteResult, StorefrontSnapshot } from "@/lib/contracts";
import { DELIVERY_FEE, FREE_SHIPPING_THRESHOLD, formatRupees } from "@/lib/domain";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, ArrowLeft, ShieldCheck, Truck, RotateCcw, Coins, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function CartPage() {
  const router = useRouter();
  const cart = useCart();
  const wishlist = useWishlist();

  const [snapshot, setSnapshot] = useState<StorefrontSnapshot | null>(null);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await api.storefront();
        if (mounted) {
          setSnapshot(data);
          if (data.products?.length) {
            cart.syncPrices(data.products);
          }
        }
      } catch (err) {
        console.error("Storefront fetch failed:", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Recalculate quote whenever items or applied coupon change
  useEffect(() => {
    if (cart.items.length === 0) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    setQuoteLoading(true);

    api
      .quoteOrder({ items: toCartLinePayload(cart.items), couponCode: appliedCoupon || undefined })
      .then((q) => {
        if (!cancelled) {
          setQuote(q);
          setCouponError(null);
        }
      })
      .catch((err) => {
        console.error("Quote failed:", err);
        if (!cancelled && appliedCoupon) {
          setCouponError(err?.message || "Invalid or expired promo code");
          setAppliedCoupon("");
        }
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cart.items, appliedCoupon]);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    const code = coupon.trim().toUpperCase();
    if (!code) return;
    setCouponError(null);
    setAppliedCoupon(code);
    toast.success(`Promo code applied: ${code}`);
    try {
      sessionStorage.setItem("zenin_applied_coupon", code);
    } catch {}
  };

  const baseDeliveryFee = quote?.baseDeliveryFee ?? snapshot?.deliveryFee ?? DELIVERY_FEE;
  const shippingMode = quote?.shippingMode ?? snapshot?.shippingMode ?? "MIN_AMOUNT";
  const shippingThreshold = quote?.freeShippingThreshold ?? snapshot?.freeShippingThreshold ?? FREE_SHIPPING_THRESHOLD;
  const currentSubtotal = quote?.subtotal ?? cart.localSubtotal;
  const freeAllOrders = baseDeliveryFee <= 0;
  const flatAllOrders = !freeAllOrders && shippingMode === "ALL_PRODUCTS";
  const remainingForFreeShipping =
    freeAllOrders || flatAllOrders ? 0 : Math.max(0, shippingThreshold - currentSubtotal);
  const freeShippingProgress =
    freeAllOrders || flatAllOrders || shippingThreshold <= 0
      ? 100
      : Math.min(100, Math.round((currentSubtotal / shippingThreshold) * 100));

  return (
    <div className="min-h-screen bg-[#0A0B0E] text-[#F5F5F7] flex flex-col font-mono selection:bg-[#D9362B] selection:text-white antialiased">
      <Header
        cartCount={cart.count}
        wishlistCount={wishlist.count}
        walletPoints={snapshot?.customer?.availableCoins ?? 0}
      />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Breadcrumb / Back Navigation */}
        <div className="flex items-center gap-2 text-xs font-mono text-[#8E929B] mb-8">
          <Link href="/" className="hover:text-white flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> STORE
          </Link>
          <span className="text-white/20">/</span>
          <span className="text-white uppercase font-bold">SHOPPING BAG ({cart.count})</span>
        </div>

        {cart.items.length === 0 ? (
          /* Empty Cart State */
          <div className="max-w-md mx-auto py-24 text-center flex flex-col items-center">
            <div className="w-20 h-20 rounded-2xl bg-[#11131A] border border-white/[0.08] flex items-center justify-center text-[#8E929B] mb-6 shadow-xl">
              <ShoppingBag className="w-9 h-9" />
            </div>
            <h1
              className="text-2xl sm:text-3xl font-bold uppercase tracking-tight text-white mb-2"
              style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
            >
              Your bag is empty
            </h1>
            <p className="text-xs font-sans text-[#8E929B] max-w-xs mb-8 leading-relaxed">
              Explore the latest Skywear heavy-density drops and claim your 280 GSM oversized pieces with 100% wallet cashback.
            </p>
            <Link
              href="/shop"
              className="px-7 py-4 bg-[#D9362B] hover:bg-[#B82B22] text-white font-mono text-xs font-bold uppercase tracking-widest transition-all rounded-lg shadow-xl shadow-[#D9362B]/20 active:scale-95"
            >
              EXPLORE DROPS ↘
            </Link>
          </div>
        ) : (
          /* Cart with Items */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-12 items-start">
            
            {/* Left 7 Cols: Items List */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                <div>
                  <span className="text-[10px] text-[#D9362B] font-bold uppercase tracking-widest block font-mono">
                    ORDER MANIFEST
                  </span>
                  <h1
                    className="text-2xl sm:text-3xl font-bold uppercase tracking-tight text-white"
                    style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
                  >
                    Shopping Bag
                  </h1>
                </div>
                <span className="text-xs font-mono text-[#8E929B] bg-white/[0.04] px-3 py-1 rounded-full border border-white/[0.08]">
                  {cart.count} {cart.count === 1 ? "PIECE" : "PIECES"}
                </span>
              </div>

              {/* Free Shipping Progress Meter */}
              <div className="p-4 bg-[#11131A] border border-white/[0.08] rounded-xl font-mono text-xs space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  {freeAllOrders ? (
                    <span className="flex items-center gap-2 text-[#00FF66] font-bold">
                      <Truck className="w-4 h-4" />
                      <span>FREE BLUEDART AIR DISPATCH ON ALL ORDERS</span>
                    </span>
                  ) : flatAllOrders ? (
                    <span className="flex items-center gap-2 text-[#A5AAB8]">
                      <Truck className="w-4 h-4 text-[#D9362B]" />
                      <span>
                        Standard flat shipping charge of <strong className="text-white">{formatRupees(baseDeliveryFee)}</strong> applies to all products
                      </span>
                    </span>
                  ) : remainingForFreeShipping > 0 ? (
                    <span className="flex items-center gap-2 text-[#A5AAB8]">
                      <Truck className="w-4 h-4 text-[#D9362B]" />
                      Add <strong className="text-white">{formatRupees(remainingForFreeShipping)}</strong> more for <strong className="text-[#00FF66]">FREE Air Courier</strong>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-[#00FF66] font-bold">
                      <Truck className="w-4 h-4" />
                      <span>QUALIFIED FOR FREE BLUEDART AIR DISPATCH</span>
                    </span>
                  )}
                  {!flatAllOrders && (
                    <span className="text-[10px] text-[#8E929B] font-mono">
                      {freeShippingProgress}% UNLOCKED
                    </span>
                  )}
                </div>
                {/* Meter Bar */}
                {!flatAllOrders && (
                  <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#D9362B] to-[#00FF66] transition-all duration-300 rounded-full"
                      style={{ width: `${freeShippingProgress}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Items Card List */}
              <div className="space-y-3">
                {cart.items.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 sm:p-5 bg-[#11131A] border border-white/[0.08] rounded-xl flex gap-4 sm:gap-6 items-center transition-all hover:border-white/20"
                  >
                    {/* Item Thumbnail */}
                    <div className="w-20 h-24 sm:w-24 sm:h-28 bg-[#0A0B0E] border border-white/[0.06] rounded-lg overflow-hidden shrink-0 flex items-center justify-center p-2">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <ShoppingBag className="w-6 h-6 text-[#8E929B]" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0 font-mono">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[9px] text-[#D9362B] font-bold uppercase tracking-wider block">
                            280 GSM TERRY
                          </span>
                          <h2 className="text-sm sm:text-base font-bold text-white uppercase truncate font-sans">
                            {item.title}
                          </h2>
                        </div>
                        <button
                          onClick={() => {
                            cart.removeItem(item.id);
                            toast.error(`Removed ${item.title} from bag`);
                          }}
                          className="text-[#8E929B] hover:text-[#D9362B] transition-colors p-1.5 rounded-md hover:bg-white/[0.04] active:scale-95"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="mt-1 flex items-center gap-3 text-xs text-[#8E929B]">
                        <span>SIZE: <strong className="text-white">{item.size}</strong></span>
                        <span className="text-white/20">•</span>
                        <span>COLOR: <strong className="text-white">{item.colorName}</strong></span>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-4">
                        {/* Quantity Stepper */}
                        <div className="flex items-center border border-white/[0.08] bg-[#0A0B0E] rounded-md overflow-hidden">
                          <button
                            onClick={() => cart.updateQuantity(item.id, -1)}
                            className="p-1.5 px-2.5 text-[#8E929B] hover:text-white hover:bg-white/[0.04] transition-colors active:scale-95"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-7 text-center text-xs font-bold text-white">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => cart.updateQuantity(item.id, 1)}
                            className="p-1.5 px-2.5 text-[#8E929B] hover:text-white hover:bg-white/[0.04] transition-colors active:scale-95"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Price */}
                        <div className="text-right">
                          <span
                            className="text-base sm:text-lg font-bold text-white block"
                            style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
                          >
                            {formatRupees(item.price * item.quantity)}
                          </span>
                          {item.quantity > 1 && (
                            <span className="block text-[10px] text-[#8E929B]">
                              {formatRupees(item.price)} each
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right 5 Cols: Order Summary & Checkout */}
            <div className="lg:col-span-5 bg-[#11131A] border border-white/[0.08] rounded-xl p-6 sm:p-8 font-mono sticky top-24 shadow-2xl">
              <h2
                className="text-lg font-bold uppercase tracking-tight text-white mb-6 border-b border-white/[0.08] pb-3"
                style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
              >
                Order Summary
              </h2>

              {/* Coupon Form */}
              <form onSubmit={handleApplyCoupon} className="mb-3 flex gap-2">
                <input
                  type="text"
                  placeholder="ENTER PROMO CODE"
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  className="flex-1 bg-[#0A0B0E] border border-white/[0.08] rounded-md px-3.5 py-2.5 text-xs text-white placeholder-[#8E929B] focus:outline-none focus:border-[#D9362B] font-mono uppercase"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-white/[0.08] hover:bg-white hover:text-black text-white text-xs font-bold uppercase tracking-wider rounded-md transition-all active:scale-95"
                >
                  APPLY
                </button>
              </form>

              {couponError && (
                <p className="mb-3 text-[11px] text-rose-400 font-mono flex items-center gap-1">
                  <span>⚠</span> {couponError}
                </p>
              )}

              {appliedCoupon && (
                <div className="mb-4 text-xs flex items-center justify-between text-[#00FF66] bg-[#00FF66]/10 p-2.5 rounded-lg border border-[#00FF66]/30">
                  <span className="font-bold">✓ PROMO CODE &apos;{appliedCoupon}&apos; APPLIED</span>
                  <button
                    onClick={() => {
                      setAppliedCoupon("");
                      setCoupon("");
                      setCouponError(null);
                      try {
                        sessionStorage.removeItem("zenin_applied_coupon");
                      } catch {}
                    }}
                    className="text-white/60 hover:text-white font-bold px-1"
                    title="Remove coupon"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* 100% Sky Cash Cashback Banner */}
              <div className="mb-4 p-3 bg-[#00FF66]/[0.05] border border-[#00FF66]/20 rounded-lg flex items-center justify-between text-xs">
                <span className="text-[#00FF66] font-bold flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-[#00FF66]" /> 100% SKY CASH REBATE
                </span>
                <span className="text-white font-bold">
                  +{formatRupees(quote?.total ?? cart.localSubtotal)}
                </span>
              </div>

              {/* Breakdown */}
              <div className="space-y-3 text-xs border-b border-white/[0.08] pb-4 mb-4 text-[#A5AAB8]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="text-white font-bold">
                    {formatRupees(quote?.subtotal ?? cart.localSubtotal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated Delivery</span>
                  <span className="text-white font-bold">
                    {(quote ? quote.deliveryFee === 0 : freeAllOrders || (!flatAllOrders && currentSubtotal >= shippingThreshold)) ? (
                      <span className="text-[#00FF66]">FREE</span>
                    ) : (
                      formatRupees(quote?.deliveryFee ?? baseDeliveryFee)
                    )}
                  </span>
                </div>
                {(quote?.couponDiscount ?? 0) > 0 && (
                  <div className="flex justify-between text-[#00FF66] font-bold">
                    <span>Discount ({quote?.couponLabel || appliedCoupon})</span>
                    <span>-{formatRupees(quote!.couponDiscount)}</span>
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="flex items-end justify-between mb-6">
                <div>
                  <span className="text-xs uppercase font-bold text-[#8E929B] block">Total Amount</span>
                  <span className="text-[10px] text-[#8E929B]">Inclusive of all taxes &amp; GST</span>
                </div>
                <span
                  className="text-2xl sm:text-3xl font-bold text-white"
                  style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
                >
                  {formatRupees(quote?.total ?? cart.localSubtotal)}
                </span>
              </div>

              {/* Checkout CTA */}
              <Link
                href={appliedCoupon ? `/checkout?coupon=${encodeURIComponent(appliedCoupon)}` : "/checkout"}
                className="w-full py-4 bg-[#D9362B] hover:bg-[#B82B22] text-white flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest rounded-lg shadow-xl shadow-[#D9362B]/20 transition-all active:scale-[0.98]"
              >
                <span>PROCEED TO CHECKOUT</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              {/* Guarantees */}
              <div className="mt-6 pt-4 border-t border-white/[0.08] space-y-2.5 text-[11px] text-[#8E929B]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#D9362B] shrink-0" />
                  <span>7-Day Quality Guarantee &amp; Size Exchange</span>
                </div>
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>Dispatched via BlueDart / Delhivery in 48 Hours</span>
                </div>
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-[#00FF66] shrink-0" />
                  <span>100% Cashable Wallet Balance on Delivery</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer onSelectCategory={() => router.push("/")} />
    </div>
  );
}
