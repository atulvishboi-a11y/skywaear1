# 👕 ZENIN STREETWEAR - PROJECT BLUEPRINT & ARCHITECTURE SPECIFICATION
> **Document Status:** Active • **Target URL:** `http://localhost:3000` • **Admin URL:** `http://localhost:3000/admin`

---

## 📌 Executive Summary (Hum Kya Bana Rahe Hain?)

Hum ek **Premium Print-On-Demand (POD) Streetwear E-Commerce Brand** bana rahe hain jo exact **`https://zenin.co.in/`** ke minimalist, high-end fashion design aur architecture par based hai.

Isme 3 main layers hain:
1. **Customer Storefront (`/`)**: High-converting, mobile-first shopping experience with customizer studio and order tracking.
2. **Rewards & 4-Week Vesting Withdrawal System**: Cashback coins, 10% affiliate commission, aur coins ko UPI me 4 hafte ke vesting schedule par withdraw karne ki suvidha.
3. **Hidden Admin Control Portal (`/admin`)**: Jaise WordPress me `wp-admin` alag hota hai, vaise hi back-office management system (Orders POD pipeline, Free T-Shirt dispatching, Product catalog, aur withdrawal approvals).

---

## 🎨 1. Design & Aesthetic Direction (Zenin Style)

- **Color Palette:**
  - Background: Neutral Light Grey Canvas (`#e1e1e1`)
  - Accent/Foreground: Pure Black (`#000000` / `#121212`) & Off-white (`#ffffff`)
  - Accent Badges: Zenin Amber/Gold (`#fbbf24`), Emerald Green (`#10b981`)
- **Typography:**
  - Modern Monospace / Editorial Sans (`Anonymous Pro`, `JetBrains Mono`, `Inter`)
  - High-fashion uppercase category labels and clear visual hierarchy.
- **Micro-Animations & Components:**
  - Zenin marquee announcement ticker at the top.
  - Horizontal subcategory navigation strip (`BACKPACKS`, `BOTTOMS`, `JACKET`, `WINTER`, `T-SHIRTS`, `HOODIE`, `CAPS`, `DESKMAT`, `JERSEY`, `COMPRESSION`, `VEST`).
  - Slide-over Cart Drawer with real-time subtotal, free shipping threshold bar, and item counter.

---

## 🛍️ 2. Core Customer Features (Storefront)

### A. Curated Streetwear Catalog
- 240 GSM 100% Bio-Washed Combed Cotton T-Shirts.
- Category filters, size selector (`S`, `M`, `L`, `XL`, `2XL`), color swatches (`Onyx Black`, `Bone White`, `Acid Grey`, `Vintage Sand`).
- Zenin-styled pricing (`₹799` with `₹1,699` strike-through and `SAVE 53%` pill).
- Detailed product modals with size charts, GSM specs, and wash care instructions.

### B. Interactive 2D Customizer Studio
- Customers can design their own custom oversized streetwear t-shirt.
- Live canvas preview:
  - Select shirt base color (`Black`, `White`, `Charcoal`, `Sand`).
  - Toggle between **Front** and **Back** view.
  - Choose curated artwork presets (Cyber Tokyo, Demon Samurai, Kanji Graphic) or upload custom PNG/SVG graphics.
  - Custom typography with draggable text positioning and font styles.
- One-click "Add Custom Tee to Cart (₹899)".

### C. Slide-Over Cart & Checkout
- Real-time cart calculations with coupon codes.
- Direct reward point redemption: Customers can redeem their Zenin coins for up to 30% instant checkout discount.
- Address form with PIN code verification and multiple payment methods (UPI, Cards, NetBanking, COD).

---

## 💰 3. Cashback, Rewards & 4-Week Vesting Withdrawal System

### A. Rewards & Cashback Engine
- **10% Cashback on Every Order:** Every ₹100 spent earns 20 Zenin Points (1 Point = ₹0.50).
- **Cashback vesting — 1/4 instantly, rest weekly:** Order ke cashback coins 4 equal slices me split hote hain.
  Payment succeed hote hi **Slice 1 (25%) turant `availablePoints` me** chala jata hai; baaki slices payment ke
  **day 7 / 14 / 21** par auto-unlock hote hain (server har read/write par due slices release karta hai — koi
  "delivery ke baad" wait nahi). COD order ka vesting clock courier ke payment collect karne par start hota hai
  (DELIVERED par), prepaid order ka placedAt par. Cancel hone par unreleased slices VOID ho jate hain aur
  released slices wallet se wapas le liye jate hain.
