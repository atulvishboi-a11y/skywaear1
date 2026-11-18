import { redirect } from "next/navigation";
import { readCustomerSession } from "@/lib/server/auth";
import CartPage from "@/app/cart/page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AppBagPage() {
  const customerId = await readCustomerSession();
  if (!customerId) redirect("/login?redirect=" + encodeURIComponent("/app/bag"));

  return <CartPage />;
}
