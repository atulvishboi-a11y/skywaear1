"use client";

import React, { useState } from "react";
import { Product, CartItem } from "../data/products";
import type { RewardRulesConfig } from "../data/rewardsEngine";
import { cashbackForProduct, isBestseller, isNewDrop, isPremiumTShirt, stockState } from "@/lib/catalog";
import { formatRupees } from "@/lib/domain";
import ProductMedia, { productHeroView, productViews } from "./ProductMedia";
import {
  X,
  Star,
  ShoppingBag,
  ShieldCheck,
  Truck,
  RotateCcw,
  Check,
  Heart,
  Coins,
  MapPin,
  Sparkles
} from "lucide-react";

interface ProductDetailModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (item: CartItem) => void;
  onBuyNow: (item: CartItem) => void;
  onOpenSizeChart: () => void;
  isWishlisted?: boolean;
  onToggleWishlist?: (productId: string) => void;
  rules?: RewardRulesConfig;
  walletPoints?: number;
}

export default function ProductDetailModal({
  product,
  isOpen,
  onClose,
  onAddToCart,
  onBuyNow,
  onOpenSizeChart,
  isWishlisted = false,
  onToggleWishlist,
  walletPoints = 0,
}: ProductDetailModalProps) {
  const [colorKey, setColorKey] = useState<string | null>(null);
  const [sizeKey, setSizeKey] = useState<string | null>(null);
  const [viewKey, setViewKey] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);
  const [pincode, setPincode] = useState("");
  const [pincodeMessage, setPincodeMessage] = useState<string | null>(null);
  const [pincodeOk, setPincodeOk] = useState(false);

  if (!isOpen || !product) return null;

  const activeColor = product.colors.find((c) => c.name === colorKey) ?? product.colors[0];
  const activeSize = product.sizes.includes(sizeKey ?? "")
    ? sizeKey!
    : product.sizes.includes("L")
      ? "L"
      : product.sizes[0];
  const views = productViews(product);
  const heroView = productHeroView(product);
  const activeView = views.find((v) => v.key === viewKey) ?? heroView;
  const stock = stockState(product);

  const cash = cashbackForProduct(product);
  const baseCoins = cash.coins;
  const earnedCoins = baseCoins * quantity;
  const showMrp = product.mrp > product.price;

  const getCartItem = (): CartItem => ({
    id: `${product.id}-${activeColor.name}-${activeSize}-${Date.now()}`,
    productId: product.id,
    title: product.title,
    price: product.price,
    quantity,
    size: activeSize,
    colorName: activeColor.name,
    colorHex: activeColor.hex,
    graphicSvgType: product.graphicSvgType,
    imageUrl: product.artworkUrl ?? product.imageUrl,
  });

  const handleAddToCart = () => {
    if (!stock.purchasable) return;
    onAddToCart(getCartItem());
    setIsAdded(true);
    setTimeout(() => {
      setIsAdded(false);
      onClose();
    }, 1200);
  };

  const handleBuyNow = () => {
    onBuyNow(getCartItem());
    onClose();
  };

  const checkPincode = (e: React.FormEvent) => {
    e.preventDefault();
    const serviceable = /^[1-9]\d{5}$/.test(pincode);
    setPincodeOk(serviceable);
    setPincodeMessage(
      serviceable
        ? "Serviceable PIN — printed in 48 hours, then 2-4 business days in transit."
        : "Enter a valid 6-digit Indian PIN code."
    );
  };

  return (
    <div className="zenin-fade fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-start justify-center p-3 sm:items-center sm:p-6 font-mono">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${product.title} details`}
        className="zenin-sheet relative w-full max-w-4xl bg-[#0B0C10] border border-[#282C34] rounded-none shadow-2xl overflow-hidden text-white my-6"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-none bg-[#16181D] border border-[#282C34] text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-0">
          {/* Left Column: Big Mockup Canvas */}
          <div className="md:col-span-6 bg-[#16181D] p-6 sm:p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-[#282C34] relative">
            <ProductMedia
              product={product}
              colorHex={activeColor.hex}
              view={activeView}
              eager
              className="w-full max-w-[340px] aspect-[4/5]"
            />

            {/* Visual View Gallery Thumbnails */}
            {views.length > 1 && (
              <div className="flex items-center gap-2 mt-3 overflow-x-auto max-w-full pb-1 scrollbar-none">
                {views.map((v) => {
                  const isActive = activeView.key === v.key;
                  return (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => setViewKey(v.key)}
                      className={`relative flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden transition-all duration-200 bg-[#0B0C10] cursor-pointer ${
                        isActive
                          ? "ring-2 ring-white border-2 border-white scale-105"
                          : "border border-white/15 opacity-60 hover:opacity-100 hover:border-white/40"
                      }`}
                      title={v.label}
                    >
                      {v.kind === "photo" && v.src ? (
                        <img
                          src={v.src}
                          alt={v.label}
                          className="w-full h-full object-cover object-center"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center p-0.5 bg-[#121316]">
                          <ProductMedia
                            product={product}
                            colorHex={activeColor.hex}
                            view={v}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-4 text-xs font-mono text-[#8E929B] flex items-center gap-2">
              <span className="uppercase">Fabric:</span>
              <span className="text-white font-bold">{product.fabric || `${product.gsm} GSM Heavyweight`}</span>
            </div>
          </div>

          {/* Right Column: Specifications & Purchasing Controls */}
          <div className="md:col-span-6 p-6 sm:p-8 flex flex-col justify-between bg-[#0B0C10]">
            <div className="space-y-4">
              <div>
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  <span className="px-2 py-0.5 rounded-none text-[9px] font-mono font-bold tracking-widest uppercase bg-[#16181D] text-[#00F0FF] border border-[#00F0FF]/40">
                    [240 GSM]
                  </span>
                  {isPremiumTShirt(product) && (
                    <span className="px-2 py-0.5 rounded-none text-[9px] font-mono font-bold tracking-widest uppercase bg-[#00FF66] text-[#0B0C10]">
                      Heavyweight
                    </span>
                  )}
                  {isNewDrop(product) && (
                    <span className="px-2 py-0.5 rounded-none text-[9px] font-mono font-bold tracking-widest uppercase bg-[#F5F5F7] text-[#0B0C10]">
                      Drop 01
                    </span>
                  )}
                  {isBestseller(product) && (
                    <span className="px-2 py-0.5 rounded-none text-[9px] font-mono font-bold tracking-widest uppercase border border-[#282C34] bg-[#16181D] text-[#F5F5F7]">
                      Bestseller
                    </span>
                  )}
                  <span className="text-xs font-mono text-[#00FF66] uppercase tracking-wider ml-auto">
                    {product.theme || product.category}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <h2
                    className="text-2xl font-black text-white tracking-tight uppercase font-sans"
                    style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
                  >
                    {product.title}
                  </h2>
                  <button
                    onClick={() => onToggleWishlist?.(product.id)}
                    className={`p-2 rounded-none border shrink-0 transition-colors ${
                      isWishlisted
                        ? "bg-[#16181D] text-rose-400 border-rose-500/60"
                        : "bg-[#16181D] text-neutral-400 hover:text-white border-[#282C34]"
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isWishlisted ? "fill-rose-500 text-rose-500" : ""}`} />
                  </button>
                </div>
                <p className="text-[11px] font-mono text-[#8E929B] mt-1">
                  {product.subtitle}
                  {product.sku ? ` · SKU ${product.sku}` : ""}
                </p>

                <div className="flex items-center gap-3 mt-2 font-mono">
                  <div className="flex items-center gap-1 text-[#00FF66] font-bold text-xs">
                    <Star className="w-4 h-4 fill-[#00FF66]" />
                    <span>{product.rating}</span>
                  </div>
                  <span className="text-xs text-[#8E929B]">
                    {product.reviewsCount} Verified Customer Reviews
                  </span>
                </div>
              </div>

              {/* Price & Savings */}
              <div className="flex flex-wrap items-baseline gap-3 py-3 border-y border-[#282C34] font-mono">
                <span className="text-3xl font-black text-white">{formatRupees(product.price)}</span>
                {showMrp && <span className="text-base text-[#8E929B] line-through">{formatRupees(product.mrp)}</span>}
                {showMrp && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-none bg-[#00FF66] text-[#0B0C10]">
                    SAVE {Math.round(((product.mrp - product.price) / product.mrp) * 100)}%
                  </span>
                )}
                <span
                  className={`ml-auto text-[11px] font-bold px-2 py-0.5 rounded-none border ${
                    !stock.purchasable
                      ? "bg-black text-neutral-400 border-[#282C34]"
                      : stock.low
                        ? "bg-[#16181D] text-amber-300 border-amber-500/40"
                        : "bg-[#16181D] text-[#00FF66] border-[#00FF66]/40"
                  }`}
                >
                  {stock.purchasable ? `${stock.label} · ${stock.count} pcs` : "Sold out"}
                </span>
              </div>

              {/* REWARDS BREAKDOWN BOX */}
              {cash && cash.coins > 0 ? (
                <div className="bg-[#16181D] border border-[#00FF66]/40 rounded-none p-3.5 flex items-center justify-between gap-3 text-xs font-mono">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Coins className="w-5 h-5 text-[#00FF66] shrink-0" />
                    <div className="min-w-0">
                      <div className="font-bold text-white leading-snug">
                        Buy this T-shirt and earn <span className="text-[#00FF66]">{earnedCoins} Coins</span> in cashback
                        {quantity > 1 && (
                          <span className="text-[11px] text-[#8E929B] font-normal"> — {baseCoins} Coins/tee</span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#8E929B] font-mono mt-0.5">
                        {cash.source === "override"
                          ? "Sky Cash boost set for this drop · Unlocks daily across 30 days starting on Day 1."
                          : "Unlocks daily across 30 days starting on Day 1."}
                      </div>
                      {walletPoints > 0 && (
                        <div className="text-[11px] text-neutral-300 font-mono mt-1">
                          Separate from the {walletPoints} Sky Cash already live in your wallet.
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded-none bg-[#00FF66] text-[#0B0C10] shrink-0 uppercase">
                    {`${cash.coins} COINS / TEE`}
                  </span>
                </div>
              ) : (
                <div className="bg-[#16181D] border border-[#282C34] rounded-none p-3 text-[11px] text-[#8E929B] font-mono">
                  This drop is not part of the cashback programme — no Sky Cash is earned on it.
                </div>
              )}

              {/* Description */}
              <p className="text-xs text-[#8E929B] leading-relaxed font-mono">
                {product.description}
              </p>

              {/* Color selector */}
              <div>
                <div className="flex justify-between text-xs font-mono text-[#8E929B] mb-2">
                  <span className="uppercase">SELECT COLOR: <strong className="text-white">{activeColor.name}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  {product.colors.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => setColorKey(c.name)}
                      className={`w-6 h-6 rounded-none border transition-all ${
                        activeColor.name === c.name
                          ? "scale-110 border-[#00FF66] ring-1 ring-[#00FF66]"
                          : "border-[#282C34] hover:scale-105"
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                      aria-label={`Show ${product.title} in ${c.name}`}
                    />
                  ))}
                </div>
              </div>

              {/* Size selector */}
              <div>
                <div className="flex justify-between text-xs font-mono text-[#8E929B] mb-2">
                  <span className="uppercase">SIZE:</span>
                  <button
                    onClick={onOpenSizeChart}
                    className="text-[#00F0FF] underline hover:text-[#00FF66] uppercase"
                  >
                    Size Chart &amp; Fit Guide
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 font-mono">
                  {product.sizes.map((sz) => (
                    <button
                      key={sz}
                      onClick={() => setSizeKey(sz)}
                      className={`min-w-[48px] h-9 px-2 rounded-none text-xs font-bold border transition-all uppercase ${
                        activeSize === sz
                          ? "border-[#F5F5F7] bg-[#F5F5F7] text-[#0B0C10] font-black"
                          : "border-[#282C34] bg-[#16181D] text-neutral-300 hover:border-[#00F0FF]"
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pincode delivery check */}
              <form onSubmit={checkPincode} className="pt-2">
                <div className="flex gap-2 font-mono">
                  <div className="relative flex-1 text-xs">
                    <MapPin className="w-4 h-4 text-[#8E929B] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                      placeholder="Enter 6-digit Pincode"
                      className="w-full bg-[#16181D] border border-[#282C34] rounded-none pl-9 pr-3 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-[#00FF66]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-none bg-[#16181D] hover:bg-white/10 border border-[#282C34] text-xs font-mono font-bold text-white uppercase"
                  >
                    Check
                  </button>
                </div>
                {pincodeMessage && (
                  <p className={`text-[11px] mt-1 font-mono ${pincodeOk ? "text-[#00FF66]" : "text-rose-400"}`}>
                    {pincodeMessage}
                  </p>
                )}
              </form>
            </div>

            {/* Actions: Add to Cart and Buy Now */}
            <div className="pt-6 border-t border-[#282C34] space-y-3 font-mono">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center border border-[#282C34] rounded-none bg-[#16181D] px-3 py-2">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="text-neutral-400 hover:text-white px-2 font-bold"
                  >
                    -
                  </button>
                  <span className="text-sm font-bold px-2">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(Math.max(1, stock.count), quantity + 1))}
                    className="text-neutral-400 hover:text-white px-2 font-bold"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={handleAddToCart}
                  disabled={isAdded || !stock.purchasable}
                  className={`flex-1 min-w-[140px] py-3 px-4 rounded-none font-bold uppercase flex items-center justify-center gap-2 text-xs transition-all ${
                    !stock.purchasable
                      ? "bg-[#1f1f24] text-[#8E929B] cursor-not-allowed border border-[#282C34]"
                      : isAdded
                        ? "bg-[#00FF66] text-[#0B0C10] font-black"
                        : "bg-[#F5F5F7] hover:bg-[#00FF66] text-[#0B0C10]"
                  }`}
                >
                  {!stock.purchasable ? (
                    "Sold Out"
                  ) : isAdded ? (
                    <>
                      <Check className="w-4 h-4" />
                      Added!
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4" />
                      Add to Bag
                    </>
                  )}
                </button>

                <button
                  onClick={handleBuyNow}
                  disabled={!stock.purchasable}
                  className={`flex-1 min-w-[140px] py-3 px-4 rounded-none font-black uppercase flex items-center justify-center gap-2 text-xs transition-all ${
                    !stock.purchasable
                      ? "opacity-40 cursor-not-allowed bg-[#1f1f24] text-[#8E929B]"
                      : "bg-[#00FF66] hover:bg-[#00FF66]/90 text-[#0B0C10]"
                  }`}
                >
                  <span>Buy Now • {formatRupees(product.price * quantity)}</span>
                </button>
              </div>

              {stock.low && stock.purchasable && (
                <p className="text-[11px] text-amber-300 font-mono text-center">
                  Only {stock.count} pieces left in this drop — quantity is capped at available stock.
                </p>
              )}

              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-[#8E929B] font-mono">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#00FF66]" />
                  100% Bio-Washed Cotton
                </span>
                <span>•</span>
                <span>All sales final — no returns</span>
                <span>•</span>
                <span>{product.codAvailable === false ? "Prepaid only" : "Cash on Delivery"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
