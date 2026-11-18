import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from current directory
dotenv.config({ path: path.join(__dirname, ".env") });

export const config = {
  // Target Paytm Business URL
  dashboardUrl:
    process.env.PAYTM_DASHBOARD_URL ||
    "https://dashboard.paytm.com/next/ap-payments",

  // Conservative polling interval (30-60 seconds recommended)
  pollIntervalSeconds: Math.max(
    20,
    parseInt(process.env.POLL_INTERVAL_SECONDS || "45", 10)
  ),

  // Persistent browser profile directory (keeps cookies & session on this machine)
  profileDir: path.resolve(
    __dirname,
    process.env.BROWSER_PROFILE_PATH || "./browser-profile"
  ),

  // Headless mode: Default false so user can see & login on Windows / RDP
  headless: process.env.HEADLESS === "true",

  // Shared secret for HMAC-SHA256 signature verification with Next.js app
  reconciliationSecret: process.env.PAYTM_RECONCILIATION_SECRET || "",

  // Website private reconciliation endpoint URL
  reconciliationApiUrl:
    process.env.RECONCILIATION_API_URL ||
    "http://localhost:3000/api/internal/reconcile-paytm",

  // Health server port
  healthPort: parseInt(process.env.HEALTH_PORT || "4040", 10),

  // Paths
  logsDir: path.join(__dirname, "logs"),
  stateDir: path.join(__dirname, "state"),
  processedTxnsFile: path.join(__dirname, "state", "processed-txns.json"),
};
