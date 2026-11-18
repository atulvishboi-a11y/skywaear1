"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  X,
  User,
  Menu,
  Heart,
  ShoppingBag,
  Wallet,
  Home,
  Truck,
  Headphones,
  LogOut,
  Bell,
  Award,
  Users,
  Banknote,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { SupportConfig } from "@/lib/support";
import type { CustomerAccount } from "@/data/rewardsEngine";
import type { ZeninNotification } from "@/lib/domain";
import { api } from "@/lib/client";
import { useSession } from "@/context/SessionContext";
import SkywearLogo from "@/components/SkywearLogo";

const MENU_OPEN_STORAGE_KEY = "skywear_menu_open";

function persistMenuOpen(open: boolean) {
  try {
    sessionStorage.setItem(MENU_OPEN_STORAGE_KEY, open ? "1" : "0");
  } catch {
    // Private modes can block storage; the drawer still works for this render.
  }
}

export interface HeaderProps {
  cartCount?: number;
  wishlistCount?: number;
  walletPoints?: number;
  support?: SupportConfig;
  themes?: string[];
  activeCategory?: string;
  customer?: CustomerAccount | null;
  isLoggedIn?: boolean;
  onOpenCart?: () => void;
  onOpenWishlist?: () => void;
  onOpenAccount?: (tab?: "orders" | "rewards" | "affiliate" | "profile") => void;
  onOpenTrackOrder?: () => void;
  onSelectCategory?: (category: string) => void;
  onSelectTab?: (tab: "all" | "premium" | "new" | "bestseller") => void;
  onSearch?: (query: string) => void;
}

