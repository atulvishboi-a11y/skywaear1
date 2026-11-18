# SKYWEAR / ZENIN — Phase 1: Database & Codebase Audit Report

**Date:** November 4, 2026  
**Auditor:** Senior Database & Backend Architect (Pair Programming with User)  
**Database Evaluated:** Neon PostgreSQL (`ep-summer-hill-b5orxtlt`) + Local Environment  
**Codebase:** Next.js 16.4.3 (Turbopack), React 19.3.0, Prisma 8.0.0-rc.22, pg 8.23.1  

---

## 1. Executive Summary

This audit evaluates the live database and backend architecture of **SKYWEAR** (historically **ZENIN STREETWEAR**), an anime streetwear e-commerce platform featuring heavyweight 240+ GSM t-shirts, cashback coins, referral rewards, UPI withdrawals, and Qikink print-on-demand fulfillment.

### Critical Verdict:
The system operates under a **hybrid split-brain persistence model**:
1. An in-memory/JSON state object (`ZeninState`) stored as a single JSONB blob in `AppState.data` (and `.data/zenin-state.json`) acts as the primary runtime state.
2. A 16-model PostgreSQL relational schema (`User`, `Order`, `Product`, `WalletTransaction`, etc.) exists in parallel.
3. Operations frequently update one layer without reconciling the other, leading to **severe state drift, wallet balance discrepancies, guest order orphan states, and hardcoded balance overrides**.

---

## 2. Live Database Inventory (Actual Neon PostgreSQL Inspection)

| Table Name | Row Count | Primary Key | Description & Domain |
|---|---|---|---|
| `AppState` | 1 | `key` | Central JSON blob (`zenin_state`), revision counter |
| `appstate` | 0 | `key` | Lowercase duplicate table created during case-sensitive migration |
| `User` | 6 | `id` | Registered customers & admins |
| `DeletedUsersBin` | 8 | `id` | Soft-deleted / pruned users dumped on 2026-11-04 |
| `Order` | 31 | `id` | E-commerce orders (sales, gifts, replacements) |
| `OrderItem` | 39 | `id` | Line items for orders |
| `Product` | 33 | `id` | Catalog items with sizes, colors, GSM |
| `WalletTransaction` | 18 | `id` | Single-entry coin credit/debit records |
| `WithdrawalRequest` | 1 | `id` | UPI payout withdrawal requests |
| `WithdrawalTranche` | 0 | `id` | 4-week withdrawal tranches |
| `CashbackTranche` | 0 | `id` | 4-week cashback unlock tranches |
| `Referral` | 0 | `id` | Referrer-referee relationship tracking |
| `RewardRule` | 1 | `id` | Global reward/cashback rules |
| `CustomDesign` | 0 | `id` | User-submitted custom t-shirt designs |
| `TimelineEvent` | 0 | `id` | Order fulfillment milestone events |
| `AuditLog` | 3 | `id` | Administrative action audit trails |
| `AuthOtp` | 8 | `id` | OTP tokens for SMS/email authentication |
| `authotp` | 0 | `id` | Lowercase duplicate table |

---

## 3. Data Integrity & Verification Findings

### A. Wallet Balance Discrepancies (CRITICAL)
Comparison of `User.availablePoints` against the calculated sum of completed ledger entries (`WalletTransaction`):

| User ID | Customer Name | Phone | Available Points in `User` | Calculated Ledger Points | Discrepancy |
|---|---|---|---|---|---|
| `usr-mvxo22lh` | Vikash patel | `+91 7583893833` | 0 | **20,250** | **-20,250 points** |
| `usr-mvxjbw8x` | Umesh patel | `+91 8878129630` | 135,870 | **141,945** | **-6,075 points** |

**Root Cause:**
- Manual override script `scripts/reconcile-vikash-wallet.js` set `vikash.availablePoints = 0` directly in `AppState` without inserting offsetting `REDEMPTION` or `WITHDRAWAL` rows in `WalletTransaction`.
- Single-entry balance tracking creates balance mutability without an immutable audit trail.

### B. State Drift: JSON AppState vs Relational Tables (CRITICAL)
| Entity | In `AppState` JSON Blob | In Relational Postgres Tables | Variance |
|---|---|---|---|
| Customers | 6 (keyed by array index `0..5`) | 6 (`usr-*` alphanumeric IDs) | ID structure mismatch |
| Orders | 13 | 31 | **18 orders missing from JSON state** |
| Products | 27 | 33 | **6 products missing from JSON state** |
| Withdrawals | 3 | 1 | **2 withdrawals missing from Postgres** |
| Transactions | 0 (stored separately) | 18 | Empty array in JSON |

