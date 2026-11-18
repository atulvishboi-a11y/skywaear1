import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { readCustomerSession } from "@/lib/server/auth";
import { storefrontSnapshot } from "@/lib/server/services";
import { ensureStateLoaded } from "@/lib/server/store";
import AccountView from "@/app/account/AccountView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AppAccountPage() {
  const customerId = await readCustomerSession();
  if (!customerId) {
    redirect("/login?redirect=" + encodeURIComponent("/app/account"));
  }

  await ensureStateLoaded();
  let snapshot = storefrontSnapshot(customerId);

  // If customer is not found in local memory (e.g. freshly registered on another Vercel lambda),
  // immediately force reload the state from Postgres/Redis
  if (!snapshot.customer) {
    await ensureStateLoaded(true);
    snapshot = storefrontSnapshot(customerId);
  }

  if (!snapshot.customer) {
    redirect("/login?redirect=" + encodeURIComponent("/app/account"));
  }

  const headerList = await headers();
  const host = headerList.get("host") ?? "skywear.in";
  const forwardedProto = headerList.get("x-forwarded-proto");
  const protocol = forwardedProto ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");

  return (
    <AccountView
      initialSnapshot={snapshot}
      basePath="/app/account"
      siteOrigin={`${protocol}://${host}`}
    />
  );
}
