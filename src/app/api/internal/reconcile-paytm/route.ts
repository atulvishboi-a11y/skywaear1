import { ok, fail, HttpError } from "@/lib/http";
import {
  verifyReconcileSignature,
  reconcilePaytmTransaction,
  type PaytmTransactionInput,
  type ReconciliationResult,
} from "@/lib/server/reconciliation";

export async function POST(request: Request) {
  try {
    const secret = process.env.PAYTM_RECONCILIATION_SECRET;
    if (!secret) {
      throw new HttpError(
        503,
        "PAYTM_RECONCILIATION_SECRET is not configured on the server environment"
      );
    }

    const timestamp = request.headers.get("x-reconcile-timestamp");
    const nonce = request.headers.get("x-reconcile-nonce");
    const signature = request.headers.get("x-reconcile-signature");

    const rawBody = await request.text();
    if (!rawBody) {
      throw new HttpError(400, "Request body is empty");
    }

    const authCheck = verifyReconcileSignature(rawBody, timestamp, nonce, signature, secret);
    if (!authCheck.valid) {
      throw new HttpError(401, authCheck.error || "Unauthorized reconciliation request");
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      throw new HttpError(400, "Invalid JSON in request body");
    }

    // Support both single transaction object and batch array
    const transactions: PaytmTransactionInput[] = Array.isArray(parsed.transactions)
      ? parsed.transactions
      : Array.isArray(parsed)
      ? parsed
      : [parsed];

    if (transactions.length === 0) {
      return ok({ success: true, processed: 0, results: [] });
    }

    const results: ReconciliationResult[] = [];
    for (const txn of transactions) {
      const res = await reconcilePaytmTransaction(txn);
      results.push(res);
    }

    return ok({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    return fail(error);
  }
}
