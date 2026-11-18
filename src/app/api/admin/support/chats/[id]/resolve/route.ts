import { fail, HttpError, ok } from "@/lib/http";
import { readAdminSession } from "@/lib/server/auth";
import { resolveSupportChat } from "@/lib/server/services";
import { ensureStateLoaded } from "@/lib/server/store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await readAdminSession();
    if (!isAdmin) throw new HttpError(401, "Admin authentication required");

    await ensureStateLoaded(true);
    const { id } = await params;

    const thread = await resolveSupportChat(id, "Admin Support");
    return ok({ thread });
  } catch (error) {
    return fail(error);
  }
}
