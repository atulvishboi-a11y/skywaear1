"use client";

import React, { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { TriangleAlert } from "lucide-react";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { EmptyState as AstryxEmptyState } from "@astryxdesign/core/EmptyState";
import { ProgressBar as AstryxProgressBar } from "@astryxdesign/core/ProgressBar";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Toast } from "@astryxdesign/core/Toast";
import type { ToastItem } from "@/components/admin/shared";

/**
 * Some public image paths were served an HTML shell before the asset existed, and the
 * browser cached that response. A failed decode retries once with a cache-buster.
 */
export function ProductThumb({
  src,
  alt = "",
  className = "h-full w-full object-cover",
  fallback = null,
  onFail,
}: {
  src: string;
  alt?: string;
  className?: string;
  fallback?: React.ReactNode;
  onFail?: () => void;
}) {
  // Attempts are keyed by src so switching artwork starts clean without an effect.
  const [attempt, setAttempt] = useState<{ src: string; level: 0 | 1 | 2 }>({ src, level: 0 });
  const level = attempt.src === src ? attempt.level : 0;

  if (level === 2) return <>{fallback}</>;

  return (
    <img
      src={level === 1 ? `${src}${src.includes("?") ? "&" : "?"}retry=1` : src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => {
        setAttempt({ src, level: level === 0 ? 1 : 2 });
        if (level === 1) onFail?.();
      }}
    />
  );
}

/* ------------------------------------------------------------------ surfaces */

type Tone = "violet" | "emerald" | "amber" | "rose" | "sky";

export const TONE_KIT: Record<
  Tone,
  { text: string; border: string; tile: string; blob: string; bar: string; fill: string }
> = {
  violet: {
    text: "text-[var(--adm-info)]",
    border: "border-[var(--adm-border)]",
    tile: "bg-[var(--adm-bg)] text-[var(--adm-info)] border-[var(--adm-border)]",
    blob: "hidden",
    bar: "bg-[var(--adm-info)]",
    fill: "bg-[var(--adm-info)]",
  },
  emerald: {
    text: "text-[var(--adm-accent)]",
    border: "border-[var(--adm-border)]",
    tile: "bg-[var(--adm-bg)] text-[var(--adm-accent)] border-[var(--adm-border)]",
    blob: "hidden",
    bar: "bg-[var(--adm-accent)]",
    fill: "bg-[var(--adm-accent)]",
  },
  amber: {
    text: "text-[var(--adm-warning)]",
    border: "border-[var(--adm-border)]",
    tile: "bg-[var(--adm-bg)] text-[var(--adm-warning)] border-[var(--adm-border)]",
    blob: "hidden",
    bar: "bg-[var(--adm-warning)]",
    fill: "bg-[var(--adm-warning)]",
  },
  rose: {
    text: "text-[var(--adm-danger)]",
    border: "border-[var(--adm-border)]",
    tile: "bg-[var(--adm-bg)] text-[var(--adm-danger)] border-[var(--adm-border)]",
    blob: "hidden",
    bar: "bg-[var(--adm-danger)]",
    fill: "bg-[var(--adm-danger)]",
  },
  sky: {
    text: "text-[var(--adm-info)]",
    border: "border-[var(--adm-border)]",
    tile: "bg-[var(--adm-bg)] text-[var(--adm-info)] border-[var(--adm-border)]",
    blob: "hidden",
    bar: "bg-[var(--adm-info)]",
    fill: "bg-[var(--adm-info)]",
  },
};

export function Panel({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      padding={0}
      className={`relative min-w-0 overflow-hidden rounded-none border border-[var(--adm-border)] bg-[var(--adm-surface)] ${className}`}
    >
      {children}
    </Card>
  );
}

