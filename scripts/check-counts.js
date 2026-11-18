const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL_UNPOOLED,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const tables = ['User', 'Product', 'Order', 'OrderItem', 'WithdrawalRequest', 'WalletTransaction', 'Referral', 'AppState'];
  for (const t of tables) {
    try {
      const res = await client.query(`SELECT count(*) FROM "${t}"`);
      console.log(`${t} count:`, res.rows[0].count);
    } catch (e) {
      console.log(`${t} error:`, e.message);
    }
  }
  await client.end();
}

run().catch(console.error);

