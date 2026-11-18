import type { RejectWithdrawalInput } from "@/lib/contracts";
import { fail, HttpError, ok, readBody } from "@/lib/http";
import { readAdminSession } from "@/lib/server/auth";
import { rejectWithdrawal } from "@/lib/server/services";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin login required");
    const { id } = await params;
    const body = await readBody<RejectWithdrawalInput>(request);
    return ok(await rejectWithdrawal(id, body ?? {}, "Admin (finance@skywear.in)"));
  } catch (error) {
    return fail(error);
  }
}
