import { ok } from "@/lib/http";
import { buildCashbackUnlockNotification } from "@/lib/server/notifications";
import type { CustomerAccount } from "@/data/rewardsEngine";
import type { CashbackTranche, ShopOrder } from "@/lib/domain";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const week = Number(searchParams.get("week") || "1");
  const orderNumber = searchParams.get("orderNumber") || "TC_84920";
  const coins = Number(searchParams.get("coins") || "250");

  const sampleCustomer: CustomerAccount = {
    id: "cust-demo",
    name: "Aman Sharma",
    email: "aman.sharma@example.com",
    phone: "+91 98765 43210",
    referralCode: "AMAN10",
    tier: "Silver",
    availableCoins: 250,
    pendingCoins: 750,
    referralCoinBalance: 0,
    lifetimeEarnedCoins: 1000,
    addresses: [],
  };

  const sampleOrder: Partial<ShopOrder> = {
    id: "ord_demo",
    orderNumber,
    total: 1000,
  };

  const sampleSlice: CashbackTranche = {
    week,
    percent: 25,
    coins,
    dueAt: new Date().toISOString(),
    dueDate: `Week ${week} (Day ${week * 7})`,
    status: "RELEASED",
    releasedAt: new Date().toISOString(),
  };

  const preview = buildCashbackUnlockNotification({
    customer: sampleCustomer,
    order: sampleOrder as ShopOrder,
    slice: sampleSlice,
    liveWalletCoins: sampleCustomer.availableCoins,
    storeUrl: "http://localhost:3000",
  });

  return ok({
    preview,
    sampleCustomer,
  });
}
