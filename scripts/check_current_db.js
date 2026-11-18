const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const res = await client.query('SELECT count(*) FROM "User"');
  console.log('User table count:', res.rows[0].count);
  const users = await client.query('SELECT id, name, phone, email FROM "User"');
  console.log('Users in User table:', users.rows);
  const data = await client.query(`
    SELECT 
      jsonb_array_length(data->'customers') as cust_count, 
      jsonb_array_length(data->'orders') as order_count 
    FROM "AppState" WHERE key = 'zenin_state'
  `);
  console.log('AppState counts:', data.rows[0]);

  const appStateRes = await client.query(`SELECT data FROM "AppState" WHERE key = 'zenin_state'`);
  const appState = appStateRes.rows[0]?.data;
  console.log('AppState customers:', appState?.customers?.map(c => ({ id: c.id, name: c.name, phone: c.phone })));
  console.log('AppState orders:', appState?.orders?.map(o => ({ id: o.id, orderNumber: o.orderNumber, total: o.total })));

  await client.end();
}
run().catch(console.error);

