import type { PayoutInput } from "@/lib/contracts";
import { fail, HttpError, ok, readBody } from "@/lib/http";
import { readAdminSession } from "@/lib/server/auth";
import { payoutWithdrawal } from "@/lib/server/services";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin login required");
    const { id } = await params;
    const body = await readBody<PayoutInput>(request);
    if (!body.all && !body.week) throw new HttpError(422, "Send a tranche week or all:true");
    return ok(await payoutWithdrawal(id, body, "Admin (finance@skywear.in)"));
  } catch (error) {
    return fail(error);
  }
}
