# Paytm Business Dashboard 24/7 Transaction Monitor & Reconciler

A production-grade, fault-tolerant Node.js + Playwright worker that monitors your logged-in **Paytm for Business** merchant dashboard on a Windows PC / RDP machine, extracts incoming UPI payments, and securely auto-reconciles them with pending `MANUAL_UPI` orders on your Next.js e-commerce store.

---

## Architecture Overview

```
 ┌─────────────────────────────────────────────────────────┐
 │ Windows PC / 24/7 RDP Machine                           │
 │                                                         │
 │  ┌───────────────────────────────────────────────────┐  │
 │  │ Persistent Chromium Context (browser-profile)     │  │
 │  │  • Stored cookies & session                        │  │
 │  │  • Opens dashboard.paytm.com                      │  │
 │  │  • You log in once manually with QR / OTP         │  │
 │  └────────────────────────┬──────────────────────────┘  │
 │                           │ Intercepts API & DOM (30-60s)
 │  ┌────────────────────────▼──────────────────────────┐  │
 │  │ monitor.js (Worker)                               │  │
 │  │  • Deduplicates seen transactions (state.json)    │  │
 │  │  • Detects session logout / pauses safely         │  │
 │  │  • Local health server (127.0.0.1:4040/health)    │  │
 │  │  • Signs payload with HMAC-SHA256                 │  │
 │  └────────────────────────┬──────────────────────────┘  │
 └───────────────────────────┼─────────────────────────────┘
                             │
                             │ HTTPS POST (Signed with timestamp & nonce)
                             ▼
 ┌─────────────────────────────────────────────────────────┐
 │ Next.js Storefront (Vercel / Production)                │
 │  /api/internal/reconcile-paytm                          │
 │                                                         │
 │  1. Verifies HMAC-SHA256 signature                      │
 │  2. Enforces <5m replay protection                      │
 │  3. Reconciles exact amount & RRN against pending order │
 │  4. Marks order as PAID & APPROVED                      │
 │  5. Triggers Qikink POD fulfillment & cashback schedule │
 └─────────────────────────────────────────────────────────┘
```

---

## Phase 1: Verify Feasibility First (Proof of Concept)

Before turning on auto-reconciliation, you must run the read-only feasibility POC to inspect your specific Paytm Business layout and confirm fields are visible.

### Step 1: Run the POC
On your Windows / RDP machine, navigate to `workers/paytm-monitor` and run:

```cmd
start-poc.bat
```
*(Or in terminal: `npm install && npx playwright install chromium && node poc.js`)*

### Step 2: Log in Manually
1. A Chromium browser window will open at `https://dashboard.paytm.com/next/ap-payments`.
2. Scan the QR code or enter your mobile OTP to log in.
3. The POC will detect your successful login and wait for the transactions table to load.

### Step 3: Test with a Small Real Transaction
- Send ₹1 or ₹10 to your Merchant UPI ID (e.g. from PhonePe/GPay).
- Watch the POC terminal output.
- It will inspect both **intercepted network JSON calls** and the **rendered DOM table**.

### Step 4: Review the Feasibility Report
The POC will output a summary table in the terminal and write a detailed audit log to:
`logs/poc-feasibility-report.json`

Verify the following:
- [x] **Amount**: Is the exact paid rupee amount captured?
- [x] **Status**: Does it indicate `SUCCESS` / `Completed`?
- [x] **Bank Ref No / RRN**: Does the 12-digit UPI reference number appear?
- [x] **Date / Time**: Is the transaction timestamp accurate?
- [x] **Payer Details**: Does it capture the customer's VPA / UPI ID?

> **Note on RRN Matching:** In some bank apps, customers may input `UPI/429381029482` or `429381029482`. Our reconciler automatically normalizes both to the clean 12-digit alphanumeric string before matching.

---

## Phase 2 & 3: 24/7 Monitoring & Website Integration

Once feasibility is verified, configure the worker to automatically reconcile payments.

### 1. Environment Configuration

Create or edit `workers/paytm-monitor/.env`:
```env
PAYTM_DASHBOARD_URL=https://dashboard.paytm.com/next/ap-payments
POLL_INTERVAL_SECONDS=45
BROWSER_PROFILE_PATH=./browser-profile
HEADLESS=false

# Must match PAYTM_RECONCILIATION_SECRET in your main website .env or Vercel Settings
PAYTM_RECONCILIATION_SECRET=f8a9e2d41b6c73809e5a3c2f10d48b7a692e1f40d85a73b2c1e4f6089a5c7e3b

# For local testing:
RECONCILIATION_API_URL=http://localhost:3000/api/internal/reconcile-paytm

# For production on Vercel:
# RECONCILIATION_API_URL=https://your-domain.com/api/internal/reconcile-paytm

HEALTH_PORT=4040
```

### 2. Add Secret to Vercel
If your website is hosted on Vercel:
1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**.
2. Add:
   - Key: `PAYTM_RECONCILIATION_SECRET`
   - Value: `f8a9e2d41b6c73809e5a3c2f10d48b7a692e1f40d85a73b2c1e4f6089a5c7e3b` (or your custom 64-char hex secret).
3. Redeploy or promote.

### 3. Start 24/7 Monitoring
Double-click:
```cmd
start-monitor.bat
```
*(Or in terminal: `npm start`)*

The monitor will:
1. Open Paytm Business in your persistent browser profile.
2. Poll every 45 seconds for newly settled transactions.
3. Skip transactions already processed (`state/processed-txns.json`).
4. Sign requests using HMAC-SHA256 and dispatch to your website.
5. If session expires, pause polling and emit an alert asking for re-login.

---

## Phase 4: Reliability, Supervised Running & Security

### Windows Task Scheduler (Auto-Start on Boot)
To ensure the worker runs 24/7 even after RDP machine reboots:
1. Open PowerShell **as Administrator**.
2. Run:
   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   .\setup-task-scheduler.ps1
   ```
3. The task `PaytmBusinessMonitor` will be registered to automatically launch `start-monitor.bat` whenever the user logs on.

### Health Check Endpoint
The worker provides an internal health monitoring API:
```
GET http://127.0.0.1:4040/health
```
Response:
```json
{
  "status": "RUNNING",
  "uptimeSeconds": 86400,
  "lastPollTimestamp": "2026-10-25T02:00:00.000Z",
  "pollCount": 1920,
  "processedCount": 142,
  "reconciledCount": 38,
  "activeSession": true,
  "memoryUsageMb": 115
}
```

### Security & Hardening Rules
1. **Never expose remote debugging ports**: The worker does not use `--remote-debugging-port`. Do not add it.
2. **Never expose the reconciliation secret**: `PAYTM_RECONCILIATION_SECRET` exists only in server-side `.env` files and is never included in browser bundles or client requests.
3. **Replay Protection**: The website rejects any reconciliation request older than 5 minutes or with a duplicated nonce.
4. **Amount Matching & Ambiguity Protection**:
   - The reconciler strictly compares server-calculated order total vs paid amount.
   - If a customer inputs a matching UTR but pays less, the order is flagged as `RECONCILIATION_AMOUNT_MISMATCH` and left for manual review.
   - If two pending orders match the same amount and lack distinct UTRs, both are kept in `PENDING_MANUAL_REVIEW` to prevent accidental misallocation.
5. **Fallback to Admin Manual Approval**:
   - The existing Admin Panel (**Admin -> Gateways -> Manual UPI / Orders**) remains 100% active.
   - Any transaction that cannot be auto-reconciled cleanly will remain pending for manual one-click review by the store admin.
