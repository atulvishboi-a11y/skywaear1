import { HttpError, fail, ok, readBody } from "@/lib/http";
import { readCustomerSession, sanitizeCustomer } from "@/lib/server/auth";
import { requestCustomerUpiEdit } from "@/lib/server/services";
import { readState, ensureStateLoaded } from "@/lib/server/store";

export async function GET() {
  try {
    await ensureStateLoaded();
    const customerId = await readCustomerSession();
    if (!customerId) {
      throw new HttpError(401, "Please sign in to view your UPI details");
    }
    const state = readState();
    const customer = state.customers.find((c) => c.id === customerId);
    if (!customer) throw new HttpError(404, "Customer account not found");

    return ok({
      savedUpiId: customer.savedUpiId,
      upiStatus: customer.upiStatus,
      pendingUpiId: customer.pendingUpiId,
      pendingUpiRequestedAt: customer.pendingUpiRequestedAt,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const customerId = await readCustomerSession();
    if (!customerId) {
      throw new HttpError(401, "Please sign in to manage your UPI details");
    }

    const body = await readBody<{ upiId: string }>(request);
    const result = await requestCustomerUpiEdit(customerId, body.upiId);
    return ok({ ...result, customer: sanitizeCustomer(result.customer) });
  } catch (error) {
    return fail(error);
  }
}

