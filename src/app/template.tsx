"use client";

import React, { useRef, useLayoutEffect, useEffect } from "react";
import gsap from "gsap";
import { saveReferral, getStoredReferral, recoverReferralFromServer } from "@/lib/referral-tracker";

export default function Template({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const urlRef = new URLSearchParams(window.location.search).get("ref");
      if (urlRef?.trim()) {
        saveReferral(urlRef.trim().toUpperCase());
      } else {
        // If no code in URL and no code in local storage, check server fingerprint bridge
        const stored = getStoredReferral();
        if (!stored.code) {
          recoverReferralFromServer().catch(() => {});
        }
      }
    } catch {}
  }, []);

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    // Reset scroll smoothly to top on route change
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });

    const ctx = gsap.context(() => {
      // 1. Subtle top transition glow indicator
      if (indicatorRef.current) {
        gsap.fromTo(
          indicatorRef.current,
          { scaleX: 0, opacity: 1 },
          {
            scaleX: 1,
            duration: 0.35,
            ease: "power3.inOut",
            onComplete: () => {
              gsap.to(indicatorRef.current, { opacity: 0, duration: 0.2 });
            },
          }
        );
      }

      // 2. Smooth cinematic screen entrance (non-blocking, starts near-full opacity to avoid blank flash)
      gsap.fromTo(
        containerRef.current,
        {
          opacity: 0.85,
          y: 4,
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.22,
          ease: "power2.out",
          clearProps: "transform,opacity",
        }
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className="relative w-full max-w-full min-h-screen flex flex-col overflow-x-clip">
      {/* Top transition glow line */}
      <div
        ref={indicatorRef}
        aria-hidden="true"
        className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#D9362B] via-[#FF3B30] to-[#D9362B] z-[9999] origin-left pointer-events-none shadow-[0_0_12px_rgba(217,54,43,0.8)]"
      />
      <div ref={containerRef} className="w-full max-w-full flex-1 flex flex-col overflow-x-clip">
        {children}
      </div>
    </div>
  );
}
