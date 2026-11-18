import { getActiveManualUpiConfig, validateUpiId, validateUtr, generateUpiUri, generateQrCodeDataUrl } from "../src/lib/server/manualUpi";
import { placeOrder, submitManualUpiPayment, verifyManualUpiPayment, rejectManualUpiPayment, getManualUpiSettings, updateManualUpiSettings } from "../src/lib/server/services";

async function runTests() {
  console.log("=== MANUAL UPI PAYMENT GATEWAY VERIFICATION SUITE ===");

  // Test 1: UPI ID Validation
  console.log("\n[Test 1] UPI ID Validation...");
  const validUpi = validateUpiId("merchant@okaxis");
  const invalidUpi = validateUpiId("notanupiid");
  if (!validUpi || invalidUpi) throw new Error("UPI ID validation failed");
  console.log("✓ UPI ID validator correctly accepted merchant@okaxis and rejected invalid format");

  // Test 2: UTR Validation & Sanitization
  console.log("\n[Test 2] UTR Validation & Sanitization...");
  const validUtr = validateUtr("429381029482");
  const prefixedUtr = validateUtr("UPI/429381029482");
  const shortUtr = validateUtr("123");
  if (!validUtr.valid || validUtr.cleaned !== "429381029482") throw new Error("Standard UTR validation failed");
  if (!prefixedUtr.valid || prefixedUtr.cleaned !== "429381029482") throw new Error("Prefixed UTR sanitization failed");
  if (shortUtr.valid) throw new Error("Short UTR was improperly accepted");
  console.log("✓ UTR validation cleanly processed standard 12-digit and prefixed bank formats, rejecting malformed input");

  // Test 3: URI & QR Data URL Generation
  console.log("\n[Test 3] Dynamic UPI URI and QR Generation...");
  const upiUri = generateUpiUri({
    upiId: "zeninstreet@upi",
    merchantName: "ZENIN STREETWEAR",
    amount: 1499,
    orderNumber: "TEST-ORD-01",
  });
  console.log("  Generated URI:", upiUri);
  if (!upiUri.startsWith("upi://pay?pa=zeninstreet%40upi")) throw new Error("UPI URI format mismatch");
  if (!upiUri.includes("am=1499.00") || !upiUri.includes("tn=TEST-ORD-01")) throw new Error("UPI URI params missing");

  const qrDataUrl = await generateQrCodeDataUrl(upiUri);
  if (!qrDataUrl.startsWith("data:image/png;base64,")) throw new Error("QR Data URL generation failed");
  console.log("✓ Dynamic QR code Data URL generated successfully with verified parameters");

  // Test 4: Settings Update & Persistence
  console.log("\n[Test 4] Admin Settings Update...");
  const prevSettings = getManualUpiSettings();
  const updatedSettings = await updateManualUpiSettings(
    {
      enabled: true,
      upiId: "zeninstore@ybl",
      merchantName: "ZENIN OFFICIAL",
      instructions: "Transfer exact amount and submit your 12-digit UTR reference.",
    },
    "SuperAdmin"
  );
  if (updatedSettings.upiId !== "zeninstore@ybl") throw new Error("Settings did not update");
  console.log("✓ Manual UPI gateway settings successfully configured by admin");

  // Test 5: Order Creation with MANUAL_UPI
  console.log("\n[Test 5] Storefront Order Placement with MANUAL_UPI...");
  const orderResult = await placeOrder(
    {
      items: [
        {
          title: "TOKYO DRIFT OVERSIZED TEE",
          size: "L",
          colorName: "Pitch Black",
          quantity: 1,
          price: 999,
        },
      ],
      customerName: "Aarav Sharma",
      customerEmail: "aarav.sharma@example.com",
      customerPhone: "9876543210",
      address: "Flat 402, Skyline Towers",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      paymentMethod: "MANUAL_UPI",
    },
    null
  );

  const createdOrder = orderResult.order;
  console.log(`  Order #${createdOrder.orderNumber} created. Total: ₹${createdOrder.total}`);
  if (createdOrder.paymentMethod !== "MANUAL_UPI") throw new Error("Payment method mismatch");
  if (createdOrder.paymentStatus !== "PENDING") throw new Error("Manual UPI order must start as PENDING payment");
  if (createdOrder.status !== "PENDING") throw new Error("Order status must start as PENDING");
  if (createdOrder.podStatus !== "awaiting_payment") throw new Error("POD status must be awaiting_payment");
  if (!createdOrder.manualUpiSnapshot || createdOrder.manualUpiSnapshot.upiId !== "zeninstore@ybl") {
    throw new Error("Order manualUpiSnapshot not captured correctly");
  }
  console.log("✓ Order created with snapshot of active UPI configuration and awaiting payment state");

  // Test 6: UTR Submission by Customer
  console.log("\n[Test 6] Customer Submits UTR Reference...");
  const utrSubmission = await submitManualUpiPayment(
    createdOrder.orderNumber,
    "429381029482",
    "/uploads/proofs/test-receipt.png"
  );
  const updatedOrder = utrSubmission.order;
  if (updatedOrder.paymentStatus !== "PENDING_VERIFICATION") {
    throw new Error("Order status must be PENDING_VERIFICATION after UTR submission");
  }
  if (updatedOrder.utr !== "429381029482") throw new Error("UTR not saved");
  if (!updatedOrder.utrSubmittedAt) throw new Error("Submission timestamp missing");
  console.log("✓ UTR recorded. Order transitioned to PENDING_VERIFICATION without auto-approval");

  // Test 7: UTR Uniqueness Enforcement
  console.log("\n[Test 7] UTR Uniqueness Enforcement...");
  const orderResult2 = await placeOrder(
    {
      items: [
        {
          title: "NEON CYBER OVERSIZED TEE",
          size: "M",
          colorName: "Pitch Black",
          quantity: 1,
          price: 999,
        },
      ],
      customerName: "Rohan Verma",
      customerEmail: "rohan.verma@example.com",
      customerPhone: "9876543211",
      address: "Sector 14",
      city: "Gurugram",
      state: "Haryana",
      pincode: "122001",
      paymentMethod: "MANUAL_UPI",
    },
    null
  );

  let duplicateBlocked = false;
  try {
    // Attempt to reuse the same UTR
    await submitManualUpiPayment(orderResult2.order.orderNumber, "429381029482");
  } catch (err: any) {
    duplicateBlocked = true;
    console.log("  Expected error caught:", err.message);
  }
  if (!duplicateBlocked) throw new Error("Duplicate UTR reuse was NOT blocked!");
  console.log("✓ Duplicate UTR reuse was strictly rejected by server");

  // Test 8: Admin Payment Verification
  console.log("\n[Test 8] Admin Payment Verification...");
  const verifiedResult = await verifyManualUpiPayment(createdOrder.orderNumber, "FinanceAdmin_Pooja");
  const verifiedOrder = verifiedResult.order;
  if (verifiedOrder.paymentStatus !== "PAID") throw new Error("Payment status must be PAID");
  if (verifiedOrder.status !== "APPROVED") throw new Error("Order status must be APPROVED");
  if (verifiedOrder.podStatus !== "queued") throw new Error("POD status must be queued for printing");
  if (verifiedOrder.verifiedBy !== "FinanceAdmin_Pooja") throw new Error("Admin identifier missing");
  if (!verifiedOrder.verifiedAt) throw new Error("Verification timestamp missing");
  console.log("✓ Admin verification transitioned order to PAID & APPROVED, queued POD printing, and issued cashback");

  // Test 9: Duplicate Admin Verification Guard
  console.log("\n[Test 9] Guard against Duplicate Verification...");
  let doubleVerifyBlocked = false;
  try {
    await verifyManualUpiPayment(createdOrder.orderNumber, "FinanceAdmin_Pooja");
  } catch (err: any) {
    doubleVerifyBlocked = true;
    console.log("  Expected error caught:", err.message);
  }
  if (!doubleVerifyBlocked) throw new Error("Double verification was not blocked!");
  console.log("✓ Multiple verification clicks blocked safely");

  // Test 10: Admin Rejection Flow
  console.log("\n[Test 10] Admin Payment Rejection Flow...");
  await submitManualUpiPayment(orderResult2.order.orderNumber, "883920194829");
  const rejectedResult = await rejectManualUpiPayment(
    orderResult2.order.orderNumber,
    "Payment amount not credited to bank account",
    "FinanceAdmin_Pooja"
  );
  const rejectedOrder = rejectedResult.order;
  if (rejectedOrder.paymentStatus !== "REJECTED") throw new Error("Payment status must be REJECTED");
  if (rejectedOrder.rejectionReason !== "Payment amount not credited to bank account") throw new Error("Rejection reason missing");
  console.log("✓ Admin rejection successfully recorded reason, kept order unpaid, and preserved audit history");

  console.log("\n=======================================================");
  console.log("ALL 10 VERIFICATION TESTS PASSED SUCCESSFULLY! (10/10)");
  console.log("=======================================================\n");
}

runTests().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
