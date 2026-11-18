const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL_UNPOOLED,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('Connected to Neon PostgreSQL.');
  
  const app = await client.query('SELECT data FROM "AppState" WHERE key = $1', ['zenin_state']);
  const state = app.rows[0].data;
  const customers = state.customers || [];
  console.log(`Found ${customers.length} customers in live AppState.`);

  const usedEmails = new Set();
  const usedReferralCodes = new Set();

  for (const cust of customers) {
    let email = cust.email ? cust.email.trim().toLowerCase() : null;
    if (!email || usedEmails.has(email)) {
      const cleanPhone = (cust.phone || cust.id).replace(/[^0-9a-zA-Z]/g, '');
      email = `${cleanPhone || cust.id}@skywear.customer`;
      if (usedEmails.has(email)) {
        email = `${cleanPhone || cust.id}_${Math.random().toString(36).substring(2, 6)}@skywear.customer`;
      }
    }
    usedEmails.add(email);

    let ref = cust.referralCode || `SKYWEAR-${cust.id.replace(/[^a-zA-Z0-9]/g, '').slice(-5).toUpperCase()}`;
    if (usedReferralCodes.has(ref)) {
      ref = `${ref}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    }
    usedReferralCodes.add(ref);

    await client.query(`
      INSERT INTO "User" (
        "id", "name", "email", "phone", "role",
        "referralCode", "referredByCode", "tier",
        "availablePoints", "pendingPoints", "lifetimeEarnedPoints",
        "addresses", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "name" = EXCLUDED."name",
        "email" = EXCLUDED."email",
        "phone" = EXCLUDED."phone",
        "role" = EXCLUDED."role",
        "referralCode" = EXCLUDED."referralCode",
        "tier" = EXCLUDED."tier",
        "availablePoints" = EXCLUDED."availablePoints",
        "pendingPoints" = EXCLUDED."pendingPoints",
        "lifetimeEarnedPoints" = EXCLUDED."lifetimeEarnedPoints",
        "addresses" = EXCLUDED."addresses",
        "updatedAt" = NOW()
    `, [
      cust.id,
      cust.name || 'Customer',
      email,
      cust.phone || null,
      cust.role === 'ADMIN' ? 'ADMIN' : 'CUSTOMER',
      ref,
      cust.referredByCode || null,
      cust.tier || 'Silver',
      cust.availablePoints || 0,
      cust.pendingPoints || 0,
      cust.lifetimeEarnedPoints || 0,
      JSON.stringify(cust.addresses || [])
    ]);
  }

  const res = await client.query('SELECT id, name, phone, "availablePoints", "pendingPoints" FROM "User" ORDER BY "createdAt" ASC');
  console.log(`\n🎉 "User" table now has ${res.rows.length} users:`);
  console.table(res.rows);

  await client.end();
}

run().catch(console.error);

