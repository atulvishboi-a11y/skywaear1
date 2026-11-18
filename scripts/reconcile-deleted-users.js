const { Client } = require('pg');
require('dotenv').config();

async function run() {
  let client;
  for (let i = 0; i < 5; i++) {
    try {
      client = new Client({
        connectionString: process.env.STUDIO_DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      await client.connect();
      break;
    } catch (e) {
      if (i === 4) throw e;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  console.log('Connected to Neon PostgreSQL.');

  const usersRes = await client.query('SELECT id, name, phone FROM "User"');
  const liveUserIds = new Set(usersRes.rows.map(u => u.id));
  console.log(`Current users in "User" table (${usersRes.rows.length}):`);
  console.table(usersRes.rows);

  const appRes = await client.query('SELECT data FROM "AppState" WHERE key = $1', ['zenin_state']);
  const state = appRes.rows[0].data;
  const beforeCount = state.customers.length;

  const keptCustomers = state.customers.filter(c => liveUserIds.has(c.id));
  const removedCustomers = state.customers.filter(c => !liveUserIds.has(c.id));

  console.log(`\nFound ${removedCustomers.length} customer(s) deleted from "User" table:`);
  for (const r of removedCustomers) {
    console.log(`- Removed: ${r.name} (${r.phone || r.email || r.id})`);
  }

  state.customers = keptCustomers;
  state.revision = (state.revision || 0) + 1;

  await client.query(
    'UPDATE "AppState" SET data = $1, "updatedAt" = NOW() WHERE key = $2',
    [JSON.stringify(state), 'zenin_state']
  );

  console.log(`\n✅ AppState updated! Customers reduced from ${beforeCount} to ${state.customers.length}.`);
  await client.end();
}

run().catch(console.error);