export function PanelHeader({
  title,
  subtitle,
  icon: Icon,
  tone = "violet",
  actions,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  tone?: Tone;
  actions?: React.ReactNode;
}) {
  const kit = TONE_KIT[tone];
  return (
    <div className="relative flex flex-col gap-3 border-b border-[var(--adm-border)] bg-[var(--adm-bg)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <span
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-none border border-[var(--adm-border)] bg-[var(--adm-surface)]"
          >
            <Icon className={`h-4 w-4 ${kit.text}`} />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2
            className="truncate text-xs sm:text-sm font-bold uppercase tracking-wider text-[var(--adm-text)]"
            style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
          >
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 font-mono text-[11px] leading-relaxed text-[var(--adm-text-muted)]">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function ConsoleHero({
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  accent = "violet",
  search,
  stats,
  actions,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  accent?: Tone;
  search?: React.ReactNode;
  stats?: { label: string; value: string; sub?: string; tone?: string }[];
  actions?: React.ReactNode;
}) {
  const kit = TONE_KIT[accent];
  return (
    <section className="relative overflow-hidden rounded-none border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 sm:p-6 font-mono">
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {Icon ? (
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-none border border-[var(--adm-border)] bg-[var(--adm-bg)]"
              >
                <Icon className={`h-3.5 w-3.5 ${kit.text}`} />
              </span>
            ) : null}
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--adm-accent)]">
              {eyebrow}
            </p>
          </div>
          <h2
            className="mt-1.5 text-xl font-bold uppercase tracking-tight text-[var(--adm-text)] sm:text-2xl"
            style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
          >
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-[var(--adm-text-muted)]">
              {subtitle}
            </p>
          ) : null}
          {search ? <div className="mt-4">{search}</div> : null}
          {actions ? <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>

        {stats?.length ? (
          <div
            className="grid w-full shrink-0 gap-px overflow-hidden rounded-none border border-[var(--adm-border)] bg-[var(--adm-fill)] sm:w-auto sm:divide-x sm:divide-[var(--adm-border)] sm:gap-0"
            style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 3)}, minmax(0, 1fr))` }}
          >
            {stats.map((stat) => (
              <StatCell key={stat.label} {...stat} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function StatCell({
  label,
  value,
  sub,
  tone = "text-[var(--adm-text)]",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0 bg-[var(--adm-bg)] px-3.5 py-3 text-center sm:text-left font-mono">
      <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)]">{label}</p>
      <p className={`mt-1 truncate text-lg font-bold leading-none ${tone}`}>{value}</p>
      {sub ? <p className="mt-1 truncate text-[10px] text-[var(--adm-text-muted)]">{sub}</p> : null}
    </div>
  );
}

/* --------------------------------------------------------------------- pills */

export function Pill({
  children,
  tone = "border-[var(--adm-border)] bg-[var(--adm-bg)] text-[var(--adm-text)]",
  className = "",
}: {
  children: React.ReactNode;
  tone?: string;
  className?: string;
}) {
  return <Badge variant={badgeTone(tone)} label={children} className={className} />;
}

function badgeTone(tone: string): "neutral" | "red" | "green" | "yellow" | "cyan" | "purple" {
  if (/rose|red|danger|FF3366/i.test(tone)) return "red";
  if (/emerald|green|00FF66/i.test(tone)) return "green";
  if (/amber|yellow|FFB800/i.test(tone)) return "yellow";
  if (/sky|blue|cyan|00F0FF/i.test(tone)) return "cyan";
  if (/violet|purple|indigo/i.test(tone)) return "purple";
  return "neutral";
}

export function MetricCard({
  label,
  value,
  hint,
  tone = "default",
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | Tone;
  icon?: LucideIcon;
}) {
  const accent = tone === "default" ? null : TONE_KIT[tone];
  const textTone = accent?.text ?? "text-[var(--adm-text)]";
  return (
    <Card
      padding={4}
      className="group relative min-w-0 overflow-hidden rounded-none border border-[var(--adm-border)] bg-[var(--adm-surface)] transition-colors hover:border-[var(--adm-accent)] font-mono"
    >
      <div className="relative flex items-start justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)]">
          {label}
        </span>
        {Icon ? (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-none border border-[var(--adm-border)] bg-[var(--adm-bg)]">
            <Icon className="h-3.5 w-3.5 text-[var(--adm-accent)]" />
          </span>
        ) : null}
      </div>
      <div className={`relative mt-2 truncate text-xl font-bold leading-none sm:text-2xl ${textTone}`}>
        {value}
      </div>
      {hint ? (
        <p className="relative mt-2 text-[10px] leading-relaxed text-[var(--adm-text-muted)]">{hint}</p>
      ) : null}
    </Card>
  );
}

/* -------------------------------------------------------------------- button */

type ButtonVariant = "primary" | "success" | "warning" | "danger" | "ghost" | "outline";
type ButtonSize = "sm" | "md";

const VARIANT_MAP: Record<ButtonVariant, "primary" | "secondary" | "ghost" | "destructive"> = {
  primary: "primary",
  success: "primary",
  warning: "secondary",
  danger: "destructive",
  ghost: "ghost",
  outline: "ghost",
};

function buttonLabel(children: React.ReactNode): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children).trim() || "Action";
  }
  if (Array.isArray(children)) {
    const text = children
      .filter((child) => typeof child === "string" || typeof child === "number")
      .join(" ")
      .trim();
    if (text) return text;
  }
  return "Action";
}

export function AdminButton({
  variant = "primary",
  size = "md",
  icon: Icon,
  pending = false,
  className = "",
  children,
  disabled,
  type = "button",
  ...rest
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  pending?: boolean;
  className?: string;
  children?: React.ReactNode;
} & Omit<React.ComponentProps<"button">, "children" | "className">) {
  return (
    <Button
      type={type}
      label={buttonLabel(children)}
      variant={VARIANT_MAP[variant]}
      size={size}
      icon={Icon ? <Icon className="h-3.5 w-3.5" /> : undefined}
      isLoading={pending}
      isDisabled={disabled}
      className={className}
      {...rest}
    >
      {children}
    </Button>
  );
}

/* --------------------------------------------------------------------- forms */

const CONTROL =
  "w-full min-w-0 rounded-none border border-[var(--adm-border)] bg-[var(--adm-bg)] px-3 py-2 text-xs text-[var(--adm-text)] font-mono transition-colors placeholder:text-[var(--adm-text-muted)] focus:border-[var(--adm-accent)] focus:outline-none disabled:opacity-50";

export function Field({
  label,
  hint,
  required,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block min-w-0 font-mono ${className}`}>
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)]">
        {label}
        {required ? <span className="ml-1 text-[var(--adm-danger)]">*</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-[10px] leading-relaxed text-[var(--adm-text-muted)]">{hint}</span> : null}
    </label>
  );
}

