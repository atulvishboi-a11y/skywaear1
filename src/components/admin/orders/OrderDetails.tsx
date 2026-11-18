"use client";

import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Ellipsis,
  ExternalLink,
  Package,
  RefreshCw,
  ShieldCheck,
  XCircle,
  Zap,
} from "lucide-react";
import { api } from "@/lib/client";
import { copyText } from "@/lib/clipboard";
import { dateTimeLabel, getCourierTrackingUrl } from "@/lib/domain";
import type { OrderLine, OrderStatus, ShopOrder } from "@/lib/domain";
import type { Product } from "@/data/products";
import type { AdminController } from "../shared";
import { canCancel, formatMoney, nextOrderStatus, titleCase } from "../shared";
import { ProductThumb } from "../ui";
import {
  CopyButton,
  DeskCard,
  FULFILLMENT_LABEL,
  FULFILLMENT_TONE,
  LIGHT_INPUT,
  LIGHT_PRIMARY,
  LIGHT_SECONDARY,
  LightBadge,
  LightEmpty,
  PAYMENT_LABEL,
  PAYMENT_TONE,
  paymentMethodLabel,
} from "./shared";

/* ------------------------------------------------------------------ page */

export function OrderDetails({
  ctl,
  orderNumber,
  onBack,
}: {
  ctl: AdminController;
  orderNumber: string;
  onBack: () => void;
}) {
  const order = useMemo(() => {
    const needle = orderNumber.trim().toLowerCase();
    return ctl.snapshot.orders.find(
      (candidate) => candidate.orderNumber.toLowerCase() === needle || candidate.id.toLowerCase() === needle
    );
  }, [ctl.snapshot.orders, orderNumber]);

  return (
    <div className="-m-3 min-h-[75vh] bg-[var(--adm-bg)] px-4 py-5 font-sans text-[var(--adm-text)] sm:-m-4 sm:px-6 sm:py-6">
      <div className="mx-auto w-full max-w-[1280px]">
        {order ? (
          <>
            <OrderHeader ctl={ctl} order={order} onBack={onBack} />
            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
              <div className="flex min-w-0 flex-col gap-4">
                <OrderSummary ctl={ctl} order={order} />
                <OrderActivityTimeline order={order} />
              </div>
              <div className="flex min-w-0 flex-col gap-4">
                <CustomerInformation ctl={ctl} order={order} />
                <ShippingAddress order={order} />
                <PaymentVerification ctl={ctl} order={order} />
                <DeliveryManagement
                  key={`${order.id}:${order.trackingNumber ?? ""}:${order.status}`}
                  ctl={ctl}
                  order={order}
                />
              </div>
            </div>
          </>
        ) : (
          <DeskCard className="mx-auto mt-6 max-w-xl">
            <LightEmpty
              icon={Package}
              title="Order not found"
              message={`No order matches ${orderNumber}. It may have been renamed or the link is outdated.`}
              action={
                <button type="button" onClick={onBack} className={`${LIGHT_SECONDARY} mt-1`}>
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to orders
                </button>
              }
            />
          </DeskCard>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- header */

function OrderHeader({
  ctl,
  order,
  onBack,
}: {
  ctl: AdminController;
  order: ShopOrder;
  onBack: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--adm-text-muted)] transition-colors hover:text-[var(--adm-text)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Orders
      </button>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">#{order.orderNumber}</h1>
            <LightBadge tone={PAYMENT_TONE[order.paymentStatus]}>{PAYMENT_LABEL[order.paymentStatus]}</LightBadge>
            <LightBadge tone={FULFILLMENT_TONE[order.status]}>{FULFILLMENT_LABEL[order.status]}</LightBadge>
            {order.kind !== "SALE" ? <LightBadge tone="neutral">{titleCase(order.kind)}</LightBadge> : null}
          </div>
          <p className="mt-1 text-[12px] text-[var(--adm-text-muted)]">
            Placed {dateTimeLabel(order.placedAt)}
            {order.couponCode ? ` · Coupon ${order.couponCode}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[11px] text-[var(--adm-text-muted)]">Total</p>
            <p className="text-lg font-semibold tabular-nums leading-tight">{formatMoney(order.total)}</p>
          </div>
          <MoreActionsMenu ctl={ctl} order={order} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ more actions */

const ADVANCE_COPY: Partial<Record<OrderStatus, string>> = {
  PENDING: "Approve order",
  APPROVED: "Send to printing",
  SHIPPED: "Mark out for delivery",
  LOCAL_AREA: "Mark delivered",
};

function MoreActionsMenu({ ctl, order }: { ctl: AdminController; order: ShopOrder }) {
  const [open, setOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const qikinkEnabled = ctl.snapshot.qikink?.enabled ?? false;

  const close = () => {
    setOpen(false);
    setConfirmCancel(false);
  };

  const runAction = async (key: string, task: () => Promise<unknown>, successMessage: string) => {
    setBusy(true);
    const result = await ctl.run(key, task, { successMessage });
    setBusy(false);
    if (result.ok) close();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={LIGHT_SECONDARY}
      >
        <Ellipsis className="h-4 w-4" />
        More actions
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close actions"
            onClick={close}
            className="fixed inset-0 z-20 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 z-30 mt-1 w-72 rounded-md border border-[var(--adm-border)] bg-[var(--adm-surface)] py-1 shadow-[0_6px_20px_rgba(32,34,35,0.14)]"
          >
            {confirmCancel ? (
              <div className="px-3 py-2">
                <p className="text-[12px] font-semibold">Cancel this order?</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--adm-text-muted)]">
                  Cancelling reverses this order&apos;s earnings and cannot be undone.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void runAction(
                        `cancel:${order.id}`,
                        () => api.admin.setOrderStatus(order.id, "CANCELLED", "Cancelled from admin console"),
                        `${order.orderNumber} cancelled`
                      )
                    }
                    className="inline-flex h-7 items-center rounded-md border border-[var(--adm-danger)] bg-[var(--adm-danger)] px-2.5 text-[12px] font-semibold text-[var(--adm-text)] transition-colors hover:bg-[var(--adm-danger)] disabled:opacity-60"
                  >
                    {busy ? "Cancelling…" : "Yes, cancel order"}
                  </button>
                  <button type="button" onClick={() => setConfirmCancel(false)} className={`${LIGHT_SECONDARY} h-7`}>
                    Keep order
                  </button>
                </div>
              </div>
            ) : (
              <>
                <MenuItem
                  onClick={() =>
                    void copyText(order.orderNumber).then((ok) => {
                      if (ok) ctl.notify("success", "Order number copied");
                      close();
                    })
                  }
                >
                  Copy order number
                </MenuItem>
                {qikinkEnabled && !order.podOrderId && order.status !== "CANCELLED" ? (
                  <MenuItem
                    disabled={busy}
                    onClick={() =>
                      void runAction(
                        `qikink:${order.id}`,
                        () => api.admin.pushOrderToQikink(order.id),
                        `${order.orderNumber} pushed to Qikink`
                      )
                    }
                  >
                    <Zap className="h-3.5 w-3.5 text-[var(--adm-warning)]" />
                    Push to Qikink
                  </MenuItem>
                ) : null}
                {qikinkEnabled && order.podOrderId ? (
                  <MenuItem
                    disabled={busy}
                    onClick={() =>
                      void runAction(
                        `sync_qikink:${order.id}`,
                        () => api.admin.syncOrderWithQikink(order.id),
                        `Synced Qikink tracking for ${order.orderNumber}`
                      )
                    }
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Sync Qikink tracking
                  </MenuItem>
                ) : null}
                {canCancel(order.status) ? (
                  <MenuItem danger onClick={() => setConfirmCancel(true)}>
                    <XCircle className="h-3.5 w-3.5" />
                    Cancel order
                  </MenuItem>
                ) : null}
              </>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  disabled = false,
  danger = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors disabled:opacity-50 ${
        danger
          ? "text-[var(--adm-danger)] hover:bg-[var(--adm-danger-bg)]"
          : "text-[var(--adm-text)] hover:bg-[var(--adm-bg)]"
      }`}
    >
      {children}
    </button>
  );
}

/* --------------------------------------------------------------- summary */

function productImage(products: Product[], item: OrderLine): string | null {
  const title = item.title.trim().toLowerCase();
  const match =
    products.find((product) => product.title.trim().toLowerCase() === title) ??
    products.find((product) => Boolean(item.graphicSvgType) && product.graphicSvgType === item.graphicSvgType);
  return match?.imageUrl ?? match?.imageBackUrl ?? match?.artworkUrl ?? null;
}

function OrderSummary({ ctl, order }: { ctl: AdminController; order: ShopOrder }) {
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <DeskCard title="Order summary" bodyClassName="">
      <ul className="divide-y divide-[var(--adm-border)] px-4">
        {order.items.map((item, index) => {
          const image = productImage(ctl.snapshot.products, item);
          return (
            <li key={`${item.title}-${item.size}-${item.color}-${index}`} className="flex gap-3 py-3">
              <div className="h-16 w-12 shrink-0 overflow-hidden rounded-md border border-[var(--adm-border)] bg-[var(--adm-bg)]">
                {image ? (
                  <ProductThumb
                    src={image}
                    alt={item.title}
                    className="h-full w-full object-cover"
                    fallback={<PackageFallback />}
                  />
                ) : (
                  <PackageFallback />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium leading-snug">{item.title}</p>
                <p className="mt-0.5 text-[12px] text-[var(--adm-text-muted)]">
                  {item.size} · {item.color}
                </p>
                <p className="mt-0.5 text-[12px] tabular-nums text-[var(--adm-text-muted)]">
                  {formatMoney(item.price)} × {item.quantity}
                </p>
              </div>
              <p className="shrink-0 text-[13px] font-semibold tabular-nums">
                {formatMoney(item.price * item.quantity)}
              </p>
            </li>
          );
        })}
      </ul>

      <dl className="space-y-1.5 border-t border-[var(--adm-border)] px-4 py-3 text-[12px]">
        <TotalRow label={`Subtotal · ${itemCount} item${itemCount === 1 ? "" : "s"}`} value={formatMoney(order.subtotal)} />
        {order.discount > 0 ? (
          <TotalRow label={order.couponCode ? `Discount (${order.couponCode})` : "Discount"} value={`−${formatMoney(order.discount)}`} />
        ) : null}
        <TotalRow label="Shipping" value={order.deliveryFee > 0 ? formatMoney(order.deliveryFee) : "Free"} />
        {order.taxAmount && order.taxAmount > 0 ? (
          <TotalRow
            label={`Tax${order.taxPercent ? ` (${order.taxPercent}%)` : ""}`}
            value={formatMoney(order.taxAmount)}
          />
        ) : null}
        {order.gatewayFee && order.gatewayFee > 0 ? (
          <TotalRow label="Payment fee" value={formatMoney(order.gatewayFee)} />
        ) : null}
        <div className="flex items-center justify-between border-t border-[var(--adm-border)] pt-2 text-[13px] font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatMoney(order.total)}</dd>
        </div>
        <p className="pt-0.5 text-[11px] text-[var(--adm-text-muted)]">
          {paymentMethodLabel(order.paymentMethod)} ·{" "}
          {order.paymentStatus === "PAID" ? "Collected" : "Not collected"}
        </p>
      </dl>
    </DeskCard>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[var(--adm-text-muted)]">
      <dt className="truncate">{label}</dt>
      <dd className="shrink-0 tabular-nums text-[var(--adm-text)]">{value}</dd>
    </div>
  );
}

function PackageFallback() {
  return (
    <span className="flex h-full w-full items-center justify-center text-[var(--adm-text-muted)]">
      <Package className="h-4 w-4" />
    </span>
  );
}

/* -------------------------------------------------------------- customer */

function CustomerInformation({ ctl, order }: { ctl: AdminController; order: ShopOrder }) {
  return (
    <DeskCard title="Customer information">
      <div className="space-y-2.5 text-[12px]">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium text-[var(--adm-text)]">{order.customerName}</span>
          <CopyButton value={order.customerName} label="customer name" />
        </div>
        {order.customerPhone ? (
          <div className="flex items-center justify-between gap-2">
            <a href={`tel:${order.customerPhone}`} className="truncate tabular-nums text-[var(--adm-text)] hover:underline">
              {order.customerPhone}
            </a>
            <CopyButton value={order.customerPhone} label="phone number" />
          </div>
        ) : null}
        {order.customerEmail ? (
          <div className="flex items-center justify-between gap-2">
            <a href={`mailto:${order.customerEmail}`} className="min-w-0 truncate text-[var(--adm-text)] hover:underline">
              {order.customerEmail}
            </a>
            <CopyButton value={order.customerEmail} label="email address" />
          </div>
        ) : null}
        {order.customerId ? (
          <button
            type="button"
            onClick={() => ctl.openMember(order.customerId as string)}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--adm-info)] hover:underline"
          >
            View customer profile
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </DeskCard>
  );
}

/* --------------------------------------------------------------- address */

function ShippingAddress({ order }: { order: ShopOrder }) {
  const [copied, setCopied] = useState(false);
  const fullAddress = [
    order.customerName,
    order.address,
    `${order.city}, ${order.state} ${order.pincode}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <DeskCard
      title="Shipping address"
      action={
        <button
          type="button"
          onClick={() => {
            void copyText(fullAddress).then((ok) => {
              if (!ok) return;
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            });
          }}
          className={`${LIGHT_SECONDARY} h-7 px-2`}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-[var(--adm-success)]" /> : null}
          {copied ? "Copied" : "Copy address"}
        </button>
      }
    >
      <address className="space-y-0.5 text-[12px] not-italic leading-relaxed text-[var(--adm-text)]">
        <p className="font-medium">{order.customerName}</p>
        <p className="text-[var(--adm-text-muted)]">{order.address}</p>
        <p className="text-[var(--adm-text-muted)]">
          {order.city}, {order.state} {order.pincode}
        </p>
      </address>
      {order.customerPhone ? (
        <p className="mt-2 border-t border-[var(--adm-border)] pt-2 text-[12px] tabular-nums text-[var(--adm-text-muted)]">
          {order.customerPhone}
        </p>
      ) : null}
    </DeskCard>
  );
}

/* --------------------------------------------------------------- payment */

function PaymentVerification({ ctl, order }: { ctl: AdminController; order: ShopOrder }) {
  const [utrInput, setUtrInput] = useState("");
  const manualPending = order.paymentMethod === "MANUAL_UPI" && order.paymentStatus !== "PAID";
  const verifyKey = `verify_upi:${order.id}`;
  const rejectKey = `reject_upi:${order.id}`;

  return (
    <DeskCard title="Payment verification">
      <dl className="space-y-2 text-[12px]">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-[var(--adm-text-muted)]">Method</dt>
          <dd className="font-medium">{paymentMethodLabel(order.paymentMethod)}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-[var(--adm-text-muted)]">Status</dt>
          <dd>
            <LightBadge tone={PAYMENT_TONE[order.paymentStatus]}>{PAYMENT_LABEL[order.paymentStatus]}</LightBadge>
          </dd>
        </div>

        {order.utr ? (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[var(--adm-text-muted)]">UTR</dt>
            <dd className="flex min-w-0 items-center gap-1">
              <span className="truncate font-mono text-[12px] font-medium">{order.utr}</span>
              <CopyButton value={order.utr} label="UTR" />
            </dd>
          </div>
        ) : null}
        {order.utrSubmittedAt ? (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[var(--adm-text-muted)]">UTR submitted</dt>
            <dd className="text-[var(--adm-text)]">{dateTimeLabel(order.utrSubmittedAt)}</dd>
          </div>
        ) : null}

        {order.paymentStatus === "PAID" ? (
          <div className="flex items-start gap-2 rounded-md border border-[var(--adm-success)]/20 bg-[var(--adm-success-bg)] px-2.5 py-2 text-[12px] text-[var(--adm-success)]">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">Payment verified</p>
              {order.verifiedBy ? <p className="mt-0.5 text-[11px]">By {order.verifiedBy}</p> : null}
              {order.verifiedAt ? <p className="text-[11px] tabular-nums">{dateTimeLabel(order.verifiedAt)}</p> : null}
            </div>
          </div>
        ) : null}

        {order.paymentStatus === "REJECTED" ? (
          <div className="rounded-md border border-[var(--adm-danger)]/20 bg-[var(--adm-danger-bg)] px-2.5 py-2 text-[12px] text-[var(--adm-danger)]">
            <p className="font-semibold">Payment rejected</p>
            {order.rejectionReason ? <p className="mt-0.5 text-[11px]">{order.rejectionReason}</p> : null}
            {order.rejectedAt ? <p className="text-[11px] tabular-nums">{dateTimeLabel(order.rejectedAt)}</p> : null}
          </div>
        ) : null}
      </dl>

      {manualPending ? (
        <div className="mt-3 space-y-2 border-t border-[var(--adm-border)] pt-3">
          <p className="text-[11px] leading-relaxed text-[var(--adm-text-muted)]">
            Confirm ₹{formatMoney(order.total)} in the bank account before approving.
            {order.utr ? "" : " No UTR was submitted — you can add the bank reference below."}
          </p>
          {order.utr ? null : (
            <input
              value={utrInput}
              onChange={(event) => setUtrInput(event.target.value)}
              placeholder="Bank UTR / reference (optional)"
              aria-label="Bank UTR or reference"
              className={`${LIGHT_INPUT} font-mono`}
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={ctl.isPending(verifyKey)}
              onClick={() =>
                void ctl.run(
                  verifyKey,
                  () => api.admin.verifyManualUpi(order.orderNumber, utrInput.trim() || order.utr || undefined),
                  { successMessage: `Payment approved for order ${order.orderNumber}` }
                )
              }
              className={LIGHT_PRIMARY}
            >
              <Check className="h-3.5 w-3.5" />
              {ctl.isPending(verifyKey) ? "Approving…" : "Approve payment"}
            </button>
            <button
              type="button"
              disabled={ctl.isPending(rejectKey)}
              onClick={() => {
                const reason = window.prompt("Reason for rejecting payment:", "Payment not received in bank account");
                if (!reason) return;
                void ctl.run(rejectKey, () => api.admin.rejectManualUpi(order.orderNumber, reason), {
                  successMessage: `Order ${order.orderNumber} payment marked rejected`,
                });
              }}
              className="inline-flex h-8 items-center rounded-md px-2 text-[12px] font-medium text-[var(--adm-danger)] transition-colors hover:bg-[var(--adm-danger-bg)] disabled:opacity-60"
            >
              Reject payment
            </button>
          </div>
        </div>
      ) : null}
    </DeskCard>
  );
}

/* -------------------------------------------------------------- delivery */

const POD_STATUS_LABEL: Record<string, string> = {
  manifested: "Generated",
  sent_to_printer: "Sent to printer",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
};

function DeliveryManagement({ ctl, order }: { ctl: AdminController; order: ShopOrder }) {
  const [awb, setAwb] = useState(order.trackingNumber ?? "");
  const [error, setError] = useState<string | null>(null);

  const cleaned = awb.trim().replace(/\s+/g, "");
  const validAwb = /^[A-Za-z0-9-]{6,}$/.test(cleaned);
  const pending = ctl.isPending(`ship:${order.id}`);

  const canEnterAwb = order.status === "PRINTING_POD" || order.status === "MANIFEST_GENERATED";
  const inTransit = order.status === "SHIPPED" || order.status === "LOCAL_AREA" || order.status === "DELIVERED";
  const locked = order.status === "CANCELLED";
  const goesInTransit = order.status === "MANIFEST_GENERATED";
  const advanceTarget = ADVANCE_COPY[order.status] ? nextOrderStatus(order.status) : null;

  const saveAwb = async () => {
    if (!validAwb) {
      setError("Enter a valid AWB / tracking ID (at least 6 letters or digits).");
      return;
    }
    setError(null);
    const courier = order.courier ?? ctl.snapshot.couriers[0];
    const result = await ctl.run(
      `ship:${order.id}`,
      async () => {
        await api.admin.assignShipment(order.id, courier, cleaned);
        if (goesInTransit) {
          try {
            await api.admin.setOrderStatus(order.id, "SHIPPED", `In transit · AWB ${cleaned.toUpperCase()}`);
          } catch (statusError) {
            await ctl.refresh();
            throw statusError;
          }
        }
      },
      {
        successMessage: goesInTransit
          ? `${order.orderNumber} marked in transit`
          : `AWB saved for ${order.orderNumber}`,
      }
    );
    if (!result.ok && result.error) setError(result.error);
  };

  return (
    <DeskCard title="Delivery">
      <dl className="space-y-2 text-[12px]">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-[var(--adm-text-muted)]">Fulfilment</dt>
          <dd>
            <LightBadge tone={FULFILLMENT_TONE[order.status]}>{FULFILLMENT_LABEL[order.status]}</LightBadge>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-[var(--adm-text-muted)]">Manifest status</dt>
          <dd className="font-medium">
            {order.podStatus
              ? POD_STATUS_LABEL[order.podStatus] ?? titleCase(order.podStatus)
              : order.status === "MANIFEST_GENERATED"
                ? "Generated"
                : "Not generated"}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-[var(--adm-text-muted)]">Qikink order ID</dt>
          <dd className="truncate font-mono text-[12px] font-medium">{order.podOrderId ?? "Not sent"}</dd>
        </div>
      </dl>

      <div className="mt-3 space-y-2 border-t border-[var(--adm-border)] pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--adm-text-muted)]">AWB / Tracking ID</p>

        {inTransit && order.trackingNumber ? (
          <div className="rounded-md border border-[var(--adm-success)]/20 bg-[var(--adm-success-bg)] px-2.5 py-2">
            <p className="flex items-center gap-1 text-[11px] font-semibold text-[var(--adm-success)]">
              <Check className="h-3.5 w-3.5" />
              {order.status === "DELIVERED" ? "Delivered" : "In transit"}
            </p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="truncate font-mono text-[12px] font-semibold text-[var(--adm-text)]">{order.trackingNumber}</span>
              <CopyButton value={order.trackingNumber} label="AWB" />
            </div>
            <a
              href={getCourierTrackingUrl(order.courier, order.trackingNumber)}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--adm-info)] hover:underline"
            >
              Track shipment
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : null}

        {canEnterAwb ? (
          <>
            <input
              value={awb}
              onChange={(event) => {
                setAwb(event.target.value.toUpperCase());
                if (error) setError(null);
              }}
              placeholder="Enter AWB / tracking ID"
              aria-label="AWB / Tracking ID"
              aria-invalid={Boolean(error)}
              className={`${LIGHT_INPUT} font-mono uppercase ${error ? "border-[var(--adm-danger)] focus:border-[var(--adm-danger)] focus:ring-[var(--adm-danger)]/15" : ""}`}
            />
            <p className="text-[11px] text-[var(--adm-text-muted)]">
              Enter the AWB printed on the courier label. Minimum 6 characters.
            </p>
            {error ? <p className="text-[11px] font-medium text-[var(--adm-danger)]">{error}</p> : null}
            <button
              type="button"
              onClick={() => void saveAwb()}
              disabled={!validAwb || pending}
              className={`${LIGHT_PRIMARY} w-full`}
            >
              {pending ? "Saving…" : goesInTransit ? "Mark as In Transit" : "Save AWB & Generate Manifest"}
            </button>
          </>
        ) : null}

        {order.status === "PENDING" || order.status === "APPROVED" ? (
          <p className="text-[11px] leading-relaxed text-[var(--adm-text-muted)]">
            AWB entry unlocks once the order is sent to printing.
          </p>
        ) : null}
        {locked ? <p className="text-[11px] font-medium text-[var(--adm-danger)]">Order cancelled — delivery is locked.</p> : null}
        {inTransit && !order.trackingNumber ? (
          <p className="text-[11px] text-[var(--adm-text-muted)]">No AWB stored on this order.</p>
        ) : null}

        {advanceTarget ? (
          <button
            type="button"
            disabled={ctl.isPending(`status:${order.id}`)}
            onClick={() =>
              void ctl.run(`status:${order.id}`, () => api.admin.setOrderStatus(order.id, advanceTarget), {
                successMessage: `${order.orderNumber} → ${FULFILLMENT_LABEL[advanceTarget]}`,
              })
            }
            className={`${LIGHT_SECONDARY} w-full`}
          >
            {ctl.isPending(`status:${order.id}`) ? "Updating…" : ADVANCE_COPY[order.status]}
          </button>
        ) : null}
      </div>
    </DeskCard>
  );
}

/* --------------------------------------------------------------- timeline */

function activityLabel(label: string): string {
  return (FULFILLMENT_LABEL as Record<string, string>)[label] ?? titleCase(label);
}

function OrderActivityTimeline({ order }: { order: ShopOrder }) {
  const events = useMemo(
    () => [...order.timeline].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()),
    [order.timeline]
  );

  return (
    <section className="rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface)]">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-2">
            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--adm-text-muted)] transition-transform group-open:rotate-90" />
            <span className="text-[13px] font-semibold">Order activity</span>
            <span className="text-[12px] text-[var(--adm-text-muted)]">{events.length} events</span>
          </span>
          <span className="text-[11px] text-[var(--adm-text-muted)] group-open:hidden">Show</span>
          <span className="hidden text-[11px] text-[var(--adm-text-muted)] group-open:inline">Hide</span>
        </summary>
        <ol className="border-t border-[var(--adm-border)] px-4 py-3">
          {events.map((event, index) => (
            <li key={`${event.label}-${event.at}-${index}`} className="relative flex gap-3 pb-3 last:pb-0">
              <span className="relative flex w-2 shrink-0 justify-center">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--adm-info)]" />
                {index < events.length - 1 ? (
                  <span aria-hidden="true" className="absolute top-4 bottom-[-12px] w-px bg-[var(--adm-border)]" />
                ) : null}
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-[var(--adm-text)]">{activityLabel(event.label)}</p>
                {event.note ? <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--adm-text-muted)]">{event.note}</p> : null}
                <p className="mt-0.5 text-[11px] tabular-nums text-[var(--adm-text-muted)]">{dateTimeLabel(event.at)}</p>
              </div>
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}
