import { fail, HttpError, ok, readBody } from "@/lib/http";
import { readAdminSession } from "@/lib/server/auth";
import { getManualUpiSettings, updateManualUpiSettings } from "@/lib/server/services";
import { ensureStateLoaded } from "@/lib/server/store";
import { invalidateStorefrontCache } from "@/app/api/storefront/route";
import type { ManualUpiConfig } from "@/lib/domain";

export async function GET() {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin authentication required");
    await ensureStateLoaded();
    return ok(getManualUpiSettings());
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin authentication required");
    await ensureStateLoaded(true);
    const body = await readBody<Partial<ManualUpiConfig>>(request);
    const updated = await updateManualUpiSettings(body, "Admin");
    invalidateStorefrontCache();
    return ok(updated);
  } catch (error) {
    return fail(error);
  }
}
