"use client";

import React, { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { formatRupees } from "@/lib/domain";
import { Product, CartItem } from "../data/products";
import type { RewardRulesConfig } from "../data/rewardsEngine";
import { isBestseller, isNewDrop, isPremiumTShirt, stockState } from "@/lib/catalog";
import ProductMedia, { productHeroView, productViews } from "./ProductMedia";
import { Heart, ShoppingBag, Star, Check } from "lucide-react";

interface ProductCardProps {
  product: Product;
  onAddToCart: (item: CartItem) => void;
  onQuickView?: (product: Product) => void;
  isWishlisted?: boolean;
  onToggleWishlist?: (productId: string) => void;
  rules?: RewardRulesConfig;
  showVariants?: boolean;
}

export default function ProductCard({
  product,
  onAddToCart,
  onQuickView,
  isWishlisted = false,
  onToggleWishlist,
  showVariants = false,
}: ProductCardProps) {
  const views = productViews(product);
  const heroView = productHeroView(product);
  const [selectedColor, setSelectedColor] = useState(product.colors[0]);
  const [selectedSize, setSelectedSize] = useState(product.sizes.includes("L") ? "L" : product.sizes[0]);
  const [viewKey, setViewKey] = useState(heroView.key);
  const [isAdded, setIsAdded] = useState(false);

  const activeView = views.find((v) => v.key === viewKey) ?? views[0];
  const stock = stockState(product);
  const showMrp = product.mrp > product.price;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!stock.purchasable) return;
    const item: CartItem = {
      id: `${product.id}-${selectedColor.name}-${selectedSize}-${Date.now()}`,
      productId: product.id,
      title: product.title,
      price: product.price,
      quantity: 1,
      size: selectedSize,
      colorName: selectedColor.name,
      colorHex: selectedColor.hex,
      graphicSvgType: product.graphicSvgType,
      imageUrl: product.artworkUrl ?? product.imageUrl,
    };
    onAddToCart(item);
    setIsAdded(true);
    toast.success(`${product.title} (Size ${selectedSize}) added to bag`, {
      description: "100% Sky Cash will unlock on order delivery.",
    });
    setTimeout(() => setIsAdded(false), 1800);
  };

  return (
    <div className="group relative bg-[#16181D] border border-[#282C34] hover:border-[#F5F5F7] rounded-none overflow-hidden transition-[border-color,background-color] duration-200 ease-out flex flex-col font-mono text-white">
      <div className="relative bg-[#0B0C10] p-4 sm:p-5 flex items-center justify-center overflow-hidden aspect-[4/5] border-b border-[#282C34]">
        {/* Stitch Telemetry / Merchandising badges */}
        <div className="absolute top-3 left-3 z-10 flex flex-col items-start gap-1 pointer-events-none">
          <span className="px-2 py-0.5 rounded-none text-[9px] font-mono font-bold tracking-widest uppercase bg-[#16181D] text-[#00F0FF] border border-[#00F0FF]/40">
            [240 GSM]
          </span>
          {!stock.purchasable && (
            <span className="px-2 py-0.5 rounded-none text-[9px] font-mono font-bold tracking-widest uppercase bg-black text-neutral-400 border border-[#282C34]">
              Sold Out
            </span>
          )}
          {isPremiumTShirt(product) && (
            <span className="px-2 py-0.5 rounded-none text-[9px] font-mono font-bold tracking-widest uppercase bg-[#00FF66] text-[#0B0C10] border border-[#00FF66]">
              Heavyweight
            </span>
          )}
          {isNewDrop(product) && (
            <span className="px-2 py-0.5 rounded-none text-[9px] font-mono font-bold tracking-widest uppercase bg-[#F5F5F7] text-[#0B0C10]">
              Drop 01
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleWishlist?.(product.id);
            if (!isWishlisted) {
              toast.success("Saved to Wishlist", {
                description: product.title,
              });
            }
          }}
          className={`absolute top-3 right-3 z-10 p-2 rounded-none border transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[0.96] ${
            isWishlisted
              ? "bg-[#16181D] text-rose-400 border-rose-500/60 animate-heart-pop"
              : "bg-[#0B0C10]/80 backdrop-blur-md text-neutral-400 hover:text-white border-[#282C34]"
          }`}
          title={isWishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
          aria-label={`${isWishlisted ? "Remove" : "Add"} ${product.title} ${isWishlisted ? "from" : "to"} wishlist`}
          aria-pressed={isWishlisted}
        >
          <Heart className={`w-4 h-4 transition-transform duration-150 ${isWishlisted ? "fill-rose-500 text-rose-500" : ""}`} />
        </button>

        <Link
          href={`/product/${product.slug}`}
          className="w-full h-full flex items-center justify-center cursor-pointer"
          aria-label={product.title}
        >
          <ProductMedia
            product={product}
            colorHex={selectedColor.hex}
            view={activeView}
            eager={false}
            className="w-full max-w-[260px] h-full transform group-hover:scale-[1.02] transition-transform duration-300"
          />
        </Link>

        {views.length > 1 && (
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#0B0C10]/90 backdrop-blur-md p-1 rounded-none border border-[#282C34] shadow-lg z-10">
            {views.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setViewKey(v.key);
                }}
                className={`px-2 py-0.5 rounded-none text-[10px] font-mono font-bold uppercase whitespace-nowrap transition-all ${
                  activeView.key === v.key ? "bg-[#F5F5F7] text-[#0B0C10]" : "text-neutral-400 hover:text-white"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between bg-[#16181D]">
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
            <span className="text-[#00FF66] uppercase tracking-wider text-[11px] font-mono font-bold truncate">
              {product.theme || product.category}
            </span>
            <div className="flex items-center gap-1 text-white font-bold text-xs shrink-0 font-mono">
              <Star className="w-3.5 h-3.5 fill-[#00FF66] text-[#00FF66]" />
              <span>{product.rating}</span>
              <span className="text-neutral-400 font-normal">({product.reviewsCount})</span>
            </div>
          </div>

          <Link
            href={`/product/${product.slug}`}
            className="text-sm sm:text-base font-bold text-white tracking-tight hover:text-[#00FF66] cursor-pointer transition-colors uppercase leading-snug block font-sans"
            style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
          >
            {product.title}
          </Link>

          <p className="text-[11px] text-[#8E929B] mt-0.5 line-clamp-1 font-mono">{product.subtitle}</p>

          {showVariants && (
            <>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[11px] text-[#8E929B] font-mono">COLOR:</span>
                <div className="flex items-center gap-1.5">
                  {product.colors.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => setSelectedColor(c)}
                      className={`w-5 h-5 rounded-none border transition-[transform,border-color] duration-150 ease-out active:scale-[0.96] ${
                        selectedColor.name === c.name ? "scale-110 border-[#00FF66] ring-1 ring-[#00FF66]" : "border-[#282C34] hover:scale-105"
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                      aria-label={`Show ${product.title} in ${c.name}`}
                    />
                  ))}
                </div>
                <span className="text-[11px] text-neutral-300 ml-1 font-mono truncate">{selectedColor.name}</span>
              </div>

              <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                <span className="text-[11px] text-[#8E929B] font-mono">SIZE:</span>
                {product.sizes.map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setSelectedSize(sz)}
                    className={`h-6 min-w-6 px-1.5 rounded-none text-[11px] font-mono font-bold border transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[0.97] ${
                      selectedSize === sz
                        ? "border-[#F5F5F7] bg-[#F5F5F7] text-[#0B0C10] font-black"
                        : "border-[#282C34] bg-transparent text-neutral-300 hover:border-[#00F0FF]"
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-[#282C34] flex items-center justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-2 font-mono">
              <span className="text-lg font-black text-white">{formatRupees(product.price)}</span>
              {showMrp && <span className="text-xs text-[#8E929B] line-through">{formatRupees(product.mrp)}</span>}
            </div>
            {showMrp && (
              <span className="text-[10px] font-mono font-bold text-[#00FF66]">
                SAVE {Math.round(((product.mrp - product.price) / product.mrp) * 100)}%
              </span>
            )}
          </div>

          <button
            onClick={handleAddToCart}
            disabled={isAdded || !stock.purchasable}
            className={`py-2 px-3 sm:px-4 rounded-none text-xs font-bold tracking-wider uppercase flex items-center gap-1.5 transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.97] cursor-pointer ${
              !stock.purchasable
                ? "bg-[#1f1f24] text-[#8E929B] cursor-not-allowed border border-[#282C34]"
                : isAdded
                  ? "bg-[#00FF66] text-[#0B0C10] font-black"
                  : "bg-[#F5F5F7] hover:bg-[#00FF66] text-[#0B0C10] font-bold"
            }`}
            style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
          >
            {!stock.purchasable ? (
              "Sold Out"
            ) : isAdded ? (
              <>
                <Check className="w-3.5 h-3.5" /> Added
              </>
            ) : (
              <>
                <ShoppingBag className="w-3.5 h-3.5" /> Add to Bag
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
