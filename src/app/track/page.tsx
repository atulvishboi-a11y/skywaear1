"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  Package,
  Truck,
  Printer,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ArrowRight,
  ExternalLink,
  ClipboardList,
  MapPin,
  ChevronRight,
  UserCheck,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { api } from "@/lib/client";
import { copyText } from "@/lib/clipboard";
import type { TrackingResult } from "@/lib/contracts";
import {
  dateTimeLabel,
  formatRupees,
  type ShopOrder,
  getCourierTrackingUrl,
} from "@/lib/domain";
import { orderStatusLabel, stageLabel, statusStageIndex, TRACKING_STAGES } from "@/lib/tracking";

const STAGE_ICONS: React.ComponentType<{ className?: string }>[] = [
  CheckCircle2,
  Printer,
  ClipboardList,
  Truck,
  MapPin,
  Package,
];

export default function TrackPage() {
  const [orderQuery, setOrderQuery] = useState("");
  const [contact, setContact] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [copiedTracking, setCopiedTracking] = useState(false);

  // Authenticated user state
  const [currentUser, setCurrentUser] = useState<{ id: string; name?: string; phone?: string } | null>(null);
  const [userOrders, setUserOrders] = useState<ShopOrder[]>([]);
  const [isLoadingUserOrders, setIsLoadingUserOrders] = useState(true);

  useEffect(() => {
    let mounted = true;
    api
      .getMyTrackedOrders()
      .then((res) => {
        if (!mounted) return;
        if (res.customer) {
          setCurrentUser(res.customer);
          if (res.customer.phone && !contact) {
            setContact(res.customer.phone);
          }
        }
        if (res.userOrders && res.userOrders.length > 0) {
          setUserOrders(res.userOrders);
          const latestOrder = res.userOrders[0];
          setOrderQuery(latestOrder.orderNumber);
          setResult({
            order: latestOrder,
            eta: "3-5 Business Days (Air SLA 24-48h)",
            supportContact: "+91 8269858304 / support@skywear.in",
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setIsLoadingUserOrders(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSelectUserOrder = (order: ShopOrder) => {
    setOrderQuery(order.orderNumber);
    setResult({
      order,
      eta: "3-5 Business Days (Air SLA 24-48h)",
      supportContact: "+91 8269858304 / support@skywear.in",
    });
    setTimeout(() => {
      const el = document.getElementById("tracking-result-section");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleTrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderQuery.trim()) {
      setError("Please enter your Order Number (e.g. TC_65078)");
      return;
    }
    const contactToUse = contact.trim() || currentUser?.phone || "";
    if (!contactToUse) {
      setError("Please enter the mobile number or email used during checkout");
      return;
    }

    setIsPending(true);
    setError(null);
    try {
      const res = await api.track(orderQuery.trim(), contactToUse);
      setResult(res);
      setTimeout(() => {
        const el = document.getElementById("tracking-result-section");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err: any) {
      setError(err.message || "No matching order found. Please verify the order number and contact.");
      setResult(null);
    } finally {
      setIsPending(false);
    }
  };

  const currentIdx = result
    ? statusStageIndex(result.order.status, result.order.paymentStatus)
    : -1;

  return (
    <div className="min-h-screen bg-[#0A0B0E] text-[#F5F5F7] font-mono flex flex-col selection:bg-[#D9362B] selection:text-white antialiased">
      <Header />

      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10">
        {/* Banner */}
        <div className="border border-white/[0.08] bg-[#11131A] rounded-xl p-6 sm:p-10 space-y-5 shadow-2xl">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-2.5 py-1 bg-[#D9362B] text-white text-[9px] font-bold uppercase tracking-widest rounded">
              REAL-TIME LOGISTICS MANIFEST
            </span>
            <span className="text-xs text-[#8E929B] font-mono">
              BLUE DART · DELHIVERY · AMAZON ATS · EKART
            </span>
            {currentUser && (
              <span className="px-2 py-0.5 bg-[#00FF66]/10 border border-[#00FF66]/30 text-[#00FF66] text-[10px] font-bold uppercase tracking-wider rounded flex items-center gap-1.5 ml-auto">
                <UserCheck className="w-3 h-3" />
                <span>LOGGED IN ({currentUser.name || currentUser.phone})</span>
              </span>
            )}
          </div>

          <h1
            className="text-2xl sm:text-4xl font-bold uppercase tracking-tight text-white"
            style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
          >
            Track Your Skywear Order
          </h1>

          <p className="text-xs sm:text-sm text-[#8E929B] max-w-2xl leading-relaxed font-sans">
            Inspect live POD printing queues, transit manifests, courier assignments, and milestone updates.
            Orders dispatched via priority air and surface carriers.
          </p>

          <form onSubmit={handleTrackSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div>
              <label className="block text-[10px] uppercase font-bold text-[#8E929B] mb-1.5">
                Order Number
              </label>
              <input
                type="text"
                placeholder="TC_65078"
                value={orderQuery}
                onChange={(e) => setOrderQuery(e.target.value)}
                className="w-full bg-[#0A0B0E] border border-white/[0.08] rounded-md px-3.5 py-3 text-xs text-white uppercase placeholder-[#8E929B] focus:outline-none focus:border-[#D9362B]"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-[#8E929B] mb-1.5">
                Mobile or Email {currentUser && <span className="text-[#00FF66] font-normal">(Auto-filled)</span>}
              </label>
              <input
                type="text"
                placeholder={currentUser?.phone || "9876543210 or email"}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="w-full bg-[#0A0B0E] border border-white/[0.08] rounded-md px-3.5 py-3 text-xs text-white placeholder-[#8E929B] focus:outline-none focus:border-[#D9362B]"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={isPending}
                className="w-full py-3 px-4 bg-[#D9362B] hover:bg-[#B82B22] text-white text-xs font-bold uppercase tracking-widest rounded-lg transition-all active:scale-95 shadow-lg shadow-[#D9362B]/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Search className="w-4 h-4" />
                <span>{isPending ? "Tracking…" : "Track Parcel ↘"}</span>
              </button>
            </div>
          </form>

          {error && (
            <div className="border border-rose-500/30 bg-rose-500/10 rounded-lg p-3 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Logged-in User's Orders Card */}
        {currentUser && (
          <div className="border border-white/[0.08] bg-[#11131A] rounded-xl p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
              <div>
                <span className="text-[10px] text-[#00FF66] font-bold uppercase tracking-wider block">
                  AUTHENTICATED ACCOUNT ORDERS
                </span>
                <h2 className="text-lg sm:text-xl font-bold uppercase text-white font-sans mt-0.5">
                  Your Active Orders & Recent Shipments
                </h2>
              </div>
              <span className="text-xs text-[#8E929B] font-mono">
                {userOrders.length} {userOrders.length === 1 ? "Order Found" : "Orders Found"}
              </span>
            </div>

            {isLoadingUserOrders ? (
              <div className="py-8 text-center text-xs text-[#8E929B] animate-pulse">
                Loading your Skywear order history…
              </div>
            ) : userOrders.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <Package className="w-8 h-8 text-[#8E929B] mx-auto opacity-50" />
                <p className="text-xs text-[#8E929B]">No orders found for this account yet.</p>
                <Link
                  href="/category/oversized-tshirts"
                  className="inline-block mt-2 text-xs text-[#D9362B] hover:underline font-bold uppercase"
                >
                  Explore Drops & Collections →
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {userOrders.map((ord) => {
                  const trackingUrl = ord.trackingUrl || getCourierTrackingUrl(ord.courier, ord.trackingNumber);
                  const isDelivered = ord.status === "DELIVERED";
                  const isShipped =
                    ord.status === "SHIPPED" ||
                    ord.status === "LOCAL_AREA" ||
                    ord.status === "MANIFEST_GENERATED";

                  return (
                    <div
                      key={ord.id}
                      className="border border-white/[0.08] bg-[#0A0B0E] hover:border-white/20 transition-all rounded-xl p-5 sm:p-6 space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-[#11131A] border border-white/[0.08] rounded-lg text-[#D9362B]">
                            <Package className="w-4 h-4 text-[#D9362B]" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm sm:text-base font-bold text-white font-mono">
                                #{ord.orderNumber}
                              </span>
                              <span
                                className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                                  isDelivered
                                    ? "bg-[#00FF66]/10 text-[#00FF66] border border-[#00FF66]/30"
                                    : isShipped
                                    ? "bg-sky-500/10 text-sky-400 border border-sky-500/30"
                                    : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                                }`}
                              >
                                {orderStatusLabel(ord.status)}
                              </span>
                            </div>
                            <span className="text-[11px] text-[#8E929B] block mt-0.5 font-mono">
                              Placed on {dateTimeLabel(ord.placedAt)} · {ord.items.length} item(s) · {formatRupees(ord.total)}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleSelectUserOrder(ord)}
                            className="px-3.5 py-2 bg-[#D9362B] hover:bg-[#B82B22] text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all active:scale-95 flex items-center gap-1.5"
                          >
                            <span>Inspect Pipeline</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Items Preview */}
                      <div className="border-t border-white/[0.06] pt-3 text-xs text-[#A5AAB8] space-y-1 font-sans">
                        {ord.items.map((it, idx) => (
                          <div key={idx} className="flex justify-between items-center text-[11px]">
                            <span>
                              {it.quantity}x {it.title} ({it.size} / {it.color})
                            </span>
                            <span className="font-mono text-white">{formatRupees(it.price * it.quantity)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Shipment status bar */}
                      <div className="border-t border-white/[0.06] pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        {ord.trackingNumber ? (
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="flex items-center gap-1.5 text-white font-bold uppercase">
                              <Truck className="w-3.5 h-3.5 text-[#00FF66]" />
                              <span>{ord.courier || "Courier"}</span>
                            </span>
                            <span className="text-[#8E929B] font-mono">AWB: {ord.trackingNumber}</span>
                            {trackingUrl && (
                              <a
                                href={trackingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-[#D9362B] hover:text-[#ff5247] underline flex items-center gap-1 font-bold"
                              >
                                <span>Track on Courier Site</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-[#8E929B] text-[11px]">
                            <Printer className="w-3.5 h-3.5 text-amber-400" />
                            <span>Queued in POD fulfillment center · AWB will generate upon dispatch</span>
                          </div>
                        )}

                        <span className="text-[10px] text-[#8E929B] font-mono">
                          Payment: {ord.paymentStatus} ({ord.paymentMethod})
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tracking Result View */}
        {result && (
          <div
            id="tracking-result-section"
            className="border border-white/[0.08] bg-[#11131A] rounded-xl p-6 sm:p-8 space-y-8 shadow-2xl animate-in fade-in duration-200"
          >
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
              <div>
                <span className="text-[10px] text-[#D9362B] font-bold uppercase tracking-wider block">
                  DISPATCH CONFIRMATION
                </span>
                <h2 className="text-xl sm:text-2xl font-bold uppercase text-white font-sans mt-0.5">
                  Order #{result.order.orderNumber}
                </h2>
                <span className="text-xs text-[#8E929B] block mt-1 font-mono">
                  Placed on {dateTimeLabel(result.order.placedAt)}
                </span>
              </div>

              <div className="text-left sm:text-right space-y-1">
                <span className="text-[10px] text-[#8E929B] uppercase block">Total Amount</span>
                <span className="text-2xl font-bold text-white font-sans">{formatRupees(result.order.total)}</span>
                <span className="block text-[10px] text-[#00FF66] font-bold">
                  Payment: {result.order.paymentStatus} ({result.order.paymentMethod})
                </span>
              </div>
            </div>

            {/* Courier Dispatch Card */}
            {(result.order.courier || result.order.trackingNumber) && (
              <div className="border border-white/[0.08] bg-[#0A0B0E] rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 bg-[#11131A] border border-white/[0.08] rounded-lg text-[#D9362B]">
                    <Truck className="w-5 h-5 text-[#D9362B]" />
                  </div>
                  <div>
                    <span className="text-[10px] text-[#8E929B] uppercase block">Assigned Logistics Partner</span>
                    <span className="text-sm font-bold text-white uppercase">{result.order.courier || "LOGISTICS"}</span>
                    {result.order.trackingNumber && (
                      <span className="text-xs text-[#A5AAB8] block font-mono mt-0.5">
                        AWB / Waybill: {result.order.trackingNumber}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {result.order.trackingNumber && (
                    <button
                      type="button"
                      onClick={() => {
                        void copyText(String(result.order.trackingNumber)).then((copied) => {
                          if (!copied) return;
                          setCopiedTracking(true);
                          setTimeout(() => setCopiedTracking(false), 2000);
                        });
                      }}
                      className="px-3.5 py-2 bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-bold uppercase text-white rounded-lg flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                    >
                      {copiedTracking ? <Check className="w-3.5 h-3.5 text-[#00FF66]" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedTracking ? "AWB Copied" : "Copy AWB"}</span>
                    </button>
                  )}

                  {(result.order.trackingUrl || getCourierTrackingUrl(result.order.courier, result.order.trackingNumber)) && (
                    <a
                      href={result.order.trackingUrl || getCourierTrackingUrl(result.order.courier, result.order.trackingNumber)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 bg-[#D9362B] hover:bg-[#B82B22] text-xs font-bold uppercase text-white rounded-lg flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                    >
                      <span>Courier Live Tracker</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Step Pipeline */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase text-white font-sans">Live Pipeline Status</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {TRACKING_STAGES.map((stage, idx) => {
                  const Icon = STAGE_ICONS[idx];
                  const isDone = currentIdx >= idx;
                  const isCurrent = currentIdx === idx;

                  return (
                    <div
                      key={stage.key}
                      className={`p-4 rounded-xl border transition-all ${
                        isCurrent
                          ? "border-[#D9362B] bg-[#D9362B]/10 shadow-lg shadow-[#D9362B]/10"
                          : isDone
                          ? "border-[#00FF66]/30 bg-[#00FF66]/[0.04]"
                          : "border-white/[0.06] bg-[#0A0B0E] opacity-50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Icon className={`w-4 h-4 ${isCurrent ? "text-[#D9362B]" : isDone ? "text-[#00FF66]" : "text-[#8E929B]"}`} />
                        <span className="text-[9px] font-mono text-[#8E929B]">STEP 0{idx + 1}</span>
                      </div>
                      <p className="text-xs font-bold text-white uppercase">
                        {stageLabel(idx, result.order.paymentStatus)}
                      </p>
                      <p className="text-[10px] text-[#8E929B] mt-1 leading-tight">{stage.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Package Contents */}
            <div className="space-y-3 pt-4 border-t border-white/[0.08]">
              <h3 className="text-xs font-bold uppercase text-white font-sans">Package Contents</h3>
              <div className="space-y-2.5">
                {result.order.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3.5 border border-white/[0.08] bg-[#0A0B0E] rounded-lg text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#11131A] border border-white/[0.08] rounded flex items-center justify-center text-[10px] text-[#8E929B] font-bold">
                        280G
                      </div>
                      <div>
                        <p className="font-bold text-white uppercase">{item.title}</p>
                        <span className="text-[10px] text-[#8E929B]">Size: {item.size} · Color: {item.color}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-white">{formatRupees(item.price)}</span>
                      <span className="text-[10px] text-[#8E929B] block">Qty: {item.quantity}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Quick link to customer account */}
        <div className="border border-white/[0.08] bg-[#11131A] rounded-xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
          <div>
            <h3 className="text-sm font-bold uppercase text-white font-sans">Have a Skywear Account?</h3>
            <p className="text-xs text-[#8E929B] mt-1 max-w-xl font-sans">
              Sign in to your customer dashboard to inspect all previous orders, daily cashback unlock timeline, and wallet ledger without retyping tracking numbers.
            </p>
          </div>
          <Link
            href="/app/account/orders"
            className="px-5 py-3 bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] hover:border-white/30 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 self-start sm:self-auto shrink-0"
          >
            <span>Open Account Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#D9362B]" />
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
