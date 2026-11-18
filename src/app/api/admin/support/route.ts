import { fail, HttpError, ok, readBody } from "@/lib/http";
import { readAdminSession } from "@/lib/server/auth";
import { saveSupport } from "@/lib/server/services";
import { ensureStateLoaded } from "@/lib/server/store";
import { invalidateStorefrontCache } from "@/app/api/storefront/route";
import type { SupportConfig } from "@/lib/support";

export async function PUT(request: Request) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin login required");
    await ensureStateLoaded(true);
    const body = await readBody<Partial<SupportConfig>>(request);
    const saved = await saveSupport(body, "Admin (admin@skywear.in)");
    invalidateStorefrontCache();
    return ok(saved);
  } catch (error) {
    return fail(error);
  }
}
