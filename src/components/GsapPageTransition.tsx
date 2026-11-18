"use client";

import React, { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

interface GsapPageTransitionProps {
  children: React.ReactNode;
}

/**
 * Maps bottom navigation routes to horizontal ordered tab indices (0 to 4).
 */
function getBottomNavIndex(path: string): number {
  if (path.startsWith("/app/account/shop") || path === "/shop" || path.startsWith("/shop/")) return 0;
  if (path.startsWith("/app/account/wallet") || path === "/wallet" || path.startsWith("/app/wallet")) return 1;
  if (path.startsWith("/app/account/affiliate") || path.startsWith("/app/account/referral") || path.startsWith("/app/account/withdrawals")) return 2;
  if (path.startsWith("/app/account/orders") || path === "/track" || path.startsWith("/app/track")) return 3;
  if (path === "/app/account" || path === "/account" || path.startsWith("/app/account/") || path.startsWith("/app/profile")) return 4;
  return -1;
}

/**
 * Restores per-screen scroll position on route change. No entrance/exit motion:
 * navigation renders instantly so repeated tab switches never read as delay.
 */
export default function GsapPageTransition({ children }: GsapPageTransitionProps) {
  const pathname = usePathname();
  const prevPathRef = useRef<string>(pathname);
  const scrollMapRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const prevPath = prevPathRef.current;
    prevPathRef.current = pathname;

    scrollMapRef.current[prevPath] = window.scrollY;

    const prevIdx = getBottomNavIndex(prevPath);
    const currIdx = getBottomNavIndex(pathname);
    const isBottomNavSwitch = prevIdx !== -1 && currIdx !== -1;

    const isSameShell =
      (prevPath.startsWith("/app/account") && pathname.startsWith("/app/account")) ||
      (prevPath.startsWith("/account") && pathname.startsWith("/account")) ||
      (prevPath.startsWith("/admin") && pathname.startsWith("/admin"));

    if (isSameShell || isBottomNavSwitch) {
      const savedScroll = scrollMapRef.current[pathname] ?? 0;
      window.scrollTo({ top: savedScroll, left: 0, behavior: "instant" });
    } else if (!window.location.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [pathname]);

  return (
    <div className="flex-1 flex flex-col w-full relative overflow-x-clip" data-route={pathname}>
      {children}
    </div>
  );
}