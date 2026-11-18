import React from "react";

interface SkyCoinIconProps {
  className?: string;
}

export default function SkyCoinIcon({ className = "h-4 w-4" }: SkyCoinIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-label="Sky Cash coin"
      focusable="false"
      fill="none"
    >
      <circle cx="12" cy="12" r="9.1" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M14.7 9.4c-.6-.65-1.5-1.05-2.55-1.05-1.55 0-2.65.8-2.65 1.95 0 1.1.85 1.6 2.4 1.9 1.5.3 2.75.75 2.75 2.1 0 1.25-1.15 2.05-2.6 2.05-1.25 0-2.3-.45-3-1.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
