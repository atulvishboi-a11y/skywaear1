import { fail, ok, readBody, requireFields, HttpError } from "@/lib/http";
import { readCustomerSession } from "@/lib/server/auth";
import { createOwnPayPayment, newOwnPayReceiptRef, getOwnPayConfig } from "@/lib/server/ownpay";
import { quote, getGatewaysConfig } from "@/lib/server/services";
import type { OwnPaySessionInput, OwnPaySessionResult } from "@/lib/contracts";

export async function POST(request: Request) {
  try {
    const gateways = getGatewaysConfig();
    if (!gateways.ownpayEnabled) {
      throw new HttpError(422, "OwnPay payment gateway is currently disabled by Admin.");
    }

    const body = await readBody<OwnPaySessionInput>(request);
    requireFields(body, ["customerName", "customerEmail", "customerPhone"]);

    body.gatewayProvider = "ownpay";
    if (!body.paymentMethod || body.paymentMethod === "COD") {
      body.paymentMethod = "UPI";
    }

    const customerId = await readCustomerSession();
    const total = quote(body, customerId).total;
    const reference = newOwnPayReceiptRef();

    const host = request.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const redirectUrl = `${protocol}://${host}/checkout/success?ref=${reference}&gateway=ownpay`;

    const payment = await createOwnPayPayment({
      amountInr: total,
      reference,
      customerName: body.customerName,
      customerEmail: body.customerEmail,
      customerPhone: body.customerPhone,
      redirectUrl,
    });

    const isSimulated = !getOwnPayConfig().isConfigured;

    const payload: OwnPaySessionResult = {
      paymentId: payment.id,
      reference: payment.reference,
      amountInr: payment.amount,
      currency: payment.currency,
      checkoutUrl: payment.checkoutUrl,
      isSimulated,
    };

    return ok(payload);
  } catch (error) {
    return fail(error);
  }
}
