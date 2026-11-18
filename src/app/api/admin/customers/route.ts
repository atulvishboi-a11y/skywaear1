import { fail, HttpError, ok, readBody } from "@/lib/http";
import { readAdminSession } from "@/lib/server/auth";
import { adminCreateCustomer } from "@/lib/server/services";
import { ensureStateLoaded } from "@/lib/server/store";

export async function POST(request: Request) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin login required");
    await ensureStateLoaded();
    const body = await readBody<{
      name: string;
      phone: string;
      email?: string;
      tier?: any;
      availableCoins?: number;
    }>(request);
    const customer = await adminCreateCustomer(body, "Admin (admin@skywear.in)");
    return ok(customer);
  } catch (error) {
    return fail(error);
  }
}
