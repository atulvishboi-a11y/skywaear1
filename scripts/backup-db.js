const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function backup() {
  const backupDir = path.join(process.cwd(), 'database_backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const res = await pool.query('SELECT data FROM "AppState" WHERE key = $1', ['zenin_state']);
  if (!res.rows.length) {
    console.log('No zenin_state in DB to backup');
    return;
  }
  const state = res.rows[0].data;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = path.join(backupDir, `backup_zenin_state_${timestamp}.json`);
  fs.writeFileSync(filename, JSON.stringify(state, null, 2), 'utf8');

  // Also maintain a dedicated log of deleted/modified records
  const auditFile = path.join(backupDir, 'deleted_records_audit.json');
  let auditHistory = [];
  if (fs.existsSync(auditFile)) {
    try {
      auditHistory = JSON.parse(fs.readFileSync(auditFile, 'utf8'));
    } catch {}
  }

  // Backup of the 2 test withdrawals removed as requested
  const removedWithdrawalsBackup = [
    {
      id: "wth-dc0u3",
      customerId: "usr-mvxo22lh",
      customerName: "Vikash patel",
      phone: "+91 7583893833",
      payoutMethod: "BANK",
      bankAccount: "100296909404",
      bankIfsc: "INDB0000476",
      upiId: "+91 7583893833@bank",
      totalPoints: 1350,
      totalRupees: 13.5,
      requestedAt: "2026-11-02T14:42:00.000Z",
      overallStatus: "SUBMITTED_TO_BANK",
      removalReason: "User requested removal of last 2 duplicate withdrawal attempts"
    },
    {
      id: "wth-e1jsz",
      customerId: "usr-mvxo22lh",
      customerName: "Vikash patel",
      phone: "+91 7583893833",
      payoutMethod: "UPI",
      upiId: "7582096500@indie",
      totalPoints: 1350,
      totalRupees: 13.5,
      requestedAt: "2026-11-02T15:02:00.000Z",
      overallStatus: "SUBMITTED_TO_BANK",
      removalReason: "User requested removal of last 2 duplicate withdrawal attempts"
    }
  ];

  auditHistory.push({
    timestamp: new Date().toISOString(),
    event: "TEST_WITHDRAWALS_BACKED_UP",
    records: removedWithdrawalsBackup
  });

  fs.writeFileSync(auditFile, JSON.stringify(auditHistory, null, 2), 'utf8');
  console.log(`[Backup] Successfully saved complete database snapshot to ${filename}`);
  console.log(`[Backup] Audit history updated in ${auditFile}`);

  await pool.end();
}

backup().catch(console.error);

