import { fail, ok, readBody, HttpError } from "@/lib/http";
import { cookies } from "next/headers";
import { CUSTOMER_COOKIE, issueCustomerSession, sessionCookieOptions, SESSION_MAX_AGE_SECONDS } from "@/lib/server/auth";
import { loginCustomerWithPassword, signInAsCustomer } from "@/lib/server/services";
import { verifyOtpCode } from "@/lib/server/otpService";
import { checkRateLimit, clearRateLimit, getClientIp, lockoutMessage, recordRateLimitFailure } from "@/lib/server/rateLimit";

const IDENTIFIER_FAILURE_LIMIT = 8;
const IDENTIFIER_WINDOW_SECONDS = 15 * 60;
const IP_FAILURE_LIMIT = 25;
const IP_WINDOW_SECONDS = 15 * 60;

// Only credential failures count; malformed requests and server faults must not lock an account.
function isCredentialFailure(error: unknown): boolean {
  return (
    error instanceof HttpError &&
    (error.status === 400 || error.status === 401 || error.status === 404)
  );
}

function throttleIdentifier(identifier: string): string {
  if (identifier.includes("@")) return identifier.toLowerCase();
  const digits = identifier.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : identifier.toLowerCase();
}

export async function POST(request: Request) {
  try {
    const body = await readBody<{ identifier: string; password?: string; otp?: string; name?: string; email?: string }>(request);

    if (!body.identifier?.trim()) {
      throw new HttpError(422, "Please enter your registered mobile number or email.");
    }

    const identifierKey = throttleIdentifier(body.identifier.trim());
    const ip = getClientIp(request);

    const identifierLimit = await checkRateLimit("login:identifier", identifierKey, IDENTIFIER_FAILURE_LIMIT);
    if (identifierLimit.blocked) {
      throw new HttpError(
        429,
        lockoutMessage(identifierLimit.retryAfterSeconds),
        identifierLimit.retryAfterSeconds
      );
    }
    if (ip) {
      const ipLimit = await checkRateLimit("login:ip", ip, IP_FAILURE_LIMIT);
      if (ipLimit.blocked) {
        throw new HttpError(429, lockoutMessage(ipLimit.retryAfterSeconds), ipLimit.retryAfterSeconds);
      }
    }

    let customer;
    try {
      if (body.otp?.trim()) {
        const isValid = await verifyOtpCode(body.identifier.trim(), body.otp.trim());
        if (!isValid) {
          throw new HttpError(400, "Invalid or expired OTP verification code. Please request a new code.");
        }
        customer = await signInAsCustomer(body.identifier.trim(), body.name?.trim());
        if (body.email?.trim() && customer && !customer.email) {
          customer.email = body.email.trim();
        }
      } else if (body.password) {
        customer = await loginCustomerWithPassword({
          identifier: body.identifier.trim(),
          password: body.password,
          email: body.email?.trim(),
        });
      } else {
        throw new HttpError(422, "Please enter your account password or OTP verification code.");
      }
    } catch (error) {
      if (!isCredentialFailure(error)) throw error;

      const identifierState = await recordRateLimitFailure(
        "login:identifier",
        identifierKey,
        IDENTIFIER_FAILURE_LIMIT,
        IDENTIFIER_WINDOW_SECONDS
      );
      if (ip) {
        await recordRateLimitFailure("login:ip", ip, IP_FAILURE_LIMIT, IP_WINDOW_SECONDS);
      }
      if (identifierState.blocked) {
        throw new HttpError(
          429,
          lockoutMessage(identifierState.retryAfterSeconds),
          identifierState.retryAfterSeconds
        );
      }
      throw error;
    }

    await clearRateLimit("login:identifier", identifierKey);

    const sessionToken = issueCustomerSession(customer.id);
    const cookieOpts = sessionCookieOptions(SESSION_MAX_AGE_SECONDS);

    try {
      const cookieStore = await cookies();
      cookieStore.set(CUSTOMER_COOKIE, sessionToken, cookieOpts);
    } catch {}

    const response = ok({ success: true, customer });
    response.cookies.set(CUSTOMER_COOKIE, sessionToken, cookieOpts);
    return response;
  } catch (error) {
    return fail(error);
  }
}
