"use client";

import React, { useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Package,
  RefreshCw,
  Search,
  Settings,
  X,
  Zap,
} from "lucide-react";
import { api } from "@/lib/client";
import { dateLabel } from "@/lib/domain";
import type { OrderStatus, PaymentStatus, ShopOrder } from "@/lib/domain";
import type { AdminController } from "../shared";
import { formatCount, formatMoney } from "../shared";
import {
  DeskCard,
  FULFILLMENT_LABEL,
  FULFILLMENT_TONE,
  LIGHT_INPUT,
  LIGHT_PRIMARY,
  LIGHT_SECONDARY,
  LIGHT_SELECT,
  LightBadge,
  LightEmpty,
  PAYMENT_LABEL,
  PAYMENT_TONE,
} from "./shared";

const PAGE_SIZE = 15;

type PaymentFilter = "ALL" | PaymentStatus;
type FulfillmentFilter = "ALL" | OrderStatus;
type DateFilter = "ALL" | "TODAY" | "7D" | "30D";

const PAYMENT_OPTIONS: PaymentFilter[] = ["ALL", "PAID", "PENDING", "PENDING_VERIFICATION", "REFUNDED", "REJECTED"];
const DATE_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: "ALL", label: "All time" },
  { value: "TODAY", label: "Today" },
  { value: "7D", label: "Last 7 days" },
  { value: "30D", label: "Last 30 days" },
];

function withinDateFilter(iso: string, filter: DateFilter): boolean {
  if (filter === "ALL") return true;
  const placed = new Date(iso);
  const now = new Date();
  if (filter === "TODAY") {
    return (
      placed.getFullYear() === now.getFullYear() &&
      placed.getMonth() === now.getMonth() &&
      placed.getDate() === now.getDate()
    );
  }
  const days = filter === "7D" ? 7 : 30;
  return now.getTime() - placed.getTime() <= days * 24 * 60 * 60 * 1000;
}

