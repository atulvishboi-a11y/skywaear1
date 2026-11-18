# 🔧 SKYWEAR — MASTER FIX & REBUILD INSTRUCTION DOCUMENT
> **Purpose:** Ye document aapke purane Skywear application ko properly fix, optimize, aur rebuild karne ke liye ek single-source-of-truth hai. Isko kisi bhi AI (Claude, ChatGPT, Cursor, Devin) ya developer ko de do — wo bina confusion ke poora system sahi tarike se build/fix kar sakta hai.
>
> **Date:** 2026-11-05
> **Target:** Single-Store D2C E-Commerce with Coin Rewards, Daily Yield & Referral Engine

---

# 🚨 CRITICAL RULES — PEHLE PADHO, PHIR CODE KARO

> [!CAUTION]
> **IN RULES KO KABHI VIOLATE MAT KARO. AGAR KOI BHI RULE BREAK HOTA HAI TOH POORA FINANCIAL SYSTEM CORRUPT HO JAYEGA.**

1. **PURE COIN SYSTEM:** Customer-facing frontend par kabhi bhi hardcoded `₹` (Rupees) conversion mat dikhao. Customer sirf COINS dekhega (e.g., `3,000 Coins`). Admin decide karega kitna Rupee dena hai withdrawal ke waqt.
2. **NO STORE_ID / NO MULTI-VENDOR:** Ye single-store hai. Koi `store_id`, `vendor_id`, `seller_id`, ya multi-tenant logic mat daalo.
3. **UUID PRIMARY KEYS:** Har table mein `gen_random_uuid()` use karo. Auto-increment integer IDs mat use karo.
4. **IMMUTABLE ORDER SNAPSHOTS:** Order create hone ke baad product name, SKU, price, aur address ko order_items table mein copy karke freeze karo. Original product update hone par purane orders affect nahi hone chahiye.
5. **SOFT DELETION:** Important records (users, products, orders) ko hard delete mat karo. `deleted_at TIMESTAMPTZ` column use karo.
6. **DAILY UNLOCK IDEMPOTENCY:** Daily 3% coin unlock process agar ek din mein do baar run ho jaye, toh bhi coins double-credit NAHI hone chahiye. `UNIQUE (user_id, distribution_date)` constraint mandatory hai.
7. **ACID TRANSACTIONS:** Wallet debit + payout create hamesha ek single database transaction mein hona chahiye. Partial state kabhi allowed nahi hai.

---

