import { fail, HttpError, ok, readBody } from "@/lib/http";
import { removePushSubscription } from "@/lib/server/webpush";
import { ensureStateLoaded } from "@/lib/server/store";

export async function POST(request: Request) {
  try {
    await ensureStateLoaded();
    const body = await readBody<{ endpoint: string }>(request);
    if (!body?.endpoint) throw new HttpError(400, "Subscription endpoint is required");

    const removed = await removePushSubscription(body.endpoint);
    return ok({ success: true, removed });
  } catch (error) {
    return fail(error);
  }
}
