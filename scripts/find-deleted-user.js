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
  const users = await client.query('SELECT id, name, phone, email FROM "User"');
  const app = await client.query('SELECT data FROM "AppState" WHERE key = $1', ['zenin_state']);
  const stateCustomers = app.rows[0].data.customers || [];

  const userIds = new Set(users.rows.map(u => u.id));
  const missingInUserTable = stateCustomers.filter(c => !userIds.has(c.id));

  console.log('Total in "User" table:', users.rows.length);
  console.log('Total in AppState.customers:', stateCustomers.length);
  console.log('\nCustomers deleted from "User" table in Neon Console:');
  console.log(missingInUserTable.map(m => ({ id: m.id, name: m.name, phone: m.phone, email: m.email })));

  await client.end();
}

run().catch(console.error);
