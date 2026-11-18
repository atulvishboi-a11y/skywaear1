import "dotenv/config";
import assert from "node:assert/strict";
import { ensureStateLoaded, readState } from "../src/lib/server/store.ts";
import {
  signUpCustomerWithPassword,
  placeOrder,
  storefrontSnapshot,
  saveRewardRules,
  claimCustomerCashback,
  submitWithdrawal,
} from "../src/lib/server/services.ts";
import { releaseDueCashback } from "../src/lib/vesting.ts";

const results = [];
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    results.push(`  ✅ PASS: ${name}`);
    console.log(`  ✅ PASS: ${name}`);
  } catch (err) {
    failed++;
    results.push(`  ❌ FAIL: ${name}\n     ${err.stack || err.message}`);
    console.error(`  ❌ FAIL: ${name}\n     ${err.stack || err.message}`);
  }
}

console.log("======================================================================");
console.log("   AUTOMATED VERIFICATION: FULL USER & REFERRAL LIFECYCLE FLOWS       ");
console.log("======================================================================\n");

async function run() {
  await ensureStateLoaded();
  const state = readState();

  const timestamp = Date.now().toString(36);
  const phoneA = `99${Math.floor(10000000 + Math.random() * 90000000)}`;
  const phoneB = `98${Math.floor(10000000 + Math.random() * 90000000)}`;

  let userA;
  let userB;
  let orderNumberB;

  // ---------------------------------------------------------------------------
  // FLOW 1: Admin Sets Commission Rate
  // ---------------------------------------------------------------------------
  console.log("--- 1. Admin Commission Rate Adjustment ---");
  await test("Admin can adjust referral commission rate from Admin Panel", async () => {
    const currentState = readState();
    const updatedRules = await saveRewardRules(
      {
        ...currentState.rewardRules,
        affiliateCommissionPercent: 15.0, // 15% commission
        minWithdrawalPoints: 10,          // Allow smaller test payouts
      },
      "Admin (admin@skywear.in)"
    );

    assert.equal(updatedRules.affiliateCommissionPercent, 15.0, "Commission rate updated to 15%");
    const fresh = readState();
    assert.equal(fresh.rewardRules.affiliateCommissionPercent, 15.0);
  });

  // ---------------------------------------------------------------------------
  // FLOW 2: User A Registers
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. User A Registration & Wallet Initialization ---");
  await test("User A registers and receives a unique referral code", async () => {
    userA = await signUpCustomerWithPassword({
      name: "User Alpha",
      phone: phoneA,
      email: `alpha_${timestamp}@test.com`,
      password: "Password@123",
    });

    assert.ok(userA.id, "User A ID generated");
    assert.ok(userA.referralCode, "User A referral code generated");
    assert.equal(userA.availablePoints, 0, "Initial available points 0");
    assert.equal(userA.pendingPoints, 0, "Initial pending points 0");
    assert.equal(userA.lifetimeEarnedPoints, 0, "Initial lifetime points 0");

    const snapA = storefrontSnapshot(userA.id);
    assert.equal(snapA.referrals.length, 0, "User A has 0 referrals initially");
  });

  // ---------------------------------------------------------------------------
  // FLOW 3: User B Registers using User A's Referral Link / Code
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. User B Referral Registration ---");
  await test("User B registers with User A's referral code and appears in User A's referral section without error", async () => {
    userB = await signUpCustomerWithPassword({
      name: "User Beta",
      phone: phoneB,
      email: `beta_${timestamp}@test.com`,
      password: "Password@123",
      referralCode: userA.referralCode,
    });

    assert.equal(userB.referredByCode, userA.referralCode, "User B linked to User A's referral code");

    // Check User A's referral dashboard
    const snapA = storefrontSnapshot(userA.id);
    assert.equal(snapA.referrals.length, 1, "User B appears in User A's referrals list");
    const refEntry = snapA.referrals[0];
    assert.equal(refEntry.friendName, "User Beta");
    assert.equal(refEntry.status, "PENDING", "Status is PENDING before any purchase");
    assert.equal(refEntry.commissionEarned, 0, "Commission is 0 before purchase");

    // Notification check
    const refreshedA = readState().customers.find((c) => c.id === userA.id);
    assert.ok(
      refreshedA.notifications && refreshedA.notifications.some((n) => n.title.includes("New Friend Registered")),
      "User A receives in-app notification about User B's registration"
    );
  });

  // ---------------------------------------------------------------------------
  // FLOW 4: User B Buys T-Shirt & Pays Online
  // ---------------------------------------------------------------------------
  console.log("\n--- 4. User B Purchase (Online Paid) & Cashback Crediting ---");
  await test("User B buys t-shirt online: gets 100% cashback in pending wallet & User A gets 15% instant commission", async () => {
    const currentState = readState();
    const tshirtProduct = currentState.products[0] || {
      id: "prod-test-tshirt",
      title: "Oversized Vintage T-Shirt",
      price: 999,
      mrp: 1999,
      cashbackPoints: 999,
      availableSizes: ["M", "L", "XL"],
    };

    const orderResult = await placeOrder(
      {
        customerName: "User Beta",
        customerPhone: userB.phone,
        customerEmail: userB.email,
        address: "742 Evergreen Terrace",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
        items: [
          {
            title: tshirtProduct.title,
            size: "L",
            colorName: "Washed Black",
            quantity: 1,
            price: tshirtProduct.price,
          },
        ],
        paymentMethod: "UPI",
        referralCode: userA.referralCode,
      },
      userB.id,
      {
        orderId: `rzp_order_${timestamp}`,
        paymentId: `rzp_pay_${timestamp}`,
        provider: "razorpay",
      }
    );

    const order = orderResult.order;
    orderNumberB = order.orderNumber;
    assert.equal(order.paymentStatus, "PAID", "Order payment status is PAID");
    assert.ok(order.pointsEarned > 0, "Points earned > 0");

    // Verify User B's wallet: pending wallet gets coins, available is 0
    const refreshedB = readState().customers.find((c) => c.id === userB.id);
    assert.equal(refreshedB.pendingPoints, order.pointsEarned, "Cashback credited to pendingPoints");
    assert.equal(refreshedB.availablePoints, 0, "Live available wallet is 0 before daily claim");
    assert.equal(refreshedB.lifetimeEarnedPoints, order.pointsEarned, "Lifetime earned tracks full amount");

    // Verify 30-day cashback schedule
    assert.ok(order.cashback && order.cashback.length === 30, "Cashback scheduled across 30 daily slices");
    assert.equal(order.cashback[0].week, 1, "Day 1 slice exists");

    // Verify User A's referral commission:
    // 15% of 999 = 149.85 Rupees (equivalent to 14,985 coins at 0.01/coin)
    const expectedCommRupees = Number(((order.subtotal * 15) / 100).toFixed(2));
    assert.equal(order.affiliateCommission, expectedCommRupees, "Affiliate commission calculated correctly");

    const snapA = storefrontSnapshot(userA.id);
    assert.equal(snapA.customer.referralBalanceRupees, expectedCommRupees, "User A referral balance credited");

    // Referral entry in User A's dashboard updated with order info
    const refEntry = snapA.referrals.find((r) => r.friendId === userB.id || r.orderNumber === order.orderNumber);
    assert.ok(refEntry, "User B's order linked to User A's referral lead");
    assert.equal(refEntry.status, "PAID", "Lead status updated to PAID");
    assert.equal(refEntry.commissionEarned, expectedCommRupees, "Commission earned recorded on lead");
  });

  // ---------------------------------------------------------------------------
  // FLOW 5: Daily Cashback Unlock and Claim by User B
  // ---------------------------------------------------------------------------
  console.log("\n--- 5. Daily Cashback Unlock & Claim ---");
  await test("Daily cashback unlock & claim transfers coins from pending to live Sky Cash wallet", async () => {
    // 1. Verify Day 1 slice is UNLOCKED (auto-unlocked by store on order day or via releaseDueCashback)
    const currentState = readState();
    const orderB = currentState.orders.find((o) => o.orderNumber === orderNumberB);
    assert.ok(orderB, "Order found in state");

    if (orderB.cashback[0].status === "LOCKED") {
      releaseDueCashback(currentState);
    }
    assert.equal(orderB.cashback[0].status, "UNLOCKED", "Day 1 slice is UNLOCKED and ready to collect");

    const customerBeforeClaim = currentState.customers.find((c) => c.id === userB.id);
    const initialPending = customerBeforeClaim.pendingPoints;

    // 2. User B claims daily cashback
    const claimRes = await claimCustomerCashback(userB.id);
    assert.ok(claimRes.claimedPoints > 0, "User B claimed unlocked daily coins");

    const stateAfterClaim = readState();
    const updatedCustomerB = stateAfterClaim.customers.find((c) => c.id === userB.id);
    assert.equal(updatedCustomerB.availablePoints, claimRes.claimedPoints, "Coins moved into Live Wallet");
    assert.equal(updatedCustomerB.pendingPoints, initialPending - claimRes.claimedPoints, "Pending wallet decreased");
    assert.equal(updatedCustomerB.lifetimeEarnedPoints, initialPending, "Lifetime points preserved");

    // 3. User B snapshot verification
    const snapB = storefrontSnapshot(userB.id);
    assert.equal(snapB.customer.availablePoints, claimRes.claimedPoints, "Snapshot available coins matches claim");
    assert.equal(snapB.customer.pendingPoints, initialPending - claimRes.claimedPoints, "Snapshot pending coins matches");
  });

  // ---------------------------------------------------------------------------
  // FLOW 6: User B Withdraws from Live Sky Cash Wallet
  // ---------------------------------------------------------------------------
  console.log("\n--- 6. Live Sky Cash Wallet Withdrawal & Metric Update ---");
  await test("User B withdraws live coins: balances and lifetime withdrawal metrics update correctly", async () => {
    const currentState = readState();
    const customerB = currentState.customers.find((c) => c.id === userB.id);
    const coinsToWithdraw = customerB.availablePoints;
    assert.ok(coinsToWithdraw >= 10, "Has at least min withdrawal coins");

    const withdrawalRes = await submitWithdrawal(
      {
        points: coinsToWithdraw,
        payoutMethod: "UPI",
        upiId: `userb_${timestamp}@okaxis`,
      },
      userB.id
    );

    assert.ok(withdrawalRes.withdrawal.id, "Withdrawal request ID created");
    assert.equal(withdrawalRes.withdrawal.overallStatus, "SUBMITTED_TO_BANK");
    assert.equal(withdrawalRes.withdrawal.totalPoints, coinsToWithdraw);

    // Verify User B's live available points decremented
    const stateAfterWithdraw = readState();
    const refreshedB = stateAfterWithdraw.customers.find((c) => c.id === userB.id);
    assert.equal(refreshedB.availablePoints, 0, "Available balance is now 0 after full withdrawal");

    // Verify snapshot counters
    const snapB = storefrontSnapshot(userB.id);
    assert.equal(snapB.customer.availablePoints, 0, "Live wallet counter: 0 Coins remaining");
    assert.ok(snapB.customer.pendingPoints > 0, "Pending wallet counter: remaining locked coins");

    // Check completed/processing withdrawals sum
    const totalWithdrawn = snapB.withdrawals
      .filter((w) => !["FAILED", "REJECTED", "REVERSED"].includes(w.overallStatus))
      .reduce((sum, w) => sum + (w.totalPoints ?? w.points ?? 0), 0);
    assert.equal(totalWithdrawn, coinsToWithdraw, "Total Withdrawn metric is exact");
  });

  // ---------------------------------------------------------------------------
  // FLOW 7: User A Instantly Withdraws Referral Commission
  // ---------------------------------------------------------------------------
  console.log("\n--- 7. Instant Referral Commission Withdrawal ---");
  await test("User A can instantly withdraw referral commission coins to UPI", async () => {
    const snapA = storefrontSnapshot(userA.id);
    const refRupees = snapA.customer.referralBalanceRupees;
    assert.ok(refRupees > 0, "User A has referral earnings");
    const refCoins = Math.round(refRupees / (readState().rewardRules.pointValueInRupees || 0.01));

    const withdrawalRes = await submitWithdrawal(
      {
        sourceType: "REFERRAL_CASH",
        amountRupees: refRupees,
        points: refCoins,
        payoutMethod: "UPI",
        upiId: `usera_${timestamp}@okhdfcbank`,
      },
      userA.id
    );

    assert.ok(withdrawalRes.withdrawal.id, "Referral payout request created");
    assert.equal(withdrawalRes.withdrawal.sourceType, "REFERRAL_CASH");
    assert.equal(withdrawalRes.withdrawal.overallStatus, "SUBMITTED_TO_BANK");

    // User A referral balance is now 0
    const refreshedSnapA = storefrontSnapshot(userA.id);
    assert.equal(refreshedSnapA.customer.referralBalanceRupees, 0, "Referral balance is now 0");

    // Attempting to withdraw again must fail with 409
    let duplicateRejected = false;
    try {
      await submitWithdrawal(
        {
          sourceType: "REFERRAL_CASH",
          amountRupees: 50,
          points: 5000,
          payoutMethod: "UPI",
          upiId: "useralpha@okhdfcbank",
        },
        userA.id
      );
    } catch (err) {
      if (err.status === 409 || err.statusCode === 409) {
        duplicateRejected = true;
      }
    }
    assert.equal(duplicateRejected, true, "Double-spending referral balance is strictly blocked (409 Conflict)");
  });

  // ---------------------------------------------------------------------------
  // SUMMARY REPORT
  // ---------------------------------------------------------------------------
  console.log("\n======================================================================");
  console.log("                           TEST RESULTS                               ");
  console.log("======================================================================\n");
  results.forEach((r) => console.log(r));
  console.log(`\nTOTAL: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
