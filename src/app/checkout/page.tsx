"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { toCartLinePayload, useCart, useWishlist } from "@/lib/cart";
import { api } from "@/lib/client";
import { copyText } from "@/lib/clipboard";
import { openRazorpayCheckout } from "@/lib/razorpayCheckout";
import type { PlaceOrderInput, QuoteResult, StorefrontSnapshot } from "@/lib/contracts";
import { DELIVERY_FEE, FREE_SHIPPING_THRESHOLD, formatRupees, errorMessage, type ShopOrder, type GatewayFeeConfig } from "@/lib/domain";
import {
  ArrowLeft,
  Check,
  CreditCard,
  Loader2,
  Banknote,
  Coins,
  Zap,
  QrCode,
  Copy,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

type CheckoutSelection = "RAZORPAY" | "COD";

export default function CheckoutPage() {
  const router = useRouter();
  const cart = useCart();
  const wishlist = useWishlist();

  const [snapshot, setSnapshot] = useState<StorefrontSnapshot | null>(null);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<CheckoutSelection>("RAZORPAY");

  // Promo code state
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);

  const [orderError, setOrderError] = useState<string | null>(null);

  // Form State
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await api.storefront();
        if (mounted) {
          setSnapshot(data);
          if (data.products?.length) {
            cart.syncPrices(data.products);
          }

          // Configure initial gateway selection based on admin settings
          const rzp = Boolean(data.gateways?.razorpayEnabled);
          const cod = Boolean(data.gateways?.codEnabled);

          if (rzp) setSelectedMethod("RAZORPAY");
          else if (cod) setSelectedMethod("COD");
          else setSelectedMethod("RAZORPAY");

          if (data.customer) {
            const firstAddress = data.customer.addresses?.[0];
            setForm((prev) => ({
              ...prev,
              name: prev.name || data.customer?.name || "",
              email: prev.email || data.customer?.email || "",
              phone: prev.phone || data.customer?.phone || "",
              address: prev.address || firstAddress?.street || "",
              city: prev.city || firstAddress?.city || "",
              state: prev.state || firstAddress?.state || "",
              pincode: prev.pincode || firstAddress?.pincode || "",
            }));
          }
        }
      } catch (err) {
        console.error("Storefront fetch failed:", err);
      }
    })();
    return () => {
      mounted = false;
    };
    // cart.syncPrices is stable for the lifetime of the checkout visit; re-running the storefront fetch on every cart change would refetch the catalogue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize coupon from URL search params or sessionStorage
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const urlCoupon = searchParams.get("coupon");
      const storedCoupon = sessionStorage.getItem("zenin_applied_coupon");
      const initial = (urlCoupon || storedCoupon || "").trim().toUpperCase();
      if (initial) {
        // Coupon lives in browser storage, so it can only sync after mount; deriving it during render would break hydration.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAppliedCoupon(initial);
        setCoupon(initial);
      }
    } catch {}
  }, []);

  // Fetch Quote with coupon and payment method
  useEffect(() => {
    if (cart.items.length === 0) return;
    const pm = selectedMethod === "COD" ? "COD" : "CARD";
    const gp = "razorpay";

    api
      .quoteOrder({
        items: toCartLinePayload(cart.items),
        paymentMethod: pm,
        gatewayProvider: gp,
        couponCode: appliedCoupon || undefined,
      })
      .then((q) => {
        setQuote(q);
        if (appliedCoupon) setCouponError(null);
      })
      .catch((err) => {
        console.error("Checkout quote error:", err);
        if (appliedCoupon) {
          setCouponError(err?.message || "Invalid or expired promo code");
          setAppliedCoupon("");
          try {
            sessionStorage.removeItem("zenin_applied_coupon");
          } catch {}
        }
      });
  }, [cart.items, selectedMethod, appliedCoupon]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Full name is required";
    if (!form.phone.trim() || form.phone.replace(/\D/g, "").length < 10) {
      errs.phone = "10-digit mobile number is required";
    }
    if (!form.address.trim() || form.address.trim().length < 8) {
      errs.address = "Complete delivery address is required";
    }
    if (!form.city.trim()) errs.city = "City is required";
    if (!form.state.trim()) errs.state = "State is required";
    if (!/^[1-9]\d{5}$/.test(form.pincode.trim())) {
      errs.pincode = "Valid 6-digit Indian PIN code is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const isRazorpayEnabled = snapshot ? Boolean(snapshot.gateways?.razorpayEnabled) : true;
  const isOwnpayEnabled = snapshot ? Boolean(snapshot.gateways?.ownpayEnabled) : false;
  const isManualUpiEnabled = snapshot
    ? Boolean(snapshot.gateways?.manualUpiEnabled && snapshot.manualUpi?.enabled)
    : true;
  const isCodEnabled = snapshot ? Boolean(snapshot.gateways?.codEnabled) : true;

  const subtotal = quote?.subtotal ?? cart.localSubtotal;

  // Dynamic fee calculation for each gateway card
  const getFeeInfo = (feeCfg?: GatewayFeeConfig, defaultBadge = "0% FEES") => {
    const percent = feeCfg?.percent ?? 0;
    const flatAmount = feeCfg?.flatAmount ?? 0;
    const isFeeConfigured = Boolean(
      (feeCfg?.enabled || percent > 0 || flatAmount > 0) &&
      (percent > 0 || flatAmount > 0)
    );

    if (!isFeeConfigured) {
      return {
        badgeText: defaultBadge,
        hasFee: false,
        extraFeeAmount: 0,
        isHidden: false,
        formula: "",
        percent: 0,
        flatAmount: 0,
      };
    }

    const percentAmt = (subtotal * percent) / 100;
    const extraFeeAmount = Math.round(percentAmt + flatAmount);

    const parts: string[] = [];
    if (percent > 0) parts.push(`${percent}%`);
    if (flatAmount > 0) parts.push(`₹${flatAmount}`);
    const formula = parts.join(" + ");

    const badgeText = `+${formula} EXTRA${extraFeeAmount > 0 && subtotal > 0 ? ` (+${formatRupees(extraFeeAmount)})` : ""}`;

    return {
      badgeText,
      formula,
      hasFee: true,
      extraFeeAmount,
      isHidden: Boolean(feeCfg?.hideBreakdownOnCheckout),
      percent,
      flatAmount,
    };
  };

  const razorpayFeeInfo = getFeeInfo(snapshot?.gateways?.razorpayFee, "0% EXTRA · POPULAR");
  const ownpayFeeInfo = getFeeInfo(snapshot?.gateways?.ownpayFee, "0% FEES · SOVEREIGN");
  const manualUpiFeeInfo = getFeeInfo(snapshot?.gateways?.manualUpiFee, "0% EXTRA · SCAN QR");
  const codFeeInfo = getFeeInfo(
    snapshot?.gateways?.codFee ?? {
      enabled: true,
      percent: 18,
      flatAmount: 0,
      hideBreakdownOnCheckout: false,
      customLabel: "COD Handling Fee",
    },
    "0% EXTRA · DOORSTEP"
  );

  const successUrl = (orderNumber: string, contact: string) =>
    `/checkout/success?orderNumber=${encodeURIComponent(orderNumber)}&contact=${encodeURIComponent(
      contact.replace(/\D/g, "").slice(-10)
    )}`;

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError(null);
    if (!validate()) return;
    if (cart.items.length === 0) {
      router.push("/cart");
      return;
    }

    setLoading(true);

    try {
      const itemsPayload = toCartLinePayload(cart.items);
      const cleanPhone = form.phone.trim().replace(/\D/g, "");
      const formattedPhone = cleanPhone.length === 10 ? `+91 ${cleanPhone}` : form.phone.trim();

      const payload: PlaceOrderInput = {
        customerName: form.name.trim(),
        customerEmail: form.email.trim() || `${cleanPhone}@zenin.customer`,
        customerPhone: formattedPhone,
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        paymentMethod: selectedMethod === "COD" ? "COD" : "CARD",
        items: itemsPayload,
        couponCode: appliedCoupon || undefined,
      };

      // 1. Cash on Delivery
      if (selectedMethod === "COD") {
        const res = await api.placeOrder({ ...payload, paymentMethod: "COD" });
        cart.clear();
        try { sessionStorage.removeItem("zenin_applied_coupon"); } catch {}
        router.push(successUrl(res.order.orderNumber, cleanPhone));
        return;
      }

      // 2. Razorpay Gateway (Cards & NetBanking)
      if (selectedMethod === "RAZORPAY") {
        const session = await api.razorpaySession({
          items: itemsPayload,
          couponCode: appliedCoupon || undefined,
          paymentMethod: "CARD",
          gatewayProvider: "razorpay",
          customerName: payload.customerName,
          customerEmail: payload.customerEmail,
          customerPhone: payload.customerPhone,
        });

        const payment = await openRazorpayCheckout(session);
        const verified = await api.verifyRazorpayPayment({
          ...payload,
          paymentMethod: "CARD",
          gatewayProvider: "razorpay",
          couponCode: appliedCoupon || undefined,
          razorpayOrderId: payment.razorpay_order_id,
          razorpayPaymentId: payment.razorpay_payment_id,
          razorpaySignature: payment.razorpay_signature,
        });

        cart.clear();
        try { sessionStorage.removeItem("zenin_applied_coupon"); } catch {}
        router.push(successUrl(verified.order.orderNumber, cleanPhone));
        return;
      }

      // 3. OwnPay Sovereign Gateway
      if (selectedMethod === "OWNPAY") {
        try {
          sessionStorage.setItem("zenin_ownpay_checkout", JSON.stringify({ ...payload, couponCode: appliedCoupon || undefined, paymentMethod: "CARD" }));
        } catch {}

        const session = await api.ownpaySession({
          items: itemsPayload,
          couponCode: appliedCoupon || undefined,
          customerName: payload.customerName,
          customerEmail: payload.customerEmail,
          customerPhone: payload.customerPhone,
        });

        window.location.href = session.checkoutUrl;
        return;
      }
    } catch (err) {
      console.error("Order error:", err);
      setOrderError(errorMessage(err, "Failed to process order. Please try again."));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setLoading(false);
    }
  };

  const fieldClass =
    "w-full border bg-[#0A0B0E] px-3 py-2.5 text-sm text-white placeholder:text-[#5C6069] transition-colors focus:border-[#F5F5F7] focus:outline-none";
  const labelClass = "block text-[10px] font-bold uppercase tracking-[0.1em] text-[#8E929B]";

  const fallbackDeliveryFee = snapshot
    ? snapshot.deliveryFee <= 0
      ? 0
      : snapshot.shippingMode === "ALL_PRODUCTS"
      ? snapshot.deliveryFee
      : subtotal >= (snapshot.freeShippingThreshold ?? FREE_SHIPPING_THRESHOLD)
      ? 0
      : snapshot.deliveryFee
    : DELIVERY_FEE;

  const displayedDeliveryFee = quote?.deliveryFee ?? fallbackDeliveryFee;

  const fallbackTaxPercent =
    selectedMethod === "COD" ? 0 : Math.min(Math.max(snapshot?.rewardRules?.orderTaxPercent ?? 0, 0), 50);
  const fallbackTaxAmount =
    fallbackTaxPercent > 0
      ? Number(
          (
            Math.max(0, subtotal - (quote?.couponDiscount ?? 0)) *
            (fallbackTaxPercent / 100)
          ).toFixed(2)
        )
      : 0;
  const displayedTaxPercent = quote?.taxPercent ?? fallbackTaxPercent;
  const displayedTaxAmount = quote?.taxAmount ?? fallbackTaxAmount;

  const payableTotal =
    quote?.total ??
    subtotal +
      displayedTaxAmount +
      displayedDeliveryFee +
      (selectedMethod === "COD" && codFeeInfo.hasFee ? codFeeInfo.extraFeeAmount : 0);

  const ctaLabel = loading ? (
    <>
      <Loader2 className="h-4 w-4 animate-spin" />
      Processing…
    </>
  ) : selectedMethod === "RAZORPAY" ? (
    <>
      Pay {formatRupees(payableTotal)} securely
      <ArrowLeft className="h-4 w-4 rotate-180" />
    </>
  ) : (
    <>
      Place COD order · {formatRupees(payableTotal)}
      <Check className="h-4 w-4" />
    </>
  );

  const applyCoupon = () => {
    const code = coupon.trim().toUpperCase();
    if (!code) return;
    setCouponError(null);
    setAppliedCoupon(code);
    try {
      sessionStorage.setItem("zenin_applied_coupon", code);
    } catch {}
  };

  if (cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-[#0A0B0E] text-[#F5F5F7] flex flex-col selection:bg-[#D9362B] selection:text-white antialiased">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="w-full max-w-sm border border-[#282C34] bg-[#16181D] p-8 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8E929B]">
              Checkout
            </p>
            <p className="mt-3 text-lg font-bold uppercase tracking-tight text-white">
              Your bag is empty
            </p>
            <p className="mt-1 text-xs text-[#8E929B]">
              Add a drop to your bag before checking out.
            </p>
            <Link
              href="/shop"
              className="mt-5 inline-flex h-11 w-full items-center justify-center bg-[#D9362B] text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#B82B22] active:translate-y-px"
            >
              Explore drops
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const methodRow = (
    key: CheckoutSelection,
    icon: React.ReactNode,
    title: string,
    note: string,
    fee?: { hasFee: boolean; extraFeeAmount: number; formula: string; isHidden: boolean }
  ) => {
    const active = selectedMethod === key;
    return (
      <label
        className={`flex cursor-pointer items-start gap-3 border p-3.5 transition-colors ${
          active
            ? "border-[#F5F5F7] bg-[#F5F5F7]/[0.04]"
            : "border-[#282C34] bg-[#0A0B0E] hover:border-[#8E929B]"
        }`}
      >
        <input
          type="radio"
          name="paymentMethod"
          checked={active}
          onChange={() => setSelectedMethod(key)}
          className="sr-only"
        />
        <span
          aria-hidden
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border ${
            active ? "border-[#F5F5F7]" : "border-[#5C6069]"
          }`}
        >
          {active && <span className="h-2 w-2 bg-[#F5F5F7]" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span className="flex items-center gap-2 text-xs font-bold text-white">
              {icon}
              {title}
            </span>
            {fee?.hasFee && !fee.isHidden ? (
              <span className="shrink-0 text-[10px] font-bold text-[#8E929B] tabular-nums">
                +{formatRupees(fee.extraFeeAmount)}
              </span>
            ) : null}
          </span>
          <span className="mt-1 block text-[11px] leading-relaxed text-[#8E929B]">{note}</span>
          {fee?.hasFee && !fee.isHidden ? (
            <span className="mt-1 block text-[10px] text-[#8E929B]">
              Includes {fee.formula} gateway fee
            </span>
          ) : null}
        </span>
      </label>
    );
  };

  return (
    <div className="min-h-screen bg-[#0A0B0E] text-[#F5F5F7] flex flex-col selection:bg-[#D9362B] selection:text-white antialiased pb-24 lg:pb-0">
      <Header
        cartCount={cart.count}
        wishlistCount={wishlist.count}
        walletPoints={snapshot?.customer?.availableCoins ?? 0}
      />

      <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-10 sm:pt-8">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8E929B]">
          <Link href="/cart" className="flex items-center gap-1.5 transition-colors hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> Shopping bag
          </Link>
          <span className="text-white/20">/</span>
          <span className="text-white">
            Checkout
          </span>
        </div>

        {orderError && (
          <div className="mt-4 flex items-start justify-between gap-3 border border-[#D9362B]/40 bg-[#D9362B]/10 p-3 text-[11px] text-[#F5F5F7]">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#D9362B]" />
              <span>{orderError}</span>
            </div>
            <button
              type="button"
              onClick={() => setOrderError(null)}
              aria-label="Dismiss error"
              className="px-1 text-[11px] font-bold text-[#8E929B] transition-colors hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        <form
            onSubmit={handlePlaceOrder}
            className="mt-5 grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-10"
          >
            {/* Left: delivery + payment */}
            <div className="space-y-6 lg:col-span-7">
              <section className="border border-[#282C34] bg-[#16181D] p-5 sm:p-6">
                <div className="flex items-baseline justify-between border-b border-[#282C34] pb-3">
                  <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-white">
                    <span className="mr-2 text-[#8E929B]">01</span> Delivery address
                  </h2>
                  <Link
                    href="/account"
                    className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8E929B] transition-colors hover:text-white"
                  >
                    Saved addresses
                  </Link>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="name" className={labelClass}>Full name</label>
                    <input
                      id="name"
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className={`mt-1.5 ${fieldClass} ${errors.name ? "border-[#D9362B]" : "border-[#282C34]"}`}
                      placeholder="Rahul Sharma"
                    />
                    {errors.name && <p className="mt-1 text-[10px] text-[#D9362B]">{errors.name}</p>}
                  </div>

                  <div>
                    <label htmlFor="phone" className={labelClass}>Mobile number</label>
                    <div className="mt-1.5 flex">
                      <span className="flex items-center border border-r-0 border-[#282C34] bg-[#0A0B0E] px-3 text-xs text-[#8E929B]">
                        +91
                      </span>
                      <input
                        id="phone"
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })}
                        className={`min-w-0 flex-1 border bg-[#0A0B0E] px-3 py-2.5 text-sm tabular-nums text-white placeholder:text-[#5C6069] transition-colors focus:border-[#F5F5F7] focus:outline-none ${errors.phone ? "border-[#D9362B]" : "border-[#282C34]"}`}
                        placeholder="9876543210"
                      />
                    </div>
                    {errors.phone && <p className="mt-1 text-[10px] text-[#D9362B]">{errors.phone}</p>}
                  </div>

                  <div>
                    <label htmlFor="email" className={labelClass}>Email (optional)</label>
                    <input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className={`mt-1.5 ${fieldClass} border-[#282C34]`}
                      placeholder="rahul@example.com"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="address" className={labelClass}>Street address, house / flat no.</label>
                    <input
                      id="address"
                      type="text"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      className={`mt-1.5 ${fieldClass} ${errors.address ? "border-[#D9362B]" : "border-[#282C34]"}`}
                      placeholder="Flat 402, Skyline Residency, Linking Road"
                    />
                    {errors.address && <p className="mt-1 text-[10px] text-[#D9362B]">{errors.address}</p>}
                  </div>

                  <div>
                    <label htmlFor="pincode" className={labelClass}>PIN code</label>
                    <input
                      id="pincode"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={form.pincode}
                      onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, "") })}
                      className={`mt-1.5 ${fieldClass} tabular-nums ${errors.pincode ? "border-[#D9362B]" : "border-[#282C34]"}`}
                      placeholder="400050"
                    />
                    {errors.pincode && <p className="mt-1 text-[10px] text-[#D9362B]">{errors.pincode}</p>}
                  </div>

                  <div>
                    <label htmlFor="city" className={labelClass}>City</label>
                    <input
                      id="city"
                      type="text"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      className={`mt-1.5 ${fieldClass} ${errors.city ? "border-[#D9362B]" : "border-[#282C34]"}`}
                      placeholder="Mumbai"
                    />
                    {errors.city && <p className="mt-1 text-[10px] text-[#D9362B]">{errors.city}</p>}
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="state" className={labelClass}>State</label>
                    <input
                      id="state"
                      type="text"
                      value={form.state}
                      onChange={(e) => setForm({ ...form, state: e.target.value })}
                      className={`mt-1.5 ${fieldClass} ${errors.state ? "border-[#D9362B]" : "border-[#282C34]"}`}
                      placeholder="Maharashtra"
                    />
                    {errors.state && <p className="mt-1 text-[10px] text-[#D9362B]">{errors.state}</p>}
                  </div>
                </div>
              </section>

              <section className="border border-[#282C34] bg-[#16181D] p-5 sm:p-6">
                <div className="border-b border-[#282C34] pb-3">
                  <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-white">
                    <span className="mr-2 text-[#8E929B]">02</span> Payment method
                  </h2>
                </div>

                <div className="mt-4 space-y-2">
                  {isRazorpayEnabled &&
                    methodRow(
                      "RAZORPAY",
                      <CreditCard className="h-3.5 w-3.5 text-[#8E929B]" />,
                      "Online Payment",
                      "Credit/Debit Cards, NetBanking & Corporate Cards",
                      razorpayFeeInfo
                    )}

                                                      {isCodEnabled &&
                    methodRow(
                      "COD",
                      <Banknote className="h-3.5 w-3.5 text-[#8E929B]" />,
                      "Cash on delivery",
                      "Pay cash or UPI at your door",
                      codFeeInfo
                    )}
                </div>
              </section>
            </div>

            {/* Right: order summary */}
            <aside className="border border-[#282C34] bg-[#16181D] p-5 sm:p-6 lg:col-span-5 lg:sticky lg:top-24">
              <h2 className="border-b border-[#282C34] pb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-white">
                Order summary <span className="text-[#8E929B]">· {cart.count} item{cart.count === 1 ? "" : "s"}</span>
              </h2>

              <div className="mt-4 max-h-56 space-y-3 overflow-y-auto pr-1">
                {cart.items.map((i) => (
                  <div key={i.id} className="flex items-center gap-3 text-xs">
                    <div className="flex h-14 w-11 shrink-0 items-center justify-center border border-[#282C34] bg-[#0A0B0E] p-1">
                      {/* Product art is admin-managed and can live on any host, which next/image blocks without a domain allowlist. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={i.imageUrl || "/products/choso-front.webp"} alt={i.title} className="h-full w-full object-contain" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-white">{i.title}</p>
                      <p className="text-[10px] text-[#8E929B]">
                        Size {i.size} · Qty {i.quantity}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-bold tabular-nums text-white">
                      {formatRupees(i.price * i.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-[#282C34] pt-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Promo code"
                    value={coupon}
                    onChange={(e) => setCoupon(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyCoupon();
                      }
                    }}
                    aria-label="Promo code"
                    className="min-w-0 flex-1 border border-[#282C34] bg-[#0A0B0E] px-3 py-2 text-xs uppercase text-white placeholder:text-[#5C6069] transition-colors focus:border-[#F5F5F7] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={applyCoupon}
                    className="h-9 shrink-0 border border-[#282C34] px-4 text-[10px] font-bold uppercase tracking-[0.1em] text-white transition-colors hover:border-[#F5F5F7] hover:bg-[#F5F5F7] hover:text-[#0B0C10] active:translate-y-px"
                  >
                    Apply
                  </button>
                </div>

                {couponError && (
                  <p className="mt-2 flex items-center gap-1 text-[10px] text-[#D9362B]">
                    <AlertCircle className="h-3 w-3" /> {couponError}
                  </p>
                )}

                {appliedCoupon && (
                  <div className="mt-2 flex items-center justify-between border border-[#00FF66]/30 bg-[#00FF66]/[0.06] px-2.5 py-2 text-[10px]">
                    <span className="font-bold uppercase text-[#00FF66]">{appliedCoupon} applied</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAppliedCoupon("");
                        setCoupon("");
                        setCouponError(null);
                        try {
                          sessionStorage.removeItem("zenin_applied_coupon");
                        } catch {}
                      }}
                      className="px-1 font-bold text-[#8E929B] transition-colors hover:text-white"
                      title="Remove promo code"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-2 border-y border-[#282C34] py-4 text-xs text-[#8E929B]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold tabular-nums text-white">{formatRupees(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span className="font-bold tabular-nums text-white">
                    {displayedDeliveryFee === 0 ? (
                      <span className="text-[#00FF66]">FREE</span>
                    ) : (
                      formatRupees(displayedDeliveryFee)
                    )}
                  </span>
                </div>
                {displayedTaxAmount > 0 && (
                  <div className="flex justify-between">
                    <span>Tax (GST {displayedTaxPercent}%)</span>
                    <span className="font-bold tabular-nums text-white">
                      +{formatRupees(displayedTaxAmount)}
                    </span>
                  </div>
                )}
                {(quote?.couponDiscount ?? 0) > 0 && (
                  <div className="flex justify-between font-bold text-[#00FF66]">
                    <span>Discount ({quote?.couponLabel || appliedCoupon})</span>
                    <span className="tabular-nums">-{formatRupees(quote!.couponDiscount)}</span>
                  </div>
                )}
                {(() => {
                  const activeFeeInfo =
                    selectedMethod === "COD"
                      ? codFeeInfo
                      : selectedMethod === "RAZORPAY"
                      ? razorpayFeeInfo
                      : null;

                  const feeAmt =
                    quote?.gatewayFee !== undefined && quote.gatewayFee > 0
                      ? quote.gatewayFee
                      : activeFeeInfo?.hasFee
                      ? activeFeeInfo.extraFeeAmount
                      : 0;

                  const isHidden = quote?.gatewayFeeHidden ?? activeFeeInfo?.isHidden;
                  const feeLabel =
                    quote?.gatewayFeeLabel ||
                    (selectedMethod === "COD"
                      ? `COD handling (${codFeeInfo.formula || "18%"})`
                      : `Gateway fee (${activeFeeInfo?.formula || ""})`);

                  if (feeAmt > 0 && !isHidden) {
                    return (
                      <div className="flex justify-between">
                        <span>{feeLabel}</span>
                        <span className="font-bold tabular-nums text-white">+{formatRupees(feeAmt)}</span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              <div className="mt-4 flex items-end justify-between">
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[#8E929B]">
                    Total payable
                  </span>
                  <span className="text-[10px] text-[#8E929B]">
                    {displayedTaxAmount > 0 ? "GST added at checkout" : "Inclusive of all taxes"}
                  </span>
                </div>
                <span className="text-3xl font-bold tabular-nums tracking-tight text-white">
                  {formatRupees(payableTotal)}
                </span>
              </div>

              <p className="mt-3 flex items-center gap-1.5 text-[10px] text-[#8E929B]">
                <Zap className="h-3 w-3 text-[#00FF66]" />
                Earns +{(quote?.cashbackCoins ?? 0).toLocaleString("en-IN")} Coins back, withdrawable to UPI
              </p>

              <button
                type="submit"
                disabled={loading}
                className="mt-4 hidden h-12 w-full items-center justify-center gap-2 bg-[#D9362B] text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#B82B22] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 lg:flex"
              >
                {ctaLabel}
              </button>

              <div className="mt-3 flex items-center justify-center gap-4 text-[9px] uppercase tracking-[0.08em] text-[#8E929B]">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> Encrypted
                </span>
                <span className="h-3 w-px bg-[#282C34]" />
                <span>48h dispatch</span>
                <span className="h-3 w-px bg-[#282C34]" />
                <span>7-day size swap</span>
              </div>
            </aside>

            {/* Mobile pay bar */}
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#282C34] bg-[#0A0B0E]/95 backdrop-blur-md [body.has-bottom-nav_&]:bottom-[calc(3.5rem+env(safe-area-inset-bottom))] lg:hidden">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold leading-none tabular-nums text-white">
                    {formatRupees(payableTotal)}
                  </p>
                  <p className="mt-1 truncate text-[9px] uppercase tracking-[0.08em] text-[#8E929B]">
                    {selectedMethod === "COD" ? "Pay at doorstep" : "Secure payment"}
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-11 shrink-0 items-center gap-2 bg-[#D9362B] px-4 text-[11px] font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-[#B82B22] active:translate-y-px disabled:opacity-40"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {selectedMethod === "COD" ? "Order" : "Pay"}
                </button>
              </div>
            </div>
          </form>
      </main>

      <Footer />
    </div>
  );
}
