const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL_UNPOOLED,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const u = await client.query('SELECT id, name, email, phone, role FROM "User"');
  console.log('--- Relational "User" table (' + u.rows.length + ' rows) ---');
  console.log(u.rows);

  const app = await client.query('SELECT data FROM "AppState" WHERE key = $1', ['zenin_state']);
  if (app.rows.length) {
    const state = app.rows[0].data;
    const customers = state.customerAccounts || [];
    console.log('\n--- AppState "zenin_state" customerAccounts (' + customers.length + ' accounts) ---');
    console.log(customers.map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      availablePoints: c.availablePoints,
      pendingPoints: c.pendingPoints
    })));

    const orders = state.orders || [];
    console.log('\n--- AppState Orders (' + orders.length + ' orders) ---');

    const withdrawals = state.withdrawals || [];
    console.log('\n--- AppState Withdrawals (' + withdrawals.length + ' withdrawals) ---');
    console.log(withdrawals.map(w => ({
      id: w.id,
      customerName: w.customerName,
      phone: w.phone,
      totalPoints: w.totalPoints,
      overallStatus: w.overallStatus
    })));
  }

  await client.end();
}

run().catch(console.error);

