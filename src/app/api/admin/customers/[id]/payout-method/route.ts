import { fail, HttpError, ok, readBody } from "@/lib/http";
import { readAdminSession } from "@/lib/server/auth";
import {
  adminApprovePayoutMethod,
  adminRejectPayoutMethod,
  adminSetUpiWithdrawalLock,
  adminUpdateCustomerBankAccount,
} from "@/lib/server/services";
import { ensureStateLoaded } from "@/lib/server/store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await readAdminSession();
    if (!admin) throw new HttpError(401, "Admin login required");
    await ensureStateLoaded();

    const { id } = await params;
    const body = await readBody<{
      action: "APPROVE" | "REJECT" | "LOCK_UPI" | "UNLOCK_UPI" | "UPDATE_BANK";
      type?: "UPI" | "BANK";
      reason?: string;
      bankName?: string;
      ifscCode?: string;
      accountNumber?: string;
      accountHolderName?: string;
    }>(request);

    if (body.action === "LOCK_UPI" || body.action === "UNLOCK_UPI") {
      const result = await adminSetUpiWithdrawalLock(
        id,
        body.action === "LOCK_UPI",
        "Admin"
      );
      return ok(result);
    }

    if (body.action === "UPDATE_BANK") {
      const result = await adminUpdateCustomerBankAccount(
        id,
        {
          bankName: body.bankName || "",
          ifscCode: body.ifscCode || "",
          accountNumber: body.accountNumber || "",
          accountHolderName: body.accountHolderName || "",
        },
        "Admin"
      );
      return ok(result);
    }

    if (!body.type) throw new HttpError(422, "Payout method type is required");

    if (body.action === "APPROVE") {
      const result = await adminApprovePayoutMethod(id, body.type, "Admin");
      return ok(result);
    } else {
      const result = await adminRejectPayoutMethod(
        id,
        body.type,
        body.reason || "Payout method change rejected by admin.",
        "Admin"
      );
      return ok(result);
    }
  } catch (error) {
    return fail(error);
  }
}

