import { redirect } from "next/navigation";
import { readCustomerSession } from "@/lib/server/auth";
import HomeClient from "./home-client";

export const dynamic = "force-dynamic";

export default async function Home() {
  const customerId = await readCustomerSession();
  if (customerId) redirect("/app/account");
  return <HomeClient />;
}