### C. Guest Checkout & Unlinked Orders (HIGH)
- **Total Orders:** 31
- **Orders with `userId IS NULL`:** 25 (80.6% of all orders!)
- **Orders linked to registered `User`:** 6
- Customers who enter phone numbers at checkout are frequently created as guest records or unlinked rows in `Order`, preventing unified customer lifetime value, order tracking, and referral attribution.

### D. Deleted Users Bin (MEDIUM)
- On `2026-11-04T03:45:22Z`, 8 users were deleted from `User` and dumped into `DeletedUsersBin`:
  - `usr-mvv00zg9` (Skywear Member, +91 6263753814)
  - `usr-mv93zpgd` (Zenin Member, +91 8085520414)
  - `usr-mvhq265e` (Ceiling Probe, 9000000001)
  - `usr-mvjodda5` (Zenin Member, +91 90000 00000)
  - `usr-mvsi6fmh` (Aman Test, +91 9811223344)
  - `cust_razorpay_tester` (Razorpay Verification Team, 9876500000)
  - `usr-mw0zrm57` (Aakash Vishwakarma, +91 9755970547)
  - `usr_aman_01` (Aman Sharma, +91 98765 43210)
- Historical orders or transactions belonging to these users may now have missing or null references.

---

## 4. Database Schema Flaws & Missing Primitives

1. **Floating Point Monetary Fields (`Float` / `Double Precision`):**
   - `Order.total`, `subtotal`, `discount`, `deliveryFee`, `affiliateCommission`, `pointsRedeemedValue` are all `double precision`.
   - `WalletTransaction.rupeeValue` is `double precision`.
   - **Risk:** Floating point roundoff errors (`0.1 + 0.2 = 0.30000000000000004`) in rupee calculations. Must be stored in integer **paisa** or `NUMERIC(12, 2)`.

2. **Missing Unique Constraint on Phone:**
   - `User.phone` has no unique index or constraint. Only `email` and `referralCode` have unique indexes.
   - Dual account creation via phone login is possible under concurrent requests.

3. **Missing Critical Domain Tables:**
   - **Cart / CartItem:** Cart is purely in-memory / client `localStorage`.
   - **Wishlist:** Wishlist is client `localStorage`.
   - **Inventory / Stock:** No inventory, warehouse, reserved stock, or SKU tracking.
   - **Categories & Brands:** Product category is a plain unindexed string.
   - **Customer Addresses:** Stored as a denormalized JSON array on `User.addresses`.
   - **Support Tickets:** Support inquiries are not stored in relational tables.
   - **Notifications:** In-app notification state is embedded in JSON.

4. **Vesting & Unlock Architecture Gap:**
   - Existing schema contains `CashbackTranche` (0 rows) configured for a 4-week model (25% per week).
   - The master business requirement mandates an **independent daily 3% unlock system** per grant, which requires a new dedicated grant & schedule ledger.

---

## 5. Indexes and Constraints Audit

### Existing Indexes (32 total):
- Primary Keys on all 16 tables.
- Unique constraints: `Order_orderNumber_key`, `Product_slug_key`, `User_email_key`, `User_referralCode_key`, `uq_cashback_order_week`, `uq_withdrawal_week`.
- Performance indexes:
  - `idx_order_email` on `Order(customerEmail)`
  - `idx_order_status_placed` on `Order(status, placedAt)`
  - `idx_orderitem_order` on `OrderItem(orderId)`
  - `idx_product_cat_archived` on `Product(category, isArchived)`
  - `idx_tx_user_created` on `WalletTransaction(userId, createdAt)`
  - `idx_withdrawal_user_status` on `WithdrawalRequest(userId, overallStatus)`

### Critical Missing Indexes:
- `Order(customerPhone)` — order lookup by phone currently triggers a sequential scan.
- `User(phone)` — customer lookup by phone runs without a dedicated unique index.
- `Order(userId)` — foreign key index missing.
- `OrderItem(productId)` — foreign key index missing.
- `WalletTransaction(orderId)` — lookup by order triggers table scan.

