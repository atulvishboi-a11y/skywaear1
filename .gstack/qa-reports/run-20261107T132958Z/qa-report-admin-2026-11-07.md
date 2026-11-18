# QA report — admin console (`http://localhost:3000/admin`)

- Date: 2026-11-07
- Mode: Full, read-only (no payout settle/reject, no balance or password writes)
- Surface: browser (12 admin desks)
- Driver: browser-use MCP (gstack runtime absent — degraded mode, no telemetry)
- Framework: Next.js 16 App Router, React 19, Tailwind v4
- Health score: 100 / 100 (provisional: Accessibility, Content, links-to-404 not fully tested)

## Coverage

`/admin`, `/admin/orders`, `/admin/products`, `/admin/customers`, `/admin/withdrawals`,
`/admin/rules`, `/admin/support`, `/admin/affiliates`, `/admin/audit`, `/admin/compliance`,
`/admin/gateways`, `/admin/push`.

Every desk rendered its expected data with zero console errors. Navigation was exercised
through the rail links (client-side routing), not by direct URL entry.

## Issues found and fixed

### 1. HIGH — every tab switch dropped the console to the login screen (fixed)

- Symptom: from `/admin`, clicking ORDERS landed on `ZENIN CONSOLE / LOG IN TO ADMIN CONSOLE`
  while the admin cookie was still valid (`GET /api/admin/session` → 200).
- Cause: a tab switch remounts the console. The boot effect called the overview, the client
  sent the cached `If-None-Match`, the server answered 304, and `fetchAdminOverview` returned
  `null`. `snapshot` stayed null, so the render's `!snapshot` guard showed the login screen.
- Fix: `src/lib/client.ts` now caches the last overview payload beside its ETag and replays it
  on 304 (ETag and payload are cleared together on login/logout/401).
- Verified: click ORDERS → `h1 = ORDERS`, no login screen; remaining 11 desks all load.

### 2. MEDIUM — last sidebar destinations were unreachable on shorter screens (fixed)

- Symptom: `WEB PUSH ALERTS` (and Compliance / Gateways on shorter windows) sat below the
  visible rail. At a 637 px viewport the nav box was 307 px tall holding 447 px of items,
  with `overflow-y: auto` and a hidden scrollbar — no hint that more existed.
- Fix: `src/app/admin/[[...slug]]/page.tsx` — the `<aside>` is now the single scroll
  container (`overflow-y-auto`), the rail is `min-h-full`, and the `<nav>` no longer clips.
  Same fix covers the mobile drawer, which already scrolled.
- Verified: aside `scrollHeight 776 / clientHeight 637`, nav `447 / 447` (no clipping).
  Scrolled the rail, `WEB PUSH ALERTS` visible at y=459, clicked → `/admin/push` renders.

## Server-load evidence (the optimization under test)

| Request | Status | Bytes |
|---|---|---|
| First `GET /api/admin/overview` | 200 | 116,977 |
| Unchanged poll (If-None-Match) | 304 | bodyless (~300 B headers) |
| Timer polls on `/admin` | 304 every 15 s | bodyless |
| Static desk (`/admin/push`, `/admin/rules`) | one boot fetch, no timer | — |

Per tab switch in dev: 1 RSC payload + 1 session + 1 bodyless overview (React StrictMode
doubles effects in dev only). No repeated 200s during idle.

## Evidence

- `screenshots/sidebar-scrolled.jpg` — all rail destinations reachable, push visible.

## Test-data cleanup (post-QA)

Local `.data/zenin-state.json` only (SKYWEAR_LOCAL_ONLY=true; Neon untouched).
Backup: `.data/backups/zenin-state-2026-11-07T13-39-36-775Z.json`.

Removed QA fixtures:

- Accounts `usr-mw2ff3f7` (User Alpha), `usr-mw2ff7oo` (User Beta),
  `usr-mv98bjs9` / `usr-mv93zpgd` / `usr-mvjodda5` (Zenin Member QA payout accounts),
  `usr_aman_01` (Aman Sharma, qa.* payout handles).
- Orders `TC_23220`, `GIFT-452` (QA Verifier); 15 withdrawals; 65 wallet transactions;
  2 notifications; 2 referral rows.

Counts: orders 11 → 9, withdrawals 18 → 3, transactions 102 → 37, referrals 8 → 6,
notifications 16 → 14. Kept: `usr-mw3uozil` (Rahul Sharma), `usr-mw65h2tf`
(Skywear Customer), plus the Vikash/umesh/seed demo orders. Audit journal kept as-is
(append-only by design).

Result: Overview READY TO PAY 0, Withdrawals 3 rows (2 paid, 1 rejected), no QA names.
Dev server restarted to reload the edited file; first load 200, polls return 304.

## Limits

- Read-only run: no payout settle/reject, no rule/support saves, no order mutations.
- Mobile viewport emulation not probed; mobile drawer verified statically only.
- Keyboard/focus order and 404 link targets not exercised.
- gstack runtime (`~/.claude/skills/gstack`) is absent; isolation, browser setup and telemetry
  were run in the skill's degraded mode with browser-use as the browser driver.
