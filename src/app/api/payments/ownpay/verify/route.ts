import { HttpError, fail, ok, readBody, requireFields } from "@/lib/http";
import { readCustomerSession } from "@/lib/server/auth";
import { placeOrder, quote } from "@/lib/server/services";
import { getOwnPayConfig } from "@/lib/server/ownpay";
import type { OwnPayVerifyInput } from "@/lib/contracts";

export async function POST(request: Request) {
  try {
    const body = await readBody<OwnPayVerifyInput>(request);
    requireFields(body, ["ownpayPaymentId", "ownpayReference"]);

    if (body.paymentMethod === "COD") {
      throw new HttpError(422, "Cash-on-delivery orders do not go through OwnPay gateway");
    }

    body.gatewayProvider = "ownpay";
    if (!body.paymentMethod) {
      body.paymentMethod = "UPI";
    }

    const customerId = await readCustomerSession();
    const total = quote(body, customerId).total;

    if (total <= 0) {
      throw new HttpError(422, "Invalid order amount");
    }

    const config = getOwnPayConfig();

    if (config.isConfigured) {
      // Live server-to-server verification with OwnPay
      try {
        const verifyRes = await fetch(`${config.baseUrl}/payments/${encodeURIComponent(body.ownpayPaymentId)}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!verifyRes.ok) {
          throw new HttpError(402, "OwnPay payment verification failed — transaction not found or rejected");
        }

        const verifyData = await verifyRes.json();
        const status = (verifyData.status || "").toLowerCase();
        if (status !== "completed" && status !== "paid" && status !== "success") {
          throw new HttpError(402, `OwnPay transaction is not marked as paid (status: ${status || "unknown"})`);
        }

        const paidAmount = Number(verifyData.amount);
        if (!isNaN(paidAmount) && paidAmount > 0 && Math.abs(paidAmount - total) > 1) {
          throw new HttpError(409, `Payment amount mismatch: expected ₹${total}, received ₹${paidAmount}`);
        }
      } catch (err: any) {
        if (err instanceof HttpError) throw err;
        throw new HttpError(502, `Unable to reach OwnPay server for verification: ${err.message}`);
      }
    } else {
      // Gateway is unconfigured: allow only simulated checkout in local development
      if (process.env.NODE_ENV === "production") {
        throw new HttpError(503, "OwnPay gateway is not configured for production payments.");
      }
      if (!body.ownpayPaymentId.startsWith("op_sim_")) {
        throw new HttpError(402, "Invalid simulation payment credentials.");
      }
    }

    const result = await placeOrder(body, customerId, {
      orderId: body.ownpayReference,
      paymentId: body.ownpayPaymentId,
      provider: "ownpay",
    });

    return ok(result, 201);
  } catch (error) {
    return fail(error);
  }
}
