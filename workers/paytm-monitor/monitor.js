import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { sendToReconciler } from "./reconcileClient.js";

// Ensure state and logs directories exist
if (!fs.existsSync(config.stateDir)) fs.mkdirSync(config.stateDir, { recursive: true });
if (!fs.existsSync(config.logsDir)) fs.mkdirSync(config.logsDir, { recursive: true });

// State Tracking
let processedTxns = new Set();
try {
  if (fs.existsSync(config.processedTxnsFile)) {
    const raw = JSON.parse(fs.readFileSync(config.processedTxnsFile, "utf8"));
    if (Array.isArray(raw)) {
      processedTxns = new Set(raw);
    }
  }
} catch (err) {
  logger.warn("Could not load processed-txns.json, starting fresh.", err);
}

function persistProcessedTxns() {
  try {
    const list = Array.from(processedTxns).slice(-3000); // Keep last 3000
    fs.writeFileSync(config.processedTxnsFile, JSON.stringify(list, null, 2), "utf8");
  } catch (err) {
    logger.error("Failed to persist processed-txns.json:", err);
  }
}

// Health metrics
const metrics = {
  status: "STARTING",
  startTime: Date.now(),
  lastPollTimestamp: null,
  pollCount: 0,
  processedCount: processedTxns.size,
  reconciledCount: 0,
  lastError: null,
  currentUrl: null,
  activeSession: false,
};

// Start local HTTP Health Server
const healthServer = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    const memory = process.memoryUsage();
    const data = {
      ...metrics,
      uptimeSeconds: Math.floor((Date.now() - metrics.startTime) / 1000),
      memoryUsageMb: Math.round(memory.rss / 1024 / 1024),
      time: new Date().toISOString(),
    };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data, null, 2));
  } else {
    res.writeHead(404);
    res.end();
  }
});

healthServer.listen(config.healthPort, "127.0.0.1", () => {
  logger.info(`Health check server listening at http://127.0.0.1:${config.healthPort}/health`);
});

