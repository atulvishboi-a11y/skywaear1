import type { AdminCustomerPatch } from "@/lib/contracts";
import { fail, HttpError, ok, readBody } from "@/lib/http";
import { readAdminSession } from "@/lib/server/auth";
import { adminUpdateCustomer, purgeCustomer } from "@/lib/server/services";
import { ensureStateLoaded } from "@/lib/server/store";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin login required");
    await ensureStateLoaded();
    const { id } = await params;
    const body = await readBody<AdminCustomerPatch>(request);
    return ok(await adminUpdateCustomer(id, body, "Admin (admin@skywear.in)"));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin login required");
    await ensureStateLoaded();
    const { id } = await params;
    return ok(await purgeCustomer(id, "Admin (admin@skywear.in)"));
  } catch (error) {
    return fail(error);
  }
}
