import { createHmac, randomBytes } from "node:crypto";
import {
  verifyReconcileSignature,
  reconcilePaytmTransaction,
} from "../src/lib/server/reconciliation";
import { placeOrder } from "../src/lib/server/services";
import { readState } from "../src/lib/server/store";
import type { PlaceOrderInput } from "../src/lib/contracts";

const TEST_SECRET = "test_reconcile_secret_f8a9e2d41b6c73809e5a3c2f10d48b7a692e1f40d85a";

async function runTests() {
  console.log("\n=======================================================");
  console.log("  RUNNING PAYTM RECONCILIATION & SECURITY TEST SUITE   ");
  console.log("=======================================================\n");

  let passed = 0;

  // --- Test 1: HMAC Signature Generation & Validation ---
  console.log("[Test 1] HMAC Signature Verification...");
  const timestamp = Date.now().toString();
  const nonce = randomBytes(16).toString("hex");
  const body = JSON.stringify({ test: "payload" });
  const stringToSign = `${timestamp}.${nonce}.${body}`;
  const validSig = createHmac("sha256", TEST_SECRET).update(stringToSign).digest("hex");

  const authRes = verifyReconcileSignature(body, timestamp, nonce, validSig, TEST_SECRET);
  if (!authRes.valid) throw new Error("Test 1 Failed: Valid signature was rejected");
  console.log("✓ Valid HMAC signature accepted successfully");
  passed++;

  // --- Test 2: Replay Protection (Nonce reuse) ---
  console.log("\n[Test 2] Replay Protection (Duplicate Nonce)...");
  const replayRes = verifyReconcileSignature(body, timestamp, nonce, validSig, TEST_SECRET);
  if (replayRes.valid || !replayRes.error?.includes("Replay detected")) {
    throw new Error("Test 2 Failed: Replay nonce was not rejected");
  }
  console.log(`✓ Replay attack blocked: "${replayRes.error}"`);
  passed++;

  // --- Test 3: Stale Timestamp Rejection (> 5 mins) ---
  console.log("\n[Test 3] Stale Timestamp Tolerance (> 5 minutes)...");
  const staleTimestamp = (Date.now() - 360_000).toString(); // 6 mins ago
  const staleNonce = randomBytes(16).toString("hex");
  const staleStringToSign = `${staleTimestamp}.${staleNonce}.${body}`;
  const staleSig = createHmac("sha256", TEST_SECRET).update(staleStringToSign).digest("hex");

  const staleRes = verifyReconcileSignature(body, staleTimestamp, staleNonce, staleSig, TEST_SECRET);
  if (staleRes.valid || !staleRes.error?.includes("tolerance window")) {
    throw new Error("Test 3 Failed: Stale timestamp was not rejected");
  }
  console.log(`✓ Stale request blocked: "${staleRes.error}"`);
  passed++;

  // --- Test 4: Setup a pending Manual UPI order ---
  console.log("\n[Test 4] Creating a Pending Manual UPI Order...");
  const sampleInput: PlaceOrderInput = {
    customerName: "Paytm Test User",
    customerEmail: "paytm_test@example.com",
    customerPhone: "9876543210",
    address: "Flat 101, Paytm Cyber Park, Sector 44",
    city: "Gurugram",
    state: "Haryana",
    pincode: "122003",
    paymentMethod: "MANUAL_UPI",
    items: [
      {
        productId: "p1",
        title: "Heavyweight Graphic Oversized Tee",
        price: 999,
        quantity: 1,
        size: "L",
        colorName: "Obsidian Black",
      },
    ],
  };

  const orderResult = await placeOrder(sampleInput, null);
  const testOrder = orderResult.order;
  console.log(`✓ Created Order #${testOrder.orderNumber} (Amount: ₹${testOrder.total}, Status: ${testOrder.status}, PaymentStatus: ${testOrder.paymentStatus})`);
  passed++;

  // Customer submits UTR: UPI/429381029482
  const customerUtr = "429381029482";
  testOrder.utr = customerUtr;
  testOrder.utrSubmittedAt = new Date().toISOString();

  // --- Test 5: Auto-Reconciliation with Matching RRN and Exact Amount ---
  console.log("\n[Test 5] Reconcile Matching Transaction (RRN & Exact Amount)...");
  const paytmTxnId = `PAYTM_TXN_${Date.now()}`;
  const matchResult = await reconcilePaytmTransaction({
    paytmTxnId,
    rrn: customerUtr,
    amount: testOrder.total,
    status: "SUCCESS",
    payerVpa: "customer@paytm",
    paidAt: new Date().toISOString(),
  });

  if (matchResult.status !== "RECONCILED" || matchResult.orderNumber !== testOrder.orderNumber) {
    throw new Error(`Test 5 Failed: Expected RECONCILED, got ${matchResult.status}`);
  }
  console.log(`✓ Reconciled successfully! Order #${matchResult.orderNumber} approved and queued for POD print`);
  passed++;

  // Verify updated state
  const state = readState();
  const updatedOrder = state.orders.find((o) => o.orderNumber === testOrder.orderNumber);
  if (!updatedOrder || updatedOrder.paymentStatus !== "PAID" || updatedOrder.status !== "APPROVED") {
    throw new Error("Test 5 verification failed: Order was not marked PAID/APPROVED");
  }
  console.log(`✓ Verified State: paymentStatus="${updatedOrder.paymentStatus}", status="${updatedOrder.status}", verifiedBy="${updatedOrder.verifiedBy}"`);
  passed++;

  // --- Test 6: Idempotency Protection ---
  console.log("\n[Test 6] Idempotency: Duplicate Transaction Processing...");
  const duplicateRes = await reconcilePaytmTransaction({
    paytmTxnId,
    rrn: customerUtr,
    amount: testOrder.total,
    status: "SUCCESS",
  });

  if (duplicateRes.status !== "SKIPPED_ALREADY_PAID") {
    throw new Error(`Test 6 Failed: Expected SKIPPED_ALREADY_PAID, got ${duplicateRes.status}`);
  }
  console.log(`✓ Duplicate transaction safely skipped: "${duplicateRes.message}"`);
  passed++;

  // --- Test 7: Amount Mismatch Protection (Customer submitted UTR, but paid ₹1 instead of full amount) ---
  console.log("\n[Test 7] Amount Mismatch Security Guard (Underpayment / Overpayment)...");
  // Create another order
  const orderResult2 = await placeOrder(sampleInput, null);
  const testOrder2 = orderResult2.order;
  const underpaidUtr = "592837192837";
  testOrder2.utr = underpaidUtr;

  const mismatchRes = await reconcilePaytmTransaction({
    paytmTxnId: `PAYTM_TXN_MISMATCH_${Date.now()}`,
    rrn: underpaidUtr,
    amount: 100, // Expected ~999, paid 100!
    status: "SUCCESS",
  });

  if (mismatchRes.status !== "PENDING_MANUAL_REVIEW") {
    throw new Error(`Test 7 Failed: Expected PENDING_MANUAL_REVIEW on amount mismatch, got ${mismatchRes.status}`);
  }
  const state2 = readState();
  const order2InState = state2.orders.find((o) => o.orderNumber === testOrder2.orderNumber);
  if (order2InState?.paymentStatus === "PAID") {
    throw new Error("Test 7 Failed: Underpaid order must never be marked PAID!");
  }
  console.log(`✓ Underpaid transaction correctly flagged for manual review: "${mismatchRes.message}"`);
  passed++;

  // --- Test 8: Non-SUCCESS Transaction Rejection ---
  console.log("\n[Test 8] Rejection of Failed / Pending Paytm Transactions...");
  const failedTxnRes = await reconcilePaytmTransaction({
    paytmTxnId: `PAYTM_FAILED_${Date.now()}`,
    rrn: "111222333444",
    amount: 999,
    status: "FAILED",
  });
  if (failedTxnRes.status !== "REJECTED_UNSUCCESSFUL") {
    throw new Error(`Test 8 Failed: Expected REJECTED_UNSUCCESSFUL, got ${failedTxnRes.status}`);
  }
  console.log(`✓ Failed Paytm transaction rejected: "${failedTxnRes.message}"`);
  passed++;

  // --- Test 9: Automatic Confirmation Toggle (ON / OFF Switch) ---
  console.log("\n[Test 9] Automatic Payment Confirmation Toggle (ON / OFF)...");
  const { updateManualUpiSettings } = await import("../src/lib/server/services");
  
  // Step A: Turn OFF Automatic Confirmation
  await updateManualUpiSettings({ autoReconciliationEnabled: false }, "ADMIN_TEST");
  console.log("  Step A: Turned auto-reconciliation OFF in Admin Settings");

  // Create an order
  const orderResult3 = await placeOrder(sampleInput, null);
  const testOrder3 = orderResult3.order;
  const offUtr = "849201948271";
  testOrder3.utr = offUtr;

  // Process matching transaction
  const turnedOffRes = await reconcilePaytmTransaction({
    paytmTxnId: `PAYTM_TXN_OFF_${Date.now()}`,
    rrn: offUtr,
    amount: testOrder3.total,
    status: "SUCCESS",
  });

  if (turnedOffRes.status !== "PENDING_MANUAL_REVIEW") {
    throw new Error(`Test 9 Failed: Expected PENDING_MANUAL_REVIEW when turned OFF, got ${turnedOffRes.status}`);
  }
  const state3 = readState();
  const order3InState = state3.orders.find((o) => o.orderNumber === testOrder3.orderNumber);
  if (order3InState?.paymentStatus === "PAID") {
    throw new Error("Test 9 Failed: Order must NOT be marked PAID when auto-confirmation is OFF");
  }
  console.log(`  ✓ When OFF: Payment safely queued for manual admin review: "${turnedOffRes.message}"`);

  // Step B: Turn ON Automatic Confirmation again
  await updateManualUpiSettings({ autoReconciliationEnabled: true }, "ADMIN_TEST");
  console.log("  Step B: Turned auto-reconciliation back ON in Admin Settings");

  // Create another order and test auto-approval
  const orderResult4 = await placeOrder(sampleInput, null);
  const testOrder4 = orderResult4.order;
  const onUtr = "739104829104";
  testOrder4.utr = onUtr;

  const turnedOnRes = await reconcilePaytmTransaction({
    paytmTxnId: `PAYTM_TXN_ON_${Date.now()}`,
    rrn: onUtr,
    amount: testOrder4.total,
    status: "SUCCESS",
  });

  if (turnedOnRes.status !== "RECONCILED") {
    throw new Error(`Test 9 Failed: Expected RECONCILED when turned ON, got ${turnedOnRes.status}`);
  }
  console.log(`  ✓ When ON: Payment auto-approved order #${testOrder4.orderNumber} successfully!`);
  passed++;

  console.log("\n=======================================================");
  console.log(`ALL ${passed}/${passed} PAYTM RECONCILIATION TESTS PASSED SUCCESSFULLY!`);
  console.log("=======================================================\n");
}

runTests().catch((err) => {
  console.error("Test Suite Error:", err);
  process.exit(1);
});
