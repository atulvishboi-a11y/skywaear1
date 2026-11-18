"use client";

import React, { useState, useId, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Coins,
  Copy,
  DollarSign,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  Image as ImageIcon,
  Layers,
  Package,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  Truck,
  Upload,
  X,
  Zap,
} from "lucide-react";
import type { Product } from "@/data/products";
import { api } from "@/lib/client";
import { formatRupees } from "@/lib/domain";
import {
  ANIME_THEMES,
  COLOR_SWATCHES,
  GRAPHIC_PRESETS,
  PRODUCT_CATEGORIES,
  SIZE_OPTIONS,
  formatCount,
  type AdminController,
} from "@/components/admin/shared";
import ProductMedia from "@/components/ProductMedia";
import { ProductThumb } from "@/components/admin/ui";
import { AdminThemeToggle } from "@/components/admin/AdminTheme";
import { compressImageClient } from "@/lib/image-compress";

interface ShopifyProductEditorProps {
  ctl: AdminController;
  draft: Product | "new";
  anime: boolean;
  onClose: () => void;
}

export default function ShopifyProductEditor({
  ctl,
  draft,
  anime,
  onClose,
}: ShopifyProductEditorProps) {
  const isEdit = draft !== "new";
  const existing = isEdit ? (draft as Product) : null;

  // Primary Fields
  const [title, setTitle] = useState(existing?.title ?? "");
  const [subtitle, setSubtitle] = useState(existing?.subtitle ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [status, setStatus] = useState<"active" | "draft">(
    existing?.isArchived || existing?.showOnStorefront === false ? "draft" : "active"
  );

  // Categorization & Lore
  const [category, setCategory] = useState<Product["category"]>(existing?.category ?? "T-Shirts");
  const [theme, setTheme] = useState(existing?.theme ?? (anime ? ANIME_THEMES[0] : "Heavyweight Core"));
  const [graphic, setGraphic] = useState(existing?.graphicSvgType ?? GRAPHIC_PRESETS[0].type);
  const [badge, setBadge] = useState(existing?.badge ?? "");
  const [tags, setTags] = useState<string[]>(() => [
    "oversized",
    "heavyweight",
    "240-gsm",
    ...(anime ? ["anime-drop", existing?.category?.toLowerCase() ?? "streetwear"] : ["core-drop"]),
  ]);
  const [tagInput, setTagInput] = useState("");

  // Media
  const [artworkUrl, setArtworkUrl] = useState(existing?.artworkUrl ?? "");
  const [imageUrl, setImageUrl] = useState(existing?.imageUrl ?? "");
  const [imageGallery, setImageGallery] = useState<string[]>(existing?.imageGallery ?? []);
  const [galleryInput, setGalleryInput] = useState("");
  const [artworkBroken, setArtworkBroken] = useState(false);
  const [activeMediaTab, setActiveMediaTab] = useState<"back" | "front">("back");
  const [heroImage, setHeroImage] = useState<"front" | "back">(existing?.heroImage ?? "front");

  // Pricing & Margins
  const [price, setPrice] = useState<string>(existing ? String(existing.price) : "999");
  const [mrp, setMrp] = useState<string>(existing ? String(existing.mrp) : "1499");
  const [costPerItem, setCostPerItem] = useState<string>("420"); // typical 240 GSM POD base cost in INR
  const [codAllowed, setCodAllowed] = useState(existing?.codAvailable ?? true);
  const [cashbackPoints, setCashbackPoints] = useState<string>(
    existing?.cashbackPoints != null
      ? String(existing.cashbackPoints)
      : (existing as any)?.rewardCoins != null
      ? String((existing as any).rewardCoins)
      : ""
  );

  // Inventory & Logistics
  const [trackQuantity, setTrackQuantity] = useState(true);
  const [sku, setSku] = useState(existing?.sku ?? (existing ? `ZN-SS26-${existing.slug.substring(0, 4).toUpperCase()}` : ""));
  const [barcode, setBarcode] = useState("890441230091");
  const [stock, setStock] = useState<string>(existing?.stock != null ? String(existing.stock) : "50");
  const [lowStockAlert, setLowStockAlert] = useState("10");

  // Specs
  const [gsm, setGsm] = useState<string>(existing ? String(existing.gsm) : "240");
  const [weightKg, setWeightKg] = useState("0.45");
  const [fabric, setFabric] = useState(existing?.fabric ?? "");
  const [packFit, setPackFit] = useState(existing?.packFit ?? "");
  const [packPrint, setPackPrint] = useState(existing?.packPrint ?? "");
  const [packWash, setPackWash] = useState(existing?.packWash ?? "");

  // Variants (Colors & Sizes)
  const [selectedSizes, setSelectedSizes] = useState<string[]>(
    existing?.sizes ?? ["S", "M", "L", "XL", "XXL"]
  );
  const [selectedColors, setSelectedColors] = useState<string[]>(
    existing?.colors?.map((c) => c.name) ?? ["Obsidian Black", "Off-White", "Acid Wash Grey"]
  );

  // Merchandising Switches
  const [onStore, setOnStore] = useState(existing?.showOnStorefront ?? true);
  const [inAnime, setInAnime] = useState(existing?.showInAnime ?? true);
  const [premium, setPremium] = useState(existing?.showInPremium ?? true);
  const [newDrop, setNewDrop] = useState(existing?.showInNewDrops ?? !isEdit);
  const [bestSeller, setBestSeller] = useState(existing?.showInBestSellers ?? false);

  // State
  const [error, setError] = useState<string | null>(null);
  const [artworkError, setArtworkError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const uploading = ctl.isPending("artwork:upload");

  // Computed Financials
  const numPrice = Number(price) || 0;
  const numMrp = Number(mrp) || 0;
  const numCost = Number(costPerItem) || 0;

  const discountPercent = useMemo(() => {
    if (numMrp <= numPrice || numMrp <= 0) return 0;
    return Math.round(((numMrp - numPrice) / numMrp) * 100);
  }, [numMrp, numPrice]);

  const profitAmount = numPrice - numCost;
  const marginPercent = numPrice > 0 ? Math.round((profitAmount / numPrice) * 100) : 0;

  const heroPreviewSrc =
    (heroImage === "back" ? artworkUrl : imageUrl).trim() || artworkUrl.trim() || imageUrl.trim();
  const heroPreviewBroken = heroImage === "back" && artworkBroken;

  const calculatedCoins = useMemo(() => {
    if (cashbackPoints.trim() !== "") return Number(cashbackPoints) || 0;
    return 0;
  }, [cashbackPoints]);

  // Handle SKU Generation
  const generateSku = () => {
    const slugPart = (title || "TEE")
      .trim()
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 4)
      .toUpperCase();
    const gsmTag = gsm || "240";
    const rand = Math.floor(100 + Math.random() * 900);
    setSku(`ZN-${gsmTag}-${slugPart}-${rand}`);
  };

  // Tag Management
  const handleAddTag = () => {
    if (!tagInput.trim()) return;
    const clean = tagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean]);
    }
    setTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Color Toggle
  const toggleColor = (colorName: string) => {
    setSelectedColors((prev) =>
      prev.includes(colorName)
        ? prev.length > 1
          ? prev.filter((c) => c !== colorName)
          : prev
        : [...prev, colorName]
    );
  };

  // Size Toggle
  const toggleSize = (sizeOption: string) => {
    setSelectedSizes((prev) =>
      prev.includes(sizeOption)
        ? prev.length > 1
          ? prev.filter((s) => s !== sizeOption)
          : prev
        : [...prev, sizeOption]
    );
  };

  // Artwork & Mockup Upload Handler (with automatic client-side compression to prevent HTTP 413)
  const attachArtwork = async (file: File | undefined) => {
    if (!file) return;
    setArtworkError(null);
    setArtworkBroken(false);
    const result = await ctl.run(
      "artwork:upload",
      async () => {
        let fileToUpload = file;
        let compressedDataUrl = "";
        try {
          const comp = await compressImageClient(file, { maxDimension: 1600, quality: 0.85 });
          fileToUpload = comp.file;
          compressedDataUrl = comp.dataUrl;
        } catch (compErr) {
          console.warn("[ShopifyProductEditor] Client compression skipped:", compErr);
        }

        try {
          const uploaded = await api.admin.uploadArtwork(fileToUpload);
          if (activeMediaTab === "back") {
            setArtworkUrl(uploaded.url);
            setImageUrl((prev) => prev || uploaded.url);
          } else {
            setImageUrl(uploaded.url);
            setArtworkUrl((prev) => prev || uploaded.url);
          }
          return uploaded;
        } catch (apiErr) {
          console.warn("[ShopifyProductEditor] Server upload bypassed; using compressed Data URI:", apiErr);
          const finalUrl = compressedDataUrl || (await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(fileToUpload);
          }));
          if (activeMediaTab === "back") {
            setArtworkUrl(finalUrl);
            setImageUrl((prev) => prev || finalUrl);
          } else {
            setImageUrl(finalUrl);
            setArtworkUrl((prev) => prev || finalUrl);
          }
          return { url: finalUrl };
        }
      },
      { skipRefresh: true, silent: true, successMessage: `${file.name} optimized & attached successfully` }
    );
    if (!result.ok) setArtworkError(result.error ?? "Upload failed");
  };

  // Rich description templates
  const appendTemplate = (type: "lore" | "fabric" | "fit") => {
    let snippet = "";
    if (type === "lore") {
      snippet = `\n\n[DESIGN ARCHIVE // ${theme.toUpperCase()}]\nFeaturing high-density screenprint and tactile discharge inks. Inspired by iconic anime aesthetics and Japanese dark fantasy.`;
    } else if (type === "fabric") {
      snippet = `\n\n[FABRIC SPECIFICATION]\n- 240+ GSM Super-Combed French Terry Cotton\n- 1.25" Lycra Spandex Ribbed Neck (Anti-Sag)\n- Pre-shrunk & Bio-washed for zero color bleeding\n- Machine wash cold, inside out. Do not iron directly on print.`;
    } else if (type === "fit") {
      snippet = `\n\n[SILHOUETTE & FIT]\nDrop-shoulder boxy oversized streetwear silhouette. Designed for a structured, relaxed drape across Indian builds. Order true to size for signature oversized fit.`;
    }
    setDescription((prev) => (prev ? prev + snippet : snippet.trim()));
  };

  // Save Drop
  const handleSave = async () => {
    if (!title.trim()) {
      setError("Product title is required");
      return;
    }
    setError(null);

    const colors = COLOR_SWATCHES.filter((color) => selectedColors.includes(color.name)).map((color) => ({
      name: color.name,
      hex: color.hex,
      previewClass: `bg-[${color.hex}]`,
    }));

    let cleanArtworkUrl = artworkUrl.trim() || undefined;
    let cleanImageUrl = imageUrl.trim() || undefined;

    // Safety recompression: if an uncompressed oversized Data URI (> 800 KB) is present, compress it before sending
    if (cleanArtworkUrl?.startsWith("data:image/") && cleanArtworkUrl.length > 800_000) {
      try {
        const res = await fetch(cleanArtworkUrl);
        const blob = await res.blob();
        const testFile = new File([blob], "artwork.jpg", { type: blob.type });
        const comp = await compressImageClient(testFile, { maxDimension: 1600, quality: 0.82 });
        cleanArtworkUrl = comp.dataUrl;
      } catch (e) {
        console.warn("Failed to recompress oversized artworkUrl:", e);
      }
    }

    if (cleanImageUrl?.startsWith("data:image/") && cleanImageUrl.length > 800_000) {
      try {
        const res = await fetch(cleanImageUrl);
        const blob = await res.blob();
        const testFile = new File([blob], "image.jpg", { type: blob.type });
        const comp = await compressImageClient(testFile, { maxDimension: 1600, quality: 0.82 });
        cleanImageUrl = comp.dataUrl;
      } catch (e) {
        console.warn("Failed to recompress oversized imageUrl:", e);
      }
    }

    const preset = GRAPHIC_PRESETS.find((item) => item.type === graphic) ?? GRAPHIC_PRESETS[0];

    const payload: Partial<Product> = {
      title: title.trim(),
      subtitle: subtitle.trim(),
      description: description.trim() || undefined,
      category,
      productType: "tshirt",
      price: numPrice,
      mrp: numMrp,
      gsm: Number(gsm) || 240,
      fabric: fabric.trim() || `${gsm || 240} GSM Super-Combed French Terry Cotton`,
      packFit: packFit.trim() || undefined,
      packPrint: packPrint.trim() || undefined,
      packWash: packWash.trim() || undefined,
      badge: badge.trim() || undefined,
      stock: Number(stock) || 0,
      sku: sku.trim() || undefined,
      sizes: selectedSizes,
      colors: colors.length ? colors : undefined,
      graphicSvgType: preset.type,
      graphicTitle: preset.label,
      cashbackPoints: cashbackPoints.trim() !== "" ? Math.max(0, parseInt(cashbackPoints, 10)) : 0,
      rewardCoins: cashbackPoints.trim() !== "" ? Math.max(0, parseInt(cashbackPoints, 10)) : 0,
      codAvailable: codAllowed,
      artworkUrl: cleanArtworkUrl,
      imageUrl: cleanImageUrl || cleanArtworkUrl,
      imageBackUrl: cleanArtworkUrl || cleanImageUrl,
      imageHoverUrl: cleanArtworkUrl || cleanImageUrl,
      heroImage,
      imageGallery: imageGallery.length ? imageGallery : undefined,
      theme: theme.trim(),
      isArchived: status === "draft",
      showOnStorefront: status === "active" && onStore,
      showInAnime: inAnime,
      showInPremium: premium,
      showInNewDrops: newDrop,
      showInBestSellers: bestSeller,
    };

    const saveKey = isEdit ? `prod:${(draft as Product).id}` : "anime:create";

    const result = await ctl.run(
      saveKey,
      () => (isEdit ? api.admin.updateProduct((draft as Product).id, payload) : api.admin.createProduct(payload)),
      {
        successMessage: isEdit ? `${title} updated` : `${title} published to Shopify-grade catalog`,
        silent: false,
      }
    );

    if (result.ok) {
      onClose();
    } else {
      setError(result.error ?? "Failed to save product drop");
    }
  };

  const isSaving = ctl.isPending(isEdit ? `prod:${(draft as Product).id}` : "anime:create");

  // Sample quick artworks
  const sampleArtworks = [
    { label: "Choso Art (Back)", url: "/products/choso-back.webp" },
    { label: "Choso Chest (Front)", url: "/products/choso-front.webp" },
    { label: "Gojo Limitless (Back)", url: "/products/limitless-back.webp" },
    { label: "Limitless Text (Front)", url: "/products/limitless-front.webp" },
    { label: "Butterfly Art (Back)", url: "/products/butterfly-back.webp" },
    { label: "Butterfly Chest (Front)", url: "/products/butterfly-front.webp" },
  ];

  return (
    <div className="min-h-screen bg-[var(--adm-bg)] text-[var(--adm-text)] font-mono pb-24">
      {/* ---------------- Shopify Top Sticky Action Bar ---------------- */}
      <div className="sticky top-0 z-40 bg-[var(--adm-bg)] border-b border-[var(--adm-border)] px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AdminThemeToggle compact />
          <button
            onClick={onClose}
            className="p-2 border border-[var(--adm-border)] hover:border-[var(--adm-text)] bg-[var(--adm-surface)] text-[var(--adm-text-muted)] hover:text-[var(--adm-text)] transition-colors"
            title="Return to products list"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-widest">
                <Link href="/admin/products" className="text-[var(--adm-text-muted)] hover:text-[var(--adm-accent)] transition-colors">
                  PRODUCTS
                </Link>
                <span className="text-[var(--adm-on-accent)]">/</span>
                <span className="text-[var(--adm-text)]">{isEdit ? "EDIT DROP" : "ADD PRODUCT"}</span>
              </div>
              <span
                className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                  status === "active"
                    ? "bg-[var(--adm-accent)]/10 text-[var(--adm-accent)] border-[var(--adm-accent)]/40"
                    : "bg-[var(--adm-fill)] text-[var(--adm-text-muted)] border-[var(--adm-border)]"
                }`}
              >
                ● {status.toUpperCase()}
              </span>
            </div>
            <h1
              className="text-base sm:text-lg font-bold text-[var(--adm-text)] uppercase tracking-tight truncate max-w-md"
              style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
            >
              {title.trim() || "Untitled Heavyweight Drop"}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--adm-text-muted)] hover:text-[var(--adm-text)] border border-[var(--adm-border)] hover:border-[var(--adm-border-strong)] transition-colors bg-[var(--adm-surface)]"
          >
            Discard
          </button>
          {isEdit && (
            <a
              href={`/product/${(draft as Product).slug}`}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-[var(--adm-info)] border border-[var(--adm-info)]/30 hover:border-[var(--adm-info)] bg-[var(--adm-surface)] transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>View On Store</span>
            </a>
          )}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="px-6 py-2 bg-[var(--adm-accent)] hover:bg-[var(--adm-surface)] text-[var(--adm-on-accent)] font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-2 disabled:opacity-50"
            style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>{isEdit ? "Save Changes" : "Publish Drop"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="max-w-[1500px] mx-auto px-4 sm:px-8 mt-4">
          <div className="p-3 bg-[var(--adm-danger)]/40 border border-[var(--adm-danger)]/60 text-[var(--adm-danger)] text-xs flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-[var(--adm-danger)] hover:text-[var(--adm-text)]">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ---------------- Shopify 2-Column Responsive Layout ---------------- */}
      <div className="max-w-[1500px] mx-auto px-4 sm:px-8 pt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================= LEFT PRIMARY COLUMN (67%) ================= */}
        <div className="lg:col-span-8 space-y-6">
          {/* Card 1: Title & Description */}
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] p-5 sm:p-6 space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)] mb-1.5">
                Title <span className="text-[var(--adm-danger)]">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Shibuya Heavyweight Oversized Anime Tee"
                className="w-full bg-[var(--adm-bg)] border border-[var(--adm-border)] focus:border-[var(--adm-accent)] px-3.5 py-2.5 text-sm font-sans font-bold text-[var(--adm-text)] uppercase placeholder-[var(--adm-text-muted)]/60 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)] mb-1.5">
                Subtitle / Merchandising Teaser
              </label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="e.g. 240 GSM Super-Combed French Terry Cotton · Front & Back Screenprint"
                className="w-full bg-[var(--adm-bg)] border border-[var(--adm-border)] focus:border-[var(--adm-accent)] px-3.5 py-2 text-xs font-mono text-[var(--adm-text)] placeholder-[var(--adm-text-muted)]/60 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)]">
                  Description & Product Specifications
                </label>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="text-[var(--adm-text-muted)]">Insert Specs:</span>
                  <button
                    type="button"
                    onClick={() => appendTemplate("fabric")}
                    className="px-2 py-0.5 bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-info)] hover:border-[var(--adm-info)]"
                  >
                    + Fabric
                  </button>
                  <button
                    type="button"
                    onClick={() => appendTemplate("fit")}
                    className="px-2 py-0.5 bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-accent)] hover:border-[var(--adm-accent)]"
                  >
                    + Silhouette
                  </button>
                  <button
                    type="button"
                    onClick={() => appendTemplate("lore")}
                    className="px-2 py-0.5 bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-text)] hover:border-[var(--adm-text)]"
                  >
                    + Anime Lore
                  </button>
                </div>
              </div>

              {/* Rich Formatting Helper Bar */}
              <div className="bg-[var(--adm-bg)] border border-[var(--adm-border)] border-b-0 px-3 py-1.5 flex items-center gap-2 text-xs text-[var(--adm-text-muted)]">
                <button
                  type="button"
                  onClick={() => setDescription((d) => d + "\n**BOLD TEXT**")}
                  className="px-2 py-0.5 hover:text-[var(--adm-text)] font-bold"
                  title="Bold"
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => setDescription((d) => d + "\n*italic text*")}
                  className="px-2 py-0.5 hover:text-[var(--adm-text)] italic"
                  title="Italic"
                >
                  I
                </button>
                <span className="text-[var(--adm-on-accent)]">|</span>
                <button
                  type="button"
                  onClick={() => setDescription((d) => d + "\n- Bullet item")}
                  className="px-2 py-0.5 hover:text-[var(--adm-text)]"
                  title="List"
                >
                  • List
                </button>
                <button
                  type="button"
                  onClick={() => setDescription((d) => d + "\n1. Step item")}
                  className="px-2 py-0.5 hover:text-[var(--adm-text)]"
                  title="Numbered"
                >
                  1. List
                </button>
                <span className="text-[var(--adm-on-accent)]">|</span>
                <span className="text-[10px] text-[var(--adm-text-muted)] ml-auto">Markdown Supported</span>
              </div>

              <textarea
                rows={7}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Write rich product description, anime backstory, wash care instructions..."
                className="w-full bg-[var(--adm-bg)] border border-[var(--adm-border)] focus:border-[var(--adm-accent)] p-3 text-xs font-mono text-[var(--adm-text)] placeholder-[var(--adm-text-muted)]/60 focus:outline-none leading-relaxed"
              />
            </div>
          </div>

          {/* Card 1b: Product pack — drives the "Product pack" table on the product page */}
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] p-5 sm:p-6 space-y-4">
            <div className="border-b border-[var(--adm-border)] pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--adm-text)] flex items-center gap-2">
                <Package className="w-4 h-4 text-[var(--adm-accent)]" />
                Product pack
              </h2>
              <p className="text-[11px] text-[var(--adm-text-muted)] mt-0.5">
                Printed as-is in the Product pack table on the product page. Blank rows stay hidden.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)] mb-1.5">
                  Fabric
                </label>
                <input
                  type="text"
                  value={fabric}
                  onChange={(e) => setFabric(e.target.value)}
                  placeholder="e.g. 240 GSM Super-Combed French Terry Cotton"
                  className="w-full bg-[var(--adm-bg)] border border-[var(--adm-border)] focus:border-[var(--adm-accent)] px-3.5 py-2 text-xs font-mono text-[var(--adm-text)] placeholder-[var(--adm-text-muted)]/60 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)] mb-1.5">
                  Fit
                </label>
                <input
                  type="text"
                  value={packFit}
                  onChange={(e) => setPackFit(e.target.value)}
                  placeholder="e.g. Oversized · drop shoulder"
                  className="w-full bg-[var(--adm-bg)] border border-[var(--adm-border)] focus:border-[var(--adm-accent)] px-3.5 py-2 text-xs font-mono text-[var(--adm-text)] placeholder-[var(--adm-text-muted)]/60 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)] mb-1.5">
                  Print
                </label>
                <input
                  type="text"
                  value={packPrint}
                  onChange={(e) => setPackPrint(e.target.value)}
                  placeholder="e.g. High-density screenprint"
                  className="w-full bg-[var(--adm-bg)] border border-[var(--adm-border)] focus:border-[var(--adm-accent)] px-3.5 py-2 text-xs font-mono text-[var(--adm-text)] placeholder-[var(--adm-text-muted)]/60 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)] mb-1.5">
                  Wash
                </label>
                <input
                  type="text"
                  value={packWash}
                  onChange={(e) => setPackWash(e.target.value)}
                  placeholder="e.g. Cold machine wash"
                  className="w-full bg-[var(--adm-bg)] border border-[var(--adm-border)] focus:border-[var(--adm-accent)] px-3.5 py-2 text-xs font-mono text-[var(--adm-text)] placeholder-[var(--adm-text-muted)]/60 focus:outline-none"
                />
              </div>
            </div>
          </div>


          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--adm-border)] pb-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--adm-text)] flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-[var(--adm-accent)]" />
                  Media & High-Res Artwork
                </h2>
                <p className="text-[11px] text-[var(--adm-text-muted)] mt-0.5">
                  High-density back prints drive customer conversion on streetwear storefronts.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveMediaTab("back")}
                  className={`px-2.5 py-1 text-[10px] font-bold uppercase border ${
                    activeMediaTab === "back"
                      ? "bg-[var(--adm-accent)] text-[var(--adm-on-accent)] border-[var(--adm-accent)]"
                      : "bg-[var(--adm-bg)] text-[var(--adm-text-muted)] border-[var(--adm-border)]"
                  }`}
                >
                  Back Print Art
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMediaTab("front")}
                  className={`px-2.5 py-1 text-[10px] font-bold uppercase border ${
                    activeMediaTab === "front"
                      ? "bg-[var(--adm-accent)] text-[var(--adm-on-accent)] border-[var(--adm-accent)]"
                      : "bg-[var(--adm-bg)] text-[var(--adm-text-muted)] border-[var(--adm-border)]"
                  }`}
                >
                  Front Mockup
                </button>
              </div>
            </div>

            {/* Media Upload and Preview Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              {/* Media Preview Box */}
              <div className="sm:col-span-4 bg-[var(--adm-bg)] border border-[var(--adm-border)] p-3 flex flex-col items-center justify-center min-h-[220px] relative overflow-hidden">
                {activeMediaTab === "back" ? (
                  artworkUrl.trim() && !artworkBroken ? (
                    <ProductThumb
                      src={artworkUrl.trim()}
                      alt="Back Print Preview"
                      className="max-h-[190px] w-auto object-contain"
                      onFail={() => setArtworkBroken(true)}
                    />
                  ) : (
                    <div className="text-center p-4">
                      <ImageIcon className="w-8 h-8 text-[var(--adm-text-muted)] mx-auto mb-2 opacity-50" />
                      <div className="text-[10px] text-[var(--adm-text-muted)] font-bold uppercase">No Back Artwork</div>
                      <div className="text-[9px] text-[var(--adm-text-muted)] mt-1">Upload artwork below or pick preset</div>
                    </div>
                  )
                ) : imageUrl.trim() ? (
                  <ProductThumb
                    src={imageUrl.trim()}
                    alt="Front Mockup Preview"
                    className="max-h-[190px] w-auto object-contain"
                  />
                ) : (
                  <div className="text-center p-4">
                    <Package className="w-8 h-8 text-[var(--adm-text-muted)] mx-auto mb-2 opacity-50" />
                    <div className="text-[10px] text-[var(--adm-text-muted)] font-bold uppercase">Front Garment Mockup</div>
                    <div className="text-[9px] text-[var(--adm-text-muted)] mt-1">Uses dynamic vector chest graphic</div>
                  </div>
                )}

                <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[9px] text-[var(--adm-accent)] font-bold uppercase">
                  {activeMediaTab === "back"
                    ? heroImage === "back" ? "Back Print · Hero" : "Back Print"
                    : heroImage === "front" ? "Front · Hero" : "Front View"}
                </div>
              </div>

              {/* Upload Dropzone & URL Input */}
              <div className="sm:col-span-8 flex flex-col justify-between space-y-3">
                {/* Upload Action */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) void attachArtwork(file);
                  }}
                  className={`border-2 border-dashed p-4 text-center transition-colors ${
                    isDragging
                      ? "border-[var(--adm-accent)] bg-[var(--adm-accent)]/10"
                      : "border-[var(--adm-border)] hover:border-[var(--adm-accent)] bg-[var(--adm-bg)]/60"
                  }`}
                >
                  <Upload className={`w-6 h-6 mx-auto mb-2 transition-transform ${isDragging ? "text-[var(--adm-accent)] scale-110" : "text-[var(--adm-accent)]"}`} />
                  <p className="text-xs font-bold text-[var(--adm-text)] uppercase">
                    {isDragging ? "Drop artwork here to upload" : "Upload PNG, JPG, or WEBP Artwork"}
                  </p>
                  <p className="text-[10px] text-[var(--adm-text-muted)] mt-0.5">
                    Recommended: 2400 × 3200 px for crisp 300 DPI high-density screenprint
                  </p>
                  <label className="mt-3 inline-block px-4 py-1.5 bg-[var(--adm-text)] hover:bg-[var(--adm-accent)] text-[var(--adm-on-accent)] text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer">
                    {uploading ? "Uploading..." : "Browse Local Files"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/avif"
                      className="sr-only"
                      disabled={uploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        void attachArtwork(file);
                      }}
                    />
                  </label>
                  {artworkError && (
                    <p className="text-[10px] text-[var(--adm-danger)] mt-2">{artworkError}</p>
                  )}
                </div>

                {/* Direct URL input */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)] mb-1">
                    Direct Image URL / Path
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={activeMediaTab === "back" ? artworkUrl : imageUrl}
                      onChange={(e) => {
                        setArtworkBroken(false);
                        if (activeMediaTab === "back") setArtworkUrl(e.target.value);
                        else setImageUrl(e.target.value);
                      }}
                      placeholder={activeMediaTab === "back" ? "/products/art-neeon-haze.webp" : "/products/tee-front.webp"}
                      className="flex-1 bg-[var(--adm-bg)] border border-[var(--adm-border)] focus:border-[var(--adm-accent)] px-3 py-1.5 text-xs font-mono text-[var(--adm-text)] placeholder-[var(--adm-text-muted)]/60 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Quick Presets for Demo / Easy Selection */}
                <div>
                  <span className="text-[10px] text-[var(--adm-text-muted)] uppercase font-bold block mb-1">
                    Or Pick From Vault Artworks:
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {sampleArtworks.map((sample) => (
                      <button
                        key={sample.url}
                        type="button"
                        onClick={() => {
                          setArtworkBroken(false);
                          setArtworkUrl(sample.url);
                          setActiveMediaTab("back");
                        }}
                        className={`px-2 py-0.5 text-[9px] font-mono uppercase border transition-colors ${
                          artworkUrl === sample.url
                            ? "bg-[var(--adm-accent)] text-[var(--adm-on-accent)] border-[var(--adm-accent)] font-bold"
                            : "bg-[var(--adm-bg)] text-[var(--adm-text-muted)] border-[var(--adm-border)] hover:text-[var(--adm-text)]"
                        }`}
                      >
                        {sample.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Storefront hero — which image the cards and product page open with */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--adm-border)] pt-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)]">
                  Storefront hero
                </p>
                <p className="text-[10px] text-[var(--adm-text-muted)]">
                  Image shown on top of the product card and product page.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {(
                  [
                    { key: "back", label: "Back print", disabled: !artworkUrl.trim() },
                    { key: "front", label: "Front mockup", disabled: !imageUrl.trim() },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    disabled={option.disabled}
                    onClick={() => setHeroImage(option.key)}
                    aria-pressed={heroImage === option.key}
                    className={`px-2.5 py-1 text-[10px] font-bold uppercase border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      heroImage === option.key
                        ? "bg-[var(--adm-accent)] text-[var(--adm-on-accent)] border-[var(--adm-accent)]"
                        : "bg-[var(--adm-bg)] text-[var(--adm-text-muted)] border-[var(--adm-border)] hover:text-[var(--adm-text)]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Card 3: Pricing & Profit Margins (Authentic Shopify Experience) */}
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--adm-border)] pb-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--adm-text)] flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-[var(--adm-accent)]" />
                  Pricing & Profit Margins
                </h2>
                <p className="text-[11px] text-[var(--adm-text-muted)] mt-0.5">
                  Set customer selling price, compare-at retail price, and monitor gross margins.
                </p>
              </div>
              {discountPercent > 0 && (
                <div className="px-2.5 py-1 bg-[var(--adm-accent)]/10 border border-[var(--adm-accent)] text-[var(--adm-accent)] text-[10px] font-bold uppercase">
                  Save {discountPercent}% On Storefront
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)] mb-1.5">
                  Price (Selling Price) <span className="text-[var(--adm-danger)]">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-[var(--adm-text-muted)]">₹</span>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="999"
                    className="w-full bg-[var(--adm-bg)] border border-[var(--adm-border)] focus:border-[var(--adm-accent)] pl-7 pr-3 py-2 text-sm font-mono font-bold text-[var(--adm-text)] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)] mb-1.5">
                  Compare-at Price (MRP)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-[var(--adm-text-muted)]">₹</span>
                  <input
                    type="number"
                    value={mrp}
                    onChange={(e) => setMrp(e.target.value)}
                    placeholder="1499"
                    className="w-full bg-[var(--adm-bg)] border border-[var(--adm-border)] focus:border-[var(--adm-accent)] pl-7 pr-3 py-2 text-sm font-mono text-[var(--adm-text-muted)] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)] mb-1.5">
                  Cost per Item (Garment + POD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-[var(--adm-text-muted)]">₹</span>
                  <input
                    type="number"
                    value={costPerItem}
                    onChange={(e) => setCostPerItem(e.target.value)}
                    placeholder="420"
                    className="w-full bg-[var(--adm-bg)] border border-[var(--adm-border)] focus:border-[var(--adm-accent)] pl-7 pr-3 py-2 text-sm font-mono text-[var(--adm-text)] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Profit & Margin Telemetry Banner */}
            <div className="bg-[var(--adm-bg)] border border-[var(--adm-border)] p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-[var(--adm-text-muted)] uppercase font-bold block">Profit per Tee</span>
                <span className={`text-sm font-bold font-mono ${profitAmount > 0 ? "text-[var(--adm-accent)]" : "text-[var(--adm-danger)]"}`}>
                  {formatRupees(profitAmount)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--adm-text-muted)] uppercase font-bold block">Gross Margin</span>
                <span className="text-sm font-bold font-mono text-[var(--adm-info)]">
                  {marginPercent}%
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--adm-text-muted)] uppercase font-bold block">Cashback Accrual</span>
                <span className="text-sm font-bold font-mono text-[var(--adm-text)]">
                  {calculatedCoins} Coins
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--adm-text-muted)] uppercase font-bold block">Tax Setting</span>
                <span className="text-xs font-mono text-[var(--adm-text-muted)]">
                  5% GST Included
                </span>
              </div>
            </div>

            {/* COD Toggle */}
            <div className="pt-2 flex items-center justify-between border-t border-[var(--adm-border)]">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={codAllowed}
                  onChange={(e) => setCodAllowed(e.target.checked)}
                  className="w-4 h-4 rounded-none accent-[var(--adm-accent)] bg-[var(--adm-bg)] border-[var(--adm-border)]"
                />
                <span className="text-[var(--adm-text)] font-bold uppercase">Allow Cash On Delivery (COD)</span>
              </label>
              <span className="text-[10px] text-[var(--adm-text-muted)] font-mono">
                {codAllowed ? "COD ACTIVE" : "PREPAID ONLY"}
              </span>
            </div>

            {/* Dedicated Reward Coins Management */}
            <div className="rounded border border-[var(--adm-warning)]/30 bg-[var(--adm-warning)]/10 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[var(--adm-warning)] text-xs flex items-center gap-1.5 uppercase tracking-wider font-mono">
                  <Coins className="w-4 h-4 text-[var(--adm-warning)]" />
                  Product Reward Coins (Independent)
                </span>
                {cashbackPoints.trim() !== "" && Number(cashbackPoints) > 0 ? (
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-[var(--adm-warning)]/30 text-[var(--adm-warning)] border border-[var(--adm-warning)]/40">
                    Active: {formatCount(Number(cashbackPoints) || 0)} coins
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-[var(--adm-text)]">
                    Default (0 coins)
                  </span>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 items-center">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[var(--adm-text-muted)] mb-1 font-mono">
                    Coins Quantity (Set Any Amount)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={cashbackPoints}
                    onChange={(e) => setCashbackPoints(e.target.value)}
                    placeholder="e.g. 3300, 5000, 10000 (Default: 0)"
                    className="w-full bg-[var(--adm-bg)] border border-[var(--adm-border)] px-3 py-2 text-sm font-mono text-[var(--adm-text)] focus:outline-none focus:border-[var(--adm-warning)]"
                  />
                  <span className="text-[10px] text-[var(--adm-text-muted)] mt-1 block">
                    Customer gets exactly this coin amount. If left empty, default is 0.
                  </span>
                </div>

                <div className="rounded border border-[var(--adm-border-soft)] bg-[var(--adm-inset-strong)] p-2.5 font-mono text-xs space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-[var(--adm-text)] block">Customer Receives:</span>
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-[var(--adm-warning)]" />
                    <span className="text-base font-black text-[var(--adm-warning)]">
                      {formatCount(Number(cashbackPoints) || 0)} Coins
                    </span>
                  </div>
                  {cashbackPoints.trim() !== "" && (
                    <button
                      type="button"
                      onClick={() => setCashbackPoints("0")}
                      className="text-[10px] text-[var(--adm-danger)] hover:text-[var(--adm-danger)] underline block pt-0.5 cursor-pointer"
                    >
                      Reset / Set to 0
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Inventory & Warehouse Management */}
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--adm-border)] pb-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--adm-text)] flex items-center gap-2">
                  <Package className="w-4 h-4 text-[var(--adm-accent)]" />
                  Inventory & Warehouse SKU
                </h2>
                <p className="text-[11px] text-[var(--adm-text-muted)] mt-0.5">
                  Track warehouse inventory and automated low-stock warnings.
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={trackQuantity}
                  onChange={(e) => setTrackQuantity(e.target.checked)}
                  className="w-4 h-4 rounded-none accent-[var(--adm-accent)] bg-[var(--adm-bg)] border-[var(--adm-border)]"
                />
                <span className="text-[var(--adm-text-muted)] font-bold uppercase">Track Quantity</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)]">
                    SKU (Stock Keeping Unit)
                  </label>
                  <button
                    type="button"
                    onClick={generateSku}
                    className="text-[10px] text-[var(--adm-accent)] hover:underline uppercase font-bold"
                  >
                    Generate SKU
                  </button>
                </div>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="e.g. ZN-240-SHIB-01"
                  className="w-full bg-[var(--adm-bg)] border border-[var(--adm-border)] focus:border-[var(--adm-accent)] px-3.5 py-2 text-xs font-mono text-[var(--adm-text)] uppercase focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)] mb-1.5">
                  Barcode (GTIN / UPC)
                </label>
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="890441230091"
                  className="w-full bg-[var(--adm-bg)] border border-[var(--adm-border)] focus:border-[var(--adm-accent)] px-3.5 py-2 text-xs font-mono text-[var(--adm-text)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)] mb-1.5">
                  Available Quantity
                </label>
                <input
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="50"
                  className="w-full bg-[var(--adm-bg)] border border-[var(--adm-border)] focus:border-[var(--adm-accent)] px-3.5 py-2 text-xs font-mono text-[var(--adm-text)] font-bold focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Card 5: Variants (Size & Color Matrix) */}
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] p-5 sm:p-6 space-y-5">
            <div className="border-b border-[var(--adm-border)] pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--adm-text)] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[var(--adm-accent)]" />
                Garment Variants (Sizes & Colors)
              </h2>
              <p className="text-[11px] text-[var(--adm-text-muted)] mt-0.5">
                Manage size run and fabric colorways with individual SKU matrix.
              </p>
            </div>

            {/* Size Run Selection */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)] mb-2">
                Available Size Run:
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {SIZE_OPTIONS.map((sz) => {
                  const active = selectedSizes.includes(sz);
                  return (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => toggleSize(sz)}
                      className={`h-9 min-w-10 px-3 text-xs font-mono font-bold uppercase border transition-colors ${
                        active
                          ? "bg-[var(--adm-text)] text-[var(--adm-on-accent)] border-[var(--adm-text)]"
                          : "bg-[var(--adm-bg)] text-[var(--adm-text-muted)] border-[var(--adm-border)] hover:border-[var(--adm-border-strong)]"
                      }`}
                    >
                      {sz}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color Swatches Selection */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)] mb-2">
                Available Garment Colorways:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {COLOR_SWATCHES.map((swatch) => {
                  const active = selectedColors.includes(swatch.name);
                  return (
                    <button
                      key={swatch.name}
                      type="button"
                      onClick={() => toggleColor(swatch.name)}
                      className={`p-2 border text-left flex items-center gap-2.5 transition-colors ${
                        active
                          ? "bg-[var(--adm-bg)] border-[var(--adm-accent)] text-[var(--adm-text)]"
                          : "bg-[var(--adm-bg)] border-[var(--adm-border)] text-[var(--adm-text-muted)] opacity-60 hover:opacity-100"
                      }`}
                    >
                      <span
                        className="w-4 h-4 border border-[var(--adm-border)] shrink-0"
                        style={{ backgroundColor: swatch.hex }}
                      />
                      <span className="text-[11px] font-bold uppercase truncate">{swatch.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Generated Variant Matrix Table */}
            <div className="pt-2">
              <span className="text-[10px] text-[var(--adm-text-muted)] uppercase font-bold block mb-2">
                Variant Inventory Matrix ({selectedSizes.length * selectedColors.length} combinations):
              </span>
              <div className="border border-[var(--adm-border)] overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[var(--adm-bg)] border-b border-[var(--adm-border)] text-[10px] text-[var(--adm-text-muted)] uppercase">
                    <tr>
                      <th className="p-2.5">Size</th>
                      <th className="p-2.5">Color</th>
                      <th className="p-2.5">Price</th>
                      <th className="p-2.5">SKU</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--adm-border)] bg-[var(--adm-surface)]">
                    {selectedSizes.slice(0, 5).map((sz) =>
                      selectedColors.slice(0, 2).map((col) => (
                        <tr key={`${sz}-${col}`} className="hover:bg-[var(--adm-bg)]/50">
                          <td className="p-2.5 font-bold text-[var(--adm-text)]">{sz}</td>
                          <td className="p-2.5 text-[var(--adm-text-muted)]">{col}</td>
                          <td className="p-2.5 text-[var(--adm-accent)] font-bold">{formatRupees(numPrice)}</td>
                          <td className="p-2.5 text-[var(--adm-text-muted)] text-[11px]">{sku || "AUTO-GEN"}-{sz}-{col.substring(0, 3).toUpperCase()}</td>
                          <td className="p-2.5">
                            <span className="px-1.5 py-0.5 bg-[var(--adm-accent)]/10 text-[var(--adm-accent)] text-[9px] uppercase font-bold border border-[var(--adm-accent)]/30">
                              Ready
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Card 6: Search Engine Listing (SEO) */}
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] p-5 sm:p-6 space-y-3">
            <div className="border-b border-[var(--adm-border)] pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--adm-text)] flex items-center gap-2">
                <Globe className="w-4 h-4 text-[var(--adm-info)]" />
                Search Engine Listing (SEO)
              </h2>
              <p className="text-[11px] text-[var(--adm-text-muted)] mt-0.5">
                Preview of how this streetwear drop appears in Google search engine indexing.
              </p>
            </div>

            <div className="bg-[var(--adm-bg)] border border-[var(--adm-border)] p-4 space-y-1">
              <div className="text-[11px] text-[var(--adm-text-muted)] flex items-center gap-1.5 truncate">
                <span className="text-[var(--adm-info)]">https://skywear.in</span>
                <span>›</span>
                <span>product</span>
                <span>›</span>
                <span className="text-[var(--adm-text)]">{title.toLowerCase().replace(/[^a-z0-9]/g, "-") || "shibuya-oversized-tee"}</span>
              </div>
              <h3 className="text-sm font-bold text-[var(--adm-accent)] hover:underline cursor-pointer">
                {title || "SKYWARE Heavyweight Oversized Anime Streetwear"} | 240 GSM Official Store
              </h3>
              <p className="text-xs text-[var(--adm-text-muted)] line-clamp-2">
                {description || "Custom 240+ GSM heavyweight oversized anime t-shirt. Drop-shoulder boxy fit with multi-pass discharge screenprint. 10% instant cashback into Live Wallet."}
              </p>
            </div>
          </div>
        </div>

        {/* ================= RIGHT SIDEBAR COLUMN (33%) ================= */}
        <div className="lg:col-span-4 space-y-6">
          {/* Sidebar Card 1: Product Status */}
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] p-5 space-y-3.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)]">
              Product Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "active" | "draft")}
              className="w-full bg-[var(--adm-bg)] border border-[var(--adm-border)] focus:border-[var(--adm-accent)] px-3.5 py-2 text-xs font-mono text-[var(--adm-text)] focus:outline-none cursor-pointer uppercase font-bold"
            >
              <option value="active">Active (Visible On Storefront)</option>
              <option value="draft">Draft (Hidden From Shoppers)</option>
            </select>
            <p className="text-[10px] text-[var(--adm-text-muted)] leading-relaxed">
              Active drops are purchasable immediately by shoppers. Draft drops are only visible to logged-in admins.
            </p>

            <div className="pt-3 border-t border-[var(--adm-border)]">
              <span className="text-[10px] text-[var(--adm-text-muted)] uppercase font-bold block mb-1.5">
                Sales Channels (3 of 3 Active)
              </span>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2 text-[var(--adm-text)]">
                  <Check className="w-3.5 h-3.5 text-[var(--adm-accent)]" />
                  <span>Online Storefront (Desktop & Mobile)</span>
                </div>
                <div className="flex items-center gap-2 text-[var(--adm-text)]">
                  <Check className="w-3.5 h-3.5 text-[var(--adm-accent)]" />
                  <span>Anime Sagas & Theme Archives</span>
                </div>
                <div className="flex items-center gap-2 text-[var(--adm-text)]">
                  <Check className="w-3.5 h-3.5 text-[var(--adm-accent)]" />
                  <span>3D Floating Perspective Showcase</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Card 2: Publishing & Merchandising Badges */}
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] p-5 space-y-3">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)] border-b border-[var(--adm-border)] pb-2">
              Merchandising Badges
            </label>

            <div className="space-y-2.5 text-xs">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onStore}
                  onChange={(e) => setOnStore(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded-none accent-[var(--adm-accent)] bg-[var(--adm-bg)] border-[var(--adm-border)]"
                />
                <div>
                  <span className="text-[var(--adm-text)] font-bold uppercase block">Show On Storefront</span>
                  <span className="text-[10px] text-[var(--adm-text-muted)]">Appears in general product listings</span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inAnime}
                  onChange={(e) => setInAnime(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded-none accent-[var(--adm-accent)] bg-[var(--adm-bg)] border-[var(--adm-border)]"
                />
                <div>
                  <span className="text-[var(--adm-text)] font-bold uppercase block">Anime Collection</span>
                  <span className="text-[10px] text-[var(--adm-text-muted)]">Included in anime franchise filters</span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={premium}
                  onChange={(e) => setPremium(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded-none accent-[var(--adm-accent)] bg-[var(--adm-bg)] border-[var(--adm-border)]"
                />
                <div>
                  <span className="text-[var(--adm-text)] font-bold uppercase block">Heavyweight (240+ GSM)</span>
                  <span className="text-[10px] text-[var(--adm-text-muted)]">Displays [240 GSM] flagship badge</span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newDrop}
                  onChange={(e) => setNewDrop(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded-none accent-[var(--adm-accent)] bg-[var(--adm-bg)] border-[var(--adm-border)]"
                />
                <div>
                  <span className="text-[var(--adm-text)] font-bold uppercase block">New Drop Badge</span>
                  <span className="text-[10px] text-[var(--adm-text-muted)]">Appears in "Fresh Drop 01" carousel</span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bestSeller}
                  onChange={(e) => setBestSeller(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded-none accent-[var(--adm-accent)] bg-[var(--adm-bg)] border-[var(--adm-border)]"
                />
                <div>
                  <span className="text-[var(--adm-text)] font-bold uppercase block">Best Seller Tag</span>
                  <span className="text-[10px] text-[var(--adm-text-muted)]">Pinned top in bestselling sorting</span>
                </div>
              </label>
            </div>
          </div>

          {/* Sidebar Card 3: Organization & Theme */}
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] p-5 space-y-4">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)] border-b border-[var(--adm-border)] pb-2">
              Product Organization
            </label>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)] mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Product["category"])}
                className="w-full bg-[var(--adm-bg)] border border-[var(--adm-border)] focus:border-[var(--adm-accent)] px-3 py-1.5 text-xs font-mono text-[var(--adm-text)] focus:outline-none cursor-pointer"
              >
                {PRODUCT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)] mb-1">
                Anime Franchise / Series
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="w-full bg-[var(--adm-bg)] border border-[var(--adm-border)] focus:border-[var(--adm-accent)] px-3 py-1.5 text-xs font-mono text-[var(--adm-text)] focus:outline-none cursor-pointer"
              >
                {ANIME_THEMES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)] mb-1">
                Chest Graphic Preset
              </label>
              <select
                value={graphic}
                onChange={(e) => setGraphic(e.target.value)}
                className="w-full bg-[var(--adm-bg)] border border-[var(--adm-border)] focus:border-[var(--adm-accent)] px-3 py-1.5 text-xs font-mono text-[var(--adm-text)] focus:outline-none cursor-pointer"
              >
                {GRAPHIC_PRESETS.map((gp) => (
                  <option key={gp.type} value={gp.type}>
                    {gp.label} ({gp.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Tag Chips */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)] mb-1">
                Product Tags
              </label>
              <div className="flex items-center gap-1.5 mb-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="e.g. puff-print"
                  className="flex-1 bg-[var(--adm-bg)] border border-[var(--adm-border)] focus:border-[var(--adm-accent)] px-2.5 py-1 text-xs font-mono text-[var(--adm-text)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-2.5 py-1 bg-[var(--adm-fill)] text-[var(--adm-text)] hover:bg-[var(--adm-accent)] hover:text-[var(--adm-on-accent)] text-xs font-bold uppercase transition-colors"
                >
                  Add
                </button>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[10px] text-[var(--adm-text-muted)]"
                  >
                    #{t}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      className="hover:text-[var(--adm-danger)]"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar Card 4: Live Storefront Card Preview */}
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--adm-border)] pb-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text)]">
                Live Storefront Preview
              </label>
              <span className="text-[9px] font-bold text-[var(--adm-accent)] uppercase">[240 GSM]</span>
            </div>

            <div className="bg-[var(--adm-bg)] border border-[var(--adm-border)] p-3 text-center">
              <div className="aspect-[4/5] bg-[var(--adm-surface)] border border-[var(--adm-border)] flex items-center justify-center relative overflow-hidden mb-3">
                {heroPreviewSrc && !heroPreviewBroken ? (
                  <ProductThumb
                    src={heroPreviewSrc}
                    alt="Storefront hero preview"
                    className="w-full h-full object-cover"
                    onFail={heroImage === "back" ? () => setArtworkBroken(true) : undefined}
                  />
                ) : (
                  <div className="text-center p-4">
                    <Sparkles className="w-6 h-6 text-[var(--adm-accent)] mx-auto mb-1 opacity-70" />
                    <span className="text-[10px] text-[var(--adm-text-muted)] font-bold uppercase block">
                      {heroImage === "back" ? "Back Print Artwork" : "Front Mockup"}
                    </span>
                  </div>
                )}
                <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-[var(--adm-bg)] text-[var(--adm-info)] border border-[var(--adm-info)]/40 text-[9px] font-bold uppercase">
                  [240 GSM]
                </div>
              </div>

              <div className="text-left space-y-1">
                <div className="text-[10px] text-[var(--adm-accent)] font-bold uppercase">{theme}</div>
                <div className="text-xs font-bold text-[var(--adm-text)] uppercase truncate">
                  {title || "Untiled Drop"}
                </div>
                <div className="flex items-baseline gap-2 pt-1 font-mono">
                  <span className="text-sm font-black text-[var(--adm-text)]">{formatRupees(numPrice)}</span>
                  {numMrp > numPrice && (
                    <span className="text-[10px] text-[var(--adm-text-muted)] line-through">{formatRupees(numMrp)}</span>
                  )}
                  {discountPercent > 0 && (
                    <span className="text-[9px] text-[var(--adm-accent)] font-bold ml-auto">
                      SAVE {discountPercent}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
