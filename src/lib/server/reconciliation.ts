import { createHmac, timingSafeEqual } from "node:crypto";
import { mutate, readState, type ZeninState } from "./store";
import { cleanUtr } from "./manualUpi";
import { buildCashbackSchedule, releaseDueCashback } from "@/lib/vesting";
import type { ShopOrder } from "@/lib/domain";

export interface PaytmTransactionInput {
  paytmTxnId: string;
  rrn?: string; // Bank Ref / UTR
  amount: number;
  status: "SUCCESS" | "PENDING" | "FAILED";
  payerVpa?: string;
  paidAt?: string;
  orderIdHint?: string;
  raw?: Record<string, unknown>;
}

export interface ReconciliationResult {
  status:
    | "RECONCILED"
    | "SKIPPED_ALREADY_PAID"
    | "PENDING_MANUAL_REVIEW"
    | "NO_MATCH"
    | "REJECTED_UNSUCCESSFUL";
  orderNumber?: string;
  orderId?: string;
  paytmTxnId: string;
  rrn?: string;
  amount: number;
  message: string;
  candidateOrders?: string[];
}

// In-memory replay cache: tracks nonces for 10 minutes
const seenNonces = new Map<string, number>();

function cleanOldNonces() {
  const now = Date.now();
  for (const [nonce, expiresAt] of seenNonces.entries()) {
    if (now > expiresAt) seenNonces.delete(nonce);
  }
}

/**
 * Validates HMAC-SHA256 signature, timestamp freshness (< 5 mins), and nonce replay protection.
 */
export function verifyReconcileSignature(
  rawBody: string,
  timestamp: string | null,
  nonce: string | null,
  signature: string | null,
  secret: string
): { valid: boolean; error?: string } {
  if (!secret) {
    return { valid: false, error: "Reconciliation secret is not configured on the server" };
  }
  if (!timestamp || !nonce || !signature) {
    return { valid: false, error: "Missing authentication headers (x-reconcile-timestamp, x-reconcile-nonce, x-reconcile-signature)" };
  }

  const ts = Number(timestamp);
  if (isNaN(ts)) {
    return { valid: false, error: "Invalid timestamp header" };
  }

  // 5-minute replay window
  const now = Date.now();
  if (Math.abs(now - ts) > 300_000) {
    return { valid: false, error: "Timestamp out of allowed 5-minute tolerance window" };
  }

  // Nonce check
  cleanOldNonces();
  if (seenNonces.has(nonce)) {
    return { valid: false, error: "Replay detected: nonce has already been used" };
  }
  seenNonces.set(nonce, now + 600_000); // 10 min TTL

  // Compute expected HMAC-SHA256: timestamp.nonce.rawBody
  const payloadToSign = `${timestamp}.${nonce}.${rawBody}`;
  const expectedSignature = createHmac("sha256", secret).update(payloadToSign).digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const providedBuffer = Buffer.from(signature, "utf8");

  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) {
    return { valid: false, error: "Invalid HMAC signature" };
  }

  return { valid: true };
}

function recordAuditLog(
  state: ZeninState,
  actor: string,
  action: string,
  details: string
): void {
  state.auditLogs.unshift({
    id: `log-${Date.now()}-${Math.floor(Math.random() * 999)}`,
    actor,
    action,
    details,
    at: new Date().toISOString(),
  });
  state.auditLogs = state.auditLogs.slice(0, 150);
}

/**
 * Reconciles a single Paytm Business Dashboard transaction with pending Manual UPI orders.
 * Idempotent, safe, and guarantees no order is double-reconciled.
 */
