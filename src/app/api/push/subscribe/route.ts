import { fail, HttpError, ok, readBody } from "@/lib/http";
import { readCustomerSession } from "@/lib/server/auth";
import { savePushSubscription, sendPushToSubscription } from "@/lib/server/webpush";
import { ensureStateLoaded } from "@/lib/server/store";

interface SubscribeBody {
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
  customerId?: string;
  sendWelcome?: boolean;
}

export async function POST(request: Request) {
  try {
    await ensureStateLoaded();
    const body = await readBody<SubscribeBody>(request);

    if (!body?.subscription?.endpoint || !body?.subscription?.keys) {
      throw new HttpError(400, "Valid push subscription object is required");
    }

    const customerSessionId = await readCustomerSession();
    const customerId = body.customerId || customerSessionId || undefined;
    const userAgent = request.headers.get("user-agent") || undefined;

    const saved = await savePushSubscription({
      endpoint: body.subscription.endpoint,
      keys: body.subscription.keys,
      customerId,
      userAgent,
    });

    // Optionally deliver a welcome confirmation notification immediately
    if (body.sendWelcome) {
      void sendPushToSubscription(saved, {
        title: "⚡ SKYWARE Alerts Activated",
        body: "You're all set! You will receive live updates for new limited drops, order tracking, and daily wallet coins.",
        url: "/?tab=wallet",
        tag: "zenin-welcome",
      });
    }

    return ok({ success: true, subscriptionId: saved.id }, 201);
  } catch (error) {
    return fail(error);
  }
}
