"use client";

import React, { useState, useEffect } from "react";
import { Bell, BellRing, Check, Loader2, Sparkles, X } from "lucide-react";
import {
  isPushNotificationSupported,
  getPushPermission,
  getExistingPushSubscription,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
} from "@/lib/push-client";

interface WebPushNotificationPromptProps {
  customerId?: string;
  variant?: "floating" | "inline";
  onSubscribed?: () => void;
}

export default function WebPushNotificationPrompt({
  customerId,
  variant = "floating",
  onSubscribed,
}: WebPushNotificationPromptProps) {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [docked, setDocked] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setMounted(true);
    const isSupp = isPushNotificationSupported();
    setSupported(isSupp);
    if (!isSupp) {
      setPermission("unsupported");
      return;
    }
    const currentPerm = getPushPermission();
    setPermission(currentPerm);

    void getExistingPushSubscription().then((sub) => {
      const hasSub = Boolean(sub);
      setIsSubscribed(hasSub);
      // Auto-heal: If user already granted permission, ensure server subscription is active & linked
      if (currentPerm === "granted") {
        void subscribeToPushNotifications({ customerId, sendWelcome: false }).then((res) => {
          if (res.success) setIsSubscribed(true);
        });
      }
    });

    const isDocked = localStorage.getItem("skywear_push_docked") === "true";
    setDocked(isDocked);
  }, []);

  // Browser-level denial cannot be re-prompted via web API, so suppress
  if (!mounted || !supported || permission === "denied" || permission === "granted" || isSubscribed) {
    if (variant === "inline") {
      // Inline toggle inside account dashboard remains accessible for unsubscribing/status
    } else {
      return null;
    }
  }

  const handleAllow = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await subscribeToPushNotifications({
        customerId,
        sendWelcome: true,
      });
      if (res.success) {
        setIsSubscribed(true);
        setPermission("granted");
        setDocked(false);
        localStorage.removeItem("skywear_push_docked");
        onSubscribed?.();
      } else {
        setMessage(res.error || "Permission was not granted.");
        // If user denied at the native browser level, dock to avoid annoyance
        setDocked(true);
        localStorage.setItem("skywear_push_docked", "true");
      }
    } catch (err: any) {
      setMessage(err?.message || "Failed to enable notifications.");
      setDocked(true);
    } finally {
      setLoading(false);
    }
  };

  const handleLater = () => {
    setDocked(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("skywear_push_docked", "true");
    }
  };

  const handleExpand = () => {
    setDocked(false);
    if (typeof window !== "undefined") {
      localStorage.removeItem("skywear_push_docked");
    }
  };

  // --- INLINE VARIANT (Account Dashboard Alerts Tab) ---
  if (variant === "inline") {
    return (
      <div className="p-3 bg-[#0B0C10] border border-[#282C34] flex items-center justify-between gap-3 font-mono text-xs">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 flex items-center justify-center font-bold ${
              isSubscribed
                ? "bg-[#00FF66]/15 border border-[#00FF66]/40 text-[#00FF66]"
                : "bg-[#16181D] border border-[#282C34] text-[#8E929B]"
            }`}
          >
            {isSubscribed ? <BellRing className="w-4 h-4 animate-pulse" /> : <Bell className="w-4 h-4" />}
          </div>
          <div>
            <div className="font-bold text-white uppercase flex items-center gap-1.5 font-sans">
              <span>Push Notifications</span>
              {isSubscribed && (
                <span className="text-[9px] px-1.5 py-0.2 bg-[#00FF66]/20 text-[#00FF66] font-mono border border-[#00FF66]/30">
                  LIVE
                </span>
              )}
            </div>
            <div className="text-[10px] text-[#8E929B]">
              {isSubscribed
                ? "Receiving order updates & exclusive drop alerts"
                : "Get instant alerts for your orders, shipments, and drops"}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={async () => {
            if (isSubscribed) {
              setLoading(true);
              const ok = await unsubscribeFromPushNotifications();
              if (ok) setIsSubscribed(false);
              setLoading(false);
            } else {
              await handleAllow();
            }
          }}
          disabled={loading}
          className={`px-3 py-1.5 text-xs font-bold uppercase border transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer ${
            isSubscribed
              ? "bg-[#16181D] text-white border-[#282C34] hover:border-rose-500 hover:text-rose-400"
              : "bg-[#00FF66] text-[#0B0C10] border-[#00FF66] hover:bg-white"
          }`}
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isSubscribed ? (
            <>
              <Check className="w-3.5 h-3.5 text-[#00FF66]" />
              <span>Enabled</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Enable Alerts</span>
            </>
          )}
        </button>
      </div>
    );
  }

  // --- FLOATING VARIANT: DOCKED LEFT MINI-PILL ---
  // When user tapped Later / Cancel, it slides and docks to the left side until they allow it
  if (docked) {
    return (
      <div className="fixed left-3 sm:left-5 bottom-20 sm:bottom-6 z-40 transition-all duration-300">
        <button
          type="button"
          onClick={handleExpand}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 dark:bg-[#12141A]/95 hover:bg-white dark:hover:bg-[#1A1D24] border border-[#e0e0e0] dark:border-white/10 text-neutral-800 dark:text-white shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.5)] backdrop-blur-md transition-all duration-200 cursor-pointer group active:scale-95"
          title="Enable order & drop notifications"
          aria-label="Enable notifications"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f13545] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#f13545]"></span>
          </span>
          <Bell className="w-3.5 h-3.5 text-[#f13545] group-hover:rotate-12 transition-transform" />
          <span className="text-[11px] font-medium font-sans text-neutral-800 dark:text-gray-200 pr-0.5">Alerts</span>
        </button>
      </div>
    );
  }

  // --- FLOATING VARIANT: NATIVE ANDROID-STYLE COMPACT DIALOG ---
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Notification Permission"
      className="fixed bottom-20 left-3 right-3 sm:bottom-6 sm:left-6 sm:right-auto sm:w-[320px] z-40 transition-all duration-300 ease-out"
    >
      <div className="bg-[#12141A]/95 border border-white/10 rounded-2xl p-4 shadow-[0_12px_36px_rgba(0,0,0,0.65)] backdrop-blur-xl">
        {/* Header with App / Bell Icon & Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#00FF66]/10 border border-[#00FF66]/25 text-[#00FF66] flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[13px] font-semibold text-white font-sans leading-tight">
              Allow notifications?
            </h3>
            {/* Single concise line of text as requested */}
            <p className="text-[11px] text-[#9CA3AF] mt-0.5 font-sans leading-normal">
              Get instant updates on your orders and drops.
            </p>
          </div>
        </div>

        {message && (
          <div className="mt-2 text-[10px] text-amber-400 font-mono bg-amber-500/10 px-2 py-1 rounded">
            {message}
          </div>
        )}

        {/* Clean Android-style Actions: Later on left, Allow on right */}
        <div className="flex items-center justify-end gap-2 mt-3 pt-2.5 border-t border-white/5 font-sans">
          <button
            type="button"
            onClick={handleLater}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            Don&apos;t allow
          </button>
          <button
            type="button"
            onClick={handleAllow}
            disabled={loading}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#00FF66] text-black hover:bg-[#00FF66]/90 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Enabling...</span>
              </>
            ) : (
              <span>Allow</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