# 📐 ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────┐
│                     SKYWEAR PLATFORM                            │
│              Single-Store D2C E-Commerce                        │
└─────────────────────────────────────────────────────────────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       ▼                      ▼                      ▼
┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  PUBLIC PAGES   │  │  CUSTOMER PORTAL │  │   ADMIN PANEL    │
│  (Guest + User) │  │  /dashboard/*    │  │   /admin/*       │
│  /, /products,  │  │  (Auth Required) │  │   (Admin Only)   │
│  /cart, /login  │  │                  │  │                  │
└─────────────────┘  └──────────────────┘  └──────────────────┘
       │                      │                      │
       └──────────────────────┼──────────────────────┘
                              ▼
                    ┌──────────────────┐
                    │  Next.js API      │
                    │  /api/*           │
                    │  Server Actions   │
                    └──────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
     ┌──────────────┐ ┌─────────────┐ ┌──────────────┐
     │ PostgreSQL   │ │ Redis +     │ │ APITxT OTP   │
     │ skywear_db   │ │ BullMQ Jobs │ │ + Razorpay   │
     │ (61 tables)  │ │ (3% Cron)   │ │ + Payouts    │
     └──────────────┘ └─────────────┘ └──────────────┘
```

---

# 🛠️ TECH STACK (MANDATORY — NO SUBSTITUTIONS)

| Layer | Technology | Version | Why |
|-------|-----------|---------|-----|
| **Framework** | Next.js (App Router) | 15+ | SSR, SEO, API routes, Server Actions |
| **Language** | TypeScript | 5+ | Financial calculations mein type-safety mandatory |
| **UI** | Tailwind CSS + Shadcn UI + Lucide Icons | Latest | Brutalist editorial design |
| **ORM** | Prisma ORM | Latest | Type-safe DB queries, migrations |
| **Database** | PostgreSQL | 18 | ACID, UUIDs, stored procedures, JSONB |
| **Auth** | Custom (Phone + OTP via APITxT) | — | No NextAuth. OTP-first, session cookie based |
| **OTP Provider** | apitxt.com | — | SMS/WhatsApp OTP delivery |
| **Payments** | Razorpay PG | — | Cards, UPI, NetBanking, PayLater |
| **Payouts** | RazorpayX / Cashfree Payouts | — | Bank + UPI withdrawal transfers |
| **Background Jobs** | BullMQ + Redis | — | Daily 3% unlock cron, webhook retry |
| **State Mgmt** | Zustand + TanStack Query | — | Cart, wallet, user session |
| **Animations** | Framer Motion | — | Page transitions, micro-interactions |

---

# 🗂️ THE 3 APP SEGMENTS (FACEBOOK-STYLE NAVIGATION)

## Segment 1: PUBLIC STOREFRONT (Routes: `/`, `/products`, `/products/[slug]`, `/cart`, `/login`)

**Access:** Everyone (Guest + Logged-in users)

**Behavior (CRITICAL — Like Facebook):**
- Guest users see: `[Login / Sign Up]` button in navbar.
- Logged-in users see the SAME public pages BUT navbar changes to show:
  - `🪙 [Pending: 2,910] | [Cash: 237]` wallet pill
  - `[Avatar: Rahul V.]` → dropdown → `My Dashboard` | `My Orders` | `Logout`
- User remains logged-in across ALL public pages until they explicitly click `Logout`.
- Session persists via HttpOnly secure cookie (NOT localStorage).

**Pages in this segment:**
| Route | Description |
|-------|-------------|
| `/` | Landing page: Hero banner, featured products with coin cashback badges, brand story |
| `/products` | Product grid with price + coin reward shown on each card |
| `/products/[slug]` | Product detail: images, size/color picker, price, "Buy & Earn X Coins" CTA |
| `/cart` | Shopping cart with item list, subtotal, coin cashback preview |
| `/login` | Phone number + Name → OTP verify → auto create account + session cookie |

## Segment 2: LOGGED-IN CUSTOMER DASHBOARD (Routes: `/dashboard/*`)

**Access:** Only authenticated users (role = `customer`). Redirect to `/login` if not authenticated.

**Pages in this segment:**
| Route | Description |
|-------|-------------|
| `/dashboard` | Overview: wallet summary, recent orders count, referral stats |
| `/dashboard/wallet` | **Dual Wallet View:** Pending Coins (with daily 3% progress) + Cash Coins (ready for use/withdrawal) |
| `/dashboard/orders` | Order history with status timeline (Pending → Shipped → Delivered), coins earned per order |
| `/dashboard/referrals` | Unique referral link (`skywear.com/ref/RAHUL200`), list of referred users, lifetime commission earnings |
| `/dashboard/payouts` | Add/manage Bank Account (Acc No, IFSC, Holder Name) or UPI ID. Submit withdrawal request. View payout history. |
| `/dashboard/profile` | Name, phone, OTP verified badge, addresses |

## Segment 3: ADMIN CONTROL PANEL (Routes: `/admin/*`)

**Access:** Only users with role = `admin`. Separate admin login gate. NO public links to admin panel anywhere on storefront.

**Pages in this segment:**
| Route | Description |
|-------|-------------|
| `/admin` (or `/admin/login`) | Admin login form (username + password, NOT OTP) |
| `/admin/dashboard` | Central metrics: today's orders, revenue, total pending coin liabilities, active users |
| `/admin/products` | CRUD products. **Set price AND manually set reward_coins** (e.g., ₹1500 price, 3000 coins) |
| `/admin/orders` | View all orders, update status (Processing → Shipped → Delivered), enter courier tracking number |
| `/admin/customers` | Browse customer profiles, view their wallets, referral trees |
| `/admin/referrals` | **Set lifetime commission rate** (e.g., 5% or 10%). Toggle referral system on/off. |
| `/admin/withdrawals` | Review user withdrawal requests. **Admin decides actual ₹ payout amount**. Enter Bank UTR. Approve/Reject. |
| `/admin/daily-yield` | View daily 3% unlock engine status. Manual trigger button. Logs of each day's distribution. |
| `/admin/settings` | Store name, currency, tax rate, free shipping threshold, shipping costs |

---

# 🏗️ CORRECT FOLDER STRUCTURE

```
skywear/
├── prisma/
│   └── schema.prisma              # Prisma ORM schema (mirrors PostgreSQL tables)
├── public/
│   ├── logo/                      # darkmode.svg, whitemode.svg, favicon
│   └── products/                  # Product images
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout (fonts, metadata, Toaster)
│   │   ├── page.tsx               # Landing page `/`
│   │   │
│   │   ├── (public)/              # Route group: Public pages
│   │   │   ├── products/
│   │   │   │   ├── page.tsx       # `/products` (grid)
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx   # `/products/bomber-jacket`
│   │   │   ├── cart/
│   │   │   │   └── page.tsx       # `/cart`
│   │   │   └── login/
│   │   │       └── page.tsx       # `/login` (Phone + OTP)
│   │   │
│   │   ├── (dashboard)/           # Route group: Customer portal (Auth protected)
│   │   │   ├── layout.tsx         # Auth check middleware + sidebar layout
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx       # `/dashboard` overview
│   │   │   │   ├── wallet/
│   │   │   │   │   └── page.tsx   # `/dashboard/wallet`
│   │   │   │   ├── orders/
│   │   │   │   │   └── page.tsx   # `/dashboard/orders`
│   │   │   │   ├── referrals/
│   │   │   │   │   └── page.tsx   # `/dashboard/referrals`
│   │   │   │   ├── payouts/
│   │   │   │   │   └── page.tsx   # `/dashboard/payouts`
│   │   │   │   └── profile/
│   │   │   │       └── page.tsx   # `/dashboard/profile`
│   │   │
│   │   ├── (admin)/               # Route group: Admin panel (Admin role protected)
│   │   │   ├── layout.tsx         # Admin auth check + admin sidebar layout
│   │   │   ├── admin/
│   │   │   │   ├── page.tsx       # `/admin` (login or redirect to dashboard)
│   │   │   │   ├── login/
│   │   │   │   │   └── page.tsx   # `/admin/login`
│   │   │   │   ├── dashboard/
│   │   │   │   │   └── page.tsx   # `/admin/dashboard`
│   │   │   │   ├── products/
│   │   │   │   │   └── page.tsx   # `/admin/products`
│   │   │   │   ├── orders/
│   │   │   │   │   └── page.tsx   # `/admin/orders`
│   │   │   │   ├── customers/
│   │   │   │   │   └── page.tsx   # `/admin/customers`
│   │   │   │   ├── referrals/
│   │   │   │   │   └── page.tsx   # `/admin/referrals`
│   │   │   │   ├── withdrawals/
│   │   │   │   │   └── page.tsx   # `/admin/withdrawals`
│   │   │   │   ├── daily-yield/
│   │   │   │   │   └── page.tsx   # `/admin/daily-yield`
│   │   │   │   └── settings/
│   │   │   │       └── page.tsx   # `/admin/settings`
│   │   │
│   │   └── api/                   # REST API endpoints
│   │       ├── auth/
│   │       │   ├── send-otp/route.ts
│   │       │   ├── verify-otp/route.ts
│   │       │   ├── logout/route.ts
│   │       │   └── me/route.ts    # Get current session user
│   │       ├── products/route.ts
│   │       ├── cart/route.ts
│   │       ├── orders/route.ts
│   │       ├── wallet/
│   │       │   ├── route.ts       # GET wallet balances
│   │       │   └── withdraw/route.ts
│   │       ├── referrals/route.ts
│   │       ├── webhooks/
│   │       │   └── razorpay/route.ts
│   │       └── admin/
│   │           ├── login/route.ts
│   │           ├── products/route.ts
│   │           ├── orders/route.ts
│   │           ├── withdrawals/route.ts
│   │           ├── referral-settings/route.ts
│   │           └── daily-yield/route.ts
│   │
│   ├── components/
│   │   ├── ui/                    # Shadcn UI components (Button, Input, Card, etc.)
│   │   ├── Navbar.tsx             # Dynamic navbar (Guest vs Logged-in vs Admin)
│   │   ├── Footer.tsx
│   │   ├── ProductCard.tsx
│   │   ├── WalletPill.tsx         # Navbar coin display pill
│   │   └── CoinBadge.tsx          # "Earn 3,000 Coins" badge on product cards
│   │
│   ├── lib/
│   │   ├── db.ts                  # Prisma client singleton
│   │   ├── auth.ts                # Session cookie read/write/verify helpers
│   │   ├── apitxt.ts              # APITxT OTP send function
│   │   └── razorpay.ts            # Razorpay order creation + webhook verify
│   │
│   ├── services/
│   │   ├── otp.service.ts         # OTP generate, send via APITxT, verify, rate-limit
│   │   ├── wallet.service.ts      # Coin credit, daily 3% unlock, balance queries
│   │   ├── referral.service.ts    # Referral code gen, commission calculation, lifetime tracking
│   │   ├── order.service.ts       # Order creation, cashback credit, status updates
│   │   └── payout.service.ts      # Withdrawal request, admin approval, bank/UPI transfer
│   │
│   └── styles/
│       └── globals.css            # Tailwind directives + custom theme
│
├── .env                           # Environment variables (NEVER commit)
├── .env.example                   # Template for team/deployment
├── .gitignore
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── next.config.ts
```

---

# 💾 DATABASE ARCHITECTURE (PostgreSQL — 61 Tables)

> [!IMPORTANT]
> Database `skywear_db` is already configured on `localhost:5433` with all 61 tables created and tested. Below is the complete module breakdown.

## Module 1: Authentication & Users (5 tables)
| Table | Purpose |
|-------|---------|
| `users` | id (UUID), email, phone, password_hash, first_name, last_name, status, is_verified, **referral_code** (unique), **referred_by_id** (FK → users), **is_phone_verified**, deleted_at |
| `roles` | id, name ('admin', 'store_manager', 'support_agent', 'customer'), description |
| `user_roles` | user_id + role_id (composite PK) |
| `sessions` | id, user_id, token_hash (unique), ip_address, user_agent, is_revoked, expires_at |
| `password_resets` | id, email, token_hash, expires_at, is_used |

## Module 2: Customers (2 tables)
| Table | Purpose |
|-------|---------|
| `customer_profiles` | user_id (unique), date_of_birth, gender, preferred_currency ('INR'), total_orders_count, total_spent |
| `customer_addresses` | customer_id, address_type ('shipping'/'billing'), full_name, phone, address_line1/2, landmark, city, state, postal_code, country_code ('IN'), is_default_shipping/billing, soft delete |

## Module 3: Products & Catalog (8 tables)
| Table | Purpose |
|-------|---------|
| `products` | id, name, slug (unique), description, **base_price**, compare_at_price, cost_price, status (draft/active/archived), **reward_coins** (admin sets manually, e.g., 3000), has_variants, is_featured, meta_title, meta_description, soft delete |
| `product_variants` | id, product_id, **sku** (unique), barcode, title, **price**, cost_price, weight, **reward_coins**, is_active, soft delete |
| `product_images` | product_id, variant_id (optional), url, alt_text, is_primary, display_order |
| `product_options` | product_id, name ('Size', 'Color'), position |
| `product_option_values` | product_option_id, value ('S', 'M', 'L', 'XL'), position |
| `product_categories` | product_id + category_id (composite PK), is_primary |
| `product_tags` | product_id + tag_id (composite PK) |
| `product_attribute_values` | product_id + attribute_value_id + variant_id (composite PK) |

## Module 4: Categories, Tags & Attributes (4 tables)
| Table | Purpose |
|-------|---------|
| `categories` | id, parent_id (self-referencing for hierarchy), name, slug, image_url, display_order, is_active |
| `tags` | id, name, slug |
| `attributes` | id, name ('Size', 'Color', 'Material'), code (unique) |
| `attribute_values` | attribute_id, value ('XL', 'Red', 'Cotton'), color_code ('#FF0000'), display_order |

## Module 5: Inventory (3 tables)
| Table | Purpose |
|-------|---------|
| `inventory_levels` | variant_id (unique), quantity_on_hand, quantity_reserved, low_stock_threshold (default 5), allow_backorder |
| `inventory_movements` | variant_id, quantity_change (+/-), movement_type (purchase_received, order_fulfilled, manual_adjustment, etc.), reason, reference_id, created_by |
| `inventory_reservations` | variant_id, reserved_quantity, reference_id (order/checkout), expires_at, is_released |

## Module 6: Shopping (4 tables)
| Table | Purpose |
|-------|---------|
| `carts` | id, user_id OR guest_session_id (at least one required), expires_at |
| `cart_items` | cart_id, variant_id, quantity. UNIQUE(cart_id, variant_id) |
| `wishlists` | user_id, title, is_public |
| `wishlist_items` | wishlist_id, product_id, variant_id |

## Module 7: Checkout & Orders (5 tables)
| Table | Purpose |
|-------|---------|
| `checkout_sessions` | user_id, cart_id, subtotal, discount_total, shipping_total, tax_total, total_amount, applied_coupon_code, expires_at, is_completed |
| `orders` | id, **order_number** (unique, e.g., 'SKY-20261105-0001'), user_id, customer_email, customer_phone, **status** (pending_payment/processing/confirmed/shipped/out_for_delivery/delivered/cancelled/refunded/failed), subtotal, discount_amount, shipping_fee, tax_amount, **grand_total**, **total_reward_coins**, coupon_code, customer_notes, cancelled_at, cancellation_reason, soft delete |
| `order_items` | order_id, product_id, variant_id, **product_name** (snapshot), **variant_title** (snapshot), **sku** (snapshot), **unit_price** (snapshot), quantity, tax_amount, discount_amount, line_total, **reward_coins_earned** |
| `order_addresses` | order_id, address_type ('shipping'/'billing'), full_name, phone, address_line1/2, city, state, postal_code — IMMUTABLE SNAPSHOTS |
| `order_status_history` | order_id, previous_status, new_status, comment, changed_by |
| `order_notes` | order_id, author_id, note, is_customer_visible |

## Module 8: Payments (4 tables)
| Table | Purpose |
|-------|---------|
| `payments` | order_id, payment_method ('razorpay'/'cod'/'upi_manual'), gateway, gateway_order_id, amount, status (pending/authorized/captured/failed/refunded), paid_at |
| `payment_transactions` | payment_id, **transaction_reference** (unique), **idempotency_key** (unique), amount, type ('charge'/'refund'/'capture'), raw_response (JSONB) |
| `payment_webhook_events` | gateway, **event_id** (unique), event_type, payload (JSONB), is_processed, processed_at, error |
| `refunds` | payment_id, order_id, amount, reason, gateway_refund_id, status, processed_by |

## Module 9: Shipping (5 tables)
| Table | Purpose |
|-------|---------|
| `shipping_zones` | name ('Domestic India'), countries (text array), states (text array), is_active |
| `shipping_methods` | zone_id, name ('Standard Ground'), carrier ('Delhivery'/'BlueDart'), estimated_days_min/max |
| `shipping_rates` | shipping_method_id, min/max_order_subtotal, min/max_weight, rate |
| `shipments` | order_id, carrier, tracking_number, tracking_url, status, shipped_at, delivered_at |
| `shipment_tracking_events` | shipment_id, status, location, description, event_timestamp |

## Module 10: Discounts & Coupons (3 tables)
| Table | Purpose |
|-------|---------|
| `coupons` | code (unique), discount_type (percentage/fixed_amount/free_shipping), discount_value, min_order_amount, max_discount_amount, usage_limit, usage_limit_per_user, used_count, starts_at, expires_at |
| `discounts` | name, discount_type, discount_value, applies_to (all_products/specific_categories/specific_products), min_quantity |
| `coupon_redemptions` | coupon_id, order_id, user_id, discount_amount, redeemed_at |

## Module 11: Returns & Reviews (3 tables)
| Table | Purpose |
|-------|---------|
| `return_requests` | order_id, user_id, status (requested/approved/rejected/item_received/refunded), reason, admin_notes |
| `return_items` | return_request_id, order_item_id, quantity, condition_description |
| `product_reviews` | product_id, user_id, order_id, rating (1-5), title, comment, is_verified_purchase, is_approved |

## Module 12: System (5 tables)
| Table | Purpose |
|-------|---------|
| `settings` | key (unique), value (JSONB), description. Stores: store_general, store_tax, shipping_defaults |
| `media` | file_name, file_path, mime_type, size_bytes, alt_text, uploaded_by |
| `notifications` | user_id, title, message, type (order/payment/inventory/system), is_read, link_url |
| `audit_logs` | user_id, action ('PRODUCT_UPDATED'), entity_name, entity_id, old_data (JSONB), new_data (JSONB), ip_address |
| `webhook_deliveries` | event_name, target_url, payload (JSONB), status_code, response_body, retry_count |

---

# 🪙 COIN REWARD & DAILY 3% UNLOCK ENGINE (7 new tables)

> [!WARNING]
> This is the most critical financial module. Every single coin must be mathematically accounted for. No rounding errors, no duplicate credits, no missing debits.

## New Tables for Coin System:

| Table | Purpose |
|-------|---------|
| `user_wallets` | user_id (unique), **pending_coins** NUMERIC(14,4), **cash_coins** NUMERIC(14,4), lifetime_earned/unlocked/withdrawn stats |
| `coin_transactions` | user_id, **wallet_type** ('pending'/'cash'), **transaction_type** ('purchase_cashback'/'daily_3_percent_unlock'/'referral_commission'/'withdrawal'/'admin_adjustment'/'order_refund_deduction'), amount (+/-), balance_after, reference_id, description — **FULL AUDIT LEDGER** |
| `coin_reward_batches` | user_id, order_id, initial_coins, remaining_pending_coins, daily_unlock_rate (3.00%), status (active/completed/paused/cancelled) |
| `daily_coin_distributions` | user_id, **distribution_date**, pending_before, unlock_rate, coins_unlocked, pending_after, cash_after. **CONSTRAINT: UNIQUE(user_id, distribution_date)** — prevents duplicate daily runs |
| `referral_settings` | is_referral_enabled, is_lifetime (true), commission_type ('percentage'), commission_value (e.g., 5.00), min_order_amount_required. **Admin-configurable.** |
| `referral_commissions` | referrer_id (old user), referee_id (new user), order_id, order_amount, commission_rate, commission_amount, reward_mode ('cash_wallet'), status ('pending'/'credited'/'refunded_reversed') |
| `otp_verifications` | phone, email, full_name, otp_code, purpose ('registration'/'login'/'withdrawal'), attempts (max 5), is_verified, expires_at, ip_address |
| `user_payout_methods` | user_id, payout_type ('bank_account'/'upi'), account_holder_name, bank_name, account_number, ifsc_code, account_type, **upi_id**, is_primary, is_verified |
| `withdrawal_requests` | user_id, payout_method_id, coins_redeemed, inr_amount (admin sets this), coin_to_inr_rate, status ('pending'/'approved'/'processing'/'completed'/'rejected'), payout_gateway_reference, admin_notes |

## How Daily 3% Works (Step-by-Step Mathematical Flow):

```
STEP 1: User buys Product A (Price: ₹1500, Reward: 3000 Coins)
        → 3000 coins credited to user_wallets.pending_coins
        → coin_transactions: +3000 (wallet_type: 'pending', type: 'purchase_cashback')
        → Wallet State: Pending = 3000, Cash = 0

STEP 2: Day 1 — Daily 3% Unlock runs at midnight (00:00 AM IST)
        → 3% of 3000 = 90 coins unlocked
        → pending_coins: 3000 - 90 = 2910
        → cash_coins: 0 + 90 = 90
        → coin_transactions: -90 from pending, +90 to cash
        → daily_coin_distributions: logged with date

STEP 3: User buys another product earning +2000 extra coins
        → pending_coins: 2910 + 2000 = 4910
        → cash_coins: still 90

STEP 4: Day 2 — Daily 3% runs on COMBINED total
        → 3% of 4910 = 147.30 coins unlocked
        → pending_coins: 4910 - 147.30 = 4762.70
        → cash_coins: 90 + 147.30 = 237.30

STEP 5: User requests withdrawal of 200 Cash Coins
        → withdrawal_requests created (status: 'pending')
        → Admin reviews in /admin/withdrawals
        → Admin decides ₹ amount, enters Bank UTR, approves
        → cash_coins: 237.30 - 200 = 37.30
        → coin_transactions: -200 from cash (type: 'withdrawal')
```

## Stored Procedure (PostgreSQL):

```sql
-- fn_process_daily_3_percent_unlock(target_date)
-- Loops through all users with pending_coins > 0
-- Calculates 3% of pending_coins
-- Transfers to cash_coins
-- Logs in daily_coin_distributions (UNIQUE constraint prevents duplicates)
-- Logs in coin_transactions (debit from pending, credit to cash)
-- IDEMPOTENT: Safe to run multiple times per day
```

---

# 🤝 REFERRAL & LIFETIME COMMISSION SYSTEM

```
HOW IT WORKS:
1. Every user gets a unique referral_code (e.g., 'RAHUL200') stored in users table.
2. When User A shares their link: skywear.com/ref/RAHUL200
3. New User B registers via that link → users.referred_by_id = User A's id
4. User B buys ANY product → System calculates commission:
   → Commission = order_amount × referral_settings.commission_value%
   → e.g., ₹1500 × 5% = ₹75 worth of coins
5. Commission coins credited to User A's cash_coins (or pending, based on admin config)
6. THIS IS LIFETIME: Every future purchase by User B triggers commission to User A
7. Admin controls everything via /admin/referrals:
   → Toggle on/off
   → Set commission_type (percentage/fixed/coins)
   → Set commission_value (e.g., 5%)
   → Set minimum order amount required
```

---

# 📱 OTP AUTHENTICATION VIA APITxT (apitxt.com)

## Login/Registration Flow:
```
1. User enters: Phone Number (10-digit Indian) + Full Name
2. Frontend POST → /api/auth/send-otp { phone, fullName }
3. Backend:
   a. Validate phone (regex: /^[6-9]\d{9}$/)
   b. Rate limit check (max 3 OTPs per 5 minutes per phone)
   c. Generate secure 6-digit OTP (crypto.randomInt)
   d. Save to otp_verifications table (expires in 5 mins)
   e. Send via APITxT API:
      POST https://apitxt.com/api/sendOTP
      Body: authkey=YOUR_KEY & mobile=PHONE & otp=CODE
4. User enters OTP on frontend
5. Frontend POST → /api/auth/verify-otp { phone, otp }
6. Backend:
   a. Lookup latest unverified OTP for this phone
   b. Check expiry (5 min window)
   c. Check brute force (max 5 wrong attempts)
   d. If match:
      - Mark OTP as verified
      - Find or create user in users table
      - Auto-assign 'customer' role
      - Generate referral_code if new user
      - If user came via referral link, set referred_by_id
      - Create session → set HttpOnly cookie
      - Return { success: true, user: { ... } }
```

## Admin Login Flow (SEPARATE):
```
1. Admin goes to /admin/login (NOT /login)
2. Enters username + password (NOT phone/OTP)
3. POST → /api/admin/login { username, password }
4. Backend checks against ADMIN_USER / ADMIN_PASSWORD env vars
5. Creates admin session with admin role flag
6. Redirects to /admin/dashboard
```

## .env Keys Required:
```env
# Database
DB_HOST=localhost
DB_PORT=5433
DB_USER=postgres
DB_PASSWORD=admin
DB_NAME=skywear_db

# APITxT OTP
APITXT_AUTH_KEY=your_apitxt_auth_key_here
APITXT_BASE_URL=https://apitxt.com/api/sendOTP
APITXT_SANDBOX_MODE=true   # Set false for production

# Admin Panel
ADMIN_USER=admin
ADMIN_PASSWORD=your_secure_password

# Session
SESSION_SECRET=generate_a_64_char_random_string

# Razorpay
RAZORPAY_MODE=test
RAZORPAY_TEST_KEY_ID=rzp_test_xxxxx
RAZORPAY_TEST_KEY_SECRET=xxxxx
RAZORPAY_LIVE_KEY_ID=rzp_live_xxxxx
RAZORPAY_LIVE_KEY_SECRET=xxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxx

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=SKYWEAR
```

---

# 🛡️ AUTHENTICATION & MIDDLEWARE RULES

```typescript
// Middleware logic (src/middleware.ts):

PUBLIC ROUTES (No auth needed):
  /, /products, /products/*, /cart, /login, /api/auth/*, /api/products

CUSTOMER ROUTES (Auth required, role = customer or admin):
  /dashboard, /dashboard/*, /api/wallet/*, /api/orders, /api/referrals

ADMIN ROUTES (Auth required, role = admin ONLY):
  /admin/* (except /admin/login), /api/admin/*

BEHAVIOR:
  - Unauthenticated user hitting /dashboard/* → redirect to /login
  - Unauthenticated user hitting /admin/* → redirect to /admin/login
  - Customer role hitting /admin/* → 403 Forbidden
  - Admin role can access ALL routes (public + customer + admin)
```

---

# ⚠️ COMMON BUGS TO FIX (FROM OLD CODEBASE AUDIT)

> [!WARNING]
> These are the exact issues found in the old codebase. EVERY SINGLE ONE must be fixed.

### Bug 1: Frontend Shows Hardcoded ₹ Conversion
**Problem:** `Coins (= ₹{coins * 0.01})` shown to customers.
**Fix:** Customer sees ONLY `3,000 Coins`. No ₹ symbol. No conversion. Admin decides payout amount.

### Bug 2: Referral Balance Stored as Separate ₹ Currency
**Problem:** `referralBalanceRupees` was a separate INR field alongside coin balance.
**Fix:** Everything is COINS. Referral commission also credits as COINS to cash_coins.

### Bug 3: Client-Side Calculates totalRupees for Withdrawal
**Problem:** Frontend sent `{ coins: 1000, totalRupees: 10.00 }` — customer controlled the amount.
**Fix:** Customer sends ONLY `{ coins: 1000, upiId: "user@ok" }`. Admin determines ₹ payout.

### Bug 4: Old 4-Week Vesting Code Mixed with 30-Day Code
**Problem:** `create4WeekVestingSchedule()` dead code running alongside `CASHBACK_CYCLE_DAYS = 30`.
**Fix:** Delete ALL old vesting logic. Only daily 3% unlock system exists.

### Bug 5: pointValue Mismatch Across Codebase
**Problem:** `1 Coin = 0.01 INR` in one file, `1 Coin = 0.50 INR` in another.
**Fix:** No conversion rate on frontend. Admin manages conversion internally.

### Bug 6: No Idempotency on Daily Unlock
**Problem:** Running daily cron twice doubled the coin unlock.
**Fix:** `UNIQUE(user_id, distribution_date)` constraint. Stored procedure checks before processing.

### Bug 7: Order Items Don't Snapshot Product Data
**Problem:** Changing product price retroactively changed old order totals.
**Fix:** `order_items` stores: product_name, variant_title, sku, unit_price as IMMUTABLE copies.

### Bug 8: Session Stored in localStorage
**Problem:** Auth token in localStorage = XSS vulnerable.
**Fix:** HttpOnly, Secure, SameSite=Lax cookie. No token in localStorage or sessionStorage.

### Bug 9: Admin Panel Accessible via Storefront Navigation
**Problem:** Footer had "Admin" link visible to everyone.
**Fix:** Zero admin links on storefront. `/admin/login` is a hidden URL only admins know.

### Bug 10: No Rate Limiting on OTP
**Problem:** Anyone could spam OTP requests and drain SMS credits.
**Fix:** Max 3 OTP requests per phone per 5 minutes. Max 5 wrong verification attempts per OTP.

---

# 🔄 IMPLEMENTATION PRIORITY ORDER

```
PHASE 1 — FOUNDATION (Do This First)
  ├── 1.1 Next.js project setup with TypeScript + Tailwind + Shadcn UI
  ├── 1.2 PostgreSQL connection via Prisma ORM (skywear_db already has 61 tables)
  ├── 1.3 Environment variables (.env) configuration
  └── 1.4 Root layout + global styles + font setup

PHASE 2 — AUTHENTICATION (Gateway to Everything)
  ├── 2.1 /login page: Phone + Name form → OTP via APITxT
  ├── 2.2 /api/auth/send-otp & /api/auth/verify-otp endpoints
  ├── 2.3 Session cookie creation + middleware protection
  ├── 2.4 /admin/login page: Username + Password
  └── 2.5 Dynamic Navbar (Guest vs Logged-in vs Admin)

PHASE 3 — PUBLIC STOREFRONT
  ├── 3.1 Landing page (/) with hero, featured products, coin badges
  ├── 3.2 /products grid page
  ├── 3.3 /products/[slug] detail page with variant picker
  └── 3.4 /cart page with checkout flow

PHASE 4 — CUSTOMER DASHBOARD
  ├── 4.1 /dashboard overview
  ├── 4.2 /dashboard/wallet (Pending Coins + Cash Coins + daily 3% visualization)
  ├── 4.3 /dashboard/orders (Order history + tracking)
  ├── 4.4 /dashboard/referrals (Referral link + commission stats)
  ├── 4.5 /dashboard/payouts (Bank/UPI management + withdrawal requests)
  └── 4.6 /dashboard/profile (Phone verified badge, addresses)

PHASE 5 — ADMIN PANEL
  ├── 5.1 /admin/dashboard (Revenue + metrics)
  ├── 5.2 /admin/products (CRUD + set reward_coins manually)
  ├── 5.3 /admin/orders (Process orders, add tracking numbers)
  ├── 5.4 /admin/withdrawals (Review, decide ₹, enter UTR, approve/reject)
  ├── 5.5 /admin/referrals (Set commission rate, toggle on/off)
  ├── 5.6 /admin/daily-yield (Status, logs, manual trigger)
  └── 5.7 /admin/settings (Store config)

PHASE 6 — BACKGROUND JOBS & INTEGRATIONS
  ├── 6.1 Razorpay payment gateway integration
  ├── 6.2 Razorpay webhook handler (/api/webhooks/razorpay)
  ├── 6.3 Daily 3% unlock cron job (BullMQ + Redis, runs at midnight IST)
  ├── 6.4 RazorpayX / Cashfree Payouts API for bank transfers
  └── 6.5 Email/Push notifications for order status updates
```

---

# ✅ FINAL CHECKLIST BEFORE GOING LIVE

- [ ] All 61+ PostgreSQL tables created and indexed
- [ ] Prisma schema mirrors PostgreSQL exactly
- [ ] OTP via APITxT working (sandbox → live key)
- [ ] Session cookies are HttpOnly, Secure, SameSite
- [ ] /login → Customer OTP flow tested
- [ ] /admin/login → Admin username/password flow tested
- [ ] Middleware blocks unauthenticated access to /dashboard/* and /admin/*
- [ ] Products show price + coin reward badge
- [ ] Purchase credits coins to user_wallets.pending_coins
- [ ] Daily 3% stored procedure tested with idempotency
- [ ] Referral link generation + lifetime commission working
- [ ] Bank/UPI payout method add + withdrawal request flow
- [ ] Admin can set product reward_coins manually
- [ ] Admin can approve/reject withdrawals with UTR
- [ ] Admin can set referral commission rate
- [ ] No ₹ conversion shown to customers anywhere
- [ ] Order items store immutable snapshots
- [ ] All API endpoints have proper error handling + validation
- [ ] Rate limiting on OTP (3 per 5 min) and login attempts
- [ ] Audit logs recording admin actions
- [ ] Razorpay webhook HMAC verified
- [ ] HTTPS enabled in production
- [ ] .env secrets never committed to git

---

> **🎯 IS DOCUMENT KO KISI BHI AI (Claude, ChatGPT, Cursor, Devin) YA DEVELOPER KO DE DO. WO BINA KISI CONFUSION KE POORA SYSTEM SAHI TARIKE SE BUILD/FIX KAR SAKTA HAI.**

