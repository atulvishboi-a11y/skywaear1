import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { readCustomerSession } from "@/lib/server/auth";
import { storefrontSnapshot } from "@/lib/server/services";
import { ensureStateLoaded } from "@/lib/server/store";
import AccountView from "@/app/account/AccountView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AppAccountTabPage({
  params,
  searchParams,
}: {
  params: Promise<{ tab: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  const target = `/app/account/${resolvedParams.tab}`;
  const customerId = await readCustomerSession();
  if (!customerId) redirect("/login?redirect=" + encodeURIComponent(target));

  await ensureStateLoaded();
  let snapshot = storefrontSnapshot(customerId);
  if (!snapshot.customer) {
    await ensureStateLoaded(true);
    snapshot = storefrontSnapshot(customerId);
  }
  if (!snapshot.customer) redirect("/login?redirect=" + encodeURIComponent(target));

  const withdraw = resolvedSearch.withdraw;
  const initialWithdrawSource = withdraw === "referral" ? "referral" : "cashback";

  const headerList = await headers();
  const host = headerList.get("host") ?? "skywear.in";
  const forwardedProto = headerList.get("x-forwarded-proto");
  const protocol = forwardedProto ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const siteOrigin = `${protocol}://${host}`;

  return (
    <AccountView
      initialSnapshot={snapshot}
      basePath="/app/account"
      initialWithdrawSource={initialWithdrawSource}
      siteOrigin={siteOrigin}
    />
  );
}
