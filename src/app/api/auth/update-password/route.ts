import { fail, ok, readBody, HttpError } from "@/lib/http";
import {
  readCustomerSession,
  hashPassword,
  sanitizeCustomer,
  verifyPassword,
} from "@/lib/server/auth";
import { mutate } from "@/lib/server/store";

const MIN_LENGTH = 8;

function validateNewPassword(password: string): string | null {
  if (password.length < MIN_LENGTH) {
    return `New password must be at least ${MIN_LENGTH} characters.`;
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "New password must include at least one letter and one number.";
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const customerId = await readCustomerSession();
    if (!customerId) {
      throw new HttpError(401, "Please sign in to update your account password.");
    }

    const body = await readBody<{ currentPassword?: string; newPassword: string }>(request);
    const newPassword = body.newPassword ?? "";
    const currentPassword = body.currentPassword ?? "";

    const policyError = validateNewPassword(newPassword);
    if (policyError) {
      throw new HttpError(422, policyError);
    }

    const customer = await mutate((state) => {
      const user = state.customers.find((c) => c.id === customerId);
      if (!user) {
        throw new HttpError(404, "Customer account not found.");
      }

      // First-time password setup (OTP-only accounts) skips the old-password check.
      if (user.password) {
        if (!currentPassword) {
          throw new HttpError(422, "Enter your current password.");
        }
        if (!verifyPassword(currentPassword, user.password)) {
          throw new HttpError(403, "Current password is incorrect.");
        }
        if (verifyPassword(newPassword, user.password)) {
          throw new HttpError(422, "New password must be different from your current password.");
        }
      }

      user.password = hashPassword(newPassword);
      return sanitizeCustomer(user);
    });

    return ok({
      success: true,
      message: "Password updated successfully!",
      customer,
    });
  } catch (error) {
    return fail(error);
  }
}
