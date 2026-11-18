# 🗺️ SKYWEAR (ZENIN / THREADCRAFT) — MASTER CODEBASE & AI ARCHITECTURE MAP
> **Target Audience:** Developers & AI Agents (Fast Code Editing, Zero Hallucinations)  
> **Status:** Production Synchronized • **Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, PostgreSQL/Prisma, In-Memory Store, Redis, Web Push, Qikink POD

---

## ⚡ 1. AI Quick-Edit Cheat Sheet (Search & Edit in 5 Seconds)

| Task / Feature | Primary File to Edit | Key Helpers / Functions | Critical Gotcha |
|---|---|---|---|
| **Cart & Pricing Math** | `src/lib/server/services.ts` | `quote()` | Delivery fee (free > ₹999), 100 Sky Coins = ₹1, coupon rules. |
| **Header / Nav / Wallet Pill** | `src/components/Header.tsx` | `<Header />` | Wallet balance is driven by `storefront.customer.availablePoints`. |
| **Mobile Bottom Bar** | `src/components/MobileBottomNav.tsx` | `<MobileBottomNav />` | Rendered globally in `src/app/layout.tsx`. |
| **Product Drops & Catalog** | `src/data/products.ts` | `PRODUCTS` array | GSM, sizes (`S` to `2XL`), color hexes, coin reward values. |
| **4-Week Vesting Math** | `src/lib/vesting.ts` | `buildVestingSchedule()`, `releaseDueCashback()` | 25% unlocks every 7 days (Day 7, 14, 21, 28). Never unlock early. |
| **Coins & Rewards Config** | `src/data/rewardsEngine.ts` | `DEFAULT_REWARDS_CONFIG` | 100 Sky Cash = ₹1, 90% Recoin on Sky Cash payment, 500 min withdrawal. |
| **Razorpay Payments** | `src/app/checkout/page.tsx` & `src/lib/server/razorpay.ts` | `openRazorpayCheckout()`, `verifyRazorpayPayment()` | Order amounts passed to Razorpay are in **paise** (`₹ * 100`). |
| **Manual UPI & QR** | `src/lib/server/manualUpi.ts` | `submitManualUpiPayment()` | Generates dynamic UPI intent string (`upi://pay?...`) + QR code. |
| **OwnPay Gateway** | `src/lib/server/ownpay.ts` | `createOwnPaySession()`, `verifyOwnPaySession()` | Simulated + live webhook reconciliation. |
| **Order Placement Flow** | `src/lib/server/services.ts` | `placeOrder()` | Atomically deducts coins, adds affiliate bonus, creates notifications. |
| **Shipment / Courier / POD** | `src/lib/server/qikink.ts` | `syncQikinkOrder()`, `syncQikinkWebhook()` | Qikink POD API integration for automated printing & tracking. |
| **Withdrawals (UPI/Bank)** | `src/lib/server/services.ts` | `submitWithdrawal()`, `payoutWithdrawal()` | Immediately locks points. Tranches paid out one by one by admin. |
| **Referrals & Affiliates** | `src/lib/referral-tracker.ts` & `src/app/invite/[code]/page.tsx` | `captureReferralCode()`, `/api/referrals/*` | Saves cookie `skywear_ref`, auto-attaches to registration/orders. |
| **Web Push & PWA** | `src/lib/push-client.ts` & `src/components/PwaManager.tsx` | `subscribeUserToPush()`, `sendWebPushBroadcast()` | Uses VAPID keys, service worker at `public/sw.js`. |
| **Admin Control Portal** | `src/app/admin/[[...slug]]/page.tsx` | Tab controllers | 13 tabs: overview, orders, anime, products, customers, withdrawals, etc. |
| **Database & Persistence** | `src/lib/server/store.ts` & `src/lib/server/db.ts` | `mutate(state => ...)` | In-memory cache + disk `.data/zenin-state.json` + Postgres Prisma. |

---

## 📁 2. Repository Anatomy & Directory Map

