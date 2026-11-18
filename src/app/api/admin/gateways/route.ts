import { fail, HttpError, ok, readBody } from "@/lib/http";
import { readAdminSession } from "@/lib/server/auth";
import { getGatewaysConfig, updateGatewaysConfig } from "@/lib/server/services";
import { ensureStateLoaded } from "@/lib/server/store";
import { invalidateStorefrontCache } from "@/app/api/storefront/route";
import type { GatewaysConfig } from "@/lib/domain";

export async function GET() {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin authentication required");
    await ensureStateLoaded();
    return ok(getGatewaysConfig());
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin authentication required");
    await ensureStateLoaded(true);
    const body = await readBody<Partial<GatewaysConfig>>(request);
    const updated = await updateGatewaysConfig(body, "Admin");
    invalidateStorefrontCache();
    return ok(updated);
  } catch (error) {
    return fail(error);
  }
}
