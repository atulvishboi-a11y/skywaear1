import { fail, HttpError, ok, readBody } from "@/lib/http";
import { readAdminSession } from "@/lib/server/auth";
import { deleteTeam, updateTeam, type UpdateTeamInput } from "@/lib/server/services";
import { ensureStateLoaded } from "@/lib/server/store";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin authentication required");
    const { id } = await context.params;
    if (!id) throw new HttpError(422, "Team ID is required");

    await ensureStateLoaded(true);
    const body = await readBody<UpdateTeamInput>(request);
    const updated = await updateTeam(id, body, "Admin");
    return ok(updated);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin authentication required");
    const { id } = await context.params;
    if (!id) throw new HttpError(422, "Team ID is required");

    await ensureStateLoaded(true);
    const result = await deleteTeam(id, "Admin");
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

