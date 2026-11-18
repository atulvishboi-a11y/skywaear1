"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Product } from "@/data/products";
import type { RewardRulesConfig } from "@/data/rewardsEngine";
import { formatRupees } from "@/lib/domain";
import { cashbackForProduct, isAnimeTShirt, isNewDrop } from "@/lib/catalog";
import ProductMedia, { productHeroView } from "./ProductMedia";
import { ChevronLeft, ChevronRight, Sparkles, ArrowRight, Coins } from "lucide-react";

interface FloatingShowcaseCarouselProps {
  products: Product[];
  rules?: RewardRulesConfig;
  onSelectProduct: (product: Product) => void;
}

export default function FloatingShowcaseCarousel({
  products,
  rules,
  onSelectProduct,
}: FloatingShowcaseCarouselProps) {
  const router = useRouter();
  const items = products;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 640);
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (currentIndex >= items.length) setCurrentIndex(0);
  }, [currentIndex, items.length]);

  if (items.length === 0) return null;

  const currentItem = items[Math.min(currentIndex, items.length - 1)];

  const handleNext = () => setCurrentIndex((prev) => (prev + 1) % items.length);
  const handlePrev = () => setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);

  const handleTouchStart = (e: React.TouchEvent) => setTouchStartX(e.touches[0].clientX);

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (diff > 40) handleNext();
    else if (diff < -40) handlePrev();
    setTouchStartX(null);
  };

  return (
    <section className="floating-showcase-carousel relative w-full overflow-hidden bg-[#0B0C10] text-[#F5F5F7] py-10 sm:py-16 select-none font-mono border-t border-b border-[#282C34]">
      <div className="relative max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12">
        <div className="flex flex-col items-center justify-center text-center mb-6 sm:mb-8">
          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-[#00FF66] mb-1">
            [FEATURED DROPS // SPOTLIGHT]
          </span>
          <h2
            className="text-2xl sm:text-3xl md:text-4xl font-bold uppercase tracking-tight text-[#F5F5F7]"
            style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
          >
            Curated Heavyweight Drops
          </h2>
        </div>

        <div
          className="relative w-full h-[420px] sm:h-[540px] md:h-[620px] flex items-center justify-center overflow-visible"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {items.map((product, idx) => {
            const offset = (idx - currentIndex + items.length) % items.length;
            let normOffset = offset;
            if (normOffset > items.length / 2) normOffset -= items.length;

            const isCenter = normOffset === 0;
            const isVisible = Math.abs(normOffset) <= 2;
            if (!isVisible) return null;

            const translateX = normOffset * (isMobile ? 120 : 200);
            const scale = 1 - Math.abs(normOffset) * 0.18;
            const zIndex = 20 - Math.abs(normOffset) * 5;
            const opacity = 1 - Math.abs(normOffset) * 0.35;
            const rotateY = normOffset * -12;
            const heroView = productHeroView(product);

            return (
              <div
                key={product.id}
                onClick={() => {
                  if (isCenter) router.push(`/product/${product.slug}`);
                  else setCurrentIndex(idx);
                }}
                style={{
                  transform: `translateX(${translateX}px) scale(${scale}) perspective(1000px) rotateY(${rotateY}deg)`,
                  zIndex,
                  opacity,
                }}
                className={`absolute w-[240px] sm:w-[320px] md:w-[380px] aspect-[5/8] cursor-pointer transition-all duration-500 ease-out group ${
                  isCenter ? "shadow-2xl" : "cursor-pointer hover:opacity-90"
                }`}
              >
                <div className="relative w-full h-full rounded-none overflow-hidden bg-[#16181D] border border-[#282C34] hover:border-[#00FF66] p-2 sm:p-3 flex flex-col justify-between transition-colors">
                  <div className="absolute top-4 left-4 z-10 px-2.5 py-1 rounded-none text-[9px] font-mono font-bold uppercase tracking-wider bg-[#0B0C10] text-[#00FF66] border border-[#00FF66]/40">
                    {product.category}
                  </div>

                  <div className="relative w-full flex-1 rounded-none overflow-hidden bg-[#0B0C10] border border-[#282C34] flex items-center justify-center">
                    <ProductMedia
                      product={product}
                      colorHex={product.colors[0].hex}
                      view={heroView}
                      eager={isCenter}
                      className="w-full h-full p-2"
                    />
                  </div>

                  <div className="mt-3 px-1 pb-1 text-left font-mono">
                    <h3 className="text-xs sm:text-sm font-bold uppercase text-[#F5F5F7] truncate">{product.title}</h3>
                    <div className="flex items-center justify-between mt-1.5 gap-2">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span className="text-sm sm:text-base font-black text-[#F5F5F7]">{formatRupees(product.price)}</span>
                        {product.mrp > product.price && (
                          <span className="text-xs text-[#8E929B] line-through">{formatRupees(product.mrp)}</span>
                        )}
                      </div>
                      {isCenter && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/product/${product.slug}`);
                          }}
                          className="px-3 py-1 rounded-none bg-[#00FF66] text-[#0B0C10] font-black text-[11px] uppercase tracking-wider hover:bg-[#00FF66]/90 transition-colors flex items-center gap-1 shrink-0"
                        >
                          <span>Drop</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <button
            onClick={handlePrev}
            className="absolute left-2 sm:left-6 z-30 p-2.5 sm:p-3 rounded-none bg-[#16181D] hover:bg-[#282C34] text-[#F5F5F7] border border-[#282C34] transition-colors"
            aria-label="Previous Slide"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-2 sm:right-6 z-30 p-2.5 sm:p-3 rounded-none bg-[#16181D] hover:bg-[#282C34] text-[#F5F5F7] border border-[#282C34] transition-colors"
            aria-label="Next Slide"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <div className="mt-6 flex flex-col items-center justify-center gap-2">
          <div className="flex items-center gap-1.5">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`h-1 rounded-none transition-all ${
                  currentIndex === i ? "w-8 bg-[#00FF66]" : "w-3 bg-[#282C34] hover:bg-[#8E929B]"
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
          <span className="text-[11px] font-mono text-[#8E929B]">
            {currentIndex + 1} / {items.length} · {currentItem?.title}
          </span>
        </div>
      </div>
    </section>
  );
}
