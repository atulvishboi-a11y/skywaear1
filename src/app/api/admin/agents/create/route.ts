import { HttpError, fail, ok, readBody } from "@/lib/http";
import { readAdminSession } from "@/lib/server/auth";
import { adminCreateAgent, type CreateAgentInput } from "@/lib/server/services";
import { ensureStateLoaded } from "@/lib/server/store";

export async function POST(request: Request) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin login required");
    await ensureStateLoaded();

    const body = await readBody<CreateAgentInput>(request);
    if (!body?.name?.trim()) throw new HttpError(422, "Agent name is required");
    if (!body.phone?.trim() && !body.email?.trim()) {
      throw new HttpError(422, "Add a mobile number or email for the agent to log in");
    }

    const customer = await adminCreateAgent(body, "Admin (admin@skywear.in)");
    return ok({ customer });
  } catch (error) {
    return fail(error);
  }
}
