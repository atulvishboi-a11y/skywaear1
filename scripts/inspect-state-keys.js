const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL_UNPOOLED,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const app = await client.query('SELECT data FROM "AppState" WHERE key = $1', ['zenin_state']);
  if (app.rows.length) {
    const state = app.rows[0].data;
    console.log('Top level keys in state:', Object.keys(state));
    for (const key of Object.keys(state)) {
      if (Array.isArray(state[key])) {
        console.log(`- ${key}: Array of ${state[key].length} items`);
      } else if (typeof state[key] === 'object' && state[key] !== null) {
        console.log(`- ${key}: Object with keys:`, Object.keys(state[key]));
      } else {
        console.log(`- ${key}:`, typeof state[key]);
      }
    }
  }
  await client.end();
}

run().catch(console.error);