- **10% Affiliate Commission — instant, no vesting:** Har customer ka personal referral link & coupon code (`ZENIN-10`). Dost ka order pay hote hi referrer ko 10% commission coins seedha `availablePoints` me mil jata hai (ledger line `COMPLETED`, lead `PAID`) — na delivery ka wait, na weekly slice. Order cancel hone par commission auto-reverse ho jata hai (coins wapas, ledger `REVERSED`, lead wapas `PENDING`).

### B. 4-Week Vesting Coin Withdrawal Protocol (Latest Audio Requirement)
- Ye layer **wallet coins ko UPI/bank me cash out** karne par lagti hai (cashback accrual layer se alag).
- Customers apne ikhatta kiye hue wallet coins ko direct **UPI (GPay / PhonePe / Paytm)** ya Bank Account me withdraw kar sakte hain.
- **4-Hafte Ka Vesting Rule (25% Weekly):**
  - Jab customer t-shirt khareedta hai, uske **1 hafte (7 din) baad pehla payout unlock hota hai**.
  - Pura amount 4 hafte me 4 equal installments me niklega:
    - **Week 1 (Day 7 after purchase):** `1/4th (25%)` Unlock & Transferable
    - **Week 2 (Day 14 after purchase):** `1/4th (25%)` Unlock & Transferable
    - **Week 3 (Day 21 after purchase):** `1/4th (25%)` Unlock & Transferable
    - **Week 4 (Day 28 after purchase):** `1/4th (25%)` Unlock & Transferable
- **Customer UI:**
  - Live Wallet Pill in Header with direct `Withdraw` button.
  - Homepage Rewards card with balance and `Withdraw Coins` button.
  - Live withdrawal modal with quick selectors (`25%`, `50%`, `75%`, `100%`) and dynamic 4-week installment breakdown table.
  - Status badges for each part: engine values `TRANSFERRED / UNLOCKED / LOCKED / VOID` kabhi member ko nahi dikhte — screen par **Done / Sending / Waiting / Returned** (section I).
  - Admin payout mark karte hi customer ko apne wallet me har slice ka `Sent <date>` + payment reference dikhta hai, aur poori request settle hone par **"Payout complete"** strip milta hai.
  - Payout cancel hone par rose **"Payout cancelled"** strip: kitne coins (₹) wallet me wapas aaye, kitna pehle ka paisa paid hi rahega, aur admin ka `rejectionReason` note customer ko dikhta hai. Summary cell us case me `Locked` ki jagah `Back in your wallet ₹X` dikhata hai.
  - **Parallel payouts:** ek member ke ek saath kai payouts chal sakte hain (purana "ek time par ek" guard hata diya gaya — coins request ban-te hi wallet se lock ho jate hain, isliye double-spend ka sawaal hi nahi). Har apni anchored order se 4 weekly parts count karta hai aur apne locked coins se hi pay hota hai.

---

## 🔒 4. Isolated Back-Office Admin Portal (`/admin`)

> **Strict Rule:** Storefront par admin ka koi link, button ya hint nahi dikhega. Sirf direct URL `/admin` kholne par hi khulta hai (like WordPress `/wp-admin`).

### A. Authentication Gate
- Protected login portal (`Username: admin`, `Password: admin`).

### B. Order Status Pipeline (POD Fulfillment)
- Real-time orders tracking across full e-commerce lifecycle:
  - `PENDING` ➔ `APPROVED` ➔ `PRINTING_POD` (Qikink DTG) ➔ `SHIPPED` ➔ `DELIVERED` ➔ `CANCELLED`.
- Courier partner allocation (BlueDart, Delhivery, DTDC) with live tracking number assignment.

### C. Free T-Shirt Allocation & Gifting
- Dedicated `+ Dispatch Free T-Shirt` modal.
- Admin VIPs, influencers, ya customer support replacement ke liye customer phone/email select karke free t-shirt dispatch kar sakta hai (auto-creates `GIFT-XXX` order in pipeline).

