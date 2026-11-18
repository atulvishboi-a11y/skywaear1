import type { AdminRaiseWithdrawalInput } from "@/lib/contracts";
import { fail, HttpError, ok, readBody } from "@/lib/http";
import { readAdminSession } from "@/lib/server/auth";
import { adminRaiseWithdrawal } from "@/lib/server/services";

export async function POST(request: Request) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin login required");
    const { customerId, ...input } = await readBody<AdminRaiseWithdrawalInput>(request);
    return ok(await adminRaiseWithdrawal(customerId, input, "Admin (finance@skywear.in)"), 201);
  } catch (error) {
    return fail(error);
  }
}
