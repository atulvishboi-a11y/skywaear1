"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Clock3, Receipt, Home, Loader2, Sparkles, ShieldCheck, Truck } from "lucide-react";
import confetti from "canvas-confetti";
import { api } from "@/lib/client";
import type { OwnPayVerifyInput } from "@/lib/contracts";
import { errorMessage, type ShopOrder } from "@/lib/domain";

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get("orderNumber") || searchParams.get("ref") || "";
  const contact = searchParams.get("contact") || "";
  const paymentId = searchParams.get("ownpay_payment_id") || searchParams.get("id") || "";

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function finalize() {
      try {
        let stored: OwnPayVerifyInput | null = null;
        try {
          const raw = sessionStorage.getItem("zenin_ownpay_checkout");
          if (raw) stored = JSON.parse(raw) as OwnPayVerifyInput;
        } catch {}

        if (stored) {
          const result = await api.verifyOwnPayPayment({
            ...stored,
            ownpayPaymentId: paymentId || `op_${Date.now()}`,
            ownpayReference: orderNumber || `ref_${Date.now()}`,
          });
          sessionStorage.removeItem("zenin_ownpay_checkout");
          try {
            localStorage.removeItem("zenin_cart");
          } catch {}
          if (!cancelled) setOrder(result.order);
          return;
        }

        if (!orderNumber) {
          throw new Error("This confirmation link is missing its order reference.");
        }
        const tracked = await api.track(orderNumber, contact || undefined);
        if (!cancelled) setOrder(tracked.order);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, "We could not load that order."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void finalize();
    return () => {
      cancelled = true;
    };
  }, [contact, orderNumber, paymentId]);

  const paid = order?.paymentStatus === "PAID";

  useEffect(() => {
    if (!paid) return;
    try {
      void confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#00FF66", "#00F0FF", "#16181D", "#FFFFFF"],
      });
    } catch {}
  }, [paid]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0C10] text-[#F5F5F7] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00FF66]" />
          <p className="font-mono text-sm uppercase tracking-wider text-neutral-400">
            Loading order details…
          </p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#0B0C10] text-[#F5F5F7] font-mono flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-[#16181D] border border-[#282C34] p-8 shadow-2xl text-center space-y-4">
          <h1 className="text-xl font-bold uppercase tracking-tight text-white">Order not found</h1>
          <p className="text-xs text-[#8E929B] leading-relaxed">{error ?? "We could not load that order."}</p>
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <Link
              href="/app/account/orders"
              className="w-full sm:flex-1 h-12 bg-[#00FF66] text-[#0B0C10] font-bold uppercase text-xs flex items-center justify-center gap-2 hover:bg-[#00dd55] transition-colors"
            >
              <Receipt className="w-4 h-4" />
              My Orders
            </Link>
            <Link
              href="/shop"
              className="h-12 border border-[#282C34] bg-[#0B0C10] px-5 text-xs font-bold uppercase text-[#8E929B] hover:text-white flex items-center justify-center gap-1.5 transition-colors"
            >
              <Home className="w-4 h-4" />
              Shop
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const awaitingUtr = order.paymentMethod === "MANUAL_UPI" && !paid;
  const isCod = order.paymentMethod === "COD";

  const statusLabel = paid
    ? "Payment confirmed"
    : isCod
      ? "Cash on delivery"
      : awaitingUtr
        ? "UTR submitted · awaiting verification"
        : "Payment pending";

  const StatusIcon = paid ? ShieldCheck : isCod ? Truck : Clock3;
  const statusTone = paid
    ? "border-[#00FF66]/40 text-[#00FF66]"
    : "border-[#F5A524]/40 text-[#F5A524]";

  return (
    <div className="min-h-screen bg-[#0B0C10] text-[#F5F5F7] font-mono flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-[#16181D] border border-[#282C34] p-8 shadow-2xl relative">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-[#00FF66] text-[#0B0C10] flex items-center justify-center shadow-lg">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-1">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 bg-[#0B0C10] border text-xs font-bold uppercase ${statusTone}`}>
              <StatusIcon className="w-3.5 h-3.5" />
              {statusLabel}
            </span>
            <h1 className="text-2xl font-bold uppercase tracking-tight text-white mt-2">
              Order Placed!
            </h1>
            <p className="text-xs text-[#8E929B]">
              {paid
                ? "Thank you for supporting sovereign streetwear apparel."
                : isCod
                  ? "Pay in cash or UPI when your parcel arrives."
                  : "We will confirm your payment and start printing once verified."}
            </p>
          </div>

          <div className="bg-[#0B0C10] border border-[#282C34] p-4 text-left space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-[#8E929B]">Order Reference:</span>
              <span className="font-bold text-white uppercase">{order.orderNumber}</span>
            </div>
            {paymentId && (
              <div className="flex justify-between">
                <span className="text-[#8E929B]">Transaction ID:</span>
                <span className="text-[#00F0FF]">{paymentId}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[#8E929B]">Payment Status:</span>
              <span className={`font-bold ${paid ? "text-[#00FF66]" : "text-[#F5A524]"}`}>
                {order.paymentStatus.replace(/_/g, " ")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8E929B]">Payable Total:</span>
              <span className="font-bold text-white">₹{order.total.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between border-t border-[#282C34] pt-2">
              <span className="text-[#8E929B] flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#00FF66]" />
                {paid ? "Sky Cash Credited:" : "Sky Cash on Payment:"}
              </span>
              <span className="font-bold text-[#00FF66]">
                +{order.cashbackCoins.toLocaleString("en-IN")} Sky Cash
              </span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <Link
              href="/app/account/orders"
              className="w-full sm:flex-1 h-12 bg-[#00FF66] text-[#0B0C10] font-bold uppercase text-xs flex items-center justify-center gap-2 hover:bg-[#00dd55] transition-colors"
            >
              <Receipt className="w-4 h-4" />
              View in My Orders
            </Link>
            <Link
              href="/app/account"
              className="h-12 border border-[#282C34] bg-[#0B0C10] px-5 text-xs font-bold uppercase text-[#8E929B] hover:text-white flex items-center justify-center gap-1.5 transition-colors"
            >
              <Home className="w-4 h-4" />
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0B0C10] flex items-center justify-center text-[#00FF66] font-mono">
          Loading order status…
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
