import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const envPath = path.join(process.cwd(), ".env");
let databaseUrl = process.env.DATABASE_URL;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("DATABASE_URL=")) {
      databaseUrl = trimmed.substring("DATABASE_URL=".length).replace(/^["']|["']$/g, "");
      break;
    }
  }
}

console.log("[init-neon] Connecting to:", databaseUrl ? databaseUrl.replace(/:[^:@]+@/, ":****@") : "NO URL FOUND");

if (!databaseUrl) {
  console.error("No database URL found in .env");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();
  console.log("[init-neon] Connected to Neon PostgreSQL successfully!");

  const sqlPath = path.join(process.cwd(), "prisma", "init-schema.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  console.log("[init-neon] Applying schema from prisma/init-schema.sql...");
  await client.query(sql);
  console.log("[init-neon] Schema applied successfully!");

  await client.end();
}

run().catch((err) => {
  console.error("[init-neon] Error initializing database:", err);
  process.exit(1);
});
