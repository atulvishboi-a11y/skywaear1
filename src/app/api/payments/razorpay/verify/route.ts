import { HttpError, fail, ok, readBody, requireFields } from "@/lib/http";
import { readCustomerSession } from "@/lib/server/auth";
import { fetchRazorpayOrder, toPaise, verifyPaymentSignature } from "@/lib/server/razorpay";
import { placeOrder, quote } from "@/lib/server/services";
import { ensureStateLoaded } from "@/lib/server/store";
import type { RazorpayVerifyInput } from "@/lib/contracts";

export async function POST(request: Request) {
  try {
    await ensureStateLoaded();
    const body = await readBody<RazorpayVerifyInput>(request);
    requireFields(body, ["razorpayOrderId", "razorpayPaymentId", "razorpaySignature"]);

    if (body.paymentMethod === "COD") {
      throw new HttpError(422, "Cash-on-delivery orders do not go through the payment gateway");
    }

    // Force gatewayProvider = "razorpay" and online method so backend quote and placeOrder
    // include the convenience fee and match the Razorpay order amount exactly.
    body.gatewayProvider = "razorpay";
    if (!body.paymentMethod) {
      body.paymentMethod = "UPI";
    }

    if (!verifyPaymentSignature(body.razorpayOrderId, body.razorpayPaymentId, body.razorpaySignature)) {
      throw new HttpError(402, "Razorpay signature mismatch — this payment was not accepted");
    }

    const remote = await fetchRazorpayOrder(body.razorpayOrderId);
    const customerId = await readCustomerSession();
    const quoteResult = quote(body, customerId);
    const total = quoteResult.total;
    const expectedPaise = toPaise(total);

    if (remote.amount !== expectedPaise) {
      console.error(
        `[Razorpay Amount Mismatch] Order ${remote.id}: remote.amount=${remote.amount} paise, backend expected=${expectedPaise} paise (₹${total}). Subtotal: ₹${quoteResult.subtotal}, Fee: ₹${quoteResult.gatewayFee ?? 0}`
      );
      throw new HttpError(409, "The payable amount changed or does not match. Please start the payment again.");
    }
    if (remote.status !== "paid") {
      throw new HttpError(409, `Razorpay reports this order as ${remote.status}, not paid`);
    }

    const result = await placeOrder(body, customerId, {
      orderId: remote.id,
      paymentId: body.razorpayPaymentId,
      provider: "razorpay",
    });

    console.log(
      `[Razorpay Payment Verified & Order Confirmed] OrderNumber: ${result.order.orderNumber}, Subtotal: ₹${result.order.subtotal}, Delivery: ₹${result.order.deliveryFee}, Fee: ₹${result.order.gatewayFee ?? 0}, Total: ₹${result.order.total}, PaymentId: ${body.razorpayPaymentId}`
    );

    return ok(result, 201);
  } catch (error) {
    return fail(error);
  }
}