```
skywear/
├── .data/                                    # Local persistence snapshot (zenin-state.json)
├── prisma/
│   └── schema.prisma                        # PostgreSQL DB schema (User, Order, Withdrawal, etc.)
├── public/                                  # Logos, static banners, sw.js, manifest.json
├── src/
│   ├── app/                                 # Next.js App Router (Storefront, Admin, APIs)
│   │   ├── (Storefront Pages)               # /, /shop, /cart, /checkout, /wallet, /account, /track, /support
│   │   ├── brand-kit/                       # Brand design tokens, logos, colors (/brand-kit)
│   │   ├── invite/[code]/                   # Dynamic referral invite page (/invite/FRIEND123)
│   │   ├── admin/[[...slug]]/page.tsx       # Secure isolated Admin Portal (/admin)
│   │   ├── portal/[[...slug]]/page.tsx      # Admin alias route (/portal)
│   │   ├── api/                             # REST API route handlers (see Section 5)
│   │   ├── layout.tsx                       # Root wrapper: Theme, Header, MobileBottomNav, Toaster
│   │   └── globals.css                      # Tailwind & Streetwear aesthetic CSS variables
│   ├── components/                          # React UI Components
│   │   ├── admin/                           # Admin sub-tabs (Gateways, Push, ShopifyProductEditor, UI kit)
│   │   ├── storefront/                      # MemberStorefrontView & customer-specific surfaces
│   │   ├── ui/                              # Atomic UI (buttons, cards, badges, tabs, marquee, glass-navbar)
│   │   ├── Header.tsx                       # Sticky top navigation, wallet pill, search, category drawer
│   │   ├── MobileBottomNav.tsx              # Mobile bottom navigation bar
│   │   ├── ProductCard.tsx                  # Streetwear drop card with image flip & quick add
│   │   ├── ProductMedia.tsx                 # Multi-view zoom gallery (front, back, lifestyle)
│   │   ├── CartDrawer.tsx                   # Slide-out cart with coin redemption slider
│   │   ├── CheckoutModal.tsx                # Fast modal checkout with multi-gateway selection
│   │   ├── CustomerDashboardModal.tsx       # 4-tab user dashboard (Orders, Wallet, Affiliate, Profile)
│   │   ├── WalletPanel.tsx                  # Reusable wallet coin balance & 4-week vesting timeline
│   │   ├── PwaManager.tsx                   # Service worker registration & PWA install prompt
│   │   ├── SupportCentre.tsx                # WhatsApp, Phone, Email & dynamic live FAQ
│   │   └── SizeChartModal.tsx               # Sizing guide for 240 GSM vs 280 GSM oversized tees
│   ├── data/
│   │   ├── products.ts                      # Curated catalog drops (240 GSM tees, sizes, colors, MRP)
│   │   ├── rewardsEngine.ts                 # 100 Sky Cash = ₹1 math, referral rules, tier thresholds
│   │   └── seed-state.json                  # Initial mock state for local boot
│   └── lib/                                 # Frontend SDK & Backend Server Services
│       ├── client.ts                        # Unified frontend API client (`api.*`)
│       ├── contracts.ts                     # Core TypeScript schemas & request/response types
│       ├── domain.ts                        # OrderStatus, CourierPartner, PaymentMethod enums & helpers
│       ├── cart.ts                          # `useCart()` & `useWishlist()` reactive localStorage hooks
│       ├── catalog.ts                       # Product filtering, category slugs, coin calculations
│       ├── vesting.ts                       # 4-Week Vesting schedule math (25% weekly unlock)
│       ├── referral-tracker.ts              # URL referral cookie tracker (`?ref=CODE`)
│       ├── push-client.ts                   # Web push permission & subscription client
│       └── server/                          # SERVER-ONLY Business Logic (Never import in client components)
│           ├── services.ts                  # Master business logic (orders, payouts, coupons, users)
│           ├── store.ts                     # In-memory + disk atomic state store (`mutate`)
│           ├── auth.ts                      # JWT / Session cookie verification
│           ├── db.ts                        # Prisma PostgreSQL connection pooling
│           ├── redis.ts                     # Redis cache & locks
│           ├── razorpay.ts                  # Razorpay SDK & HMAC SHA256 signature verification
│           ├── manualUpi.ts                 # Dynamic UPI QR & UTR payment verification
│           ├── ownpay.ts                    # OwnPay gateway API & webhook simulator
│           ├── qikink.ts                    # Qikink POD fulfillment & courier integration
│           ├── webpush.ts                   # VAPID Web Push notification dispatcher
│           ├── notifications.ts             # In-app notification creation & inbox
│           └── reconciliation.ts            # Paytm & UPI bank transaction auto-reconciliation
```

