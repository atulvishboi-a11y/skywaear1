# SKYWEAR / ZENIN — Phase 1: Database Issues & Defect Catalog

**Version:** 1.0  
**Status:** Validated against live Neon PostgreSQL & Codebase Inspection  

---

## Issue Summary Matrix

| ID | Issue Description | Domain | Severity | Affected Tables / Files |
|---|---|---|---|---|
| **ISS-01** | Floating Point Monetary Precision | Financial / Orders | 🔴 **CRITICAL** | `Order`, `OrderItem`, `WalletTransaction` |
| **ISS-02** | Split-Brain State Drift | Architecture | 🔴 **CRITICAL** | `AppState.data` vs Relational Tables |
| **ISS-03** | Ledger Balance Inconsistencies | Wallet / Accounting | 🔴 **CRITICAL** | `User`, `WalletTransaction`, `AppState` |
| **ISS-04** | Missing Unique Constraint on Phone | Identity / Auth | 🟠 **HIGH** | `User.phone` |
| **ISS-05** | Guest Order Orphan State | Commerce / Orders | 🟠 **HIGH** | `Order.userId` (25 of 31 orders unlinked) |
| **ISS-06** | Single-Entry Mutable Ledger | Wallet / Accounting | 🟠 **HIGH** | `WalletTransaction`, `User` |
| **ISS-07** | Hardcoded User IDs in Business Logic | Code Integrity | 🟠 **HIGH** | `services.ts`, migration scripts |
| **ISS-08** | Incomplete Vesting / Unlock Engine | Rewards | 🟡 **MEDIUM** | `CashbackTranche` (0 rows, wrong model) |
| **ISS-09** | Missing E-commerce Domain Tables | Catalog / Inventory | 🟡 **MEDIUM** | Missing `Cart`, `Wishlist`, `Inventory`, `Category` |
| **ISS-10** | Duplicate Lowercase PostgreSQL Tables | Schema / DDL | 🟡 **MEDIUM** | `appstate` vs `AppState`, `authotp` vs `AuthOtp` |
| **ISS-11** | Brand Identity Split (ZENIN vs SKYWEAR) | Identity / Data | 🟢 **LOW** | Customer emails, routes, hardcoded copy |

---

## Detailed Defect Catalog

### ISS-01: Floating Point Monetary Precision (CRITICAL)
- **Problem:** Database columns representing fiat money (`total`, `subtotal`, `discount`, `deliveryFee`, `affiliateCommission`, `rupeeValue`) use IEEE 754 `DOUBLE PRECISION` / `Float`.
- **Impact:** Floating point arithmetic leads to precision accumulation errors (`₹999.00 - ₹100.00 = ₹898.9999999999999`), causing webhook checksum failures, reconciliation mismatches with Razorpay/Paytm, and financial audit failure.
- **Remedy:** Convert all monetary amounts to **integer paisa** (e.g. `total_paisa BIGINT` where ₹1.00 = 100 paisa) or `NUMERIC(14, 2)`.

---

### ISS-02: Split-Brain State Drift (CRITICAL)
- **Problem:** The system maintains two simultaneous sources of truth:
  1. `AppState.data` JSON blob (and `.data/zenin-state.json`).
  2. PostgreSQL relational tables.
- **Evidence:**
  - `Order` table contains **31 orders**, while `AppState.orders` contains **13 orders**.
  - `Product` table contains **33 products**, while `AppState.products` contains **27 products**.
  - `WithdrawalRequest` table contains **1 request**, while `AppState.withdrawals` contains **3 requests**.
- **Impact:** Admin actions performed on relational tables do not reflect in storefront state; customer actions saved to JSON state can be overwritten or lost upon server reboot or DB resync.
- **Remedy:** Eliminate the JSON monolithic state blob. Establish PostgreSQL normalized relational tables as the single authoritative source of truth.

---

