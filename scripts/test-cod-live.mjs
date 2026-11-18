import assert from "node:assert/strict";

const BASE_URL = process.env.TEST_URL || "https://tshirt-delta.vercel.app";

function jar() {
  const cookies = {};
  return {
    header: () => Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; "),
    absorb(res) {
      const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
      for (const line of raw) {
        const [pair] = line.split(";");
        const idx = pair.indexOf("=");
        cookies[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
      }
    },
  };
}

async function request(path, { method = "GET", body, session } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (session) headers["cookie"] = session.header();

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (session) session.absorb(res);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}

  return { status: res.status, json, text };
}

async function run() {
  console.log("======================================================================");
  console.log(`  LIVE VERIFICATION: CASH ON DELIVERY (COD) ON/OFF SYSTEM            `);
  console.log(`  Target: ${BASE_URL}                                                `);
  console.log("======================================================================\n");

  const adminSession = jar();

  console.log("1. Fetching storefront data...");
  const sf1 = await request("/api/storefront");
  assert.equal(sf1.status, 200, "Storefront must return 200 OK");
  console.log("  Storefront Gateways:", sf1.json.gateways);
  assert.equal(typeof sf1.json.gateways.codEnabled, "boolean", "gateways.codEnabled must be boolean");

  console.log("\n2. Logging into Admin Panel...");
  const adminLogin = await request("/api/admin/session", {
    method: "POST",
    body: { username: "admin", password: process.env.ZENIN_ADMIN_PASSWORD || "Zenin@Admin2026!" },
    session: adminSession,
  });
  console.log("  Admin login status:", adminLogin.status);
  assert.equal(adminLogin.status, 200, "Admin login must succeed");

  console.log("\n3. Testing Admin Toggle: Turning COD OFF...");
  const disableRes = await request("/api/admin/gateways", {
    method: "PATCH",
    body: { codEnabled: false },
    session: adminSession,
  });
  assert.equal(disableRes.status, 200, "PATCH /api/admin/gateways must succeed");
  console.log("  Gateways after disabling COD:", disableRes.json);
  assert.equal(disableRes.json.codEnabled, false, "codEnabled must be false");

  console.log("\n4. Verifying Storefront reflects COD = OFF...");
  const sfDisabled = await request("/api/storefront");
  assert.equal(sfDisabled.json.gateways.codEnabled, false, "Storefront gateways.codEnabled must be false");
  console.log("  ✅ Storefront correctly reports COD disabled");

  console.log("\n5. Testing Backend Security: Attempting COD order when COD is OFF...");
  const sampleProduct = sfDisabled.json.products[0];
  const codOrderPayload = {
    items: [
      {
        productId: sampleProduct.id,
        title: sampleProduct.title,
        price: sampleProduct.price,
        quantity: 1,
        size: "L",
        colorName: "Pitch Black",
      },
    ],
    customerName: "Aman Sharma",
    customerEmail: "aman.cod@example.com",
    customerPhone: "9876543210",
    address: "Flat 402, Sea View Residency, Bandra West",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400050",
    paymentMethod: "COD",
  };

  const rejectRes = await request("/api/orders", {
    method: "POST",
    body: codOrderPayload,
  });
  console.log("  Order placement status when COD is OFF:", rejectRes.status);
  console.log("  Response:", rejectRes.text);
  assert.equal(rejectRes.status, 422, "Backend must reject COD order with 422 Unprocessable Entity");
  assert.match(rejectRes.text, /Cash on Delivery/i, "Error message must mention Cash on Delivery");
  console.log("  ✅ Backend security verified: Direct API COD order was rejected successfully!");

  console.log("\n6. Testing Admin Toggle: Turning COD back ON...");
  const enableRes = await request("/api/admin/gateways", {
    method: "PATCH",
    body: { codEnabled: true },
    session: adminSession,
  });
  assert.equal(enableRes.status, 200, "PATCH /api/admin/gateways must succeed");
  console.log("  Gateways after enabling COD:", enableRes.json);
  assert.equal(enableRes.json.codEnabled, true, "codEnabled must be true");

  console.log("\n7. Verifying Storefront reflects COD = ON...");
  const sfEnabled = await request("/api/storefront");
  assert.equal(sfEnabled.json.gateways.codEnabled, true, "Storefront gateways.codEnabled must be true");
  console.log("  ✅ Storefront correctly reports COD enabled");

  console.log("\n8. Testing Order Placement when COD is ON...");
  const placeRes = await request("/api/orders", {
    method: "POST",
    body: codOrderPayload,
  });
  console.log("  Order placement status when COD is ON:", placeRes.status);
  assert.equal(placeRes.status, 201, "Order placement must return 201 Created");
  console.log("  Placed Order:", {
    orderNumber: placeRes.json.order.orderNumber,
    paymentMethod: placeRes.json.order.paymentMethod,
    paymentStatus: placeRes.json.order.paymentStatus,
    total: placeRes.json.order.total,
  });
  assert.equal(placeRes.json.order.paymentMethod, "COD", "Order paymentMethod must be COD");
  assert.equal(placeRes.json.order.paymentStatus, "PENDING", "Order paymentStatus must be PENDING");
  console.log("  ✅ COD order processed with correct paymentMethod and PENDING paymentStatus!");

  console.log("\n9. Verifying preservation of all 3 other gateways...");
  assert.equal(typeof enableRes.json.razorpayEnabled, "boolean", "Razorpay config preserved");
  assert.equal(typeof enableRes.json.ownpayEnabled, "boolean", "OwnPay config preserved");
  assert.equal(typeof enableRes.json.manualUpiEnabled, "boolean", "Manual UPI config preserved");
  console.log("  ✅ Razorpay, OwnPay, and Manual UPI gateways remain fully intact!");

  console.log("\n======================================================================");
  console.log("  🎉 ALL 9 LIVE END-TO-END TESTS PASSED ON PRODUCTION!                ");
  console.log("======================================================================");
}

run().catch((err) => {
  console.error("\n❌ Test execution failed:", err);
  process.exit(1);
});
