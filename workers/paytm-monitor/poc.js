import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { config } from "./config.js";
import { logger } from "./logger.js";

console.log("\n===============================================================================");
console.log("  PAYTM BUSINESS DASHBOARD MONITOR — PHASE 1 FEASIBILITY PROOF OF CONCEPT");
console.log("===============================================================================\n");

async function runFeasibilityPoc() {
  logger.info("Initializing persistent browser profile...", { profileDir: config.profileDir });

  // Ensure directories exist
  if (!fs.existsSync(config.profileDir)) fs.mkdirSync(config.profileDir, { recursive: true });
  if (!fs.existsSync(config.logsDir)) fs.mkdirSync(config.logsDir, { recursive: true });

  const context = await chromium.launchPersistentContext(config.profileDir, {
    headless: false, // Always headed for Phase 1 POC so merchant can observe and log in
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

  // Buffer to capture background API calls made by Paytm SPA
  const capturedApiResponses = [];

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
            capturedApiResponses.push({ url, status: response.status(), data: json });
            logger.info(`[API Intercepted] Captured JSON response from ${url.slice(0, 80)}...`);
          } catch {}
        }
      }
    } catch {}
  });

  logger.info(`Navigating to Paytm Business Dashboard: ${config.dashboardUrl}`);
  await page.goto(config.dashboardUrl, { waitUntil: "domcontentloaded", timeout: 60000 });

  // Check if login is required
  let currentUrl = page.url();
  const isLoginPage =
    currentUrl.includes("accounts.paytm.com") ||
    currentUrl.includes("login") ||
    (await page.$("text=Login with Paytm").catch(() => null)) ||
    (await page.$("text=Scan QR Code").catch(() => null));

  if (isLoginPage) {
    logger.alert("*******************************************************************************");
    logger.alert("  ACTION REQUIRED: MANUAL LOGIN");
    logger.alert("  Please log in using QR code scan or Mobile OTP in the opened browser window.");
    logger.alert("  Your login session will be safely saved in your dedicated local browser profile.");
    logger.alert("  Waiting up to 10 minutes for you to complete login...");
    logger.alert("*******************************************************************************");

    // Wait until user finishes login and lands on a dashboard page
    const loginTimeout = 600000; // 10 minutes
    const startTime = Date.now();

    while (Date.now() - startTime < loginTimeout) {
      await page.waitForTimeout(3000);
      currentUrl = page.url();
      if (
        !currentUrl.includes("accounts.paytm.com") &&
        !currentUrl.includes("login") &&
        (currentUrl.includes("dashboard") || currentUrl.includes("business.paytm.com"))
      ) {
        logger.success("Login completed successfully! Navigating to Transactions view...");
        break;
      }
    }
  }

  // Ensure we are on the transactions view
  await page.waitForTimeout(4000);
  if (!page.url().includes("payment") && !page.url().includes("transaction")) {
    logger.info(`Re-navigating to transactions page: ${config.dashboardUrl}`);
    await page.goto(config.dashboardUrl, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  }

  logger.info("Scanning Paytm Business Transactions page for tabular/card data...");
  await page.waitForTimeout(5000);

  // Take screenshot for POC audit verification
  const screenshotPath = path.join(config.logsDir, "poc-dashboard-screenshot.png");
  await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {});
  logger.info(`Audit screenshot saved: ${screenshotPath}`);

  // Inspect DOM elements
  const domInspection = await page.evaluate(() => {
    const results = [];

    // Find table rows or list items
    const rows = document.querySelectorAll(
      "table tbody tr, [role='row'], .payment-row, .txn-row, [data-testid*='transaction'], [class*='TransactionRow']"
    );

    rows.forEach((row, idx) => {
      if (idx > 15) return; // Sample up to 15
      const text = row.innerText || "";
      const rawHtml = row.innerHTML || "";

      // Try extracting amounts
      const amountMatch = text.match(/(?:₹|INR|\+)\s*([0-9,]+(?:\.[0-9]{2})?)/i);
      // Try extracting 12-digit RRN / UTR
      const rrnMatch = text.match(/\b([0-9]{12})\b/);
      // Try extracting date / time
      const dateMatch = text.match(
        /([0-9]{1,2}\s+[A-Za-z]{3}\s+[0-9]{2,4}|[0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})(?:,\s*([0-9]{1,2}:[0-9]{2}(?:\s*[AP]M)?))?/i
      );
      // Try status
      const isSuccess = /success|completed|received|paid/i.test(text);
      const isPending = /pending|processing/i.test(text);
      const isFailed = /failed|rejected|declined/i.test(text);

      results.push({
        index: idx + 1,
        fullTextPreview: text.replace(/\s+/g, " ").trim().slice(0, 160),
        amount: amountMatch ? amountMatch[1] : null,
        rrn: rrnMatch ? rrnMatch[1] : null,
        status: isSuccess ? "SUCCESS" : isPending ? "PENDING" : isFailed ? "FAILED" : "UNKNOWN",
        date: dateMatch ? dateMatch[0] : null,
      });
    });

    return {
      rowCount: rows.length,
      sampleRows: results,
      pageTitle: document.title,
      url: window.location.href,
    };
  });

  // Compile Feasibility Report
  const report = {
    generatedAt: new Date().toISOString(),
    pageTitle: domInspection.pageTitle,
    url: domInspection.url,
    totalRowsDetectedInDom: domInspection.rowCount,
    sampleRowsExtracted: domInspection.sampleRows,
    interceptedApiResponsesCount: capturedApiResponses.length,
    interceptedApiSamples: capturedApiResponses.slice(0, 3),
    fieldAvailability: {
      amountDetected: domInspection.sampleRows.some((r) => r.amount !== null),
      rrnDetected: domInspection.sampleRows.some((r) => r.rrn !== null),
      statusDetected: domInspection.sampleRows.some((r) => r.status !== "UNKNOWN"),
      dateDetected: domInspection.sampleRows.some((r) => r.date !== null),
      apiPayloadAvailable: capturedApiResponses.length > 0,
    },
  };

  const reportFilePath = path.join(config.logsDir, "poc-feasibility-report.json");
  fs.writeFileSync(reportFilePath, JSON.stringify(report, null, 2), "utf8");

  console.log("\n===============================================================================");
  console.log("                           FEASIBILITY ANALYSIS REPORT                          ");
  console.log("===============================================================================");
  console.log(`Page Title       : ${report.pageTitle}`);
  console.log(`Page URL         : ${report.url}`);
  console.log(`Transactions Seen: ${report.totalRowsDetectedInDom} rows`);
  console.log(`API Intercepted  : ${report.interceptedApiResponsesCount} background payloads`);
  console.log("-------------------------------------------------------------------------------");
  console.log("FIELD VISIBILITY MATRIX:");
  console.log(`  • Amount (₹)               : ${report.fieldAvailability.amountDetected ? "✅ VISIBLE" : "❌ NOT DETECTED"}`);
  console.log(`  • Status (SUCCESS/FAILED)  : ${report.fieldAvailability.statusDetected ? "✅ VISIBLE" : "❌ NOT DETECTED"}`);
  console.log(`  • Date & Time              : ${report.fieldAvailability.dateDetected ? "✅ VISIBLE" : "❌ NOT DETECTED"}`);
  console.log(`  • Bank Ref / RRN / UTR     : ${report.fieldAvailability.rrnDetected ? "✅ VISIBLE DIRECTLY" : "⚠️ REQUIRES DETAIL EXPANSION / API"}`);
  console.log(`  • Structured JSON API Intercept: ${report.fieldAvailability.apiPayloadAvailable ? "✅ ACTIVE (Best precision)" : "⚠️ DOM ONLY"}`);
  console.log("-------------------------------------------------------------------------------");

  if (report.sampleRowsExtracted.length > 0) {
    console.log("SAMPLE TRANSACTIONS EXTRACTED (First 3):");
    report.sampleRowsExtracted.slice(0, 3).forEach((r, i) => {
      console.log(`  [#${i + 1}] Amount: ₹${r.amount || "N/A"} | Status: ${r.status} | Date: ${r.date || "N/A"} | RRN: ${r.rrn || "In Detail"} | Text: "${r.fullTextPreview.slice(0, 60)}..."`);
    });
  } else {
    logger.warn("No transaction rows detected in the default table. The dashboard may be empty or use a custom container.");
  }

  console.log("-------------------------------------------------------------------------------");
  console.log(`Full report saved to: ${reportFilePath}`);
  console.log("Audit screenshot saved to: " + screenshotPath);
  console.log("===============================================================================\n");

  logger.info("Phase 1 Feasibility Proof of Concept finished. Keeping browser open for 30s for your review...");
  await page.waitForTimeout(30000);
  await context.close();
  logger.success("Browser closed. POC completed.");
}

runFeasibilityPoc().catch((err) => {
  logger.error("POC execution failed:", err);
  process.exit(1);
});
