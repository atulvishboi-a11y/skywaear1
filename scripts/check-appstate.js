const fs = require('fs');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const env = dotenv.parse(fs.readFileSync('.env'));
const pool = new Pool({
  connectionString: env.DATABASE_URL_UNPOOLED || env.DATABASE_URL
});
async function main() {
  const row = await pool.query(`SELECT data FROM "AppState" WHERE key = 'zenin_state' LIMIT 1`);
  if (row.rows.length === 0) {
    console.log('No state in AppState');
    return;
  }
  const state = row.rows[0].data;
  const vikash = state.customers.find(c => c.id === 'usr-mvxo22lh' || (c.phone && (c.phone.includes('7582096500') || c.phone.includes('7583893833'))));
  console.log('Vikash account:', {
    id: vikash?.id,
    name: vikash?.name,
    phone: vikash?.phone,
    availablePoints: vikash?.availablePoints,
    pendingPoints: vikash?.pendingPoints,
    lifetimeEarnedPoints: vikash?.lifetimeEarnedPoints,
    bankAccounts: vikash?.bankAccounts
  });
  const withdrawals = (state.withdrawals || []).filter(w => w.customerId === vikash?.id);
  console.log('Vikash withdrawals in AppState (' + withdrawals.length + '):', withdrawals.map(w => ({
    id: w.id,
    status: w.overallStatus,
    points: w.totalPoints,
    rupees: w.totalRupees,
    payoutMethod: w.payoutMethod,
    utr: w.transactionRefNumber || w.utr || (w.tranches && w.tranches.find(t => t.upiRef)?.upiRef)
  })));
  await pool.end();
}
main().catch(console.error);

