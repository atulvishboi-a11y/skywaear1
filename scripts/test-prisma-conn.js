const { Client } = require('pg');
require('dotenv').config();

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
console.log('Connecting to:', url.replace(/:[^:@]+@/, ':***@'));

const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function run() {
  try {
    await client.connect();
    console.log('Connected to Neon PostgreSQL successfully!');
    const res = await client.query('SELECT count(*) FROM "User"');
    console.log('User count in DB:', res.rows[0].count);
    const appState = await client.query('SELECT key, length(value) as len, updated_at FROM "AppState"');
    console.log('AppState keys:', appState.rows);
    await client.end();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();