export function TextInput({
  className = "",
  ...rest
}: React.ComponentProps<"input">) {
  return <input className={`${CONTROL} ${className}`} {...rest} />;
}

export function TextArea({
  className = "",
  ...rest
}: React.ComponentProps<"textarea">) {
  return <textarea className={`${CONTROL} ${className}`} {...rest} />;
}

export function SelectInput({
  className = "",
  children,
  ...rest
}: React.ComponentProps<"select">) {
  return (
    <select className={`${CONTROL} appearance-none cursor-pointer ${className}`} {...rest}>
      {children}
    </select>
  );
}

/* -------------------------------------------------------------------- states */

export function EmptyState({
  icon: Icon,
  title,
  message,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
}) {
  return (
    <div className="rounded-none border border-dashed border-[var(--adm-border)] bg-[var(--adm-bg)] font-mono">
      <AstryxEmptyState
        title={title}
        description={message}
        icon={<Icon className="h-4 w-4 text-[var(--adm-accent)]" />}
      />
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p className="mt-2 flex items-start gap-1.5 rounded-none border border-[var(--adm-danger)]/50 bg-[var(--adm-bg)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--adm-danger)]">
      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--adm-danger)]" />
      <span>{message}</span>
    </p>
  );
}

export function ProgressBar({
  done,
  total,
  tone = "emerald",
}: {
  done: number;
  total: number;
  tone?: "emerald" | "violet" | "amber";
}) {
  const variant = tone === "emerald" ? "success" : tone === "amber" ? "warning" : "accent";
  return (
    <AstryxProgressBar
      label="Progress"
      isLabelHidden
      value={done}
      max={Math.max(total, 1)}
      variant={variant}
    />
  );
}

/* --------------------------------------------------------------------- modal */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
  footer,
  maxWidth = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;

  return (
    <Dialog
      isOpen={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      width={MODAL_WIDTHS[maxWidth] ?? 512}
      maxHeight="92dvh"
      purpose="form"
    >
      <DialogHeader
        title={title}
        subtitle={subtitle}
        startContent={Icon ? <Icon className="h-4 w-4 text-[var(--adm-accent)]" /> : undefined}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      />
      <div className="font-mono text-xs text-[var(--adm-text)]">{children}</div>
      {footer ? (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--adm-border)] pt-3">
          {footer}
        </div>
      ) : null}
    </Dialog>
  );
}

const MODAL_WIDTHS: Record<string, number> = {
  "max-w-md": 448,
  "max-w-lg": 512,
  "max-w-xl": 576,
  "max-w-2xl": 672,
  "max-w-3xl": 768,
};

/* ------------------------------------------------------------------- toaster */

export function Toaster({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-3 z-[60] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-96 font-mono">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast
            body={toast.message}
            type={toast.kind === "error" ? "error" : "info"}
            isAutoHide={false}
            autoHideDuration={5000}
            onDismiss={() => onDismiss(toast.id)}
          />
        </div>
      ))}
    </div>
  );
}

export function ScreenLoader({ label }: { label: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center font-mono">
      <Spinner size="lg" label={label} />
    </div>
  );
}

export function RowCard({
  tone = "violet",
  active = false,
  className = "",
  children,
}: {
  tone?: Tone;
  active?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const kit = TONE_KIT[tone];
  return (
    <Card
      padding={0}
      className={`group relative min-w-0 overflow-hidden rounded-none border bg-[var(--adm-surface)] transition-colors hover:border-[var(--adm-accent)] font-mono ${
        active ? "border-[var(--adm-accent)]" : kit.border
      } ${className}`}
    >
      {children}
    </Card>
  );
}
