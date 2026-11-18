import { fail, HttpError, ok, readBody, requireFields } from "@/lib/http";
import { readAdminSession } from "@/lib/server/auth";
import { verifyManualUpiPayment } from "@/lib/server/services";

export async function POST(request: Request) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin authentication required");
    const body = await readBody<{ orderNumber: string; utr?: string }>(request);
    requireFields(body, ["orderNumber"]);

    const result = await verifyManualUpiPayment(body.orderNumber, "Admin", body.utr);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
