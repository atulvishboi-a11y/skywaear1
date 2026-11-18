import { fail, HttpError, ok } from "@/lib/http";
import { readAdminSession } from "@/lib/server/auth";
import { ensureStateLoaded, readState } from "@/lib/server/store";

export async function GET() {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin authentication required");
    await ensureStateLoaded();

    const state = readState();
    const subs = state.pushSubscriptions ?? [];

    return ok({
      count: subs.length,
      subscribers: subs.map((s) => ({
        id: s.id,
        customerId: s.customerId,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt,
        userAgent: s.userAgent,
        endpointDomain: (() => {
          try {
            return new URL(s.endpoint).hostname;
          } catch {
            return "unknown";
          }
        })(),
      })),
    });
  } catch (error) {
    return fail(error);
  }
}
