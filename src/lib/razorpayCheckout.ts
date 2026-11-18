import type { RazorpaySessionResult } from "@/lib/contracts";

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

export interface RazorpayPaymentResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckout {
  open(): void;
  on(event: "payment.failed", callback: (response: { error?: { description?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: {
      key: string;
      order_id: string;
      name: string;
      description: string;
      currency: string;
      prefill: { name: string; email: string; contact: string };
      theme: { color: string };
      modal: { ondismiss: () => void };
      handler: (response: RazorpayPaymentResponse) => void;
    }) => RazorpayCheckout;
  }
}

let scriptLoader: Promise<void> | null = null;

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  scriptLoader ??= new Promise<void>((resolve, reject) => {
    const failure = () => {
      scriptLoader = null;
      reject(new Error("Could not load Razorpay Checkout. Check your connection and retry."));
    };
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", failure);
      return;
    }
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = failure;
    document.head.appendChild(script);
  });
  return scriptLoader;
}

export async function openRazorpayCheckout(session: RazorpaySessionResult): Promise<RazorpayPaymentResponse> {
  await loadCheckoutScript();
  const Checkout = window.Razorpay;
  if (!Checkout) throw new Error("Razorpay Checkout did not load");

  return new Promise<RazorpayPaymentResponse>((resolve, reject) => {
    let settled = false;
    const failWith = (message: string) => {
      if (settled) return;
      settled = true;
      reject(new Error(message));
    };

    const checkout = new Checkout({
      key: session.keyId,
      order_id: session.orderId,
      name: "SKYWARE",
      description: `Order ${session.receipt}`,
      currency: session.currency,
      prefill: session.prefill,
      theme: { color: "#121212" },
      modal: { ondismiss: () => failWith("Payment window closed — nothing was charged") },
      handler: (response) => {
        settled = true;
        resolve(response);
      },
    });

    checkout.on("payment.failed", (response) =>
      failWith(response.error?.description ? `Payment failed: ${response.error.description}` : "Payment failed")
    );

    checkout.open();
  });
}