---

## 🧩 3. Key UI Components & Visual Elements

| Component File | Role & Visual Elements | Key Props / Hooks Used |
|---|---|---|
| `src/components/Header.tsx` | Top desktop/mobile navigation, search bar, live Sky Cash pill, wishlist & cart badges. | `useCart()`, `useWishlist()`, `storefrontSnapshot.customer` |
| `src/components/MobileBottomNav.tsx` | Fixed bottom bar on `< md` screens: Home, Shop, Cart (badge), Wishlist, Account. | `usePathname()`, `useCart()` |
| `src/components/ProductCard.tsx` | High-impact drop card: front/back hover swap, coin preview badge, quick size selector. | `Product`, `useCart()`, `useWishlist()` |
| `src/components/ProductMedia.tsx` | Multi-angle drop gallery: front print, back art, zoom, fabric GSM texture preview. | `images: string[]`, `title: string` |
| `src/components/CartDrawer.tsx` | Right slide-out: item list, qty changer, coupon input, Sky Cash redemption slider (up to 30%). | `useCart()`, `api.quoteOrder()` |
| `src/components/CheckoutModal.tsx` | Modal checkout: shipping address, pincode service check, gateway selector (Razorpay, UPI QR, COD). | `api.placeOrder()`, `openRazorpayCheckout()` |
| `src/components/WalletPanel.tsx` | Reusable wallet: Available Sky Cash, Locked Vesting Cash, Next unlock date, UPI withdrawal button. | `storefrontSnapshot.customer`, `storefrontSnapshot.withdrawals` |
| `src/components/CustomerDashboardModal.tsx` | Unified user hub: `Orders` (live courier tracker), `Wallet` (vesting bar), `Affiliate` (referral link), `Profile`. | `api.auth.*`, `api.withdraw()` |
| `src/components/SupportCentre.tsx` | Customer support: Direct WhatsApp click-to-chat, phone call card, live FAQ accordion. | `api.supportSnapshot()` |
| `src/components/PwaManager.tsx` | PWA offline handling, Web Push opt-in prompt, install-to-homescreen banner. | `subscribeUserToPush()`, Service Worker |
| `src/components/admin/ShopifyProductEditor.tsx`| Admin drop manager: Title, GSM tags, price, MRP, images, anime category tags. | Admin Product CRUD |
| `src/components/admin/GatewaysTab.tsx` | Admin gateway config: Razorpay Live/Test keys, Manual UPI VPA, OwnPay toggle, COD fees. | Admin Gateway config |
| `src/components/admin/PushTab.tsx` | Admin broadcast composer: send Web Push campaigns to all subscribed users. | `api.admin.broadcastPush()` |

---

## 🛤️ 4. Storefront & Admin Page Routing

| Route Path | Source File | Description |
|---|---|---|
| `/` | `src/app/page.tsx` | Home storefront: Hero banner, drop carousels, category grid, reviews. |
| `/shop` | `src/app/shop/page.tsx` | Catalog view: filters by All, Heavyweight (240 GSM), Vintage, Anime. |
| `/product/[slug]` | `src/app/product/[slug]/page.tsx` | Single product detail: multi-image viewer, size chart, customer reviews. |
| `/cart` | `src/app/cart/page.tsx` | Dedicated cart summary page. |
| `/checkout` | `src/app/checkout/page.tsx` | Full checkout page with live dynamic fee calculation, Razorpay & UPI QR. |
| `/checkout/success` | `src/app/checkout/success/page.tsx` | Order confirmation receipt & tracking CTA. |
| `/wallet` | `src/app/wallet/page.tsx` | Full-screen wallet dashboard with 4-week vesting progress & payout form. |
| `/account` & `/account/[tab]` | `src/app/account/AccountView.tsx` | User profile: `orders`, `wallet`, `rewards`, `affiliate`, `profile`, `notifications`. |
| `/invite/[code]` | `src/app/invite/[code]/page.tsx` | Referral landing page: sets referral cookie and redirects to `/shop`. |
| `/track` | `src/app/track/page.tsx` | Real-time shipment tracking via Order # + Mobile/Email. |
| `/brand-kit` | `src/app/brand-kit/page.tsx` | Brand identity guide: typography, color palette, logo assets. |
| `/about`, `/support`, `/faq` | `src/app/about/page.tsx` etc. | Brand story, help center, WhatsApp chat link, policy documents. |
| `/admin` & `/portal` | `src/app/admin/[[...slug]]/page.tsx` | Isolated Admin Portal (13 desks: orders, anime, products, withdrawals, etc.). |