export default function Header({
  cartCount = 0,
  wishlistCount = 0,
  walletPoints = 0,
  customer: initialCustomer,
  isLoggedIn: initialIsLoggedIn,
  onSearch,
}: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<ZeninNotification[]>([]);
  const { customer: sessionCustomer } = useSession();

  const closeMenu = () => {
    if (isMobileMenuOpen) persistMenuOpen(false);
    setIsMobileMenuOpen(false);
  };

  const toggleMenu = () => {
    setIsMobileMenuOpen((prev) => {
      persistMenuOpen(!prev);
      return !prev;
    });
  };

  const menuRestoredRef = useRef(false);

  const customer = initialCustomer ?? sessionCustomer;

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut listener (Cmd+K / Ctrl+K and Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setIsSearchOpen(false);
        persistMenuOpen(false);
        setIsMobileMenuOpen(false);
        setIsNotificationsOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsSearchOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Auto-focus input when search opens
  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isSearchOpen]);

  // Lock body scroll when a drawer is open
  useEffect(() => {
    if (isMobileMenuOpen || isNotificationsOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen, isNotificationsOpen]);

  // A scroll gesture dismisses the mobile drawer instead of leaving it pinned to the viewport
  const mobileDrawerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const el = mobileDrawerRef.current;
    if (!el) return;

    let startY = 0;
    let startX = 0;
    const close = () => {
      persistMenuOpen(false);
      setIsMobileMenuOpen(false);
    };
    const onTouchStart = (event: TouchEvent) => {
      startY = event.touches[0]?.clientY ?? 0;
      startX = event.touches[0]?.clientX ?? 0;
    };
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      if (Math.abs(touch.clientY - startY) > 8 || Math.abs(touch.clientX - startX) > 8) close();
    };

    el.addEventListener("wheel", close, { passive: true });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("scroll", close, { passive: true });
    return () => {
      el.removeEventListener("wheel", close);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("scroll", close);
    };
  }, [isMobileMenuOpen]);

  // Close menus on route change
  useEffect(() => {
    // Navigation is an external event; overlays must not stay open across a route change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobileMenuOpen((prev) => {
      if (prev) persistMenuOpen(false);
      return false;
    });
    setIsSearchOpen(false);
    setIsNotificationsOpen(false);
  }, [pathname]);

  const signedIn = initialIsLoggedIn ?? Boolean(customer);
  const availableCoins = customer?.availableCoins ?? walletPoints;
  const unreadBadge = signedIn ? notifications.filter((n) => !n.read).length : 0;
  const recentNotifications = notifications.slice(0, 6);

  // Keep the signed-in navigation drawer open across a page refresh.
  useEffect(() => {
    if (!signedIn || menuRestoredRef.current) return;
    menuRestoredRef.current = true;
    try {
      if (sessionStorage.getItem(MENU_OPEN_STORAGE_KEY) === "1") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsMobileMenuOpen(true);
      }
    } catch {}
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    api.notifications
      .list()
      .then(({ notifications: list }) => {
        if (!cancelled) setNotifications(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [signedIn, pathname]);

  interface NavLinkItem {
    label: string;
    href: string;
    badge?: string;
    icon?: React.ComponentType<{ className?: string }>;
  }

  // Mobile drawer links for signed-in members:
  // Exclude Shop, Wallet, Referral, and Orders because they already reside in the sticky MobileBottomNav
  const memberLinks: NavLinkItem[] = [
    { label: "DASHBOARD", href: "/app/account", icon: Home },
    { label: "WITHDRAWALS", href: "/app/account/withdrawals", icon: Banknote },
    { label: "REWARD ENGINE", href: "/app/account/rewards", icon: Award },
    { label: "AFFILIATE & REFERRALS", href: "/app/account/affiliate", icon: Users },
    {
      label: "ALERTS & UPDATES",
      href: "/app/account/notifications",
      badge: unreadBadge > 0 ? String(unreadBadge) : undefined,
      icon: Bell,
    },
    { label: "SUPPORT", href: "/support", icon: Headphones },
  ];

  const guestLinks: NavLinkItem[] = [
    { label: "HOME", href: "/", icon: Home },
    { label: "SHOP", href: "/shop", badge: "280 GSM", icon: ShoppingBag },
    { label: "WALLET", href: "/wallet", badge: "100% BACK", icon: Wallet },
    { label: "TRACKING", href: "/track", icon: Truck },
    { label: "SUPPORT", href: "/support", icon: Headphones },
  ];

  const drawerLinks = signedIn ? memberLinks : guestLinks;
  const inAccountSection = signedIn && pathname.startsWith("/app/account");

  const activeIndex = React.useMemo(() => {
    if (pathname === "/") return 0;
    if (pathname.startsWith("/app/account/wallet") || pathname.startsWith("/wallet")) return 2;
    if (pathname.startsWith("/app/account")) return 0;
    if (pathname === "/shop" || pathname.startsWith("/shop/")) return 1;
    if (pathname.startsWith("/app/track") || pathname === "/track" || pathname.startsWith("/track/")) return 3;
    if (pathname.startsWith("/support")) return 4;
    return 0;
  }, [pathname]);

  const desktopLinks = [
    { label: signedIn ? "Dashboard" : "Home", href: signedIn ? "/app/account" : "/", active: activeIndex === 0 },
    { label: "Shop", href: "/shop", active: activeIndex === 1 },
    { label: "Wallet", href: signedIn ? "/app/account/wallet" : "/wallet", active: activeIndex === 2 },
    { label: "Tracking", href: signedIn ? "/app/track" : "/track", active: activeIndex === 3 },
    { label: "Support", href: "/support", active: activeIndex === 4 },
  ];
  // The account sidebar already owns dashboard, wallet and tracking on desktop.
  const visibleDesktopLinks = inAccountSection
    ? desktopLinks.filter((item) => item.label === "Shop" || item.label === "Support")
    : desktopLinks;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    if (onSearch) {
      onSearch(q);
    } else {
      router.push(`/shop?q=${encodeURIComponent(q)}`);
    }
    setIsSearchOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full max-w-full overflow-x-clip transition-colors select-none font-mono">
      {/* MAIN HEADER BAR (COMPACT & RESPONSIVE) */}
      <div className="w-full max-w-full overflow-x-clip bg-[#0E1017]/95 backdrop-blur-xl border-b border-white/[0.08]">
        <div className="relative w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-6">

          {/* Brand Wordmark (left aligned) */}
          <div className="flex items-center gap-2 sm:mr-auto sm:gap-4 shrink-0 min-w-0">
            {/* Brand Logo & Wordmark (Responsive scaling: sm on mobile, md on desktop) */}
            <Link
              href={signedIn ? "/app/account" : "/"}
              className="group flex items-center active:scale-[0.98] transition-transform touch-manipulation min-w-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00FF66] rounded-md"
              aria-label="Skywear Brand Home"
            >
              <div className="sm:hidden">
                <SkywearLogo size="sm" />
              </div>
              <div className="hidden sm:block">
                <SkywearLogo size="md" />
              </div>
            </Link>
          </div>

          {/* Right: Navigation Menu & Essential Actions */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Compact wallet chip (mobile/tablet only) */}
            {signedIn && (
              <Link
                href="/app/account/wallet"
                className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-[#0A0B0E] px-2 py-1.5 hover:border-white/25 transition-colors touch-manipulation max-[399px]:hidden lg:hidden"
                title="Wallet coins"
                aria-label={`${availableCoins.toLocaleString("en-IN")} coins in wallet`}
              >
                <Wallet className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-bold text-amber-400 font-mono">
                  {availableCoins.toLocaleString("en-IN")}
                </span>
              </Link>
            )}
            {/* Desktop Navigation Menu */}
            <nav aria-label="Primary" className="hidden lg:flex items-center gap-0.5 mr-2">
              {visibleDesktopLinks.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={item.active ? "page" : undefined}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00FF66] ${
                    item.active
                      ? "bg-white/[0.08] text-white"
                      : "text-[#9AA0AB] hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            {signedIn ? (
              <>
                {/* Wallet coins (desktop; mobile renders it in the left cluster) */}
                <Link
                  href="/app/account/wallet"
                  className="hidden lg:flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#0A0B0E] px-2 py-1.5 hover:border-white/25 transition-colors touch-manipulation"
                  title="Wallet coins"
                  aria-label={`${availableCoins.toLocaleString("en-IN")} coins in wallet`}
                >
                  <Wallet className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px] font-bold text-amber-400 font-mono">
                    {availableCoins.toLocaleString("en-IN")}
                  </span>
                  <span className="text-[9px] text-[#8E929B]">COINS</span>
                </Link>

                {/* Search Trigger Icon (desktop; mobile uses the header bell + drawer search) */}
                <div className="relative hidden sm:flex" ref={searchContainerRef}>
                  <button
                    type="button"
                    onClick={() => setIsSearchOpen((prev) => !prev)}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[#8E929B] hover:text-white hover:bg-white/[0.06] active:scale-95 transition-all touch-manipulation cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00FF66]"
                    title="Search archive (Ctrl+K)"
                    aria-label="Search drops"
                  >
                    <Search className="w-5 h-5" />
                  </button>

                  {/* Minimal Popover Search */}
                  <AnimatePresence>
                    {isSearchOpen && (
                      <motion.form
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                        onSubmit={handleSearchSubmit}
                        className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-[#141620] border border-white/[0.12] rounded-xl p-2 shadow-2xl z-50 flex items-center gap-2"
                      >
                        <Search className="w-4 h-4 text-[#8E929B] ml-2 shrink-0" />
                        <input
                          ref={searchInputRef}
                          type="text"
                          placeholder="Search drops, heavyweight, oversized..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="flex-1 bg-transparent border-none text-xs text-white placeholder-[#717684] focus:outline-none font-mono py-1"
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            className="p-1 text-[#8E929B] hover:text-white cursor-pointer"
                            aria-label="Clear search input"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </motion.form>
                    )}
                  </AnimatePresence>
                </div>

                {/* Notifications */}
                <button
                  type="button"
                  onClick={() => setIsNotificationsOpen((prev) => !prev)}
                  className="relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[#8E929B] hover:text-white hover:bg-white/[0.06] active:scale-95 transition-all touch-manipulation cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00FF66]"
                  title="Alerts & Updates"
                  aria-label={unreadBadge > 0 ? `Notifications (${unreadBadge} unread)` : "Notifications"}
                  aria-expanded={isNotificationsOpen}
                  aria-controls="notification-slider"
                >
                  <Bell className="w-5 h-5" />
                  {unreadBadge > 0 && (
                    <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#D9362B] text-white font-mono font-bold text-[9px] sm:text-[10px] flex items-center justify-center shadow-md">
                      {unreadBadge > 99 ? "99+" : unreadBadge}
                    </span>
                  )}
                </button>

                {/* Wishlist Link */}
                <Link
                  href="/wishlist"
                  className="hidden sm:flex relative min-w-[44px] min-h-[44px] items-center justify-center rounded-lg text-[#8E929B] hover:text-white hover:bg-white/[0.06] active:scale-95 transition-all touch-manipulation focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00FF66]"
                  title="Saved Items / Wishlist"
                  aria-label={`Wishlist (${wishlistCount} items)`}
                >
                  <Heart className="w-5 h-5" />
                  {wishlistCount > 0 && (
                    <span className="absolute top-2 right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#D9362B] text-white font-mono font-bold text-[9px] flex items-center justify-center">
                      {wishlistCount > 99 ? "99+" : wishlistCount}
                    </span>
                  )}
                </Link>

                {/* Account / User Profile */}
                <Link
                  href={signedIn ? "/app/account/profile" : "/login"}
                  className="hidden sm:flex min-w-[44px] min-h-[44px] items-center justify-center rounded-lg text-[#8E929B] hover:text-white hover:bg-white/[0.06] active:scale-95 transition-all touch-manipulation focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00FF66]"
                  title="My Account"
                  aria-label="Customer Account"
                >
                  <User className="w-5 h-5" />
                </Link>

                {/* Shopping Bag Button */}
                <Link
                  href="/cart"
                  id="cart-icon-bubble"
                  className="relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-white hover:bg-white/[0.06] active:scale-95 transition-all touch-manipulation focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00FF66]"
                  title="Shopping Bag"
                  aria-label={`Shopping Bag (${cartCount} items)`}
                >
                  <ShoppingBag className="w-5 h-5" />
                  {cartCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#D9362B] text-white font-mono font-bold text-[9px] sm:text-[10px] flex items-center justify-center shadow-md">
                      {cartCount > 99 ? "99+" : cartCount}
                    </span>
                  )}
                </Link>
              </>
            ) : null}

            {/* Mobile menu toggle — sits after the bell so long coin balances can't collide with the logo */}
            <div className="flex items-center lg:hidden">
              <button
                type="button"
                onClick={toggleMenu}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#D1D5DB] hover:text-white active:scale-95 transition-transform touch-manipulation cursor-pointer shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00FF66]"
                aria-label="Toggle navigation menu"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. MOBILE NAVIGATION DRAWER */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            ref={mobileDrawerRef}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={`lg:hidden w-full bg-[#0E1017]/98 backdrop-blur-2xl border-b border-white/[0.1] shadow-2xl overflow-y-auto font-mono fixed top-[56px] sm:top-[64px] left-0 right-0 z-30 ${
              signedIn
                ? "max-h-[calc(100dvh_-_152px)] sm:max-h-[calc(100dvh_-_160px)] md:max-h-[calc(100dvh_-_64px)]"
                : "max-h-[calc(100dvh_-_64px)]"
            }`}
          >
            <div className="space-y-4 px-4 pt-5 pb-4">
              {signedIn && customer && (
                <Link
                  href="/app/account/profile"
                  onClick={closeMenu}
                  className="block space-y-1 border border-white/[0.08] bg-[#0A0B0E] p-3.5 transition-colors hover:border-white/25"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#8E929B]">
                    Account
                  </span>
                  <p
                    className="truncate text-sm font-bold uppercase text-white"
                    style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
                  >
                    {customer.name || "Skywear Member"}
                  </p>
                  <p className="truncate text-[10px] text-[#8E929B]">
                    {customer.phone || customer.email || "customer@skywear.in"}
                  </p>
                </Link>
              )}

              <nav className="space-y-0.5">
                {drawerLinks.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={closeMenu}
                        className={`flex items-center justify-between gap-2 px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors touch-manipulation active:scale-[0.98] ${
                          active
                            ? "bg-white/[0.06] text-white"
                            : "text-[#8E929B] hover:bg-white/[0.03] hover:text-white"
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          {Icon && (
                            <Icon
                              className={`h-4 w-4 shrink-0 ${active ? "text-[#D9362B]" : "text-[#8E929B]"}`}
                            />
                          )}
                          <span className="truncate">{item.label}</span>
                        </span>
                        {item.badge &&
                          (item.badge.includes("₹") || item.badge.includes("BACK") ? (
                            <span className="shrink-0 rounded-[2px] border border-[#00FF66]/30 bg-[#00FF66]/15 px-1.5 py-0.2 text-[9px] font-bold tracking-wider text-[#00FF66]">
                              {item.badge}
                            </span>
                          ) : (
                            <span className="flex h-4 min-w-[16px] shrink-0 items-center justify-center rounded-full bg-[#D9362B] px-1 text-[9px] font-black text-white">
                              {item.badge}
                            </span>
                          ))}
                      </Link>
                    );
                  })}

                {!signedIn && (
                  <Link
                    href="/login"
                    onClick={closeMenu}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-[#8E929B] transition-colors hover:bg-white/[0.03] hover:text-white touch-manipulation active:scale-[0.98]"
                  >
                    <span className="flex items-center gap-2.5">
                      <User className="h-4 w-4 shrink-0 text-[#8E929B]" />
                      <span>SIGN IN</span>
                    </span>
                  </Link>
                )}

                {signedIn && (
                  <div className="mt-2 border-t border-white/[0.08] pt-3">
                    <button
                      type="button"
                      onClick={async () => {
                        closeMenu();
                        try {
                          await api.signOut();
                        } catch {}
                        router.push("/login");
                        router.refresh();
                      }}
                      className="flex w-full items-center justify-center gap-2 border border-rose-500/20 bg-rose-500/10 p-2 text-xs font-bold uppercase tracking-wider text-rose-400 transition-colors hover:border-rose-500/40 hover:text-rose-300 touch-manipulation active:scale-[0.98] cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>SIGN OUT</span>
                    </button>
                  </div>
                )}
              </nav>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NOTIFICATION SLIDE-OVER */}
      <AnimatePresence>
        {isNotificationsOpen && signedIn && (
          <>
            <motion.button
              type="button"
              aria-label="Close notifications"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setIsNotificationsOpen(false)}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px] cursor-default"
            />
            <motion.aside
              id="notification-slider"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-0 right-0 z-[61] h-dvh w-full max-w-sm bg-[#0E1017] border-l border-white/[0.08] shadow-2xl flex flex-col font-mono text-[#F5F5F7]"
              aria-label="Notifications"
            >
              <div className="flex items-center justify-between gap-3 px-4 h-14 border-b border-white/[0.08] shrink-0">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#00FF66]" />
                  <span className="text-xs font-bold uppercase tracking-wider">Alerts & Updates</span>
                  {unreadBadge > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#D9362B] text-white font-bold text-[9px] flex items-center justify-center">
                      {unreadBadge > 99 ? "99+" : unreadBadge}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsNotificationsOpen(false)}
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#8E929B] hover:text-white hover:bg-white/[0.06] cursor-pointer"
                  aria-label="Close notifications"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
                {recentNotifications.length === 0 ? (
                  <p className="px-4 py-10 text-center text-[11px] text-[#6B6F7A]">
                    No alerts yet. Cashback, payout and order updates will appear here.
                  </p>
                ) : (
                  recentNotifications.map((note) => (
                    <div key={note.id} className="flex gap-3 px-4 py-3.5">
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${
                          note.read ? "bg-[#3A3E47]" : "bg-[#00FF66]"
                        }`}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className={`text-[11px] leading-snug ${note.read ? "text-[#C7CBD1]" : "text-white font-bold"}`}>
                          {note.title}
                        </p>
                        <p className="mt-0.5 text-[10px] leading-relaxed text-[#8E929B] line-clamp-2">
                          {note.message}
                        </p>
                        <p className="mt-1 text-[9px] uppercase tracking-wider text-[#6B6F7A]">
                          {new Date(note.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="shrink-0 p-3 pb-20 md:pb-3 border-t border-white/[0.08]">
                <Link
                  href="/app/account/notifications"
                  onClick={() => setIsNotificationsOpen(false)}
                  className="flex h-11 items-center justify-center rounded-lg bg-[#00FF66] text-[#0B0C10] text-[11px] font-bold uppercase tracking-wider hover:bg-[#00dd55] transition-colors"
                >
                  View all notifications
                </Link>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
