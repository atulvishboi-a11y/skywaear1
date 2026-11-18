import { fail, HttpError, ok } from "@/lib/http";
import { CUSTOMER_COOKIE, issueCustomerSession, readAdminSession, sessionCookieOptions } from "@/lib/server/auth";
import { adminCloseMemberSession, adminOpenMemberSession } from "@/lib/server/services";

const ACTOR = "Admin (finance@skywear.in)";
const SESSION_MAX_AGE = 12 * 3600;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin login required");
    const { id } = await params;
    const customer = await adminOpenMemberSession(id, ACTOR);

    const response = ok({ customer });
    response.cookies.set(CUSTOMER_COOKIE, issueCustomerSession(customer.id), sessionCookieOptions(SESSION_MAX_AGE));
    return response;
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin login required");
    const { id } = await params;
    const result = await adminCloseMemberSession(id, ACTOR);

    const response = ok(result);
    response.cookies.delete(CUSTOMER_COOKIE);
    return response;
  } catch (error) {
    return fail(error);
  }
}