---

## 🔌 5. Complete API Endpoints Directory

### 🟢 Public & Storefront APIs
- `GET  /api/storefront` ➔ Returns catalog products, customer session, wallet, coupons, support details.
- `GET  /api/session` ➔ Reads logged-in customer session cookie.
- `DELETE /api/session` ➔ Logs out customer and clears cookies.
- `POST /api/orders/quote` ➔ Calculates subtotal, coupon discount, coin redemption, shipping & gateway fees.
- `POST /api/orders` ➔ Atomically places an order (COD, Pre-paid, or Manual UPI).
- `GET  /api/orders/[id]` ➔ Reads single order details.
- `POST /api/track` ➔ Fetches real-time order & courier tracking details.
- `GET  /api/support` ➔ Fetches public support phone, email, WhatsApp, and FAQs.
- `GET  /api/reviews` & `POST /api/reviews` ➔ Fetches & submits product star reviews.
- `POST /api/reviews/upload` ➔ Uploads customer photo reviews (compressed base64/URL).

### 🔐 Customer Authentication
- `POST /api/auth/send-otp` ➔ Sends 6-digit phone OTP via SMS gateway.
- `POST /api/auth/login` ➔ Authenticates via OTP or password.
- `POST /api/auth/signup` ➔ Registers user (auto-applies referral code from cookie).
- `POST /api/auth/reset-password` ➔ OTP-verified password reset.
- `POST /api/auth/check` ➔ Fast verification if phone number is registered.

### 💳 Payments & Gateways
- `POST /api/payments/razorpay/order` ➔ Generates Razorpay Order ID in paise.
- `POST /api/payments/razorpay/verify` ➔ Verifies Razorpay HMAC signature & marks order paid.
- `POST /api/payments/manual-upi/order` ➔ Creates order in `PENDING` state & outputs dynamic UPI QR.
- `POST /api/payments/manual-upi/submit-utr` ➔ Submits 12-digit UTR reference for manual review.
- `POST /api/payments/manual-upi/upload-proof` ➔ Uploads payment screenshot for UTR verification.
- `POST /api/payments/ownpay/order` & `/verify` ➔ OwnPay gateway checkout & verification.
- `POST /api/payments/ownpay/webhook` ➔ Webhook handler for external gateway confirmation.

### 💰 Wallet, 4-Week Vesting & Referrals
- `POST /api/withdrawals` ➔ Submits UPI/Bank payout (minimum 500 Sky Cash, locks immediately).
- `POST /api/wallet/claim` ➔ Daily Sky Cash claim (3% daily rate).
- `GET  /api/wallet/bank-accounts` & `POST` & `DELETE` ➔ Manages saved UPI VPAs and Bank Accounts.
- `POST /api/wallet/upi` ➔ Updates customer default UPI ID for withdrawals.
- `GET  /api/referrals/lookup` ➔ Validates referral code from URL.
- `POST /api/referrals/claim-reward` ➔ Claims referral milestones & rewards.
- `POST /api/referrals/fingerprint` ➔ Anti-abuse device & browser fingerprint check.
- `GET  /api/cron/unlock-cashback` ➔ Cron trigger: Auto-unlocks mature 7/14/21/28-day vesting tranches.

### 🔔 Push Notifications
- `GET  /api/push/vapid-key` ➔ Returns public VAPID key for browser subscription.
- `POST /api/push/subscribe` ➔ Registers browser Web Push endpoint.
- `POST /api/push/unsubscribe` ➔ Removes Web Push subscription.
- `GET  /api/notifications` ➔ Customer in-app notification inbox.
- `PATCH /api/notifications/[id]/read` ➔ Marks notification as read.

