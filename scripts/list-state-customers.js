const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL_UNPOOLED,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const app = await client.query('SELECT data FROM "AppState" WHERE key = $1', ['zenin_state']);
  const state = app.rows[0].data;
  console.log(`\nFound ${state.customers.length} customers in state.customers:\n`);
  for (const c of state.customers) {
    console.log(`- ID: ${c.id} | Name: ${c.name} | Phone: ${c.phone} | Email: ${c.email} | Role: ${c.role || 'CUSTOMER'} | Coins: ${c.availablePoints}`);
  }
  await client.end();
}

run().catch(console.error);

