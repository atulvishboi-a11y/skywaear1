"use client";

import React from "react";

export default function InstagramBanner() {
  return (
    <section className="relative w-full overflow-hidden bg-black text-white font-mono border-t border-b border-black/15">
      <div className="relative min-h-[320px] sm:min-h-[420px] md:min-h-[480px] w-full flex items-end justify-center pb-12 sm:pb-16 px-4">
        {/* Background Image with Dark Vignette */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('https://zenin.co.in/cdn/shop/files/webisntagram.jpg?v=1785195126&width=1800')",
          }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
        </div>

        {/* Content Box */}
        <div className="relative z-10 bg-[#0B0C10] border border-[#282C34] px-8 sm:px-12 py-6 text-center max-w-md w-full">
          <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#00FF66] mb-1">
            [OFFICIAL COMMUNITY // VERIFIED]
          </div>
          <p
            className="text-2xl sm:text-3xl font-bold uppercase tracking-wider text-[#F5F5F7]"
            style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
          >
            171K+ FOLLOWERS
          </p>
          <p className="mt-1 text-xs text-[#8E929B] font-mono">
            Join the official Skywear streetwear community on Instagram
          </p>
          <div className="mt-5">
            <a
              href="https://www.instagram.com/zeninclothing/"
              target="_blank"
              rel="noreferrer"
              className="inline-block w-full sm:w-auto px-8 py-3 bg-[#F5F5F7] text-[#0B0C10] font-bold text-xs uppercase tracking-widest hover:bg-[#00FF66] hover:text-[#0B0C10] transition-colors"
              style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
            >
              FOLLOW US ON INSTAGRAM →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
