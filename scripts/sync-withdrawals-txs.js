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
  const app = await client.query('SELECT data FROM "AppState" WHERE key = $1', ['zenin_state']);
  const state = app.rows[0].data;

  // Sync Withdrawals
  for (const w of state.withdrawals) {
    try {
      await client.query(`
        INSERT INTO "WithdrawalRequest" (
          "id", "userId", "customerName", "phone", "upiId", "payoutMethod",
          "bankAccount", "bankIfsc", "totalPoints", "totalRupees",
          "anchorDate", "requestedAt", "overallStatus"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT ("id") DO UPDATE SET
          "overallStatus" = EXCLUDED."overallStatus",
          "totalPoints" = EXCLUDED."totalPoints",
          "totalRupees" = EXCLUDED."totalRupees"
      `, [
        w.id,
        w.customerId || 'usr-mvxo22lh',
        w.customerName || 'Vikash patel',
        w.phone || null,
        w.upiId || '7583893833@bank',
        w.payoutMethod || 'BANK',
        w.bankAccount || null,
        w.bankIfsc || null,
        w.totalPoints ?? w.points ?? 0,
        w.totalRupees ?? w.amountRupees ?? 0,
        parseDate(w.requestedAt),
        parseDate(w.requestedAt),
        w.overallStatus || 'PAID'
      ]);
    } catch (e) {
      console.error('Withdrawal error:', e.message);
    }
  }

  // Sync Transactions
  for (const tx of state.transactions) {
    try {
      await client.query(`
        INSERT INTO "WalletTransaction" (
          "id", "userId", "orderId", "orderNumber", "type",
          "points", "rupeeValue", "description", "status", "createdAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT ("id") DO UPDATE SET
          "points" = EXCLUDED."points",
          "status" = EXCLUDED."status"
      `, [
        tx.id,
        tx.customerId || null,
        tx.orderId || null,
        tx.orderNumber || null,
        tx.type || 'PURCHASE_REWARD',
        tx.points || 0,
        tx.rupeeValue || 0,
        tx.description || '',
        tx.status || 'COMPLETED',
        parseDate(tx.createdAt)
      ]);
    } catch (e) {
      // Ignore if user FK not found
    }
  }

  const res = await client.query(`
    SELECT 
      (SELECT count(*) FROM "User") as users,
      (SELECT count(*) FROM "Order") as orders,
      (SELECT count(*) FROM "OrderItem") as order_items,
      (SELECT count(*) FROM "Product") as products,
      (SELECT count(*) FROM "WithdrawalRequest") as withdrawals,
      (SELECT count(*) FROM "WalletTransaction") as transactions
  `);
  console.log('\n🔥 COMPLETE NEON RELATIONAL SUMMARY:');
  console.table(res.rows);

  await client.end();
}

run().catch(console.error);

