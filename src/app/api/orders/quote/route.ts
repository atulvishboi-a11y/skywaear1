import { fail, ok, readBody } from "@/lib/http";
import { readCustomerSession } from "@/lib/server/auth";
import { quote } from "@/lib/server/services";
import { ensureStateLoaded } from "@/lib/server/store";
import type { QuoteInput } from "@/lib/contracts";

export async function POST(request: Request) {
  try {
    await ensureStateLoaded();
    const body = await readBody<QuoteInput>(request);
    return ok(quote(body, await readCustomerSession()));
  } catch (error) {
    return fail(error);
  }
}
