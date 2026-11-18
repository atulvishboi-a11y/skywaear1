import { fail, HttpError, ok, readBody } from "@/lib/http";
import { readAdminSession } from "@/lib/server/auth";
import { createTeam, getTeams, type CreateTeamInput } from "@/lib/server/services";
import { ensureStateLoaded } from "@/lib/server/store";

export async function GET() {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin authentication required");
    await ensureStateLoaded();
    const teams = await getTeams();
    return ok(teams);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin authentication required");
    await ensureStateLoaded(true);
    const body = await readBody<CreateTeamInput>(request);
    const team = await createTeam(body, "Admin");
    return ok(team, 201);
  } catch (error) {
    return fail(error);
  }
}

