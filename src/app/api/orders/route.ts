import { fail, ok, readBody } from "@/lib/http";
import { readCustomerSession } from "@/lib/server/auth";
import { placeOrder } from "@/lib/server/services";
import { ensureStateLoaded } from "@/lib/server/store";
import type { PlaceOrderInput } from "@/lib/contracts";

export async function POST(request: Request) {
  try {
    await ensureStateLoaded();
    const body = await readBody<PlaceOrderInput>(request);
    const result = await placeOrder(body, await readCustomerSession());
    return ok(result, 201);
  } catch (error) {
    return fail(error);
  }
}
