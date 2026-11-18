import { fail, ok, readBody, HttpError } from "@/lib/http";
import { cookies } from "next/headers";
import { CUSTOMER_COOKIE, issueCustomerSession, sessionCookieOptions, SESSION_MAX_AGE_SECONDS } from "@/lib/server/auth";
import { signUpCustomerWithPassword } from "@/lib/server/services";
import { verifyOtpCode } from "@/lib/server/otpService";

export async function POST(request: Request) {
  try {
    const body = await readBody<{
      name: string;
      phone: string;
      email?: string;
      password: string;
      otp: string;
      referralCode?: string;
    }>(request);

    if (!body.name?.trim()) throw new HttpError(422, "Full name is required.");
    if (!body.phone?.trim()) throw new HttpError(422, "Mobile number is required.");
    if (!body.password || body.password.length < 6) {
      throw new HttpError(422, "Password must be at least 6 characters.");
    }
    if (!body.otp?.trim()) {
      throw new HttpError(422, "Please enter the OTP verification code.");
    }

    const isValidOtp = await verifyOtpCode(body.phone, body.otp);
    if (!isValidOtp) {
      throw new HttpError(400, "Invalid or expired OTP verification code. Please request a new code.");
    }

    const customer = await signUpCustomerWithPassword({
      name: body.name,
      phone: body.phone,
      email: body.email,
      password: body.password,
      referralCode: body.referralCode,
    });

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
