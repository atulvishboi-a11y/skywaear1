const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const backupDir = path.join(process.cwd(), 'database_backups');
const auditHistoryPath = path.join(backupDir, 'audit_history.json');

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

function getPool() {
  return new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  });
}

function hashObject(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj || {})).digest('hex');
}

function deepDiff(oldObj, newObj, prefix = '') {
  const diffs = [];
  const oldKeys = Object.keys(oldObj || {});
  const newKeys = Object.keys(newObj || {});
  const allKeys = Array.from(new Set([...oldKeys, ...newKeys]));

  for (const k of allKeys) {
    const p = prefix ? `${prefix}.${k}` : k;
    const vOld = oldObj ? oldObj[k] : undefined;
    const vNew = newObj ? newObj[k] : undefined;

    if (vOld === undefined && vNew !== undefined) {
      diffs.push({ type: 'ADDED', path: p, newValue: vNew });
    } else if (vOld !== undefined && vNew === undefined) {
      diffs.push({ type: 'DELETED', path: p, oldValue: vOld });
    } else if (typeof vOld === 'object' && vOld !== null && typeof vNew === 'object' && vNew !== null) {
      if (Array.isArray(vOld) || Array.isArray(vNew)) {
        if (JSON.stringify(vOld) !== JSON.stringify(vNew)) {
          // Identify array items added, removed, or changed if they have ids
          if (Array.isArray(vOld) && Array.isArray(vNew)) {
            const oldMap = new Map((vOld || []).filter(i => i && i.id).map(i => [i.id, i]));
            const newMap = new Map((vNew || []).filter(i => i && i.id).map(i => [i.id, i]));
            if (oldMap.size > 0 || newMap.size > 0) {
              for (const [id, item] of oldMap.entries()) {
                if (!newMap.has(id)) {
                  diffs.push({ type: 'DELETED_RECORD', path: `${p}[id=${id}]`, oldValue: item });
                } else if (JSON.stringify(item) !== JSON.stringify(newMap.get(id))) {
                  diffs.push({ type: 'MODIFIED_RECORD', path: `${p}[id=${id}]`, oldValue: item, newValue: newMap.get(id) });
                }
              }
              for (const [id, item] of newMap.entries()) {
                if (!oldMap.has(id)) {
                  diffs.push({ type: 'ADDED_RECORD', path: `${p}[id=${id}]`, newValue: item });
                }
              }
              continue;
            }
          }
          diffs.push({ type: 'MODIFIED', path: p, oldValue: vOld, newValue: vNew });
        }
      } else {
        diffs.push(...deepDiff(vOld, vNew, p));
      }
    } else if (vOld !== vNew) {
      diffs.push({ type: 'MODIFIED', path: p, oldValue: vOld, newValue: vNew });
    }
  }
  return diffs;
}

let lastStateHash = null;
let lastStateData = null;
let lastCheckedAt = null;

async function checkAndBackup() {
  const pool = getPool();
  try {
    const res = await pool.query('SELECT data, "updatedAt" FROM "AppState" WHERE key = $1', ['zenin_state']);
    if (!res.rows.length) {
      return;
    }
    const row = res.rows[0];
    const state = row.data;
    const currentHash = hashObject(state);

    if (lastStateHash === null) {
      lastStateHash = currentHash;
      lastStateData = JSON.parse(JSON.stringify(state));
      lastCheckedAt = new Date().toISOString();

      // Initial backup file if none exists
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = path.join(backupDir, `initial_snapshot_${timestamp}.json`);
      fs.writeFileSync(filename, JSON.stringify(state, null, 2), 'utf8');
      console.log(`[Backup Daemon] Initial snapshot stored at ${filename}`);
      return;
    }

    if (currentHash !== lastStateHash) {
      const timestamp = new Date().toISOString();
      const fileTimestamp = timestamp.replace(/[:.]/g, '-');
      console.log(`\n🔔 [Backup Daemon] DETECTED DATABASE EDIT AT ${timestamp}!`);

      const diffs = deepDiff(lastStateData, state);
      console.log(`[Backup Daemon] Detected ${diffs.length} change(s):`);
      for (const d of diffs) {
        console.log(`   - [${d.type}] ${d.path}`);
      }

      // 1. Save detailed audit log
      let auditLog = [];
      if (fs.existsSync(auditHistoryPath)) {
        try {
          auditLog = JSON.parse(fs.readFileSync(auditHistoryPath, 'utf8'));
        } catch {}
      }
      auditLog.push({
        timestamp,
        changesCount: diffs.length,
        changes: diffs
      });
      fs.writeFileSync(auditHistoryPath, JSON.stringify(auditLog, null, 2), 'utf8');

      // 2. Save complete state snapshot
      const snapshotFile = path.join(backupDir, `snapshot_${fileTimestamp}.json`);
      fs.writeFileSync(snapshotFile, JSON.stringify(state, null, 2), 'utf8');
      console.log(`[Backup Daemon] Audit log updated in ${auditHistoryPath}`);
      console.log(`[Backup Daemon] New snapshot saved to ${snapshotFile}\n`);

      lastStateHash = currentHash;
      lastStateData = JSON.parse(JSON.stringify(state));
      lastCheckedAt = timestamp;
    }
  } catch (err) {
    console.error('[Backup Daemon] Polling error:', err.message);
  } finally {
    try {
      await pool.end();
    } catch {}
  }
}

async function start() {
  console.log('[Backup Daemon] Starting live database watcher on Neon PostgreSQL...');
  console.log('[Backup Daemon] Database:', connectionString.replace(/:[^:@]+@/, ':***@'));
  console.log('[Backup Daemon] Backups directory:', backupDir);
  
  // Run once immediately
  await checkAndBackup();

  // Poll every 10 seconds
  setInterval(async () => {
    await checkAndBackup();
  }, 10000);
}

start();

