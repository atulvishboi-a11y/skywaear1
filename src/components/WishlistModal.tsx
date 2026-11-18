"use client";

import { useEffect } from "react";
import { Heart, ShoppingBag, Trash2, X } from "lucide-react";
import TShirtMockup from "./TShirtMockup";
import type { Product } from "@/data/products";
import { formatRupees } from "@/lib/domain";

interface WishlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onRemoveFromWishlist: (productId: string) => void;
  onAddToCart: (product: Product) => void;
}

export default function WishlistModal({
  isOpen,
  onClose,
  products,
  onRemoveFromWishlist,
  onAddToCart,
}: WishlistModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const savedValue = products.reduce((sum, product) => sum + (product.mrp - product.price), 0);

  return (
    <div
      className={`fixed inset-0 z-50 overflow-hidden ${isOpen ? "" : "pointer-events-none"}`}
      inert={!isOpen}
      aria-hidden={!isOpen}
    >
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-200 ease-out ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
      />

      <div className="absolute inset-y-0 right-0 flex max-w-full pl-10 font-mono">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="wishlist-title"
          style={{ transitionTimingFunction: "var(--ease-drawer)" }}
          className={`flex w-full flex-col border-l border-[#282C34] bg-[#0B0C10] text-[#F5F5F7] shadow-2xl transition-transform duration-220 overscroll-contain sm:max-w-md ${
            isOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <header className="flex items-center justify-between gap-3 border-b border-[#282C34] bg-[#16181D] p-5">
            <div className="flex min-w-0 items-center gap-2">
              <Heart className="h-5 w-5 shrink-0 fill-current text-rose-500" />
              <h2
                id="wishlist-title"
                className="truncate text-base font-black uppercase tracking-wider text-white font-sans"
                style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
              >
                Saved styles
              </h2>
              <span className="shrink-0 rounded-none bg-[#00FF66] px-2 py-0.5 text-xs font-bold text-[#0B0C10]">
                {products.length}
              </span>
            </div>
            <button
              onClick={onClose}
              aria-label="Close wishlist"
              className="flex min-h-10 min-w-10 items-center justify-center rounded-none text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          {products.length > 0 && (
            <p className="border-b border-[#282C34] bg-[#16181D] px-5 py-2.5 text-[11px] uppercase tracking-wider text-[#00FF66] font-mono">
              {formatRupees(savedValue)} saved against MRP on these styles
            </p>
          )}

          <div className="flex-1 overflow-y-auto p-4">
            {products.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <Heart className="h-10 w-10 text-neutral-600" />
                <p className="text-sm font-bold uppercase tracking-wider text-white">Nothing saved yet</p>
                <p className="max-w-xs text-xs leading-relaxed text-[#8E929B] font-mono">
                  Tap the heart on any drop to hold it here while you decide.
                </p>
                <button
                  onClick={onClose}
                  className="mt-2 h-11 px-5 text-xs font-bold uppercase rounded-none bg-[#00FF66] text-[#0B0C10] hover:bg-[#00FF66]/80 font-mono transition-colors"
                >
                  Browse the drop
                </button>
              </div>
            ) : (
              <ul className="space-y-3">
                {products.map((product) => {
                  const save = product.mrp > product.price ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;
                  return (
                    <li key={product.id} className="flex gap-3 p-3 bg-[#16181D] border border-[#282C34] rounded-none">
                      <div className="w-20 shrink-0 overflow-hidden rounded-none border border-[#282C34] bg-[#0B0C10] p-1">
                        <TShirtMockup
                          colorHex={product.colors[0].hex}
                          graphicType={product.graphicSvgType}
                          side="front"
                          className="w-full aspect-[4/5]"
                        />
                      </div>

                      <div className="min-w-0 flex-1 font-mono">
                        <p
                          className="truncate text-xs font-bold uppercase tracking-wider text-white font-sans"
                          style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
                        >
                          {product.title}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] uppercase tracking-wider text-[#8E929B]">
                          {product.category} · {product.gsm} GSM
                        </p>
                        <p className="mt-1.5 text-sm font-black text-white">
                          {formatRupees(product.price)}{" "}
                          <span className="text-[11px] font-medium text-[#8E929B] line-through">
                            {formatRupees(product.mrp)}
                          </span>
                          {save > 0 && (
                            <span className="ml-1.5 rounded-none bg-[#00FF66] px-1.5 py-0.5 text-[10px] font-bold text-[#0B0C10]">
                              SAVE {save}%
                            </span>
                          )}
                        </p>

                        <div className="mt-2.5 flex items-center gap-2">
                          <button
                            onClick={() => onAddToCart(product)}
                            className="flex h-9 items-center gap-1.5 px-3 text-[11px] uppercase rounded-none bg-[#F5F5F7] text-[#0B0C10] hover:bg-[#00FF66] font-bold font-mono transition-colors"
                          >
                            <ShoppingBag className="h-3.5 w-3.5" /> Move to bag
                          </button>
                          <button
                            onClick={() => onRemoveFromWishlist(product.id)}
                            aria-label={`Remove ${product.title} from wishlist`}
                            className="flex h-9 w-9 items-center justify-center rounded-none border border-[#282C34] text-neutral-400 transition-colors hover:border-rose-500 hover:bg-[#0B0C10] hover:text-rose-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {products.length > 0 && (
            <footer className="border-t border-[#282C34] bg-[#16181D] px-5 py-3 text-[10px] uppercase tracking-wider text-[#8E929B] font-mono">
              Saved to this device · prices update with every drop
            </footer>
          )}
        </section>
      </div>
    </div>
  );
}