### D. Product Catalog Management
- Dedicated `+ Add New T-Shirt` modal.
- Upload new drops, set retail price, compare price, GSM fabric, category, and size tags.
- **Custom Cashback Points Per T-Shirt:** Har specific t-shirt ke liye alag se custom reward coins/cashback points set karne ka option (e.g. kisi me jyada coins, kisi me kam coins, ya store default 10%). Real-time INR value preview aur instant update.
- Ability to delete/archive drops from the storefront.

### E. 4-Week Vesting Withdrawal Desk (`Withdrawals` tab)
- Dedicated tab-level desk: ek row per payout request — Member (name + phone), Request (id + anchored order), Payout to (UPI / masked bank + slices paid), Coins (coins + ₹), Paid, Payable (ya `+N refunded`), Status pill + next unlock date, Actions. Upar search (member / request id / UPI / phone / order number) aur status filters (`All requests`, `Pay now`, `Weekly payouts`, `Fully paid`, `Rejected`) aur console stats (*Pay now / Still locked / Already paid out / Refunded to wallets*) — section I ke plain words ke saath.
- `Tranches` action row expand karke poori payout card khulta hai (per-slice `Mark paid`, reference input, vesting calendar).
- **Edit payout:** `Edit payout` button se name / phone / UPI ID / bank account / IFSC / payout method theek ho sakta hai (`PATCH /api/admin/withdrawals/[id]`). Server wahi validation lagata hai jo checkout me lagta hai, vesting calendar untouched rehta hai, aur settled ya rejected request edit nahi hoti.
- **Mark payment done:** Ektran `Mark paid` (single 25%) ya bulk `Mark payment done • ₹X` button sabhi unlocked tranches ko `TRANSFERRED` kar deta hai (`POST /api/admin/withdrawals/[id]/pay` with `{week}` ya `{all:true}`). Payment app ka `Payment reference` daalne par wahi ref stamp hota hai, blank chhodne par engine auto-ref bana deta hai. Row se `Pay ₹X` one-click same bulk call karta hai.
- Sabhi 4 tranches settle hote hi request **`Success • fully paid`** ho jati hai — green strip, wallet ledger line `COMPLETED`, aur audit log me `WITHDRAWAL_PAID`.
- Locked tranche age nahi khinchi ja sakti: API `409` deta hai aur desk "next ₹X unlocks on <date>" dikhata hai.
- **Reject + auto-refund:** Row ka `Reject` action (ya card me reject) `POST /api/admin/withdrawals/[id]/reject` bhejta hai with optional `reason` (max 160 chars, customer ko dikhta hai). Engine:
  - jo slices `TRANSFERRED` ho chuke hain wo **paid hi rehte hain** — paisa wapas nahi liya jata;
  - baaki sab slices `VOID` ho jate hain aur un coins ka exact total customer ke `availablePoints` me wapas aa jata hai (withdrawal ke waqt coins already deduct ho chuke hote hain);
  - wallet me do lines: original `${id}` `ADMIN_ADJUSTMENT` line `COMPLETED` ho jati hai ("₹X transferred, N coins returned to the wallet (reason)") aur ek nayi `REFUND` line (+N coins);
  - request terminal `REJECTED` ho jati hai — dobara reject `409` ("already rejected"), settled request reject `409`, rejected request par pay `409`, reason >160 chars `422`, unknown id `404`, bina admin session `401`;
  - `refreshVesting` REJECTED requests ko skip karta hai, isliye voided slices time ke saath dobara unlock nahi hote;
  - audit log me `WITHDRAWAL_REJECTED` (paid ₹, refunded coins/₹ aur reason).

### F. Member Directory (`Members` tab) — kisi bhi user ka account ID se open
- Har member card par uska **member ID** (`ID usr-…`) print hota hai, aur search box me exact ID daalte hi (case-insensitive) usi ka profile khul jata hai — placeholder: "Member ID, mobile number, email, name or ZENIN code". ID search phone/email/name/referral search se priority leta hai.
- Card par click karne se bhi wahi account profile me open hota hai; profile header me ID + **Copy ID** button hai (clipboard block ho to manual copy ka toast).
- `ctl.openMember(customerId)` ek cross-tab action hai: **Orders** card ka customer naam aur **Withdrawals** row ka Member cell click karne par seedha Members tab par jump hota hai aur us user ka wallet console khul jata hai (balance, vesting, lifetime, orders, ledger, payout requests counts + audited edits).
- Guest orders (jinke `customerId` nahi) par link render nahi hota — sirf naam dikhta hai.

