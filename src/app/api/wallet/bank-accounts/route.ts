import { HttpError, fail, ok, readBody } from "@/lib/http";
import { readCustomerSession, sanitizeCustomer } from "@/lib/server/auth";
import { addCustomerBankAccount, removeCustomerBankAccount } from "@/lib/server/services";
import { readState, ensureStateLoaded } from "@/lib/server/store";
import { maskBankAccountForClient } from "@/lib/paymentDetails";

export async function GET() {
  try {
    await ensureStateLoaded();
    const customerId = await readCustomerSession();
    if (!customerId) {
      throw new HttpError(401, "Please sign in to view your bank accounts");
    }
    const state = readState();
    const customer = state.customers.find((c) => c.id === customerId);
    if (!customer) throw new HttpError(404, "Customer account not found");
    const accounts = (customer.bankAccounts || []).map(maskBankAccountForClient);
    return ok(accounts);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    await ensureStateLoaded();
    const customerId = await readCustomerSession();
    if (!customerId) {
      throw new HttpError(401, "Please sign in to manage your bank accounts");
    }

    const body = await readBody<{
      accountHolderName: string;
      accountNumber: string;
      confirmAccountNumber?: string;
      ifscCode: string;
      bankName: string;
    }>(request);

    const result = await addCustomerBankAccount(customerId, body);
    return ok(
      {
        ...result,
        bankAccounts: result.bankAccounts.map(maskBankAccountForClient),
        addedAccount: result.addedAccount ? maskBankAccountForClient(result.addedAccount) : undefined,
        customer: sanitizeCustomer(result.customer),
      },
      201
    );
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureStateLoaded();
    const customerId = await readCustomerSession();
    if (!customerId) {
      throw new HttpError(401, "Please sign in to manage your bank accounts");
    }

    const { searchParams } = new URL(request.url);
    const bankAccountId = searchParams.get("id");
    if (!bankAccountId) {
      throw new HttpError(422, "Bank account ID is required");
    }

    const result = await removeCustomerBankAccount(customerId, bankAccountId);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
