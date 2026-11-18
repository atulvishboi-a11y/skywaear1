import { HttpError, fail, ok, readBody } from "@/lib/http";
import { readCustomerSession } from "@/lib/server/auth";
import { claimCustomerCashback } from "@/lib/server/services";
import { withDistributedLock } from "@/lib/server/redis";

export async function POST(request: Request) {
  try {
    const customerId = await readCustomerSession();
    if (!customerId) {
      throw new HttpError(401, "Please sign in to collect your Sky Cash");
    }

    const body = await readBody<{ orderId?: string; week?: number }>(request).catch(() => ({}));
    
    // Banking-Grade Distributed Mutex: Prevents concurrent double-claiming across all Vercel instances
    const result = await withDistributedLock(`wallet:claim:${customerId}`, 8, async () => {
      return await claimCustomerCashback(customerId, body);
    });

    return ok(result);
  } catch (error: any) {
    if (error?.message?.startsWith("FINANCIAL_LOCK_BUSY")) {
      return fail(new HttpError(429, "A claim transaction is already in progress. Please wait a moment."));
    }
    return fail(error);
  }
}
