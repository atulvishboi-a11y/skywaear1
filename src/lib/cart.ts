"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { CartItem, Product } from "@/data/products";
import type { CartLinePayload } from "@/lib/contracts";

const CART_KEY = "zenin.cart.v1";
const WISHLIST_KEY = "zenin.wishlist.v1";

function readList<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeList(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("zenin:cart_change", { detail: { key } }));
  } catch {
    /* storage disabled — cart stays in memory for this session */
  }
}

export function usePersistentList<T>(key: string): [T[], Dispatch<SetStateAction<T[]>>] {
  // Always start empty so the first client render matches the server HTML, then
  // hydrate from storage in the effect below. Reading storage during render
  // caused a hydration mismatch on the header cart badge.
  const [list, setList] = useState<T[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Hydrating after mount keeps the first client render identical to the server HTML.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setList(readList<T>(key));
    setHydrated(true);

    const handleSync = (e?: Event) => {
      const customEvent = e as CustomEvent<{ key?: string }>;
      if (!customEvent?.detail?.key || customEvent.detail.key === key) {
        const fresh = readList<T>(key);
        setList((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(fresh)) return prev;
          return fresh;
        });
      }
    };

    window.addEventListener("zenin:cart_change", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("zenin:cart_change", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    const current = readList<T>(key);
    if (JSON.stringify(current) !== JSON.stringify(list)) {
      writeList(key, list);
    }
  }, [key, list, hydrated]);

  return [list, setList];
}

export function cartLineId(productId: string, size: string, colorName: string, side: string): string {
  return `${productId}::${size}::${colorName}::${side}`;
}

export function useCart() {
  const [items, setItems] = usePersistentList<CartItem>(CART_KEY);

  const add = useCallback(
    (item: CartItem) => {
      setItems((prev) => {
        const index = prev.findIndex((line) => line.id === item.id);
        if (index === -1) return [...prev, { ...item, quantity: Math.min(item.quantity, 10) }];
        const next = [...prev];
        next[index] = { ...next[index], quantity: Math.min(next[index].quantity + item.quantity, 10) };
        return next;
      });
    },
    [setItems]
  );

  /** Buy Now sets the cart to ONLY this single product line, clearing previous items */
  const buyNow = useCallback(
    (item: CartItem) => {
      const singleItem = { ...item, quantity: Math.min(item.quantity, 10) };
      setItems([singleItem]);
      writeList(CART_KEY, [singleItem]);
    },
    [setItems]
  );

  const addProduct = useCallback(
    (product: Product, size: string, colorName: string, quantity = 1): CartItem => {
      const color = product.colors.find((c) => c.name === colorName) ?? product.colors[0];
      const item: CartItem = {
        id: cartLineId(product.id, size, color.name, "front"),
        productId: product.id,
        title: product.title,
        price: product.price,
        quantity,
        size,
        colorName: color.name,
        colorHex: color.hex,
        side: "front",
        graphicSvgType: product.graphicSvgType,
      };
      add(item);
      return item;
    },
    [add]
  );

  const updateQuantity = useCallback(
    (id: string, delta: number) => {
      setItems((prev) =>
        prev
          .map((line) => (line.id === id ? { ...line, quantity: line.quantity + delta } : line))
          .filter((line) => line.quantity > 0 && line.quantity <= 10)
      );
    },
    [setItems]
  );

  const removeItem = useCallback((id: string) => setItems((prev) => prev.filter((l) => l.id !== id)), [setItems]);
  const clear = useCallback(() => setItems([]), [setItems]);

  const syncPrices = useCallback(
    (catalogProducts: Product[]) => {
      if (!catalogProducts?.length) return;
      setItems((prev) => {
        let changed = false;
        const next = prev.map((item) => {
          const match = catalogProducts.find(
            (p) =>
              p.id === item.productId ||
              p.slug === item.productId ||
              p.title.toLowerCase() === item.title.toLowerCase()
          );
          if (match && match.price !== undefined && match.price !== item.price) {
            changed = true;
            return { ...item, price: match.price };
          }
          return item;
        });
        return changed ? next : prev;
      });
    },
    [setItems]
  );

  const count = items.reduce((sum, line) => sum + line.quantity, 0);
  const localSubtotal = items.reduce((sum, line) => sum + line.price * line.quantity, 0);

  return { items, add, buyNow, addProduct, updateQuantity, removeItem, clear, syncPrices, count, localSubtotal };
}

export function useWishlist() {
  const [ids, setIds] = usePersistentList<string>(WISHLIST_KEY);

  const toggle = useCallback(
    (productId: string) =>
      setIds((prev) => (prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId])),
    [setIds]
  );

  const remove = useCallback((productId: string) => setIds((prev) => prev.filter((id) => id !== productId)), [setIds]);
  const has = useCallback((productId: string) => ids.includes(productId), [ids]);

  return { ids, toggle, remove, has, count: ids.length };
}

export function toCartLinePayload(items: CartItem[]): CartLinePayload[] {
  return items.map((item) => ({
    productId: item.productId,
    title: item.title,
    price: item.price,
    quantity: item.quantity,
    size: item.size,
    colorName: item.colorName,
    graphicSvgType: item.graphicSvgType,
  }));
}
