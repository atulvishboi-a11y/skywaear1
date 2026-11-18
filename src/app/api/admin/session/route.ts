import { NextResponse } from "next/server";
import { fail, HttpError, ok, readBody } from "@/lib/http";
import { ADMIN_COOKIE, issueAdminSession, readAdminSession, sessionCookieOptions, verifyAdminCredentials } from "@/lib/server/auth";
import { checkRateLimit, clearRateLimit, getClientIp, lockoutMessage, recordRateLimitFailure } from "@/lib/server/rateLimit";

const SESSION_MAX_AGE = 12 * 3600;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 5 * 60;

export async function GET() {
  try {
    return ok({ authenticated: await readAdminSession() });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request) ?? "unknown-client";

    const lock = await checkRateLimit("admin:ip", ip, MAX_FAILED_ATTEMPTS);
    if (lock.blocked) {
      throw new HttpError(
        429,
        `Security lockout: ${lockoutMessage(lock.retryAfterSeconds)}`,
        lock.retryAfterSeconds
      );
    }

    const body = await readBody<{ username: string; password: string }>(request);
    const valid = verifyAdminCredentials(body.username ?? "", body.password ?? "");

    if (!valid) {
      const failure = await recordRateLimitFailure(
        "admin:ip",
        ip,
        MAX_FAILED_ATTEMPTS,
        LOCKOUT_SECONDS
      );
      if (failure.blocked) {
        throw new HttpError(
          429,
          "Too many failed login attempts. Admin sign-in is temporarily locked. Please try again in 5 minutes.",
          failure.retryAfterSeconds
        );
      }
      throw new HttpError(
        401,
        `Invalid admin credentials. ${failure.remaining} attempt${failure.remaining === 1 ? "" : "s"} remaining before lockout.`
      );
    }

    await clearRateLimit("admin:ip", ip);

    const response = ok({ authenticated: true, actor: "Admin (admin@skywear.in)" });
    response.cookies.set(ADMIN_COOKIE, issueAdminSession(), sessionCookieOptions(SESSION_MAX_AGE));
    return response;
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.delete(ADMIN_COOKIE);
  return response;
}
