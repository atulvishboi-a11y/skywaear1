import { HttpError, fail, ok } from "@/lib/http";
import { verifyOwnPayWebhookSignature } from "@/lib/server/ownpay";
import { mutate, type ZeninState } from "@/lib/server/store";

type OwnPayPaymentFields = {
  reference?: string;
  order_id?: string;
  receipt?: string;
  id?: string;
  payment_id?: string;
};

type OwnPayEvent = OwnPayPaymentFields & {
  event?: string;
  type?: string;
  status?: string;
  data?: OwnPayPaymentFields;
  payment?: OwnPayPaymentFields;
};

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature =
      request.headers.get("x-op-signature") ||
      request.headers.get("x-signature") ||
      request.headers.get("x-ownpay-signature") ||
      "";

    // Verify signature if secret configured
    const isValid = verifyOwnPayWebhookSignature(rawBody, signature);
    if (!isValid) {
      throw new HttpError(403, "Invalid OwnPay webhook signature");
    }

    let event: OwnPayEvent;
    try {
      event = JSON.parse(rawBody) as OwnPayEvent;
    } catch {
      throw new HttpError(400, "Invalid JSON payload in webhook");
    }

    const eventType = event.event || event.type || event.status;
    const payment: OwnPayPaymentFields = event.data || event.payment || event;
    const reference = payment.reference || payment.order_id || payment.receipt;
    const paymentId = payment.id || payment.payment_id || `op_hook_${Date.now()}`;

    console.log(`[OwnPay Webhook] Received ${eventType} for reference: ${reference}`);

    if (eventType === "payment.completed" || eventType === "paid" || eventType === "completed") {
      // Find order matching reference and mark PAID if still pending
      await mutate((state: ZeninState) => {
        const order = state.orders.find(
          (o) => o.gatewayOrderId === reference || o.orderNumber === reference || o.gatewayPaymentId === paymentId
        );

        if (order && order.paymentStatus !== "PAID") {
          order.paymentStatus = "PAID";
          order.status = "APPROVED";
          order.gateway = "ownpay";
          order.gatewayPaymentId = paymentId;
          order.timeline.push({
            label: "APPROVED",
            at: new Date().toISOString(),
            note: `Payment confirmed via OwnPay. Order approved for printing.`,
          });
        }
      });
    }

    return ok({ received: true, event: eventType, reference });
  } catch (error) {
    console.error("[OwnPay Webhook Error]", error);
    return fail(error);
  }
}
