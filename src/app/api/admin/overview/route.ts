import { fail, HttpError, ok } from "@/lib/http";
import { readAdminSession, readCustomerSession } from "@/lib/server/auth";
import { adminOverview } from "@/lib/server/services";
import { ensureStateLoaded } from "@/lib/server/store";

/**
 * The console re-reads this snapshot on a timer. An ETag per revision lets unchanged
 * polls finish as a 304 with no body, so a parked admin tab costs one header round-trip
 * instead of re-serialising every order, wallet and ledger row.
 */
export async function GET(request: Request) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin login required");
    const storefrontCustomerId = await readCustomerSession();
    const ifNoneMatch = request.headers.get("if-none-match");
    const state = await ensureStateLoaded(!ifNoneMatch);
    const etag = `"admo-${state.revision ?? 0}-${storefrontCustomerId ?? "guest"}"`;

    if (ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: { ETag: etag, "Cache-Control": "private, no-cache" },
      });
    }

    const response = ok(adminOverview(storefrontCustomerId));
    response.headers.set("ETag", etag);
    response.headers.set("Cache-Control", "private, no-cache");
    return response;
  } catch (error) {
    return fail(error);
  }
}
