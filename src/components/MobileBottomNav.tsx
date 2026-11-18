"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Wallet as WalletIcon, Package, Store, User } from "lucide-react";
import gsap from "gsap";
import { api } from "@/lib/client";
import { useSession } from "@/context/SessionContext";

/**
 * The lens is absolutely positioned against the dock, but tabs live in an inner
 * padded grid — offsetLeft mixes the two coordinate spaces and shifts the pill
 * left. Measure both in viewport coordinates and translate back to dock space.
 */
function measureTab(
  tab: HTMLElement | null | undefined,
  lens: HTMLElement | null
): { left: number; width: number } | null {
  if (!tab || !lens || !tab.offsetWidth) return null;
  const dock = lens.offsetParent as HTMLElement | null;
  if (!dock) return null;
  const dockRect = dock.getBoundingClientRect();
  const tabRect = tab.getBoundingClientRect();
  const borderLeft = parseFloat(getComputedStyle(dock).borderLeftWidth) || 0;
  return { left: tabRect.left - dockRect.left - borderLeft, width: tabRect.width };
}

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { loggedIn } = useSession();
  const [orderCount, setOrderCount] = useState(0);
  const [optimisticIndex, setOptimisticIndex] = useState<number | null>(null);

  const hasMountedRef = useRef(false);
  const lensRef = useRef<HTMLDivElement | null>(null);
  const tabsRef = useRef<(HTMLAnchorElement | null)[]>([]);

  // Dedicated product and checkout pages have their own primary action bars and must never be obstructed.
  const isExcludedPage =
    pathname.startsWith("/product") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/cart") ||
    pathname.startsWith("/app/bag");
  const showNav = loggedIn && !pathname.startsWith("/admin") && !isExcludedPage;

  useEffect(() => {
    if (!showNav) return;
    let cancelled = false;
    api
      .getMyTrackedOrders()
      .then((tracked) => {
        if (!cancelled) setOrderCount(tracked.userOrders.length);
      })
      .catch(() => {
        if (!cancelled) setOrderCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [showNav]);

  useEffect(() => {
    document.body.classList.toggle("has-bottom-nav", showNav);
    return () => {
      document.body.classList.remove("has-bottom-nav");
    };
  }, [showNav]);

  const navItems = [
    {
      name: "Shop",
      href: "/app/account/shop",
      icon: Store,
      isActive: pathname.startsWith("/app/account/shop") || pathname.startsWith("/shop"),
      badge: null,
    },
    {
      name: "Wallet",
      href: "/app/account/wallet",
      icon: WalletIcon,
      isActive: pathname.startsWith("/app/account/wallet") || pathname.startsWith("/app/wallet"),
      badge: null,
      badgeColor: "",
    },
    {
      name: "Referral",
      href: "/app/account/affiliate",
      icon: Users,
      isActive:
        pathname.startsWith("/app/account/affiliate") ||
        pathname.startsWith("/app/account/referral"),
      badge: null,
    },
    {
      name: "Orders",
      href: "/app/account/orders",
      icon: Package,
      isActive: pathname.startsWith("/app/account/orders") || pathname.startsWith("/app/track"),
      badge: orderCount > 0 ? (orderCount > 99 ? "99+" : String(orderCount)) : null,
      badgeColor: "bg-[#f13545] text-white",
    },
    {
      name: "Account",
      href: "/app/account/profile",
      icon: User,
      isActive:
        pathname === "/app/account" ||
        pathname === "/app/profile" ||
        (pathname.startsWith("/app/account/") &&
          !pathname.startsWith("/app/account/shop") &&
          !pathname.startsWith("/app/account/wallet") &&
          !pathname.startsWith("/app/account/affiliate") &&
          !pathname.startsWith("/app/account/referral") &&
          !pathname.startsWith("/app/account/withdrawals") &&
          !pathname.startsWith("/app/account/orders")),
      badge: null,
    },
  ];

  const routeActiveIndex = navItems.findIndex((item) => item.isActive);
  const activeIndex =
    optimisticIndex !== null
      ? optimisticIndex
      : routeActiveIndex >= 0
      ? routeActiveIndex
      : 0;

  // Sync optimistic index back when the pathname settles
  useEffect(() => {
    if (optimisticIndex !== null) {
      const timer = setTimeout(() => {
        setOptimisticIndex(null);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [pathname, optimisticIndex]);

  // Clean smooth transition between footer icons
  useEffect(() => {
    if (!showNav || typeof window === "undefined") return;

    const targetTab = tabsRef.current[activeIndex];
    const lens = lensRef.current;
    const target = measureTab(targetTab, lens);
    if (!lens || !target) return;

    const targetLeft = target.left;
    const targetWidth = target.width;
    if (!targetWidth) return;

    if (!hasMountedRef.current) {
      gsap.set(lens, {
        left: targetLeft,
        width: targetWidth,
        x: 0,
        y: 0,
        scale: 1,
      });
      hasMountedRef.current = true;
    } else {
      gsap.to(lens, {
        left: targetLeft,
        width: targetWidth,
        x: 0,
        y: 0,
        scale: 1,
        duration: 0.35,
        ease: "power2.out",
        overwrite: true,
      });
    }
  }, [activeIndex, showNav]);

  // Viewport resize synchronization to preserve exact alignment
  useEffect(() => {
    if (!showNav || typeof window === "undefined") return;
    const handleResize = () => {
      const targetTab = tabsRef.current[activeIndex];
      const lens = lensRef.current;
      const target = measureTab(targetTab, lens);
      if (lens && target) {
        gsap.set(lens, {
          left: target.left,
          width: target.width,
        });
      }
    };
    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, [activeIndex, showNav]);

  if (!showNav) return null;

  return (
    <div
      className="md:hidden fixed left-0 right-0 z-[42] px-3 pointer-events-none flex justify-center"
      style={{
        bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {/* Floating White Mode Frosted Glass Dock Pill (matching liquidgl.naughtyduk.com) */}
      <nav
        id="dock-bar"
        role="tablist"
        aria-label="Mobile Navigation"
        className="pointer-events-auto relative w-full max-w-md h-[62px] px-2 rounded-full flex items-center justify-between border border-white/80 bg-white/70 backdrop-blur-2xl shadow-[0_16px_40px_-6px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_2px_rgba(255,255,255,0.95)] select-none"
      >
        {/* Ambient top specular rim highlight line */}
        <div className="absolute top-0 inset-x-8 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent pointer-events-none z-[1]" />

        {/* Real-time LiquidGL WebGL/WebGPU Water Droplet Lens (Layer 1: Behind text) */}
        <div
          ref={lensRef}
          id="lens"
          aria-hidden="true"
          className="absolute top-[6px] bottom-[6px] rounded-full pointer-events-none z-[1] border border-white/90 shadow-[0_4px_16px_rgba(0,0,0,0.06),inset_0_1.5px_2px_rgba(255,255,255,0.95)] backdrop-blur-md"
          style={{
            background:
              "radial-gradient(ellipse at 50% 25%, rgba(255,255,255,0.65) 0%, rgba(240,240,245,0.25) 60%, rgba(241,53,69,0.04) 100%)",
            willChange: "left, width, transform",
          }}
        />

        {/* Navigation Tab Links (Layer 2: strictly in front of lens with z-10) */}
        <div
          className="relative z-10 w-full grid grid-cols-5 items-center pointer-events-auto"
        >
          {navItems.map((item, idx) => {
            const Icon = item.icon;
            const active = idx === activeIndex;

            return (
              <Link
                key={item.name}
                ref={(el) => {
                  tabsRef.current[idx] = el;
                }}
                href={item.href}
                role="tab"
                aria-label={item.name}
                aria-selected={active}
                aria-current={active ? "page" : undefined}
                onClick={(e) => {
                  setOptimisticIndex(idx);
                  if (typeof window !== "undefined" && "vibrate" in navigator) {
                    try {
                      navigator.vibrate(8);
                    } catch {}
                  }
                  if (
                    typeof window !== "undefined" &&
                    window.location.pathname.startsWith("/app/account")
                  ) {
                    const targetTab = item.href.replace("/app/account/", "");
                    if (targetTab && targetTab !== item.href) {
                      e.preventDefault();
                      window.dispatchEvent(
                        new CustomEvent("skywear:switch-account-tab", {
                          detail: targetTab,
                        })
                      );
                    }
                  }
                }}
                className={`dock-tab relative z-10 flex flex-col items-center justify-center min-h-[50px] py-1 rounded-full transition-colors duration-200 touch-manipulation group focus-visible:outline-none ${
                  active ? "text-[#f13545]" : "text-[#71717a] hover:text-[#18181b]"
                }`}
              >
                {/* Icon Layer */}
                <div className="relative z-10 flex items-center justify-center">
                  <Icon
                    className={`w-5 h-5 transition-transform duration-200 ${
                      active
                        ? "scale-105 text-[#f13545]"
                        : "text-[#71717a] group-hover:scale-105"
                    }`}
                  />

                  {item.badge && (
                    <span
                      className={`absolute -top-1.5 -right-3 min-w-[16px] h-3.5 px-1 rounded-full font-mono text-[9px] font-bold flex items-center justify-center leading-none shadow-sm border border-white/80 ${
                        item.badgeColor || "bg-[#f13545] text-white"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>

                {/* Tab Label */}
                <span
                  className={`relative z-10 text-[9px] font-mono tracking-wider uppercase mt-0.5 font-semibold transition-colors duration-200 ${
                    active ? "font-bold text-[#f13545]" : "text-[#71717a]"
                  }`}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
