import type { Metadata } from "next";
import SupportCentre from "@/components/SupportCentre";

export const metadata: Metadata = {
  title: "Customer Support & Help Centre | SKYWEAR",
  description:
    "Reach the SKYWEAR support desk on WhatsApp, phone or email — order tracking, coins and payouts, replacements and sizing help.",
};

export default function SupportPage() {
  return <SupportCentre />;
}
