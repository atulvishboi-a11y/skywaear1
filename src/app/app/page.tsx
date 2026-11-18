import { redirect } from "next/navigation";
import { readCustomerSession } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function AppHomePage() {
  const customerId = await readCustomerSession();
  if (!customerId) redirect("/login?redirect=" + encodeURIComponent("/app/account"));
  redirect("/app/account");
}
