import assert from "node:assert/strict";
import {
  buildCashbackUnlockNotification,
  dispatchCashbackUnlockNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../src/lib/server/notifications.ts";
import { buildCashbackSchedule, releaseDueCashback } from "../src/lib/vesting.ts";

const results = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    results.push(`  ✅ PASS: ${name}`);
  } catch (err) {
    failed++;
    results.push(`  ❌ FAIL: ${name}\n     ${err.message}`);
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    passed++;
    results.push(`  ✅ PASS: ${name}`);
  } catch (err) {
    failed++;
    results.push(`  ❌ FAIL: ${name}\n     ${err.message}`);
  }
}

console.log("======================================================================");
console.log("    AUTOMATED VERIFICATION: CASHBACK NOTIFICATION ENGINE              ");
console.log("======================================================================\n");

const mockCustomer = {
  id: "cust-test-01",
  name: "Kabir Mehra",
  email: "kabir.mehra@example.com",
  phone: "+91 98765 43210",
  referralCode: "KABIR10",
  tier: "Silver",
  availablePoints: 250,
  pendingPoints: 750,
  lifetimeEarnedPoints: 1000,
  addresses: [],
};

const mockOrder = {
  id: "ord-test-101",
  orderNumber: "TC-99201",
  total: 2000,
  pointsEarned: 1000,
  paymentStatus: "PAID",
  status: "APPROVED",
  customerId: "cust-test-01",
  placedAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
};

const mockSlice = {
  week: 1,
  percent: 25,
  points: 250,
  rupeeAmount: 250,
  dueAt: new Date(Date.now() - 86_400_000).toISOString(),
  dueDate: "Week 1 (Day 7)",
  status: "RELEASED",
  releasedAt: new Date().toISOString(),
};

// -----------------------------------------------------------------------------
// TEST SUITE 1: Multi-Channel Template Rendering & Formatting
// -----------------------------------------------------------------------------
console.log("--- 1. Multi-Channel Template Rendering & Formatting ---");

test("Notification builder produces complete payload across all 4 channels", () => {
  const notif = buildCashbackUnlockNotification({
    customer: mockCustomer,
    order: mockOrder,
    slice: mockSlice,
    liveWalletPoints: mockCustomer.availablePoints,
    pointValue: 1.0,
    storeUrl: "http://localhost:3000",
  });

  assert.equal(notif.id, "notif-cb-TC-99201-w1");
  assert.ok(notif.title.includes("Week 1 Cashback Unlocked: ₹250.00"));
  assert.ok(notif.message.includes("₹250.00 (250 Coins)"));
  assert.ok(notif.whatsappUrl.startsWith("https://wa.me/919876543210"));
  assert.ok(notif.whatsappText.includes("ZENIN CASHBACK UNLOCKED"));
  assert.ok(notif.smsContent.includes("ZENIN: Week 1 cashback"));
  assert.ok(notif.emailContent.subject.includes("₹250.00 Cashback Unlocked!"));
  assert.ok(notif.emailContent.html.includes("<!DOCTYPE html>"));
  assert.ok(notif.emailContent.text.includes("ZENIN STREETWEAR — CASHBACK UNLOCKED"));
});

test("WhatsApp URL correctly encodes normalized phone number and deep link", () => {
  const notif = buildCashbackUnlockNotification({
    customer: { ...mockCustomer, phone: "9876543210" }, // 10-digit without country code
    order: mockOrder,
    slice: mockSlice,
    liveWalletPoints: 500,
  });

  assert.ok(notif.whatsappUrl.startsWith("https://wa.me/919876543210"));
  assert.ok(notif.whatsappUrl.includes("text="));
  assert.ok(decodeURIComponent(notif.whatsappUrl).includes("Hey Kabir!"));
});

test("SMS content satisfies 160-character transactional GSM limit", () => {
  const notif = buildCashbackUnlockNotification({
    customer: mockCustomer,
    order: mockOrder,
    slice: mockSlice,
    liveWalletPoints: 250,
  });

  assert.ok(
    notif.smsContent.length <= 160,
    `SMS length (${notif.smsContent.length}) exceeded 160 character DLT limit: "${notif.smsContent}"`
  );
});

// -----------------------------------------------------------------------------
// TEST SUITE 2: Dispatcher & In-App Notification State
// -----------------------------------------------------------------------------
console.log("\n--- 2. Dispatcher & In-App Notification State ---");

test("dispatchCashbackUnlockNotification creates structured notification in state", () => {
  const state = {
    notifications: [],
    rewardRules: { pointValueInRupees: 1.0 },
  };

  const created = dispatchCashbackUnlockNotification(
    state,
    mockCustomer,
    mockOrder,
    mockSlice
  );

  assert.ok(created);
  assert.equal(state.notifications.length, 1);
  assert.equal(created.id, "notif-cb-TC-99201-w1");
  assert.equal(created.customerId, mockCustomer.id);
  assert.equal(created.type, "CASHBACK_UNLOCKED");
  assert.equal(created.read, false);
  assert.deepEqual(created.channels, ["IN_APP", "WHATSAPP", "SMS", "EMAIL"]);
  assert.equal(created.channelStatus.inApp, "DELIVERED");
  assert.equal(created.channelStatus.whatsapp, "PREPARED");
});

