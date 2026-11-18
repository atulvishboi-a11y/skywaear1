const { Client } = require('pg');
require('dotenv').config();

function parseDate(val, fallback = new Date()) {
  if (!val) return fallback;
  const d = new Date(val);
  return isNaN(d.getTime()) ? fallback : d;
}

async function run() {
  const client = new Client({
    connectionString: process.env.STUDIO_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected to Neon PostgreSQL.');

  const app = await client.query('SELECT data FROM "AppState" WHERE key = $1', ['zenin_state']);
  const state = app.rows[0].data;

  // 1. Sync Products (using try/catch per product)
  console.log(`Syncing ${state.products.length} products...`);
  for (const p of state.products) {
    try {
      await client.query(`
        INSERT INTO "Product" (
          "id", "slug", "title", "subtitle", "description",
          "category", "price", "mrp", "gsm", "fabric",
          "badge", "graphicTitle", "graphicType", "accentColor",
          "colors", "sizes", "images", "stock", "isArchived",
          "cashbackPoints", "codAvailable", "rating", "reviewCount",
          "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
        ON CONFLICT ("id") DO UPDATE SET
          "title" = EXCLUDED."title",
          "price" = EXCLUDED."price",
          "stock" = EXCLUDED."stock",
          "updatedAt" = NOW()
      `, [
        p.id, p.slug, p.title, p.subtitle || null, p.description || '', p.category || 'OVERSIZED_TEE',
        p.price || 999, p.mrp || 1999, p.gsm || 240, p.fabric || 'Cotton', p.badge || null,
        p.graphicTitle || null, p.graphicType || 'cyber_tokyo', p.accentColor || '#fbbf24',
        JSON.stringify(p.colors || []), p.sizes || [], p.images || [], p.stock ?? 60,
        Boolean(p.isArchived), p.cashbackPoints ?? null, p.codAvailable !== false,
        p.rating || 4.9, p.reviewsCount ?? p.reviewCount ?? 0, parseDate(p.createdAt), parseDate(p.updatedAt)
      ]);
    } catch (err) {
      // If slug conflict, update by slug
      try {
        await client.query(`UPDATE "Product" SET "title" = $1, "price" = $2, "stock" = $3 WHERE "slug" = $4`, [
          p.title, p.price || 999, p.stock ?? 60, p.slug
        ]);
      } catch {}
    }
  }
  console.log('✅ Products synced successfully!');

  // 2. Sync Orders & OrderItems
  console.log(`Syncing ${state.orders.length} orders...`);
  const validMethods = ['UPI', 'CARD', 'NETBANKING', 'COD', 'COMPLIMENTARY', 'MANUAL_UPI'];
  const validPaymentStatuses = ['PENDING', 'PAID', 'PENDING_VERIFICATION', 'REFUNDED', 'REJECTED'];
  const validOrderStatuses = ['PENDING', 'APPROVED', 'PRINTING_POD', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

  for (const o of state.orders) {
    const courier = ['BlueDart', 'Delhivery', 'DTDC', 'EcomExpress'].includes(o.courier) ? o.courier : null;
    const paymentMethod = validMethods.includes(o.paymentMethod) ? o.paymentMethod : 'UPI';
    const paymentStatus = validPaymentStatuses.includes(o.paymentStatus) ? o.paymentStatus : 'PAID';
    const status = validOrderStatuses.includes(o.status) ? o.status : 'PENDING';

    try {
      await client.query(`
        INSERT INTO "Order" (
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
          "status" = EXCLUDED."status",
          "paymentStatus" = EXCLUDED."paymentStatus",
          "total" = EXCLUDED."total",
          "updatedAt" = NOW()
      `, [
        o.id, o.orderNumber, o.kind || 'SALE', o.customerId || null,
        o.customerName || 'Customer', o.customerEmail || 'customer@skywear.in', o.customerPhone || '',
        o.address || '', o.city || '', o.state || '', o.pincode || '',
        o.subtotal || 0, o.couponCode || null, o.discount || 0,
        o.pointsRedeemed || 0, o.pointsRedeemedValue || 0, o.pointsEarned || 0,
        o.affiliateCommission || 0, o.referrerCode || null, o.deliveryFee || 0, o.total || 0,
        paymentMethod, paymentStatus, status,
        courier, o.trackingNumber || null, o.trackingUrl || null,
        o.podProvider || null, o.podOrderId || null, o.podStatus || null, o.giftReason || null,
        o.gateway || null, o.gatewayOrderId || null, o.gatewayPaymentId || null,
        parseDate(o.placedAt), parseDate(o.updatedAt)
      ]);

      if (Array.isArray(o.items)) {
        for (const item of o.items) {
          const itemId = item.id || `item_${o.id}_${Math.random().toString(36).substring(2, 7)}`;
          await client.query(`
            INSERT INTO "OrderItem" (
              "id", "orderId", "productId", "title", "color", "size", "quantity", "price", "previewImage"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT ("id") DO NOTHING
          `, [
            itemId, o.id, item.productId || null, item.title || item.name || 'Streetwear Tee',
            item.color || 'Black', item.size || 'M', item.quantity || 1, item.price || 0,
            item.previewImage || item.image || null
          ]);
        }
      }
    } catch (err) {
      console.error(`Order ${o.id} error:`, err.message);
    }
  }
  console.log('✅ Orders and OrderItems synced successfully!');

  // 3. Sync Withdrawals
  console.log(`Syncing ${state.withdrawals.length} withdrawals...`);
  for (const w of state.withdrawals) {
    try {
      await client.query(`
        INSERT INTO "WithdrawalRequest" (
          "id", "userId", "customerName", "phone", "payoutMethod",
          "bankAccount", "bankIfsc", "upiId", "points", "amountRupees",
          "trancheCount", "overallStatus", "requestedAt", "completedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT ("id") DO UPDATE SET
          "overallStatus" = EXCLUDED."overallStatus",
          "completedAt" = EXCLUDED."completedAt"
      `, [
        w.id, w.customerId || 'usr-mvxo22lh', w.customerName || 'Vikash patel', w.phone || null,
        w.payoutMethod || 'BANK', w.bankAccount || null, w.bankIfsc || null, w.upiId || null,
        w.points ?? w.totalPoints ?? 0, w.amountRupees ?? w.totalRupees ?? 0,
        w.trancheCount || 1, w.overallStatus || 'PAID', parseDate(w.requestedAt),
        w.completedAt ? parseDate(w.completedAt) : null
      ]);
    } catch (err) {
      console.error(`Withdrawal ${w.id} error:`, err.message);
    }
  }
  console.log('✅ Withdrawals synced successfully!');

  const counts = await client.query(`
    SELECT 
      (SELECT count(*) FROM "User") as users,
      (SELECT count(*) FROM "Order") as orders,
      (SELECT count(*) FROM "OrderItem") as order_items,
      (SELECT count(*) FROM "Product") as products,
      (SELECT count(*) FROM "WithdrawalRequest") as withdrawals
  `);
  console.log('\n📊 DATABASE SUMMARY FOR PRISMA STUDIO:');
  console.table(counts.rows);

  await client.end();
}

run().catch(console.error);
