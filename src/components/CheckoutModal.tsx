"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { CartItem } from "../data/products";
import { api } from "@/lib/client";
import { copyText } from "@/lib/clipboard";
import { openRazorpayCheckout } from "@/lib/razorpayCheckout";
import type { CartLinePayload, PlaceOrderInput, QuoteResult, StorefrontSnapshot } from "@/lib/contracts";
import {
  ORDER_FLOW,
  formatRupees,
  type PaymentMethod,
  type ShopOrder,
} from "@/lib/domain";
import { cashbackTotals } from "@/lib/vesting";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  CreditCard,
  Globe,
  Loader2,
  MapPin,
  Minus,
  Plus,
  Printer,
  QrCode,
  Receipt,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  User,
  X,
  Copy,
  RotateCcw,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  UploadCloud,
  Camera,
} from "lucide-react";

type CheckoutStep = "shipping" | "payment" | "review" | "success";
type CheckoutPaymentMethod = Extract<PaymentMethod, "CARD" | "COD" | "NETBANKING">;
type ShippingField = "name" | "email" | "phone" | "address" | "city" | "state" | "pincode";
type ShippingErrors = Partial<Record<ShippingField, string>>;

interface ShippingForm {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  snapshot: StorefrontSnapshot | null;
  quote: QuoteResult | null;
  coupon: string;
  initialReferralCode?: string;
  onPlaced: (order: ShopOrder) => void;
  onUpdateQuantity?: (id: string, delta: number) => void;
  onRemoveItem?: (id: string) => void;
}

const EMPTY_FORM: ShippingForm = {
  name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
};

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/;
const PINCODE_PATTERN = /^[1-9]\d{5}$/;
const MOBILE_PATTERN = /^(\+91[\s-]?)?[6-9]\d{9}$/;

const PAYMENT_OPTIONS: {
  method: CheckoutPaymentMethod;
  label: string;
  hint: string;
  icon: React.ReactNode;
}[] = [
  {
    method: "CARD",
    label: "Credit / Debit Card",
    hint: "Visa, MasterCard, RuPay",
    icon: <CreditCard className="h-5 w-5" />,
  },
  {
    method: "NETBANKING",
    label: "Netbanking",
    hint: "All major Indian banks",
    icon: <Globe className="h-5 w-5" />,
  },
  {
    method: "COD",
    label: "Cash on Delivery",
    hint: "Pay the courier at your doorstep",
    icon: <Banknote className="h-5 w-5" />,
  },
];

const STEP_LABELS: { step: CheckoutStep; label: string }[] = [
  { step: "shipping", label: "Address" },
  { step: "payment", label: "Coins & Payment" },
  { step: "review", label: "Review" },
];

function validateShipping(form: ShippingForm): ShippingErrors {
  const errors: ShippingErrors = {};
  if (form.name.trim().length < 2) errors.name = "Enter the full name on the parcel";
  if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = "Enter a valid email address";
  if (!MOBILE_PATTERN.test(form.phone.replace(/\s/g, ""))) errors.phone = "Enter a 10-digit Indian mobile number";
  if (form.address.trim().length < 8) errors.address = "Address looks too short — add flat, street and landmark";
  if (form.city.trim().length < 2) errors.city = "Enter your city";
  if (form.state.trim().length < 2) errors.state = "Enter your state";
  if (!PINCODE_PATTERN.test(form.pincode.trim())) errors.pincode = "PIN code must be 6 digits";
  return errors;
}

function toCartLine(item: CartItem): CartLinePayload {
  return {
    productId: item.productId,
    title: item.title,
    price: item.price,
    quantity: item.quantity,
    size: item.size,
    colorName: item.colorName,
    graphicSvgType: item.graphicSvgType,
  };
}

