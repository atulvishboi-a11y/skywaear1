import assert from "node:assert";

async function run() {
  console.log("=== Testing Cash on Delivery (COD) ON/OFF System ===");

  // Dynamically import services from built output or ts-node
  // Since we're in ESM node, we can test via local http or directly importing transpiled modules
  // Let's test the running store & services logic directly using node
  const { getGatewaysConfig, updateGatewaysConfig, quote, placeOrder } = await import("../src/lib/server/services.ts");
  const { readState } = await import("../src/lib/server/store.ts");

  console.log("\n1. Verifying initial GatewaysConfig...");
  const initial = getGatewaysConfig();
  console.log("Initial gateways config:", initial);
  assert.strictEqual(typeof initial.codEnabled, "boolean", "codEnabled must be a boolean");

  console.log("\n2. Testing Admin Toggle COD -> OFF...");
  const disabled = await updateGatewaysConfig({ codEnabled: false }, "TestAdmin");
  assert.strictEqual(disabled.codEnabled, false, "codEnabled must be false after toggle");
  const readAfterDisable = getGatewaysConfig();
  assert.strictEqual(readAfterDisable.codEnabled, false, "Persisted gateways config must reflect codEnabled: false");
  console.log("Gateways config after disable:", readAfterDisable);

  console.log("\n3. Testing Quote when COD is OFF...");
  const state = readState();
  const sampleProduct = state.products[0];
  const testInput = {
    items: [{
      productId: sampleProduct.id,
      title: sampleProduct.title,
      price: sampleProduct.price,
      quantity: 1,
      size: "L",
      colorName: "Pitch Black",
    }],
    customerName: "Aman Sharma",
    customerEmail: "aman@example.com",
    customerPhone: "9876543210",
    address: "Flat 402, Sea View Residency, Bandra West",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400050",
    paymentMethod: "COD",
  };

  const quoteDisabled = quote(testInput, null);
  console.log("Quote when COD is OFF -> codAvailable:", quoteDisabled.codAvailable);
  assert.strictEqual(quoteDisabled.codAvailable, false, "codAvailable in quote must be false when COD is OFF");

  console.log("\n4. Testing Backend Security: Rejection of COD order when COD is OFF...");
  let rejected = false;
  try {
    await placeOrder(testInput, null);
  } catch (err) {
    rejected = true;
    console.log("Order rejected as expected with error:", err.message);
    assert.match(err.message, /Cash on Delivery/i, "Error message must mention Cash on Delivery");
  }
  assert.strictEqual(rejected, true, "Backend must reject COD order when COD is OFF");

  console.log("\n5. Testing Admin Toggle COD -> ON...");
  const enabled = await updateGatewaysConfig({ codEnabled: true }, "TestAdmin");
  assert.strictEqual(enabled.codEnabled, true, "codEnabled must be true after toggle");
  const readAfterEnable = getGatewaysConfig();
  assert.strictEqual(readAfterEnable.codEnabled, true, "Persisted gateways config must reflect codEnabled: true");
  console.log("Gateways config after enable:", readAfterEnable);

  console.log("\n6. Testing Quote when COD is ON...");
  const quoteEnabled = quote(testInput, null);
  console.log("Quote when COD is ON -> codAvailable:", quoteEnabled.codAvailable);
  assert.strictEqual(quoteEnabled.codAvailable, true, "codAvailable in quote must be true when COD is ON");

  console.log("\n7. Testing Order Placement when COD is ON...");
  const result = await placeOrder(testInput, null);
  console.log("Order placed successfully:", {
    orderNumber: result.order.orderNumber,
    paymentMethod: result.order.paymentMethod,
    paymentStatus: result.order.paymentStatus,
    total: result.order.total,
  });
  assert.strictEqual(result.order.paymentMethod, "COD", "paymentMethod must be COD");
  assert.strictEqual(result.order.paymentStatus, "PENDING", "paymentStatus must be PENDING for COD orders");

  console.log("\n8. Checking other payment gateways preservation...");
  assert.strictEqual(typeof readAfterEnable.razorpayEnabled, "boolean", "Razorpay config preserved");
  assert.strictEqual(typeof readAfterEnable.ownpayEnabled, "boolean", "OwnPay config preserved");
  assert.strictEqual(typeof readAfterEnable.manualUpiEnabled, "boolean", "Manual UPI config preserved");

  console.log("\n>>> ALL 8 VERIFICATION TESTS PASSED SUCCESSFULLY! <<<");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
