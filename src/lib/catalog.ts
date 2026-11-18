import type { Product } from "@/data/products";

/**
 * Single source of truth for what a shopper may see, which section a drop belongs to,
 * and how many coins it promises. Both the server (catalog filters, quote, placeOrder)
 * and the storefront UI import this file, so a card, a detail sheet and a checkout
 * quote can never disagree about cashback.
 */

export const ANIME_CATEGORIES: readonly Product["category"][] = [
  "T-Shirts",
];

export const NON_TSHIRT_PRODUCT_TYPES: readonly string[] = [];

export function isTShirt(p: Product): boolean {
  return p.productType === "tshirt" || p.category === "T-Shirts";
}

/** Archived rows are unpublished; hidden rows stay in the database and in order history. */
export function isVisibleToShoppers(p: Product): boolean {
  if (p.isArchived) return false;
  return p.showOnStorefront ?? true;
}

export function isAnimeTShirt(p: Product): boolean {
  return p.showInAnime ?? isTShirt(p);
}

export function isPremiumTShirt(p: Product): boolean {
  return p.showInPremium ?? false;
}

export function isNewDrop(p: Product): boolean {
  return p.showInNewDrops ?? /new|trending|drop/i.test(p.badge ?? "");
}

export function isBestseller(p: Product): boolean {
  return p.showInBestSellers ?? /best/i.test(p.badge ?? "");
}

/** Auto percentage rules are disabled. Cashback comes only from per-product coins. */
export interface ProductCashback {
  /** Coins promised by this product. Never a rupee amount. */
  coins: number;
  /** "override" = admin set per-product coins, "none" = ineligible. */
  source: "override" | "none";
}

/**
 * The admin's per-product coin number is law. The card, the detail sheet, the
 * checkout quote and the wallet credit all read it through here.
 */
export function getProductCoins(p: Product): number {
  return cashbackForProduct(p).coins;
}

export function cashbackForProduct(p: Product): ProductCashback {
  const rawOverride = p.cashbackPoints !== undefined && p.cashbackPoints !== null ? p.cashbackPoints : (p as any).rewardCoins;
  const usable =
    typeof rawOverride === "number" && Number.isFinite(rawOverride) && rawOverride >= 0 ? Math.round(rawOverride) : 0;

  return {
    coins: usable,
    source: usable > 0 ? "override" : "none",
  };
}

export interface StockState {
  label: string;
  purchasable: boolean;
  low: boolean;
  count: number;
}

export function stockState(p: Product): StockState {
  const count = p.stock ?? 60;
  if (count <= 0) return { label: "Sold out", purchasable: false, low: false, count };
  if (count <= 10) return { label: `Only ${count} left`, purchasable: true, low: true, count };
  return { label: "In stock", purchasable: true, low: false, count };
}
