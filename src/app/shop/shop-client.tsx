"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  RefreshCw,
  Star,
  Ruler,
  Grid2X2,
  Square,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import SizeChartModal from "@/components/SizeChartModal";
import SkyCoinIcon from "@/components/SkyCoinIcon";
import SizeChartTable from "@/components/SizeChartTable";
import { PRODUCTS, type Product } from "@/data/products";
import { useCart, cartLineId } from "@/lib/cart";
import { formatRupees } from "@/lib/domain";
import { getProductCoins, stockState } from "@/lib/catalog";
import { api } from "@/lib/client";
import { staggerEntrance, animateModalEnter } from "@/lib/gsap";

const FILTERS = ["ALL", "280 GSM", "ANIME"] as const;
type Filter = (typeof FILTERS)[number];

function cleanBadge(badge?: string) {
  const text = (badge ?? "").replace(/[^\x20-\x7E]+/g, " ").trim();
  return text || "Archive drop";
}

export default function ShopPage() {
  const router = useRouter();
  const { add: addToCart, buyNow: buyNowCart, items: cartItems } = useCart();
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [activeFilter, setActiveFilter] = useState<Filter>("ALL");
  const [gridMode, setGridMode] = useState<"compact" | "comfort">("compact");
  const [isSizeChartOpen, setIsSizeChartOpen] = useState(false);
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({});
  const [previewSides, setPreviewSides] = useState<Record<string, "front" | "back">>({});
  const [buyProduct, setBuyProduct] = useState<Product | null>(null);
  const [buySize, setBuySize] = useState<string | null>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const quickBuyDialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!buyProduct) return;
    animateModalEnter(quickBuyDialogRef.current);
  }, [buyProduct]);

  useEffect(() => {
    if (gridContainerRef.current) {
      staggerEntrance("article", gridContainerRef.current, 0.03);
    }
  }, [activeFilter, products.length]);

  useEffect(() => {
    let mounted = true;
    const fetchLatest = () => {
      api
        .storefront()
        .then((data) => {
          if (mounted && data.products) {
            setProducts(data.products);
          }
        })
        .catch((err) => console.error("Shop products fetch failed:", err));
    };

    fetchLatest();
    window.addEventListener("focus", fetchLatest);
    const timer = setInterval(fetchLatest, 10000);

    return () => {
      mounted = false;
      window.removeEventListener("focus", fetchLatest);
      clearInterval(timer);
    };
  }, []);

  const sizeFor = (product: Product) => {
    const saved = selectedSizes[product.id];
    if (saved && product.sizes.includes(saved)) return saved;
    return product.sizes.includes("L") ? "L" : product.sizes[0] ?? "L";
  };

  const [isNavigating, setIsNavigating] = useState(false);

  // Eagerly prefetch checkout chunks so Buy Now transitions instantly without delay
  useEffect(() => {
    try {
      router.prefetch("/checkout");
      router.prefetch("/cart");
    } catch {}

    const handlePageShow = () => {
      setIsNavigating(false);
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [router]);

  const handleQuickAdd = (product: Product, buyNow = false, sizeOverride?: string) => {
    if (isNavigating) return;
    if (!stockState(product).purchasable) return;

    const size = sizeOverride ?? sizeFor(product);
    const side = previewSides[product.id] || product.heroImage || "front";
    const color = product.colors?.[0] || { name: "Onyx Black", hex: "#0B0C10" };
    const lineId = cartLineId(product.id, size, color.name, side);
    const backImage = product.imageBackUrl || product.artworkUrl;
    const itemImg = side === "back" && backImage ? backImage : product.imageUrl;
    const coins = getProductCoins(product);

    const item = {
      id: lineId,
      productId: product.id,
      title: product.title,
      price: product.price,
      quantity: 1,
      size,
      colorName: color.name,
      colorHex: color.hex,
      side,
      imageUrl: itemImg,
    };

    if (buyNow) {
      try {
        setIsNavigating(true);
        buyNowCart(item);
        router.push("/checkout");
        // Ultra-fast fail-safe navigation in case client router takes >350ms
        setTimeout(() => {
          if (typeof window !== "undefined" && window.location.pathname !== "/checkout") {
            window.location.assign("/checkout");
          }
        }, 350);
        // Safety unlock: ensure button becomes interactive again if navigation was interrupted
        setTimeout(() => {
          setIsNavigating(false);
        }, 3500);
      } catch (err) {
        setIsNavigating(false);
        console.error("Buy now navigation failed:", err);
        window.location.assign("/checkout");
      }
      return;
    }

    addToCart(item);
    toast.success(`${product.title} (Size ${size}) added to bag`, {
      description:
        coins > 0
          ? `+${coins.toLocaleString("en-IN")} Sky Cash unlocks after delivery.`
          : "Ready for checkout whenever you are.",
      action: {
        label: "View bag",
        onClick: () => router.push("/cart"),
      },
    });
  };

  useEffect(() => {
    if (!buyProduct) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setBuyProduct(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [buyProduct]);

  const filteredProducts = products.filter((product) => {
    if (activeFilter === "280 GSM") return product.gsm === 280;
    if (activeFilter === "ANIME") return product.showInAnime;
    return true;
  });

  return (
    <div className="min-h-[100dvh] bg-[#0A0B0E] text-[#F5F5F7] flex flex-col antialiased selection:bg-[#D9362B] selection:text-white">
      <Header cartCount={cartItems.length} />

      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Catalog */}
        <div className="space-y-5">
          <div className="flex flex-col gap-4 border-b border-[#282C34] pb-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8E929B]">
                  Catalog
                </p>
                <h2 className="text-lg sm:text-xl font-bold uppercase tracking-tight text-white">
                  Available pieces{" "}
                  <span className="text-[#8E929B]">({filteredProducts.length})</span>
                </h2>
              </div>

              <div role="group" aria-label="Grid density" className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  title="Comfortable 1 x 1 grid"
                  aria-label="Comfortable 1 x 1 grid"
                  aria-pressed={gridMode === "comfort"}
                  onClick={() => setGridMode("comfort")}
                  className={`flex h-9 w-9 items-center justify-center border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FF66] ${
                    gridMode === "comfort"
                      ? "border-[#F5F5F7] bg-[#F5F5F7] text-[#0B0C10]"
                      : "border-[#282C34] bg-transparent text-[#8E929B] hover:border-[#8E929B] hover:text-white"
                  }`}
                >
                  <Square className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="Compact 2 x 2 grid"
                  aria-label="Compact 2 x 2 grid"
                  aria-pressed={gridMode === "compact"}
                  onClick={() => setGridMode("compact")}
                  className={`flex h-9 w-9 items-center justify-center border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FF66] ${
                    gridMode === "compact"
                      ? "border-[#F5F5F7] bg-[#F5F5F7] text-[#0B0C10]"
                      : "border-[#282C34] bg-transparent text-[#8E929B] hover:border-[#8E929B] hover:text-white"
                  }`}
                >
                  <Grid2X2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div role="group" aria-label="Filter drops" className="flex items-center gap-1.5">
                {FILTERS.map((filter) => {
                  const isActive = activeFilter === filter;
                  return (
                    <button
                      key={filter}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setActiveFilter(filter)}
                      className={`h-9 border px-3 text-[10px] font-bold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FF66] ${
                        isActive
                          ? "border-[#F5F5F7] bg-[#F5F5F7] text-[#0B0C10]"
                          : "border-[#282C34] bg-transparent text-[#8E929B] hover:border-[#8E929B] hover:text-white"
                      }`}
                    >
                      {filter === "ALL" ? "All drops" : filter}
                    </button>
                  );
                })}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-haspopup="dialog"
                onClick={() => setIsSizeChartOpen(true)}
                className="rounded-none border-[#282C34] bg-transparent text-[10px] tracking-wider hover:bg-[#F5F5F7] hover:text-[#0B0C10] hover:border-[#F5F5F7]"
              >
                <Ruler className="h-3.5 w-3.5" />
                Size guide
              </Button>
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 border border-dashed border-[#282C34] bg-[#11131A] px-6 py-16 text-center">
              <p className="text-sm font-bold uppercase tracking-wider text-white">
                No pieces in this filter
              </p>
              <p className="max-w-[42ch] text-xs leading-relaxed text-[#8E929B]">
                This drop has not landed here yet. Show everything in the archive or check back
                after the next release.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveFilter("ALL")}
                className="rounded-none border-[#282C34] bg-transparent"
              >
                Show all drops
              </Button>
            </div>
          ) : (
            <div
              ref={gridContainerRef}
              className={
                gridMode === "compact"
                  ? "grid grid-cols-2 gap-1.5 sm:gap-2 md:grid-cols-3 xl:grid-cols-4"
                  : "grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3"
              }
            >
              {filteredProducts.map((product, idx) => {
                const isCompact = gridMode === "compact";
                const currentSide = previewSides[product.id] || product.heroImage || "front";
                const selectedSize = sizeFor(product);
                const stock = stockState(product);
                const backImage = product.imageBackUrl || product.artworkUrl;
                const hasBack = Boolean(backImage);
                const displayImage =
                  currentSide === "back" && backImage ? backImage : product.imageUrl;
                const productCoins = getProductCoins(product);
                const hasDiscount = product.mrp > product.price;
                const discount = hasDiscount
                  ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
                  : 0;

                return (
                  <article
                    key={product.id}
                    className="group flex flex-col border border-[#282C34] bg-[#16181D] transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-[#8E929B] hover:-translate-y-1 hover:shadow-xl hover:shadow-black/60 will-change-transform"
                  >
                    {/* Studio image: no chips over the product */}
                    <Link
                      href={`/product/${product.slug}`}
                      aria-label={`View ${product.title}`}
                      className={`relative flex items-center justify-center overflow-hidden bg-[#D3D3D3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#00FF66] ${
                        isCompact ? "aspect-[4/5] p-0" : "aspect-[4/5] p-5"
                      }`}
                    >
                      {displayImage && (
                        <Image
                          src={displayImage}
                          alt={product.title}
                          fill
                          priority={idx < 4}
                          sizes={
                            isCompact
                              ? "(max-width: 768px) 50vw, (max-width: 1279px) 33vw, 25vw"
                              : "(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          }
                          className={`transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-[1.035] ${
                            isCompact ? "object-cover" : "object-contain p-5"
                          }`}
                        />
                      )}
                      {!stock.purchasable && (
                        <span className="absolute inset-x-0 bottom-0 border-t border-[#282C34] bg-[#0B0C10]/90 px-4 py-2 text-center text-[10px] font-bold uppercase tracking-[0.16em] text-[#F5F5F7]">
                          Sold out
                        </span>
                      )}
                    </Link>

                    {/* Image caption: merchandising meta + flip control */}
                    {!isCompact && (
                    <div className="flex h-11 items-stretch justify-between border-b border-[#282C34]">
                      <div className="flex min-w-0 flex-1 items-center gap-2 px-4">
                        <span
                          aria-hidden
                          className={`h-1.5 w-1.5 shrink-0 ${
                            stock.purchasable ? "bg-[#D9362B]" : "bg-[#8E929B]"
                          }`}
                        />
                        <span className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-[#F5F5F7]">
                          {cleanBadge(product.badge)}
                        </span>
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8E929B]">
                          {product.gsm} GSM
                        </span>
                      </div>

                      {hasBack && (
                        <button
                          type="button"
                          title="Flip front and back view"
                          aria-label={`${currentSide === "front" ? "Show back" : "Show front"} of ${product.title}`}
                          aria-pressed={currentSide === "back"}
                          onClick={() =>
                            setPreviewSides((prev) => ({
                              ...prev,
                              [product.id]: currentSide === "front" ? "back" : "front",
                            }))
                          }
                          className="flex shrink-0 items-center gap-1.5 border-l border-[#282C34] px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8E929B] transition-colors duration-200 hover:bg-[#F5F5F7] hover:text-[#0B0C10] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#00FF66]"
                        >
                          <RefreshCw className="h-3 w-3" />
                          {currentSide === "front" ? "Back" : "Front"}
                        </button>
                      )}
                    </div>
                    )}

                    {/* Details */}
                    <div
                      className={`flex flex-1 flex-col ${
                        isCompact ? "gap-2 p-3" : "gap-5 p-4 sm:p-5"
                      }`}
                    >
                      <div className={isCompact ? "space-y-1.5" : "space-y-3"}>
                        {isCompact ? (
                          <p className="truncate text-[9px] font-bold uppercase tracking-[0.12em] text-[#8E929B]">
                            {cleanBadge(product.badge)} <span aria-hidden>·</span>{" "}
                            {product.gsm} GSM
                          </p>
                        ) : (
                          <div className="flex items-start justify-between gap-3">
                            <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-[#8E929B]">
                              {product.theme || "Skywear archive"}
                            </p>
                            <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-[#F5F5F7]">
                              <Star className="h-3 w-3 fill-[#00FF66] text-[#00FF66]" />
                              {product.rating}
                              <span className="font-normal text-[#8E929B]">
                                ({product.reviewsCount})
                              </span>
                            </span>
                          </div>
                        )}

                        <Link
                          href={`/product/${product.slug}`}
                          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FF66]"
                        >
                          <h3
                            className={`line-clamp-2 font-bold uppercase leading-[1.3] tracking-tight text-white underline-offset-4 decoration-2 decoration-[#D9362B] group-hover:underline ${
                              isCompact ? "text-[12px]" : "text-[15px] sm:text-base"
                            }`}
                            style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
                          >
                            {product.title}
                          </h3>
                        </Link>

                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span
                            className={
                              isCompact
                                ? "text-sm font-bold text-white"
                                : "text-lg sm:text-xl font-bold text-white"
                            }
                          >
                            {formatRupees(product.price)}
                          </span>
                          {hasDiscount && (
                            <span
                              className={`text-[#8E929B] line-through ${
                                isCompact ? "text-[10px]" : "text-xs"
                              }`}
                            >
                              {formatRupees(product.mrp)}
                            </span>
                          )}
                          {hasDiscount && (
                            <span
                              className={`ml-auto font-bold uppercase tracking-wider text-[#D9362B] ${
                                isCompact ? "text-[9px]" : "text-[10px]"
                              }`}
                            >
                              -{discount}%
                            </span>
                          )}
                        </div>

                        {productCoins > 0 &&
                          (isCompact ? (
                            <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#00FF66]">
                              <SkyCoinIcon className="h-4 w-4 shrink-0 text-white" />
                              +{productCoins.toLocaleString("en-IN")} Sky Cash
                            </p>
                          ) : (
                            <p className="flex items-baseline gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#00FF66]">
                              <SkyCoinIcon className="h-4 w-4 shrink-0 self-center text-white" />
                              +{productCoins.toLocaleString("en-IN")} Sky Cash
                              <span className="font-normal text-[#8E929B]">after delivery</span>
                            </p>
                          ))}
                      </div>

                      {isCompact ? (
                        <div className="mt-auto grid grid-cols-2 gap-2">
                          <Link
                            href={`/product/${product.slug}`}
                            className="flex h-9 items-center justify-center border border-[#282C34] bg-transparent px-2 text-[10px] font-bold uppercase tracking-wider text-[#F5F5F7] transition-colors duration-150 hover:border-[#F5F5F7] hover:bg-[#F5F5F7] hover:text-[#0B0C10] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FF66]"
                          >
                            View
                          </Link>
                          <button
                            type="button"
                            disabled={!stock.purchasable}
                            onClick={() => {
                              setBuySize(sizeFor(product));
                              setBuyProduct(product);
                            }}
                            className="flex h-9 items-center justify-center gap-1.5 border border-[#F5F5F7] bg-[#F5F5F7] px-2 text-[10px] font-bold uppercase tracking-wider text-[#0B0C10] transition-colors duration-150 hover:border-[#00FF66] hover:bg-[#00FF66] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FF66] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <ShoppingBag className="h-3.5 w-3.5" />
                            {stock.purchasable ? "Buy" : "Sold out"}
                          </button>
                        </div>
                      ) : (
                      <div className="mt-auto space-y-2.5">
                        <div className="flex items-baseline justify-between gap-2 text-[10px] uppercase tracking-[0.12em] text-[#8E929B]">
                          <span>Size</span>
                          <span className={stock.low ? "font-bold text-[#D9362B]" : ""}>
                            {stock.low ? `Only ${stock.count} left` : "Oversized fit"}
                          </span>
                        </div>

                        <div className="flex gap-1.5">
                          {product.sizes.map((size) => {
                            const isSelected = selectedSize === size;
                            return (
                              <button
                                key={size}
                                type="button"
                                aria-pressed={isSelected}
                                onClick={() =>
                                  setSelectedSizes((prev) => ({ ...prev, [product.id]: size }))
                                }
                                className={`h-9 flex-1 border text-[11px] font-bold uppercase transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FF66] ${
                                  isSelected
                                    ? "border-[#F5F5F7] bg-[#F5F5F7] text-[#0B0C10]"
                                    : "border-[#282C34] bg-transparent text-[#8E929B] hover:border-[#8E929B] hover:text-white"
                                }`}
                              >
                                {size}
                              </button>
                            );
                          })}
                        </div>

                        <div className="grid grid-cols-2 gap-2 border-t border-[#282C34] pt-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!stock.purchasable}
                            onClick={() => handleQuickAdd(product)}
                            className="h-11 rounded-none border-[#282C34] bg-transparent text-[10px] tracking-wider hover:border-[#F5F5F7] hover:bg-[#F5F5F7] hover:text-[#0B0C10]"
                          >
                            <ShoppingBag className="h-3.5 w-3.5" />
                            {stock.purchasable ? "Add to bag" : "Sold out"}
                          </Button>

                          <Button
                            type="button"
                            variant="brandRed"
                            size="sm"
                            disabled={!stock.purchasable || isNavigating}
                            onMouseEnter={() => {
                              try { router.prefetch("/checkout"); } catch {}
                            }}
                            onTouchStart={() => {
                              try { router.prefetch("/checkout"); } catch {}
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickAdd(product, true);
                            }}
                            className="h-11 rounded-none text-[10px] tracking-wider"
                          >
                            {isNavigating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Buy now"}
                          </Button>
                        </div>
                      </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <SizeChartModal isOpen={isSizeChartOpen} onClose={() => setIsSizeChartOpen(false)} />

      {buyProduct && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6"
          onClick={() => setBuyProduct(null)}
        >
          <div
            ref={quickBuyDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Select size for ${buyProduct.title}`}
            onClick={(event) => event.stopPropagation()}
            className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto border border-[#282C34] bg-[#16181D] p-4 text-[#F5F5F7] shadow-2xl sm:p-5 will-change-[transform,opacity]"
          >
            <button
              type="button"
              onClick={() => setBuyProduct(null)}
              aria-label="Close size selection"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center border border-transparent text-[#8E929B] transition-colors hover:border-[#282C34] hover:text-[#F5F5F7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FF66]"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 pr-8">
              <span className="relative flex h-14 w-11 shrink-0 items-center justify-center overflow-hidden bg-[#D3D3D3]">
                {buyProduct.imageUrl && (
                  <Image
                    src={buyProduct.imageUrl}
                    alt={buyProduct.title}
                    fill
                    sizes="44px"
                    className="object-cover"
                  />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold leading-tight text-white">
                  {buyProduct.title}
                </p>
                <p className="mt-0.5 text-[12px] text-[#8E929B]">
                  {formatRupees(buyProduct.price)} · {buyProduct.gsm} GSM
                </p>
              </div>
            </div>

            <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8E929B]">
              Select size
            </p>

            <div className="mt-2 grid grid-cols-5 gap-1.5">
              {buyProduct.sizes.map((size) => {
                const isActive = buySize === size;
                return (
                  <button
                    key={size}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setBuySize(size)}
                    className={`h-10 border text-[11px] font-bold uppercase transition-colors duration-150 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FF66] ${
                      isActive
                        ? "border-[#F5F5F7] bg-[#F5F5F7] text-[#0B0C10]"
                        : "border-[#282C34] bg-transparent text-[#8E929B] hover:border-[#8E929B] hover:text-white"
                    }`}
                  >
                    {size}
                  </button>
                );
              })}
            </div>

            <SizeChartTable
              selectedSize={buySize ?? undefined}
              className="mt-4 border-t border-[#282C34] pt-3"
            />

            <button
              type="button"
              disabled={!buySize || isNavigating}
              onMouseEnter={() => {
                try { router.prefetch("/checkout"); } catch {}
              }}
              onTouchStart={() => {
                try { router.prefetch("/checkout"); } catch {}
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (!buySize || isNavigating) return;
                setSelectedSizes((prev) => ({ ...prev, [buyProduct.id]: buySize }));
                handleQuickAdd(buyProduct, true, buySize);
              }}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 border border-[#D9362B] bg-[#D9362B] text-[11px] font-bold uppercase tracking-wider text-white transition-colors duration-150 hover:border-[#F5F5F7] hover:bg-[#F5F5F7] hover:text-[#0B0C10] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FF66] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isNavigating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Proceeding to checkout...
                </>
              ) : (
                <>
                  <ShoppingBag className="h-4 w-4" />
                  Buy now{buySize ? ` · Size ${buySize}` : ""}
                </>
              )}
            </button>

            <p className="mt-2.5 text-center text-[10px] uppercase tracking-[0.1em] text-[#8E929B]">
              Oversized fit · Free size exchange
            </p>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
