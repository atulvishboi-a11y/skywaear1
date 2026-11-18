import { fail, ok, readBody, requireFields } from "@/lib/http";
import { readCustomerSession } from "@/lib/server/auth";
import { placeOrder } from "@/lib/server/services";
import { generateUpiUri, generateQrCodeDataUrl, getActiveManualUpiConfig } from "@/lib/server/manualUpi";
import type { PlaceOrderInput } from "@/lib/contracts";

export async function POST(request: Request) {
  try {
    const body = await readBody<PlaceOrderInput>(request);
    requireFields(body, ["customerName", "customerEmail", "customerPhone", "address", "city", "state", "pincode", "items"]);

    // Enforce paymentMethod
    body.paymentMethod = "MANUAL_UPI";

    const customerId = await readCustomerSession();
    const result = await placeOrder(body, customerId);

    const config = getActiveManualUpiConfig();
    const upiUri = generateUpiUri({
      upiId: result.order.manualUpiSnapshot?.upiId || config.upiId,
      merchantName: result.order.manualUpiSnapshot?.merchantName || config.merchantName,
      amount: result.order.total,
      orderNumber: result.order.orderNumber,
    });

    const qrCodeDataUrl = await generateQrCodeDataUrl(upiUri);

    return ok({
      order: result.order,
      quote: result.quote,
      qrCodeDataUrl,
      upiUri,
      manualUpiSnapshot: result.order.manualUpiSnapshot,
    }, 201);
  } catch (error) {
    return fail(error);
  }
}