### G. Support Preview — admin khud kisi bhi member ban kar storefront dekh sake
- Members profile header me **Sign in as this member** button: server us member ka `zenin_customer_session` cookie is browser me issue karta hai aur live storefront ek **new tab** me khol deta hai — wahi wallet, orders, vesting aur payout screens jo asli member dekhta hai.
- Routes: `POST /api/admin/members/[id]/session` → `adminOpenMemberSession` + cookie issue (12h TTL), `DELETE` (same path) → `adminCloseMemberSession` + cookie clear. Dono `readAdminSession()` maangte hain: bina admin login `401`, unknown id `404` ("Member not found"). Member ka apna cookie admin session nahi de sakta — us case me bhi `401`.
- **End preview** button tab state me nahi, server snapshot me rehta hai: `AdminOverview.storefrontCustomerId` (overview route `readCustomerSession()` se bharta hai) === is member id par `previewOpen` derive hota hai, isliye /admin reload karne par bhi active preview dikhta hai aur band kiya ja sakta hai.
- Deliberate tradeoffs:
  - Storefront par **koi admin banner/hint nahi** — standing rule "Storefront par admin ka koi link, button ya hint nahi dikhega" preview mode me bhi lagu. Accountability sirf admin audit log me: `ADMIN_MEMBER_PREVIEW` (kaunsa member, available/vesting coins) aur `ADMIN_MEMBER_PREVIEW_END`.
  - Browser me ek hi customer cookie jar hai, isliye preview us browser ka purana storefront sign-in **replace** kar deta hai; End preview us session ko poora sign out kar deta hai. Yeh caption me admin ko clearly likha milta hai.

### H. Support Desk — WhatsApp / call / email, admin se editable
- **Ek hi source of truth:** contact details server state me rehti hain (`ZeninState.support`), `.env` me nahi. Type `SupportConfig { whatsappNumber, callNumber, email, hours, whatsappMessage }` — `src/lib/support.ts`, numbers digits-only + country code (bare 10-digit mobile ko `91` prefix mil jata hai, client aur server dono `toInternationalDigits()` use karte hain).
- **Admin → Support tab** (`SupportTab`): WhatsApp (required), Call line (empty = phone row poori hidden), Email, Hours (≤60 chars), pre-filled chat message (≤240 chars). Har field ka draft live preview strip me `wa.me` / `tel:` / `mailto:` / `/support` links turant update hote hain. Save se pehle server validate karta hai (`saveSupport` → `HttpError 422`, e.g. "WhatsApp number must be 10–15 digits including the country code"), audit line `SUPPORT_UPDATED` likhi jati hai. Demo placeholder `919000000000` par amber banner dikhta hai: **wa.me sirf tab chat kholta hai jab wo number WhatsApp par actually registered ho** — launch se pehle real number save karna hai.
- **Public help centre:** `/support` (`src/app/support/page.tsx` + `SupportCentre.tsx`) — hero, hours chip, 3 contact cards aur 4 FAQ groups × 15 questions. FAQ ke saare numbers live rules se interpolate hote hain (cashback %, coin value, ₹499/30% redemption, 100-coin payout minimum, 1/4-at-payment + 7/14/21-day vesting, delivery fee), isliye admin rules badalne par help text jhooth nahi bol sakta.
- **Data route:** `GET /api/support` → `supportSnapshot()` (`SupportCentre` contract: support + rewardRules + deliveryFee + freeShippingThreshold + minWithdrawalPoints). Route `connection()` call karta hai taaki Cache Components is filesystem-backed snapshot ko prerender karke stale contact number serve na kare.
- **Storefront surface:** Header me desktop **Support** dropdown (WhatsApp / Call / Email / hours / Help centre link) aur mobile drawer block; Footer me "STUDIO & SUPPORT" column + bottom bar "Customer Support". Dono `StorefrontSnapshot.support` se fill hote hain — koi client-side default hardcoded nahi.
- **Deliberate scope cuts** (user ne choose kiya): storefront par floating WhatsApp bubble nahi, per-order help button nahi, aur admin me koi ticket/support log nahi — sirf contact settings + ek `SUPPORT_UPDATED` audit line. Storefront par admin ka koi hint nahi (0 occurrences of "admin" on `/` and `/support`).
- Old state files: `load()` missing `support` key ko `DEFAULT_SUPPORT` se backfill karta hai (cached-global branch bhi, warna HMR ke baad purana object bina field ke laut aata). `STATE_VERSION` deliberately 1 hi hai — bump live demo data wipe kar deta.

