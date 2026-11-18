# QA Report — Dashboard Lint Cleanup + Regression Pass

- **Run ID:** `run-20261105T202057Z`
- **Date:** 2026-11-05
- **Target:** Logged-in dashboard (`/app/account/*`), mobile 443 × 637
- **Tier:** Standard
- **Mode:** Fix-round verification (follows `run-20261105T193758Z`)

## Goal

Close the deferred low-severity items from the previous run: 51 ESLint problems
across the touched files, and re-verify every dashboard route plus tab
navigation after the code changes.

## Result

| Gate | Before | After |
|---|---|---|
| ESLint (6 touched files) | 51 problems (24 errors, 27 warnings) | **0 problems** |
| `npx tsc --noEmit` | 0 errors | 0 errors |
| Browser console (all routes) | clean | clean |

## Changes

### Real hook errors (4 → 0)

| File | Issue | Fix |
|---|---|---|
| `AccountView.tsx` | `useEffect(() => setSelectedTab(null), [routeTab])` cascading render | Tab now derives from `usePathname()`; no state sync |
| `AccountView.tsx` | `useEffect` copied `claimedReferralRewards` + address into state | Claims derived with `useMemo` from snapshot + optimistic local claims; address prefilled in `openMilestoneClaim` |
| `WalletPanel.tsx` | two `useEffect` blocks mirrored `customer.savedUpiId` / `primaryBank` into form state | Effects removed; save handlers already set the new values, mount initializers cover the first render |

### Stale-params bug found during verification

After removing the effect, tab content stopped following the URL: navigating from
`/app/account/withdrawals` → `/app/account/wallet` via the bottom nav left the URL
correct but the view on Withdrawals. `useParams()` returned a stale object for the
same dynamic segment. Switched tab derivation to `usePathname()` — content and URL
now stay in sync (verified both directions).

### Type and dead-code cleanup (47 → 0)

- 19 `no-explicit-any` removed: `catch (err: any)` → `catch (err)` with a new
  shared `errorMessage(error, fallback)` helper in `src/lib/domain.ts`;
  legacy `rewardCoins` product alias typed as
  `Partial<Product> & { rewardCoins?: unknown }`; withdrawal legacy `utr`/`paidAt`
  typed similarly; `courier_name` cast narrowed to `CourierPartner`.
- 23 `no-unused-vars` removed: entire unused auth-form state block and three
  orphaned login/OTP handlers in `AccountView` (~130 lines), plus `refreshing`,
  `handleRefresh`, `copiedTracking`, `claimSuccessMessage`; unused imports in
  `services.ts`.
- `prefer-const` in `services.ts` (`sanitizedCustomer`).
- `useMemo` dependency churn on the referrals array fixed by memoizing it.
- `@next/next/no-img-element` on the Shop tab: documented inline disable —
  product artwork is admin-managed and `next/image` would reject off-allowlist
  hosts (`next.config` has no `remotePatterns`).
- `removeCustomerBankAccount` now resolves the account before rejecting, so both
  parameters are meaningful (404 unknown account, 400 linked account) instead of
  being unused.

## Route verification (post-change, 443px)

| Route | H1 | Overflow X | Result |
|---|---|---|---|
| `/app/account` | My Orders & Tracking | 0 | PASS |
| `/app/account/wallet` | Cashback Wallet (Live wallet tile) | 0 | PASS |
| `/app/account/withdrawals` | Withdrawals & Payouts (live balances + form) | 0 | PASS |
| `/app/account/rewards` | Reward Engine (single membership card) | 0 | PASS |
| `/app/account/affiliate` | Affiliate & Referrals (leaderboard empty state) | 0 | PASS |
| `/app/account/shop` | Shop the Archive (8 cards, no bag CTA) | 0 | PASS |
| `/app/account/notifications` | Alerts & Updates | 0 | PASS |
| `/app/account/profile` | Profile & Addresses | 0 | PASS |
| `/account/wallet` (legacy) | → redirects to `/app/account/wallet` | — | PASS |

## Interaction verification

| Check | Result |
|---|---|
| Wallet → "Withdraw coins" → Withdrawals tab | PASS (URL + view) |
| Withdrawals → bottom-nav Wallet → Wallet tab | PASS (stale-tab bug fixed) |
| Sidebar link navigation (all tabs) | PASS |
| Mobile "Account Menu" drawer opens | PASS |
| Profile → Edit details prefills name/phone | PASS (cancel leaves no writes) |
| Affiliate → Copy code shows "Copied" | PASS |
| Header bag hidden at 443px under bottom nav | PASS |
| Console errors/warnings on every route | none |

## Still deferred

| Item | Reason |
|---|---|
| Product-page image preload warnings | Emitted by the product route, cosmetic |
| Leaderboard empty on local data | Legacy local referral leads lack `referrerCode`; production creation sets it |
| Money movement end-to-end | Balances must not be mutated for UI tests (project rule) |
| Neon / `.env` | Untouched by instruction |

## Notes

- One transient "This page couldn't load" appeared mid-run while the dev server
  recompiled after an edit; a reload rendered normally and no console error
  remained. Not reproducible afterwards.
