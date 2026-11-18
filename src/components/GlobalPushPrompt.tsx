"use client";

import { usePathname } from "next/navigation";
import WebPushNotificationPrompt from "@/components/WebPushNotificationPrompt";

/**
 * Push opt-in rides along on every storefront route, not just the home page.
 * The admin console has its own push desk, and /offline is a service-worker shell.
 */
export default function GlobalPushPrompt({ customerId }: { customerId?: string }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin") || pathname === "/offline") return null;
  return <WebPushNotificationPrompt customerId={customerId} />;
}
