import { HttpError, fail, ok, readBody } from "@/lib/http";
import { readCustomerSession, sanitizeCustomer } from "@/lib/server/auth";
import { applyForAgent, type AgentApplicationInput } from "@/lib/server/services";
import { ensureStateLoaded } from "@/lib/server/store";

export async function POST(request: Request) {
  try {
    await ensureStateLoaded();
    const customerId = await readCustomerSession();
    if (!customerId) throw new HttpError(401, "Please sign in to apply for the agent programme");

    const body = await readBody<AgentApplicationInput>(request);
    const customer = await applyForAgent(customerId, body ?? {});
    return ok({ customer: sanitizeCustomer(customer) }, 201);
  } catch (error) {
    return fail(error);
  }
}
