import assert from "node:assert/strict";
import {
  buildCashbackSchedule,
  releaseDueCashback,
  claimCashbackCoins,
  cashbackTotals,
  CASHBACK_CYCLE_DAYS,
  buildVestingSchedule,
  refreshVesting,
} from "../src/lib/vesting.ts";

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

console.log("======================================================================");
console.log("   AUTOMATED VERIFICATION: 30-DAY DAILY CASHBACK & SAME-DAY PAYOUT    ");
console.log("======================================================================\n");

// -----------------------------------------------------------------------------
// TEST SUITE 1: 30-Day Daily Schedule Generation
// -----------------------------------------------------------------------------
console.log("--- 1. 30-Day Daily Schedule Generation ---");

test("Cashback cycle is strictly 30 days (1 month)", () => {
  assert.equal(CASHBACK_CYCLE_DAYS, 30);
});

test("30 coins earned: 1 coin/day across 30 days with Day 1 having dayOffset = 0", () => {
  const tranches = buildCashbackSchedule(30, 1.0, "2026-03-01T10:00:00.000Z");
  assert.equal(tranches.length, 30);

  // Day 1 has dayOffset = 0
  assert.equal(tranches[0].week, 1);
  assert.equal(tranches[0].points, 1);
  assert.equal(tranches[0].rupeeAmount, 1.0);
  assert.equal(tranches[0].dueAt, "2026-03-01T10:00:00.000Z");

  // Sum must be exactly 30 points and 30 rupees
  const sumPoints = tranches.reduce((s, t) => s + t.points, 0);
  const sumRupees = tranches.reduce((s, t) => s + t.rupeeAmount, 0);
  assert.equal(sumPoints, 30);
  assert.equal(Number(sumRupees.toFixed(2)), 30.0);
});

test("Odd cashback amounts handle remainder across 30 days without loss (e.g. 50 coins)", () => {
  const tranches = buildCashbackSchedule(50, 1.0, "2026-03-01T10:00:00.000Z");
  assert.equal(tranches.length, 30);

  const sumPoints = tranches.reduce((s, t) => s + t.points, 0);
  const sumRupees = tranches.reduce((s, t) => s + t.rupeeAmount, 0);
  assert.equal(sumPoints, 50);
  assert.equal(Number(sumRupees.toFixed(2)), 50.0);
});

// -----------------------------------------------------------------------------
// TEST SUITE 2: Instant Day 1 Unlock on Order Confirmation
// -----------------------------------------------------------------------------
console.log("\n--- 2. Instant Day 1 Unlock on Order Date ---");

function createMockState(orderDateIso, totalPoints = 30) {
  const orderNumber = "TC-TEST-" + Math.floor(Math.random() * 100000);
  const tranches = buildCashbackSchedule(totalPoints, 1.0, orderDateIso);

  const customer = {
    id: "cust-test-1",
    name: "Test Customer",
    availablePoints: 0, // Live Wallet
    pendingPoints: totalPoints, // Pending Cashback
    lifetimeEarnedPoints: totalPoints,
  };

  const order = {
    id: "order-test-1",
    orderNumber,
    customerId: customer.id,
    pointsEarned: totalPoints,
    paymentStatus: "PAID",
    status: "DELIVERED",
    placedAt: orderDateIso,
    cashback: tranches,
    timeline: [{ label: "PLACED", at: orderDateIso }],
    items: [],
  };

  const state = {
    customers: [customer],
    orders: [order],
    transactions: [],
    rewardRules: { pointValueInRupees: 1.0 },
    notifications: [],
  };

  return { state, customer, order };
}

test("On Order Placement (Day 1): Slice 1 transitions to UNLOCKED (Ready to Collect) and user collects it", () => {
  const now = new Date();
  const { state, customer, order } = createMockState(now.toISOString(), 30);

  const newlyUnlocked = releaseDueCashback(state);
  assert.equal(newlyUnlocked, 1, "Day 1 slice (1 coin) unlocks immediately on order confirmation");
  assert.equal(order.cashback[0].status, "UNLOCKED", "Slice 1 is UNLOCKED ready to collect");
  assert.equal(order.cashback[1].status, "LOCKED", "Slice 2 remains LOCKED");

  // Customer taps Collect
  const claimResult = claimCashbackCoins(state, customer.id);
  assert.equal(claimResult.claimedPoints, 1, "Collected 1 coin");
  assert.equal(customer.availablePoints, 1, "Live Wallet now has 1 coin");
  assert.equal(customer.pendingPoints, 29, "Pending Cashback reduced to 29 coins");
  assert.equal(order.cashback[0].status, "RELEASED");
});