function itemCount(order: ShopOrder): number {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

export function OrdersListing({
  ctl,
  onOpenOrder,
}: {
  ctl: AdminController;
  onOpenOrder: (orderNumber: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [payment, setPayment] = useState<PaymentFilter>("ALL");
  const [fulfillment, setFulfillment] = useState<FulfillmentFilter>("ALL");
  const [dateFilter, setDateFilter] = useState<DateFilter>("ALL");
  const [page, setPage] = useState(1);

  const orders = ctl.snapshot.orders;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orders
      .filter((order) => {
        if (payment !== "ALL" && order.paymentStatus !== payment) return false;
        if (fulfillment !== "ALL" && order.status !== fulfillment) return false;
        if (!withinDateFilter(order.placedAt, dateFilter)) return false;
        if (!needle) return true;
        return (
          order.orderNumber.toLowerCase().includes(needle) ||
          order.customerName.toLowerCase().includes(needle) ||
          order.customerPhone.includes(needle) ||
          order.customerEmail.toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());
  }, [orders, payment, fulfillment, dateFilter, query]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const rows = visible.slice(start, start + PAGE_SIZE);
  const openCount = orders.filter((order) => order.status !== "DELIVERED" && order.status !== "CANCELLED").length;

  const resetPage = () => setPage(1);

  return (
    <div className="-m-3 min-h-[75vh] bg-[var(--adm-bg)] px-4 py-5 font-sans text-[var(--adm-text)] sm:-m-4 sm:px-6 sm:py-6">
      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">Orders</h1>
            <p className="mt-0.5 text-[12px] text-[var(--adm-text-muted)]">
              {formatCount(orders.length)} orders · {formatCount(openCount)} awaiting fulfilment
            </p>
          </div>
          <button
            type="button"
            onClick={() => void ctl.refresh()}
            disabled={ctl.isPending("refresh")}
            className={LIGHT_SECONDARY}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${ctl.isPending("refresh") ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </header>

        <DeskCard bodyClassName="">
          <div className="flex flex-col gap-2 border-b border-[var(--adm-border)] p-3 lg:flex-row lg:items-center">
            <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-[var(--adm-border)] bg-[var(--adm-surface)] px-2.5 transition-colors focus-within:border-[var(--adm-info)] focus-within:ring-2 focus-within:ring-[var(--adm-info)]/15">
              <Search className="h-3.5 w-3.5 shrink-0 text-[var(--adm-text-muted)]" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  resetPage();
                }}
                placeholder="Search order ID or customer"
                aria-label="Search order ID or customer"
                className="w-full min-w-0 bg-transparent text-[13px] text-[var(--adm-text)] outline-none placeholder:text-[var(--adm-text-muted)]"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    resetPage();
                  }}
                  aria-label="Clear search"
                  className="shrink-0 text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter by payment status"
                value={payment}
                onChange={(event) => {
                  setPayment(event.target.value as PaymentFilter);
                  resetPage();
                }}
                className={LIGHT_SELECT}
              >
                {PAYMENT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === "ALL" ? "Payment: all" : `Payment: ${PAYMENT_LABEL[option]}`}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter by fulfilment status"
                value={fulfillment}
                onChange={(event) => {
                  setFulfillment(event.target.value as FulfillmentFilter);
                  resetPage();
                }}
                className={LIGHT_SELECT}
              >
                <option value="ALL">Fulfilment: all</option>
                {ctl.snapshot.orderFlow.map((status) => (
                  <option key={status} value={status}>
                    Fulfilment: {FULFILLMENT_LABEL[status]}
                  </option>
                ))}
                <option value="CANCELLED">Fulfilment: Cancelled</option>
              </select>
              <select
                aria-label="Filter by order date"
                value={dateFilter}
                onChange={(event) => {
                  setDateFilter(event.target.value as DateFilter);
                  resetPage();
                }}
                className={LIGHT_SELECT}
              >
                {DATE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {rows.length === 0 ? (
            <LightEmpty
              icon={Package}
              title="No orders found"
              message={
                orders.length === 0
                  ? "Orders placed on the storefront will appear here."
                  : "No order matches these filters. Try clearing the search or filters."
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--adm-border)] text-[11px] uppercase tracking-wide text-[var(--adm-text-muted)]">
                    <th className="px-4 py-2.5 font-medium">Order</th>
                    <th className="hidden px-4 py-2.5 font-medium md:table-cell">Date</th>
                    <th className="px-4 py-2.5 font-medium">Customer</th>
                    <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Payment</th>
                    <th className="hidden px-4 py-2.5 font-medium md:table-cell">Fulfilment</th>
                    <th className="hidden px-4 py-2.5 text-right font-medium xl:table-cell">Items</th>
                    <th className="px-4 py-2.5 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--adm-border)]">
                  {rows.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => onOpenOrder(order.orderNumber)}
                      className="cursor-pointer transition-colors hover:bg-[var(--adm-bg)]"
                    >
                      <td className="px-4 py-3 align-top">
                        <a
                          href={`/admin/orders/${encodeURIComponent(order.orderNumber)}`}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onOpenOrder(order.orderNumber);
                          }}
                          className="font-semibold text-[var(--adm-info)] hover:underline"
                        >
                          {order.orderNumber}
                        </a>
                        <p className="mt-1 text-[11px] text-[var(--adm-text-muted)] md:hidden">{dateLabel(order.placedAt)}</p>
                      </td>
                      <td className="hidden px-4 py-3 align-top text-[var(--adm-text-muted)] md:table-cell">
                        {dateLabel(order.placedAt)}
                      </td>
                      <td className="max-w-[220px] px-4 py-3 align-top">
                        <p className="truncate font-medium">{order.customerName}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1 sm:hidden">
                          <LightBadge tone={PAYMENT_TONE[order.paymentStatus]}>{PAYMENT_LABEL[order.paymentStatus]}</LightBadge>
                          <LightBadge tone={FULFILLMENT_TONE[order.status]}>{FULFILLMENT_LABEL[order.status]}</LightBadge>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 align-top sm:table-cell">
                        <LightBadge tone={PAYMENT_TONE[order.paymentStatus]}>{PAYMENT_LABEL[order.paymentStatus]}</LightBadge>
                      </td>
                      <td className="hidden px-4 py-3 align-top md:table-cell">
                        <LightBadge tone={FULFILLMENT_TONE[order.status]}>{FULFILLMENT_LABEL[order.status]}</LightBadge>
                      </td>
                      <td className="hidden px-4 py-3 align-top text-right tabular-nums text-[var(--adm-text-muted)] xl:table-cell">
                        {formatCount(itemCount(order))}
                      </td>
                      <td className="px-4 py-3 text-right align-top font-semibold tabular-nums">
                        {formatMoney(order.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--adm-border)] px-4 py-2.5 text-[12px] text-[var(--adm-text-muted)]">
            <span>
              {visible.length === 0
                ? "0 orders"
                : `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, visible.length)} of ${formatCount(visible.length)}`}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, safePage - 1))}
                disabled={safePage <= 1}
                className={`${LIGHT_SECONDARY} h-7 px-2`}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>
              <span className="tabular-nums">
                Page {safePage} of {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage(Math.min(pageCount, safePage + 1))}
                disabled={safePage >= pageCount}
                className={`${LIGHT_SECONDARY} h-7 px-2`}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </DeskCard>

        <QikinkStrip ctl={ctl} />
      </div>
    </div>
  );
}

