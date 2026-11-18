import { fail, ok, readBody, requireFields } from "@/lib/http";
import { submitManualUpiPayment } from "@/lib/server/services";

export async function POST(request: Request) {
  try {
    const body = await readBody<{ orderNumber: string; utr: string; screenshot?: string }>(request);
    requireFields(body, ["orderNumber", "utr"]);

    const result = await submitManualUpiPayment(body.orderNumber, body.utr, body.screenshot);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
