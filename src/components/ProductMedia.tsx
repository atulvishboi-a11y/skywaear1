"use client";

import React from "react";
import type { Product } from "../data/products";
import TShirtMockup from "./TShirtMockup";

export interface ProductView {
  key: string;
  label: string;
  /** `photo` renders the file as-is, `mockup` screens the artwork onto the garment vector. */
  kind: "photo" | "mockup";
  src?: string;
  side?: "front" | "back";
}

/**
 * One resolution order for every product surface — card, detail sheet and the admin
 * preview all agree on what a buyer sees, and nothing ever renders a broken frame:
 * real photos win, otherwise the garment mockup carries the vector front emblem and the
 * raster back-print artwork.
 */
export function productViews(product: Product): ProductView[] {
  const photos: ProductView[] = [];
  const seenSrc = new Set<string>();

  const addPhoto = (key: string, label: string, src?: string) => {
    if (!src || seenSrc.has(src)) return;
    seenSrc.add(src);
    photos.push({ key, label, kind: "photo", src });
  };

  if (product.imageUrl) addPhoto("front", "Front", product.imageUrl);
  const backPhoto = product.imageBackUrl || product.imageHoverUrl || product.artworkUrl;
  if (backPhoto) addPhoto("back", "Back", backPhoto);
  (product.imageGallery ?? []).forEach((src, index) => {
    addPhoto(`extra-${index}`, `Detail ${index + 1}`, src);
  });
  if (photos.length) return photos;

  const views: ProductView[] = [{ key: "front", label: "Front", kind: "mockup", side: "front" }];
  views.push({
    key: "back",
    label: product.artworkUrl ? "Back print" : "Back",
    kind: "mockup",
    side: "back",
    src: product.artworkUrl,
  });
  return views;
}

/** The view the storefront opens with — an explicit admin pick wins, otherwise back print. */
export function productHeroView(product: Product): ProductView {
  const views = productViews(product);
  if (product.heroImage) {
    const picked = views.find((view) => view.key === product.heroImage);
    if (picked) return picked;
  }
  return views.find((view) => view.label === "Back print") ?? views[0];
}

interface ProductMediaProps {
  product: Product;
  colorHex: string;
  view: ProductView;
  className?: string;
  imgClassName?: string;
  alt?: string;
  eager?: boolean;
}

export default function ProductMedia({
  product,
  colorHex,
  view,
  className = "w-full max-w-[260px] aspect-[4/5]",
  imgClassName,
  alt,
  eager = false,
}: ProductMediaProps) {
  if (view.kind === "photo" && view.src) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <img
          src={view.src}
          alt={alt ?? `${product.title} — ${view.label}`}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className={`w-full h-full object-contain object-center ${imgClassName ?? ""}`}
        />
      </div>
    );
  }

  return (
    <TShirtMockup
      colorHex={colorHex}
      side={view.side ?? "front"}
      graphicType={product.graphicSvgType}
      graphicLabel={product.graphicTitle}
      uploadedImageUrl={view.side === "back" ? view.src : undefined}
      className={className}
    />
  );
}