### ISS-03: Ledger Balance Inconsistencies (CRITICAL)
- **Problem:** `User.availablePoints` does not match the sum of completed `WalletTransaction` entries:
  - **Vikash Patel (`usr-mvxo22lh`):** `User.availablePoints = 0`, but completed transactions sum to **+20,250 points**.
  - **Umesh Patel (`usr-mvxjbw8x`):** `User.availablePoints = 135,870`, but completed transactions sum to **141,945 points** (gap of 6,075 points).
- **Cause:** Arbitrary mutations (`vikash.availablePoints = 0`) in utility scripts (`scripts/reconcile-vikash-wallet.js`) without generating an offsetting double-entry ledger record.
- **Remedy:** Implement double-entry immutable ledger accounting where balances are derived from or strictly locked to immutable transaction journal entries.

---

### ISS-04: Missing Unique Constraint on Phone (HIGH)
- **Problem:** `User.phone` has no `UNIQUE` constraint or unique index in PostgreSQL.
- **Risk:** Race condition during OTP verification or checkout allows two distinct accounts with the same phone number to be created, splitting order history and wallet balances.
- **Remedy:** Sanitize and E.164-normalize all phone numbers, and apply `CREATE UNIQUE INDEX uq_user_phone ON "User"(phone);`.

---

### ISS-05: Guest Order Orphan State (HIGH)
- **Problem:** Out of 31 orders in the database, **25 orders have `userId = NULL`**.
- **Impact:** Customers returning to view their order history or earn cashback see empty profiles. Referral commissions cannot be attributed to the referee account if the order lacks a `userId`.
- **Remedy:** Implement transactional checkout account resolution: match customer phone number during checkout, associate the order to the existing or newly created `User` record within the same transaction.

---

### ISS-06: Single-Entry Mutable Ledger (HIGH)
- **Problem:** `WalletTransaction` is a single-entry table with a mutable `status` enum (`PENDING`, `COMPLETED`, `REVERSED`).
- **Risk:** Transactions can be edited or deleted in place. Reversing a transaction modifies the original row instead of posting a balancing credit/debit.
- **Remedy:** Transition to an append-only journal (`wallet_journal`) with debit/credit entries, idempotency keys, and running balance snapshots.

---

### ISS-07: Hardcoded User IDs in Business Logic (HIGH)
- **Problem:** Codebase files (e.g. `scripts/reconcile-vikash-wallet.js`, `src/lib/server/services.ts`) contain hardcoded user IDs like `'usr-mvxo22lh'` and explicit phone numbers for special-case reconciliation.
- **Risk:** Fragile maintenance; production bugs when user IDs change; lack of generalized business rule execution.
- **Remedy:** Replace all hardcoded customer logic with parameterized administrative workflows.

---

### ISS-08: Incomplete Vesting / Unlock Engine (MEDIUM)
- **Problem:** Schema defines `CashbackTranche` with 4 weekly tranches (`weekNumber 1..4`), but the business requirement mandates an **independent daily 3% unlock schedule** per reward grant.
- **Impact:** Current database cannot support the new daily unlock model without schema migration.
- **Remedy:** Create `reward_grants` and `daily_unlock_schedules` tables supporting custom daily percentages, versioned coin-to-rupee conversion rates, and idempotent cron processing.

---

### ISS-09: Missing E-Commerce Domain Tables (MEDIUM)
- **Problem:** Cart and Wishlist are stored only on client browser `localStorage`. No server-side inventory or SKU stock reservation tables exist.
- **Risk:** High cart abandonment visibility loss; risk of inventory overselling on popular sizes.
- **Remedy:** Add server-side `Cart`, `CartItem`, `Wishlist`, `ProductVariant`, `InventoryItem`, and `StockReservation` tables.

---

### ISS-10: Duplicate Lowercase PostgreSQL Tables (MEDIUM)
- **Problem:** Due to unquoted table creation in earlier migrations, `appstate` (lowercase) and `authotp` (lowercase) exist as 0-row ghost tables alongside `AppState` and `AuthOtp` (quoted PascalCase).
- **Risk:** Query confusion and schema clutter.
- **Remedy:** Safely drop the empty lowercase ghost tables during Phase 14 cleanup.

