import { fail, ok, readBody, HttpError } from "@/lib/http";
import { readCustomerSession, sanitizeCustomer } from "@/lib/server/auth";
import { ensureStateLoaded, readState } from "@/lib/server/store";
import {
  addCustomerAddress,
  removeCustomerAddress,
  updateCustomerAddress,
  type AddressInput,
} from "@/lib/server/addressService";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function requireSession(): Promise<string> {
  const customerId = await readCustomerSession();
  if (!customerId) throw new HttpError(401, "Please sign in to manage your delivery addresses.");
  return customerId;
}

export async function GET() {
  try {
    const customerId = await requireSession();
    await ensureStateLoaded();
    const customer = readState().customers.find((c) => c.id === customerId);
    if (!customer) throw new HttpError(404, "Customer account not found.");
    return ok({ customer: sanitizeCustomer(customer), addresses: customer.addresses ?? [] });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const customerId = await requireSession();
    const body = await readBody<AddressInput>(request);
    return ok(await addCustomerAddress(customerId, body));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const customerId = await requireSession();
    const body = await readBody<Partial<AddressInput> & { index?: number }>(request);
    const index = Number(body.index);
    if (!Number.isInteger(index) || index < 0) {
      throw new HttpError(422, "A valid address index is required.");
    }
    return ok(await updateCustomerAddress(customerId, index, body));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const customerId = await requireSession();
    const index = Number(new URL(request.url).searchParams.get("index"));
    if (!Number.isInteger(index) || index < 0) {
      throw new HttpError(422, "A valid address index is required.");
    }
    return ok(await removeCustomerAddress(customerId, index));
  } catch (error) {
    return fail(error);
  }
}
