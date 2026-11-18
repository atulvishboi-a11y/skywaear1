import { fail, HttpError, ok } from "@/lib/http";
import { readAdminSession } from "@/lib/server/auth";
import { getAllSupportChats } from "@/lib/server/services";
import { ensureStateLoaded } from "@/lib/server/store";

export async function GET() {
  try {
    const admin = await readAdminSession();
    if (!admin) throw new HttpError(401, "Admin authentication required");

    await ensureStateLoaded(true);
    const chats = await getAllSupportChats();
    return ok({ chats });
  } catch (error) {
    return fail(error);
  }
}

