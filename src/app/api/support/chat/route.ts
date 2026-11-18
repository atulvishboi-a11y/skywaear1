import { NextRequest } from "next/server";
import { fail, ok, readBody, requireFields, HttpError } from "@/lib/http";
import { readCustomerSession } from "@/lib/server/auth";
import { ensureStateLoaded, readState } from "@/lib/server/store";
import {
  getSupportChatThread,
  sendCustomerChatMessage,
  markChatReadByUser,
} from "@/lib/server/services";

export async function GET(request: NextRequest) {
  try {
    await ensureStateLoaded();
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    if (!sessionId) {
      throw new HttpError(400, "Missing sessionId parameter");
    }

    const customerId = await readCustomerSession();
    let customerData: { id?: string; name?: string; phone?: string; email?: string } | undefined = undefined;

    if (customerId) {
      const state = readState();
      const customer = state.customers.find((c) => c.id === customerId);
      if (customer) {
        customerData = {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
        };
      }
    }

    const thread = await getSupportChatThread(sessionId, customerData);

    // If user is fetching their thread, mark unreadByUser as false
    if (thread.unreadByUser) {
      await markChatReadByUser(sessionId);
      thread.unreadByUser = false;
    }

    return ok({ thread });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureStateLoaded();
    const body = await readBody<{
      sessionId: string;
      message: string;
      customerName?: string;
      customerPhone?: string;
      customerEmail?: string;
    }>(request);

    requireFields(body, ["sessionId", "message"]);

    const customerId = await readCustomerSession();
    let customerData: { id?: string; name?: string; phone?: string; email?: string } = {
      name: body.customerName,
      phone: body.customerPhone,
      email: body.customerEmail,
    };

    if (customerId) {
      const state = readState();
      const customer = state.customers.find((c) => c.id === customerId);
      if (customer) {
        customerData = {
          id: customer.id,
          name: customer.name || body.customerName,
          phone: customer.phone || body.customerPhone,
          email: customer.email || body.customerEmail,
        };
      }
    }

    const result = await sendCustomerChatMessage(body.sessionId, body.message, customerData);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