### I. Payout wording + Reopen — admin aur member dono ke liye plain language
- **Why:** member ko "kiska kitna paisa aana baaki hai" aur admin ko "kisko dena hai" ek line me samajh aana chahiye — internal shabd (`vesting`, `tranche`, `slice`, `ledger`, `anchor`, `server-authoritative`) kisi surface par nahi dikhte. Four states ke words: internal `TRANSFERRED/UNLOCKED/LOCKED/VOID` → member par **Done / Sending / Waiting / Returned** (`PART_WORD`, `CustomerDashboardModal.tsx`), admin desk par **Paid / Ready to pay / Not due yet / Refunded** (`TRANCHE_WORD`, `admin/page.tsx`). Status words: `deskStatus()` = *Ready to pay / Weekly payouts / Fully paid / Rejected*, aur `deskNextStep()` ek sentence me batata hai "Pay ₹X now" / "Next ₹Y unlocks {date}" / "N coins went back to {name}" / "Closed — ₹X paid out".
- **Member view** (`WithdrawalCard`): header me pehle paisa (`₹50`, "goes to UPI x@bank — in 4 parts, one part every week"), phir `{id} • asked for N coins on {date}`, chip me *Money on the way / All money sent / Payout cancelled*, "Money received so far X%" + do chips (*In your account* / *Still to come* ya *Back in your wallet*), phir 4 part rows with `partNote()` ("Sent {date} • reference …", "Due now — it leaves our account within a working day", "Comes on {date} — about N days away", "N coins are back in your wallet"), aur last me cancelled/done/on-the-way callout jisme rejection reason bhi aata hai. Withdraw form ka preview "How the money arrives" kehke 4 dates dikhata hai aur clearly bolta hai dates latest order se count hote hain isliye 1–2 din move ho sakte hain. Guest/empty states bhi plain ("You are not signed in yet", "Every coin movement", "No payouts yet…").
- **Admin desk** (`WithdrawalsTab`): ConsoleHero "Who to pay, and how much is still owed" + 4 stats (*Pay now / Still locked / Already paid out / Refunded to wallets*). "Pay these first" panel sirf unlocked requests dikhata hai (`payFirst`), aur har row me member ka free wallet balance bhi (`walletOf()` → `snapshot.customers`). Table columns: **Who / Request / Money goes to / Paid · ready · locked / Status / Actions** — paid, ready-to-pay aur still-locked alag-alag lines me, rejected row me "refunded ₹X". `Pay ₹X` button tabhi render hota hai jab `payableNowRupees > 0` (hamesha-disabled "Pay ₹0" noise hata diya). Metrics/Member tabs ke jargon bhi badle: *Settled payouts → Paid to members*, *Payable now → Ready to pay*, *Review vesting payouts → Who to pay this week*, *Vesting weekly → Unlocks weekly*, *Ledger entries → Wallet movements*.
- **Reopen rule** (`reopenWithdrawal()` in `src/lib/server/services.ts`, route `POST /api/admin/withdrawals/[id]/reopen`, client `api.admin.reopenWithdrawal`): pehle sirf reject hui request khulti hai (`409 Only a rejected payout can be reopened`), har `VOID` tranche wapas `dueAt` ke hisaab se `LOCKED`/`UNLOCKED` hota hai (koi part aage nahi khinchta), `overallStatus → VESTING_IN_PROGRESS`, `rejectionReason` clear, aur refund se wapas aaye coins member ke wallet se **dobara debit** — `availablePoints < points` par `409 {name} has only N free coins — M more are needed to re-queue this payout` (member coins kharch kar chuka ho to reopen refuse). Ledger line ka description `Payout {id} reopened — …` rakha gaya taaki `syncWithdrawalLedger()` ka `${request.id} ` prefix lookup original request line par hi lage; audit me `WITHDRAWAL_REOPENED`.
- **Edit vs reopen:** `adminUpdateWithdrawal` sirf `COMPLETED` rokti hai — matlb rejected request ke UPI/bank details correct kiye ja sakte hain aur saving status ko chua nahi; modal me explicitly likha hai "saving only corrects where the money goes, press Reopen to queue it again". Reject modal ka "What happens" block bhi ab reopen ka plain explanation deta hai.
- **Test residue (honest):** QA member `usr-mv98bjs9` par reopen→reject round-trip se 2 extra wallet lines (`Payout wth-xnaya reopened …` debit + `wth-xnaya refund …` credit) aur 2 audit lines bachhi hain; coins aur request status original state me wapas hain (wth-xnaya REJECTED, 100 coins free).

