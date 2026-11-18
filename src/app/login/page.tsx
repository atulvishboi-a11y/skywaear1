import { redirect } from "next/navigation";
import { readCustomerSession } from "@/lib/server/auth";
import { ensureStateLoaded, readState } from "@/lib/server/store";
import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ redirect?: string; ref?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const redirectTarget = resolvedSearchParams?.redirect || "/app/account";
  const safeTarget = redirectTarget.startsWith("/login") ? "/app/account" : redirectTarget;

  const customerId = await readCustomerSession();
  if (customerId) {
    await ensureStateLoaded();
    const state = readState();
    const customer = state.customers.find((c) => c.id === customerId);
    if (customer) redirect(safeTarget);
  }

  return <LoginClient />;
}
