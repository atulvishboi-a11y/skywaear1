import { fail, ok, readBody } from "@/lib/http";
import { readCustomerSession } from "@/lib/server/auth";
import { readState, ensureStateLoaded } from "@/lib/server/store";
import { markAllNotificationsRead } from "@/lib/server/services";

export async function GET() {
  try {
    const customerId = await readCustomerSession();
    await ensureStateLoaded();
    const state = readState();
    const notifications = customerId
      ? (state.notifications ?? []).filter((n) => n.customerId === customerId)
      : [];
    return ok({ notifications });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const customerId = await readCustomerSession();
    if (!customerId) {
      return ok({ success: true, count: 0 });
    }
    const body = await readBody<{ all?: boolean }>(request).catch(() => ({ all: true }));
    if (body.all) {
      const count = await markAllNotificationsRead(customerId);
      return ok({ success: true, count });
    }
    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}
