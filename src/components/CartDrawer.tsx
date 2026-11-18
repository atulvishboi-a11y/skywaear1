"use client";

import React, { useEffect, useState } from "react";
import { CartItem } from "../data/products";
import type { QuoteResult } from "@/lib/contracts";
import { FREE_SHIPPING_THRESHOLD, formatRupees, type Coupon } from "@/lib/domain";
import TShirtMockup from "./TShirtMockup";
import {
  ArrowRight,
  Coins,
  Loader2,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Trash2,
  Truck,
  X,
} from "lucide-react";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  quote: QuoteResult | null;
  coupon: string;
  coupons: Coupon[];
  couponError: string | null;
  onApplyCoupon: (code: string) => void;
  onRemoveCoupon: () => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onOpenCheckout: () => void;
  quoteLoading?: boolean;
}

export default function CartDrawer({
  isOpen,
  onClose,
  items,
  quote,
  coupon,
  coupons,
  couponError,
  onApplyCoupon,
  onRemoveCoupon,
  onUpdateQuantity,
  onRemoveItem,
  onOpenCheckout,
  quoteLoading,
}: CartDrawerProps) {
  const isQuoting = Boolean(quoteLoading) || quote === null;
  const unitCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const shippingMode = quote?.shippingMode ?? "MIN_AMOUNT";
  const shippingThreshold = quote?.freeShippingThreshold ?? FREE_SHIPPING_THRESHOLD;
  const baseDeliveryFee = quote?.baseDeliveryFee;
  const freeAllOrders = baseDeliveryFee !== undefined && baseDeliveryFee <= 0;
  const flatAllOrders = !freeAllOrders && shippingMode === "ALL_PRODUCTS";
  const shippingQualified = quote !== null && quote.deliveryFee === 0;
  const remainingForFreeShipping =
    quote && !freeAllOrders && !flatAllOrders
      ? Math.max(0, shippingThreshold - quote.subtotal)
      : 0;
  const shippingProgress = quote
    ? freeAllOrders || flatAllOrders || shippingThreshold <= 0
      ? 100
      : Math.min(100, Math.round((quote.subtotal / shippingThreshold) * 100))
    : 0;

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 overflow-hidden ${isOpen ? "" : "pointer-events-none"}`}
      inert={!isOpen}
      aria-hidden={!isOpen}
    >
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-200 ease-out ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
      />

      <div className="absolute inset-y-0 right-0 flex max-w-full pl-10 font-mono">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="cart-drawer-title"
          style={{ transitionTimingFunction: "var(--ease-drawer)" }}
          className={`flex w-full flex-col border-l border-[#282C34] bg-[#0B0C10] text-[#F5F5F7] shadow-2xl transition-transform duration-220 overscroll-contain sm:max-w-md ${
            isOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <header className="flex items-center justify-between gap-3 border-b border-[#282C34] bg-[#16181D] p-5">
            <div className="flex min-w-0 items-center gap-2">
              <ShoppingBag className="h-5 w-5 shrink-0 text-[#00FF66]" />
              <h2
                id="cart-drawer-title"
                className="truncate text-base font-black uppercase tracking-wider text-white font-sans"
                style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
              >
                Your Cart
              </h2>
              <span className="shrink-0 rounded-none bg-[#00FF66] px-2 py-0.5 font-mono text-xs font-bold text-[#0B0C10]">
                {unitCount} {unitCount === 1 ? "pc" : "pcs"}
              </span>
            </div>
            <button
              onClick={onClose}
              aria-label="Close cart"
              className="flex min-h-10 min-w-10 items-center justify-center rounded-none text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="border-b border-[#282C34] bg-[#16181D]/80 p-3.5">
            <div className="mb-1.5 flex items-center justify-between gap-2 text-xs font-medium">
              <span className="flex min-w-0 items-center gap-1.5 text-white">
                <Truck className="h-4 w-4 shrink-0 text-[#00FF66]" />
                {quote === null ? (
                  <span className="truncate text-neutral-400">Checking delivery status…</span>
                ) : shippingQualified ? (
                  <span className="truncate font-bold text-[#00FF66]">
                    FREE express delivery unlocked
                  </span>
                ) : flatAllOrders ? (
                  <span className="truncate text-neutral-300">
                    Flat shipping: {formatRupees(quote.deliveryFee)} per order
                  </span>
                ) : (
                  <span className="truncate text-neutral-300">
                    Add {formatRupees(remainingForFreeShipping)} more for FREE delivery
                  </span>
                )}
              </span>
              {!flatAllOrders && (
                <span className="shrink-0 font-mono text-xs font-bold text-white">
                  {quote === null ? "—" : `${shippingProgress}%`}
                </span>
              )}
            </div>
            {!flatAllOrders && (
              <div className="h-1.5 w-full overflow-hidden rounded-none bg-[#0B0C10] border border-[#282C34]">
                <div
                  className={`h-full rounded-none transition-all duration-500 ${
                    shippingQualified ? "bg-[#00FF66]" : "bg-[#00F0FF]"
                  } ${quote === null ? "w-1/3 animate-pulse bg-neutral-600" : ""}`}
                  style={quote === null ? undefined : { width: `${shippingProgress}%` }}
                />
              </div>
            )}
            <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-[#8E929B]">
              {freeAllOrders
                ? "Free delivery on all orders"
                : flatAllOrders
                ? `Standard shipping ${formatRupees(baseDeliveryFee ?? quote?.deliveryFee ?? 0)} applies on all orders`
                : `Free delivery above ${formatRupees(shippingThreshold)}`}
            </p>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden p-4 sm:p-5">
            {items.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center text-neutral-400">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-none border border-[#282C34] bg-[#16181D]">
                  <ShoppingBag className="h-8 w-8 text-neutral-500" />
                </div>
                <h3 className="mb-1 text-base font-bold uppercase text-white font-mono">Your bag is empty</h3>
                <p className="mb-6 max-w-xs font-mono text-xs text-[#8E929B]">
                  Explore our heavyweight streetwear collection or pick your favorite drop.
                </p>
                <button
                  onClick={onClose}
                  className="min-h-11 rounded-none bg-[#00FF66] px-6 text-xs font-black uppercase text-[#0B0C10] transition-all hover:bg-[#00FF66]/80 font-mono"
                >
                  Start Shopping
                </button>
              </div>
            ) : (
              items.map((item) => (
                <article
                  key={item.id}
                  className="flex items-center gap-3.5 rounded-none border border-[#282C34] bg-[#16181D] p-3.5 shadow-sm"
                >
                  <div className="flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-none border border-[#282C34] bg-[#0B0C10] p-1">
                    <TShirtMockup
                      colorHex={item.colorHex}
                      side={item.side || "front"}
                      graphicType={item.graphicSvgType}
                      className="h-full w-full"
                    />
                  </div>

                  <div className="min-w-0 flex-1 font-mono">
                    <div className="flex items-start justify-between gap-1">
                      <h4
                        className="truncate text-xs font-bold uppercase text-white font-sans"
                        style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
                      >
                        {item.title}
                      </h4>
                      <button
                        onClick={() => onRemoveItem(item.id)}
                        aria-label={`Remove ${item.title} from cart`}
                        title="Remove"
                        className="-m-1.5 flex min-h-8 min-w-8 shrink-0 items-center justify-center p-1.5 text-neutral-400 transition-colors hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="mt-1 flex items-center gap-2 text-xs text-[#8E929B]">
                      <span className="rounded-none border border-[#282C34] bg-[#0B0C10] px-1.5 py-0.2 font-bold text-white">
                        {item.size}
                      </span>
                      <span aria-hidden="true">•</span>
                      <span className="truncate">{item.colorName}</span>
                    </div>

                    <div className="mt-3 flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-sm font-black text-white">{formatRupees(item.price)}</span>
                        <span className="ml-1.5 font-mono text-[10px] uppercase text-[#8E929B]">
                          × {item.quantity}
                        </span>
                      </div>

                      <div className="flex h-8 shrink-0 items-center rounded-none border border-[#282C34] bg-[#0B0C10]">
                        <button
                          onClick={() => onUpdateQuantity(item.id, -1)}
                          aria-label={`Decrease quantity of ${item.title}`}
                          className="flex h-full min-w-8 items-center justify-center px-1 text-sm font-bold text-neutral-400 transition-colors hover:text-white"
                        >
                          −
                        </button>
                        <span
                          aria-label={`Quantity ${item.quantity}`}
                          className="px-2 text-xs font-bold text-white"
                        >
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQuantity(item.id, 1)}
                          aria-label={`Increase quantity of ${item.title}`}
                          className="flex h-full min-w-8 items-center justify-center px-1 text-sm font-bold text-neutral-400 transition-colors hover:text-white"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>

          {items.length > 0 && (
            <footer className="space-y-4 border-t border-[#282C34] bg-[#16181D] p-5 pb-safe shadow-2xl font-mono">
              {/* Cashback Sky Cash Guarantee */}
              <div className="p-3 bg-[#0B0C10] border border-[#00FF66]/30 flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-[#00FF66]/10 border border-[#00FF66]/30 text-[#00FF66] flex items-center justify-center font-bold text-xs shrink-0">
                    🪙
                  </div>
                  <div>
                    <div className="font-mono text-[11px] font-bold text-white uppercase flex items-center gap-1.5">
                      <span>100% Withdrawable Sky Cash</span>
                      <span className="text-[9px] bg-[#00FF66]/20 text-[#00FF66] px-1 py-0.2 font-mono">AUTOMATIC</span>
                    </div>
                    <div className="text-[10px] text-[#8E929B] font-mono">
                      No coupon needed — Sky Cash is 100% withdrawable to your Bank Account!
                    </div>
                  </div>
                </div>
                {quote && quote.cashbackCoins > 0 && (
                  <div className="text-right shrink-0">
                    <span className="font-mono text-xs font-black text-[#00FF66]">+{quote.cashbackCoins.toLocaleString("en-IN")}</span>
                    <span className="block font-mono text-[9px] text-[#8E929B]">SKY CASH</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 font-mono text-xs text-[#8E929B]">
                {quote === null ? (
                  <>
                    <div className="h-4 w-full animate-pulse rounded-none bg-[#0B0C10]" />
                    <div className="h-4 w-2/3 animate-pulse rounded-none bg-[#0B0C10]" />
                    <div className="h-6 w-full animate-pulse rounded-none bg-[#0B0C10]" />
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span>Subtotal</span>
                      <span className="font-bold text-white">{formatRupees(quote.subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Delivery (India)</span>
                      <span className="shrink-0 font-bold">
                        {quote.deliveryFee === 0 ? (
                          <span className="font-bold uppercase text-[#00FF66]">FREE</span>
                        ) : (
                          formatRupees(quote.deliveryFee)
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-[#282C34] pt-2 text-base font-black text-white">
                      <span>Total Payable</span>
                      <span>{formatRupees(quote.total)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1 font-mono text-[11px] text-[#8E929B]">
                      <span className="flex items-center gap-1.5">
                        <Coins className="h-3.5 w-3.5 text-[#00FF66]" />
                        Sky Cash Reward
                      </span>
                      <span className="font-mono font-bold text-[#00FF66]">
                        +{quote.cashbackCoins.toLocaleString("en-IN")} Sky Cash
                      </span>
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={onOpenCheckout}
                disabled={isQuoting}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-none bg-[#00FF66] text-xs font-black uppercase tracking-[1px] text-[#0B0C10] shadow-md transition-[transform,background-color] duration-100 hover:bg-[#00FF66]/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
              >
                {isQuoting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-[#0B0C10]" />
                    <span>Fetching live total…</span>
                  </>
                ) : (
                  <>
                    <span>Proceed to Checkout</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <p className="flex items-center justify-center gap-2 font-mono text-[10px] text-[#8E929B]">
                <ShieldCheck className="h-3.5 w-3.5 text-[#00FF66]" />
                <span>Pricing verified server-side • Card, Netbanking &amp; COD on eligible drops</span>
              </p>
            </footer>
          )}
        </section>
      </div>
    </div>
  );
}
