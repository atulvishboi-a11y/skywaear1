import { fail, ok } from "@/lib/http";
import { readCustomerSession } from "@/lib/server/auth";
import { storefrontSnapshot, ensureCustomerDailyClaim } from "@/lib/server/services";
import { ensureStateLoaded } from "@/lib/server/store";

export const dynamic = "force-dynamic";

let publicSnapshotCache: any = null;
let publicSnapshotCacheTime = 0;

export function invalidateStorefrontCache() {
  publicSnapshotCache = null;
  publicSnapshotCacheTime = 0;
}

export async function GET() {
  try {
    await ensureStateLoaded();
    const customerId = await readCustomerSession();
    if (customerId) {
      await ensureCustomerDailyClaim(customerId);
      const snapshot = storefrontSnapshot(customerId);
      const response = ok(snapshot);
      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      response.headers.set("Pragma", "no-cache");
      response.headers.set("Expires", "0");
      response.headers.set("Vary", "Cookie");
      return response;
    }

    const now = Date.now();
    // In-memory 3-second micro-cache to debounce simultaneous burst requests while ensuring immediate updates
    if (publicSnapshotCache && now - publicSnapshotCacheTime < 3000) {
      const response = ok(publicSnapshotCache);
      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      response.headers.set("Vary", "Cookie");
      return response;
    }

    publicSnapshotCache = storefrontSnapshot(null);
    publicSnapshotCacheTime = now;
    const response = ok(publicSnapshotCache);
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    response.headers.set("Vary", "Cookie");
    return response;
  } catch (error) {
    return fail(error);
  }
}
