"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { CustomerAccount } from "@/data/rewardsEngine";
import type { SupportConfig } from "@/lib/support";

declare global {
  interface Window {
    Tawk_API?: any;
    Tawk_LoadStart?: Date;
  }
}

export default function TawkLiveChat({
  customer,
  support,
}: {
  customer?: CustomerAccount | null;
  support?: SupportConfig | null;
}) {
  const pathname = usePathname();
  const scriptInjectedRef = useRef(false);
  const [dynamicSupport, setDynamicSupport] = useState<Partial<SupportConfig> | null>(support ?? null);

  // STRICT REQUIREMENT: Only show live tawk.to on the support page (/support)
  const isSupportPage = pathname === "/support" || pathname?.startsWith("/support/");

  // Fetch dynamic support settings on mount if not provided from server props
  useEffect(() => {
    if (!isSupportPage) return;
    if (!support?.tawkPropertyId && !process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID) {
      fetch("/api/support")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.support) {
            setDynamicSupport(data.support);
          }
        })
        .catch(() => {});
    }
  }, [support?.tawkPropertyId, isSupportPage]);

  const activeSupport = dynamicSupport || support;
  const propertyId =
    activeSupport?.tawkPropertyId?.trim() ||
    process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID?.trim() ||
    "";
  const widgetId =
    activeSupport?.tawkWidgetId?.trim() ||
    process.env.NEXT_PUBLIC_TAWK_WIDGET_ID?.trim() ||
    "default";
  const isEnabled = activeSupport?.tawkEnabled !== false;

  // 1. Script Injection & Widget Lifecycle (Only inject / show if on /support)
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Initialize Tawk global variables
    window.Tawk_API = window.Tawk_API || {};
    window.Tawk_LoadStart = window.Tawk_LoadStart || new Date();

    // Attach initial visitor data before script loads (per official tawk.to doc)
    if (customer?.email || customer?.name) {
      window.Tawk_API.visitor = {
        name: customer.name || "Customer",
        email: customer.email || "",
      };
    }

    // Configure onLoad callback: Ensure widget is HIDDEN if not on /support
    const previousOnLoad = window.Tawk_API.onLoad;
    window.Tawk_API.onLoad = function () {
      if (typeof previousOnLoad === "function") {
        try {
          previousOnLoad();
        } catch {}
      }

      const currentPath = window.location.pathname;
      const onSupport = currentPath === "/support" || currentPath.startsWith("/support/");

      if (!onSupport) {
        if (typeof window.Tawk_API.hideWidget === "function") {
          try {
            window.Tawk_API.hideWidget();
          } catch {}
        }
      } else {
        if (typeof window.Tawk_API.showWidget === "function") {
          try {
            window.Tawk_API.showWidget();
          } catch {}
        }
      }

      // Sync customer attributes once loaded
      if (customer && typeof window.Tawk_API.setAttributes === "function") {
        try {
          window.Tawk_API.setAttributes({
            name: customer.name || "Customer",
            email: customer.email || "",
            phone: customer.phone || "",
            customerId: customer.id || "",
            tier: customer.tier || "Silver",
            availableCoins: String(customer.availableCoins ?? 0),
          });
        } catch (e) {
          console.debug("[Tawk] setAttributes onload error:", e);
        }
      }
    };

    // If not enabled or no propertyId, hide widget if already mounted
    if (!isEnabled || !propertyId) {
      if (typeof window.Tawk_API.hideWidget === "function") {
        try {
          window.Tawk_API.hideWidget();
        } catch {}
      }
      return;
    }

    // Only inject script when user visits /support
    if (isSupportPage) {
      const scriptId = "tawk-messenger-script";
      let existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;

      if (!existingScript && !scriptInjectedRef.current) {
        scriptInjectedRef.current = true;
        const s1 = document.createElement("script");
        s1.id = scriptId;
        s1.async = true;
        s1.src = `https://embed.tawk.to/${propertyId}/${widgetId}`;
        s1.charset = "UTF-8";
        s1.setAttribute("crossorigin", "*");

        document.head.appendChild(s1);
      } else if (typeof window.Tawk_API.showWidget === "function") {
        try {
          window.Tawk_API.showWidget();
        } catch {}
      }
    } else {
      // If NOT on support page, ensure widget is hidden
      if (typeof window.Tawk_API.hideWidget === "function") {
        try {
          window.Tawk_API.hideWidget();
        } catch {}
      }
    }
  }, [propertyId, widgetId, isEnabled, isSupportPage, customer]);

  // 2. Route Change Listener: Toggle visibility strictly based on /support path
  useEffect(() => {
    if (typeof window === "undefined" || !window.Tawk_API) return;

    if (!isSupportPage || !isEnabled || !propertyId) {
      if (typeof window.Tawk_API.hideWidget === "function") {
        try {
          window.Tawk_API.hideWidget();
        } catch {}
      }
    } else {
      if (typeof window.Tawk_API.showWidget === "function") {
        try {
          window.Tawk_API.showWidget();
        } catch {}
      }
    }
  }, [pathname, isSupportPage, isEnabled, propertyId]);

  // 3. Synchronize Customer Data Dynamically (e.g. on login/session change)
  useEffect(() => {
    if (typeof window === "undefined" || !window.Tawk_API) return;

    if (customer && typeof window.Tawk_API.setAttributes === "function") {
      try {
        window.Tawk_API.setAttributes({
          name: customer.name || "Customer",
          email: customer.email || "",
          phone: customer.phone || "",
          customerId: customer.id || "",
          tier: customer.tier || "Silver",
          availableCoins: String(customer.availableCoins ?? 0),
        });
      } catch (err) {
        console.debug("[Tawk] Failed to sync customer details:", err);
      }
    }
  }, [customer]);

  return null;
}
