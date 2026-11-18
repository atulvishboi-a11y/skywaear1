import { createHmac, timingSafeEqual } from "node:crypto";
import { fail, HttpError, ok } from "@/lib/http";
import type { CourierPartner, OrderStatus } from "@/lib/domain";
import { syncQikinkWebhook } from "@/lib/server/services";

interface QikinkPayload {
  orderNumber?: string;
  status?: OrderStatus;
  courier?: CourierPartner;
  trackingNumber?: string;
  podOrderId?: string;
}

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const secret = process.env.ZENIN_WEBHOOK_SECRET;
    if (!secret) {
      if (process.env.NODE_ENV === "production") {
        throw new HttpError(503, "ZENIN_WEBHOOK_SECRET is not configured on the production server.");
      }
    }
    const effectiveSecret = secret || "zenin-local-webhook-secret";
    const expected = createHmac("sha256", effectiveSecret).update(raw).digest("hex");
    const received = request.headers.get("x-zenin-signature") ?? "";
    if (
      expected.length !== received.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(received))
    ) {
      throw new HttpError(401, "Invalid webhook signature");
    }

    let payload: QikinkPayload;
    try {
      payload = JSON.parse(raw) as QikinkPayload;
    } catch {
      throw new HttpError(400, "Webhook body must be JSON");
    }

    const order = await syncQikinkWebhook(payload);
    return ok({ received: true, orderNumber: order.orderNumber, status: order.status });
  } catch (error) {
    return fail(error);
  }
}