function QikinkStrip({ ctl }: { ctl: AdminController }) {
  const qikink = ctl.snapshot.qikink;
  const enabled = qikink?.enabled ?? false;
  const [showConfig, setShowConfig] = useState(false);
  const [sku, setSku] = useState(qikink?.masterSku || "LIMITLESS");
  const isSandbox = (qikink?.baseUrl || "").includes("sandbox");

  return (
    <DeskCard bodyClassName="px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Zap className="h-4 w-4 shrink-0 text-[var(--adm-warning)]" />
          <span className="text-[13px] font-medium">Qikink POD</span>
          <LightBadge tone={enabled ? "success" : "neutral"}>{enabled ? "Active" : "Off"}</LightBadge>
          <LightBadge tone="neutral">{isSandbox ? "Sandbox" : "Live"}</LightBadge>
          <span className="hidden truncate text-[12px] text-[var(--adm-text-muted)] sm:inline">
            Master SKU {qikink?.masterSku || "LIMITLESS"}-{"{size}"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              void ctl.run("toggle_qikink", () => api.admin.updateQikink({ enabled: !enabled }), {
                successMessage: enabled ? "Qikink POD fulfilment disabled" : "Qikink POD fulfilment enabled",
              })
            }
            disabled={ctl.isPending("toggle_qikink")}
            className={enabled ? LIGHT_SECONDARY : LIGHT_PRIMARY}
          >
            {enabled ? "Turn off" : "Turn on"}
          </button>
          <button
            type="button"
            onClick={() => setShowConfig((value) => !value)}
            className={LIGHT_SECONDARY}
            aria-expanded={showConfig}
          >
            <Settings className="h-3.5 w-3.5" />
            Configure
          </button>
        </div>
      </div>

      {showConfig ? (
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-[var(--adm-border)] pt-3">
          <label className="min-w-[200px] flex-1 text-[11px] text-[var(--adm-text-muted)]">
            Master SKU
            <input
              value={sku}
              onChange={(event) => setSku(event.target.value.toUpperCase())}
              placeholder="LIMITLESS"
              className={`${LIGHT_INPUT} mt-1`}
            />
          </label>
          <button
            type="button"
            onClick={() =>
              void ctl.run("save_master_sku", () => api.admin.updateQikink({ masterSku: sku.trim() }), {
                successMessage: `Master SKU updated to ${sku.trim()}`,
              })
            }
            disabled={ctl.isPending("save_master_sku") || !sku.trim()}
            className={LIGHT_PRIMARY}
          >
            <Check className="h-3.5 w-3.5" />
            Save
          </button>
          <p className="w-full text-[11px] text-[var(--adm-text-muted)]">
            Every drop maps to {sku.trim() || "LIMITLESS"}-{"{size}"} in Qikink. Endpoint{" "}
            {qikink?.baseUrl || "https://sandbox.qikink.com"}.
          </p>
        </div>
      ) : null}
    </DeskCard>
  );
}
