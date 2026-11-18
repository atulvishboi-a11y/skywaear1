"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import SizeChartTable from "@/components/SizeChartTable";
import { SIZE_CHART } from "@/data/products";
import { animateModalEnter } from "@/lib/gsap";

interface SizePickerModalProps {
  productTitle: string;
  sizes: string[];
  /** Sizes that can be bought right now. An empty list means the drop is sold out. */
  availableSizes: string[];
  pending?: boolean;
  onClose: () => void;
  onContinue: (size: string) => void;
}

export default function SizePickerModal({
  productTitle,
  sizes,
  availableSizes,
  pending = false,
  onClose,
  onContinue,
}: SizePickerModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    animateModalEnter(dialogRef.current);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const soldOut = availableSizes.length === 0;
  const chartSizes = sizes.filter((size) => SIZE_CHART.some((column) => column.size === size));

  const continuePurchase = () => {
    if (pending) return;
    if (soldOut) {
      setError("This drop is sold out. Please check back soon.");
      return;
    }
    if (!selected) {
      setError("Please select your size to continue.");
      return;
    }
    onContinue(selected);
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Select your size"
        onClick={(event) => event.stopPropagation()}
        className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto border border-[#282C34] bg-[#16181D] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-[#F5F5F7] shadow-2xl will-change-[transform,opacity]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close size selection"
          className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center text-[#8E929B] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EC003F]"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="pr-8">
          <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-white">
            Select your size
          </h2>
          <p className="mt-1 truncate text-[10px] uppercase tracking-[0.1em] text-[#8E929B]">
            {productTitle}
          </p>
        </div>

        <p className="mt-3 text-[10px] uppercase tracking-[0.08em] text-[#8E929B]">
          Tap a size below · Compare measurements in inches or cm
        </p>

        <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label="Available sizes">
          {sizes.map((size) => {
            const available = availableSizes.includes(size);
            const isSelected = selected === size;
            return (
              <button
                key={size}
                type="button"
                disabled={!available || pending}
                aria-pressed={isSelected}
                aria-disabled={!available}
                onClick={() => {
                  setSelected(size);
                  setError(null);
                }}
                className={`flex h-12 flex-col items-center justify-center gap-0.5 rounded-md border text-xs font-bold uppercase tracking-wider transition-colors active:translate-y-px disabled:cursor-not-allowed ${
                  isSelected
                    ? "border-[#F5F5F7] bg-[#F5F5F7] text-[#0B0C10]"
                    : available
                      ? "border-[#282C34] bg-transparent text-[#C4C7D4] hover:border-[#8E929B] hover:text-white"
                      : "border-[#282C34] bg-transparent text-[#3A3E47]"
                }`}
              >
                <span className={available ? "" : "line-through"}>{size}</span>
                {!available && (
                  <span className="text-[8px] font-semibold uppercase tracking-[0.1em]">
                    Out of stock
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {chartSizes.length > 0 && (
          <div className="mt-4 border-t border-[#282C34] pt-3">
            <SizeChartTable selectedSize={selected || undefined} sizes={chartSizes} />
            <p className="mt-2 text-[10px] leading-relaxed text-[#8E929B]">
              Oversized fit — take your usual size. Want a regular fit, size down one.
              Measurements are garment, not body.
            </p>
          </div>
        )}

        <div className="mt-3 min-h-4">
          {soldOut ? (
            <p role="alert" className="text-[11px] text-[#D9362B]">
              This drop is sold out. Checkout is unavailable.
            </p>
          ) : error ? (
            <p role="alert" className="text-[11px] text-[#D9362B]">
              {error}
            </p>
          ) : selected ? null : (
            <p className="text-[10px] uppercase tracking-[0.08em] text-[#8E929B]">
              Choose your size to continue.
            </p>
          )}
        </div>

        <button
          type="button"
          aria-disabled={!selected || soldOut || pending}
          onClick={continuePurchase}
          className={`mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-md border text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors active:translate-y-px ${
            pending
              ? "cursor-wait border-[#EC003F] bg-[#EC003F] text-white opacity-75"
              : selected && !soldOut
                ? "border-[#EC003F] bg-[#EC003F] text-white hover:border-[#C90036] hover:bg-[#C90036]"
                : "cursor-not-allowed border-[#282C34] bg-[#282C34] text-[#8E929B]"
          }`}
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Continuing...</span>
            </>
          ) : (
            <span>{selected ? `Continue · Size ${selected}` : "Continue"}</span>
          )}
        </button>
      </div>
    </div>
  );
}
