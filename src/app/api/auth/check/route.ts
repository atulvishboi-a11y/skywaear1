import { fail, ok, readBody, HttpError } from "@/lib/http";
import { readState, ensureStateLoaded } from "@/lib/server/store";

export async function POST(request: Request) {
  try {
    const body = await readBody<{ identifier: string }>(request);
    if (!body.identifier?.trim()) {
      throw new HttpError(422, "Identifier is required");
    }
    await ensureStateLoaded();
    let state = readState();
    const clean = body.identifier.trim();
    let digits = clean.replace(/\D/g, "");
    if (digits.startsWith("91") && digits.length > 10) digits = digits.slice(2);
    else if (digits.startsWith("0") && digits.length > 10) digits = digits.slice(1);
    const last10 = digits.length >= 10 ? digits.slice(-10) : digits;

    let customer = (state.customers || []).find((c) => {
      if (clean.includes("@")) {
        return c.email && c.email.toLowerCase() === clean.toLowerCase();
      }
      return Boolean(last10 && (c.phone || "").replace(/\D/g, "").endsWith(last10));
    });

    if (!customer) {
      state = await ensureStateLoaded(true);
      customer = (state.customers || []).find((c) => {
        if (clean.includes("@")) {
          return c.email && c.email.toLowerCase() === clean.toLowerCase();
        }
        return Boolean(last10 && (c.phone || "").replace(/\D/g, "").endsWith(last10));
      });
    }

    const exists = Boolean(customer);
    const name = customer?.name || null;
    const email = customer?.email || null;

    return ok({
      success: true,
      exists,
      name,
      email,
      data: {
        exists,
        name,
        email,
      },
    });
  } catch (error) {
    return fail(error);
  }
}

