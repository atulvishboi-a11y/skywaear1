import { NextResponse } from "next/server";
import { fail, ok, readBody, HttpError } from "@/lib/http";
import {
  CUSTOMER_COOKIE,
  issueCustomerSession,
  readCustomerSession,
  sessionCookieOptions,
  clearSessionCookieOptions,
  SESSION_MAX_AGE_SECONDS,
  sanitizeCustomer,
} from "@/lib/server/auth";
import { signInAsCustomer, signOutCustomer, loginCustomerWithPassword } from "@/lib/server/services";
import { ensureStateLoaded, readState } from "@/lib/server/store";

import { verifyOtpCode } from "@/lib/server/otpService";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const customerId = await readCustomerSession();
    if (!customerId) {
      const emptyRes = ok({ customer: null });
      emptyRes.headers.set("Cache-Control", "no-store, private");
      return emptyRes;
    }
    await ensureStateLoaded();
    const state = readState();
    const customer = state.customers.find((c) => c.id === customerId) ?? null;
    const response = ok({ customer: sanitizeCustomer(customer) });
    response.headers.set("Cache-Control", "no-store, private");
    return response;
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readBody<{
      identifier: string;
      name?: string;
      otp?: string;
      password?: string;
      phone?: string;
      email?: string;
    }>(request);
    if (!body.identifier?.trim()) throw new HttpError(422, "Mobile number or email is required");

    let customer;

    if (body.password) {
      // Password Login or Sign Up
      customer = await loginCustomerWithPassword({
        identifier: body.identifier.trim(),
        password: body.password,
        name: body.name?.trim(),
        phone: body.phone?.trim(),
        email: body.email?.trim(),
      });
    } else {
      // OTP Login
      if (!body.otp?.trim()) {
        throw new HttpError(422, "Please enter your password or OTP verification code.");
      }

      const isValid = await verifyOtpCode(body.identifier.trim(), body.otp.trim());
      if (!isValid) {
        throw new HttpError(400, "Invalid or expired OTP verification code. Please request a new code.");
      }

      customer = await signInAsCustomer(body.identifier.trim(), body.name?.trim());
    }

    const safeCustomer = sanitizeCustomer(customer);
    const response = ok({ customer: safeCustomer });
    response.cookies.set(CUSTOMER_COOKIE, issueCustomerSession(customer.id), sessionCookieOptions(SESSION_MAX_AGE_SECONDS));
    return response;
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const customerId = await readCustomerSession();
    if (!customerId) throw new HttpError(401, "Customer login required");
    await ensureStateLoaded();
    const body = await readBody<{ name?: string; phone?: string; email?: string }>(request);
    const phoneDigits = (value?: string) => (value || "").replace(/\D/g, "");
    const requestedPhone = phoneDigits(body.phone);
    const { mutate } = await import("@/lib/server/store");
    const updated = await mutate((state) => {
      const customer = state.customers.find((c) => c.id === customerId);
      if (!customer) throw new HttpError(404, "Customer account not found");
      if (requestedPhone && requestedPhone !== phoneDigits(customer.phone)) {
        throw new HttpError(422, "Registered mobile number cannot be changed.");
      }
      if (body.name?.trim()) customer.name = body.name.trim();
      if (body.email !== undefined) customer.email = body.email.trim() || undefined;
      return customer;
    });
    return ok({ customer: sanitizeCustomer(updated) });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE() {
  try {
    const customerId = await readCustomerSession();
    await signOutCustomer(customerId);
    const response = NextResponse.json({ signedOut: true });
    response.cookies.set(CUSTOMER_COOKIE, "", clearSessionCookieOptions());
    return response;
  } catch (error) {
    return fail(error);
  }
}
