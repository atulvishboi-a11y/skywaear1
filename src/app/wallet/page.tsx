import type { Metadata } from "next";
import WalletPage from "@/components/WalletPage";

export const metadata: Metadata = {
  title: "Rewards Wallet | SKYWEAR",
  description:
    "Track your Sky Cash balance, see when each cashback tranche unlocks, request a UPI or bank payout and read your full wallet ledger.",
};

export default function WalletRoute() {
  return <WalletPage />;
}
