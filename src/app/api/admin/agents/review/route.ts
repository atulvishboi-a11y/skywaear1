import { HttpError, fail, ok, readBody } from "@/lib/http";
import { readAdminSession } from "@/lib/server/auth";
import { reviewAgentApplication, type AgentReviewAction } from "@/lib/server/services";
import { ensureStateLoaded } from "@/lib/server/store";

interface ReviewBody {
  customerId: string;
  action: AgentReviewAction;
  reason?: string;
}

export async function POST(request: Request) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin login required");
    await ensureStateLoaded();

    const body = await readBody<ReviewBody>(request);
    if (!body?.customerId) throw new HttpError(422, "customerId is required");

    const customer = await reviewAgentApplication(
      body.customerId,
      body.action,
      body.reason,
      "Admin (admin@skywear.in)"
    );
    return ok({ customer });
  } catch (error) {
    return fail(error);
  }
}
