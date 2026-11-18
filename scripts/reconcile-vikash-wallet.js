const fs = require('fs');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const env = dotenv.parse(fs.readFileSync('.env'));

async function connectWithRetry() {
  for (let i = 0; i < 5; i++) {
    try {
      const pool = new Pool({
        connectionString: env.DATABASE_URL_UNPOOLED || env.DATABASE_URL
      });
      const client = await pool.connect();
      return { pool, client };
    } catch (e) {
      console.log('Retry ' + (i+1) + ': ' + e.message);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error('Could not connect');
}

async function main() {
  const { pool, client } = await connectWithRetry();
  const row = await client.query(`SELECT data FROM "AppState" WHERE key = 'zenin_state' LIMIT 1`);
  if (!row.rows[0]) throw new Error("No zenin_state row");
  const state = row.rows[0].data;

  const vikash = state.customers.find(c => c.id === 'usr-mvxo22lh' || (c.phone && c.phone.includes('7583893833')));
  if (!vikash) throw new Error("Vikash not found");

  console.log('Before update:', {
    name: vikash.name,
    availablePoints: vikash.availablePoints,
    pendingPoints: vikash.pendingPoints,
    lifetimeEarnedPoints: vikash.lifetimeEarnedPoints
  });

  // Reconcile: Vikash earned 1350 coins from Days 1-2, and withdrew 1350 coins on wth-d4kjh
  vikash.availablePoints = 0;

  // Verify withdrawals
  const activeWths = (state.withdrawals || []).filter(w => w.customerId === vikash.id && w.overallStatus !== 'REJECTED' && w.overallStatus !== 'FAILED');
  console.log('Active withdrawals for Vikash:', activeWths.map(w => ({ id: w.id, points: w.totalPoints, status: w.overallStatus })));

  // Persist updated state to Postgres
  await client.query(`UPDATE "AppState" SET data = $1, "updatedAt" = NOW() WHERE key = 'zenin_state'`, [JSON.stringify(state)]);
  console.log('Successfully updated AppState in PostgreSQL! Vikash availablePoints is now:', vikash.availablePoints);

  client.release();
  await pool.end();
}

main().catch(console.error);

