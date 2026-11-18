"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Heart,
  Loader2,
  MapPin,
  RefreshCw,
  RotateCcw,
  Ruler,
  ShieldCheck,
  ShoppingBag,
  Star,
  Truck,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductReviewsSection from "@/components/ProductReviewsSection";
import { productHeroView } from "@/components/ProductMedia";
import SizeChartModal from "@/components/SizeChartModal";
import SizePickerModal from "@/components/SizePickerModal";
import SkyCoinIcon from "@/components/SkyCoinIcon";
import { PRODUCTS, type Product } from "@/data/products";
import { useCart, useWishlist, cartLineId } from "@/lib/cart";
import { formatRupees } from "@/lib/domain";
import { getProductCoins } from "@/lib/catalog";
import { api } from "@/lib/client";

export default function SingleProductPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [liveProducts, setLiveProducts] = useState<Product[]>(PRODUCTS);
  const [catalogLoaded, setCatalogLoaded] = useState(false);

  React.useEffect(() => {
    let mounted = true;
    api.storefront()
      .then((data) => {
        if (mounted && data.products) {
          setLiveProducts(data.products);
          setCatalogLoaded(true);
        }
      })
      .catch((err) => console.error("Storefront product fetch failed:", err));

    return () => {
      mounted = false;
    };
  }, []);

  const product: Product | undefined = useMemo(() => {
    const live = liveProducts.find((p) => p.slug === slug || p.id === slug);
    if (live) return live;
    // Once the live catalogue has answered, the seed array is history — a purged
    // drop must fall through to "Drop Not Found" instead of resurrecting from source.
    if (catalogLoaded) return undefined;
    return (
      PRODUCTS.find((p) => p.slug === slug || p.id === slug) ||
      liveProducts[0] ||
      PRODUCTS[0]
    );
  }, [slug, liveProducts, catalogLoaded]);

  // The chosen size is tied to the product id, defaulting to popular size L or first available.
  const [sizeChoice, setSizeChoice] = useState<{ productId: string; size: string }>({
    productId: product?.id ?? "",
    size: product?.sizes?.includes("L") ? "L" : product?.sizes?.[0] ?? "",
  });
  const selectedSize =
    product && sizeChoice.productId === product.id && sizeChoice.size
      ? sizeChoice.size
      : product?.sizes?.includes("L")
      ? "L"
      : product?.sizes?.[0] ?? "";
  const chooseSize = (size: string) => setSizeChoice({ productId: product?.id ?? "", size });
  const [sizeIntent, setSizeIntent] = useState<"buy" | "bag" | null>(null);
  const [activeSide, setActiveSide] = useState<"front" | "back">(product?.heroImage ?? "front");
  const [selectedColor, setSelectedColor] = useState<string>(
    product?.colors[0]?.name || "Onyx Black"
  );
  const [quantity, setQuantity] = useState<number>(1);
  const [isSizeChartModalOpen, setSizeChartModalOpen] = useState<boolean>(false);

  const [pincode, setPincode] = useState<string>("");
  const [deliveryResult, setDeliveryResult] = useState<{
    date: string;
    courier: string;
    isCodAvailable: boolean;
  } | null>(null);
  const [pincodeError, setPincodeError] = useState<string | null>(null);

  const { add: addToCart, buyNow: buyNowCart, items: cartItems } = useCart();
  const { toggle: toggleWishlist, has: inWishlist, count: wishlistCount } = useWishlist();

  const [cartToast, setCartToast] = useState<{ title: string; size: string } | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  // Eagerly prefetch checkout chunks so Buy Now transitions instantly without network lag
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

  if (!product) {
    return (
      <div className="min-h-screen bg-[#0A0B0E] text-[#F5F5F7] flex flex-col justify-between">
        <Header />
        <div className="max-w-md mx-auto text-center py-20 px-4 space-y-4">
          <p className="text-xl font-bold uppercase text-white">Drop Not Found</p>
          <p className="text-xs text-[#8E929B]">
            This limited edition streetwear drop may have been archived.
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#D9362B] text-white text-[10px] font-bold uppercase tracking-wider"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Shop
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const isFavorited = inWishlist(product.id);
  const currentColorObj =
    product.colors.find((c) => c.name === selectedColor) || product.colors[0];
  const productCoins = getProductCoins(product);
  const availableSizes =
    product.isArchived || (product.stock ?? 60) <= 0 ? [] : product.sizes;

  const frontImage = product.imageUrl || "/mockups/chos0_front/1.png";
  const backImage =
    product.imageBackUrl ||
    product.imageHoverUrl ||
    product.artworkUrl ||
    "/mockups/chos0_front/2.png";
  const currentDisplayImage = activeSide === "back" ? backImage : frontImage;
  const hasDiscount = product.mrp > product.price;
  const discount = hasDiscount
    ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
    : 0;

  const packRows = ([
    ["Fabric", product.fabric],
    ["Fit", product.packFit ?? ""],
    ["Print", product.packPrint ?? ""],
    ["Wash", product.packWash ?? ""],
  ] as [string, string][]).filter(([, value]) => value.trim().length > 0);

  const beginSwipe = (x: number, y: number) => {
    swipeStart.current = { x, y };
  };

  const endSwipe = (x: number, y: number) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = x - start.x;
    const dy = y - start.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    setActiveSide(dx < 0 ? "back" : "front");
  };

  const completePurchase = (size: string, buyNow: boolean) => {
    if (isNavigating || !size || !availableSizes.includes(size)) return;
    const lineId = cartLineId(product.id, size, currentColorObj.name, activeSide);
    const itemImg = activeSide === "back" ? backImage : frontImage;

    const item = {
      id: lineId,
      productId: product.id,
      title: product.title,
      price: product.price,
      quantity,
      size,
      colorName: currentColorObj.name,
      colorHex: currentColorObj.hex,
      side: activeSide,
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
        // Safety unlock: ensure button never stays permanently disabled if navigation is cancelled or delayed
        setTimeout(() => {
          setIsNavigating(false);
        }, 3500);
      } catch (err) {
        setIsNavigating(false);
        console.error("Buy now navigation failed:", err);
        window.location.assign("/checkout");
      }
    } else {
      addToCart(item);
      setCartToast({ title: product.title, size });
      setTimeout(() => setCartToast(null), 4000);
    }
  };

  const handleAddToCart = (buyNow = false) => {
    if (isNavigating) return;
    const effectiveSize =
      selectedSize && availableSizes.includes(selectedSize)
        ? selectedSize
        : availableSizes.includes("L")
        ? "L"
        : availableSizes[0];

    if (!effectiveSize) {
      setSizeIntent(buyNow ? "buy" : "bag");
      return;
    }
    completePurchase(effectiveSize, buyNow);
  };

  const handleSizePicked = (size: string) => {
    const intent = sizeIntent ?? "buy";
    setSizeIntent(null);
    chooseSize(size);
    completePurchase(size, intent === "buy");
  };

  const handleCheckPincode = (e: React.FormEvent) => {
    e.preventDefault();
    setPincodeError(null);
    if (!/^\d{6}$/.test(pincode.trim())) {
      setPincodeError("Enter a valid 6-digit Indian PIN code");
      setDeliveryResult(null);
      return;
    }

    const estimatedDays = pincode.startsWith("1") || pincode.startsWith("2") ? 2 : 3;
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + estimatedDays);
    const formattedDate = deliveryDate.toLocaleDateString("en-IN", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    setDeliveryResult({
      date: formattedDate,
      courier: "Express air · tracked",
      isCodAvailable: true,
    });
  };

  const otherProducts = liveProducts.filter((p) => p.id !== product.id).slice(0, 4);

  return (
    <div className="min-h-screen bg-[#0A0B0E] text-[#F5F5F7] flex flex-col selection:bg-[#D9362B] selection:text-white antialiased pb-[4.75rem] lg:pb-0">
      <Header cartCount={cartItems.length} wishlistCount={wishlistCount} />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-8 sm:pt-6 sm:pb-12 space-y-3 sm:space-y-10">
        <nav className="flex items-center gap-2 overflow-hidden text-[10px] text-[#8E929B] uppercase tracking-[0.1em]">
          <Link href="/" className="hover:text-white transition-colors">
            Home
          </Link>
          <ChevronRight className="w-3 h-3 text-white/20" />
          <Link href="/shop" className="hover:text-white transition-colors">
            Shop
          </Link>
          <ChevronRight className="w-3 h-3 text-white/20" />
          <span className="text-white truncate">{product.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-12 items-start">
          {/* Gallery */}
          <div className="lg:col-span-7 space-y-3">
            <div
              className="relative aspect-[4/5] overflow-hidden border border-[#282C34] bg-[#D3D3D3] group touch-pan-y"
              onTouchStart={(event) =>
                beginSwipe(event.touches[0].clientX, event.touches[0].clientY)
              }
              onTouchEnd={(event) =>
                endSwipe(event.changedTouches[0].clientX, event.changedTouches[0].clientY)
              }
              onPointerDown={(event) => {
                if (event.pointerType === "mouse") beginSwipe(event.clientX, event.clientY);
              }}
              onPointerUp={(event) => {
                if (event.pointerType === "mouse") endSwipe(event.clientX, event.clientY);
              }}
            >
              <Image
                src={currentDisplayImage}
                alt={`${product.title} - ${activeSide} view`}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 58vw"
                draggable={false}
                className="select-none object-cover transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-[1.035]"
              />

              <button
                type="button"
                onClick={() => setActiveSide(activeSide === "front" ? "back" : "front")}
                className="absolute bottom-3 left-3 flex items-center gap-1.5 border border-[#282C34] bg-[#0A0B0E]/85 px-2.5 py-2 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur-sm transition-colors hover:bg-[#F5F5F7] hover:text-[#0B0C10] active:translate-y-px"
              >
                <RefreshCw className="h-3 w-3" />
                {activeSide === "front" ? "Back" : "Front"}
              </button>
            </div>

            <div className="flex gap-2">
              {(
                [
                  { side: "front", image: frontImage, label: "Front" },
                  { side: "back", image: backImage, label: "Back" },
                ] as const
              ).map((thumb) => (
                <button
                  key={thumb.side}
                  type="button"
                  onClick={() => setActiveSide(thumb.side)}
                  aria-pressed={activeSide === thumb.side}
                  className={`relative aspect-[4/5] w-16 sm:w-20 overflow-hidden border transition-colors ${
                    activeSide === thumb.side
                      ? "border-[#F5F5F7]"
                      : "border-[#282C34] hover:border-[#8E929B]"
                  }`}
                >
                  <Image
                    src={thumb.image}
                    alt={`${product.title} ${thumb.label}`}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-[#0A0B0E]/85 py-1 text-center text-[9px] font-bold uppercase tracking-wider text-white">
                    {thumb.label}
                  </span>
                </button>
              ))}
            </div>

            <div className="hidden lg:block border-t border-[#282C34] pt-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8E929B]">
                Product overview
              </p>
              <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-[#C4C7D4]">
                {product.description || product.subtitle}
              </p>
            </div>
          </div>

          {/* Purchase panel */}
          <div className="lg:col-span-5 space-y-5">
            <div className="space-y-3 border-b border-[#282C34] pb-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8E929B]">
                  {product.badge || "Archive drop"} <span aria-hidden>·</span> {product.gsm} GSM
                </p>
                <p className="shrink-0 text-[9px] uppercase tracking-[0.08em] text-[#8E929B]">
                  Free size exchange · COD available
                </p>
              </div>

              <h1 className="text-2xl font-bold uppercase leading-[1.15] tracking-tight text-white sm:text-3xl">
                {product.title}
              </h1>

              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="text-2xl font-bold text-white">{formatRupees(product.price)}</span>
                {hasDiscount && (
                  <span className="text-sm text-[#8E929B] line-through">
                    {formatRupees(product.mrp)}
                  </span>
                )}
                {hasDiscount && (
                  <span className="ml-auto text-[11px] font-bold uppercase tracking-wider text-[#D9362B]">
                    -{discount}%
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[10px]">
                {productCoins > 0 && (
                  <p className="flex items-center gap-1.5 font-bold uppercase tracking-[0.08em] text-[#00FF66]">
                    <SkyCoinIcon className="h-4 w-4 shrink-0 text-white" />
                    +{productCoins.toLocaleString("en-IN")} Sky Cash
                    <span className="font-normal tracking-normal text-[#8E929B]">after delivery</span>
                  </p>
                )}

                <div className="flex items-center gap-1.5">
                  <Star className="h-3 w-3 fill-[#00FF66] text-[#00FF66]" />
                  <span className="font-bold text-white">{product.rating}</span>
                  <span className="text-[#8E929B]">({product.reviewsCount})</span>
                  <span className="h-3 w-px bg-[#282C34]" />
                  <span className="text-[#8E929B]">Verified buyers</span>
                </div>
              </div>
            </div>

            {product.colors.length > 1 ? (
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8E929B]">
                  Color <span className="text-white">· {currentColorObj.name}</span>
                </span>
                <div className="flex items-center gap-1.5">
                  {product.colors.map((color) => (
                    <button
                      key={color.name}
                      type="button"
                      onClick={() => setSelectedColor(color.name)}
                      aria-pressed={selectedColor === color.name}
                      title={color.name}
                      className={`flex h-7 w-7 items-center justify-center border transition-colors ${
                        selectedColor === color.name
                          ? "border-[#F5F5F7]"
                          : "border-[#282C34] hover:border-[#8E929B]"
                      }`}
                      style={{ backgroundColor: color.hex }}
                    >
                      {selectedColor === color.name && (
                        <Check className="h-3.5 w-3.5 text-white drop-shadow" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em]">
                <span className="text-[#8E929B]">Size</span>
                <button
                  type="button"
                  onClick={() => setSizeChartModalOpen(true)}
                  className="flex items-center gap-1 text-[#F5F5F7] underline-offset-4 hover:underline"
                >
                  <Ruler className="h-3.5 w-3.5" />
                  Size chart
                </button>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => chooseSize(size)}
                    disabled={!availableSizes.includes(size)}
                    aria-pressed={selectedSize === size}
                    className={`h-11 rounded-md border text-[11px] font-bold uppercase transition-colors active:translate-y-px disabled:cursor-not-allowed disabled:border-[#282C34] disabled:text-[#3A3E47] disabled:line-through ${
                      selectedSize === size
                        ? "border-[#F5F5F7] bg-[#F5F5F7] text-[#0B0C10]"
                        : "border-[#282C34] bg-transparent text-[#8E929B] hover:border-[#8E929B] hover:text-white"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 border-t border-[#282C34] pt-4">
              <button
                type="button"
                disabled={isNavigating}
                onMouseEnter={() => {
                  try { router.prefetch("/checkout"); } catch {}
                }}
                onTouchStart={() => {
                  try { router.prefetch("/checkout"); } catch {}
                }}
                onClick={() => handleAddToCart(true)}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-md border border-[#EC003F] bg-[#EC003F] text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:border-[#C90036] hover:bg-[#C90036] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-75"
              >
                {isNavigating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Proceeding to checkout...</span>
                  </>
                ) : (
                  <span>{selectedSize ? `Buy now · Size ${selectedSize}` : "Buy now"}</span>
                )}
              </button>

              <div className="flex items-center gap-2 pt-1">
                <div className="flex h-10 items-center border border-[#282C34]">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="h-full px-3 text-[#8E929B] transition-colors hover:text-white"
                    aria-label="Decrease quantity"
                  >
                    -
                  </button>
                  <span className="w-7 text-center text-xs font-bold text-white">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.min(10, quantity + 1))}
                    className="h-full px-3 text-[#8E929B] transition-colors hover:text-white"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleAddToCart(false)}
                  className="flex h-10 flex-1 items-center justify-center gap-1.5 border border-[#282C34] bg-transparent text-[10px] font-bold uppercase tracking-wider text-[#C4C7D4] transition-colors hover:border-[#8E929B] hover:text-white active:translate-y-px"
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  Add to bag
                </button>

                <button
                  type="button"
                  onClick={() => toggleWishlist(product.id)}
                  aria-pressed={isFavorited}
                  aria-label="Save to wishlist"
                  className={`flex h-10 w-10 items-center justify-center border transition-colors active:translate-y-px ${
                    isFavorited
                      ? "border-[#D9362B] bg-[#D9362B]/10 text-[#D9362B]"
                      : "border-[#282C34] text-[#8E929B] hover:border-[#8E929B] hover:text-white"
                  }`}
                >
                  <Heart className={`h-4 w-4 ${isFavorited ? "fill-[#D9362B]" : ""}`} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-px border border-[#282C34] bg-[#282C34]">
              {[
                { icon: ShieldCheck, title: "Pre-shrunk", note: "Bio washed" },
                { icon: Truck, title: "48h dispatch", note: "Air express" },
                { icon: RotateCcw, title: "7-day size swap", note: "Doorstep" },
              ].map((item) => (
                <div
                  key={item.title}
                  className="flex flex-col items-center gap-1 bg-[#16181D] px-2 py-3 text-center"
                >
                  <item.icon className="h-4 w-4 text-[#8E929B]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white">
                    {item.title}
                  </span>
                  <span className="text-[9px] uppercase tracking-[0.08em] text-[#8E929B]">
                    {item.note}
                  </span>
                </div>
              ))}
            </div>

            <div className="border border-[#282C34] p-3.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#8E929B]">
                  <MapPin className="h-3.5 w-3.5" />
                  Delivery
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#00FF66]">
                  In stock for dispatch
                </span>
              </div>

              <form onSubmit={handleCheckPincode} className="mt-2.5 flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 6-digit pincode"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="h-10 flex-1 border border-[#282C34] bg-[#0A0B0E] px-3 text-xs text-white placeholder-[#8E929B] focus:border-[#8E929B] focus:outline-none"
                />
                <button
                  type="submit"
                  className="h-10 border border-[#282C34] px-4 text-[10px] font-bold uppercase tracking-wider text-white transition-colors hover:border-[#F5F5F7] hover:bg-[#F5F5F7] hover:text-[#0B0C10]"
                >
                  Check
                </button>
              </form>

              {pincodeError && <p className="mt-2 text-[11px] text-[#D9362B]">{pincodeError}</p>}

              {deliveryResult && (
                <div className="mt-2.5 border-t border-[#282C34] pt-2.5 text-[11px]">
                  <p className="flex items-center gap-1.5 font-bold text-white">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#00FF66]" />
                    Delivery by <span className="text-[#00FF66]">{deliveryResult.date}</span>
                  </p>
                  <p className="mt-0.5 text-[#8E929B]">
                    {deliveryResult.courier} · COD available
                  </p>
                </div>
              )}
            </div>

            {packRows.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8E929B]">
                  Product pack
                </p>
                <dl className="mt-2 divide-y divide-[#282C34] border-y border-[#282C34]">
                  {packRows.map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-4 py-2 text-[11px]">
                      <dt className="shrink-0 text-[#8E929B]">{label}</dt>
                      <dd className="text-right font-bold text-white">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            <div className="lg:hidden border-t border-[#282C34] pt-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8E929B]">
                Product overview
              </p>
              <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-[#C4C7D4]">
                {product.description || product.subtitle}
              </p>
            </div>
          </div>
        </div>

        <div>
          <ProductReviewsSection
            productId={product.id}
            productTitle={product.title}
            initialRating={product.rating}
            initialReviewsCount={product.reviewsCount}
          />
        </div>

        {otherProducts.length > 0 && (
          <div className="border-t border-[#282C34] pt-10 space-y-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8E929B]">
                  More drops
                </p>
                <h2 className="mt-1 text-xl font-bold uppercase tracking-tight text-white">
                  Complete the rotation
                </h2>
              </div>
              <Link
                href="/shop"
                className="text-[10px] font-bold uppercase tracking-wider text-[#8E929B] hover:text-white"
              >
                View all
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:gap-2 md:grid-cols-3 xl:grid-cols-4">
              {otherProducts.map((op) => {
                const otherHeroSrc = productHeroView(op).src ?? op.imageUrl;
                return (
                <Link
                  key={op.id}
                  href={`/product/${op.slug}`}
                  className="group flex flex-col border border-[#282C34] bg-[#16181D] transition-colors hover:border-[#8E929B]"
                >
                  <div className="relative aspect-[4/5] overflow-hidden bg-[#D3D3D3]">
                    {otherHeroSrc && (
                      <Image
                        src={otherHeroSrc}
                        alt={op.title}
                        fill
                        sizes="(max-width: 768px) 50vw, 25vw"
                        className="object-cover transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-[1.035]"
                      />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5 p-3">
                    <p className="truncate text-[9px] font-bold uppercase tracking-[0.12em] text-[#8E929B]">
                      {op.gsm} GSM
                    </p>
                    <p className="line-clamp-2 text-[12px] font-bold uppercase leading-[1.3] tracking-tight text-white">
                      {op.title}
                    </p>
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-bold text-white">{formatRupees(op.price)}</span>
                      <span className="text-[10px] text-[#8E929B] line-through">
                        {formatRupees(op.mrp)}
                      </span>
                    </div>
                    {getProductCoins(op) > 0 && (
                      <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#00FF66]">
                        <SkyCoinIcon className="h-4 w-4 shrink-0 text-white" />
                        +{getProductCoins(op).toLocaleString("en-IN")} Sky Cash
                      </p>
                    )}
                  </div>
                </Link>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#282C34] bg-[#0A0B0E]/95 backdrop-blur-md lg:hidden">
        <div className="flex items-center gap-3 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-none text-white">
              {formatRupees(product.price)}
            </p>
            <p className="mt-1 truncate text-[9px] uppercase tracking-[0.08em] text-[#8E929B]">
              {hasDiscount ? (
                <>
                  <span className="line-through">{formatRupees(product.mrp)}</span>{" "}
                  <span className="font-bold text-[#D9362B]">-{discount}%</span>
                  {" · "}Free size swap
                </>
              ) : (
                "Free size exchange · COD"
              )}
            </p>
          </div>
          <button
            type="button"
            disabled={isNavigating}
            onMouseEnter={() => {
              try { router.prefetch("/checkout"); } catch {}
            }}
            onTouchStart={() => {
              try { router.prefetch("/checkout"); } catch {}
            }}
            onClick={() => handleAddToCart(true)}
            className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-md border border-[#EC003F] bg-[#EC003F] px-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-white transition-colors hover:border-[#C90036] hover:bg-[#C90036] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-75"
          >
            {isNavigating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Buy now
                {selectedSize && (
                  <span className="ml-2 border-l border-white/30 pl-2 text-[10px] font-bold">
                    {selectedSize}
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      </div>

      {cartToast && (
        <div className="fixed bottom-24 right-4 z-50 flex max-w-md items-center gap-4 border border-[#00FF66]/40 bg-[#16181D] p-4 shadow-2xl sm:bottom-6 sm:right-6">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[#00FF66]" />
          <div className="min-w-0 flex-1 text-xs">
            <p className="truncate font-bold uppercase text-white">
              {cartToast.title} (Size {cartToast.size}) added
            </p>
            <p className="mt-0.5 text-[10px] text-[#8E929B]">
              Sky Cash unlocks after delivery.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 border-l border-[#282C34] pl-2">
            <Link
              href="/cart"
              className="border border-[#282C34] px-3 py-1.5 text-[10px] font-bold uppercase text-white transition-colors hover:bg-white hover:text-black"
            >
              Bag
            </Link>
            <Link
              href="/checkout"
              className="border border-[#D9362B] bg-[#D9362B] px-3 py-1.5 text-[10px] font-bold uppercase text-white transition-colors hover:bg-white hover:text-black"
            >
              Checkout
            </Link>
          </div>
        </div>
      )}

      <SizeChartModal
        isOpen={isSizeChartModalOpen}
        onClose={() => setSizeChartModalOpen(false)}
        selectedSize={selectedSize}
        onSelectSize={(sz) => chooseSize(sz)}
      />

      {sizeIntent && (
        <SizePickerModal
          productTitle={product.title}
          sizes={product.sizes}
          availableSizes={availableSizes}
          pending={isNavigating}
          onClose={() => setSizeIntent(null)}
          onContinue={handleSizePicked}
        />
      )}

      <Footer />
    </div>
  );
}
