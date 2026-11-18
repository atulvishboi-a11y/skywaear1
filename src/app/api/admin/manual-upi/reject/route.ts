import { fail, HttpError, ok, readBody, requireFields } from "@/lib/http";
import { readAdminSession } from "@/lib/server/auth";
import { rejectManualUpiPayment } from "@/lib/server/services";

export async function POST(request: Request) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin authentication required");
    const body = await readBody<{ orderNumber: string; reason: string }>(request);
    requireFields(body, ["orderNumber", "reason"]);

    const result = await rejectManualUpiPayment(body.orderNumber, body.reason, "Admin");
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
