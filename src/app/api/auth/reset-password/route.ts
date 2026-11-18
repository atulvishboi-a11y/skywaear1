import { fail, ok, readBody, HttpError } from "@/lib/http";
import { resetCustomerPassword } from "@/lib/server/services";
import { verifyOtpCode } from "@/lib/server/otpService";

export async function POST(request: Request) {
  try {
    const body = await readBody<{
      identifier: string;
      otp: string;
      newPassword: string;
    }>(request);

    if (!body.identifier?.trim()) {
      throw new HttpError(422, "Mobile number or email identifier is required.");
    }
    if (!body.otp?.trim()) {
      throw new HttpError(422, "Please enter the OTP verification code.");
    }
    if (!body.newPassword || body.newPassword.length < 6) {
      throw new HttpError(422, "New password must be at least 6 characters.");
    }

    const isValid = await verifyOtpCode(body.identifier.trim(), body.otp.trim());
    if (!isValid) {
      throw new HttpError(400, "Invalid or expired OTP verification code. Please request a new code.");
    }

    const customer = await resetCustomerPassword({
      identifier: body.identifier.trim(),
      newPassword: body.newPassword,
    });

    return ok({
      success: true,
      message: "Your password has been successfully updated. You can now sign in with your new credentials.",
      customer,
    });
  } catch (error) {
    return fail(error);
  }
}
