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
  console.log(JSON.stringify(state.customers, null, 2));
  await client.end();
}

run().catch(console.error);

