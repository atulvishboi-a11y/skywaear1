"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { SIZE_CHART } from "../data/products";
import SizeChartTable from "./SizeChartTable";
import { animateModalEnter } from "@/lib/gsap";

interface SizeChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSize?: string;
  onSelectSize?: (size: string) => void;
}

export default function SizeChartModal({
  isOpen,
  onClose,
  selectedSize,
  onSelectSize,
}: SizeChartModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    animateModalEnter(dialogRef.current);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Size chart"
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-md border border-[#282C34] bg-[#16181D] p-4 text-[#F5F5F7] shadow-2xl sm:p-5 will-change-[transform,opacity]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close size chart"
          className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center text-[#8E929B] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FF66]"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="pr-8">
          <h2 className="text-base font-bold uppercase tracking-tight text-white">Size Chart</h2>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-[#8E929B]">
            Unisex oversized · 240 GSM
          </p>
        </div>

        <SizeChartTable selectedSize={selectedSize} className="mt-4" />

        <p className="mt-3 border-t border-[#282C34] pt-2.5 text-[10px] leading-relaxed text-[#8E929B]">
          Oversized fit — take your usual size. Want a regular fit, size down one.
        </p>

        {onSelectSize ? (
          <div className="mt-2.5 flex items-center gap-1.5">
            <span className="mr-1 text-[10px] uppercase tracking-[0.1em] text-[#8E929B]">
              Select
            </span>
            {SIZE_CHART.map((column) => (
              <button
                key={column.size}
                type="button"
                aria-pressed={selectedSize === column.size}
                onClick={() => {
                  onSelectSize(column.size);
                  onClose();
                }}
                className={`h-8 flex-1 border text-[11px] font-bold uppercase transition-colors ${
                  selectedSize === column.size
                    ? "border-[#00FF66] bg-[#00FF66] text-[#0B0C10]"
                    : "border-[#282C34] text-[#8E929B] hover:border-[#8E929B] hover:text-white"
                }`}
              >
                {column.size}
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="mt-2.5 h-9 w-full bg-[#F5F5F7] text-[10px] font-bold uppercase tracking-wider text-[#0B0C10] transition-colors hover:bg-[#00FF66]"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
