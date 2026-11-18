"use client";

import * as React from "react";
import Image from "next/image";

export interface SkywearLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "full" | "icon";
  priority?: boolean;
}

export function SkywearIcon({
  className = "w-8 h-8",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      {/* Official S Favicon Monogram Vector */}
      <img
        src="/icon.svg"
        alt="Skywear S Monogram"
        width={48}
        height={48}
        loading={priority ? "eager" : "lazy"}
        className="w-full h-full object-contain select-none transition-transform duration-300 group-hover:scale-105"
      />
    </div>
  );
}

const WORDMARK_HEIGHTS = {
  sm: "clamp(15px, 3.6vw, 18px)",
  md: "clamp(18px, 2.4vw, 22px)",
  lg: "clamp(20px, 3vw, 26px)",
};

export default function SkywearLogo({
  className = "",
  size = "md",
  variant = "full",
  priority = true,
}: SkywearLogoProps) {
  if (variant === "icon") {
    const iconSizes = {
      sm: "w-7 h-7 sm:w-8 sm:h-8",
      md: "w-9 h-9 sm:w-10 sm:h-10",
      lg: "w-11 h-11 sm:w-12 sm:h-12",
    };
    return <SkywearIcon className={`${iconSizes[size]} ${className}`} priority={priority} />;
  }

  return (
    <Image
      src="/logo-skywear.png"
      alt="Skywear.in"
      width={1971}
      height={159}
      priority={priority}
      sizes="(max-width: 640px) 120px, 220px"
      style={{
        height: WORDMARK_HEIGHTS[size],
      }}
      className={`skywear-logo-img w-auto max-w-full object-contain transition-transform duration-300 group-hover:scale-[1.02] ${className}`}
    />
  );
}
