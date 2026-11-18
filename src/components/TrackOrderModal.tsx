"use client";

import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  ClipboardList,
  Loader2,
  MapPin,
  Package,
  Printer,
  Search,
  Truck,
  X,
} from "lucide-react";
import { api } from "@/lib/client";
import type { TrackingResult } from "@/lib/contracts";
import { dateTimeLabel, formatRupees } from "@/lib/domain";
import { orderStatusLabel, stageLabel, stageTimelineEvent, statusStageIndex, TRACKING_STAGES } from "@/lib/tracking";
import { cashbackTotals } from "@/lib/vesting";
import { DEFAULT_SUPPORT, whatsappUrl, type SupportConfig } from "@/lib/support";

interface TrackOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  support?: SupportConfig;
}

const STAGE_ICONS: React.ComponentType<{ className?: string }>[] = [
  CheckCircle2,
  Printer,
  ClipboardList,
  Truck,
  MapPin,
  Package,
];

export default function TrackOrderModal({ isOpen, onClose, support }: TrackOrderModalProps) {
  const [orderQuery, setOrderQuery] = useState("");
  const [contact, setContact] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrackingResult | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    try {
      setResult(await api.track(orderQuery.trim(), contact.trim()));
    } catch (trackError) {
      setResult(null);
      setError(trackError instanceof Error ? trackError.message : "Tracking lookup failed");
    } finally {
      setIsPending(false);
    }
  };

  const order = result?.order ?? null;
  const cancelled = order?.status === "CANCELLED";
  const delivered = order?.status === "DELIVERED";

  return (
    <div className="zenin-fade fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-start justify-center p-4 sm:items-center font-mono">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Track your streetwear order"
        className="zenin-sheet relative w-full max-w-xl bg-[#0B0C10] border border-[#282C34] rounded-none shadow-2xl overflow-hidden text-[#F5F5F7] my-8 p-6 sm:p-8"
      >
        <button
          onClick={onClose}
          aria-label="Close tracker"
          className="absolute top-4 right-4 p-2 rounded-none text-[#8E929B] hover:text-white hover:bg-[#282C34]"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <span className="px-3 py-1 rounded-none text-xs font-mono font-bold bg-[#00FF66]/10 text-[#00FF66] border border-[#00FF66]/30">
            PRINT-ON-DEMAND TRACKER
          </span>
          <h3 className="text-2xl font-black text-[#F5F5F7] tracking-tight mt-2 font-mono">Track Your Streetwear Order</h3>
          <p className="text-xs text-[#8E929B] mt-1 font-mono">
            Looked up against the live order ledger — use the order number with the mobile or email you paid from.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-2 mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#8E929B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={orderQuery}
                onChange={(e) => setOrderQuery(e.target.value.toUpperCase())}
                placeholder="Order number (e.g. TC-84920)"
                className="w-full bg-[#16181D] border border-[#282C34] rounded-none pl-9 pr-4 py-2.5 text-xs text-[#F5F5F7] placeholder-[#8E929B]/60 focus:outline-none focus:border-[#00FF66] uppercase font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={isPending || !orderQuery.trim() || !contact.trim()}
              className="px-5 py-2.5 rounded-none bg-[#00FF66] hover:bg-[#00FF66]/90 disabled:opacity-50 disabled:bg-[#282C34] disabled:text-[#8E929B] text-[#0B0C10] text-xs font-black uppercase transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Track
            </button>
          </div>
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Registered mobile or email"
            className="w-full bg-[#16181D] border border-[#282C34] rounded-none px-4 py-2.5 text-xs text-[#F5F5F7] placeholder-[#8E929B]/60 focus:outline-none focus:border-[#00FF66] font-mono"
          />
        </form>

        {error && (
          <div className="flex items-start gap-2 rounded-none border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-400 font-mono mb-6">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {order && result && (
          <div className="bg-[#16181D] border border-[#282C34] rounded-none p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#282C34]">
              <div className="min-w-0">
                <span className="text-[10px] font-mono text-[#8E929B] block">ORDER</span>
                <span className="text-sm font-black text-[#F5F5F7] font-mono">{order.orderNumber}</span>
              </div>
              <div className="text-right min-w-0">
                <span className="text-[10px] font-mono text-[#8E929B] block">CARRIER</span>
                <span className="text-xs font-bold text-[#00F0FF] block truncate">
                  {order.courier ?? "Not manifested yet"}
                </span>
                {order.trackingNumber && (
                  <span className="text-[10px] font-mono text-[#8E929B]">{order.trackingNumber}</span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
              <span className="px-2 py-1 rounded-none bg-[#0B0C10] border border-[#282C34] text-[#F5F5F7]">
                {orderStatusLabel(order.status)}
              </span>
              <span className="text-[#8E929B]">
                {formatRupees(order.total)} · {order.paymentMethod} · payment {order.paymentStatus.toLowerCase()}
              </span>
              <span className="text-[#8E929B]">{cancelled ? "No further movement" : `ETA ${result.eta}`}</span>
            </div>

            <div className="space-y-4 pt-2">
              {cancelled ? (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-none bg-rose-500/15 text-rose-400 border border-rose-500/40 flex items-center justify-center shrink-0">
                    <Ban className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs font-bold text-rose-300">Cancelled</h5>
                    <p className="text-[11px] text-[#8E929B] mt-0.5 font-mono">
                      {order.timeline[order.timeline.length - 1]?.note ?? "Order cancelled before dispatch"}
                    </p>
                  </div>
                </div>
              ) : (
                TRACKING_STAGES.map((stage, idx) => {
                  const Icon = STAGE_ICONS[idx];
                  const event = stageTimelineEvent(order, stage);
                  const isCurrent = idx === statusStageIndex(order.status, order.paymentStatus);
                  return (
                    <div key={stage.key} className={`flex items-start gap-3 ${event ? "" : "opacity-45"}`}>
                      <div
                        className={`w-8 h-8 rounded-none flex items-center justify-center shrink-0 border ${
                          event
                            ? "bg-[#00FF66]/20 text-[#00FF66] border-[#00FF66]/40"
                            : isCurrent
                            ? "bg-[#D9362B]/15 text-[#D9362B] border-[#D9362B]/40"
                            : "bg-[#0B0C10] text-[#8E929B] border-[#282C34]"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h5 className={`text-xs font-bold font-mono ${event ? "text-[#F5F5F7]" : "text-[#8E929B]"}`}>
                            {stageLabel(idx, order.paymentStatus)}
                          </h5>
                          <span
                            className={`text-[10px] font-mono ${
                              event ? "text-[#8E929B]" : isCurrent ? "text-[#D9362B] font-bold" : "text-[#8E929B]/60"
                            }`}
                          >
                            {event ? dateTimeLabel(event.at) : isCurrent ? "IN PROGRESS" : "PENDING"}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#A0A5B5] mt-0.5 font-mono">{event?.note ?? stage.description}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {delivered && order.cashbackCoins > 0 && (
              <p className="text-[11px] text-[#00FF66] font-mono pt-2 border-t border-[#282C34]">
                {(() => {
                  const totals = cashbackTotals(order.cashback);
                  return totals.nextSlice
                    ? `${totals.releasedCoins} of ${order.cashbackCoins} coins unlocked · next ${totals.nextSlice.coins} on ${totals.nextSlice.dueDate}`
                    : `${order.cashbackCoins} coins fully unlocked in your Skywear wallet.`;
                })()}
              </p>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#282C34] bg-[#0B0C10] p-3 text-xs">
              <span className="text-[#8E929B]">Need quick help with order #{order.orderNumber}?</span>
              <a
                href={whatsappUrl(support ?? DEFAULT_SUPPORT, `Hi Skywear, I need help regarding my order #${order.orderNumber}`)}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-[#00FF66] text-[#0B0C10] font-bold uppercase text-[10px] tracking-wider hover:bg-white transition-colors flex items-center gap-1.5 shrink-0"
              >
                <span>Chat on WhatsApp</span>
              </a>
            </div>
          </div>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-none border border-[#282C34] bg-[#16181D] hover:bg-[#282C34] text-xs font-bold text-[#F5F5F7] transition-colors"
          >
            Close Tracker
          </button>
        </div>
      </div>
    </div>
  );
}
