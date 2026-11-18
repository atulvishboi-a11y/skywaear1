import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

// Read DATABASE_URL from .env
const envPath = path.join(process.cwd(), ".env");
let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("DATABASE_URL=")) {
      databaseUrl = trimmed.substring("DATABASE_URL=".length).replace(/^["']|["']$/g, "");
      break;
    }
  }
}

if (!databaseUrl) {
  databaseUrl = "postgresql://postgres:postgres@localhost:5432/tshirt_db?schema=public";
}

console.log("[migration] Connecting to PostgreSQL:", databaseUrl.replace(/:[^:@]+@/, ":****@"));

const isCloudDb = databaseUrl.includes("neon.tech") || databaseUrl.includes("sslmode=require") || databaseUrl.includes("supabase.co");
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isCloudDb ? { rejectUnauthorized: false } : undefined,
});

function parseDate(val, fallback = new Date()) {
  if (!val) return fallback;
  const d = new Date(val);
  return isNaN(d.getTime()) ? fallback : d;
}

async function run() {
  const statePath = path.join(process.cwd(), ".data", "zenin-state.json");
  if (!fs.existsSync(statePath)) {
    throw new Error(`State file not found at ${statePath}`);
  }

  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  console.log("[migration] Loaded state file from .data/zenin-state.json");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. RewardRules
    console.log("[migration] 1/11 Migrating RewardRules...");
    const rules = state.rewardRules || {};
    await client.query(
      `INSERT INTO "RewardRule" (
        "id", "name", "cashbackPercent", "pointValueInRupees",
        "maxRedemptionPercent", "minOrderForRedemption", "affiliateCommissionPct", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT ("id") DO UPDATE SET
        "name" = EXCLUDED."name",
        "cashbackPercent" = EXCLUDED."cashbackPercent",
        "pointValueInRupees" = EXCLUDED."pointValueInRupees",
        "maxRedemptionPercent" = EXCLUDED."maxRedemptionPercent",
        "minOrderForRedemption" = EXCLUDED."minOrderForRedemption",
        "affiliateCommissionPct" = EXCLUDED."affiliateCommissionPct",
        "updatedAt" = EXCLUDED."updatedAt"`,
      [
        "rule_default",
        "Standard Customer Cashback",
        rules.cashbackPercent ?? 10.0,
        rules.pointValueInRupees ?? 0.50,
        rules.maxRedemptionPercent ?? 30.0,
        rules.minOrderForRedemption ?? 499.0,
        rules.affiliateCommissionPercent ?? rules.affiliateCommissionPct ?? 10.0,
        new Date(),
      ]
    );

    // 2. Customers -> User table
    console.log(`[migration] 2/11 Migrating ${state.customers.length} Users/Customers...`);
    const existingUserIds = new Set();
    const userEmailMap = new Map();

    for (const c of state.customers) {
      existingUserIds.add(c.id);
      userEmailMap.set(c.email, c.id);
      await client.query(
        `INSERT INTO "User" (
          "id", "name", "email", "phone", "role",
          "referralCode", "referredByCode", "tier",
          "availablePoints", "pendingPoints", "lifetimeEarnedPoints",
          "addresses", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT ("id") DO UPDATE SET
          "name" = EXCLUDED."name",
          "email" = EXCLUDED."email",
          "phone" = EXCLUDED."phone",
          "referralCode" = EXCLUDED."referralCode",
          "tier" = EXCLUDED."tier",
          "availablePoints" = EXCLUDED."availablePoints",
          "pendingPoints" = EXCLUDED."pendingPoints",
          "lifetimeEarnedPoints" = EXCLUDED."lifetimeEarnedPoints",
          "addresses" = EXCLUDED."addresses",
          "updatedAt" = EXCLUDED."updatedAt"`,
        [
          c.id,
          c.name,
          c.email,
          c.phone || null,
          c.role === "ADMIN" ? "ADMIN" : "CUSTOMER",
          c.referralCode,
          c.referredByCode || null,
          c.tier || "Silver",
          c.availablePoints || 0,
          c.pendingPoints || 0,
          c.lifetimeEarnedPoints || 0,
          JSON.stringify(c.addresses || []),
          parseDate(c.createdAt),
          parseDate(c.updatedAt),
        ]
      );
    }

    // 3. Products
    console.log(`[migration] 3/11 Migrating ${state.products.length} Products...`);
    const existingProductIds = new Set();
    const productTitleMap = new Map();

    for (const p of state.products) {
      existingProductIds.add(p.id);
      productTitleMap.set(p.title.toLowerCase().trim(), p.id);

      await client.query(
        `INSERT INTO "Product" (
          "id", "slug", "title", "subtitle", "description",
          "category", "price", "mrp", "gsm", "fabric",
          "badge", "graphicTitle", "graphicType", "accentColor",
          "colors", "sizes", "images", "stock", "isArchived",
          "cashbackPoints", "codAvailable", "rating", "reviewCount",
          "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
        ON CONFLICT ("id") DO UPDATE SET
          "slug" = EXCLUDED."slug",
          "title" = EXCLUDED."title",
          "subtitle" = EXCLUDED."subtitle",
          "description" = EXCLUDED."description",
          "category" = EXCLUDED."category",
          "price" = EXCLUDED."price",
          "mrp" = EXCLUDED."mrp",
          "gsm" = EXCLUDED."gsm",
          "fabric" = EXCLUDED."fabric",
          "badge" = EXCLUDED."badge",
          "graphicTitle" = EXCLUDED."graphicTitle",
          "graphicType" = EXCLUDED."graphicType",
          "accentColor" = EXCLUDED."accentColor",
          "colors" = EXCLUDED."colors",
          "sizes" = EXCLUDED."sizes",
          "images" = EXCLUDED."images",
          "stock" = EXCLUDED."stock",
          "isArchived" = EXCLUDED."isArchived",
          "cashbackPoints" = EXCLUDED."cashbackPoints",
          "codAvailable" = EXCLUDED."codAvailable",
          "rating" = EXCLUDED."rating",
          "reviewCount" = EXCLUDED."reviewCount",
          "updatedAt" = EXCLUDED."updatedAt"`,
        [
          p.id,
          p.slug,
          p.title,
          p.subtitle || null,
          p.description,
          p.category,
          p.price,
          p.mrp,
          p.gsm || 240,
          p.fabric || "100% Super-Combed Bio-Washed Cotton",
          p.badge || null,
          p.graphicTitle || null,
          p.graphicSvgType || p.graphicType || "cyber_tokyo",
          p.accentColor || "#fbbf24",
          JSON.stringify(p.colors || []),
          p.sizes || [],
          p.images || [],
          p.stock ?? 60,
          Boolean(p.isArchived),
          p.cashbackPoints ?? null,
          p.codAvailable !== false,
          p.rating || 4.9,
          p.reviewsCount ?? p.reviewCount ?? 0,
          parseDate(p.createdAt),
          parseDate(p.updatedAt),
        ]
      );
    }

    // 4. Orders, OrderItems, Timelines, CashbackTranches
    console.log(`[migration] 4/11 Migrating ${state.orders.length} Orders with Items, Timelines & Cashback...`);
    let totalItems = 0;
    let totalTimeline = 0;
    let totalCashback = 0;

    for (const o of state.orders) {
      const userId = o.customerId && existingUserIds.has(o.customerId) ? o.customerId : null;
      const courier = ["BlueDart", "Delhivery", "DTDC", "EcomExpress"].includes(o.courier) ? o.courier : null;

      await client.query(
        `INSERT INTO "Order" (
          "id", "orderNumber", "kind", "userId",
          "customerName", "customerEmail", "customerPhone",
          "address", "city", "state", "pincode",
          "subtotal", "couponCode", "discount",
          "pointsRedeemed", "pointsRedeemedValue", "pointsEarned",
          "affiliateCommission", "referrerCode", "deliveryFee", "total",
          "paymentMethod", "paymentStatus", "status",
          "courier", "trackingNumber", "trackingUrl",
          "podProvider", "podOrderId", "podStatus", "giftReason",
          "gateway", "gatewayOrderId", "gatewayPaymentId",
          "placedAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
          $31, $32, $33, $34, $35, $36
        )
        ON CONFLICT ("id") DO UPDATE SET
          "orderNumber" = EXCLUDED."orderNumber",
          "status" = EXCLUDED."status",
          "paymentStatus" = EXCLUDED."paymentStatus",
          "total" = EXCLUDED."total",
          "updatedAt" = EXCLUDED."updatedAt"`,
        [
          o.id,
          o.orderNumber,
          o.kind || "SALE",
          userId,
          o.customerName,
          o.customerEmail,
          o.customerPhone,
          o.address,
          o.city,
          o.state,
          o.pincode,
          o.subtotal,
          o.couponCode || null,
          o.discount || 0,
          o.pointsRedeemed || 0,
          o.pointsRedeemedValue || 0,
          o.pointsEarned || 0,
          o.affiliateCommission || 0,
          o.referrerCode || null,
          o.deliveryFee || 0,
          o.total,
          o.paymentMethod || "UPI",
          o.paymentStatus || "PENDING",
          o.status || "PENDING",
          courier,
          o.trackingNumber || null,
          o.trackingUrl || null,
          o.podProvider || "Qikink",
          o.podOrderId || null,
          o.podStatus || null,
          o.giftReason || null,
          o.gateway || null,
          o.gatewayOrderId || null,
          o.gatewayPaymentId || null,
          parseDate(o.placedAt),
          parseDate(o.updatedAt || o.placedAt),
        ]
      );

      // Order Items
      if (Array.isArray(o.items)) {
        for (let i = 0; i < o.items.length; i++) {
          const item = o.items[i];
          const itemId = `${o.id}-item-${i}`;
          const prodId = item.productId || productTitleMap.get(item.title.toLowerCase().trim()) || null;

          await client.query(
            `INSERT INTO "OrderItem" (
              "id", "orderId", "productId", "title",
              "color", "size", "quantity", "price",
              "previewImage", "graphicType", "customText"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT ("id") DO NOTHING`,
            [
              itemId,
              o.id,
              prodId,
              item.title,
              item.color || "Standard",
              item.size || "M",
              item.quantity || 1,
              item.price || 0,
              item.previewImage || null,
              item.graphicSvgType || item.graphicType || null,
              item.customText || null,
            ]
          );
          totalItems++;
        }
      }

      // Timeline events
      if (Array.isArray(o.timeline)) {
        for (let i = 0; i < o.timeline.length; i++) {
          const tl = o.timeline[i];
          const tlId = `${o.id}-tl-${i}`;
          await client.query(
            `INSERT INTO "TimelineEvent" (
              "id", "orderId", "label", "note", "at", "position"
            ) VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT ("id") DO NOTHING`,
            [
              tlId,
              o.id,
              tl.label,
              tl.note || "",
              parseDate(tl.at),
              i,
            ]
          );
          totalTimeline++;
        }
      }

      // Cashback tranches
      if (Array.isArray(o.cashback)) {
        for (const cb of o.cashback) {
          const cbId = `${o.id}-cb-${cb.week}`;
          await client.query(
            `INSERT INTO "CashbackTranche" (
              "id", "orderId", "week", "percent", "points",
              "rupeeAmount", "dueAt", "status", "releasedAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT ("orderId", "week") DO UPDATE SET
              "status" = EXCLUDED."status",
              "releasedAt" = EXCLUDED."releasedAt"`,
            [
              cbId,
              o.id,
              cb.week,
              cb.percent || 25,
              cb.points,
              cb.rupeeAmount,
              parseDate(cb.dueAt),
              cb.status || "LOCKED",
              cb.releasedAt ? parseDate(cb.releasedAt) : null,
            ]
          );
          totalCashback++;
        }
      }
    }

    // 5. Wallet Transactions
    console.log(`[migration] 5/11 Migrating ${state.transactions.length} Wallet Transactions...`);
    for (const tx of state.transactions) {
      const userId = tx.customerId && existingUserIds.has(tx.customerId) ? tx.customerId : null;
      await client.query(
        `INSERT INTO "WalletTransaction" (
          "id", "userId", "orderId", "orderNumber",
          "type", "points", "rupeeValue", "description",
          "status", "createdAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT ("id") DO NOTHING`,
        [
          tx.id,
          userId,
          tx.orderId || null,
          tx.orderNumber || null,
          tx.type,
          tx.points,
          tx.rupeeValue,
          tx.description || "",
          tx.status || "COMPLETED",
          parseDate(tx.date),
        ]
      );
    }

    // 6. Referrals
    console.log(`[migration] 6/11 Migrating ${state.referrals.length} Referrals...`);
    const defaultReferrerId = state.customers[0]?.id;
    for (const ref of state.referrals) {
      const referrerId = ref.referrerId && existingUserIds.has(ref.referrerId) ? ref.referrerId : defaultReferrerId;
      const refereeId = ref.refereeId || userEmailMap.get(ref.friendEmail) || null;

      await client.query(
        `INSERT INTO "Referral" (
          "id", "referrerId", "refereeId", "friendName", "friendEmail",
          "orderNumber", "orderAmount", "commissionRate", "commissionAmount",
          "status", "createdAt", "paidAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT ("id") DO NOTHING`,
        [
          ref.id,
          referrerId,
          refereeId,
          ref.friendName,
          ref.friendEmail,
          ref.orderNumber || null,
          ref.orderAmount || 0,
          ref.commissionRate || 0.10,
          ref.commissionEarned || ref.commissionAmount || 0,
          ref.status || "PENDING",
          parseDate(ref.dateJoined),
          ref.paidAt ? parseDate(ref.paidAt) : null,
        ]
      );
    }

    // 7. Withdrawals & Tranches
    console.log(`[migration] 7/11 Migrating ${state.withdrawals.length} Withdrawal Requests & Tranches...`);
    let totalWthTranches = 0;
    for (const w of state.withdrawals) {
      const userId = w.customerId && existingUserIds.has(w.customerId) ? w.customerId : defaultReferrerId;

      await client.query(
        `INSERT INTO "WithdrawalRequest" (
          "id", "userId", "customerName", "phone",
          "upiId", "payoutMethod", "bankAccount", "bankIfsc",
          "totalPoints", "totalRupees", "purchaseOrder",
          "anchorDate", "requestedAt", "overallStatus", "rejectionReason"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT ("id") DO UPDATE SET
          "overallStatus" = EXCLUDED."overallStatus",
          "rejectionReason" = EXCLUDED."rejectionReason"`,
        [
          w.id,
          userId,
          w.customerName,
          w.phone || null,
          w.upiId,
          w.payoutMethod || "UPI",
          w.bankAccount || null,
          w.bankIfsc || null,
          w.totalPoints,
          w.totalRupees,
          w.purchaseOrderNumber || w.purchaseOrder || null,
          parseDate(w.anchorDate),
          parseDate(w.requestedAt),
          w.overallStatus || "VESTING_IN_PROGRESS",
          w.rejectionReason || null,
        ]
      );

      if (Array.isArray(w.tranches)) {
        for (const t of w.tranches) {
          const tId = `${w.id}-tranche-${t.week}`;
          await client.query(
            `INSERT INTO "WithdrawalTranche" (
              "id", "withdrawalId", "week", "percent", "points",
              "rupeeAmount", "dueAt", "status", "transferredAt", "upiRef"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT ("withdrawalId", "week") DO UPDATE SET
              "status" = EXCLUDED."status",
              "transferredAt" = EXCLUDED."transferredAt",
              "upiRef" = EXCLUDED."upiRef"`,
            [
              tId,
              w.id,
              t.week,
              t.percent || 25,
              t.points,
              t.rupeeAmount,
              parseDate(t.dueAt),
              t.status || "LOCKED",
              t.transferredAt ? parseDate(t.transferredAt) : null,
              t.upiRef || null,
            ]
          );
          totalWthTranches++;
        }
      }
    }

    // 8. Audit Logs
    console.log(`[migration] 8/11 Migrating ${state.auditLogs.length} Audit Logs...`);
    for (const log of state.auditLogs) {
      await client.query(
        `INSERT INTO "AuditLog" (
          "id", "actor", "action", "resource", "details", "ipAddress", "createdAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT ("id") DO NOTHING`,
        [
          log.id,
          log.actor,
          log.action,
          log.resource || null,
          log.details || "",
          log.ipAddress || null,
          parseDate(log.at),
        ]
      );
    }

    // 9. AppState snapshot for instant synchronization
    console.log(`[migration] 9/11 Saving unified AppState snapshot...`);
    await client.query(
      `INSERT INTO "AppState" ("key", "data", "updatedAt")
       VALUES ('zenin_state', $1, NOW())
       ON CONFLICT ("key") DO UPDATE SET
         "data" = EXCLUDED."data",
         "updatedAt" = NOW()`,
      [JSON.stringify(state)]
    );

    await client.query("COMMIT");
    console.log("[migration] Transaction committed successfully!");

    // Verification
    console.log("[migration] 10/11 Verifying table row counts in PostgreSQL:");
    const tables = [
      "User",
      "Product",
      "Order",
      "OrderItem",
      "TimelineEvent",
      "CashbackTranche",
      "WalletTransaction",
      "Referral",
      "WithdrawalRequest",
      "WithdrawalTranche",
      "RewardRule",
      "AuditLog",
      "AppState",
    ];

    for (const table of tables) {
      const res = await client.query(`SELECT COUNT(*) AS cnt FROM "${table}"`);
      console.log(`  ✓ "${table}": ${res.rows[0].cnt} rows`);
    }

    console.log("[migration] 11/11 ALL DATA SUCCESSFULLY MIGRATED TO POSTGRESQL!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[migration] Error during migration, rolled back:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("[migration] Fatal error:", err);
  process.exit(1);
});