### J. Parallel payouts + admin khud member ki payout banaye — owner ke do decisions
- **Why:** owner ne report kiya "abhi me kisi ka withdrawal laga raha hu to lag nhi raha h". Diagnosis: server me ek guard tha — `submitWithdrawal` tabhi refusa karta tha jab us member ki koi request `VESTING_IN_PROGRESS` me thi — aur refusal message me 0-coin case ka koi explanation nahi tha. Guard galat tha, validation nahi.
- **Decision 1 — "Parallel payouts chalo sakte hain":** guard hata diya gaya (`src/lib/server/services.ts`). Coins request create hote hi `customer.availablePoints` se deduct ho jate hain, isliye do saath chal rahi requests ka aperture ek hi wallet balance se compete nahi karta — guard redundant protection thi, double-spend defence nahi. `createWithdrawal()` ab ek private shared engine hai; `submitWithdrawal` (member, actor = member ka naam) aur `adminRaiseWithdrawal` (admin, actor = `Admin (finance@zenin.co.in)`) dono wahi call karte hain, taaki schedule, wallet debit aur audit line kabhi alag na ho.
- **Refusal ordering (member ko plain sentence, server se):** payout format `422` → minimum coins `422 At least 100 coins (₹50) are needed for a payout` → free coins `409 Only N coins are free right now — the rest are already inside a payout or unlock weekly` → unknown member `404 That member account was not found`. Storefront ke inline validations (`CustomerDashboardModal.tsx`) aur `RaisePayoutModal` ke amber notes ab inhi sentences ko mirror karte hain (purane "Minimum withdrawal is…" / "Only N coins are available for withdrawal" hata diye).
- **Decision 2 — "Haan, add karo" (admin se payout raise):** Member profile me naya **Payouts to this member** panel — upar "N running — each one pays in 4 weekly parts from its own locked coins" (ya "No payout is running right now…"), `Raise payout` button, aur har request ka row (`id • ₹total`, `payoutTarget` + `deskNextStep`, coins + asked date, status pill, aur `refunded ₹X` / `paid ₹Y • ready ₹Z`). Purana duplicate "N payout requests" pill Orders panel header se hata diya (count ab panel subtitle me hi hai).
- **`RaisePayoutModal`** (`src/app/admin/page.tsx`): coins + method + UPI/bank fields, `buildVestingSchedule()` se live 4-part preview (dates member ki **latest order** se anchor), aur "What happens" 3 bullets — coins aaj hi wallet se jaate hain / kitne coins free rahenge, 4 weekly parts (chal rahi payouts ke saath "every schedule pays side by side, each from its own locked coins"), baad me details edit / part-pay / reject-with-refund kar sakte hain. Amount par client-side gate: `belowMin` aur `aboveFree` dono case me submit disabled + amber explanation (above-free me pehla bullet "This wallet has only N coins free" ban jata hai, galat "649→0 stay free" claim nahi).
- **Routes/type:** `POST /api/admin/withdrawals` (`AdminRaiseWithdrawalInput = WithdrawalInput + customerId`) → `adminRaiseWithdrawal`, 201 with `{withdrawal, customer}`; client `api.admin.raiseWithdrawal`. `AdminOverview` me naya `minWithdrawalPoints` (`MIN_WITHDRAWAL_POINTS`), isliye UI ka minimum server ke minimum se hamesha match karta hai — state file me key nahi, backfill ki zaroorat nahi thi.
- **Legacy ledger jargon:** member wallet ki "Every coin movement" ab `plainLedgerLine()` se guzarti hai jo purani lines ke engine phrases badal deti hai ("vesting coins released back after the payout desk rejected this request" → "the coins from this cancelled payout are back in your wallet", "vests 25% weekly for 4 weeks" → "paid in 4 weekly parts"). Nayi refund line server me hi plain likhi jati hai — `syncWithdrawalLedger()` ka `${request.id} ` prefix lookup safe hai.
- **Verified live (browser + API, koi state file edit nahi):** Aman Sharma (`usr_aman_01`, 649 free) par admin drawer se `wth-693ee` (100 coins) raise hua jab `wth-901` pehle se running tha — drawer me "2 running", desk me dono rows + `wallet 549 coins free`; phir storefront par usi member ne `wth-6f034` (100 coins) place kiya while `wth-901` running — "MY PAYOUTS (3)". Dono test requests reject karke coins wapas: Aman vapas **649 free**. `usr-mv93zpgd` ke do running payouts (`wth-5e37k`, `wth-ukffk`) desk me side by side dikhte hain.
- **Test residue (honest):** `usr_aman_01` ke wallet me 4 extra lines chal rahi hain (2 `payout started`, 2 `rejected` + 2 refund lines) aur audit me unhi ke entries — coins restore ho gaye hain, par ledger history nahi miti ja sakti (delete karna state file chhedne ke barabar). `usr-mv93zpgd` par `wth-ukffk` owner ki apni request hai aur `wth-5e37k` pichhli verification ka; dono chhod diye (owner reject/open khud kar sakta hai).

