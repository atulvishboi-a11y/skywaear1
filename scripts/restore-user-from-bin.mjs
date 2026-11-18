import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env");
let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("DATABASE_URL=")) {
      databaseUrl = trimmed.substring("DATABASE_URL=".length).replace(/^["']|["']$/g, "");
      break;
    }
  }
}

if (!databaseUrl) {
  databaseUrl = "postgresql://neondb_owner:npg_Lg7cstHOI8dB@ep-summer-hill-b5orxtlt.c-7.us-east-2.aws.neon.tech/neondb";
}

const host = (databaseUrl.match(/@([^/:]+)/) || [])[1] || "ep-summer-hill-b5orxtlt.c-7.us-east-2.aws.neon.tech";

async function queryNeon(sql, params = []) {
  const res = await fetch(`https://${host.replace("-pooler", "")}/sql`, {
    method: "POST",
    headers: {
      "Neon-Connection-String": databaseUrl,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query: sql, params })
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  const json = await res.json();
  return json.rows;
}

async function restore(targetPhoneOrId) {
  console.log("=== SKYWEAR - RESTORE USER FROM RECYCLE BIN ===");

  const binRows = await queryNeon(`SELECT * FROM "DeletedUsersBin"`);
  if (!binRows || binRows.length === 0) {
    console.log("DeletedUsersBin is currently empty.");
    return;
  }

  let candidates = binRows;
  if (targetPhoneOrId && targetPhoneOrId !== "all") {
    const cleanTarget = targetPhoneOrId.replace(/\D/g, "");
    candidates = binRows.filter(r => 
      r.id === targetPhoneOrId || 
      (cleanTarget && (r.phone || "").replace(/\D/g, "").includes(cleanTarget))
    );
  }

  if (candidates.length === 0) {
    console.log(`No archived user found matching: ${targetPhoneOrId}`);
    console.log("Available in bin:");
    binRows.forEach(r => console.log(`- ${r.name} | ${r.phone} | ID: ${r.id}`));
    return;
  }

  const stateRows = await queryNeon('SELECT "data" FROM "AppState" WHERE "key" = \'zenin_state\' LIMIT 1');
  const state = stateRows[0].data;

  for (const c of candidates) {
    console.log(`Restoring ${c.name} (${c.phone}) [ID: ${c.id}]...`);
    
    // Add back to customers if not present
    if (!state.customers.some(x => x.id === c.id)) {
      state.customers.push(c.customerData);
    }
    // Add back orders
    const orders = Array.isArray(c.orders) ? c.orders : JSON.parse(c.orders || "[]");
    for (const o of orders) {
      if (!state.orders.some(x => x.id === o.id || x.orderNumber === o.orderNumber)) {
        state.orders.push(o);
      }
    }

    // Add back to relational "User" table
    const cust = c.customerData;
    const cleanPhone = (cust.phone || "").trim();
    const cleanEmail = (cust.email || "").trim().toLowerCase() || `${cleanPhone.replace(/\D/g, "") || cust.id}@skywear.customer`;
    const refCode = cust.referralCode || ("SKYWEAR-" + Math.random().toString(36).slice(2, 7).toUpperCase());

    await queryNeon(`
      INSERT INTO "User" (
        "id", "name", "email", "phone", "role", "referralCode",
        "tier", "availablePoints", "pendingPoints", "lifetimeEarnedPoints",
        "addresses", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, 'CUSTOMER', $5, $6, $7, $8, $9, $10::jsonb, NOW(), NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "name" = EXCLUDED."name",
        "phone" = EXCLUDED."phone",
        "updatedAt" = NOW();
    `, [
      cust.id,
      cust.name || "Skywear Member",
      cleanEmail,
      cleanPhone || null,
      refCode,
      cust.tier || "Silver",
      cust.availablePoints || 0,
      cust.pendingPoints || 0,
      cust.lifetimeEarnedPoints || 0,
      JSON.stringify(cust.addresses || [])
    ]);

    // Remove from bin once restored
    await queryNeon(`DELETE FROM "DeletedUsersBin" WHERE "id" = $1`, [c.id]);
    console.log(`✓ Restored ${c.name} back to active database!`);
  }

  state.revision = (state.revision || 0) + 1;
  await queryNeon(`
    UPDATE "AppState"
    SET "data" = $1::jsonb, "updatedAt" = NOW()
    WHERE "key" = 'zenin_state'
  `, [JSON.stringify(state)]);

  console.log("✓ AppState updated. Restoration completed successfully.");
}

const arg = process.argv[2] || "all";
restore(arg).catch(console.error);