test("After 10 days: 10 daily slices unlock and user can collect them all", () => {
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const { state, customer, order } = createMockState(tenDaysAgo, 30);

  const newlyUnlocked = releaseDueCashback(state);
  assert.ok(newlyUnlocked >= 10, "At least 10 daily slices unlocked");
  assert.equal(order.cashback[0].status, "UNLOCKED");

  // User collects all ready coins
  const claimResult = claimCashbackCoins(state, customer.id);
  assert.ok(claimResult.claimedPoints >= 10, "Collected at least 10 coins");
  assert.ok(customer.availablePoints >= 10);
  assert.equal(order.cashback[0].status, "RELEASED");
});

test("After 30+ days: 100% of all 30 daily slices unlock and user can collect all 30 coins", () => {
  const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
  const { state, customer, order } = createMockState(thirtyOneDaysAgo, 30);

  const newlyUnlocked = releaseDueCashback(state);
  assert.equal(newlyUnlocked, 30, "All 30 slices unlocked ready to collect");

  // User collects all
  const claimResult = claimCashbackCoins(state, customer.id);
  assert.equal(claimResult.claimedPoints, 30, "All 30 coins collected");
  assert.equal(customer.availablePoints, 30, "Full 30 coins in Live Wallet");
  assert.equal(customer.pendingPoints, 0, "0 pending coins left");
  assert.equal(order.cashback.every((t) => t.status === "RELEASED"), true);
});

// -----------------------------------------------------------------------------
// TEST SUITE 3: Same-Day Payout / Withdrawal
// -----------------------------------------------------------------------------
console.log("\n--- 3. Same-Day Payout / Withdrawal ---");

test("Withdrawal schedule has 1 tranche with 100% UNLOCKED immediately ready for admin payout (zero parts)", () => {
  const now = new Date().toISOString();
  const tranches = buildVestingSchedule(400, 0.5, now);

  assert.equal(tranches.length, 1);
  assert.equal(tranches[0].week, 1);
  assert.equal(tranches[0].percent, 100);
  assert.equal(tranches[0].points, 400);
  assert.equal(tranches[0].rupeeAmount, 200);
  assert.equal(tranches[0].status, "UNLOCKED");
});

test("Payout request is placed as SUBMITTED_TO_BANK, and becomes PAID only when transferred by admin", () => {
  const now = new Date().toISOString();
  const tranches = buildVestingSchedule(400, 0.5, now);
  const request = {
    id: "wth-test-1",
    customerId: "cust-test-1",
    customerName: "Test User",
    phone: "9876543210",
    upiId: "test@upi",
    payoutMethod: "UPI",
    totalPoints: 400,
    totalRupees: 200,
    requestedAt: now,
    purchaseOrderNumber: "ORD-1",
    anchorDate: now,
    tranches,
    overallStatus: "SUBMITTED_TO_BANK",
  };

  // Before admin payout: stays SUBMITTED_TO_BANK (not fake instant PAID)
  const initial = refreshVesting(request);
  assert.equal(initial.tranches[0].status, "UNLOCKED");
  assert.equal(initial.overallStatus, "SUBMITTED_TO_BANK");

  // Admin marks it transferred
  request.tranches[0].status = "TRANSFERRED";
  request.tranches[0].transferredAt = new Date().toLocaleString("en-IN");
  request.tranches[0].upiRef = "UPI-99887766";

  const settled = refreshVesting(request);
  assert.equal(settled.tranches[0].status, "TRANSFERRED");
  assert.equal(settled.overallStatus, "PAID");
});

// -----------------------------------------------------------------------------
// PRINT REPORT
// -----------------------------------------------------------------------------
console.log("\n======================================================================");
console.log("                           TEST RESULTS                               ");
console.log("======================================================================");
results.forEach((r) => console.log(r));
console.log(`\nTOTAL: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
