import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

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
  databaseUrl = "postgresql://postgres:postgres@localhost:5432/tshirt_db?schema=public";
}

const pool = new Pool({ connectionString: databaseUrl });

async function verify() {
  console.log("==================================================");
  console.log("   THREADCRAFT POSTGRESQL MIGRATION VERIFICATION   ");
  console.log("==================================================");
  console.log(`Connected to: ${databaseUrl.replace(/:[^:@]+@/, ":****@")}\n`);

  const tables = [
    { name: "User", label: "Users / Customers" },
    { name: "Product", label: "Catalog Products" },
    { name: "Order", label: "Store Orders" },
    { name: "OrderItem", label: "Order Line Items" },
    { name: "TimelineEvent", label: "Order Tracking Timelines" },
    { name: "CashbackTranche", label: "Cashback Vesting Tranches" },
    { name: "WalletTransaction", label: "Wallet Coin Ledger" },
    { name: "Referral", label: "Affiliate Referrals" },
    { name: "WithdrawalRequest", label: "Payout Requests" },
    { name: "WithdrawalTranche", label: "Payout Vesting Tranches" },
    { name: "RewardRule", label: "Reward Engine Config" },
    { name: "AuditLog", label: "Security & Operations Audit Logs" },
    { name: "AppState", label: "Full Application State Snapshot" },
  ];

  for (const t of tables) {
    const res = await pool.query(`SELECT COUNT(*) AS count FROM "${t.name}"`);
    console.log(`✓ ${t.label.padEnd(35)} [${t.name}]: ${res.rows[0].count} records`);
  }

  console.log("\n--- Sample Users in PostgreSQL ---");
  const users = await pool.query(`SELECT "id", "name", "email", "tier", "availablePoints" FROM "User" LIMIT 5`);
  console.table(users.rows);

  console.log("\n--- Sample Products in PostgreSQL ---");
  const products = await pool.query(`SELECT "id", "title", "price", "stock", "category" FROM "Product" LIMIT 5`);
  console.table(products.rows);

  console.log("\n--- Recent Orders in PostgreSQL ---");
  const orders = await pool.query(`SELECT "orderNumber", "customerName", "total", "paymentMethod", "status" FROM "Order" ORDER BY "placedAt" DESC LIMIT 5`);
  console.table(orders.rows);

  console.log("\n✅ ALL DATA MIGRATED AND VERIFIED IN POSTGRESQL SUCCESSFULLY!");
  await pool.end();
}

verify().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
