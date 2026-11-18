import { redirect } from "next/navigation";
import { readCustomerSession } from "@/lib/server/auth";
import ShopPage from "@/app/shop/shop-client";

export const dynamic = "force-dynamic";

export default async function AppAccountShopPage() {
  const customerId = await readCustomerSession();
  if (!customerId) {
    redirect("/login?redirect=" + encodeURIComponent("/app/account/shop"));
  }

  return <ShopPage />;
}
