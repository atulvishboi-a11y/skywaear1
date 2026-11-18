import type { RewardRulesConfig } from "@/data/rewardsEngine";
import { fail, HttpError, ok, readBody } from "@/lib/http";
import { readAdminSession } from "@/lib/server/auth";
import { saveRewardRules } from "@/lib/server/services";
import { ensureStateLoaded } from "@/lib/server/store";
import { invalidateStorefrontCache } from "@/app/api/storefront/route";

export async function PUT(request: Request) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin login required");
    await ensureStateLoaded(true);
    const body = await readBody<RewardRulesConfig>(request);
    const saved = await saveRewardRules(body, "Admin (admin@skywear.in)");
    invalidateStorefrontCache();
    return ok(saved);
  } catch (error) {
    return fail(error);
  }
}
