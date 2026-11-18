"use client";

import React, { useState } from "react";
import type { ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import type { OrderStatus, PaymentStatus } from "@/lib/domain";
import { titleCase } from "../shared";

export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

const BADGE_TONES: Record<BadgeTone, string> = {
  success: "border-[var(--adm-success)]/25 bg-[var(--adm-success-bg)] text-[var(--adm-success)]",
  warning: "border-[var(--adm-warning)]/25 bg-[var(--adm-warning-bg)] text-[var(--adm-warning)]",
  danger: "border-[var(--adm-danger)]/25 bg-[var(--adm-danger-bg)] text-[var(--adm-danger)]",
  info: "border-[var(--adm-info)]/25 bg-[var(--adm-info-bg)] text-[var(--adm-info)]",
  neutral: "border-[var(--adm-border)] bg-[var(--adm-bg)] text-[var(--adm-text-muted)]",
};

export function LightBadge({
  tone,
  children,
  className = "",
}: {
  tone: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium leading-5 ${BADGE_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  PAID: "Paid",
  PENDING: "Pending",
  PENDING_VERIFICATION: "Verification pending",
  REFUNDED: "Refunded",
  REJECTED: "Rejected",
};

export const PAYMENT_TONE: Record<PaymentStatus, BadgeTone> = {
  PAID: "success",
  PENDING: "warning",
  PENDING_VERIFICATION: "warning",
  REFUNDED: "neutral",
  REJECTED: "danger",
};

export const FULFILLMENT_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  PRINTING_POD: "Printing",
  MANIFEST_GENERATED: "Manifest generated",
  SHIPPED: "In transit",
  LOCAL_AREA: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export const FULFILLMENT_TONE: Record<OrderStatus, BadgeTone> = {
  PENDING: "warning",
  APPROVED: "neutral",
  PRINTING_POD: "neutral",
  MANIFEST_GENERATED: "info",
  SHIPPED: "info",
  LOCAL_AREA: "info",
  DELIVERED: "success",
  CANCELLED: "danger",
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  UPI: "UPI",
  CARD: "Card",
  NETBANKING: "Netbanking",
  COD: "Cash on Delivery",
  COMPLIMENTARY: "Complimentary",
  MANUAL_UPI: "Manual UPI",
  COINS: "Coins",
};

export function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABEL[method] ?? titleCase(method);
}

export function DeskCard({
  title,
  action,
  children,
  className = "",
  bodyClassName = "px-4 py-3.5",
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface)] ${className}`}>
      {title ? (
        <header className="flex items-center justify-between gap-2 border-b border-[var(--adm-border)] px-4 py-3">
          <h2 className="text-[13px] font-semibold text-[var(--adm-text)]">{title}</h2>
          {action}
        </header>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function CopyButton({
  value,
  label,
  className = "",
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
      onClick={() => {
        void copyText(value).then((ok) => {
          if (!ok) return;
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        });
      }}
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--adm-text-muted)] transition-colors hover:bg-[var(--adm-surface-2)] hover:text-[var(--adm-text)] ${className}`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-[var(--adm-success)]" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export const LIGHT_INPUT =
  "h-8 w-full min-w-0 rounded-md border border-[var(--adm-border)] bg-[var(--adm-surface)] px-2.5 text-[13px] text-[var(--adm-text)] outline-none transition-colors placeholder:text-[var(--adm-text-muted)] focus:border-[var(--adm-info)] focus:ring-2 focus:ring-[var(--adm-info)]/15 disabled:bg-[var(--adm-bg)] disabled:text-[var(--adm-text-muted)]";

export const LIGHT_SELECT =
  "h-8 rounded-md border border-[var(--adm-border)] bg-[var(--adm-surface)] px-2 text-[12px] text-[var(--adm-text)] outline-none transition-colors focus:border-[var(--adm-info)] focus:ring-2 focus:ring-[var(--adm-info)]/15";

export const LIGHT_PRIMARY =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-[var(--adm-text)] px-3 text-[12px] font-semibold text-[var(--adm-on-accent)] transition-colors hover:opacity-90 active:translate-y-px disabled:cursor-not-allowed disabled:bg-[var(--adm-fill-strong)] disabled:text-[var(--adm-text-muted)]";

export const LIGHT_SECONDARY =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 text-[12px] font-medium text-[var(--adm-text)] transition-colors hover:bg-[var(--adm-bg)] active:translate-y-px disabled:cursor-not-allowed disabled:text-[var(--adm-text-dim)]";

export function LightEmpty({
  icon: Icon,
  title,
  message,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--adm-border)] bg-[var(--adm-bg)]">
        <Icon className="h-4 w-4 text-[var(--adm-text-muted)]" />
      </span>
      <p className="text-[13px] font-semibold text-[var(--adm-text)]">{title}</p>
      <p className="max-w-sm text-[12px] leading-relaxed text-[var(--adm-text-muted)]">{message}</p>
      {action}
    </div>
  );
}
