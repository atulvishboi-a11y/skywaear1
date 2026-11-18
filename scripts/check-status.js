const fs = require('fs');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const env = dotenv.parse(fs.readFileSync('.env'));
const pool = new Pool({
  connectionString: env.DATABASE_URL_UNPOOLED || env.DATABASE_URL
});
async function main() {
  const tables = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
  console.log('Tables in DB:', tables.rows.map(r => r.table_name));
  await pool.end();
}
main().catch(console.error);
