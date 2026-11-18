import { fail, ok } from "@/lib/http";
import { readCustomerSession } from "@/lib/server/auth";
import { markNotificationRead } from "@/lib/server/services";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customerId = await readCustomerSession();
    const updated = await markNotificationRead(id, customerId);
    return ok({ success: true, notification: updated });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customerId = await readCustomerSession();
    const updated = await markNotificationRead(id, customerId);
    return ok({ success: true, notification: updated });
  } catch (error) {
    return fail(error);
  }
}
