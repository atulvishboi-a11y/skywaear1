import { createHmac, randomBytes } from "node:crypto";
import { config } from "./config.js";
import { logger } from "./logger.js";

/**
 * Sends one or more Paytm transactions to the Next.js reconciliation endpoint.
 * Protected by HMAC-SHA256 signature, timestamp window (<5 min), and nonce replay protection.
 */
export async function sendToReconciler(transactions, retryCount = 3) {
  if (!config.reconciliationSecret) {
    throw new Error(
      "PAYTM_RECONCILIATION_SECRET is not configured in worker .env. Cannot sign reconciliation requests."
    );
  }

  const payload = {
    transactions: Array.isArray(transactions) ? transactions : [transactions],
  };
  const rawBody = JSON.stringify(payload);

  const timestamp = Date.now().toString();
  const nonce = randomBytes(16).toString("hex");

  // Format: timestamp.nonce.rawBody
  const stringToSign = `${timestamp}.${nonce}.${rawBody}`;
  const signature = createHmac("sha256", config.reconciliationSecret)
    .update(stringToSign)
    .digest("hex");

  let attempt = 0;
  let lastError = null;

  while (attempt < retryCount) {
    attempt++;
    try {
      const response = await fetch(config.reconciliationApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-reconcile-timestamp": timestamp,
          "x-reconcile-nonce": nonce,
          "x-reconcile-signature": signature,
        },
        body: rawBody,
      });

      const responseText = await response.text();
      let responseJson = null;
      try {
        responseJson = JSON.parse(responseText);
      } catch {}

      if (!response.ok) {
        throw new Error(
          `Reconciliation endpoint returned HTTP ${response.status}: ${
            responseJson?.error || responseText.slice(0, 160)
          }`
        );
      }

      return responseJson;
    } catch (err) {
      lastError = err;
      logger.warn(
        `[ReconcileClient] Attempt ${attempt}/${retryCount} failed: ${err.message}`
      );
      if (attempt < retryCount) {
        // Exponential backoff: 2s, 4s...
        await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
      }
    }
  }

  throw lastError;
}
