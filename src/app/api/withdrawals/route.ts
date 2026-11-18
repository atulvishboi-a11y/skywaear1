import { HttpError, fail, ok, readBody } from "@/lib/http";
import { readCustomerSession, sanitizeCustomer } from "@/lib/server/auth";
import { submitWithdrawal } from "@/lib/server/services";
import { accountLast4, maskAccount } from "@/lib/paymentDetails";
import type { WithdrawalInput } from "@/lib/contracts";
import { withDistributedLock } from "@/lib/server/redis";

export async function POST(request: Request) {
  try {
    const customerId = await readCustomerSession();
    if (!customerId) {
      throw new HttpError(401, "Please sign in to request a withdrawal");
    }

    const body = await readBody<WithdrawalInput>(request);

    // Banking-Grade Distributed Mutex: Prevents concurrent withdrawal race conditions / double-spend
    const result = await withDistributedLock(`wallet:withdraw:${customerId}`, 10, async () => {
      return await submitWithdrawal(body, customerId);
    });

    return ok(
      {
        withdrawal: {
          ...result.withdrawal,
          bankAccount: result.withdrawal.bankAccount
            ? maskAccount(accountLast4(result.withdrawal.bankAccount))
            : undefined,
        },
        customer: sanitizeCustomer(result.customer),
      },
      201
    );
  } catch (error: any) {
    if (error?.message?.startsWith("FINANCIAL_LOCK_BUSY")) {
      return fail(new HttpError(429, "A withdrawal is already being processed for your account. Please wait."));
    }
    return fail(error);
  }
}
