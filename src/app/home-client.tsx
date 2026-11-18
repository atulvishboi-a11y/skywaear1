"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { VelocityMarquee, WordRoll } from "@ashutoshswamy/smoui";
import {
  ShoppingBag,
  ArrowRight,
  Ruler,
  ChevronDown,
  Loader2,
  X,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SizeChartModal from "@/components/SizeChartModal";
import SkyCoinIcon from "@/components/SkyCoinIcon";
import SizeChartTable from "@/components/SizeChartTable";
import { PRODUCTS, type Product } from "@/data/products";
import { useCart, useWishlist, cartLineId } from "@/lib/cart";
import { formatRupees } from "@/lib/domain";
import MemberStorefrontView from "@/components/storefront/MemberStorefrontView";
import type { CustomerAccount } from "@/data/rewardsEngine";
import { getProductCoins, stockState } from "@/lib/catalog";
import { api } from "@/lib/client";
import {
  staggerEntrance,
  animateModalEnter,
  animateHeroEntrance,
  animateOnScroll,
} from "@/lib/gsap";

function cleanBadge(badge?: string) {
  const text = (badge ?? "").replace(/[^\x20-\x7E]+/g, " ").trim();
  return text || "Archive drop";
}

export default function HomeClient() {
  const router = useRouter();
  const { add: addToCart, buyNow: buyNowCart, items: cartItems } = useCart();
  const { toggle: toggleWishlist, has: inWishlist, count: wishlistCount } = useWishlist();

  // Authentication & Customer Session
  const [customer, setCustomer] = useState<CustomerAccount | null>(null);

  useEffect(() => {
    let active = true;
    api
      .session()
      .then((res) => {
        if (active && res?.customer) {
          setCustomer(res.customer);
        }
      })
      .catch(() => {});

    const handleAuth = () => {
      api
        .session()
        .then((res) => {
          if (active) setCustomer(res?.customer || null);
        })
        .catch(() => {});
    };

    window.addEventListener("zenin:auth_change", handleAuth);
    return () => {
      active = false;
      window.removeEventListener("zenin:auth_change", handleAuth);
    };
  }, []);

  // Data State
  const [liveProducts, setLiveProducts] = useState<Product[]>(PRODUCTS);
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [isSizeChartOpen, setIsSizeChartOpen] = useState<boolean>(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Selected sizes per product card
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({
    "zenin-choso-oversized-tee": "L",
    "zenin-limitless-gojo-tee": "L",
    "zenin-butterfly-luxury-tee": "L",
    "zenin-betrayed-oversized-tee": "L",
  });
  const [selectedSpotlightId, setSelectedSpotlightId] = useState<string>("zenin-choso-oversized-tee");

  // Front/Back interactive view state per product
  const [previewSides, setPreviewSides] = useState<Record<string, "front" | "back">>({
    "zenin-choso-oversized-tee": "front",
    "zenin-limitless-gojo-tee": "front",
    "zenin-butterfly-luxury-tee": "front",
    "zenin-betrayed-oversized-tee": "front",
  });
  const [addedItemIds, setAddedItemIds] = useState<Record<string, boolean>>({});
  const [buyProduct, setBuyProduct] = useState<Product | null>(null);
  const [buySize, setBuySize] = useState<string | null>(null);
  const quickBuyDialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!buyProduct) return;
    animateModalEnter(quickBuyDialogRef.current);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setBuyProduct(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [buyProduct]);

  const sizeFor = (product: Product) => {
    const saved = selectedSizes[product.id];
    if (saved && product.sizes.includes(saved)) return saved;
    return product.sizes.includes("L") ? "L" : product.sizes[0] ?? "L";
  };

  const productsRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const faqRef = useRef<HTMLElement>(null);

  // Animate Hero section entrance on page load
  useEffect(() => {
    animateHeroEntrance(heroRef.current);
  }, []);

  // Animate FAQ section on scroll
  useEffect(() => {
    animateOnScroll(faqRef.current);
  }, []);

  // Sync latest live catalog from Storefront API
  useEffect(() => {
    let mounted = true;
    const fetchLatest = () => {
      api
        .storefront()
        .then((data) => {
          if (mounted && data.products) {
            setLiveProducts(data.products);
          }
        })
        .catch((err) => console.error("Storefront products fetch failed:", err));
    };

    const timer = setTimeout(fetchLatest, 1500);
    const interval = setInterval(fetchLatest, 120000);

    return () => {
      mounted = false;
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  // Dynamic categories computed from live products loaded from admin/storefront
  const categories = useMemo(() => {
    const list: { id: string; label: string }[] = [
      { id: "ALL", label: `ALL PIECES (${liveProducts.length})` },
    ];
    const seen = new Set<string>();

    liveProducts.forEach((p) => {
      const cat = p.category?.trim();
      if (cat && !seen.has(cat.toLowerCase()) && cat.toLowerCase() !== "all") {
        seen.add(cat.toLowerCase());
        list.push({ id: cat.toUpperCase(), label: cat.toUpperCase() });
      }
    });

    const hasAnime = liveProducts.some(
      (p) =>
        p.category?.toLowerCase() === "anime" ||
        p.showInAnime ||
        p.theme?.toLowerCase().includes("jujutsu") ||
        p.theme?.toLowerCase().includes("solo") ||
        p.title?.toLowerCase().includes("choso") ||
        p.title?.toLowerCase().includes("gojo") ||
        p.title?.toLowerCase().includes("betrayed")
    );

    if (hasAnime && !seen.has("anime")) {
      list.push({ id: "ANIME", label: "ANIME ARCHIVE" });
    }

    return list;
  }, [liveProducts]);

  useEffect(() => {
    if (activeCategory !== "ALL" && !categories.some((c) => c.id === activeCategory)) {
      setActiveCategory("ALL");
    }
  }, [categories, activeCategory]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    if (activeCategory === "ALL") return liveProducts;
    if (activeCategory === "ANIME") {
      return liveProducts.filter(
        (p) =>
          p.category?.toLowerCase() === "anime" ||
          p.showInAnime ||
          p.theme?.toLowerCase().includes("jujutsu") ||
          p.theme?.toLowerCase().includes("solo") ||
          p.title?.toLowerCase().includes("choso") ||
          p.title?.toLowerCase().includes("gojo") ||
          p.title?.toLowerCase().includes("betrayed")
      );
    }
    return liveProducts.filter(
      (p) => p.category?.trim().toUpperCase() === activeCategory.trim().toUpperCase()
    );
  }, [liveProducts, activeCategory]);

  // Primary section products (T-shirts / main drops when ALL, or activeCategory products when filtered)
  const primaryProducts = useMemo(() => {
    if (activeCategory !== "ALL") return filteredProducts;
    const tshirts = liveProducts.filter(
      (p) => !p.category || p.category.toLowerCase() === "t-shirts" || p.category.toLowerCase() === "t-shirt"
    );
    return tshirts.length > 0 ? tshirts : liveProducts;
  }, [liveProducts, activeCategory, filteredProducts]);

  // Animate product cards smoothly with GSAP on category change / load
  useEffect(() => {
    if (productsRef.current && primaryProducts.length > 0) {
      staggerEntrance("article", productsRef.current, 0.03);
    }
  }, [activeCategory, primaryProducts.length]);

  // Other category sections (e.g. Hoodies, Pants, Napkin, etc.) right below Heavyweight Drops
  const otherCategorySections = useMemo(() => {
    if (activeCategory !== "ALL") return [];

    const map = new Map<string, Product[]>();
    liveProducts.forEach((p) => {
      const cat = p.category?.trim() || "Other";
      if (cat.toLowerCase() !== "t-shirts" && cat.toLowerCase() !== "t-shirt") {
        if (!map.has(cat)) {
          map.set(cat, []);
        }
        map.get(cat)!.push(p);
      }
    });

    const groups: { category: string; title: string; products: Product[] }[] = [];
    map.forEach((prods, cat) => {
      groups.push({
        category: cat,
        title: `${cat} Drops`,
        products: prods,
      });
    });

    return groups;
  }, [liveProducts, activeCategory]);

  const spotlightProduct =
    liveProducts.find((p) => p.id === selectedSpotlightId) ||
    liveProducts[0] ||
    PRODUCTS[0];

  const handleToggleSide = (productId: string, currentSide: "front" | "back", e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setPreviewSides((prev) => ({
      ...prev,
      [productId]: currentSide === "front" ? "back" : "front",
    }));
  };

  const [isNavigating, setIsNavigating] = useState(false);

  // Eagerly prefetch checkout chunks so Buy Now transitions instantly without delay
  useEffect(() => {
    try {
      router.prefetch("/checkout");
      router.prefetch("/cart");
    } catch {}
  }, [router]);

  // Quick Add with Size
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
      } catch (err) {
        setIsNavigating(false);
        console.error("Buy now navigation failed:", err);
        window.location.assign("/checkout");
      }
      return;
    }

    addToCart(item);
    setAddedItemIds((prev) => ({ ...prev, [product.id]: true }));
    setTimeout(() => {
      setAddedItemIds((prev) => ({ ...prev, [product.id]: false }));
    }, 1500);
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

  const scrollToCatalog = () => {
    productsRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const faqItems = [
    {
      q: "What are your shipping timelines?",
      a: "Orders are processed and dispatched within 24-48 business hours. You will receive an express tracking link via SMS and email as soon as your package ships.",
    },
    {
      q: "What is your exchange and return policy?",
      a: "We offer a 7-day doorstep exchange if you need a different size. Simply reach out to customer support with your order ID.",
    },
    {
      q: "How does Sky Cash rewards work?",
      a: "Eligible orders earn Sky Cash rewards directly into your account wallet, which can be tracked and managed anytime from your Account or Wallet page.",
    },
  ];

  const renderProductCard = (product: Product, idx: number = 0) => {
    const currentSide = previewSides[product.id] || product.heroImage || "front";
    const stock = stockState(product);
    const backImage = product.imageBackUrl || product.artworkUrl;
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
          className="relative flex items-center justify-center overflow-hidden bg-[#D3D3D3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#00FF66] aspect-[4/5] p-0"
        >
          {displayImage && (
            <Image
              src={displayImage}
              alt={product.title}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1279px) 33vw, 25vw"
              priority={idx < 2}
              className="transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-[1.035] object-cover"
            />
          )}
          {!stock.purchasable && (
            <span className="absolute inset-x-0 bottom-0 border-t border-[#282C34] bg-[#0B0C10]/90 px-4 py-2 text-center text-[10px] font-bold uppercase tracking-[0.16em] text-[#F5F5F7]">
              Sold out
            </span>
          )}
        </Link>

        {/* Details */}
        <div className="flex flex-1 flex-col gap-2 p-3">
          <div className="space-y-1.5">
            <p className="truncate text-[9px] font-bold uppercase tracking-[0.12em] text-[#8E929B]">
              {cleanBadge(product.badge)} <span aria-hidden>·</span>{" "}
              {product.gsm} GSM
            </p>

            <Link
              href={`/product/${product.slug}`}
              className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FF66]"
            >
              <h3
                className="line-clamp-2 font-bold uppercase leading-[1.3] tracking-tight text-white underline-offset-4 decoration-2 decoration-[#D9362B] group-hover:underline text-[12px]"
                style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
              >
                {product.title}
              </h3>
            </Link>

            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-sm font-bold text-white">
                {formatRupees(product.price)}
              </span>
              {hasDiscount && (
                <span className="text-[#8E929B] line-through text-[10px]">
                  {formatRupees(product.mrp)}
                </span>
              )}
              {hasDiscount && (
                <span className="ml-auto font-bold uppercase tracking-wider text-[#D9362B] text-[9px]">
                  -{discount}%
                </span>
              )}
            </div>

            {productCoins > 0 && (
              <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#00FF66]">
                <SkyCoinIcon className="h-4 w-4 shrink-0 text-white" />
                +{productCoins.toLocaleString("en-IN")} Sky Cash
              </p>
            )}
          </div>

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
              onMouseEnter={() => {
                try { router.prefetch("/checkout"); } catch {}
              }}
              onTouchStart={() => {
                try { router.prefetch("/checkout"); } catch {}
              }}
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
        </div>
      </article>
    );
  };

  return (
    <div className="min-h-screen bg-[#07080B] text-[#F5F5F7] flex flex-col font-mono selection:bg-[#00FF66] selection:text-[#07080B] antialiased relative overflow-x-hidden">
      {/* Subtle Micro-Grid Ambient Texture */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#141720_1px,transparent_1px),linear-gradient(to_bottom,#141720_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_70%_50%_at_50%_25%,#000_60%,transparent_100%)] opacity-35 pointer-events-none z-0" />

      {/* Brand Header */}
      <Header cartCount={cartItems.length} wishlistCount={wishlistCount} customer={customer} />

      {/* ========================================================= */}
      {/* 1. HERO SECTION: PREMIUM STREETWEAR EDITORIAL             */}
      {/* ========================================================= */}
      <section ref={heroRef} className="relative w-full border-b border-[#25272D] bg-[#090A0D] py-14 sm:py-20 md:py-24 z-10">
        <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto flex flex-col items-center justify-center text-center">
            {/* Bold Condensed Editorial Headline */}
            <h1
              className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black uppercase tracking-[-0.03em] text-[#F5F5F5] leading-[1.08] sm:leading-[1.02] select-none"
              style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
            >
              HEAVYWEIGHT OVERSIZED{" "}
              <WordRoll
                words={["TEES", "FITS", "STREETWEAR"]}
                interval={2.6}
              />
              <span className="text-[#00E676]">.</span>
            </h1>

            {/* CTA Buttons Group */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full sm:w-auto mt-7 sm:mt-9">
              {/* Primary: LOG IN */}
              <Link
                href="/login"
                className="w-full sm:w-[180px] h-[54px] sm:h-[56px] rounded-[10px] bg-[#00E676] hover:bg-[#00c868] text-[#080B0D] font-bold text-sm sm:text-base uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98] cursor-pointer shadow-sm select-none"
              >
                <span>LOG IN</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </Link>

              {/* Secondary: REGISTER */}
              <Link
                href="/register"
                className="w-full sm:w-[180px] h-[54px] sm:h-[56px] rounded-[10px] bg-transparent border border-[#35373D] hover:border-[#F5F5F5] hover:bg-white/[0.04] text-[#F5F5F5] font-bold text-sm sm:text-base uppercase tracking-wider flex items-center justify-center transition-all duration-150 active:scale-[0.98] cursor-pointer select-none"
              >
                <span>REGISTER</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Brand ticker strip */}
      <div className="w-full border-b border-[#25272D] bg-[#0B0C10] py-2.5 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.22em] text-[#8E929B] [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
        <VelocityMarquee
          text="240 GSM HEAVYWEIGHT  ·  PRINTED IN INDIA  ·  FREE SIZE EXCHANGE  ·  48H DISPATCH  ·  COD AVAILABLE  ·  "
          speed={36}
        />
      </div>

      {/* ========================================================= */}
      {/* 2. STICKY CATEGORY FILTER BAR                             */}
      {/* ========================================================= */}
      <nav
        aria-label="Product categories"
        className="sticky top-14 sm:top-16 z-40 w-full bg-[#07080B]/95 backdrop-blur-xl border-b border-white/[0.08] py-2.5 shadow-md"
      >
        <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 shrink-0">
            {categories.map((cat) => {
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`min-h-[34px] px-3.5 py-1 rounded-lg text-xs font-mono font-bold uppercase transition-all duration-150 cursor-pointer whitespace-nowrap active:scale-95 ${
                    active
                      ? "bg-[#00FF66] text-[#07080B] font-black"
                      : "bg-[#14161F] text-[#8E929B] hover:text-white border border-white/[0.06]"
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 text-xs text-[#8E929B] font-mono shrink-0">
            <button
              type="button"
              onClick={() => setIsSizeChartOpen(true)}
              className="hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <Ruler className="w-3.5 h-3.5 text-[#00FF66]" />
              <span className="hidden sm:inline">Size Guide</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ========================================================= */}
      {/* 3. CURATED 4-DROP ARCHIVE GRID (MATCHING USER REFERENCE)  */}
      {/* ========================================================= */}
      <main ref={productsRef} className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12 sm:space-y-16">
        {/* Main Section */}
        <section className="space-y-4">
          <div className="flex items-end justify-between border-b border-white/[0.08] pb-3">
            <div>
              <span className="text-[10px] font-mono font-bold tracking-widest text-[#00FF66] uppercase block">
                {activeCategory === "ALL"
                  ? "// OFFICIAL ARCHIVE COLLECTION"
                  : `// OFFICIAL ${activeCategory} COLLECTION`}
              </span>
              <h2
                className="text-xl sm:text-3xl font-extrabold uppercase tracking-tight text-white"
                style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
              >
                {activeCategory === "ALL" ? "Heavyweight Oversized Drops" : `${activeCategory} Drops`}
              </h2>
            </div>
            <span className="text-xs text-[#8E929B] font-mono">
              Displaying <strong className="text-white">{primaryProducts.length}</strong> Pieces
            </span>
          </div>

          {/* Responsive Product Grid matching /shop exact design */}
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2 md:grid-cols-3 lg:grid-cols-4">
            {primaryProducts.map((product, idx) => renderProductCard(product, idx))}
          </div>
        </section>

        {/* Dynamic Additional Category Sections (e.g. Hoodies, Pants, Napkin, etc.) right below Heavyweight Drops */}
        {otherCategorySections.map((section) => (
          <section key={section.category} className="space-y-4">
            <div className="flex items-end justify-between border-b border-white/[0.08] pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold tracking-widest text-[#00FF66] uppercase block">
                  // OFFICIAL {section.category.toUpperCase()} COLLECTION
                </span>
                <h2
                  className="text-xl sm:text-3xl font-extrabold uppercase tracking-tight text-white"
                  style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
                >
                  {section.title}
                </h2>
              </div>
              <span className="text-xs text-[#8E929B] font-mono">
                Displaying <strong className="text-white">{section.products.length}</strong> Pieces
              </span>
            </div>

            {/* Same Product Card Grid */}
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2 md:grid-cols-3 lg:grid-cols-4">
              {section.products.map((product) => renderProductCard(product))}
            </div>
          </section>
        ))}

        {/* ========================================================= */}
        {/* 4. FREQUENTLY ASKED QUESTIONS                             */}
        {/* ========================================================= */}
        <section ref={faqRef} className="rounded-2xl border border-white/[0.08] bg-[#0B0D13]/90 backdrop-blur-xl p-5 sm:p-8 lg:p-10 space-y-6 relative overflow-hidden shadow-2xl will-change-[transform,opacity]">
          <div className="space-y-2 border-b border-white/[0.08] pb-5">
            <span className="text-[10px] font-mono font-bold tracking-[0.25em] text-[#00FF66] uppercase block">
              // HELP &amp; SUPPORT
            </span>
            <h3
              className="text-2xl sm:text-3xl font-extrabold uppercase text-white tracking-tight leading-none"
              style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
            >
              Frequently Asked Questions
            </h3>
            <p className="text-xs sm:text-sm text-[#8E929B]">
              Quick answers about orders, shipping, and account support.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {faqItems.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                    isOpen
                      ? "border-[#00FF66]/30 bg-[#12151E] shadow-md shadow-[#00FF66]/5"
                      : "border-white/[0.06] bg-[#0E1017] hover:border-white/20"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full min-h-[48px] p-4 sm:p-5 flex items-center justify-between gap-4 text-left font-mono text-xs sm:text-sm font-bold text-white hover:text-[#00FF66] transition-colors cursor-pointer"
                  >
                    <span className="leading-snug">{item.q}</span>
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-transform duration-200 ${
                      isOpen
                        ? "bg-[#00FF66] text-[#080B0D] border-[#00FF66] rotate-180"
                        : "bg-[#161822] text-[#8E929B] border-white/10"
                    }`}>
                      <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 sm:px-5 sm:pb-5 text-xs font-sans text-[#8E929B] leading-relaxed border-t border-white/[0.04] pt-3">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer />

      {/* Size Chart Modal */}
      <SizeChartModal isOpen={isSizeChartOpen} onClose={() => setIsSizeChartOpen(false)} />

      {/* Quick Buy Modal matching /shop */}
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
    </div>
  );
}
