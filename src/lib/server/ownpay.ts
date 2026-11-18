import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { HttpError } from "@/lib/http";

export interface OwnPayConfig {
  baseUrl: string;
  apiKey: string;
  webhookSecret: string;
  isConfigured: boolean;
}

export interface OwnPayPaymentIntent {
  id: string;
  amount: number;
  currency: string;
  reference: string;
  checkoutUrl: string;
  status: "pending" | "completed" | "failed" | "cancelled";
}

export function getOwnPayConfig(): OwnPayConfig {
  const baseUrl = (process.env.OWNPAY_BASE_URL || "").replace(/\/+$/, "");
  const apiKey = process.env.OWNPAY_API_KEY || "";
  const webhookSecret = process.env.OWNPAY_WEBHOOK_SECRET || "";
  const isConfigured = Boolean(baseUrl && apiKey);

  return {
    baseUrl,
    apiKey,
    webhookSecret,
    isConfigured,
  };
}

export function newOwnPayReceiptRef(): string {
  return `OP-${randomBytes(5).toString("hex").toUpperCase()}`;
}

/**
 * Creates a payment intent on the OwnPay instance (POST /api/v1/payments).
 * If no self-hosted OwnPay instance is configured yet in environment,
 * returns an interactive simulated checkout session so the storefront flow works end-to-end.
 */
export async function createOwnPayPayment(input: {
  amountInr: number;
  reference: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  redirectUrl: string;
}): Promise<OwnPayPaymentIntent> {
  const config = getOwnPayConfig();

  if (input.amountInr <= 0) {
    throw new HttpError(422, "OwnPay requires an order amount greater than ₹0");
  }

  // 1. Live Self-Hosted OwnPay Integration
  if (config.isConfigured) {
    try {
      const response = await fetch(`${config.baseUrl}/payments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          amount: input.amountInr,
          currency: "INR",
          reference: input.reference,
          redirect_url: input.redirectUrl,
          customer: {
            name: input.customerName,
            email: input.customerEmail,
            phone: input.customerPhone,
          },
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg = data?.message || data?.error || response.statusText;
        throw new HttpError(response.status >= 500 ? 502 : 422, `OwnPay: ${errorMsg}`);
      }

      return {
        id: data.id || data.payment_id || input.reference,
        amount: Number(data.amount || input.amountInr),
        currency: data.currency || "INR",
        reference: input.reference,
        checkoutUrl: data.checkout_url || data.url || `${config.baseUrl}/pay/${data.id}`,
        status: data.status || "pending",
      };
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw new HttpError(502, `Failed to reach OwnPay server at ${config.baseUrl}. Check instance connection.`);
    }
  }

  // 2. Local / Development Sandbox Simulation (when OWNPAY_API_KEY is not yet populated)
  const simulationId = `op_sim_${randomBytes(8).toString("hex")}`;
  const checkoutUrl = `/api/payments/ownpay/simulate?id=${encodeURIComponent(
    simulationId
  )}&ref=${encodeURIComponent(input.reference)}&amount=${encodeURIComponent(
    input.amountInr
  )}&redirect=${encodeURIComponent(input.redirectUrl)}`;

  return {
    id: simulationId,
    amount: input.amountInr,
    currency: "INR",
    reference: input.reference,
    checkoutUrl,
    status: "pending",
  };
}

/**
 * Validates HMAC SHA-256 signature from OwnPay Webhook headers (X-OP-Signature / X-Signature).
 */
export function verifyOwnPayWebhookSignature(
  rawPayload: string,
  providedSignature: string,
  secretOverride?: string
): boolean {
  const secret = secretOverride || getOwnPayConfig().webhookSecret;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[OwnPay Webhook Security] OWNPAY_WEBHOOK_SECRET is missing in production environment. Rejecting webhook.");
      return false;
    }
    console.warn("[OwnPay Webhook] OWNPAY_WEBHOOK_SECRET is not configured in local development. Permitting test event.");
    return true;
  }

  if (!providedSignature) return false;

  try {
    const computed = createHmac("sha256", secret).update(rawPayload, "utf8").digest("hex");
    const cleanProvided = (providedSignature || "").trim();

    if (computed.length !== cleanProvided.length) return false;
    return timingSafeEqual(Buffer.from(computed, "utf8"), Buffer.from(cleanProvided, "utf8"));
  } catch {
    return false;
  }
}
