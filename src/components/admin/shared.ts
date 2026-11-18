import type { Product } from "@/data/products";
import type { AdminOverview } from "@/lib/contracts";
import type { OrderStatus } from "@/lib/domain";
import { ALLOWED_TRANSITIONS } from "@/lib/domain";
import { ANIME_CATEGORIES } from "@/lib/catalog";

export type AdminTab =
  | "overview"
  | "orders"
  | "anime"
  | "products"
  | "customers"
  | "bank-reviews"
  | "withdrawals"
  | "teams"
  | "rules"
  | "support-chat"
  | "support"
  | "affiliates"
  | "agents"
  | "audit"
  | "compliance"
  | "gateways"
  | "push";

export type ToastKind = "success" | "error" | "info";

/**
 * Which desk opened the product editor. Anime drops carry back-print artwork and pick
 * from the anime themes only; the general catalogue never sees them.
 */
export interface ProductEditorRequest {
  draft: Product | "new";
  anime: boolean;
}
export interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
}

export interface RunResult {
  ok: boolean;
  error?: string;
}

export interface RunOptions {
  /** Toast shown only when the request (and the following re-sync) succeeds. */
  successMessage?: string;
  /** Suppress the error toast when the caller renders the message inline. */
  silent?: boolean;
  /** Skip the snapshot re-fetch (read-only calls). */
  skipRefresh?: boolean;
}

/**
 * Everything a tab needs: the server-authoritative snapshot plus a pending-aware
 * mutation runner that always re-syncs from the API after a successful write.
 */
export interface AdminController {
  snapshot: AdminOverview;
  actor: string;
  run: (key: string, task: () => Promise<unknown>, options?: RunOptions) => Promise<RunResult>;
  refresh: () => Promise<RunResult>;
  notify: (kind: ToastKind, message: string) => void;
  setTab: (tab: AdminTab) => void;
  openGiftDispatch: () => void;
  /** Jump to the Members tab with this account's profile opened. */
  openMember: (customerId: string) => void;
  isPending: (key: string) => boolean;
  anyPending: boolean;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unexpected error";
}

const UNAUTHENTICATED = /admin login required|unauthor|not authenticated|sign in/i;

export function isAuthError(message: string): boolean {
  return UNAUTHENTICATED.test(message);
}

export function formatMoney(amount: number): string {
  const fractionDigits = Number.isInteger(amount) ? 0 : 2;
  return (
    "₹" +
    amount.toLocaleString("en-IN", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: 2,
    })
  );
}

export function formatCount(value: number): string {
  return value.toLocaleString("en-IN");
}

export function titleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b(\w)/g, (match) => match.toUpperCase());
}

/** The forward POD step for a status, or null when the order is terminal. */
export function nextOrderStatus(status: OrderStatus): OrderStatus | null {
  return ALLOWED_TRANSITIONS[status].find((candidate) => candidate !== "CANCELLED") ?? null;
}

export function canCancel(status: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[status].includes("CANCELLED");
}

export const ADVANCE_LABELS: Partial<Record<OrderStatus, string>> = {
  PENDING: "Approve order",
  APPROVED: "Push to POD printer",
  PRINTING_POD: "Generate manifest",
  MANIFEST_GENERATED: "Mark in transit",
  SHIPPED: "Mark local area",
  LOCAL_AREA: "Confirm delivered",
};

export const ORDER_TONES: Record<OrderStatus, string> = {
  PENDING: "border-[var(--adm-warning)]/40 bg-[var(--adm-warning)]/10 text-[var(--adm-warning)]",
  APPROVED: "border-[var(--adm-info)]/40 bg-[var(--adm-info)]/10 text-[var(--adm-info)]",
  PRINTING_POD: "border-[var(--adm-violet)]/40 bg-[var(--adm-violet)]/10 text-[var(--adm-violet)]",
  MANIFEST_GENERATED: "border-[var(--adm-info)]/40 bg-[var(--adm-info)]/10 text-[var(--adm-info)]",
  SHIPPED: "border-[var(--adm-info)]/40 bg-[var(--adm-info)]/10 text-[var(--adm-info)]",
  LOCAL_AREA: "border-[var(--adm-success)]/40 bg-[var(--adm-success)]/10 text-[var(--adm-success)]",
  DELIVERED: "border-[var(--adm-success)]/40 bg-[var(--adm-success)]/10 text-[var(--adm-success)]",
  CANCELLED: "border-[var(--adm-danger)]/40 bg-[var(--adm-danger)]/10 text-[var(--adm-danger)]",
};

