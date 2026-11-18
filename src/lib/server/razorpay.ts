import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { HttpError } from "@/lib/http";

import { readState } from "./store";

const API_BASE = "https://api.razorpay.com/v1";

export interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  status: "created" | "paid" | "pending" | "failed";
  receipt: string;
}

export function getActiveRazorpayMode(): "test" | "live" {
  try {
    const state = readState();
    if (state.gateways?.razorpayMode === "test" || state.gateways?.razorpayMode === "live") {
      return state.gateways.razorpayMode;
    }
  } catch {}
  if (process.env.RAZORPAY_MODE === "test") return "test";
  return "live";
}

function credentials(): { keyId: string; keySecret: string } {
  const mode = getActiveRazorpayMode();

  if (mode === "test") {
    const keyId =
      process.env.RAZORPAY_TEST_KEY_ID ||
      (process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test") ? process.env.RAZORPAY_KEY_ID : "");
    const keySecret =
      process.env.RAZORPAY_TEST_KEY_SECRET ||
      (process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test") ? process.env.RAZORPAY_KEY_SECRET : "");

    if (!keyId || !keySecret) {
      throw new HttpError(503, "Razorpay TEST mode keys are not configured on this server");
    }
    return { keyId, keySecret };
  }

  // Real LIVE mode
  const keyId =
    process.env.RAZORPAY_LIVE_KEY_ID ||
    (process.env.RAZORPAY_KEY_ID?.startsWith("rzp_live") ? process.env.RAZORPAY_KEY_ID : "");
  const keySecret =
    process.env.RAZORPAY_LIVE_KEY_SECRET ||
    (process.env.RAZORPAY_KEY_ID?.startsWith("rzp_live") ? process.env.RAZORPAY_KEY_SECRET : "");

  if (!keyId || !keySecret) {
    throw new HttpError(503, "Razorpay LIVE mode keys are not configured on this server");
  }
  return { keyId, keySecret };
}

export function publicKeyId(): string {
  return credentials().keyId;
}

export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function newReceiptRef(): string {
  return `SKYWARE-${randomBytes(5).toString("hex").toUpperCase()}`;
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
  const { keyId, keySecret } = credentials();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      cache: "no-store",
      ...init,
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new HttpError(502, "Could not reach Razorpay. Please retry.");
  }

  const payload = (await response.json().catch(() => null)) as
    | { error?: { description?: string; field?: string } }
    | T
    | null;

  if (!response.ok) {
    const failure = (payload as { error?: { description?: string; field?: string } } | null)?.error;
    const detail = failure?.field ? `${failure.description} (${failure.field})` : failure?.description;
    throw new HttpError(response.status === 401 ? 503 : 422, detail ? `Razorpay: ${detail}` : "Razorpay request failed");
  }

  return payload as T;
}

export function createRazorpayOrder(input: {
  amountInr: number;
  receipt: string;
  notes: Record<string, string>;
}): Promise<RazorpayOrder> {
  const amount = toPaise(input.amountInr);
  if (amount < 100) throw new HttpError(422, "Razorpay needs at least ₹1 to charge");

  return call<RazorpayOrder>("/orders", {
    method: "POST",
    body: JSON.stringify({
      amount,
      currency: "INR",
      receipt: input.receipt.slice(0, 40),
      payment_capture: 1,
      notes: input.notes,
    }),
  });
}

export function fetchRazorpayOrder(orderId: string): Promise<RazorpayOrder> {
  if (!orderId) throw new HttpError(422, "Missing Razorpay order id");
  return call<RazorpayOrder>(`/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
}

export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  const { keySecret } = credentials();
  const expected = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  const provided = String(signature ?? "");
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(provided, "utf8"));
}
