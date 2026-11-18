import { fail, HttpError, ok, readBody } from "@/lib/http";
import { readAdminSession } from "@/lib/server/auth";
import { dispatchFreeTshirt } from "@/lib/server/services";
import type { FreeTshirtInput } from "@/lib/contracts";

export async function POST(request: Request) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin login required");
    const body = await readBody<FreeTshirtInput>(request);
    const order = await dispatchFreeTshirt(body, "Admin (admin@skywear.in)");
    return ok(order, 201);
  } catch (error) {
    return fail(error);
  }
}
