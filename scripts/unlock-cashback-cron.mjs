#!/usr/bin/env node
/**
 * Standalone Cron Job Runner: Weekly Cashback Unlock
 * 
 * Can be run via system cron (e.g. Linux crontab, Windows Task Scheduler, GitHub Actions, or Vercel Cron):
 *   node scripts/unlock-cashback-cron.mjs
 * 
 * Options:
 *   --url=<baseUrl>       Base URL to trigger (default: http://localhost:3000)
 *   --secret=<cronSecret> CRON_SECRET token if configured
 */

import http from "node:http";

const args = process.argv.slice(2);
let baseUrl = process.env.APP_URL || "http://localhost:3000";
let secret = process.env.CRON_SECRET || "";

for (const arg of args) {
  if (arg.startsWith("--url=")) {
    baseUrl = arg.split("=")[1];
  } else if (arg.startsWith("--secret=")) {
    secret = arg.split("=")[1];
  }
}

async function runCron() {
  const targetUrl = new URL("/api/cron/unlock-cashback", baseUrl);
  if (secret) {
    targetUrl.searchParams.set("secret", secret);
  }

  console.log(`[CashbackCron] Triggering weekly cashback unlock: ${targetUrl.origin}${targetUrl.pathname}`);

  try {
    const headers = {
      "User-Agent": "Cashback-Cron-Runner/1.0",
      ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
    };

    const res = await fetch(targetUrl.toString(), {
      method: "POST",
      headers,
    });

    const data = await res.json();
    if (!res.ok) {
      console.error(`[CashbackCron] Failed with status ${res.status}:`, data);
      process.exit(1);
    }

    console.log(`[CashbackCron] SUCCESS at ${new Date().toISOString()}`);
    console.log(`[CashbackCron] Tranches unlocked: ${data.data?.unlockedTranches ?? 0}`);
    console.log(`[CashbackCron] Full result:`, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`[CashbackCron] Network/Execution error:`, err.message);
    process.exit(1);
  }
}

runCron();
