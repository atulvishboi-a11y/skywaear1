# Neon PostgreSQL Database Manager (Prisma Studio)

This document explains the setup and operation of **Prisma Studio** as a local web-based database management interface (similar to phpMyAdmin) connected directly to the live Neon PostgreSQL database.

---

## 1. Architecture Overview

- **Database Engine:** Neon PostgreSQL (AWS US-East-2 Cloud)
- **Local Manager UI:** Prisma Studio (`http://localhost:5000`)
- **Isolation Principle:** Application runtime traffic and database management traffic are decoupled using dedicated connection strings.

```
                      ┌────────────────────────────────────────┐
                      │    Neon PostgreSQL Database (Cloud)    │
                      └──────────────────┬─────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                                               │
      (Connection Pooling)                             (Direct Connection)
       DATABASE_URL                                     STUDIO_DATABASE_URL
                 │                                               │
                 ▼                                               ▼
┌─────────────────────────────────┐             ┌─────────────────────────────────┐
│     Next.js Application         │             │      Prisma Studio UI           │
│  (Storefront, Admin, API)       │             │   (http://localhost:5000)       │
└─────────────────────────────────┘             └─────────────────────────────────┘
```

---

## 2. Environment Variables Configuration

Both connections are defined in `.env`:

1. **`DATABASE_URL` (Application Connection):**
   - Uses Neon's pooled endpoint (`-pooler`).
   - Serves high-concurrency API and web requests.
   - Remains completely unchanged to ensure zero impact on production runtime.

2. **`STUDIO_DATABASE_URL` (Direct Studio Connection):**
   - Uses Neon's direct endpoint (without `-pooler`).
   - Connects directly with `sslmode=require`.
   - Used exclusively by Prisma Studio.

---

## 3. Dedicated Studio Schema

To prevent conflicting with runtime connection parameters, Prisma Studio uses a dedicated schema file:
- **Path:** [`prisma/studio.prisma`](file:///c:/Users/vishw/OneDrive/Desktop/tshirt/prisma/studio.prisma)
- **Datasource definition:**
  ```prisma
  datasource db {
    provider = "postgresql"
    url      = env("STUDIO_DATABASE_URL")
  }
  ```

---

## 4. How to Launch and Stop Prisma Studio

### Startup

Run the npm script:
```bash
npm run db:studio
```
Or run the exact Windows PowerShell command:
```powershell
npx prisma@6 studio --schema=./prisma/studio.prisma --port 5000
```

### Accessing the Web Interface

Open your browser and navigate to:
👉 **[http://localhost:5000](http://localhost:5000)**

### Stopping Prisma Studio

- If running in terminal: Press `Ctrl + C`.
- If running as a background service:
  ```powershell
  Get-Process node | Where-Object { $_.MainWindowTitle -like "*studio*" } | Stop-Process
  ```

---

## 5. Safety and Security Rules

- **Zero Secrets in Git:** `.env` is ignored by `.gitignore`.
- **Localhost Only:** Prisma Studio binds exclusively to `localhost:5000` and is not exposed to the public internet.
- **Audit History:** Automated snapshots and record diffs are tracked in `database_backups/audit_history.json`.
- **Never Run Destructive Commands:**
  - `npx prisma migrate reset` (PROHIBITED on production)
  - `npx prisma db push --force-reset` (PROHIBITED on production)