export async function reconcilePaytmTransaction(
  txn: PaytmTransactionInput
): Promise<ReconciliationResult> {
  const cleanTxnId = (txn.paytmTxnId || "").trim();
  const cleanRrn = cleanUtr(txn.rrn || "");
  const amount = Number(txn.amount);

  if (!cleanTxnId) {
    return {
      status: "NO_MATCH",
      paytmTxnId: cleanTxnId,
      amount,
      message: "Paytm Transaction ID is missing",
    };
  }

  if (txn.status !== "SUCCESS") {
    return {
      status: "REJECTED_UNSUCCESSFUL",
      paytmTxnId: cleanTxnId,
      rrn: cleanRrn,
      amount,
      message: `Transaction status is '${txn.status}' on Paytm dashboard. Only SUCCESS transactions can be reconciled.`,
    };
  }

  if (isNaN(amount) || amount <= 0) {
    return {
      status: "NO_MATCH",
      paytmTxnId: cleanTxnId,
      rrn: cleanRrn,
      amount,
      message: `Invalid transaction amount: ${txn.amount}`,
    };
  }

  return mutate((state) => {
    // 1. Idempotency: Check if an order was already approved with this Paytm Txn ID
    const alreadyProcessed = state.orders.find(
      (o) => o.gatewayPaymentId === cleanTxnId && o.paymentStatus === "PAID"
    );
    if (alreadyProcessed) {
      return {
        status: "SKIPPED_ALREADY_PAID",
        orderNumber: alreadyProcessed.orderNumber,
        orderId: alreadyProcessed.id,
        paytmTxnId: cleanTxnId,
        rrn: cleanRrn,
        amount,
        message: `Order #${alreadyProcessed.orderNumber} was already reconciled with Paytm Txn ID ${cleanTxnId}.`,
      };
    }

    // 2. Fetch pending Manual UPI orders
    const pendingOrders = state.orders.filter(
      (o) => o.paymentMethod === "MANUAL_UPI" && o.paymentStatus !== "PAID"
    );

    if (pendingOrders.length === 0) {
      recordAuditLog(
        state,
        "PAYTM_MONITOR",
        "PAYTM_UNMATCHED_TXN",
        `Received ₹${amount} (Txn: ${cleanTxnId}, RRN: ${cleanRrn || "N/A"}), but no pending Manual UPI orders exist.`
      );
      return {
        status: "NO_MATCH",
        paytmTxnId: cleanTxnId,
        rrn: cleanRrn,
        amount,
        message: "No pending Manual UPI orders found in system.",
      };
    }

    let matchedOrder: ShopOrder | null = null;
    let mismatchReason: string | null = null;

    // --- Strategy 1: Match by Customer-Submitted UTR / RRN ---
    if (cleanRrn) {
      const ordersWithMatchingUtr = pendingOrders.filter(
        (o) => o.utr && cleanUtr(o.utr) === cleanRrn
      );

      if (ordersWithMatchingUtr.length === 1) {
        const candidate = ordersWithMatchingUtr[0];
        // Verify exact amount
        if (Math.abs(candidate.total - amount) < 0.05) {
          matchedOrder = candidate;
        } else {
          mismatchReason = `UTR ${cleanRrn} matched order #${candidate.orderNumber}, but amount mismatched (Expected ₹${candidate.total}, Received ₹${amount})`;
          // Flag order in timeline
          candidate.timeline.push({
            label: "PENDING_VERIFICATION",
            at: new Date().toISOString(),
            note: `[Paytm Auto-Reconciler] Found transaction with matching UTR ${cleanRrn}, but amount mismatched: expected ₹${candidate.total}, received ₹${amount}. Flagged for manual review.`,
          });
          recordAuditLog(
            state,
            "PAYTM_MONITOR",
            "RECONCILIATION_AMOUNT_MISMATCH",
            `Order #${candidate.orderNumber}: Expected ₹${candidate.total}, received ₹${amount} (Txn: ${cleanTxnId}, RRN: ${cleanRrn}).`
          );
          return {
            status: "PENDING_MANUAL_REVIEW",
            orderNumber: candidate.orderNumber,
            orderId: candidate.id,
            paytmTxnId: cleanTxnId,
            rrn: cleanRrn,
            amount,
            message: mismatchReason,
          };
        }
      } else if (ordersWithMatchingUtr.length > 1) {
        // Multiple orders submitted same UTR! Security alarm!
        const candidateNumbers = ordersWithMatchingUtr.map((o) => o.orderNumber);
        recordAuditLog(
          state,
          "PAYTM_MONITOR",
          "RECONCILIATION_DUPLICATE_UTR_AMBIGUITY",
          `Multiple orders (${candidateNumbers.join(", ")}) claimed UTR ${cleanRrn}. Kept pending for manual review.`
        );
        return {
          status: "PENDING_MANUAL_REVIEW",
          paytmTxnId: cleanTxnId,
          rrn: cleanRrn,
          amount,
          candidateOrders: candidateNumbers,
          message: `Ambiguity: ${ordersWithMatchingUtr.length} orders submitted the exact same UTR ${cleanRrn}. Manual admin verification required.`,
        };
      }
    }

    // --- Strategy 2: Match by Order Number Hint in transaction remark/note ---
    if (!matchedOrder && txn.orderIdHint) {
      const hint = txn.orderIdHint.trim().toUpperCase();
      const hintOrder = pendingOrders.find(
        (o) => o.orderNumber.toUpperCase() === hint
      );
      if (hintOrder && Math.abs(hintOrder.total - amount) < 0.05) {
        matchedOrder = hintOrder;
      }
    }

    // --- Strategy 3: Single Unique Pending Order with Exact Amount & recent placedAt ---
    if (!matchedOrder) {
      // Find orders matching exact amount placed within last 24 hours
      const now = Date.now();
      const amountMatches = pendingOrders.filter((o) => {
        const orderTime = new Date(o.placedAt).getTime();
        const isRecent = now - orderTime < 86_400_000 * 2; // within 48h
        return isRecent && Math.abs(o.total - amount) < 0.05;
      });

      if (amountMatches.length === 1 && cleanRrn) {
        const candidate = amountMatches[0];
        // If customer didn't submit UTR yet, we can attach the RRN and reconcile
        if (!candidate.utr) {
          matchedOrder = candidate;
        } else {
          // Customer submitted a different UTR than bank RRN
          recordAuditLog(
            state,
            "PAYTM_MONITOR",
            "RECONCILIATION_UTR_MISMATCH_CANDIDATE",
            `Order #${candidate.orderNumber} (₹${candidate.total}) customer UTR: "${candidate.utr}", but bank RRN: "${cleanRrn}". Kept for manual review.`
          );
          return {
            status: "PENDING_MANUAL_REVIEW",
            orderNumber: candidate.orderNumber,
            orderId: candidate.id,
            paytmTxnId: cleanTxnId,
            rrn: cleanRrn,
            amount,
            message: `Amount ₹${amount} matches order #${candidate.orderNumber}, but customer UTR (${candidate.utr}) does not match bank RRN (${cleanRrn}). Kept pending for manual review.`,
          };
        }
      } else if (amountMatches.length > 1) {
        const candidateNumbers = amountMatches.map((o) => o.orderNumber);
        return {
          status: "PENDING_MANUAL_REVIEW",
          paytmTxnId: cleanTxnId,
          rrn: cleanRrn,
          amount,
          candidateOrders: candidateNumbers,
          message: `Multiple pending orders (${candidateNumbers.join(", ")}) match amount ₹${amount}. Kept pending for manual review.`,
        };
      }
    }

    // If still no match found:
    if (!matchedOrder) {
      recordAuditLog(
        state,
        "PAYTM_MONITOR",
        "PAYTM_UNMATCHED_TRANSACTION",
        `No pending order matched ₹${amount} (Txn: ${cleanTxnId}, RRN: ${cleanRrn || "N/A"}, Payer: ${txn.payerVpa || "N/A"}).`
      );
      return {
        status: "NO_MATCH",
        paytmTxnId: cleanTxnId,
        rrn: cleanRrn,
        amount,
        message: `No pending order matched amount ₹${amount} and reference ${cleanRrn || "N/A"}.`,
      };
    }

    // --- 3. Check if Automatic Confirmation is ON or OFF in Admin Settings ---
    const isAutoConfirmEnabled = state.manualUpi?.autoReconciliationEnabled !== false;

    if (!isAutoConfirmEnabled) {
      // Auto-approval is turned OFF by Admin.
      // We do NOT mark order as PAID or APPROVED automatically.
      // Instead, we attach the verified Paytm txn ID & RRN and queue it for manual admin approval.
      matchedOrder.gatewayPaymentId = cleanTxnId;
      if (cleanRrn) {
        matchedOrder.utr = cleanRrn;
      }
      matchedOrder.timeline.push({
        label: "PENDING_VERIFICATION",
        at: new Date().toISOString(),
        note: `[Paytm Monitor] Payment of ₹${amount} detected (Txn: ${cleanTxnId}, RRN: ${cleanRrn || "N/A"}). Automatic confirmation is turned OFF by admin. Queued for manual admin approval.`,
      });

      recordAuditLog(
        state,
        "PAYTM_MONITOR",
        "AUTO_CONFIRMATION_PAUSED",
        `Payment matched for order #${matchedOrder.orderNumber} (₹${amount}, RRN: ${cleanRrn || "N/A"}), but Automatic Confirmation is turned OFF. Kept for manual review.`
      );

      return {
        status: "PENDING_MANUAL_REVIEW",
        orderNumber: matchedOrder.orderNumber,
        orderId: matchedOrder.id,
        paytmTxnId: cleanTxnId,
        rrn: cleanRrn,
        amount,
        message: `Payment matched for order #${matchedOrder.orderNumber}, but Automatic Payment Confirmation is turned OFF in Admin settings. Order queued for manual admin approval.`,
      };
    }

    // --- 4. Execute State Mutation & Approval (When Auto-Confirm is ON) ---
    const verifyIso = new Date().toISOString();
    matchedOrder.paymentStatus = "PAID";
    matchedOrder.status = "APPROVED";
    matchedOrder.podStatus = "queued";
    matchedOrder.gateway = "manual_upi";
    matchedOrder.gatewayPaymentId = cleanTxnId;
    if (cleanRrn) {
      matchedOrder.utr = cleanRrn;
    }
    matchedOrder.verifiedBy = "PAYTM_AUTO_RECONCILER";
    matchedOrder.verifiedAt = verifyIso;

    matchedOrder.timeline.push({
      label: "APPROVED",
      at: verifyIso,
      note: `Payment automatically verified via Paytm Business Monitor. Txn ID: ${cleanTxnId}, Bank RRN: ${cleanRrn || "N/A"}, Amount: ₹${amount}. Order approved for production.`,
    });

    // Schedule cashback if not already scheduled
    if (matchedOrder.cashbackCoins > 0 && (!matchedOrder.cashback || matchedOrder.cashback.length === 0)) {
      matchedOrder.cashback = buildCashbackSchedule(matchedOrder.cashbackCoins, verifyIso);
    }
    releaseDueCashback(state);

    recordAuditLog(
      state,
      "PAYTM_AUTO_RECONCILER",
      "ORDER_PAYMENT_AUTO_RECONCILED",
      `Order #${matchedOrder.orderNumber} auto-approved (₹${matchedOrder.total}, Paytm Txn: ${cleanTxnId}, RRN: ${cleanRrn || "N/A"}). Status: APPROVED.`
    );

    return {
      status: "RECONCILED",
      orderNumber: matchedOrder.orderNumber,
      orderId: matchedOrder.id,
      paytmTxnId: cleanTxnId,
      rrn: cleanRrn,
      amount,
      message: `Order #${matchedOrder.orderNumber} successfully auto-reconciled and approved.`,
    };
  });
}