export const TRANCHE_TONES: Record<string, string> = {
  TRANSFERRED: "border-[var(--adm-success)]/40 bg-[var(--adm-success)]/10 text-[var(--adm-success)]",
  UNLOCKED: "border-[var(--adm-warning)]/40 bg-[var(--adm-warning)]/10 text-[var(--adm-warning)]",
  LOCKED: "border-[var(--adm-border)] bg-[var(--adm-tint-05)] text-[var(--adm-text)]",
  VOID: "border-[var(--adm-danger)]/35 bg-[var(--adm-danger)]/10 text-[var(--adm-danger)]",
};

export const WITHDRAWAL_TONES: Record<string, string> = {
  VESTING_IN_PROGRESS: "border-[var(--adm-warning)]/40 bg-[var(--adm-warning)]/10 text-[var(--adm-warning)]",
  PROCESSING: "border-[var(--adm-warning)]/40 bg-[var(--adm-warning)]/10 text-[var(--adm-warning)]",
  SUBMITTED_TO_BANK: "border-[var(--adm-info)]/40 bg-[var(--adm-info)]/10 text-[var(--adm-info)]",
  COMPLETED: "border-[var(--adm-success)]/40 bg-[var(--adm-success)]/10 text-[var(--adm-success)]",
  PAID: "border-[var(--adm-success)]/40 bg-[var(--adm-success)]/10 text-[var(--adm-success)]",
  REJECTED: "border-[var(--adm-danger)]/40 bg-[var(--adm-danger)]/10 text-[var(--adm-danger)]",
  FAILED: "border-[var(--adm-danger)]/40 bg-[var(--adm-danger)]/10 text-[var(--adm-danger)]",
  REVERSED: "border-[var(--adm-warning)]/40 bg-[var(--adm-warning)]/10 text-[var(--adm-warning)]",
};

export const KIND_TONES: Record<string, string> = {
  SALE: "border-[var(--adm-violet)]/40 bg-[var(--adm-violet)]/10 text-[var(--adm-violet)]",
  GIFT: "border-[var(--adm-success)]/40 bg-[var(--adm-success)]/10 text-[var(--adm-success)]",
  REPLACEMENT: "border-[var(--adm-info)]/40 bg-[var(--adm-info)]/10 text-[var(--adm-info)]",
};

/**
 * The anime back-print drops live on their own admin desk, so the general Catalog
 * picker only offers the non-anime categories. Both lists come from one place.
 */
export const ANIME_THEMES: Product["category"][] = ["T-Shirts"];

export const PRODUCT_CATEGORIES: Product["category"][] = [
  "T-Shirts",
  "Hoodies",
  "Pants",
  "Napkin",
  "Sweatshirts",
  "Accessories",
  "Anime",
];

export const SIZE_OPTIONS = ["S", "M", "L", "XL", "XXL", "3XL"];

export const GRAPHIC_PRESETS: { type: string; label: string; accent: string }[] = [
  { type: "cyber_tokyo", label: "Tokyo Neon Kanji", accent: "#ec4899" },
  { type: "dragon_art", label: "Imperial Dragon", accent: "#f59e0b" },
  { type: "minimal_astral", label: "Astral Coordinates", accent: "#38bdf8" },
  { type: "cyber_skull", label: "Bionic Cyber Skull", accent: "#06b6d4" },
  { type: "retro_sunset", label: "Retro Synthwave", accent: "#f97316" },
  { type: "gym_berserk", label: "Iron Temple Beast", accent: "#ef4444" },
];

export const COLOR_SWATCHES: { name: string; hex: string }[] = [
  { name: "Onyx Black", hex: "#0b0c10" },
  { name: "Bone White", hex: "#ece6db" },
  { name: "Charcoal Slate", hex: "#262b33" },
  { name: "Vintage Sand", hex: "#d8cebf" },
  { name: "Deep Olive", hex: "#232e23" },
  { name: "Crimson Acid", hex: "#4a1924" },
  { name: "Lavender Mist", hex: "#7c6882" },
  { name: "Deep Navy", hex: "#162035" },
];

export function swatchClass(hex: string): string {
  return `bg-[${hex}]`;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function paidTranches(count: number, total: number): string {
  return `${count}/${total} settled`;
}

export function timeLabel(millis: number | null): string {
  if (!millis) return "never";
  return new Date(millis).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
