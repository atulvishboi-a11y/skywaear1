"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useCart, useWishlist } from "@/lib/cart";
import { api } from "@/lib/client";
import type { StorefrontSnapshot } from "@/lib/contracts";
import type { Product } from "@/data/products";
import { formatRupees } from "@/lib/domain";
import { getProductCoins } from "@/lib/catalog";
import { Heart, ShoppingBag, ArrowLeft, Trash2, Coins, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function WishlistPage() {
  const router = useRouter();
  const cart = useCart();
  const wishlist = useWishlist();

  const [snapshot, setSnapshot] = useState<StorefrontSnapshot | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await api.storefront();
        if (mounted) setSnapshot(data);
      } catch (err) {
        console.error("Storefront fetch failed:", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const wishlistedProducts = (snapshot?.products ?? []).filter((p) => wishlist.has(p.id));

  return (
    <div className="min-h-screen bg-[#0A0B0E] text-[#F5F5F7] flex flex-col font-mono selection:bg-[#D9362B] selection:text-white antialiased">
      <Header
        cartCount={cart.count}
        wishlistCount={wishlist.count}
        walletPoints={snapshot?.customer?.availableCoins ?? 0}
      />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Breadcrumb / Back */}
        <div className="flex items-center gap-2 text-xs font-mono text-[#8E929B] mb-8">
          <Link href="/" className="hover:text-white flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> STORE
          </Link>
          <span className="text-white/20">/</span>
          <span className="text-white uppercase font-bold">SAVED PIECES ({wishlist.count})</span>
        </div>

        <div className="border-b border-white/[0.08] pb-6 mb-8">
          <span className="text-[10px] text-[#D9362B] font-bold uppercase tracking-widest block font-mono mb-1">
            ARCHIVE VAULT
          </span>
          <h1
            className="text-2xl sm:text-4xl font-bold uppercase tracking-tight text-white"
            style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
          >
            My Wishlist
          </h1>
          <p className="text-xs sm:text-sm font-sans text-[#8E929B] mt-1.5">
            Heavyweight streetwear silhouettes marked for rotation before the current inventory drop sells out.
          </p>
        </div>

        {wishlistedProducts.length === 0 ? (
          <div className="max-w-md mx-auto py-24 text-center flex flex-col items-center">
            <div className="w-20 h-20 rounded-2xl bg-[#11131A] border border-white/[0.08] flex items-center justify-center text-[#8E929B] mb-6 shadow-xl">
              <Heart className="w-9 h-9" />
            </div>
            <h2
              className="text-2xl sm:text-3xl font-bold uppercase tracking-tight text-white mb-2"
              style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
            >
              Your wishlist is empty
            </h2>
            <p className="text-xs font-sans text-[#8E929B] max-w-xs mb-8 leading-relaxed">
              Explore Skywear drops and tap the heart icon on any 280 GSM oversized piece to save it here.
            </p>
            <Link
              href="/shop"
              className="px-7 py-4 bg-[#D9362B] hover:bg-[#B82B22] text-white font-mono text-xs font-bold uppercase tracking-widest transition-all rounded-lg shadow-xl shadow-[#D9362B]/20 active:scale-95"
            >
              EXPLORE DROPS ↘
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {wishlistedProducts.map((p) => {
              const coins = getProductCoins(p);
              return (
                <div
                  key={p.id}
                  className="bg-[#11131A] border border-white/[0.08] rounded-xl p-4 sm:p-5 flex flex-col justify-between group hover:border-[#D9362B]/50 transition-all font-mono shadow-xl"
                >
                  <div>
                    <div className="relative aspect-[4/5] bg-[#0A0B0E] border border-white/[0.06] rounded-lg overflow-hidden mb-4 p-3 flex items-center justify-center">
                      <img
                        src={p.imageUrl || "/products/choso-front.webp"}
                        alt={p.title}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                      />
                      <button
                        onClick={() => {
                          wishlist.remove(p.id);
                          toast.error(`Removed ${p.title} from wishlist`);
                        }}
                        className="absolute top-2.5 right-2.5 p-2 bg-[#11131A]/90 hover:bg-[#D9362B] text-[#8E929B] hover:text-white rounded-full transition-all active:scale-95 shadow-md"
                        title="Remove from wishlist"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {/* GSM Tag */}
                      <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 bg-[#0A0B0E]/90 border border-white/[0.1] text-white text-[9px] font-bold rounded">
                        {p.gsm} GSM
                      </span>
                    </div>

                    <span className="text-[10px] text-[#D9362B] font-bold uppercase tracking-wider block mb-1">
                      {p.theme || "EXCLUSIVE DROP"}
                    </span>

                    <Link href={`/product/${p.slug}`}>
                      <h3 className="text-sm font-bold text-white uppercase hover:text-[#D9362B] transition-colors truncate font-sans">
                        {p.title}
                      </h3>
                    </Link>

                    <div className="mt-2.5 flex items-baseline gap-2">
                      <span className="text-base font-bold text-white font-sans">
                        {formatRupees(p.price)}
                      </span>
                      {p.mrp > p.price && (
                        <span className="text-xs text-[#8E929B] line-through font-sans">
                          {formatRupees(p.mrp)}
                        </span>
                      )}
                    </div>

                    {/* Sky Cash Badge */}
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-300 font-bold bg-amber-400/10 px-2 py-1 rounded border border-amber-400/20">
                      <Coins className="w-3 h-3 text-amber-400" />
                      <span>+{coins.toLocaleString("en-IN")} Sky Cash</span>
                    </div>
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-white/[0.08] flex gap-2">
                    <button
                      onClick={() => {
                        cart.addProduct(p, p.sizes.includes("L") ? "L" : p.sizes[0], p.colors?.[0]?.name || "Onyx Black");
                        toast.success(`${p.title} added to bag!`);
                        router.push("/cart");
                      }}
                      className="flex-1 py-3 bg-[#D9362B] hover:bg-[#B82B22] text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 rounded-lg transition-all active:scale-95 shadow-lg shadow-[#D9362B]/20 cursor-pointer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>ADD TO BAG</span>
                    </button>
                    <Link
                      href={`/product/${p.slug}`}
                      className="p-3 bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-white rounded-lg transition-all active:scale-95 flex items-center justify-center"
                      title="View Details"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Footer onSelectCategory={() => router.push("/")} />
    </div>
  );
}
