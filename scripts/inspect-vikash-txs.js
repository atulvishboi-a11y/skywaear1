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
  const state = row.rows[0].data;
  const vikash = state.customers.find(c => c.id === 'usr-mvxo22lh');
  console.log('Customer:', {
    name: vikash.name,
    availablePoints: vikash.availablePoints,
    pendingPoints: vikash.pendingPoints,
    lifetimeEarnedPoints: vikash.lifetimeEarnedPoints
  });
  const txs = (state.transactions || []).filter(t => t.customerId === 'usr-mvxo22lh');
  console.log('Vikash Transactions count:', txs.length);
  txs.forEach(t => console.log(t.type, t.points, t.description));
  const wths = (state.withdrawals || []).filter(w => w.customerId === 'usr-mvxo22lh');
  console.log('Vikash Withdrawals:', wths.map(w => ({ id: w.id, status: w.overallStatus, points: w.totalPoints })));
  client.release();
  await pool.end();
}
main().catch(console.error);
