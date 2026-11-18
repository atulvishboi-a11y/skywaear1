import { fail, HttpError, ok, readBody } from "@/lib/http";
import { readAdminSession } from "@/lib/server/auth";
import { getQikinkConfig, updateQikinkConfig } from "@/lib/server/services";
import { ensureStateLoaded } from "@/lib/server/store";
import type { QikinkConfig } from "@/lib/domain";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin authentication required");
    await ensureStateLoaded();
    return ok(getQikinkConfig());
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin authentication required");
    const body = await readBody<Partial<QikinkConfig>>(request);
    const updated = await updateQikinkConfig(body, "Admin");
    return ok(updated);
  } catch (error) {
    return fail(error);
  }
}

