# 🏛️ ZENIN STREETWEAR — PRODUCTION SYSTEM DESIGN SPECIFICATION
> **Document Status:** Architectural Standard • **Version:** 2.0.0 • **Last Updated:** October 2026  
> **Authors:** Senior Systems Architect & Core Platform Engineering Team

---

## 📑 Table of Contents
1. [Executive Summary & Domain Context](#1-executive-summary--domain-context)
2. [Functional & Non-Functional Requirements](#2-functional--non-functional-requirements)
3. [High-Level Architecture (C4 Model)](#3-high-level-architecture-c4-model)
   - [3.1 Level 1: System Context Diagram](#31-level-1-system-context-diagram)
   - [3.2 Level 2: Container Diagram](#32-level-2-container-diagram)
   - [3.3 Level 3: Component Architecture](#33-level-3-component-architecture)
4. [Domain Model & Database Schema (PostgreSQL & Prisma)](#4-domain-model--database-schema)
   - [4.1 Complete Entity Relationship Diagram (ERD)](#41-complete-entity-relationship-diagram-erd)
   - [4.2 Data Dictionaries & Enum Definitions](#42-data-dictionaries--enum-definitions)
5. [Core State Machines](#5-core-state-machines)
   - [5.1 E-Commerce & POD Fulfillment State Machine](#51-e-commerce--pod-fulfillment-state-machine)
   - [5.2 4-Week Cashback Accrual Vesting Lifecycle](#52-4-week-cashback-accrual-vesting-lifecycle)
   - [5.3 4-Week Coin Payout / UPI Withdrawal Lifecycle](#53-4-week-coin-payout--upi-withdrawal-lifecycle)
6. [Detailed Workflows & Sequence Diagrams](#6-detailed-workflows--sequence-diagrams)
   - [6.1 Checkout, Razorpay Payment & Webhook Idempotency](#61-checkout-razorpay-payment--webhook-idempotency)
   - [6.2 4-Week Fractional Vesting Release Engine](#62-4-week-fractional-vesting-release-engine)
   - [6.3 Payout Request, Parallel Execution & Rejection-Refund Protocol](#63-payout-request-parallel-execution--rejection-refund-protocol)
   - [6.4 Stealth Admin Portal & Zero-Footprint Customer Impersonation](#64-stealth-admin-portal--zero-footprint-customer-impersonation)
7. [Financial Safety, Concurrency & Invariants](#7-financial-safety-concurrency--invariants)
   - [7.1 Double-Spend Prevention & Parallel Payout Aperture](#71-double-spend-prevention--parallel-payout-aperture)
   - [7.2 Ledger Immutability & Double-Entry Accounting](#72-ledger-immutability--double-entry-accounting)
   - [7.3 Order Cancellation & Clawback Guarantees](#73-order-cancellation--clawback-guarantees)
8. [Performance, Caching & Scalability Strategy](#8-performance-caching--scalability-strategy)
9. [Security, Authentication & Threat Modeling](#9-security-authentication--threat-modeling)
10. [Observability, Alerting & Reliability](#10-observability-alerting--reliability)
11. [Infrastructure, CI/CD & Deployment Topology](#11-infrastructure-cicd--deployment-topology)

---

## 1. Executive Summary & Domain Context

**Zenin Streetwear** (internally *Threadcraft*) is a high-performance, direct-to-consumer (D2C) Print-On-Demand (POD) streetwear platform built with an editorial, minimalist aesthetic inspired by luxury Japanese and neo-cyberpunk streetwear labels.

The platform marries three distinct operational pillars:
1. **Ultra-Responsive Customer Storefront (`/`)**: Mobile-first luxury e-commerce catalog featuring 240 GSM bio-washed heavy cotton oversized t-shirts, an interactive 2D in-browser canvas customization studio, slide-over cart drawer, and seamless Razorpay checkout.
2. **Dual-Tier Financial Rewards & 4-Week Vesting Protocol**:
   - **Cashback Accrual Layer**: 10% cash equivalent reward on purchases split into four 25% tranches: Tranche 1 unlocks instantly upon payment verification; Tranches 2, 3, and 4 auto-unlock weekly on Days 7, 14, and 21.
   - **Coin Withdrawal Protocol**: Accumulated reward coins can be liquidated directly into Indian Rupees via UPI (`@oksbi`, `@okhdfcbank`, `@paytm`, etc.) or NEFT/IMPS bank transfers, distributed across a strict 4-week vesting schedule (25% every 7 days) anchored to purchase dates.
   - **Instant Affiliate Commissions**: 10% instant affiliate commission credited directly to available wallet balances upon friend's order payment.
3. **Isolated Zero-Footprint Admin Back-Office (`/admin`)**: A completely decoupled back-office portal hidden from public discovery (0 references in client bundles or public navigation), managing the entire Qikink POD fulfillment lifecycle, courier dispatching (BlueDart, Delhivery, DTDC), custom drop creation with per-item cashback multipliers, free VIP t-shirt allocations, customer session impersonation, and batch UPI payout execution.

---

## 2. Functional & Non-Functional Requirements

### 2.1 Functional Requirements
- **FR-01 Product Discovery & Customization**: Shoppers can browse drops filtered by category, select color/size, and launch an interactive 2D Studio to customize front/back graphics and typography, rendering real-time composite previews.
- **FR-02 Cart & Checkout**: Slide-over drawer with real-time coupon calculations (`ZENIN-10`, `OVERSIZED`), wallet coin redemption (up to 30% checkout total; minimum ₹499 order), and free delivery threshold progress indicators.
- **FR-03 Payment Gateway Integration**: Native Razorpay integration supporting UPI, Credit/Debit cards, NetBanking, and COD, backed by cryptographic signature verification (`HMAC-SHA256`) and idempotent webhook processing.
- **FR-04 Dual 4-Week Vesting Financial Engine**:
  - Auto-schedule and auto-release 4-week cashback tranches.
  - Upfront coin deduction upon withdrawal creation to enable risk-free **parallel payouts**.
  - Settle, partial-pay, reject-with-auto-refund, and safely reopen payout requests.
- **FR-05 POD Fulfillment Automation**: Automated dispatch to Qikink Direct-to-Garment (DTG) printing lines, state synchronization, and multi-courier tracking (Delhivery, BlueDart, DTDC).
- **FR-06 Stealth Admin & Customer Impersonation**: Secure session-based back-office supporting instant shopper impersonation for customer support without leaving footprints or banners on the storefront.

### 2.2 Non-Functional Requirements & Engineering SLOs

| Metric | Target SLA / SLO | Architecture Enabler |
|---|---|---|
| **Catalog Time-to-First-Byte (TTFB)** | `< 120 ms` globally | Next.js Edge CDN caching + Incremental Static Regeneration (ISR) |
| **P99 Cart & Checkout Latency** | `< 250 ms` | In-memory atomic mutations + connection-pooled PostgreSQL queries |
| **Financial Ledger Consistency** | `Strict Serializability (100%)` | ACID transactions, append-only ledger, atomic balance updates |
| **Double-Spend Prevention** | `Zero Tolerance (0 violations)` | Immediate upfront balance lock, DB constraints, optimistic locking |
| **Webhook Idempotency Window** | `7 Days` | Idempotency key tracking on `gatewayOrderId` & `gatewayPaymentId` |
| **Admin Route Secrecy** | `Zero Footprint` | Isolated bundle chunking, 0 DOM references, separate cookie auth |
| **Database RPO & RTO** | `RPO < 1 min, RTO < 5 min` | WAL streaming replication, automated point-in-time recovery (PITR) |

---

## 3. High-Level Architecture (C4 Model)

### 3.1 Level 1: System Context Diagram

```mermaid
C4Context
    title System Context Diagram - Zenin Streetwear Platform

    Person(shopper, "Streetwear Shopper", "Browses luxury apparel, customizes tees, checks out, tracks orders, manages wallet.")
    Person(affiliate, "Affiliate / Influencer", "Shares referral link/code, earns 10% instant commission, withdraws to UPI.")
    Person(admin, "Store Administrator", "Back-office manager handling POD queue, payouts, inventory, and gifting.")

    System(zenin_platform, "Zenin Streetwear Platform", "Next.js 14+ full-stack engine handling storefront, customizer, rewards, and back-office.")

    System_Ext(razorpay, "Razorpay Payment Gateway", "Processes UPI, Cards, NetBanking; sends payment webhooks.")
    System_Ext(qikink, "Qikink POD Provider", "DTG Apparel Printing & Packaging line via API/Webhooks.")
    System_Ext(couriers, "Courier Partners", "Delhivery, BlueDart, DTDC tracking and logistics APIs.")
    System_Ext(whatsapp, "WhatsApp / Meta Cloud API", "Direct support routing and automated transactional alerts.")

    Rel(shopper, zenin_platform, "Browses catalog, customizes tees, orders, tracks, withdraws coins", "HTTPS / WSS")
    Rel(affiliate, zenin_platform, "Tracks referral earnings, requests UPI payouts", "HTTPS")
    Rel(admin, zenin_platform, "Manages POD orders, executes batch UPI payouts, custom drops", "HTTPS / Admin Session")

    Rel(zenin_platform, razorpay, "Creates payment orders, verifies HMAC signatures", "REST API / HTTPS")
    Rel(razorpay, zenin_platform, "Delivers payment.captured webhooks", "HTTPS Webhook")
    Rel(zenin_platform, qikink, "Submits DTG print orders with artwork specs", "REST API")
    Rel(qikink, zenin_platform, "Fulfillment status webhooks", "HTTPS Webhook")
    Rel(zenin_platform, couriers, "Queries live AWB tracking info", "REST API")
    Rel(zenin_platform, whatsapp, "Dispatches support links & notifications", "HTTPS")
```

---

### 3.2 Level 2: Container Diagram

```mermaid
graph TD
    subgraph Client Tier
        BrowserShopper["Shopper Browser<br/>(Storefront, 2D Studio, Wallet Pill)"]
        BrowserAdmin["Admin Browser<br/>(Stealth Back-Office /admin)"]
    end

    subgraph Edge & CDN Layer
        Cloudflare["Cloudflare / Edge CDN<br/>- SSL Termination & DDoS Shield<br/>- Static Asset Caching<br/>- Edge Routing & WAF"]
    end

    subgraph Next.js Application Server [Next.js 16+ App Router Runtime]
        StorefrontUI["Storefront Presentation<br/>(React 19 Server & Client Components)"]
        AdminUI["Admin Presentation<br/>(Encapsulated /admin SPA)"]
        
        subgraph API Routes & Services Layer
            CatalogService["Catalog & Customizer Service"]
            CheckoutService["Cart & Checkout Engine"]
            PaymentService["Razorpay Payment Handler & Webhook Worker"]
            VestingEngine["Dual 4-Week Vesting Engine<br/>(Cashback & Withdrawal Schedulers)"]
            FulfillmentService["Order Fulfillment & Qikink POD Bridge"]
            AdminService["Admin Operations & Audit Dispatcher"]
        end

        StateBridge["Storage Abstraction Layer<br/>(src/lib/server/store.ts & db.ts)"]
    end

    subgraph Data & Persistence Tier
        Postgres[(PostgreSQL 16 Primary Database<br/>- Connection Pooling via pg.Pool<br/>- Full Relational Schema & Indices<br/>- JSONB State Mirror)]
        RedisCache[(Redis Distributed Cache / Lock<br/>- Distributed Mutex Locks<br/>- Rate Limiting & Fast KV)]
        CloudStorage[(S3 / Cloudflare R2<br/>- Custom Artwork Assets<br/>- DTG Print-Ready SVGs)]
    end

    subgraph External Systems
        ExtRazorpay["Razorpay Gateway"]
        ExtQikink["Qikink POD Service"]
        ExtCouriers["Courier Tracking APIs"]
    end

    BrowserShopper -->|HTTPS| Cloudflare
    BrowserAdmin -->|HTTPS| Cloudflare
    Cloudflare --> StorefrontUI
    Cloudflare --> AdminUI

    StorefrontUI --> CatalogService
    StorefrontUI --> CheckoutService
    AdminUI --> AdminService

    CheckoutService --> PaymentService
    CheckoutService --> VestingEngine
    PaymentService --> ExtRazorpay
    FulfillmentService --> ExtQikink
    FulfillmentService --> ExtCouriers

    CatalogService --> StateBridge
    CheckoutService --> StateBridge
    VestingEngine --> StateBridge
    FulfillmentService --> StateBridge
    AdminService --> StateBridge

    StateBridge --> Postgres
    StateBridge -.-> RedisCache
    CatalogService --> CloudStorage
```

---

### 3.3 Level 3: Component Architecture

```mermaid
graph LR
    subgraph Core Server Services [src/lib/server/services.ts]
        AuthModule["Auth & Session Manager<br/>- Customer Session<br/>- Admin Session<br/>- Impersonation Preview"]
        OrderModule["Order Processing<br/>- Quote Engine<br/>- Place Order<br/>- Cancel / Clawback"]
        VestingModule["Vesting & Rewards<br/>- 4-Week Cashback Split<br/>- 4-Week UPI Payout Sched<br/>- Auto-Unlock Worker"]
        PODModule["POD Fulfillment Bridge<br/>- Qikink DTG Sync<br/>- Tracking & Timeline"]
        AdminDeskModule["Admin Payout Desk<br/>- Batch UPI Pay<br/>- Rejection & Auto-Refund<br/>- Reopen Request"]
    end

    subgraph Persistence Layer
        DBDriver["PostgreSQL Pool Client<br/>(src/lib/server/db.ts)"]
        FileBackup[".data/zenin-state.json<br/>(Local Resilience Backup)"]
    end

    AuthModule --> OrderModule
    OrderModule --> VestingModule
    OrderModule --> PODModule
    VestingModule --> AdminDeskModule

    OrderModule --> DBDriver
    VestingModule --> DBDriver
    AdminDeskModule --> DBDriver
    DBDriver -.-> FileBackup
```

---

## 4. Domain Model & Database Schema

### 4.1 Complete Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    User ||--o{ Order : "places"
    User ||--o{ WalletTransaction : "owns"
    User ||--o{ Referral : "refers"
    User ||--o{ WithdrawalRequest : "requests"
    User ||--o{ AuditLog : "initiates"

    Order ||--|{ OrderItem : "contains"
    Order ||--|{ TimelineEvent : "logs"
    Order ||--o{ CashbackTranche : "schedules (4 parts)"
    Order ||--o{ WalletTransaction : "generates"
    Order }o--|| Product : "references"
    Order }o--|| CustomDesign : "customizes"

    WithdrawalRequest ||--|{ WithdrawalTranche : "splits into (4 parts)"
    WithdrawalRequest ||--o{ WalletTransaction : "settles via"

    Product ||--o{ OrderItem : "ordered as"
    CustomDesign ||--o{ OrderItem : "printed as"

    User {
        string id PK "usr-xxx"
        string name
        string email UK
        string phone
        enum role "CUSTOMER | ADMIN"
        string referralCode UK
        string referredByCode
        string tier "Silver | Gold | Obsidian"
        int availablePoints "Liquid spendable coins"
        int pendingPoints "Vesting coins"
        int lifetimeEarnedPoints
        jsonb addresses
        timestamptz createdAt
        timestamptz updatedAt
    }

    Product {
        string id PK "drop-xxx"
        string slug UK
        string title
        string category "T-SHIRTS | HOODIES | WINTER"
        float price "Selling price (INR)"
        float mrp "Strike-through price"
        int gsm "240 GSM heavy combed cotton"
        string fabric
        jsonb colors "Array of color swatches"
        string[] sizes "S, M, L, XL, 2XL"
        int stock
        boolean isArchived
        int cashbackPoints "Custom override or null (10%)"
        float rating
        timestamptz createdAt
    }

    CustomDesign {
        string id PK "cust-xxx"
        string shirtColor
        string side "front | back"
        string customText
        string fontFamily
        string artworkType "cyber_tokyo | demon_samurai"
        string artworkUrl
        float price "Fixed 899 INR"
        timestamptz createdAt
    }

    Order {
        string id PK "ord-xxx"
        string orderNumber UK "TC-XXXXX | GIFT-XXXXX"
        enum kind "SALE | GIFT | REPLACEMENT"
        string userId FK
        string customerName
        string customerEmail
        string customerPhone
        string address
        string pincode
        float subtotal
        float discount
        int pointsRedeemed
        float pointsRedeemedValue
        int pointsEarned "Total cashback points"
        float affiliateCommission
        string referrerCode
        float deliveryFee
        float total "Net INR payable"
        enum paymentMethod "UPI | CARD | NETBANKING | COD"
        enum paymentStatus "PENDING | PAID | REFUNDED"
        enum status "PENDING | APPROVED | PRINTING_POD | SHIPPED | DELIVERED | CANCELLED"
        enum courier "BlueDart | Delhivery | DTDC"
        string trackingNumber
        string podProvider "Qikink"
        string podOrderId
        string gatewayOrderId
        string gatewayPaymentId
        timestamptz placedAt
    }

    OrderItem {
        string id PK "item-xxx"
        string orderId FK
        string productId FK
        string customDesignId FK
        string title
        string color
        string size
        int quantity
        float price
    }

    TimelineEvent {
        string id PK "tml-xxx"
        string orderId FK
        string label "Order Placed | POD Printing | Shipped"
        string note
        timestamptz at
        int position
    }

    CashbackTranche {
        string id PK "cbt-xxx"
        string orderId FK
        int week "1 | 2 | 3 | 4"
        int percent "25"
        int points "1/4th of order points"
        float rupeeAmount
        timestamptz dueAt "Day 0, Day 7, Day 14, Day 21"
        enum status "LOCKED | RELEASED | VOID"
        timestamptz releasedAt
    }

    WithdrawalRequest {
        string id PK "wth-xxx"
        string userId FK
        string customerName
        string phone
        string upiId
        enum payoutMethod "UPI | BANK"
        string bankAccount
        string bankIfsc
        int totalPoints "Coins locked from balance"
        float totalRupees "Coins * 0.50"
        string purchaseOrder "Anchored Order Number"
        timestamptz anchorDate "Order PlacedAt Date"
        timestamptz requestedAt
        enum overallStatus "VESTING_IN_PROGRESS | COMPLETED | REJECTED"
        string rejectionReason
    }

    WithdrawalTranche {
        string id PK "wtr-xxx"
        string withdrawalId FK
        int week "1 | 2 | 3 | 4"
        int percent "25"
        int points
        float rupeeAmount
        timestamptz dueAt "Anchor + 7d, 14d, 21d, 28d"
        enum status "LOCKED | UNLOCKED | TRANSFERRED | VOID"
        timestamptz transferredAt
        string upiRef "Bank UTR or auto-ref"
    }

    WalletTransaction {
        string id PK "tx-xxx"
        string userId FK
        string orderId FK
        enum type "CASHBACK | REFERRAL_COMMISSION | REDEMPTION | REFUND | ADMIN_ADJUSTMENT"
        int points "Signed integer (+/-)"
        float rupeeValue
        string description
        enum status "PENDING | COMPLETED | REVERSED"
        timestamptz createdAt
    }

    Referral {
        string id PK "ref-xxx"
        string referrerId FK
        string refereeId FK
        string friendName
        string orderNumber
        float orderAmount
        float commissionRate "0.10"
        float commissionAmount
        enum status "PENDING | APPROVED | PAID"
        timestamptz createdAt
        timestamptz paidAt
    }

    AuditLog {
        string id PK "log-xxx"
        string userId FK
        string actor "Admin (email) | Customer (name)"
        string action "WITHDRAWAL_PAID | WITHDRAWAL_REJECTED | POD_DISPATCH"
        string details
        timestamptz at
    }
```

---

## 5. Core State Machines

### 5.1 E-Commerce & POD Fulfillment State Machine

```mermaid
stateDiagram-v2
    [*] --> PENDING: Shopper Places Order (Razorpay / COD)
    
    PENDING --> APPROVED: Payment Captured (Webhook) or COD Verified
    PENDING --> CANCELLED: Payment Failed / Expired

    APPROVED --> PRINTING_POD: Dispatched to Qikink DTG Production
    APPROVED --> CANCELLED: Customer / Admin Cancelled (Full Refund)

    PRINTING_POD --> SHIPPED: DTG Print Completed & AWB Assigned
    PRINTING_POD --> CANCELLED: DTG Fabric Out-of-Stock / Defect

    SHIPPED --> DELIVERED: Courier Webhook: Delivered to Customer
    SHIPPED --> CANCELLED: Return To Origin (RTO) / Lost in Transit

    DELIVERED --> [*]: Final Fulfillment State
    CANCELLED --> [*]: Void Tranches & Clawback Released Coins
```

---

### 5.2 4-Week Cashback Accrual Vesting Lifecycle

Cashback calculation rule: **Every ₹100 spent = 20 Zenin Points (₹10 value = 10% effective reward)**.

```mermaid
stateDiagram-v2
    [*] --> Scheduled: Order Paid (PlacedAt = T0)
    
    state Scheduled {
        Tranche1: Week 1 (25%) Due at T0 (Instant)
        Tranche2: Week 2 (25%) Due at T0 + 7 Days
        Tranche3: Week 3 (25%) Due at T0 + 14 Days
        Tranche4: Week 4 (25%) Due at T0 + 21 Days
    }

    Tranche1 --> Released_1: Immediate on Payment Capture
    Tranche2 --> Released_2: Time >= T0 + 7d (Auto-Release Worker)
    Tranche3 --> Released_3: Time >= T0 + 14d (Auto-Release Worker)
    Tranche4 --> Released_4: Time >= T0 + 21d (Auto-Release Worker)

    state "Order Cancelled / Refunded" as OrderCancelled
    Scheduled --> OrderCancelled: Order status -> CANCELLED
    OrderCancelled --> Voided: Any unreleased tranches -> VOID
    OrderCancelled --> Clawback: Any already-released points debited from wallet
```

---

### 5.3 4-Week Coin Payout / UPI Withdrawal Lifecycle

Withdrawals are governed by a strict financial security protocol where coins are **deducted upfront from the member's wallet** at the time the request is created.

```mermaid
stateDiagram-v2
    [*] --> VESTING_IN_PROGRESS: Member / Admin creates Payout Request
    note right of VESTING_IN_PROGRESS: Coins deducted upfront from Available Balance.\nAnchored to latest order date (T_order).

    state VESTING_IN_PROGRESS {
        Week1: Week 1 (25%) Due at T_order + 7d
        Week2: Week 2 (25%) Due at T_order + 14d
        Week3: Week 3 (25%) Due at T_order + 21d
        Week4: Week 4 (25%) Due at T_order + 28d

        Week1 --> Week1_Unlocked: Clock reaches T_order + 7d
        Week2 --> Week2_Unlocked: Clock reaches T_order + 14d
        Week3 --> Week3_Unlocked: Clock reaches T_order + 21d
        Week4 --> Week4_Unlocked: Clock reaches T_order + 28d
    }

    Week1_Unlocked --> Week1_Paid: Admin Marks Paid (Tranche status: TRANSFERRED)
    Week2_Unlocked --> Week2_Paid: Admin Marks Paid (Tranche status: TRANSFERRED)
    Week3_Unlocked --> Week3_Paid: Admin Marks Paid (Tranche status: TRANSFERRED)
    Week4_Unlocked --> Week4_Paid: Admin Marks Paid (Tranche status: TRANSFERRED)

    Week4_Paid --> COMPLETED: All 4 Tranches Transferred

    VESTING_IN_PROGRESS --> REJECTED: Admin Rejects Request
    note right of REJECTED: 1. Transferred slices remain PAID.<br/>2. Untransferred slices become VOID.<br/>3. Void coin value is AUTO-REFUNDED back to user's wallet.<br/>4. Status becomes REJECTED.

    REJECTED --> VESTING_IN_PROGRESS: Admin Reopens Request
    note right of VESTING_IN_PROGRESS: Coins re-debited from wallet (409 if insufficient balance).
```

---

## 6. Detailed Workflows & Sequence Diagrams

### 6.1 Checkout, Razorpay Payment & Webhook Idempotency

```mermaid
sequenceDiagram
    autonumber
    actor Shopper
    participant Storefront as Zenin Storefront (Next.js)
    participant API as Checkout Service
    participant Gateway as Razorpay API
    participant DB as PostgreSQL Primary
    participant POD as Qikink DTG Queue

    Shopper->>Storefront: Click "Pay & Place Order"
    Storefront->>API: POST /api/orders (items, coupon, pointsRedeemed, address)
    
    critical Atomic Validation & Lock
        API->>DB: Verify product stock & price
        API->>DB: Check customer balance >= pointsRedeemed
        API->>Gateway: Create Razorpay Order (amount = netTotal * 100)
        Gateway-->>API: Return razorpay_order_id
        API->>DB: Insert Order (status=PENDING, gatewayOrderId)
    end
    API-->>Storefront: Return { orderNumber, razorpayOrderId, keyId }

    Shopper->>Storefront: Complete payment in Razorpay Checkout modal
    Gateway-->>Shopper: Payment Successful
    
    par Async Webhook & Client Handshake
        Gateway->>API: POST /api/payments/webhook (event: payment.captured)
        critical Webhook Idempotency Check
            API->>DB: SELECT * FROM "Order" WHERE gatewayOrderId = $1 FOR UPDATE
            alt Already Processed
                API-->>Gateway: 200 OK (Idempotent Skip)
            else Processing First Time
                API->>API: Verify HMAC-SHA256 signature
                API->>DB: UPDATE "Order" SET status='APPROVED', paymentStatus='PAID'
                API->>DB: Deduct pointsRedeemed from User wallet
                API->>DB: Schedule 4 CashbackTranches (Release Tranche 1 immediately)
                API->>DB: Credit 10% instant affiliate commission to referrer
                API->>POD: Queue DTG print job with Qikink
                API-->>Gateway: 200 OK
            end
        end
    and Client Verification
        Storefront->>API: POST /api/payments/verify (orderId, paymentId, signature)
        API-->>Storefront: { success: true, orderNumber: "TC-92812" }
    end
```

---

### 6.2 4-Week Fractional Vesting Release Engine

```mermaid
sequenceDiagram
    autonumber
    participant Cron as Serverless Cron / Access Mutate
    participant VestingWorker as Vesting Engine (src/lib/vesting.ts)
    participant DB as PostgreSQL Primary
    participant Notify as Notification Service

    Note over Cron, DB: Triggered via /api/cron/unlock or on any state mutation read/write
    Cron->>VestingWorker: releaseDueCashback(state)
    
    VestingWorker->>DB: SELECT * FROM "CashbackTranche" WHERE status = 'LOCKED' AND dueAt <= NOW()
    
    loop Each Due Tranche
        VestingWorker->>DB: UPDATE "CashbackTranche" SET status = 'RELEASED', releasedAt = NOW()
        VestingWorker->>DB: UPDATE "User" SET availablePoints = availablePoints + tranche.points
        VestingWorker->>DB: INSERT INTO "WalletTransaction" (type='CASHBACK', status='COMPLETED')
        VestingWorker->>Notify: Create in-app notification: "Week N cashback unlocked!"
    end

    VestingWorker->>DB: SELECT * FROM "WithdrawalTranche" WHERE status = 'LOCKED' AND dueAt <= NOW()
    loop Each Due Payout Tranche
        VestingWorker->>DB: UPDATE "WithdrawalTranche" SET status = 'UNLOCKED'
    end
    VestingWorker-->>Cron: Success { unlockedCashbackCount, unlockedPayoutCount }
```

---

### 6.3 Payout Request, Parallel Execution & Rejection-Refund Protocol

```mermaid
sequenceDiagram
    autonumber
    actor Member
    participant Storefront as Wallet Modal (Storefront)
    actor Admin
    participant AdminDesk as Admin Payout Desk (/admin)
    participant Server as Payout Service
    participant DB as PostgreSQL Primary

    Member->>Storefront: Request Payout (e.g., 200 coins -> ₹100 to UPI user@oksbi)
    Storefront->>Server: POST /api/withdrawals (points: 200, upiId: "user@oksbi")
    
    critical Upfront Balance Locking (Allows Parallel Payouts)
        Server->>DB: SELECT availablePoints FROM "User" WHERE id = $1 FOR UPDATE
        alt availablePoints < 200
            Server-->>Storefront: 409 Conflict ("Only N coins are free right now")
        else Balance Sufficient
            Server->>DB: Deduct 200 coins from "User".availablePoints
            Server->>DB: INSERT INTO "WithdrawalRequest" (overallStatus='VESTING_IN_PROGRESS')
            Server->>DB: INSERT 4x "WithdrawalTranche" (25% each at Day 7, 14, 21, 28)
            Server->>DB: INSERT INTO "WalletTransaction" (type='ADMIN_ADJUSTMENT', status='COMPLETED')
        end
    end
    Server-->>Storefront: 201 Created (4-part schedule displayed to member)

    Note over AdminDesk: After Day 7, Week 1 Tranche unlocks automatically
    Admin->>AdminDesk: Mark Week 1 Paid (₹25, Ref: "UPI-91823912")
    AdminDesk->>Server: POST /api/admin/withdrawals/wth-123/pay { week: 1, upiRef: "..." }
    Server->>DB: UPDATE "WithdrawalTranche" SET status='TRANSFERRED', transferredAt=NOW()
    Server-->>AdminDesk: Tranche 1 Marked Paid

    Note over AdminDesk: Suppose Week 2 was fraudulent or member requested cancellation
    Admin->>AdminDesk: Click "Reject Payout" (reason: "Invalid UPI handle")
    AdminDesk->>Server: POST /api/admin/withdrawals/wth-123/reject { reason: "..." }
    
    critical Rejection & Auto-Refund Engine
        Server->>DB: Fetch all tranches for wth-123
        Note over Server: Tranche 1 (TRANSFERRED): Remains Paid (no clawback)
        Note over Server: Tranches 2, 3, 4 (UNLOCKED/LOCKED): Marked VOID (150 coins total)
        Server->>DB: UPDATE "WithdrawalRequest" SET overallStatus='REJECTED', rejectionReason=$1
        Server->>DB: UPDATE "User" SET availablePoints = availablePoints + 150
        Server->>DB: INSERT INTO "WalletTransaction" (type='REFUND', points=+150, "Refunded from wth-123")
        Server->>DB: INSERT INTO "AuditLog" (action='WITHDRAWAL_REJECTED')
    end
    Server-->>AdminDesk: 200 OK (₹25 kept paid, 150 coins refunded to member wallet)
```

---

### 6.4 Stealth Admin Portal & Zero-Footprint Customer Impersonation

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    participant AdminUI as Isolated Admin Portal (/admin)
    participant AuthAPI as Admin Auth Service
    participant StorefrontUI as Customer Storefront (New Tab)
    participant DB as PostgreSQL Primary

    Admin->>AdminUI: Login with credentials (admin / password)
    AdminUI->>AuthAPI: POST /api/admin/session
    AuthAPI-->>AdminUI: Set HTTP-Only Cookie `zenin_admin_session` (HMAC Signed)
    
    Admin->>AdminUI: Open Members Tab -> Click "Sign in as this member" (usr-aman-01)
    AdminUI->>AuthAPI: POST /api/admin/members/usr-aman-01/session
    
    critical Impersonation Cookie Jar Isolation
        AuthAPI->>DB: Verify Admin Session exists & is valid
        AuthAPI->>DB: Log Audit Entry: ADMIN_MEMBER_PREVIEW (actor=admin, target=usr-aman-01)
        AuthAPI-->>AdminUI: Set HTTP-Only Cookie `zenin_customer_session` for usr-aman-01
    end
    
    AdminUI->>StorefrontUI: Launches Storefront in new tab
    Note over StorefrontUI: Storefront renders Aman's exact live wallet, vesting tranches, & orders.
    Note over StorefrontUI: STRICT ZERO-FOOTPRINT RULE: No admin banner, no debug tools, 0 admin hints.
    
    Admin->>AdminUI: Click "End Preview"
    AdminUI->>AuthAPI: DELETE /api/admin/members/usr-aman-01/session
    AuthAPI->>DB: Log Audit Entry: ADMIN_MEMBER_PREVIEW_END
    AuthAPI-->>AdminUI: Clear `zenin_customer_session` cookie
```

---

## 7. Financial Safety, Concurrency & Invariants

### 7.1 Double-Spend Prevention & Parallel Payout Aperture

A critical engineering vulnerability in rewards platforms is the **double-spend attack**, where a user requests multiple concurrent withdrawals before previous requests complete their vesting cycles.

**Zenin's Architectural Solution:**
1. **Immediate Upfront Balance Deduction**: The moment `submitWithdrawal` or `adminRaiseWithdrawal` is executed, the entire requested coin amount is atomically subtracted from `User.availablePoints`.
2. **Independent Vesting Envelopes**: Because coins are already removed from the liquid balance, multiple payouts can run **in parallel** side-by-side without competing for the same pool of coins.
3. **Pessimistic Row-Level Locking**: In PostgreSQL, all wallet mutations run within transactions using `SELECT ... FOR UPDATE` on the `User` row:
   ```sql
   BEGIN;
   SELECT "availablePoints" FROM "User" WHERE "id" = $1 FOR UPDATE;
   -- Validate availablePoints >= requestedPoints
   UPDATE "User" SET "availablePoints" = "availablePoints" - $2 WHERE "id" = $1;
   INSERT INTO "WithdrawalRequest" (...);
   COMMIT;
   ```

### 7.2 Ledger Immutability & Double-Entry Accounting

- The `WalletTransaction` table is **append-only**. Rows are never modified or deleted.
- If a withdrawal is cancelled or rejected, a corresponding `REFUND` transaction row is appended.
- If an order is cancelled, a `REVERSED` transaction row is appended.
- Mathematical Invariant:
  $$\text{User.availablePoints} = \sum \text{Earned Points} - \sum \text{Redeemed Points} - \sum \text{Locked In Payouts} + \sum \text{Refunded Points}$$

### 7.3 Order Cancellation & Clawback Guarantees

When an order status changes to `CANCELLED`:
1. **Unreleased Cashback Tranches** (`status = 'LOCKED'`) are immediately set to `VOID`.
2. **Released Cashback Tranches** (`status = 'RELEASED'`) represent coins already credited to the user's wallet:
   - The engine issues a debit `ADMIN_ADJUSTMENT` ledger entry clawing back those points.
   - If the user's balance drops below zero, the wallet balance reflects the deficit and recovers on subsequent purchases.
3. **Affiliate Referral Commissions**:
   - The referrer's commission status transitions from `PAID` to `REVERSED`.
   - A reversal entry is written to the referrer's ledger, deducting the commission points.

---

## 8. Performance, Caching & Scalability Strategy

```mermaid
graph TD
    subgraph Traffic Layers
        DNS[Anycast DNS] --> CDN[Cloudflare Edge Cache]
    end

    subgraph CDN Edge Rules
        CDN -->|Static Assets /_next/static/*| EdgeStatic[Edge Cache - 365 Days]
        CDN -->|Catalog Pages / ISR| EdgeISR[Stale-While-Revalidate - 60s]
        CDN -->|Dynamic APIs /api/*| AppOrigin[Next.js App Server Origin]
    end

    subgraph App Server Optimization
        AppOrigin --> NextCache[Next.js Data Cache / React Cache]
        AppOrigin --> RedisStore[Redis Layer<br/>- User Sessions<br/>- Rate Limiting<br/>- Mutex Locks]
        AppOrigin --> PGPool[pg.Pool Connection Pooler<br/>Max Connections: 20<br/>Idle Timeout: 30s]
    end

    subgraph Database Architecture
        PGPool --> PGPrimary[(PostgreSQL Primary - Writes)]
        PGPool -.-> PGReplica[(PostgreSQL Read Replica - Heavy Queries)]
        PGPrimary -->|Streaming Replication| PGReplica
    end
```

### 8.1 Caching Tiers
1. **Edge CDN Layer**: All images, fonts, static JS bundles, and pre-rendered catalog product pages (`/products/[slug]`) are cached globally at the edge with `stale-while-revalidate=86400`.
2. **Next.js Route Cache**: Category navigation and support snapshots are cached in-memory and revalidated on demand when an administrator publishes a new drop or updates support numbers.
3. **Database Connection Pool**: Managed via `pg.Pool` with connection reuse, preventing TCP handshake overhead and protecting PostgreSQL from connection exhaustion during high-concurrency drop events.

---

## 9. Security, Authentication & Threat Modeling

### 9.1 Zero-Footprint Stealth Admin Architecture
- **No Public Trace**: The `/admin` portal contains 0 navigational links, buttons, meta headers, or references on the public storefront.
- **Route Protection**: All administrative endpoints (`/api/admin/*`) strictly validate the presence and cryptographic signature of the `zenin_admin_session` cookie via `readAdminSession()`.
- **Payload Verification**: Rejections, status changes, and payout marks validate role permissions before executing any DB mutations.

### 9.2 Input Sanitization & Validation Matrix

| Input Field | Validation Regex / Rule | Defense Mechanism |
|---|---|---|
| **Indian Mobile** | `/^(\+91[\s-]?)?[6-9]\d{9}$/` | Rejects malformed numbers; standardizes to 10 digits |
| **Indian Pincode** | `/^[1-9]\d{5}$/` | Validates postal code format |
| **UPI ID** | `/^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/` | Prevents injection; ensures valid VPA routing |
| **Rejection Reason** | `string.trim().slice(0, 160)` | Prevents XSS, buffer overflows, and log pollution |
| **Razorpay Webhook** | `HMAC-SHA256(rawBody, secret)` | Rejects unauthorized webhook tampering |

---

## 10. Observability, Alerting & Reliability

### 10.1 Structured Logging & Audit Trails
Every sensitive business mutation emits an immutable audit event recorded in the `AuditLog` table and standard output in JSON format:
- `ORDER_CREATED`, `ORDER_STATUS_CHANGED`, `POD_DISPATCHED`
- `WITHDRAWAL_REQUESTED`, `WITHDRAWAL_PAID`, `WITHDRAWAL_REJECTED`, `WITHDRAWAL_REOPENED`
- `ADMIN_MEMBER_PREVIEW`, `ADMIN_MEMBER_PREVIEW_END`, `SUPPORT_UPDATED`

### 10.2 Health Checks & Liveness Probes
- `GET /api/health`: Validates database connectivity, pool health, and state consistency.
- Automated Alerting: Dispatches alert webhooks to Discord/Slack if:
  - Webhook verification fails > 3 times in 10 minutes.
  - Payout processing encounters a 5xx server error.
  - Database pool waiting queue exceeds 5 requests.

---

## 11. Infrastructure, CI/CD & Deployment Topology

```mermaid
graph LR
    subgraph Development & CI/CD
        GitRepo[GitHub Repository] -->|Push to main| GHActions[GitHub Actions CI/CD]
        GHActions -->|Run Typecheck & Lint| TestJob[tsc --noEmit && eslint]
        GHActions -->|Run DB Migration| MigJob[prisma db push / migrate]
        GHActions -->|Build Production Bundle| BuildJob[next build]
    end

    subgraph Production Hosting Environment
        BuildJob --> DeployVercel[Vercel / AWS ECS Container Fleet]
        DeployVercel --> CloudflareEdge[Cloudflare CDN & WAF]
        DeployVercel --> PostgresManaged[(Prisma Postgres / AWS RDS Multi-AZ)]
        DeployVercel --> S3Assets[(AWS S3 / Cloudflare R2 Media Bucket)]
    end
```

### Summary of Architecture Benefits
1. **Guaranteed Financial Integrity**: Immediate upfront balance locking ensures parallel payouts execute cleanly with zero double-spend risk.
2. **Modular Micro-Layering**: Clear separation of concerns between Storefront UI, POD Fulfillment, Rewards/Vesting Engine, and Stealth Admin operations.
3. **Enterprise Resiliency**: Hybrid data layer (PostgreSQL primary with automatic JSON state snapshot fallback) provides 100% development continuity and zero-downtime production deployment.
4. **Frictionless Scalability**: Ready for high-volume streetwear drops with CDN edge caching, connection pooling, and asynchronous background worker queues.
