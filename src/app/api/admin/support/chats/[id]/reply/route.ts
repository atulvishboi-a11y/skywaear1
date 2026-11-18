import { fail, HttpError, ok, readBody, requireFields } from "@/lib/http";
import { readAdminSession } from "@/lib/server/auth";
import { sendAdminChatReply } from "@/lib/server/services";
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
    const body = await readBody<{ message: string }>(request);
    requireFields(body, ["message"]);

    const thread = await sendAdminChatReply(id, body.message, "Admin Support");
    return ok({ thread });
  } catch (error) {
    return fail(error);
  }
}
