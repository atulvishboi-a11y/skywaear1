const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

function parseDate(val, fallback = new Date()) {
  if (!val) return fallback;
  const d = new Date(val);
  return isNaN(d.getTime()) ? fallback : d;
}

async function syncAll() {
  const client = await pool.connect();
  try {
    console.log('[Sync] Reading state from Neon AppState table...');
    const appRes = await client.query('SELECT data FROM "AppState" WHERE key = $1', ['zenin_state']);
    if (!appRes.rows.length) {
      console.log('No zenin_state found.');
      return;
    }
    const state = appRes.rows[0].data;

    await client.query('BEGIN');

    // 1. Sync Customers -> User table
    console.log(`[Sync] 1/5 Syncing ${state.customers.length} Customers into "User" table...`);
    const existingUserIds = new Set();
    const usedEmails = new Set();

    for (const c of state.customers) {
      let email = c.email ? c.email.trim().toLowerCase() : null;
      if (!email || usedEmails.has(email)) {
        const cleanPhone = (c.phone || c.id).replace(/[^0-9a-zA-Z]/g, '');
        email = `${cleanPhone || c.id}@skywear.customer`;
      }
      usedEmails.add(email);
      existingUserIds.add(c.id);

      const referralCode = c.referralCode || `SKYWEAR-${c.id.replace(/[^a-zA-Z0-9]/g, '').slice(-5).toUpperCase()}`;

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
          c.name || 'Zenin Member',
          email,
          c.phone || null,
          c.role === 'ADMIN' ? 'ADMIN' : 'CUSTOMER',
          referralCode,
          c.referredByCode || null,
          c.tier || 'Silver',
          c.availablePoints || 0,
          c.pendingPoints || 0,
          c.lifetimeEarnedPoints || 0,
          JSON.stringify(c.addresses || []),
          parseDate(c.createdAt),
          parseDate(c.updatedAt),
        ]
      );
    }
    console.log(`[Sync] Successfully synced ${state.customers.length} users into "User" table!`);

    // 2. Sync Products
    console.log(`[Sync] 2/5 Syncing ${state.products.length} Products into "Product" table...`);
    for (const p of state.products) {
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
          p.fabric || '100% Super-Combed Bio-Washed Cotton',
          p.badge || null,
          p.graphicTitle || null,
          p.graphicSvgType || p.graphicType || 'cyber_tokyo',
          p.accentColor || '#fbbf24',
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
    console.log(`[Sync] Successfully synced ${state.products.length} products!`);

    // 3. Sync Orders & Items
    console.log(`[Sync] 3/5 Syncing ${state.orders.length} Orders into "Order" table...`);
    for (const o of state.orders) {
      const userId = o.customerId && existingUserIds.has(o.customerId) ? o.customerId : null;
      const courier = ['BlueDart', 'Delhivery', 'DTDC', 'EcomExpress'].includes(o.courier) ? o.courier : null;

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
          o.kind || 'SALE',
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
          o.paymentMethod || 'UPI',
          o.paymentStatus || 'PAID',
          o.status || 'PENDING',
          courier,
          o.trackingNumber || null,
          o.trackingUrl || null,
          o.podProvider || null,
          o.podOrderId || null,
          o.podStatus || null,
          o.giftReason || null,
          o.gateway || null,
          o.gatewayOrderId || null,
          o.gatewayPaymentId || null,
          parseDate(o.placedAt),
          parseDate(o.updatedAt),
        ]
      );

      // Order items
      if (Array.isArray(o.items)) {
        for (const item of o.items) {
          const itemId = item.id || `item_${o.id}_${item.productId || Math.random().toString(36).substring(2, 7)}`;
          await client.query(
            `INSERT INTO "OrderItem" (
              "id", "orderId", "productId", "title", "color", "size", "quantity", "price", "previewImage"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT ("id") DO NOTHING`,
            [
              itemId,
              o.id,
              item.productId || null,
              item.title || item.name || 'Streetwear Tee',
              item.color || 'Black',
              item.size || 'M',
              item.quantity || 1,
              item.price || 0,
              item.previewImage || item.image || null,
            ]
          );
        }
      }
    }
    console.log(`[Sync] Successfully synced ${state.orders.length} orders!`);

    // 4. Sync Withdrawals
    console.log(`[Sync] 4/5 Syncing ${state.withdrawals.length} Withdrawals into "WithdrawalRequest"...`);
    for (const w of state.withdrawals) {
      const userId = w.customerId && existingUserIds.has(w.customerId) ? w.customerId : 'usr_aman_01';
      await client.query(
        `INSERT INTO "WithdrawalRequest" (
          "id", "userId", "customerName", "phone", "payoutMethod",
          "bankAccount", "bankIfsc", "upiId", "points", "amountRupees",
          "trancheCount", "overallStatus", "requestedAt", "completedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT ("id") DO UPDATE SET
          "overallStatus" = EXCLUDED."overallStatus",
          "completedAt" = EXCLUDED."completedAt"`,
        [
          w.id,
          userId,
          w.customerName,
          w.phone || null,
          w.payoutMethod || 'UPI',
          w.bankAccount || null,
          w.bankIfsc || null,
          w.upiId || null,
          w.points ?? w.totalPoints ?? 0,
          w.amountRupees ?? w.totalRupees ?? 0,
          w.trancheCount || 1,
          w.overallStatus || 'PENDING',
          parseDate(w.requestedAt),
          w.completedAt ? parseDate(w.completedAt) : null,
        ]
      );
    }

    // 5. Sync Wallet Transactions
    console.log(`[Sync] 5/5 Syncing ${state.transactions.length} Transactions into "WalletTransaction"...`);
    for (const tx of state.transactions) {
      const userId = tx.customerId && existingUserIds.has(tx.customerId) ? tx.customerId : null;
      await client.query(
        `INSERT INTO "WalletTransaction" (
          "id", "userId", "orderId", "orderNumber", "type",
          "points", "rupeeValue", "description", "status", "createdAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT ("id") DO UPDATE SET
          "points" = EXCLUDED."points",
          "status" = EXCLUDED."status"`,
        [
          tx.id,
          userId,
          tx.orderId || null,
          tx.orderNumber || null,
          tx.type || 'PURCHASE_REWARD',
          tx.points || 0,
          tx.rupeeValue || 0,
          tx.description || '',
          tx.status || 'COMPLETED',
          parseDate(tx.createdAt),
        ]
      );
    }

    await client.query('COMMIT');
    console.log('[Sync] ✅ ALL RELATIONAL TABLES FULLY SYNCHRONIZED FROM APPSTATE!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Sync] Error syncing tables:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

syncAll().catch(console.error);

