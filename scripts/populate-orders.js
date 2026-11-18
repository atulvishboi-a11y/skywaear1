const { Client } = require('pg');
require('dotenv').config();

function parseDate(val, fallback = new Date()) {
  if (!val) return fallback;
  const d = new Date(val);
  return isNaN(d.getTime()) ? fallback : d;
}

async function runWithRetry() {
  let attempts = 0;
  while (attempts < 5) {
    attempts++;
    const client = new Client({
      connectionString: process.env.DATABASE_URL_UNPOOLED,
      ssl: { rejectUnauthorized: false }
    });
    try {
      await client.connect();
      console.log('Connected to Neon PostgreSQL.');
      const app = await client.query('SELECT data FROM "AppState" WHERE key = $1', ['zenin_state']);
      const state = app.rows[0].data;

      // Sync Orders
      for (const o of state.orders) {
        const courier = ['BlueDart', 'Delhivery', 'DTDC', 'EcomExpress'].includes(o.courier) ? o.courier : null;
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
          ON CONFLICT ("id") DO UPDATE SET "status" = EXCLUDED."status", "paymentStatus" = EXCLUDED."paymentStatus"
        `, [
          o.id, o.orderNumber, o.kind || 'SALE', o.customerId || null,
          o.customerName || 'Customer', o.customerEmail || 'customer@skywear.in', o.customerPhone || '',
          o.address || '', o.city || '', o.state || '', o.pincode || '',
          o.subtotal || 0, o.couponCode || null, o.discount || 0,
          o.pointsRedeemed || 0, o.pointsRedeemedValue || 0, o.pointsEarned || 0,
          o.affiliateCommission || 0, o.referrerCode || null, o.deliveryFee || 0, o.total || 0,
          o.paymentMethod || 'UPI', o.paymentStatus || 'PAID', o.status || 'PENDING',
          courier, o.trackingNumber || null, o.trackingUrl || null,
          o.podProvider || null, o.podOrderId || null, o.podStatus || null, o.giftReason || null,
          o.gateway || null, o.gatewayOrderId || null, o.gatewayPaymentId || null,
          parseDate(o.placedAt), parseDate(o.updatedAt)
        ]);
      }
      console.log('Orders synced successfully!');
      await client.end();
      return;
    } catch (e) {
      console.error(`Attempt ${attempts} error: ${e.message}`);
      try { await client.end(); } catch {}
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

runWithRetry().catch(console.error);
