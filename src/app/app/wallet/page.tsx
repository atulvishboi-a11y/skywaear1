import { redirect } from "next/navigation";
import { readCustomerSession } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function AppWalletPage() {
  const customerId = await readCustomerSession();
  if (!customerId) redirect("/login?redirect=" + encodeURIComponent("/app/account/wallet"));
  redirect("/app/account/wallet");
}
