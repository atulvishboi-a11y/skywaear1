import { fail, ok, readBody, requireFields, HttpError } from "@/lib/http";
import { readCustomerSession } from "@/lib/server/auth";
import { createRazorpayOrder, newReceiptRef, publicKeyId } from "@/lib/server/razorpay";
import { quote, getGatewaysConfig } from "@/lib/server/services";
import { ensureStateLoaded } from "@/lib/server/store";
import type { RazorpaySessionInput, RazorpaySessionResult } from "@/lib/contracts";

export async function POST(request: Request) {
  try {
    await ensureStateLoaded();
    const gateways = getGatewaysConfig();
    if (!gateways.razorpayEnabled) {
      throw new HttpError(422, "Razorpay payment gateway is currently disabled by Admin.");
    }

    const body = await readBody<RazorpaySessionInput>(request);
    requireFields(body, ["customerName", "customerEmail", "customerPhone", "items"]);

    if (!Array.isArray(body.items) || body.items.length === 0) {
      throw new HttpError(422, "Order must contain at least one item.");
    }

    // Force gatewayProvider = "razorpay" and an online payment method so backend quote
    // calculates the authoritative total including any configured convenience/gateway surcharge fee.
    body.gatewayProvider = "razorpay";
    if (!body.paymentMethod || body.paymentMethod === "COD") {
      body.paymentMethod = "UPI";
    }

    const customerSession = await readCustomerSession();
    const quoteResult = quote(body, customerSession);
    const total = quoteResult.total;

    if (total <= 0) {
      throw new HttpError(422, "Calculated payable amount must be greater than zero for online payment.");
    }

    const order = await createRazorpayOrder({
      amountInr: total,
      receipt: newReceiptRef(),
      notes: {
        customerName: body.customerName.trim(),
        customerEmail: body.customerEmail.trim(),
        customerPhone: body.customerPhone.trim(),
        subtotal: String(quoteResult.subtotal),
        deliveryFee: String(quoteResult.deliveryFee),
        convenienceFee: String(quoteResult.gatewayFee ?? 0),
        discount: String(quoteResult.couponDiscount),
        legacyInrTotal: String(total),
      },
    });

    console.log(
      `[Razorpay Order Created] Receipt: ${order.receipt}, OrderId: ${order.id}, Subtotal: ₹${quoteResult.subtotal}, Delivery: ₹${quoteResult.deliveryFee}, ConvenienceFee: ₹${quoteResult.gatewayFee ?? 0}, Total: ₹${total} (${order.amount} paise)`
    );

    const payload: RazorpaySessionResult = {
      keyId: publicKeyId(),
      orderId: order.id,
      amountInPaise: order.amount,
      currency: "INR",
      receipt: order.receipt,
      prefill: { name: body.customerName, email: body.customerEmail, contact: body.customerPhone },
    };

    return ok(payload);
  } catch (error) {
    return fail(error);
  }
}
