# QA Report — Logged-in Dashboard (SKYWEAR)

- **Run ID:** `run-20261105T193758Z`
- **Date:** 2026-11-05
- **Target:** Signed-in customer dashboard (browser, mobile-first)
- **Viewport:** 443 × 900 (iPhone-class), Chromium via browser-use MCP
- **Base URL:** `http://localhost:3000`
- **Tier:** Standard (critical + high + medium fixed)
- **Mode:** Full exploration across all account tabs + global chrome
- **Session:** Rahul Sharma (local `.data/zenin-state.json`), balances left untouched

## Environment notes (degraded-mode QA)

- Repo is **not a git repository** → no branch isolation, no per-fix commits.
- gstack runtime (`~/.claude/skills/gstack`) is **not installed** → preamble/telemetry/learnings steps skipped.
- Objective of the run (route coverage, console, layout, duplicate affordances) is fully achievable without them.

## Scope

| Route | Surface |
|---|---|
| `/` | Home / header chrome, bottom nav |
| `/app` | App shell redirect |
| `/app/account` | Profile tab, account drawer |
| `/app/account/wallet` | Cashback Wallet (live balances) |
| `/app/account/withdrawals` | Withdrawals & Payouts (blocking form) |
| `/app/account/rewards` | Reward Engine |
| `/app/account/affiliate` | Affiliate & Referrals (incl. top referrers leaderboard) |
| `/app/account/shop` | Shop the Archive |
| `/app/account/orders` | Orders |
| `/app/account/track` | Track order |
| `/products/[slug]` | Product detail |

## Fixes applied this run

| # | Severity | Finding | File | Fix |
|---|---|---|---|---|
| 1 | High | React 19 dev error: "Encountered a script tag while rendering React component" (theme init injected in `<head>` via raw `<script>`), surfaced in every route's console and dev overlay. | `src/app/layout.tsx` | Theme bootstrap moved to `<Script id="theme-init" strategy="beforeInteractive" />` as first child of `<body>`. Overlay + console error gone on fresh loads. |
| 2 | Medium | Duplicate Bag affordance on the Shop tab: header bag + bottom-nav Bag + in-page `Bag (n)` CTA. Three entry points to the same destination on one screen. | `src/app/account/AccountView.tsx` | Removed the in-page `Bag ({cartItems.length})` link and its flex wrapper; header is now title-only. |
| 3 | Medium | Rewards tab duplicated wallet information already owned by the Wallet page (balance card + "Open wallet" CTA) alongside a Membership tier card. Violates "no duplicate section" rule. | `src/app/account/AccountView.tsx` | Removed the balance card + CTA; a single full-width Membership tier card remains. |
| 4 | Medium | On signed-in mobile, the header bag icon and the bottom-nav Bag icon rendered simultaneously. | `src/app/globals.css` | Under `@media (max-width: 767px)`, `body.has-bottom-nav #cart-icon-bubble { display: none; }`. Bottom nav is now the single bag affordance. |

## Route-by-route results (post-fix)

| Route | Overflow X | Bottom nav | DOM id dupes | Console | Result |
|---|---|---|---|---|---|
| `/` | none (≈ -7px) | 1 | none | clean | PASS |
| `/app/account` | none | 1 | none | clean | PASS |
| `/app/account/wallet` | none | 1 | none | clean | PASS |
| `/app/account/withdrawals` | none | 1 | none | clean | PASS |
| `/app/account/rewards` | none | 1 | none | clean | PASS |
| `/app/account/affiliate` | none | 1 | none | clean | PASS |
| `/app/account/shop` | none | 1 | none | clean | PASS |
| `/app/account/orders` | none | 1 | none | clean | PASS |
| `/app/account/track` | none | 1 | none | clean | PASS |
| `/products/[slug]` | none | 1 | none | preload warnings only | PASS (see deferred) |

## Interaction checks

| Check | Result |
|---|---|
| Bottom nav → Wallet sets `aria-current`, URL `/app/account/wallet` | PASS |
| Account drawer → Withdrawals | PASS |
| Profile → Edit details opens form | PASS |
| Affiliate → Copy referral code shows "Copied" | PASS |
| Product card → `/products/[slug]` | PASS |
| Six bottom-nav items render, no clipping at 443px | PASS |
| Empty states (orders, referrals, leaderboard) render with copy, no layout break | PASS |
| Withdraw form: source toggle, amount chips, ₹ conversion, payout method | PASS (0-balance guard behaves) |

## Deferred / not fixed

| Item | Severity | Reason |
|---|---|---|
| Product-page image preload warnings (`choso-back.webp`, `betrayed-back.webp`) | Low | Framework/product rendering emits the preload; no explicit preload in `src`. Cosmetic console noise only. |
| Leaderboard shows empty state on local data | N/A (data) | Local legacy referral leads have no `referrerCode`/`referrerId`; production lead creation populates both (`services.ts` ~1064‑1092). Not a code defect. |
| Pre-existing ESLint findings | Low | `WalletPanel.tsx` (set-state-in-effect :384, `no-explicit-any` :521/571), `services.ts` (prefer-const :295, unused vars) predate this work. `npx tsc --noEmit` is the repo gate and passes. |
| gstack git/commit isolation | N/A | Repo is not a git repository. |

## Verification

```
npx tsc --noEmit          → clean (0 errors)
npx eslint <changed files> → 51 problems, all pre-existing (none introduced)
Browser pass at 443px      → 11 routes, no overflow, single bottom nav,
                             no duplicate ids, console clean
```

## Known limitations

- Wallet/withdraw end-to-end money movement was **not** exercised: per project rule, balances must not be mutated for UI tests. Flow verified structurally (guards, conversion math, disabled states) only.
- Desktop (≥768px) verified only via layout inspection, not a full browser pass; header bag remains the desktop affordance by design.
- Neon/Postgres and `.env` were not touched, per standing instruction.