test("Dispatcher is strictly idempotent for the same order and week", () => {
  const state = {
    notifications: [],
    rewardRules: { pointValueInRupees: 1.0 },
  };

  const first = dispatchCashbackUnlockNotification(state, mockCustomer, mockOrder, mockSlice);
  const second = dispatchCashbackUnlockNotification(state, mockCustomer, mockOrder, mockSlice);

  assert.equal(state.notifications.length, 1, "Duplicate notification must not be appended");
  assert.equal(first.id, second.id);
});

// -----------------------------------------------------------------------------
// TEST SUITE 3: Automated Unlock Trigger Integration
// -----------------------------------------------------------------------------
console.log("\n--- 3. Automated Unlock Trigger Integration ---");

test("releaseDueCashback automatically creates notification when slice unlocks", () => {
  const orderWithSchedule = {
    ...mockOrder,
    cashback: buildCashbackSchedule(1000, 1.0, new Date(Date.now() - 10 * 86_400_000).toISOString()),
  };

  const buyer = {
    ...mockCustomer,
    availablePoints: 0,
    pendingPoints: 1000,
  };

  const state = {
    orders: [orderWithSchedule],
    customers: [buyer],
    transactions: [],
    notifications: [],
    rewardRules: { pointValueInRupees: 1.0 },
  };

  const unlockedCount = releaseDueCashback(state);
  assert.ok(unlockedCount > 0, "At least one tranche must unlock");
  assert.ok(state.notifications.length > 0, "Notification must be generated on unlock");

  const unlockNotif = state.notifications[0];
  assert.equal(unlockNotif.type, "CASHBACK_UNLOCKED");
  assert.equal(unlockNotif.customerId, buyer.id);
  assert.equal(unlockNotif.read, false);
  assert.equal(unlockNotif.metadata.orderNumber, orderWithSchedule.orderNumber);
});

// -----------------------------------------------------------------------------
// TEST SUITE 4: Read Status & Acknowledgment Workflow
// -----------------------------------------------------------------------------
console.log("\n--- 4. Read Status & Acknowledgment Workflow ---");

test("markNotificationAsRead transitions notification to read: true and channelStatus: READ", () => {
  const state = {
    notifications: [
      {
        id: "notif-1",
        customerId: "cust-01",
        read: false,
        channelStatus: { inApp: "DELIVERED" },
      },
      {
        id: "notif-2",
        customerId: "cust-01",
        read: false,
        channelStatus: { inApp: "DELIVERED" },
      },
    ],
  };

  const updated = markNotificationAsRead(state, "notif-1", "cust-01");
  assert.ok(updated);
  assert.equal(updated.read, true);
  assert.equal(updated.channelStatus.inApp, "READ");
  assert.equal(state.notifications[1].read, false, "Untargeted notification remains unread");
});

test("markAllNotificationsAsRead marks all customer notifications as read", () => {
  const state = {
    notifications: [
      { id: "notif-a", customerId: "cust-01", read: false, channelStatus: { inApp: "DELIVERED" } },
      { id: "notif-b", customerId: "cust-01", read: false, channelStatus: { inApp: "DELIVERED" } },
      { id: "notif-c", customerId: "cust-02", read: false, channelStatus: { inApp: "DELIVERED" } },
    ],
  };

  const count = markAllNotificationsAsRead(state, "cust-01");
  assert.equal(count, 2);
  assert.equal(state.notifications[0].read, true);
  assert.equal(state.notifications[1].read, true);
  assert.equal(state.notifications[2].read, false, "Other customer's notification remains unread");
});

// -----------------------------------------------------------------------------
// TEST SUITE 5: Live API Endpoints Check
// -----------------------------------------------------------------------------
console.log("\n--- 5. Live HTTP API Endpoints ---");

let hostUrl = null;
for (const testHost of ["http://127.0.0.1:3000", "http://localhost:3000"]) {
  try {
    const probe = await fetch(`${testHost}/api/notifications`, {
      signal: AbortSignal.timeout(1500),
    });
    if (probe.status === 200) {
      hostUrl = testHost;
      break;
    }
  } catch {}
}

if (hostUrl) {
  console.log(`  Connected to live dev server at ${hostUrl}`);

  await testAsync("GET /api/notifications returns 200 OK and notifications array", async () => {
    const res = await fetch(`${hostUrl}/api/notifications`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.notifications));
  });

  await testAsync("GET /api/notifications/preview returns WhatsApp, SMS, and Email previews", async () => {
    const res = await fetch(`${hostUrl}/api/notifications/preview?week=2&orderNumber=TC-88990&amount=300`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.preview);
    assert.ok(body.preview.whatsappUrl.includes("wa.me"));
    assert.ok(body.preview.smsContent.includes("ZENIN: Week 2"));
    assert.ok(body.preview.emailContent.html.includes("<!DOCTYPE html>"));
  });

  await testAsync("POST /api/notifications with { all: true } executes successfully", async () => {
    const res = await fetch(`${hostUrl}/api/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
  });
} else {
  console.log("  ℹ️ Local dev server is not active on http://127.0.0.1:3000 or http://localhost:3000.");
  console.log("     Skipping live HTTP probe (all unit/engine tests executed).");
}

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log("\n======================================================================");
console.log("                           TEST RESULTS                               ");
console.log("======================================================================");
for (const line of results) {
  console.log(line);
}
console.log("----------------------------------------------------------------------");
console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log("======================================================================\n");

if (failed > 0) {
  process.exit(1);
}