---

## 🏗️ 5. Technical Stack & File Architecture

| Component | Technology |
|---|---|
| **Framework** | Next.js 14+ (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS (Custom Zenin Theme) |
| **Icons** | Lucide React |
| **Database ORM** | Prisma ORM (`prisma/schema.prisma` configured for PostgreSQL) |
| **POD Integration** | Qikink DTG Webhook Architecture |

### Key Directory Structure:
```
tshirt/
├── src/
│   ├── app/
│   │   ├── page.tsx               # Customer Storefront (Zenin UI + Wallet)
│   │   ├── admin/
│   │   │   └── page.tsx           # Isolated Admin Portal (/admin)
│   │   └── globals.css            # Custom fonts & scrollbars
│   ├── components/
│   │   ├── Header.tsx             # Zenin Header + Live Wallet Pill + Withdraw
│   │   ├── ProductCard.tsx        # Product display card with Zenin Save % badge
│   │   ├── CustomizerStudio.tsx   # 2D Interactive T-shirt customizer
│   │   ├── CartDrawer.tsx         # Slide-over cart drawer
│   │   ├── CheckoutModal.tsx      # Checkout modal with Coin redemption
│   │   ├── CustomerDashboardModal.tsx # Customer Account, Wallet & Vesting Modal
│   │   ├── AuthModal.tsx          # Mobile OTP & Google sign-in
│   │   ├── TrackOrderModal.tsx    # Live courier tracking interface
│   │   └── SizeChartModal.tsx     # Size guide modal
│   └── data/
│       ├── products.ts            # Curated catalog drops
│       └── rewardsEngine.ts       # 4-Week Vesting math & initial data
├── prisma/
│   └── schema.prisma              # PostgreSQL database models
└── PROJECT_BLUEPRINT.md           # This document
```

---

## 🚀 6. How To Access & Test

1. **Customer Storefront:**
   - Open browser: `http://localhost:3000`
   - Test Header navigation, browse products, open Customizer Studio.
   - Click **Withdraw** on the Wallet pill in the header or in the Homepage wallet card to see the 4-week vesting system in action.
2. **Admin Portal:**
   - Open browser: `http://localhost:3000/admin`
   - Login with `admin` / `admin`.
   - Test Order Pipeline, Dispatch Free T-Shirt, Add Product, and Approve 4-Week UPI Withdrawals.
