"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface HeroSlide {
  id: string;
  imageUrl: string;
  fallbackUrl?: string;
  title: string;
  subtitle?: string;
  link: string;
  badge?: string;
}

export const DEFAULT_HERO_SLIDES: HeroSlide[] = [
  {
    id: "betrayed-drop",
    imageUrl: "/banners/betrayed.webp",
    fallbackUrl: "/banners/betrayed.png",
    title: "BETRAYED // EXCLUSIVE STREETWEAR DROP",
    subtitle: "280 GSM Pure Combed Heavyweight French Terry Cotton",
    link: "/shop",
    badge: "NEW DROP",
  },
];

interface HomeHeroSliderProps {
  slides?: HeroSlide[];
  autoPlayInterval?: number;
}

export default function HomeHeroSlider({
  slides = DEFAULT_HERO_SLIDES,
  autoPlayInterval = 5000,
}: HomeHeroSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const totalSlides = slides.length;

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  const goToSlide = (idx: number) => {
    setCurrentIndex(idx);
  };

  // Auto-play timer (pauses when user hovers over the slider)
  useEffect(() => {
    if (totalSlides <= 1 || isHovered) return;
    const timer = setInterval(nextSlide, autoPlayInterval);
    return () => clearInterval(timer);
  }, [totalSlides, isHovered, nextSlide, autoPlayInterval]);

  // Touch Swipe handlers for mobile devices
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50; // min swipe distance in px
    if (diff > threshold) {
      nextSlide();
    } else if (diff < -threshold) {
      prevSlide();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const currentSlide = slides[currentIndex] || slides[0];

  return (
    <section
      className="relative w-full bg-[#0E0F0E] border-b border-[#2E302B] overflow-hidden select-none touch-pan-y"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      aria-label="Featured Drops Carousel"
    >
      <div className="relative w-full aspect-[2048/768] min-h-[160px] sm:min-h-[260px] md:min-h-[380px] lg:min-h-[480px] xl:min-h-[560px]">
        {/* Slides rendering */}
        {slides.map((slide, idx) => {
          const isActive = idx === currentIndex;
          return (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                isActive ? "opacity-100 z-10 pointer-events-auto" : "opacity-0 z-0 pointer-events-none"
              }`}
            >
              <Link href={slide.link} className="block w-full h-full relative group">
                <picture>
                  <source srcSet={slide.imageUrl} type="image/webp" />
                  <img
                    src={slide.fallbackUrl || slide.imageUrl}
                    alt={slide.title}
                    className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.01]"
                    loading={idx === 0 ? "eager" : "lazy"}
                  />
                </picture>

                {/* Subtle dark gradient overlay at top/bottom for sleek contrast */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />

                {/* Badges / Text Overlay if provided */}
                {slide.badge && (
                  <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20">
                    <span className="px-3 py-1 bg-[#D9362B] text-white text-[10px] sm:text-xs font-bold font-mono uppercase tracking-widest shadow-lg">
                      {slide.badge}
                    </span>
                  </div>
                )}
              </Link>
            </div>
          );
        })}

        {/* Navigation Arrows (Show only if more than 1 slide) */}
        {totalSlides > 1 && (
          <>
            <button
              type="button"
              onClick={prevSlide}
              aria-label="Previous slide"
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-30 p-2 sm:p-3 bg-[#171816]/80 hover:bg-[#D9362B] text-white border border-[#2E302B] hover:border-[#D9362B] transition-all rounded-[2px] shadow-2xl cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 sm:w-6 sm:h-6" />
            </button>

            <button
              type="button"
              onClick={nextSlide}
              aria-label="Next slide"
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-30 p-2 sm:p-3 bg-[#171816]/80 hover:bg-[#D9362B] text-white border border-[#2E302B] hover:border-[#D9362B] transition-all rounded-[2px] shadow-2xl cursor-pointer"
            >
              <ChevronRight className="w-4 h-4 sm:w-6 sm:h-6" />
            </button>

            {/* Pagination Dots */}
            <div className="absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-[#171816]/80 border border-[#2E302B] px-3 py-1.5 rounded-full shadow-xl">
              {slides.map((_, dotIdx) => (
                <button
                  key={dotIdx}
                  type="button"
                  onClick={() => goToSlide(dotIdx)}
                  aria-label={`Go to slide ${dotIdx + 1}`}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    dotIdx === currentIndex
                      ? "w-6 bg-[#D9362B]"
                      : "w-2 bg-[#77776F] hover:bg-white"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
