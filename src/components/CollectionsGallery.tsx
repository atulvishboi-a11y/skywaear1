"use client";

import React from "react";
import { ArrowRight } from "lucide-react";

export interface CollectionCard {
  id: string;
  label: string;
  /** Storefront category to filter by, or null when the tile opens a merchandising tab. */
  category: string | null;
  tab?: "premium";
  desc: string;
  image: string;
  count: number;
}

interface CollectionsGalleryProps {
  collections: CollectionCard[];
  onSelectCard: (card: CollectionCard) => void;
}

/**
 * Collection tiles are derived from whatever is actually live on the storefront, so an
 * unpublished drop can never leave a dead "Shop Backpacks" card behind.
 */
export default function CollectionsGallery({ collections, onSelectCard }: CollectionsGalleryProps) {
  if (collections.length === 0) return null;

  return (
    <section className="w-full bg-[#0B0C10] py-12 sm:py-16 border-t border-b border-[#282C34] font-mono">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 border-b border-[#282C34] pb-4">
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-[#00FF66]">
              [THEME ARCHIVE // SYSTEM]
            </p>
            <h2
              className="text-2xl sm:text-3xl md:text-4xl font-bold uppercase tracking-tight text-[#F5F5F7] mt-1"
              style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
            >
              Shop By Anime Series
            </h2>
          </div>
          <p className="text-xs text-[#8E929B] font-mono max-w-sm">
            Live catalog archives curated by franchise. Tap any series to filter drops below.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {collections.map((card, index) => (
            <div
              key={card.id}
              onClick={() => onSelectCard(card)}
              className="group relative bg-[#16181D] border border-[#282C34] hover:border-[#00FF66] transition-colors duration-150 cursor-pointer flex flex-col justify-between"
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-[#0B0C10]">
                <img
                  src={card.image}
                  alt={card.label}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-2 left-2 px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider bg-[#0B0C10] text-[#00FF66] border border-[#282C34]">
                  {card.count} {card.count === 1 ? "DROP" : "DROPS"}
                </div>
                <div className="absolute top-2 right-2 px-1.5 py-0.5 text-[8px] font-mono text-[#8E929B] bg-[#0B0C10]/90 border border-[#282C34]">
                  #{String(index + 1).padStart(2, "0")}
                </div>
              </div>

              <div className="p-3 bg-[#16181D] border-t border-[#282C34] flex flex-col justify-between flex-1">
                <div>
                  <h3
                    className="text-xs font-bold uppercase text-[#F5F5F7] group-hover:text-[#00FF66] transition-colors"
                    style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
                  >
                    {card.label}
                  </h3>
                  <p className="text-[10px] text-[#8E929B] font-mono line-clamp-1 mt-1">{card.desc}</p>
                </div>
                <div className="mt-3 pt-2 border-t border-[#282C34] flex items-center justify-between text-[10px] font-mono font-bold text-[#F5F5F7] group-hover:text-[#00FF66] transition-colors">
                  <span>FILTER ARCHIVE</span>
                  <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