// Main Monitoring Worker
async function startMonitor() {
  logger.info("===============================================================================");
  logger.info("  STARTING PAYTM BUSINESS DASHBOARD 24/7 TRANSACTION MONITOR & RECONCILER      ");
  logger.info("===============================================================================");
  logger.info(`Profile Directory : ${config.profileDir}`);
  logger.info(`Dashboard URL     : ${config.dashboardUrl}`);
  logger.info(`Polling Interval  : ${config.pollIntervalSeconds} seconds`);
  logger.info(`Reconcile Endpoint: ${config.reconciliationApiUrl}`);
  logger.info(`Previously Seen   : ${processedTxns.size} transactions`);

  const context = await chromium.launchPersistentContext(config.profileDir, {
    headless: config.headless,
    viewport: { width: 1440, height: 900 },
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-dev-shm-usage",
    ],
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });

  const page = context.pages()[0] || (await context.newPage());

  // Buffer of API responses intercepted from Paytm SPA
  let capturedTxnsFromApi = [];

  page.on("response", async (response) => {
    try {
      const url = response.url();
      const contentType = response.headers()["content-type"] || "";
      if (
        contentType.includes("application/json") &&
        (url.includes("order") ||
          url.includes("transaction") ||
          url.includes("payment") ||
          url.includes("ap-proxy") ||
          url.includes("settlement"))
      ) {
        const text = await response.text().catch(() => "");
        if (text && (text.includes("amount") || text.includes("txn") || text.includes("rrn"))) {
          try {
            const json = JSON.parse(text);
            extractTransactionsFromJson(json, capturedTxnsFromApi);
          } catch {}
        }
      }
    } catch {}
  });

  // Helper to unpack nested JSON structures returned by Paytm
  function extractTransactionsFromJson(json, list) {
    if (!json) return;
    const candidates = Array.isArray(json)
      ? json
      : Array.isArray(json.data)
      ? json.data
      : Array.isArray(json.orders)
      ? json.orders
      : Array.isArray(json.transactions)
      ? json.transactions
      : Array.isArray(json.list)
      ? json.list
      : [json];

    for (const item of candidates) {
      if (typeof item !== "object" || !item) continue;
      const paytmTxnId =
        item.txnId || item.transactionId || item.orderId || item.paytmOrderId || item.id;
      const amount =
        item.txnAmount || item.amount || item.orderAmount || item.payableAmount;
      const rrn =
        item.bankTxnId || item.rrn || item.bankRefNo || item.utr || item.refNo;
      const statusRaw = (item.status || item.orderStatus || item.txnStatus || "").toUpperCase();
      const status =
        statusRaw.includes("SUCCESS") || statusRaw.includes("COMPLETE")
          ? "SUCCESS"
          : statusRaw.includes("PENDING")
          ? "PENDING"
          : "FAILED";

      if (paytmTxnId && amount) {
        list.push({
          paytmTxnId: String(paytmTxnId),
          rrn: rrn ? String(rrn) : undefined,
          amount: parseFloat(amount),
          status,
          payerVpa: item.payerVpa || item.vpa || item.customerVpa || undefined,
          paidAt: item.txnDate || item.createdTime || item.orderTime || new Date().toISOString(),
          orderIdHint: item.merchantOrderId || item.userComment || undefined,
          source: "API_INTERCEPT",
        });
      }
    }
  }

  logger.info(`Opening Paytm Business: ${config.dashboardUrl}`);
  await page.goto(config.dashboardUrl, { waitUntil: "domcontentloaded", timeout: 60000 });

  // Main Loop
  let isRunning = true;

  async function poll() {
    if (!isRunning) return;
    metrics.pollCount++;
    metrics.lastPollTimestamp = new Date().toISOString();
    metrics.currentUrl = page.url();

    try {
      // 1. Session Guardian check
      const currentUrl = page.url();
      const isLoginRedirect =
        currentUrl.includes("accounts.paytm.com") ||
        currentUrl.includes("login") ||
        (await page.$("text=Login with Paytm").catch(() => null)) ||
        (await page.$("text=Scan QR Code to login").catch(() => null));

      if (isLoginRedirect) {
        metrics.status = "WAITING_LOGIN";
        metrics.activeSession = false;
        logger.alert(
          "⚠️ Paytm session expired or login required! Polling paused. Please log in on the opened browser window."
        );
        return;
      }

      metrics.status = "RUNNING";
      metrics.activeSession = true;

      // 2. Clear previous batch buffer and refresh/wait for updates
      capturedTxnsFromApi = [];

      // Check if a "Refresh" button exists on the dashboard to avoid full page reloads
      const refreshBtn = await page.$(
        "button[aria-label*='refresh' i], button:has-text('Refresh'), button:has-text('Reload')"
      );

      if (refreshBtn && (await refreshBtn.isVisible())) {
        logger.info("[Poll] Clicking in-page Refresh button...");
        await refreshBtn.click().catch(() => {});
        await page.waitForTimeout(4000);
      } else {
        // Fallback: gentle page reload every 4 polls, otherwise wait
        if (metrics.pollCount % 4 === 0) {
          logger.info("[Poll] Reloading dashboard page...");
          await page.reload({ waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
          await page.waitForTimeout(4000);
        } else {
          await page.waitForTimeout(2000);
        }
      }

      // 3. Fallback: Parse DOM table for visible rows
      const domTxns = await page.evaluate(() => {
        const rows = document.querySelectorAll(
          "table tbody tr, [role='row'], .payment-row, .txn-row, [data-testid*='transaction']"
        );
        const list = [];
        rows.forEach((row) => {
          const text = row.innerText || "";
          const amountMatch = text.match(/(?:₹|INR|\+)\s*([0-9,]+(?:\.[0-9]{2})?)/i);
          const rrnMatch = text.match(/\b([0-9]{12})\b/);
          const isSuccess = /success|completed|received|paid/i.test(text);

          if (amountMatch && isSuccess) {
            // Find any txn ID looking string
            const txnIdMatch = text.match(/\b(20[0-9]{12,24}|TXN[0-9A-Z]+)\b/i) || rrnMatch;
            const paytmTxnId = txnIdMatch ? txnIdMatch[1] : `DOM-${Date.now()}-${Math.random()}`;

            list.push({
              paytmTxnId,
              rrn: rrnMatch ? rrnMatch[1] : undefined,
              amount: parseFloat(amountMatch[1].replace(/,/g, "")),
              status: "SUCCESS",
              source: "DOM_SCRAPE",
            });
          }
        });
        return list;
      });

      // Combine API & DOM transactions (deduplicating by paytmTxnId or rrn)
      const allFound = [...capturedTxnsFromApi, ...domTxns];
      const newTransactions = [];

      for (const t of allFound) {
        const uniqueKey = t.paytmTxnId || t.rrn;
        if (!uniqueKey) continue;
        if (processedTxns.has(uniqueKey)) continue;

        processedTxns.add(uniqueKey);
        newTransactions.push(t);
      }

      if (newTransactions.length > 0) {
        logger.info(
          `[New Transactions Detected] Found ${newTransactions.length} new transactions to reconcile.`
        );
        persistProcessedTxns();
        metrics.processedCount = processedTxns.size;

        // Dispatch each SUCCESS transaction to the Next.js Reconciler
        for (const txn of newTransactions) {
          if (txn.status !== "SUCCESS") continue;

          try {
            logger.info(
              `Dispatching reconciliation request for Txn ID: ${txn.paytmTxnId}, Amount: ₹${txn.amount}, RRN: ${txn.rrn || "N/A"}`
            );
            const res = await sendToReconciler(txn);

            if (res.results && res.results.length > 0) {
              const r = res.results[0];
              if (r.status === "RECONCILED") {
                metrics.reconciledCount++;
                logger.success(
                  `🎉 [AUTO-RECONCILED] Order #${r.orderNumber} successfully approved and queued for POD print! (Txn: ${r.paytmTxnId}, RRN: ${r.rrn || "N/A"})`
                );
              } else if (r.status === "PENDING_MANUAL_REVIEW") {
                logger.warn(
                  `⚠️ [MANUAL REVIEW REQUIRED] ${r.message} (Txn: ${r.paytmTxnId}, RRN: ${r.rrn || "N/A"})`
                );
              } else if (r.status === "SKIPPED_ALREADY_PAID") {
                logger.info(
                  `ℹ️ [ALREADY PAID] Order #${r.orderNumber} was already verified.`
                );
              } else {
                logger.info(`[Reconciliation Result] ${r.message}`);
              }
            }
          } catch (err) {
            logger.error(`Failed to reconcile transaction ${txn.paytmTxnId}:`, err.message);
          }
        }
      } else {
        logger.info(
          `[Poll #${metrics.pollCount}] Dashboard active. No new unverified transactions. (Next check in ${config.pollIntervalSeconds}s)`
        );
      }
    } catch (err) {
      metrics.lastError = err.message;
      logger.error("[Poll Error]", err.message);
    }
  }

  // Interval timer
  const intervalHandle = setInterval(poll, config.pollIntervalSeconds * 1000);

  // Run first poll after initial 5 seconds
  setTimeout(poll, 5000);

  // Graceful shutdown handling
  const shutdown = async () => {
    logger.info("Shutdown signal received. Closing browser and saving state...");
    isRunning = false;
    clearInterval(intervalHandle);
    persistProcessedTxns();
    healthServer.close();
    await context.close().catch(() => {});
    logger.success("Paytm Monitor stopped cleanly.");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startMonitor().catch((err) => {
  logger.error("Fatal error starting monitor:", err);
  process.exit(1);
});
