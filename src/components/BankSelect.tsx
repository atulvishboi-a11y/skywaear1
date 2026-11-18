"use client";

import React, { useEffect, useId, useMemo, useRef, useState, useCallback } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { resolveIndianBank, searchIndianBanks } from "@/data/banks";

interface BankSelectProps {
  value: string;
  onChange: (bankName: string) => void;
  id?: string;
  invalid?: boolean;
  placeholder?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  PUBLIC: "Public Sector",
  PRIVATE: "Private",
  SMALL_FINANCE: "Small Finance",
  PAYMENTS: "Payments",
  REGIONAL_RURAL: "Gramin Bank",
  LOCAL_AREA: "Local Area",
  COOPERATIVE: "Co-op",
  FOREIGN: "Foreign",
};

export default function BankSelect({
  value,
  onChange,
  id,
  invalid = false,
  placeholder = "Search SBI, HDFC, PNB…",
}: BankSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [placement, setPlacement] = useState<"top" | "bottom">("bottom");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selected = resolveIndianBank(value);
  const results = useMemo(() => searchIndianBanks(query, 120), [query]);
  const displayValue = open ? query : selected?.name || value;

  // WhatsApp-style smooth keyboard scroll
  const scrollIntoActiveView = useCallback(() => {
    if (typeof window === "undefined" || !rootRef.current) return;
    setTimeout(() => {
      if (rootRef.current) {
        rootRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, 120);
  }, []);

  // Compute whether dropdown should open above or below the input based on keyboard space
  const updateDropdownPlacement = useCallback(() => {
    if (!rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const viewportHeight = window.visualViewport
      ? window.visualViewport.height
      : window.innerHeight;

    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    // When virtual keyboard opens, spaceBelow shrinks drastically
    if (spaceBelow < 250 && spaceAbove > spaceBelow) {
      setPlacement("top");
    } else {
      setPlacement("bottom");
    }
  }, []);

  // Listen for mobile keyboard appearance / resize events
  useEffect(() => {
    if (!open) return;

    updateDropdownPlacement();
    scrollIntoActiveView();

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    const onViewportChange = () => {
      updateDropdownPlacement();
      if (document.activeElement === inputRef.current) {
        scrollIntoActiveView();
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", onViewportChange);
      window.visualViewport.addEventListener("scroll", onViewportChange);
    }

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", onViewportChange);
        window.visualViewport.removeEventListener("scroll", onViewportChange);
      }
    };
  }, [open, scrollIntoActiveView, updateDropdownPlacement]);

  const openList = () => {
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      scrollIntoActiveView();
    });
  };

  const choose = (bankName: string) => {
    onChange(bankName);
    setOpen(false);
    setQuery("");
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (!open) {
        openList();
      } else if (results[activeIndex]) {
        choose(results[activeIndex].name);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && results[activeIndex] ? `${listId}-option-${activeIndex}` : undefined
          }
          autoComplete="off"
          value={displayValue}
          placeholder={placeholder}
          onClick={() => {
            if (!open) openList();
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            if (!open) setOpen(true);
            updateDropdownPlacement();
          }}
          onFocus={() => {
            if (!open) openList();
            scrollIntoActiveView();
          }}
          onBlur={() => window.setTimeout(() => setOpen(false), 160)}
          onKeyDown={handleKeyDown}
          className={`w-full border bg-[#0A0B0E] py-2 pl-3 pr-9 text-base sm:text-xs text-white placeholder-[#8E929B] focus:outline-none transition-all ${
            invalid
              ? "border-[#D9362B] focus:border-[#D9362B]"
              : "border-white/[0.08] focus:border-[#00FF66]"
          }`}
        />
        {open && query ? (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              setQuery("");
              inputRef.current?.focus();
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#8E929B] hover:text-white cursor-pointer"
            aria-label="Clear bank search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E929B]" />
        )}
      </div>

      {open && (
        <div
          id={listId}
          role="listbox"
          className={`absolute left-0 right-0 z-50 max-h-64 sm:max-h-72 overflow-y-auto border border-white/[0.14] bg-[#11131A] shadow-[0_16px_36px_rgba(0,0,0,0.6)] divide-y divide-white/[0.04] rounded-sm overscroll-contain ${
            placement === "top"
              ? "bottom-full mb-1.5"
              : "top-full mt-1.5"
          }`}
        >
          {results.length === 0 ? (
            <div className="px-3 py-3 text-xs text-[#8E929B] flex items-center gap-2">
              <Search className="w-3.5 h-3.5 opacity-60" />
              <span>No matching bank found for &quot;{query}&quot;.</span>
            </div>
          ) : (
            results.map((bank, index) => {
              const isSelected = selected?.name === bank.name;
              const isActive = index === activeIndex;
              return (
                <button
                  key={bank.name}
                  id={`${listId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onPointerDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(bank.name)}
                  className={`flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-xs transition-colors touch-manipulation cursor-pointer ${
                    isActive ? "bg-white/[0.08] text-white" : "text-[#D5D7DC] hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 flex-wrap">
                      <span className="truncate font-semibold text-white">{bank.name}</span>
                      {bank.category && (
                        <span className="shrink-0 rounded bg-white/[0.06] border border-white/[0.08] px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider text-[#8E929B]">
                          {CATEGORY_LABELS[bank.category] || bank.category}
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-[10px] uppercase tracking-wider text-[#8E929B] font-mono mt-0.5">
                      Code: {bank.shortName}
                    </span>
                  </span>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-[#00FF66]" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