export default function CheckoutModal({
  isOpen,
  onClose,
  items,
  snapshot,
  quote,
  coupon,
  initialReferralCode,
  onPlaced,
  onUpdateQuantity,
  onRemoveItem,
}: CheckoutModalProps) {
  const [step, setStep] = useState<CheckoutStep>("shipping");
  const [showItemList, setShowItemList] = useState(false);
  const [form, setForm] = useState<ShippingForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<ShippingErrors>({});
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>("CARD");
  const [gatewayProvider, setGatewayProvider] = useState<"razorpay" | "ownpay">("razorpay");
  const [referralCode, setReferralCode] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<ShopOrder | null>(null);
  const prefilledFor = useRef<string | null>(null);

  const customer = snapshot?.customer ?? null;

  const isRazorpayEnabled = snapshot ? Boolean(snapshot.gateways?.razorpayEnabled) : true;
  const isOwnpayEnabled = snapshot ? Boolean(snapshot.gateways?.ownpayEnabled) : false;
  const isCodEnabled = snapshot ? Boolean(snapshot.gateways?.codEnabled) : true;
  const anyOnlineGateway = isRazorpayEnabled || isOwnpayEnabled;
  const activeGatewaysCount = [isRazorpayEnabled, isOwnpayEnabled].filter(Boolean).length;

  useEffect(() => {
    if (paymentMethod === "COD" && !isCodEnabled) {
      if (anyOnlineGateway) {
        setPaymentMethod("CARD");
      }
    }
    if (gatewayProvider === "razorpay" && !isRazorpayEnabled) {
      if (isOwnpayEnabled) setGatewayProvider("ownpay");
    } else if (gatewayProvider === "ownpay" && !isOwnpayEnabled) {
      if (isRazorpayEnabled) setGatewayProvider("razorpay");
    }
  }, [gatewayProvider, isRazorpayEnabled, isOwnpayEnabled, isCodEnabled, paymentMethod, anyOnlineGateway]);

  useEffect(() => {
    if (isOpen && items.length > 1) {
      setShowItemList(true);
    }
  }, [isOpen, items.length]);

  useEffect(() => {
    if (isOpen && items.length === 0 && step !== "success") {
      onClose();
    }
  }, [isOpen, items.length, onClose, step]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isPending) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose, isPending]);

  useEffect(() => {
    if (!isOpen) {
      if (step === "success") {
        setStep("shipping");
        setPlacedOrder(null);
        setServerError(null);
        setErrors({});
      }
      return;
    }
    const key = customer?.id ?? "guest";
    if (prefilledFor.current === key) return;
    prefilledFor.current = key;
    const address = customer?.addresses.find((a) => a.isDefault) ?? customer?.addresses[0];
    setForm({
      name: customer?.name ?? "",
      email: customer?.email ?? "",
      phone: customer?.phone ?? "",
      address: address?.street ?? "",
      city: address?.city ?? "",
      state: address?.state ?? "",
      pincode: address?.pincode ?? "",
    });
  }, [isOpen, customer, step]);

  useEffect(() => {
    if (!isOpen || !initialReferralCode) return;
    setReferralCode((prev) => prev || initialReferralCode.toUpperCase());
  }, [isOpen, initialReferralCode]);

  const updateField = (field: ShippingField) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const goToPayment = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validateShipping(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setServerError(null);
    setStep("payment");
  };

  const goToReview = () => {
    const nextErrors = validateShipping(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStep("shipping");
      return;
    }
    setServerError(null);
    setStep("review");
  };

  const submitOrder = async () => {
    const nextErrors = validateShipping(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStep("shipping");
      return;
    }
    if (items.length === 0) {
      setServerError("Your cart is empty — add a tee before ordering");
      return;
    }
    if (paymentMethod === "COD" && quote && !quote.codAvailable) {
      setPaymentMethod("CARD");
      setServerError(`${quote.codBlockedTitles.join(", ")} is prepaid only — pick Card or Netbanking to place this order`);
      return;
    }

    const input: PlaceOrderInput = {
      items: items.map(toCartLine),
      customerName: form.name.trim(),
      customerEmail: form.email.trim(),
      customerPhone: form.phone.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      pincode: form.pincode.trim(),
      paymentMethod,
      couponCode: coupon || undefined,
      referralCode: referralCode.trim() || undefined,
    };

    setServerError(null);
    setIsPending(true);
    try {
      let result;
      if (paymentMethod === "COD") {
        result = await api.placeOrder(input);
      } else if (gatewayProvider === "ownpay") {
        const session = await api.ownpaySession({
          items: input.items,
          couponCode: input.couponCode,
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          customerPhone: input.customerPhone,
        });

        try {
          sessionStorage.setItem("zenin_ownpay_checkout", JSON.stringify(input));
        } catch {}

        window.location.href = session.checkoutUrl;
        return;
      } else {
        const session = await api.razorpaySession({
          items: input.items,
          couponCode: input.couponCode,
          paymentMethod: paymentMethod === "NETBANKING" ? "NETBANKING" : "CARD",
          gatewayProvider: "razorpay",
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          customerPhone: input.customerPhone,
        });
        const payment = await openRazorpayCheckout(session);
        result = await api.verifyRazorpayPayment({
          ...input,
          paymentMethod: paymentMethod === "NETBANKING" ? "NETBANKING" : "CARD",
          gatewayProvider: "razorpay",
          razorpayOrderId: payment.razorpay_order_id,
          razorpayPaymentId: payment.razorpay_payment_id,
          razorpaySignature: payment.razorpay_signature,
        });
      }
      setPlacedOrder(result.order);
      setStep("success");
      onPlaced(result.order);
      void confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#fbbf24", "#10b981", "#121212", "#e1e1e1"],
      });
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Order could not be placed. Please retry.");
    } finally {
      setIsPending(false);
    }
  };

  if (!isOpen) return null;

  const shippingIncomplete = Object.keys(errors).length > 0;
  const stepIndex = STEP_LABELS.findIndex((entry) => entry.step === step);
  const payLabel =
    paymentMethod === "COD"
      ? "Place COD Order"
      : gatewayProvider === "ownpay"
        ? `Pay ${quote ? formatRupees(quote.total) : "total"} via OwnPay`
        : `Pay ${quote ? formatRupees(quote.total) : "total"} via Razorpay`;

  const field = (
    label: string,
    name: ShippingField,
    placeholder: string,
    inputProps: React.InputHTMLAttributes<HTMLInputElement> = {}
  ) => (
    <div className="min-w-0 font-mono">
      <label htmlFor={`checkout-${name}`} className="mb-1 block font-mono text-[11px] font-bold uppercase text-[#8E929B]">
        {label}
      </label>
      <input
        id={`checkout-${name}`}
        name={name}
        placeholder={placeholder}
        value={form[name]}
        onChange={updateField(name)}
        aria-invalid={errors[name] ? true : undefined}
        className={`h-11 w-full rounded-none border bg-[#16181D] px-3.5 font-mono text-xs text-white placeholder-neutral-500 focus:outline-none ${
          errors[name] ? "border-rose-500 focus:border-rose-600" : "border-[#282C34] focus:border-[#00FF66]"
        }`}
        {...inputProps}
      />
      {errors[name] && <p className="mt-1 font-mono text-[11px] font-bold text-rose-400">{errors[name]}</p>}
    </div>
  );

  const summaryRow = (label: React.ReactNode, value: React.ReactNode, tone = "") => (
    <div className={`flex items-center justify-between gap-2 ${tone}`}>
      <span className="min-w-0 truncate">{label}</span>
      <span className="shrink-0">{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/85 p-3 backdrop-blur-md font-mono sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
        className="my-auto w-full max-w-2xl overflow-hidden rounded-none border border-[#282C34] bg-[#0B0C10] text-[#F5F5F7] shadow-2xl font-mono"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[#282C34] bg-[#16181D] p-5">
          <div className="min-w-0">
            <h3
              id="checkout-title"
              className="truncate text-base font-black uppercase tracking-wider text-white font-sans"
              style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
            >
              {step === "shipping" && "Shipping & Delivery Address"}
              {step === "payment" && "Coins & Payment"}
              {step === "review" && "Review & Pay"}
              {step === "success" && "Order Confirmed"}
            </h3>
            <p className="mt-0.5 font-mono text-xs text-[#8E929B]">
              {step === "success"
                ? "Your print-on-demand order is queued at the POD facility"
                : `Step ${stepIndex + 1} of 3 — ${STEP_LABELS[stepIndex]?.label ?? ""}`}
            </p>
          </div>
          {step !== "success" && (
            <button
              onClick={onClose}
              disabled={isPending}
              aria-label="Close checkout"
              className="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-none text-neutral-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </header>

        {step !== "success" && (
          <ol className="flex items-center gap-2 border-b border-[#282C34] bg-[#16181D]/60 px-5 py-3 text-[10px] uppercase tracking-wider font-mono">
            {STEP_LABELS.map((entry, index) => {
              const done = index < stepIndex;
              const active = index === stepIndex;
              return (
                <li key={entry.step} className="flex min-w-0 flex-1 items-center gap-2">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-none text-[10px] font-bold ${
                      done ? "bg-[#00FF66] text-[#0B0C10]" : active ? "bg-[#F5F5F7] text-[#0B0C10]" : "bg-[#0B0C10] border border-[#282C34] text-neutral-500"
                    }`}
                  >
                    {done ? <Check className="h-3 w-3" /> : index + 1}
                  </span>
                  <span className={`truncate ${active ? "font-bold text-white" : "text-[#8E929B]"}`}>{entry.label}</span>
                </li>
              );
            })}
          </ol>
        )}

        {serverError && step !== "success" && (
          <p
            role="alert"
            className="border-b border-rose-500/30 bg-[#16181D] px-5 py-3 font-mono text-[11px] font-bold text-rose-400"
          >
            {serverError}
          </p>
        )}

        {step === "shipping" && (
          <form noValidate onSubmit={goToPayment} className="space-y-4 p-5 sm:p-6 font-mono">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {field("Full name *", "name", "Aman Sharma", { autoComplete: "name", required: true })}
              {field("Phone number *", "phone", "9876543210", {
                type: "tel",
                inputMode: "tel",
                autoComplete: "tel",
                maxLength: 14,
                required: true,
              })}
            </div>

            {field("Email address *", "email", "you@example.com", {
              type: "email",
              inputMode: "email",
              autoComplete: "email",
              required: true,
            })}

            {field("Delivery address *", "address", "House / Flat No., Street, Landmark", {
              autoComplete: "street-address",
              required: true,
            })}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {field("City *", "city", "Mumbai", { autoComplete: "address-level2", required: true })}
              {field("State *", "state", "Maharashtra", { autoComplete: "address-level1", required: true })}
              {field("PIN code *", "pincode", "400050", {
                inputMode: "numeric",
                autoComplete: "postal-code",
                maxLength: 6,
                required: true,
              })}
            </div>

            <div className="flex items-start gap-2 rounded-none border border-[#282C34] bg-[#16181D] p-3 font-mono text-[11px] text-[#8E929B]">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#00FF66]" />
              <span>
                We ship across India from our Tirupur POD unit. Deliveries take 4-7 working days after print
                approval.
              </span>
            </div>

            {/* Order Items Breakdown & Quick Edit */}
            <div className="overflow-hidden rounded-none border border-[#282C34] bg-[#16181D]">
              <div
                role="button"
                tabIndex={0}
                onClick={() => setShowItemList((v) => !v)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setShowItemList((v) => !v);
                  }
                }}
                className="flex cursor-pointer items-center justify-between gap-3 p-4 transition-colors hover:bg-[#0B0C10]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold uppercase text-white">
                      {items.reduce((sum, item) => sum + item.quantity, 0)} Item{items.length === 1 ? "" : "s"} in Order
                    </span>
                    <span className="rounded-none bg-[#0B0C10] border border-[#282C34] px-2 py-0.5 font-mono text-[11px] font-bold text-[#00FF66]">
                      {showItemList ? "Hide Details" : "Edit / View"}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-[#8E929B]">
                    {showItemList ? "Click to collapse" : "Click to adjust quantity or remove items"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-sm font-bold text-white">
                    {quote ? formatRupees(quote.total) : "Calculating…"}
                  </span>
                  {showItemList ? (
                    <ChevronUp className="h-4 w-4 text-neutral-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-neutral-400" />
                  )}
                </div>
              </div>

              {/* Collapsible item list with quantity & remove controls */}
              {showItemList && (
                <div className="max-h-60 space-y-2 overflow-y-auto border-t border-[#282C34] bg-[#0B0C10] p-3 font-mono">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-none border border-[#282C34] bg-[#16181D] p-2.5 transition-all"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-xs font-bold text-white">{item.title}</p>
                        <p className="font-mono text-[11px] text-[#8E929B]">
                          Size: <span className="font-bold text-white">{item.size}</span>
                          {" • "}Color: <span className="font-bold text-white">{item.colorName}</span>
                        </p>
                        <p className="mt-0.5 font-mono text-xs font-bold text-[#00FF66]">
                          {formatRupees(item.price * item.quantity)}
                          {item.quantity > 1 && (
                            <span className="ml-1 font-mono text-[10px] font-normal text-[#8E929B]">
                              ({formatRupees(item.price)} each)
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center overflow-hidden rounded-none border border-[#282C34] bg-[#0B0C10]">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (item.quantity <= 1) {
                                onRemoveItem?.(item.id);
                              } else {
                                onUpdateQuantity?.(item.id, -1);
                              }
                            }}
                            className="flex h-7 w-7 items-center justify-center font-mono text-xs text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
                            title={item.quantity <= 1 ? "Remove item" : "Decrease quantity"}
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-7 text-center font-mono text-xs font-bold text-white">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            disabled={item.quantity >= 10}
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateQuantity?.(item.id, 1);
                            }}
                            className="flex h-7 w-7 items-center justify-center font-mono text-xs text-neutral-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
                            title="Increase quantity"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveItem?.(item.id);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-none border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Remove product"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="h-11 rounded-none border border-[#282C34] bg-[#16181D] px-5 text-xs font-bold text-neutral-400 uppercase transition-colors hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-none bg-[#00FF66] px-6 text-xs font-black uppercase tracking-wide text-[#0B0C10] transition-all hover:bg-[#00FF66]/90 sm:flex-none"
                style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
              >
                <span>Continue to Payment</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        )}

        {step === "payment" && (
          <div className="space-y-4 p-5 sm:p-6 font-mono">
            {paymentMethod !== "COD" && activeGatewaysCount > 1 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#8E929B]">
                    Payment Gateway Network
                  </span>
                  <span className="font-mono text-[10px] text-[#00FF66] font-bold uppercase">
                    {activeGatewaysCount} {activeGatewaysCount === 1 ? "Gateway Active" : "Gateways Available"}
                  </span>
                </div>
                <div className={`grid grid-cols-1 gap-2.5 ${activeGatewaysCount === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
                  {isRazorpayEnabled && (
                    <button
                      type="button"
                      onClick={() => {
                        setGatewayProvider("razorpay");
                      }}
                      className={`flex items-center gap-2.5 p-3 rounded-none border text-left transition-all ${
                        gatewayProvider === "razorpay"
                          ? "border-[#00FF66] bg-[#0B0C10]"
                          : "border-[#282C34] bg-[#16181D] hover:border-neutral-500"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-none border flex items-center justify-center shrink-0 ${
                          gatewayProvider === "razorpay"
                            ? "border-[#00FF66] bg-[#00FF66]"
                            : "border-[#8E929B]"
                        }`}
                      >
                        {gatewayProvider === "razorpay" && (
                          <div className="w-1.5 h-1.5 bg-[#0B0C10]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-mono text-xs font-bold text-white uppercase flex items-center gap-1">
                          Razorpay
                          <span className="text-[9px] px-1 py-0.5 bg-[#00FF66]/20 text-[#00FF66] font-mono">
                            Modal
                          </span>
                        </div>
                        <div className="font-mono text-[10px] text-[#8E929B] truncate">
                          Cards &amp; Netbanking
                        </div>
                      </div>
                    </button>
                  )}

                  {isOwnpayEnabled && (
                    <button
                      type="button"
                      onClick={() => {
                        setGatewayProvider("ownpay");
                      }}
                      className={`flex items-center gap-2.5 p-3 rounded-none border text-left transition-all ${
                        gatewayProvider === "ownpay"
                          ? "border-[#00F0FF] bg-[#0B0C10]"
                          : "border-[#282C34] bg-[#16181D] hover:border-neutral-500"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-none border flex items-center justify-center shrink-0 ${
                          gatewayProvider === "ownpay"
                            ? "border-[#00F0FF] bg-[#00F0FF]"
                            : "border-[#8E929B]"
                        }`}
                      >
                        {gatewayProvider === "ownpay" && (
                          <div className="w-1.5 h-1.5 bg-[#0B0C10]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-mono text-xs font-bold text-white uppercase flex items-center gap-1">
                          OwnPay
                          <span className="text-[9px] px-1 py-0.5 bg-[#00F0FF]/20 text-[#00F0FF] font-mono">
                            Direct
                          </span>
                        </div>
                        <div className="font-mono text-[10px] text-[#8E929B] truncate">
                          Sovereign Gateway
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            )}

            <fieldset className="space-y-2.5">
              <legend className="mb-1 font-mono text-[11px] font-bold uppercase tracking-wider text-[#8E929B]">
                Payment method
              </legend>
              <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {PAYMENT_OPTIONS.filter((opt) => {
                  if (opt.method === "CARD" || opt.method === "NETBANKING") return isRazorpayEnabled || isOwnpayEnabled;
                  if (opt.method === "COD") return isCodEnabled;
                  return true;
                }).map((option) => {
                  const active = paymentMethod === option.method;
                  const blocked = option.method === "COD" && quote !== null && !quote.codAvailable;
                  const hint = blocked
                    ? `Prepaid only: ${(quote?.codBlockedTitles ?? []).join(", ")}`
                    : option.hint;
                  return (
                    <button
                      key={option.method}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={blocked}
                      title={blocked ? "This drop is prepaid only — pay online to order" : undefined}
                      onClick={() => {
                        if (blocked) return;
                        setPaymentMethod(option.method);
                        setServerError(null);
                      }}
                      className={`flex min-h-11 items-center gap-3 rounded-none border p-3.5 text-left transition-all ${
                        blocked
                          ? "cursor-not-allowed border-[#282C34] bg-[#0B0C10] opacity-50"
                          : active
                            ? "border-[#00FF66] bg-[#0B0C10]"
                            : "border-[#282C34] bg-[#16181D] hover:border-neutral-400"
                      }`}
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-none ${
                          active ? "bg-[#00FF66] text-[#0B0C10]" : "bg-[#0B0C10] border border-[#282C34] text-white"
                        }`}
                      >
                        {option.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-xs font-bold uppercase text-white">
                          {option.label}
                        </span>
                        <span className="mt-0.5 block truncate font-mono text-[11px] text-[#8E929B]">
                          {hint}
                        </span>
                      </span>
                      {active && <Check className="h-4 w-4 shrink-0 text-[#00FF66]" />}
                    </button>
                  );
                })}
              </div>
              
              {/* Trust & Psychological Security Badges */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#282C34] text-[10px] text-[#8E929B] font-mono text-center">
                <div className="p-2 bg-[#16181D] border border-[#282C34] flex flex-col items-center justify-center gap-1">
                  <ShieldCheck className="h-4 w-4 text-[#00FF66]" />
                  <span className="font-bold text-white uppercase">256-Bit SSL</span>
                  <span className="text-[9px]">Encrypted & Safe</span>
                </div>
                <div className="p-2 bg-[#16181D] border border-[#282C34] flex flex-col items-center justify-center gap-1">
                  <RotateCcw className="h-4 w-4 text-[#00F0FF]" />
                  <span className="font-bold text-white uppercase">7-Day Swap</span>
                  <span className="text-[9px]">Hassle-free fit</span>
                </div>
                <div className="p-2 bg-[#16181D] border border-[#282C34] flex flex-col items-center justify-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-[#00FF66]" />
                  <span className="font-bold text-white uppercase">Verified Drop</span>
                  <span className="text-[9px]">240 GSM Terry</span>
                </div>
              </div>
            </fieldset>

            {paymentMethod === "COD" && (
              <p className="flex items-start gap-2 rounded-none border border-amber-500/40 bg-[#16181D] p-3 font-mono text-[11px] text-amber-300">
                <Banknote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                <span>
                  {quote ? formatRupees(quote.total) : "The order total"} is collected by the courier on delivery.
                  Your daily cashback schedule unlocks across 30 days starting on Day 1 once payment is collected.
                </span>
              </p>
            )}

            <div className="space-y-1.5 rounded-none border border-[#282C34] bg-[#16181D] p-4 font-mono text-xs text-[#8E929B]">
              {quote === null ? (
                <div className="space-y-2">
                  <div className="h-4 w-full animate-pulse rounded-none bg-[#0B0C10]" />
                  <div className="h-4 w-2/3 animate-pulse rounded-none bg-[#0B0C10]" />
                </div>
              ) : (
                <>
                  {summaryRow(`Subtotal (${items.reduce((sum, i) => sum + i.quantity, 0)} items)`, formatRupees(quote.subtotal), "text-white")}
                  {summaryRow(
                    "Delivery",
                    quote.deliveryFee === 0 ? (
                      <strong className="uppercase text-[#00FF66]">FREE</strong>
                    ) : (
                      formatRupees(quote.deliveryFee)
                    )
                  )}
                  {summaryRow(
                    <span className="font-black text-white">Total Payable</span>,
                    <span className="text-base font-black text-white">{formatRupees(quote.total)}</span>,
                    "border-t border-[#282C34] pt-2 text-sm font-black text-white"
                  )}
                  {summaryRow(
                    <span className="flex items-center gap-1.5 font-mono text-[11px]">
                      <Sparkles className="h-3.5 w-3.5 text-[#00FF66]" />
                      Coins earned on this order
                    </span>,
                    <span className="font-mono text-[11px] font-bold text-[#00FF66]">+{quote.cashbackCoins}</span>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-col-reverse items-stretch gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => setStep("shipping")}
                className="flex h-11 items-center justify-center gap-1.5 px-4 text-xs font-bold uppercase text-neutral-400 transition-colors hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Address
              </button>
              <button
                type="button"
                disabled={quote === null}
                onClick={goToReview}
                className="flex h-11 items-center justify-center gap-2 rounded-none bg-[#00FF66] px-6 text-xs font-black uppercase tracking-wider text-[#0B0C10] shadow-md transition-all hover:bg-[#00FF66]/90 disabled:opacity-60"
                style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
              >
                <span>Review Order</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4 p-5 sm:p-6 font-mono">
            <section className="rounded-none border border-[#282C34] bg-[#16181D] p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-white">
                  <User className="h-4 w-4 text-[#00FF66]" />
                  Delivering to
                </h4>
                <button
                  type="button"
                  onClick={() => setStep("shipping")}
                  className="font-mono text-[11px] font-bold text-[#00F0FF] underline hover:text-[#00FF66]"
                >
                  Edit
                </button>
              </div>
              <p className="truncate font-mono text-xs font-bold text-white">{form.name}</p>
              <p className="mt-1 font-mono text-xs text-[#8E929B]">
                {form.address}, {form.city}, {form.state} — {form.pincode}
              </p>
              <p className="mt-1 font-mono text-[11px] text-[#8E929B]">
                {form.phone} • {form.email}
              </p>
            </section>

            <section className="space-y-2.5 rounded-none border border-[#282C34] p-4 bg-[#16181D]">
              <div className="flex items-center justify-between">
                <h4 className="font-mono text-xs font-bold uppercase text-white">
                  {items.length} Item{items.length === 1 ? "" : "s"} in this order
                </h4>
                <span className="font-mono text-xs font-bold text-white">
                  {quote ? formatRupees(quote.total) : ""}
                </span>
              </div>
              <ul className="max-h-48 space-y-2 overflow-y-auto overflow-x-hidden pr-1">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-none border border-[#282C34] bg-[#0B0C10] p-2.5 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono font-bold text-white">{item.title}</p>
                      <p className="font-mono text-[11px] text-[#8E929B]">
                        {item.size} / {item.colorName} • {formatRupees(item.price * item.quantity)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="flex items-center overflow-hidden rounded-none border border-[#282C34] bg-[#16181D]">
                        <button
                          type="button"
                          onClick={() => {
                            if (item.quantity <= 1) {
                              onRemoveItem?.(item.id);
                            } else {
                              onUpdateQuantity?.(item.id, -1);
                            }
                          }}
                          className="flex h-6 w-6 items-center justify-center font-mono text-xs text-neutral-400 hover:text-white"
                          title={item.quantity <= 1 ? "Remove item" : "Decrease"}
                        >
                          <Minus className="h-2.5 w-2.5" />
                        </button>
                        <span className="w-6 text-center font-mono text-xs font-bold text-white">{item.quantity}</span>
                        <button
                          type="button"
                          disabled={item.quantity >= 10}
                          onClick={() => onUpdateQuantity?.(item.id, 1)}
                          className="flex h-6 w-6 items-center justify-center font-mono text-xs text-neutral-400 hover:text-white disabled:opacity-40"
                          title="Increase"
                        >
                          <Plus className="h-2.5 w-2.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => onRemoveItem?.(item.id)}
                        className="flex h-6 w-6 items-center justify-center rounded-none text-rose-400 hover:text-rose-300"
                        title="Remove item"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <div>
              <label htmlFor="referral-code" className="mb-1 block font-mono text-[11px] font-bold uppercase text-[#8E929B]">
                Referral code (optional)
              </label>
              <input
                id="referral-code"
                type="text"
                value={referralCode}
                onChange={(event) => setReferralCode(event.target.value.toUpperCase())}
                placeholder="SKYWARE-…"
                autoComplete="off"
                className="h-11 w-full rounded-none border border-[#282C34] bg-[#16181D] px-3 font-mono text-xs uppercase text-white placeholder-neutral-500 focus:border-[#00FF66] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5 rounded-none border border-[#282C34] bg-[#16181D] p-4 font-mono text-xs text-[#8E929B]">
              {quote === null ? (
                <div className="h-5 w-full animate-pulse rounded-none bg-[#0B0C10]" />
              ) : (
                <>
                  {summaryRow("Subtotal", formatRupees(quote.subtotal), "text-white")}
                  {summaryRow(
                    "Delivery",
                    quote.deliveryFee === 0 ? <strong className="uppercase text-[#00FF66]">FREE</strong> : formatRupees(quote.deliveryFee)
                  )}
                  {summaryRow(
                    <span className="font-black text-white">Total Payable</span>,
                    <span className="text-base font-black text-white">{formatRupees(quote.total)}</span>,
                    "border-t border-[#282C34] pt-2 text-sm font-black text-white"
                  )}
                </>
              )}
              <p className="pt-1 font-mono text-[11px] text-[#8E929B]">
                Paying with {PAYMENT_OPTIONS.find((option) => option.method === paymentMethod)?.label}.
                {paymentMethod === "COD"
                  ? " Cash handed to the courier on delivery."
                  : ` Securely processed via ${gatewayProvider === "ownpay" ? "OwnPay Sovereign Gateway" : "Razorpay"}.`}
              </p>
            </div>

            {isPending ? (
              <div className="flex items-center gap-3 rounded-none border border-[#282C34] bg-[#16181D] p-4">
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#00FF66]" />
                <div className="min-w-0">
                  <p className="font-mono text-xs font-bold uppercase text-white">
                    {paymentMethod === "COD"
                      ? "Reserving your COD slot…"
                      : gatewayProvider === "ownpay"
                        ? "Connecting to OwnPay Secure Checkout…"
                        : "Waiting for Razorpay payment…"}
                  </p>
                  <p className="font-mono text-[11px] text-[#8E929B]">
                    {gatewayProvider === "ownpay"
                      ? "Redirecting to your self-hosted OwnPay payment interface."
                      : "Connecting to Razorpay secure payment gateway. Please complete your transaction in the modal."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col-reverse items-stretch gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => setStep("payment")}
                  className="flex h-11 items-center justify-center gap-1.5 px-4 text-xs font-bold uppercase text-neutral-400 transition-colors hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Payment
                </button>
                <button
                  type="button"
                  onClick={submitOrder}
                  disabled={quote === null || shippingIncomplete}
                  className="flex h-12 items-center justify-center gap-2 rounded-none bg-[#00FF66] px-6 text-xs font-black uppercase tracking-wider text-[#0B0C10] shadow-md transition-all hover:bg-[#00FF66]/90 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
                >
                  <ShieldCheck className="h-4 w-4 text-[#0B0C10]" />
                  <span>{payLabel}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {step === "success" && placedOrder && (
          <div className="space-y-6 p-6 sm:p-8 font-mono">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-none border border-[#00FF66] bg-[#16181D] text-[#00FF66]">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-none border border-[#282C34] bg-[#16181D] px-3 py-1 font-mono text-xs font-bold text-[#00FF66]">
                <Receipt className="h-3.5 w-3.5" />
                ORDER #{placedOrder.orderNumber}
              </span>
              <h3
                className="mt-3 truncate text-2xl font-black uppercase tracking-tight text-white font-sans"
                style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
              >
                Confirmed, {placedOrder.customerName.split(" ")[0]}!
              </h3>
              <p className="mx-auto mt-1 max-w-md font-mono text-xs text-[#8E929B]">
                Sent to our {placedOrder.podProvider} print-on-demand facility. Paid{" "}
                <strong className="text-white">{formatRupees(placedOrder.total)}</strong> via{" "}
                {placedOrder.paymentMethod} • payment {placedOrder.paymentStatus.toLowerCase()}.
              </p>
            </div>

            <section className="mx-auto max-w-md rounded-none border border-[#282C34] bg-[#16181D] p-4 font-mono text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-bold text-white">
                  <Sparkles className="h-4 w-4 text-[#00FF66]" />
                  Coins earned
                </span>
                <span className="font-bold text-[#00FF66]">+{placedOrder.cashbackCoins}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#282C34] pt-2 text-[11px] text-[#8E929B]">
                <span>Unlocked instantly</span>
                <span className="font-bold text-[#00FF66]">+{cashbackTotals(placedOrder.cashback).releasedCoins}</span>
              </div>
              <p className="mt-2 border-t border-[#282C34] pt-2 font-mono text-[10px] text-[#8E929B]">
                {(() => {
                  const next = cashbackTotals(placedOrder.cashback).nextSlice;
                  return next
                    ? `Day 1 is unlocked now — the next daily slice (${next.coins.toLocaleString("en-IN")} Coins) unlocks on ${next.dueDate} across a 30-day month cycle.`
                    : "Coins unlock daily across a 30-day month cycle and can be withdrawn from your wallet.";
                })()}
              </p>
            </section>

            <section className="mx-auto max-w-md">
              <h4 className="mb-3 flex items-center gap-2 font-mono text-xs font-bold uppercase text-white">
                <Printer className="h-4 w-4 text-[#00FF66]" />
                Fulfilment pipeline
              </h4>
              <ol className="space-y-2">
                {ORDER_FLOW.map((stage) => {
                  const event = placedOrder.timeline.find((entry) => entry.label === stage);
                  const reached = Boolean(event);
                  return (
                    <li key={stage} className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-none text-[10px] ${
                          reached ? "bg-[#00FF66] text-[#0B0C10]" : "bg-[#16181D] border border-[#282C34] text-neutral-500"
                        }`}
                      >
                        {reached ? <Check className="h-3 w-3" /> : "•"}
                      </span>
                      <span className="min-w-0 flex-1 font-mono">
                        <span
                          className={`block truncate font-mono text-[11px] font-bold uppercase ${
                            reached ? "text-white" : "text-[#8E929B]"
                          }`}
                        >
                          {stage.replace("_", " ")}
                        </span>
                        <span className="block truncate font-mono text-[10px] text-[#8E929B]">
                          {event ? event.note : "Waiting for the previous stage"}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </section>

            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={onClose}
                className="h-12 rounded-none bg-[#00FF66] px-6 font-mono text-xs font-black uppercase text-[#0B0C10] transition-all hover:bg-[#00FF66]/80"
              >
                Back to Store
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
