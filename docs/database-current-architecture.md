# SKYWEAR / ZENIN — Phase 1: Current Database Architecture

**Document Version:** 1.0  
**Scope:** Existing As-Is Architecture Documentation  

---

## 1. System Overview & The Dual-Storage Model

The current architecture is a **Hybrid Dual-Store Monolith**:

```mermaid
flowchart TD
    subgraph ClientLayer ["Client Applications"]
        Browser["Next.js Storefront / PWA"]
        AdminUI["Admin Dashboard (/admin)"]
        Worker["Paytm Monitor Worker (Playwright)"]
    end

    subgraph AppServer ["Next.js 16 Application Server (Turbopack)"]
        Routes["62 API Routes (src/app/api/*)"]
        Services["Mega Service Layer (src/lib/server/services.ts - 3,329 lines)"]
        Store["Store Orchestrator (src/lib/server/store.ts)"]
        MemoryState["In-Memory Cache (ZeninState Object)"]
    end

    subgraph PersistenceLayers ["Data Persistence Tiers"]
        DiskFile[".data/zenin-state.json (Local Disk)"]
        RedisCache["Redis (ioredis - 300s TTL)"]
        NeonAppState["PostgreSQL AppState Table (JSONB Blob)"]
        NeonRelational["PostgreSQL Relational Tables (16 Models via raw pg)"]
    end

    Browser -->|HTTP/REST| Routes
    AdminUI -->|Session Auth| Routes
    Worker -->|HMAC Signed POST| Routes
    Routes --> Services
    Services --> Store
    Store <--> MemoryState
    Store -->|File Write| DiskFile
    Store -->|Cache Put| RedisCache
    Store -->|SQL UPDATE| NeonAppState
    Services -.->|Secondary Raw SQL| NeonRelational
```

---

## 2. As-Is Data Flow & Split-Brain Mechanism

Every state mutation in the current system flows through `src/lib/server/store.ts`:

1. **State Load:**
   - Attempt to read in-memory `zeninState`.
   - If stale or absent, query Redis cache.
   - If absent in Redis, query `AppState` table (`SELECT data FROM "AppState" WHERE key = 'zenin_state'`).
   - If Postgres fails, fallback to local disk `.data/zenin-state.json`.

2. **State Mutation:**
   - Functions in `src/lib/server/services.ts` mutate the JS object directly.
   - `mutate(updater)` increments `revision` integer.
   - Asynchronously triggers:
     - File write to `.data/zenin-state.json`.
     - Redis set with 300s TTL.
     - PostgreSQL update: `UPDATE "AppState" SET data = $1, "updatedAt" = NOW() WHERE key = 'zenin_state'`.

3. **Relational Synchronization (The Disconnect):**
   - Certain operations (like order placement or customer signup) attempt a secondary raw SQL `INSERT` into relational tables (`User`, `Order`, `OrderItem`).
   - If the relational query fails or is omitted (e.g. manual admin edits, state reconciliation scripts), the JSON blob changes while the relational table remains unchanged.
   - **Result:** Relational tables have 31 orders, while JSON state has only 13 orders. Relational tables have 33 products, while JSON state has 27 products.

---

## 3. Current Entity Relationship Diagram (As-Is Prisma Schema)

```mermaid
erDiagram
    User ||--o{ Order : "places"
    User ||--o{ WalletTransaction : "owns"
    User ||--o{ WithdrawalRequest : "requests"
    User ||--o{ Referral : "refers (as referrer)"
    User ||--o{ Referral : "referred (as referee)"
    User ||--o{ AuditLog : "triggers"

    Order ||--|{ OrderItem : "contains"
    Order ||--o{ TimelineEvent : "tracks"
    Order ||--o{ CashbackTranche : "unlocks"
    Order ||--o{ WalletTransaction : "generates"

    Product ||--o{ OrderItem : "ordered_in"
    CustomDesign ||--o{ OrderItem : "custom_design"

    WithdrawalRequest ||--o{ WithdrawalTranche : "scheduled_in"

    AppState {
        string key PK
        jsonb data
        timestamp updatedAt
    }

    User {
        string id PK
        string name
        string email UK
        string phone
        string role
        int availablePoints
        int pendingPoints
        int lifetimeEarnedPoints
        jsonb addresses
    }

    Order {
        string id PK
        string orderNumber UK
        string userId FK
        float total
        float subtotal
        float discount
        string status
        string paymentStatus
        string paymentMethod
    }

    OrderItem {
        string id PK
        string orderId FK
        string productId FK
        int quantity
        float unitPrice
        string size
        string color
    }

    WalletTransaction {
        string id PK
        string userId FK
        string orderId FK
        int points
        float rupeeValue
        string type
        string status
    }
```

---

## 4. Current Service & API Architecture

The application backend comprises:
- **62 Route Handlers** in `src/app/api/`:
  - 24 Admin routes (`/api/admin/*`) protected by `readAdminSession()`.
  - 6 Auth routes (`/api/auth/*`) handling OTP and password logic.
  - 7 Payment routes supporting Razorpay, OwnPay, and Manual UPI with QR codes.
  - 4 Wallet & Withdrawal routes (`/api/wallet/*`, `/api/withdrawals`).
  - 6 Push notification & preview routes.
  - 5 Webhook, cron, and reconciliation routes.
- **Monolithic Service Layer:**
  - `src/lib/server/services.ts` contains **3,329 lines** covering all domains in a single file without domain boundary encapsulation.
- **Database Driver:**
  - Raw `pg` Connection Pool with automatic failover between pooled and direct connection strings.
  - Prisma client `@prisma/client` is imported in `package.json` but not used for business logic queries.

