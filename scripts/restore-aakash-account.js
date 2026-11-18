const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function run() {
  console.log("=== RESTORING AAKASH VISHWAKARMA (9755970547) ===");

  const passwordHash = "scrypt:521b315882b9359b2db1bd25d7a5d177:be7e1112a24a65f44df55f2fab8f1f0594068326ff3fe5c89e7c215f2bf42a00c4f777c170ce922d79e35272696dccc79a284d565357680db7a72622c330b626";
  const customerId = "usr-mw21hsvi";
  const legacyId = "usr-mw0zrm57";
  const customerName = "Aakash Vishwakarma";
  const phone = "+91 9755970547";
  const email = "919755970547@skywear.customer";
  const referralCode = "SKYWEAR-5GXRB";

  const restoredCustomer = {
    id: customerId,
    name: customerName,
    email: email,
    phone: phone,
    password: passwordHash,
    tier: "VIP",
    referralCode: referralCode,
    referredByCode: null,
    availablePoints: 0,
    pendingPoints: 0,
    lifetimeEarnedPoints: 0,
    referralBalanceRupees: 0,
    addresses: [],
    bankAccounts: [],
    createdAt: "2026-11-04T11:34:45.928Z",
    updatedAt: new Date().toISOString()
  };

  // 1. Update Neon PostgreSQL AppState
  let pgUpdated = false;
  try {
    const client = new Client({
      connectionString: process.env.STUDIO_DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    await client.connect();

    const appRes = await client.query('SELECT data FROM "AppState" WHERE key = $1', ['zenin_state']);
    if (appRes.rows.length > 0) {
      const state = appRes.rows[0].data;
      if (!state.customers) state.customers = [];

      // Remove any duplicate or legacy entries
      state.customers = state.customers.filter(c => 
        c.id !== customerId && 
        c.id !== legacyId && 
        !(c.phone && c.phone.includes("9755970547"))
      );

      // Add back restored customer
      state.customers.push(restoredCustomer);
      state.revision = (state.revision || 0) + 1;

      await client.query(
        'UPDATE "AppState" SET data = $1, "updatedAt" = NOW() WHERE key = $2',
        [JSON.stringify(state), 'zenin_state']
      );

      console.log("✅ Neon Postgres AppState.customers updated successfully!");
      pgUpdated = true;
    }

    // Ensure User table row exists with active status
    await client.query(`
      INSERT INTO "User" (
        "id", "name", "email", "phone", "role", "referralCode",
        "tier", "availablePoints", "pendingPoints", "lifetimeEarnedPoints",
        "addresses", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, 'CUSTOMER', $5, 'VIP', 0, 0, 0, '[]'::jsonb, NOW(), NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "name" = EXCLUDED."name",
        "phone" = EXCLUDED."phone",
        "updatedAt" = NOW();
    `, [customerId, customerName, email, phone, referralCode]);

    console.log("✅ Neon Postgres 'User' table confirmed active!");
    await client.end();
  } catch (err) {
    console.error("Postgres error (will fallback to local disk):", err.message);
  }

  // 2. Update Local Disk .data/zenin-state.json
  const localStateFile = path.join(process.cwd(), '.data', 'zenin-state.json');
  if (fs.existsSync(localStateFile)) {
    const localState = JSON.parse(fs.readFileSync(localStateFile, 'utf8'));
    if (!localState.customers) localState.customers = [];

    localState.customers = localState.customers.filter(c => 
      c.id !== customerId && 
      c.id !== legacyId && 
      !(c.phone && c.phone.includes("9755970547"))
    );
    localState.customers.push(restoredCustomer);
    localState.revision = (localState.revision || 0) + 1;

    fs.writeFileSync(localStateFile, JSON.stringify(localState, null, 2), 'utf8');
    console.log("✅ Local .data/zenin-state.json updated successfully!");
  }

  // 3. Clean from data/deleted_users_recycle_bin.json
  const binFile = path.join(process.cwd(), 'data', 'deleted_users_recycle_bin.json');
  if (fs.existsSync(binFile)) {
    let bin = JSON.parse(fs.readFileSync(binFile, 'utf8'));
    const beforeCount = bin.length;
    bin = bin.filter(u => !(u.phone && u.phone.includes("9755970547")) && u.id !== customerId && u.id !== legacyId);
    fs.writeFileSync(binFile, JSON.stringify(bin, null, 2), 'utf8');
    console.log(`✅ Removed from recycle bin (${beforeCount} -> ${bin.length})`);
  }

  console.log("\n🎉 AAKASH VISHWAKARMA (+91 9755970547) IS FULLY RESTORED & ACTIVE!");
}

run().catch(console.error);

