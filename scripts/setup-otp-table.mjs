import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_Lg7cstHOI8dB@ep-summer-hill-b5orxtlt.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "AuthOtp" (
      "identifier" VARCHAR(100) PRIMARY KEY,
      "code" VARCHAR(10) NOT NULL,
      "expiresAt" BIGINT NOT NULL,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log("AuthOtp table created/verified successfully in Neon PostgreSQL!");
  await pool.end();
}

main().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
