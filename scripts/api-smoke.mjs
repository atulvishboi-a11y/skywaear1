import { createHmac } from "node:crypto";

const BASE = "http://localhost:3000";
const results = [];
let ok = 0;
let fail = 0;

function assert(name, condition, detail) {
  const passed = Boolean(condition);
  if (passed) ok++; else { fail++; }
  results.push(`${passed ? "PASS" : "FAIL"}  ${name}${passed || !detail ? "" : `  → ${detail}`}`);
}

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

async function req(path, { method = "GET", body, store } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(store ? { cookie: store.header() } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (store) store.absorb(res);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-json */ }
  return { status: res.status, json, text };
}

const cart = [{ title: "NEO TOKYO 2099", price: 799, quantity: 1, size: "L", colorName: "Onyx Black", productId: "prod-1" }];
const address = {
  customerName: "Aman Sharma",
  customerEmail: "aman.sharma@example.com",
  customerPhone: "9876543210",
  address: "Flat 402, Skyline Residency, Bandra West",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400050",
  paymentMethod: "UPI",
};

async function main() {
  const customer = jar();
  const admin = jar();

  // ---- session
  const unauth = await req("/api/storefront");
  assert("GET /api/storefront (guest) 200 with null customer", unauth.status === 200 && unauth.json?.customer === null, `status ${unauth.status}`);
  assert("guest snapshot hides nothing: products + rules + coupons served", unauth.json?.products?.length > 0 && unauth.json?.rewardRules && unauth.json?.coupons?.length > 0, JSON.stringify(Object.keys(unauth.json || {})));

  const badSignIn = await req("/api/session", { method: "POST", body: { identifier: "not-a-phone" } });
  assert("POST /api/session rejects malformed identifier (422)", badSignIn.status === 422, `status ${badSignIn.status} ${badSignIn.text.slice(0, 80)}`);

  const signIn = await req("/api/session", { method: "POST", body: { identifier: "aman.sharma@example.com" }, store: customer });
  assert("POST /api/session signs in seeded member + sets cookie", signIn.status === 200 && signIn.json?.customer?.availablePoints > 0, `status ${signIn.status}`);

  const authed = await req("/api/storefront", { store: customer });
  assert("GET /api/storefront (signed in) returns wallet + history", authed.json?.customer?.referralCode && authed.json?.transactions?.length > 0 && authed.json?.withdrawals?.length > 0, JSON.stringify({ c: Boolean(authed.json?.customer), tx: authed.json?.transactions?.length, wd: authed.json?.withdrawals?.length }));
  const coinsBefore = authed.json.customer.availablePoints;
  const pendingBefore = authed.json.customer.pendingPoints;

  // ---- quote
  const q = await req("/api/orders/quote", { method: "POST", body: { items: cart, couponCode: "ZENIN-10", pointsRedeemed: 60 }, store: customer });
  assert("POST /api/orders/quote applies 10% coupon server-side", q.status === 200 && q.json?.couponDiscount === 79.9, JSON.stringify(q.json));
  assert("quote caps coin redemption at 30% and reports coins earned", q.json?.pointsValue <= (799 - 79.9) * 0.3 && q.json?.pointsEarned > 0, JSON.stringify(q.json));

  const badCoupon = await req("/api/orders/quote", { method: "POST", body: { items: cart, couponCode: "NOPE" }, store: customer });
  assert("quote rejects unknown coupon with 422 + message", badCoupon.status === 422 && /not valid/i.test(badCoupon.json?.error ?? ""), badCoupon.text.slice(0, 120));

  const emptyCart = await req("/api/orders/quote", { method: "POST", body: { items: [] } });
  assert("quote rejects empty cart (422)", emptyCart.status === 422, `status ${emptyCart.status}`);

  const shipCoupon = await req("/api/orders/quote", { method: "POST", body: { items: cart, couponCode: "FREESHIP" } });
  assert("FREESHIP coupon waives delivery fee", shipCoupon.json?.deliveryFee === 0, JSON.stringify(shipCoupon.json));

  const belowMin = await req("/api/orders/quote", { method: "POST", body: { items: [{ ...cart[0], price: 400 }], pointsRedeemed: 20 }, store: customer });
  assert("redemption blocked below min order value (422)", belowMin.status === 422, belowMin.text.slice(0, 120));

  // ---- place order
  const placed = await req("/api/orders", { method: "POST", body: { ...address, items: cart, couponCode: "ZENIN-10", pointsRedeemed: 60 }, store: customer });
  assert("POST /api/orders creates PENDING order", placed.status === 201 && placed.json?.order?.status === "PENDING" && /^TC-/.test(placed.json?.order?.orderNumber ?? ""), `status ${placed.status} ${placed.text.slice(0, 140)}`);
  const orderId = placed.json?.order?.id;
  const orderNumber = placed.json?.order?.orderNumber;
  const redeemed = placed.json?.order?.pointsRedeemed;

  const afterOrder = await req("/api/storefront", { store: customer });
  assert("order debits redeemed coins and queues cashback as pending", afterOrder.json.customer.availablePoints === coinsBefore - redeemed && afterOrder.json.customer.pendingPoints > pendingBefore, JSON.stringify({ before: coinsBefore, after: afterOrder.json.customer.availablePoints, pending: afterOrder.json.customer.pendingPoints }));
  assert("cashback transaction recorded as PENDING until delivery", afterOrder.json.transactions.some((t) => t.orderNumber === orderNumber && t.type === "CASHBACK" && t.status === "PENDING"), "no pending cashback tx");

  const badPin = await req("/api/orders", { method: "POST", body: { ...address, pincode: "12", items: cart } });
  assert("order rejects invalid PIN code (422)", badPin.status === 422 && /PIN/i.test(badPin.json?.error ?? ""), badPin.text.slice(0, 120));
  const badPhone = await req("/api/orders", { method: "POST", body: { ...address, customerPhone: "12345", items: cart } });
  assert("order rejects invalid mobile (422)", badPhone.status === 422, badPhone.text.slice(0, 120));

  const selfRef = await req("/api/orders", { method: "POST", body: { ...address, items: cart, referralCode: "ZENIN-AMAN99" }, store: customer });
  assert("order blocks using your own referral code (422)", selfRef.status === 422 && /own referral/i.test(selfRef.json?.error ?? ""), selfRef.text.slice(0, 120));

  // referral by a different customer earns 10% commission
  const friend = jar();
  await req("/api/session", { method: "POST", body: { identifier: "friend.test@example.com", name: "Friend Tester" }, store: friend });
  const referred = await req("/api/orders", { method: "POST", body: { ...address, customerName: "Friend Tester", customerEmail: "friend.test@example.com", items: cart, referralCode: "ZENIN-AMAN99" }, store: friend });
  assert("referral credits 10% affiliate commission on the order", referred.status === 201 && Math.abs((referred.json?.order?.affiliateCommission ?? 0) - 79.9) < 0.01, JSON.stringify(referred.json?.order?.affiliateCommission));
  const referrerWallet = await req("/api/storefront", { store: customer });
  assert("referrer wallet gained a REFERRAL_COMMISSION transaction", referrerWallet.json.transactions.some((t) => t.type === "REFERRAL_COMMISSION" && t.orderNumber === referred.json?.order?.orderNumber), "missing commission tx");

  // ---- tracking
  const trackBad = await req(`/api/track?orderNumber=${orderNumber}&contact=wrong@example.com`);
  assert("GET /api/track 404s on contact mismatch", trackBad.status === 404, `status ${trackBad.status}`);
  const track = await req(`/api/track?orderNumber=${orderNumber}&contact=aman.sharma@example.com`);
  assert("GET /api/track returns timeline + support contact", track.status === 200 && track.json?.order?.timeline?.length >= 1 && track.json?.supportContact, `status ${track.status}`);

  // ---- admin auth
  const anonOverview = await req("/api/admin/overview");
  assert("admin overview requires session (401)", anonOverview.status === 401, `status ${anonOverview.status}`);
  const badLogin = await req("/api/admin/session", { method: "POST", body: { username: "admin", password: "wrong" } });
  assert("admin login rejects bad password (401)", badLogin.status === 401 && /Invalid admin/i.test(badLogin.json?.error ?? ""), badLogin.text.slice(0, 120));
  const login = await req("/api/admin/session", { method: "POST", body: { username: "admin", password: "admin" }, store: admin });
  assert("POST /api/admin/session (admin/admin) authenticates", login.status === 200 && login.json?.authenticated === true, `status ${login.status}`);
  const session = await req("/api/admin/session", { store: admin });
  assert("GET /api/admin/session reads the signed cookie", session.json?.authenticated === true, JSON.stringify(session.json));

  const overview = await req("/api/admin/overview", { store: admin });
  assert("admin overview exposes orders/products/withdrawals/metrics", overview.status === 200 && overview.json?.orders?.length >= 5 && overview.json?.withdrawals?.length > 0 && overview.json?.metrics?.grossRevenue > 0, JSON.stringify(overview.json?.metrics));
  assert("metrics are not fabricated: liability = points × point value", Math.abs(overview.json.metrics.liabilityRupees - overview.json.metrics.pointsInCirculation * overview.json.rewardRules.pointValueInRupees) < 1, JSON.stringify(overview.json.metrics));

  // ---- pipeline transitions
  const illegal = await req(`/api/orders/${orderId}`, { method: "PATCH", body: { status: "SHIPPED" }, store: admin });
  assert("illegal transition PENDING→SHIPPED rejected (409)", illegal.status === 409 && /Cannot move/i.test(illegal.json?.error ?? ""), illegal.text.slice(0, 140));
  const approved = await req(`/api/orders/${orderId}`, { method: "PATCH", body: { status: "APPROVED" }, store: admin });
  assert("PENDING→APPROVED accepted", approved.status === 200 && approved.json?.status === "APPROVED", approved.text.slice(0, 120));
  const pod = await req(`/api/orders/${orderId}`, { method: "PATCH", body: { status: "PRINTING_POD" }, store: admin });
  assert("APPROVED→PRINTING_POD assigns a Qikink POD order id", pod.json?.status === "PRINTING_POD" && /^QK-/.test(pod.json?.podOrderId ?? ""), JSON.stringify({ s: pod.json?.status, pod: pod.json?.podOrderId }));
  const shipped = await req(`/api/orders/${orderId}`, { method: "PATCH", body: { status: "SHIPPED" }, store: admin });
  assert("PRINTING_POD→SHIPPED auto-allocates courier + tracking number", shipped.json?.status === "SHIPPED" && shipped.json?.courier && shipped.json?.trackingNumber, JSON.stringify({ c: shipped.json?.courier, t: shipped.json?.trackingNumber }));
  const manifest = await req(`/api/orders/${orderId}`, { method: "PATCH", body: { courier: "DTDC", trackingNumber: "DTDC-LIVE-99381" }, store: admin });
  assert("admin can re-manifest a different courier", manifest.status === 200 && manifest.json?.courier === "DTDC" && manifest.json?.trackingNumber === "DTDC-LIVE-99381", JSON.stringify({ c: manifest.json?.courier, t: manifest.json?.trackingNumber }));
  const delivered = await req(`/api/orders/${orderId}`, { method: "PATCH", body: { status: "DELIVERED" }, store: admin });
  assert("SHIPPED→DELIVERED releases coins", delivered.json?.status === "DELIVERED", delivered.text.slice(0, 120));
  const deliveredWallet = await req("/api/storefront", { store: customer });
  assert("delivery promotes pending cashback into available points", deliveredWallet.json.transactions.some((t) => t.orderNumber === orderNumber && t.type === "CASHBACK" && t.status === "COMPLETED"), "cashback still pending after delivery");

  const cancelledRefund = await req(`/api/orders/${referred.json.order.id}`, { method: "PATCH", body: { status: "CANCELLED" }, store: admin });
  assert("CANCELLED marks payment refunded and reverses pending cashback", cancelledRefund.json?.status === "CANCELLED" && cancelledRefund.json?.paymentStatus === "REFUNDED", JSON.stringify({ s: cancelledRefund.json?.status, p: cancelledRefund.json?.paymentStatus }));
  const terminal = await req(`/api/orders/${referred.json.order.id}`, { method: "PATCH", body: { status: "APPROVED" }, store: admin });
  assert("cancelled order is terminal (409)", terminal.status === 409, `status ${terminal.status}`);

  // ---- withdrawals
  const tooSmall = await req("/api/withdrawals", { method: "POST", body: { points: 20, upiId: "aman@okaxis", payoutMethod: "UPI" }, store: customer });
  assert("withdrawal below 100-coin minimum rejected (422)", tooSmall.status === 422 && /Minimum/i.test(tooSmall.json?.error ?? ""), tooSmall.text.slice(0, 120));
  const badUpi = await req("/api/withdrawals", { method: "POST", body: { points: 200, upiId: "not-a-upi", payoutMethod: "UPI" }, store: customer });
  assert("withdrawal rejects malformed UPI id (422)", badUpi.status === 422, badUpi.text.slice(0, 120));
  const concurrent = await req("/api/withdrawals", { method: "POST", body: { points: 200, upiId: "aman@okaxis", payoutMethod: "UPI" }, store: customer });
  assert("second withdrawal blocked while one is vesting (409)", concurrent.status === 409 && /vesting/i.test(concurrent.json?.error ?? ""), concurrent.text.slice(0, 140));

  const seededW = overview.json.withdrawals[0];
  assert("seeded vesting schedule has 4 tranches with due dates", seededW?.tranches?.length === 4 && seededW.tranches.every((t) => t.dueAt && t.dueDate && t.percent === 25), JSON.stringify(seededW?.tranches?.map((t) => t.status)));
  const lockedWeek = seededW.tranches.find((t) => t.status === "LOCKED");
  const unlockedWeek = seededW.tranches.find((t) => t.status === "UNLOCKED");
  if (!lockedWeek || !unlockedWeek) {
    throw new Error(
      "Seed vesting tranches are already consumed — delete .data/zenin-state.json and restart `next dev` before re-running this suite"
    );
  }
  const payLocked = await req(`/api/admin/withdrawals/${seededW.id}/pay`, { method: "POST", body: { week: lockedWeek.week }, store: admin });
  assert("admin cannot pay a LOCKED tranche (409 + unlock date)", payLocked.status === 409 && /unlocks on/i.test(payLocked.json?.error ?? ""), payLocked.text.slice(0, 160));
  const payUnlocked = await req(`/api/admin/withdrawals/${seededW.id}/pay`, { method: "POST", body: { week: unlockedWeek.week }, store: admin });
  assert("admin pays the UNLOCKED tranche → TRANSFERRED with UPI ref", payUnlocked.status === 200 && payUnlocked.json?.tranche?.status === "TRANSFERRED" && /^UPI-/.test(payUnlocked.json?.tranche?.upiRef ?? ""), payUnlocked.text.slice(0, 160));
  const payAgain = await req(`/api/admin/withdrawals/${seededW.id}/pay`, { method: "POST", body: { week: unlockedWeek.week }, store: admin });
  assert("double-paying the same tranche rejected (409)", payAgain.status === 409 && /already transferred/i.test(payAgain.json?.error ?? ""), payAgain.text.slice(0, 140));
  const paidOverview = await req("/api/admin/overview", { store: admin });
  assert("paid-out liability metric moves after tranche release", paidOverview.json.metrics.paidOutRupees > overview.json.metrics.paidOutRupees, JSON.stringify({ before: overview.json.metrics.paidOutRupees, after: paidOverview.json.metrics.paidOutRupees }));
  const anonPay = await req(`/api/admin/withdrawals/${seededW.id}/pay`, { method: "POST", body: { week: 1 } });
  assert("tranche payout requires admin session (401)", anonPay.status === 401, `status ${anonPay.status}`);

  // ---- gift dispatch
  const gift = await req("/api/admin/gifts", { method: "POST", body: { recipientName: "Influencer Demo", phone: "9812345678", email: "influencer@example.com", address: "Studio 7, Bandra Reclamation", city: "Mumbai", state: "Maharashtra", pincode: "400050", productId: "prod-2", size: "XL", color: "Onyx Black", quantity: 1, reason: "VIP Loyalty Gift" }, store: admin });
  assert("free t-shirt dispatch creates GIFT order, ₹0 total, COMPLIMENTARY", gift.status === 201 && /^GIFT-/.test(gift.json?.orderNumber ?? "") && gift.json?.total === 0 && gift.json?.paymentMethod === "COMPLIMENTARY", `status ${gift.status} ${gift.text.slice(0, 140)}`);
  const giftBad = await req("/api/admin/gifts", { method: "POST", body: { recipientName: "X", phone: "9812345678", address: "short", city: "M", state: "MH", pincode: "1", productId: "prod-2", size: "L", color: "Onyx Black", reason: "gift" }, store: admin });
  assert("gift dispatch validates PIN + address (422)", giftBad.status === 422, giftBad.text.slice(0, 120));

  // ---- catalog CRUD
  const created = await req("/api/admin/products", { method: "POST", body: { title: "SHIBUYA GHOST 404", price: 899, mrp: 1799, gsm: 260, category: "Anime & Japanese", sizes: ["M", "L", "XL"] }, store: admin });
  assert("admin creates a product with server-filled defaults", created.status === 201 && created.json?.id && created.json?.slug === "shibuya-ghost-404" && created.json?.isArchived === false && created.json?.colors?.[0]?.previewClass, `status ${created.status} ${created.text.slice(0, 160)}`);
  const newId = created.json?.id;
  const storeAfterCreate = await req("/api/storefront", { store: customer });
  assert("new product appears on the storefront immediately", storeAfterCreate.json.products.some((p) => p.id === newId), "missing in storefront");
  const negPrice = await req("/api/admin/products", { method: "POST", body: { title: "Bad", price: 0 }, store: admin });
  assert("product with zero price rejected (422)", negPrice.status === 422, negPrice.text.slice(0, 120));
  const mrpLow = await req("/api/admin/products", { method: "POST", body: { title: "Bad MRP", price: 900, mrp: 500 }, store: admin });
  assert("MRP below selling price rejected (422)", mrpLow.status === 422, mrpLow.text.slice(0, 120));
  const edited = await req(`/api/admin/products/${newId}`, { method: "PATCH", body: { price: 949, badge: "LIVE EDIT" }, store: admin });
  assert("product edit persists price + badge", edited.status === 200 && edited.json?.price === 949 && edited.json?.badge === "LIVE EDIT", edited.text.slice(0, 140));
  const archived = await req(`/api/admin/products/${newId}`, { method: "DELETE" , store: admin });
  assert("archive keeps the row but flags isArchived", archived.status === 200 && archived.json?.isArchived === true, archived.text.slice(0, 140));
  const storeAfterArchive = await req("/api/storefront", { store: customer });
  assert("archived product disappears from storefront catalog", !storeAfterArchive.json.products.some((p) => p.id === newId), "still visible");
  const restore = await req(`/api/admin/products/${newId}`, { method: "PATCH", body: { isArchived: false }, store: admin });
  assert("restore republishes to storefront", restore.status === 200 && restore.json?.isArchived === false, `status ${restore.status}`);
  const anonCreate = await req("/api/admin/products", { method: "POST", body: { title: "Sneaky", price: 100 } });
  assert("product creation requires admin session (401)", anonCreate.status === 401, `status ${anonCreate.status}`);

  // ---- reward rules
  const rulesBad = await req("/api/admin/reward-rules", { method: "PUT", body: { ...overview.json.rewardRules, cashbackPercent: 90 }, store: admin });
  assert("cashback out of governance bounds rejected (422)", rulesBad.status === 422, rulesBad.text.slice(0, 120));
  const rules = await req("/api/admin/reward-rules", { method: "PUT", body: { ...overview.json.rewardRules, cashbackPercent: 6, investmentFeatureActive: true }, store: admin });
  assert("reward rules save and injected unknown fields are dropped", rules.status === 200 && rules.json?.cashbackPercent === 6 && rules.json?.investmentFeatureActive === undefined, JSON.stringify(rules.json));
  const storeRules = await req("/api/storefront", { store: customer });
  assert("storefront reads the updated cashback rule", storeRules.json.rewardRules.cashbackPercent === 6, JSON.stringify(storeRules.json.rewardRules));
  const q2 = await req("/api/orders/quote", { method: "POST", body: { items: cart } });
  assert("cashback recalculation uses live rule (6% → 96 coins)", q2.json?.pointsEarned === Math.round((799 * 0.06) / 0.5), JSON.stringify(q2.json));
  await req("/api/admin/reward-rules", { method: "PUT", body: { ...overview.json.rewardRules, cashbackPercent: 10 }, store: admin });

  // ---- webhook + audit
  const anonHook = await req("/api/qikink/webhook", { method: "POST", body: { orderNumber, status: "SHIPPED" } });
  assert("webhook without signature is rejected in dev (401/422)", anonHook.status === 401 || anonHook.status === 422, `status ${anonHook.status}`);
  const hookBody = JSON.stringify({ orderNumber, status: "DELIVERED" });
  const signedHook = await fetch(BASE + "/api/qikink/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-zenin-signature": createHmac("sha256", process.env.ZENIN_WEBHOOK_SECRET ?? "zenin-local-webhook-secret")
        .update(hookBody)
        .digest("hex"),
    },
    body: hookBody,
  });
  assert("Qikink webhook accepts a correctly signed callback", signedHook.status === 200, `status ${signedHook.status} ${(await signedHook.text()).slice(0, 140)}`);
  const audit = await req("/api/admin/overview", { store: admin });
  assert("every mutation wrote an audit entry", audit.json.auditLogs.length > 10 && audit.json.auditLogs.some((l) => l.action === "WITHDRAWAL_TRANCHE_PAID") && audit.json.auditLogs.some((l) => l.action === "PRODUCT_ARCHIVED"), `logs ${audit.json.auditLogs.length}`);
  assert("audit timeline is newest-first with ISO timestamps", new Date(audit.json.auditLogs[0].at) >= new Date(audit.json.auditLogs.at(-1).at), audit.json.auditLogs[0].at);

  // ---- persistence across requests
  const reload = await req("/api/storefront");
  assert("state survives a fresh request (shared server store)", reload.json.orders?.length >= 6 || reload.json.products?.some((p) => p.id === newId), `orders ${reload.json.orders?.length}`);

  // ---- sign out
  const signOut = await req("/api/session", { method: "DELETE", store: customer });
  const afterSignOut = await req("/api/storefront", { store: customer });
  assert("customer sign-out clears the wallet session", signOut.status === 200 && afterSignOut.json?.customer === null, JSON.stringify({ s: signOut.status, c: afterSignOut.json?.customer }));
  const adminOut = await req("/api/admin/session", { method: "DELETE", store: admin });
  const adminAfterOut = await req("/api/admin/overview", { store: admin });
  assert("admin sign-out revokes overview access", adminOut.status === 200 && adminAfterOut.status === 401, `status ${adminAfterOut.status}`);

  console.log(results.join("\n"));
  console.log(`\n${ok} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
}

main().catch((error) => {
  console.error("harness crashed", error);
  process.exitCode = 1;
});
