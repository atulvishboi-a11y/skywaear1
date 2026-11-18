import { fail, HttpError, ok } from "@/lib/http";
import { readAdminSession } from "@/lib/server/auth";
import { pushAdminOrderToQikink, syncAdminOrderWithQikink } from "@/lib/server/services";
import { ensureStateLoaded } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin authentication required");
    await ensureStateLoaded();
    const { id } = await props.params;
    const order = await pushAdminOrderToQikink(id, "Admin");
    return ok({ success: true, order });
  } catch (error) {
    return fail(error);
  }
}

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin authentication required");
    await ensureStateLoaded();
    const { id } = await props.params;
    const order = await syncAdminOrderWithQikink(id, "Admin");
    return ok({ success: true, order });
  } catch (error) {
    return fail(error);
  }
}

