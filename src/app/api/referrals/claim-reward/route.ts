import { HttpError, fail, ok, readBody } from "@/lib/http";
import { readCustomerSession } from "@/lib/server/auth";
import { claimReferralMilestoneReward } from "@/lib/server/services";
import type { ClaimMilestoneInput } from "@/lib/server/services";

export async function POST(request: Request) {
  try {
    const customerId = await readCustomerSession();
    if (!customerId) {
      throw new HttpError(401, "Please sign in to claim your milestone reward");
    }
    const body = await readBody<ClaimMilestoneInput>(request);
    const result = await claimReferralMilestoneReward(customerId, body);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
