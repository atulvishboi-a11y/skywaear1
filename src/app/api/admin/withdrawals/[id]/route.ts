import type { AdminWithdrawalPatch } from "@/lib/contracts";
import { fail, HttpError, ok, readBody } from "@/lib/http";
import { readAdminSession } from "@/lib/server/auth";
import { adminUpdateWithdrawal } from "@/lib/server/services";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin login required");
    const { id } = await params;
    const body = await readBody<AdminWithdrawalPatch>(request);
    return ok(await adminUpdateWithdrawal(id, body, "Admin (finance@skywear.in)"));
  } catch (error) {
    return fail(error);
  }
}
