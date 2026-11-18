import { redirect } from "next/navigation";
import { readCustomerSession } from "@/lib/server/auth";
import TrackPage from "@/app/track/page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AppTrackPage() {
  const customerId = await readCustomerSession();
  if (!customerId) redirect("/login?redirect=" + encodeURIComponent("/app/track"));

  return <TrackPage />;
}
