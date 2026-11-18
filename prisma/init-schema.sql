-- PostgreSQL Schema Initialization for Threadcraft / Zenin Storefront
-- Corresponds to prisma/schema.prisma

-- Create Enums if they do not exist
DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'APPROVED', 'PRINTING_POD', 'SHIPPED', 'DELIVERED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "OrderKind" AS ENUM ('SALE', 'GIFT', 'REPLACEMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentMethod" AS ENUM ('UPI', 'CARD', 'NETBANKING', 'COD', 'COMPLIMENTARY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "Courier" AS ENUM ('BlueDart', 'Delhivery', 'DTDC', 'EcomExpress');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TransactionType" AS ENUM ('CASHBACK', 'REFERRAL_COMMISSION', 'REDEMPTION', 'REFUND', 'ADMIN_ADJUSTMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'REVERSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TrancheStatus" AS ENUM ('LOCKED', 'UNLOCKED', 'TRANSFERRED', 'VOID');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CashbackTrancheStatus" AS ENUM ('LOCKED', 'RELEASED', 'VOID');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "WithdrawalStatus" AS ENUM (
    'VESTING_IN_PROGRESS',
    'COMPLETED',
    'REJECTED',
    'PROCESSING',
    'SUBMITTED_TO_BANK',
    'PAID',
    'FAILED',
    'REVERSED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PayoutMethod" AS ENUM ('UPI', 'BANK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. User table
CREATE TABLE IF NOT EXISTS "User" (
  "id" VARCHAR(128) PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT UNIQUE NOT NULL,
  "phone" TEXT,
  "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
  "referralCode" TEXT UNIQUE NOT NULL,
  "referredByCode" TEXT,
  "tier" TEXT NOT NULL DEFAULT 'Silver',
  "availableCoins" INTEGER NOT NULL DEFAULT 0,
  "pendingCoins" INTEGER NOT NULL DEFAULT 0,
  "lifetimeEarnedCoins" INTEGER NOT NULL DEFAULT 0,
  "referralCoinBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "addresses" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Product table
CREATE TABLE IF NOT EXISTS "Product" (
  "id" VARCHAR(128) PRIMARY KEY,
  "slug" TEXT UNIQUE NOT NULL,
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "mrp" DOUBLE PRECISION NOT NULL,
  "gsm" INTEGER NOT NULL DEFAULT 240,
  "fabric" TEXT NOT NULL DEFAULT '100% Super-Combed Bio-Washed Cotton',
  "badge" TEXT,
  "graphicTitle" TEXT,
  "graphicType" TEXT NOT NULL DEFAULT 'cyber_tokyo',
  "accentColor" TEXT NOT NULL DEFAULT '#fbbf24',
  "colors" JSONB NOT NULL DEFAULT '[]',
  "sizes" TEXT[] NOT NULL DEFAULT '{}',
  "images" TEXT[] NOT NULL DEFAULT '{}',
  "stock" INTEGER NOT NULL DEFAULT 60,
  "isArchived" BOOLEAN NOT NULL DEFAULT FALSE,
  "cashbackPoints" INTEGER,
  "codAvailable" BOOLEAN NOT NULL DEFAULT TRUE,
  "rating" DOUBLE PRECISION NOT NULL DEFAULT 4.9,
  "reviewCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_product_cat_archived" ON "Product" ("category", "isArchived");

-- 3. CustomDesign table
CREATE TABLE IF NOT EXISTS "CustomDesign" (
  "id" VARCHAR(128) PRIMARY KEY,
  "shirtColor" TEXT NOT NULL,
  "shirtHex" TEXT NOT NULL,
  "side" TEXT NOT NULL DEFAULT 'front',
  "customText" TEXT,
  "fontFamily" TEXT,
  "textColor" TEXT,
  "textSize" INTEGER NOT NULL DEFAULT 32,
  "textOffsetX" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "textOffsetY" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "artworkType" TEXT,
  "artworkUrl" TEXT,
  "price" DOUBLE PRECISION NOT NULL DEFAULT 899,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Order table
CREATE TABLE IF NOT EXISTS "Order" (
  "id" VARCHAR(128) PRIMARY KEY,
  "orderNumber" TEXT UNIQUE NOT NULL,
  "kind" "OrderKind" NOT NULL DEFAULT 'SALE',
  "userId" VARCHAR(128) REFERENCES "User"("id") ON DELETE SET NULL,
  "customerName" TEXT NOT NULL,
  "customerEmail" TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "pincode" TEXT NOT NULL,
  "subtotal" DOUBLE PRECISION NOT NULL,
  "couponCode" TEXT,
  "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "legacyCoinsRedeemed" INTEGER NOT NULL DEFAULT 0,
  "legacyInrRedeemed" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "cashbackCoins" INTEGER NOT NULL DEFAULT 0,
  "referralCoinsEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "referrerCode" TEXT,
  "deliveryFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "total" DOUBLE PRECISION NOT NULL,
  "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'UPI',
  "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
  "courier" "Courier",
  "trackingNumber" TEXT,
  "trackingUrl" TEXT,
  "podProvider" TEXT NOT NULL DEFAULT 'Qikink',
  "podOrderId" TEXT,
  "podStatus" TEXT,
  "giftReason" TEXT,
  "gateway" TEXT,
  "gatewayOrderId" TEXT,
  "gatewayPaymentId" TEXT,
  "placedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_order_status_placed" ON "Order" ("status", "placedAt");
CREATE INDEX IF NOT EXISTS "idx_order_email" ON "Order" ("customerEmail");

-- 5. OrderItem table
CREATE TABLE IF NOT EXISTS "OrderItem" (
  "id" VARCHAR(128) PRIMARY KEY,
  "orderId" VARCHAR(128) NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE,
  "productId" VARCHAR(128) REFERENCES "Product"("id") ON DELETE SET NULL,
  "customDesignId" VARCHAR(128) REFERENCES "CustomDesign"("id") ON DELETE SET NULL,
  "title" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "size" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "price" DOUBLE PRECISION NOT NULL,
  "previewImage" TEXT,
  "graphicType" TEXT,
  "customText" TEXT
);
CREATE INDEX IF NOT EXISTS "idx_orderitem_order" ON "OrderItem" ("orderId");

-- 6. TimelineEvent table
CREATE TABLE IF NOT EXISTS "TimelineEvent" (
  "id" VARCHAR(128) PRIMARY KEY,
  "orderId" VARCHAR(128) NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE,
  "label" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "position" INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "idx_timeline_order_pos" ON "TimelineEvent" ("orderId", "position");

-- 7. WalletTransaction table
CREATE TABLE IF NOT EXISTS "WalletTransaction" (
  "id" VARCHAR(128) PRIMARY KEY,
  "userId" VARCHAR(128) REFERENCES "User"("id") ON DELETE CASCADE,
  "orderId" VARCHAR(128) REFERENCES "Order"("id") ON DELETE SET NULL,
  "orderNumber" TEXT,
  "type" "TransactionType" NOT NULL,
  "coins" INTEGER NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'COINS',
  "idempotencyKey" TEXT UNIQUE,
  "legacyInrValue" DOUBLE PRECISION,
  "description" TEXT NOT NULL,
  "status" "TransactionStatus" NOT NULL DEFAULT 'COMPLETED',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_tx_user_created" ON "WalletTransaction" ("userId", "createdAt");

-- 8. Referral table
CREATE TABLE IF NOT EXISTS "Referral" (
  "id" VARCHAR(128) PRIMARY KEY,
  "referrerId" VARCHAR(128) NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "refereeId" VARCHAR(128) REFERENCES "User"("id") ON DELETE SET NULL,
  "friendName" TEXT NOT NULL,
  "friendEmail" TEXT NOT NULL,
  "orderNumber" TEXT,
  "orderAmountInr" DOUBLE PRECISION,
  "commissionCoins" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "creditedAt" TIMESTAMPTZ,
  "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "paidAt" TIMESTAMPTZ
);

-- 9. WithdrawalRequest table
CREATE TABLE IF NOT EXISTS "WithdrawalRequest" (
  "id" VARCHAR(128) PRIMARY KEY,
  "userId" VARCHAR(128) NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "customerName" TEXT NOT NULL,
  "phone" TEXT,
  "upiId" TEXT NOT NULL,
  "payoutMethod" "PayoutMethod" NOT NULL DEFAULT 'UPI',
  "bankAccount" TEXT,
  "bankIfsc" TEXT,
  "totalCoins" INTEGER NOT NULL,
  "legacyInrTotal" DOUBLE PRECISION,
  "purchaseOrder" TEXT,
  "anchorDate" TIMESTAMPTZ NOT NULL,
  "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "overallStatus" "WithdrawalStatus" NOT NULL DEFAULT 'VESTING_IN_PROGRESS',
  "rejectionReason" TEXT
);
CREATE INDEX IF NOT EXISTS "idx_withdrawal_user_status" ON "WithdrawalRequest" ("userId", "overallStatus");

-- 10. WithdrawalTranche table
CREATE TABLE IF NOT EXISTS "WithdrawalTranche" (
  "id" VARCHAR(128) PRIMARY KEY,
  "withdrawalId" VARCHAR(128) NOT NULL REFERENCES "WithdrawalRequest"("id") ON DELETE CASCADE,
  "week" INTEGER NOT NULL,
  "percent" INTEGER NOT NULL DEFAULT 25,
  "coins" INTEGER NOT NULL,
  "legacyInrAmount" DOUBLE PRECISION,
  "dueAt" TIMESTAMPTZ NOT NULL,
  "status" "TrancheStatus" NOT NULL DEFAULT 'LOCKED',
  "transferredAt" TIMESTAMPTZ,
  "upiRef" TEXT,
  CONSTRAINT "uq_withdrawal_week" UNIQUE ("withdrawalId", "week")
);

-- 11. CashbackTranche table
CREATE TABLE IF NOT EXISTS "CashbackTranche" (
  "id" VARCHAR(128) PRIMARY KEY,
  "orderId" VARCHAR(128) NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE,
  "week" INTEGER NOT NULL,
  "percent" INTEGER NOT NULL DEFAULT 25,
  "coins" INTEGER NOT NULL,
  "legacyInrAmount" DOUBLE PRECISION,
  "dueAt" TIMESTAMPTZ NOT NULL,
  "status" "CashbackTrancheStatus" NOT NULL DEFAULT 'LOCKED',
  "releasedAt" TIMESTAMPTZ,
  CONSTRAINT "uq_cashback_order_week" UNIQUE ("orderId", "week")
);

-- 12. RewardRule table
CREATE TABLE IF NOT EXISTS "RewardRule" (
  "id" VARCHAR(128) PRIMARY KEY,
  "name" TEXT NOT NULL DEFAULT 'Standard Coin Programme',
  "dailyClaimPercent" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
  "minWithdrawalCoins" INTEGER NOT NULL DEFAULT 500,
  "referralCommissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. AuditLog table
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" VARCHAR(128) PRIMARY KEY,
  "userId" VARCHAR(128) REFERENCES "User"("id") ON DELETE SET NULL,
  "actor" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "resource" TEXT,
  "details" TEXT NOT NULL,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_audit_created" ON "AuditLog" ("createdAt");

-- 14. AppState persistence & synchronization table
CREATE TABLE IF NOT EXISTS "AppState" (
  "key" VARCHAR(64) PRIMARY KEY,
  "data" JSONB NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
