import { redirect } from "next/navigation";
import { readCustomerSession } from "@/lib/server/auth";
import { ensureStateLoaded, readState } from "@/lib/server/store";
import RegisterClient from "./RegisterClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RegisterPage() {
  const customerId = await readCustomerSession();
  if (customerId) {
    await ensureStateLoaded();
    const state = readState();
    const customer = state.customers.find((c) => c.id === customerId);
    if (customer) {
      redirect("/account");
    }
  }

  return <RegisterClient />;
}
