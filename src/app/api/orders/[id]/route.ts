import { fail, ok, readBody, HttpError } from "@/lib/http";
import { readAdminSession } from "@/lib/server/auth";
import { assignShipment, updateOrderStatus } from "@/lib/server/services";
import type { OrderStatus } from "@/lib/domain";
import type { CourierPartner } from "@/lib/domain";

interface PatchBody {
  status?: OrderStatus;
  courier?: CourierPartner;
  trackingNumber?: string;
  note?: string;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin login required");
    const { id } = await params;
    const body = await readBody<PatchBody>(request);
    const actor = "Admin (admin@skywear.in)";

    if (body.courier || body.trackingNumber) {
      if (!body.courier || !body.trackingNumber) {
        throw new HttpError(422, "Courier and tracking number must be supplied together");
      }
      return ok(await assignShipment(id, body.courier, body.trackingNumber, actor));
    }

    if (!body.status) throw new HttpError(422, "Provide a status or courier assignment");
    return ok(await updateOrderStatus(id, body.status, actor, body.note));
  } catch (error) {
    return fail(error);
  }
}
