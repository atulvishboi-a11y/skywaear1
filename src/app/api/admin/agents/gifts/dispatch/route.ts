import { HttpError, fail, ok, readBody } from "@/lib/http";
import { readAdminSession } from "@/lib/server/auth";
import { dispatchAgentGift } from "@/lib/server/services";
import { ensureStateLoaded } from "@/lib/server/store";

interface DispatchBody {
  customerId: string;
  giftId: string;
}

export async function POST(request: Request) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin login required");
    await ensureStateLoaded();

    const body = await readBody<DispatchBody>(request);
    if (!body?.customerId || !body?.giftId) {
      throw new HttpError(422, "customerId and giftId are required");
    }

    const customer = await dispatchAgentGift(
      body.customerId,
      body.giftId,
      "Admin (admin@skywear.in)"
    );
    return ok({ customer });
  } catch (error) {
    return fail(error);
  }
}
