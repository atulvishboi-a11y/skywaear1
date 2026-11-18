-- Coin/INR separation migration (Postgres).
-- Run once against the Prisma database before deploying the unit-safe schema.
-- Every step is idempotent and renames in place so no coin or order data is lost.

DO $$
BEGIN
  -- User balances: points -> coins; referral balance kept separate
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'availablePoints') THEN
    ALTER TABLE "User" RENAME COLUMN "availablePoints" TO "availableCoins";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'pendingPoints') THEN
    ALTER TABLE "User" RENAME COLUMN "pendingPoints" TO "pendingCoins";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'lifetimeEarnedPoints') THEN
    ALTER TABLE "User" RENAME COLUMN "lifetimeEarnedPoints" TO "lifetimeEarnedCoins";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'referralCoinBalance') THEN
    ALTER TABLE "User" ADD COLUMN "referralCoinBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;
  END IF;

  -- WalletTransaction: points/rupeeValue -> coins/legacyInrValue + unit + idempotencyKey
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'WalletTransaction' AND column_name = 'points') THEN
    ALTER TABLE "WalletTransaction" RENAME COLUMN "points" TO "coins";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'WalletTransaction' AND column_name = 'rupeeValue') THEN
    ALTER TABLE "WalletTransaction" RENAME COLUMN "rupeeValue" TO "legacyInrValue";
    ALTER TABLE "WalletTransaction" ALTER COLUMN "legacyInrValue" DROP NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'WalletTransaction' AND column_name = 'unit') THEN
    ALTER TABLE "WalletTransaction" ADD COLUMN "unit" TEXT NOT NULL DEFAULT 'COINS';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'WalletTransaction' AND column_name = 'idempotencyKey') THEN
    ALTER TABLE "WalletTransaction" ADD COLUMN "idempotencyKey" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'WalletTransaction' AND indexname = 'WalletTransaction_idempotencyKey_key') THEN
    CREATE UNIQUE INDEX "WalletTransaction_idempotencyKey_key" ON "WalletTransaction" ("idempotencyKey");
  END IF;

  -- Referral: orderAmount/commissionAmount -> orderAmountInr/commissionCoins
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Referral' AND column_name = 'orderAmount') THEN
    ALTER TABLE "Referral" RENAME COLUMN "orderAmount" TO "orderAmountInr";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Referral' AND column_name = 'commissionAmount') THEN
    ALTER TABLE "Referral" RENAME COLUMN "commissionAmount" TO "commissionCoins";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Referral' AND column_name = 'creditedAt') THEN
    ALTER TABLE "Referral" ADD COLUMN "creditedAt" TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'Referral' AND indexname = 'Referral_referrerId_orderNumber_key') THEN
    CREATE UNIQUE INDEX "Referral_referrerId_orderNumber_key" ON "Referral" ("referrerId", "orderNumber");
  END IF;

  -- Order: coin fields
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Order' AND column_name = 'pointsEarned') THEN
    ALTER TABLE "Order" RENAME COLUMN "pointsEarned" TO "cashbackCoins";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Order' AND column_name = 'pointsRedeemed') THEN
    ALTER TABLE "Order" RENAME COLUMN "pointsRedeemed" TO "legacyCoinsRedeemed";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Order' AND column_name = 'pointsRedeemedValue') THEN
    ALTER TABLE "Order" RENAME COLUMN "pointsRedeemedValue" TO "legacyInrRedeemed";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Order' AND column_name = 'affiliateCommission') THEN
    ALTER TABLE "Order" RENAME COLUMN "affiliateCommission" TO "referralCoinsEarned";
  END IF;

  -- Withdrawals: coins only
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'WithdrawalRequest' AND column_name = 'totalPoints') THEN
    ALTER TABLE "WithdrawalRequest" RENAME COLUMN "totalPoints" TO "totalCoins";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'WithdrawalRequest' AND column_name = 'totalRupees') THEN
    ALTER TABLE "WithdrawalRequest" RENAME COLUMN "totalRupees" TO "legacyInrTotal";
    ALTER TABLE "WithdrawalRequest" ALTER COLUMN "legacyInrTotal" DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'WithdrawalTranche' AND column_name = 'points') THEN
    ALTER TABLE "WithdrawalTranche" RENAME COLUMN "points" TO "coins";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'WithdrawalTranche' AND column_name = 'rupeeAmount') THEN
    ALTER TABLE "WithdrawalTranche" RENAME COLUMN "rupeeAmount" TO "legacyInrAmount";
    ALTER TABLE "WithdrawalTranche" ALTER COLUMN "legacyInrAmount" DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'CashbackTranche' AND column_name = 'points') THEN
    ALTER TABLE "CashbackTranche" RENAME COLUMN "points" TO "coins";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'CashbackTranche' AND column_name = 'rupeeAmount') THEN
    ALTER TABLE "CashbackTranche" RENAME COLUMN "rupeeAmount" TO "legacyInrAmount";
    ALTER TABLE "CashbackTranche" ALTER COLUMN "legacyInrAmount" DROP NOT NULL;
  END IF;

  -- Reward rules: percentages and the coin-only minimum payout
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RewardRule' AND column_name = 'dailyClaimPercent') THEN
    ALTER TABLE "RewardRule" ADD COLUMN "dailyClaimPercent" DOUBLE PRECISION NOT NULL DEFAULT 3.0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RewardRule' AND column_name = 'minWithdrawalCoins') THEN
    ALTER TABLE "RewardRule" ADD COLUMN "minWithdrawalCoins" INTEGER NOT NULL DEFAULT 500;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RewardRule' AND column_name = 'referralCommissionPercent') THEN
    ALTER TABLE "RewardRule" ADD COLUMN "referralCommissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 10.0;
  END IF;
END $$;
