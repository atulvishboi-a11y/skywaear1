import { fail, HttpError, ok, readBody } from "@/lib/http";
import { readAdminSession } from "@/lib/server/auth";
import { broadcastPushNotification } from "@/lib/server/webpush";
import { ensureStateLoaded } from "@/lib/server/store";
import type { PushNotificationPayload } from "@/lib/domain";

export async function POST(request: Request) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin authentication required");
    await ensureStateLoaded();

    const body = await readBody<PushNotificationPayload>(request);
    if (!body?.title?.trim() || !body?.body?.trim()) {
      throw new HttpError(400, "Push notification title and message are required");
    }

    const result = await broadcastPushNotification({
      title: body.title.trim(),
      body: body.body.trim(),
      url: body.url?.trim() || "/",
      image: body.image?.trim() || undefined,
      tag: body.tag || `admin-broadcast-${Date.now()}`,
    });

    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
