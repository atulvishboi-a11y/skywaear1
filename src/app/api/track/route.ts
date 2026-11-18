import { fail, HttpError, ok } from "@/lib/http";
import { trackOrder } from "@/lib/server/services";
import { ensureStateLoaded, readState } from "@/lib/server/store";
import { readCustomerSession } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    await ensureStateLoaded();
    const { searchParams } = new URL(request.url);
    const orderNumber = searchParams.get("orderNumber") ?? "";
    let contact = searchParams.get("contact") ?? "";

    const customerId = await readCustomerSession();
    const state = readState();
    const customer = customerId ? state.customers.find((c) => c.id === customerId) : null;

    if (!orderNumber) {
      if (customer) {
        const userOrders = state.orders
          .filter(
            (o) =>
              o.customerId === customer.id ||
              (customer.phone && o.customerPhone.replace(/\D/g, "").endsWith(customer.phone.replace(/\D/g, "").slice(-10))) ||
              (customer.email && o.customerEmail.toLowerCase() === customer.email.toLowerCase())
          )
          .sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());
        return ok({ userOrders, customer: { id: customer.id, name: customer.name, phone: customer.phone } });
      }
      throw new HttpError(422, "Provide both an order number and the registered mobile or email");
    }

    if (!contact && customer) {
      contact = customer.phone || customer.email || "";
    }

    if (!contact) {
      throw new HttpError(422, "Provide both an order number and the registered mobile or email");
    }

    return ok(trackOrder(orderNumber, contact));
  } catch (error) {
    return fail(error);
  }
}