### 🛡️ Admin Operations (`/api/admin/...`)
- `POST  /api/admin/session` ➔ Admin login authentication (issues secure cookie).
- `GET   /api/admin/overview` ➔ Complete admin snapshot: metrics, orders, products, withdrawals.
- `POST  /api/admin/products` & `PATCH /api/admin/products/[id]` ➔ Product catalog CRUD.
- `POST  /api/admin/withdrawals/[id]/pay` ➔ Marks 25% tranche as `TRANSFERRED` with bank UTR.
- `POST  /api/admin/withdrawals/[id]/reject` ➔ Rejects payout & refunds remaining coins to wallet.
- `POST  /api/admin/withdrawals/[id]/reopen` ➔ Reopens rejected payout after balance check.
- `POST  /api/admin/members/[id]/session` ➔ Impersonation: opens customer session to test storefront.
- `PATCH /api/admin/customers/[id]` ➔ Updates customer points, tier, or status.
- `PUT   /api/admin/reward-rules` ➔ Modifies cashback percentages, point values, coin rules.
- `PUT   /api/admin/support` ➔ Updates WhatsApp, phone, email, and live FAQs.
- `PATCH /api/admin/gateways` ➔ Configures Razorpay, OwnPay, Manual UPI & COD settings.
- `POST  /api/admin/orders/[id]/qikink` ➔ Pushes order to Qikink POD fulfillment.
- `POST  /api/admin/push/broadcast` ➔ Sends Web Push broadcast to all active subscribers.

---

## ⚙️ 6. Core Business Logic & Math Rules

### 1. Sky Cash & Coin Valuation
- **100 Sky Cash = ₹1 INR** (`pointValueInRupees = 0.01`).
- Minimum withdrawal: **500 Sky Cash** (₹5.00).
- Payment with Coins: Up to **30% of order subtotal** can be paid using Sky Cash.
- **Recoin Benefit:** Paying with Sky Cash gives **90% Recoin** back into the vesting schedule.

### 2. 4-Week Vesting Engine (`src/lib/vesting.ts`)
- All cashback and referral earnings are split into **4 equal 25% tranches**:
  - **Tranche 1:** Unlocks on **Day 7**
  - **Tranche 2:** Unlocks on **Day 14**
  - **Tranche 3:** Unlocks on **Day 21**
  - **Tranche 4:** Unlocks on **Day 28**
- **Vesting Invariant:** No tranche can be withdrawn before `dueAt <= Date.now()`.
- If an order is returned or cancelled, unvested tranches are marked `VOID`.

### 3. State Management & Dual Persistence (`src/lib/server/store.ts`)
```
[React / Client]
       │ (Fetch API)
       ▼
[Next.js API Route Handler]
       │
       ▼
[src/lib/server/services.ts]
       │
       ▼
[mutate() in src/lib/server/store.ts]
       ├── ① Updates in-memory hot object (__zeninState)  < 1ms
       ├── ② Writes atomic debounced snapshot (.data/zenin-state.json)
       └── ③ Background async sync to PostgreSQL (Prisma DB)
```

---

## 🚫 7. Golden Rules for AI Code Editing

1. **Never Put Admin Links on Storefront:** Never add `/admin` or `/portal` navigation buttons, badges, or links inside customer-facing components (`Header.tsx`, `Footer.tsx`, etc.).
2. **Never Edit Wallet Points Directly:** Every point addition or deduction must create a corresponding `WalletTransaction` entry with an audit note.
3. **Always Check Server vs Client Boundaries:** Files in `src/lib/server/` use Node.js modules (`fs`, `crypto`, `prisma`). Never import them inside `"use client"` components.
4. **Use Contracts:** All new API endpoints must declare their request and response types in `src/lib/contracts.ts` and wrap client calls in `src/lib/client.ts`.
5. **Preserve Streetwear Aesthetic:** Retain dark luxury styling:
   - Primary: `#0A0A0A` (Deep Zenin Black)
   - Accents: `#D9362B` (Zenin Blood Red), `#00FF66` (Emerald Green)
   - Fonts: Heavy uppercase mono styling (`font-mono tracking-wider uppercase`).
