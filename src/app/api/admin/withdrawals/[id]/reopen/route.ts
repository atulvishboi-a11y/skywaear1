import { fail, HttpError, ok } from "@/lib/http";
import { readAdminSession } from "@/lib/server/auth";
import { reopenWithdrawal } from "@/lib/server/services";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin login required");
    const { id } = await params;
    return ok(await reopenWithdrawal(id, "Admin (finance@skywear.in)"));
  } catch (error) {
    return fail(error);
  }
}
