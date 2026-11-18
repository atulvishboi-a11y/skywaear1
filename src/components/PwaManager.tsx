"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Download, X, Share2, PlusSquare, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { getStoredReferral, saveReferral } from "@/lib/referral-tracker";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function PwaManager() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);
  const [activeReferral, setActiveReferral] = useState<{ code: string | null; name: string | null }>({ code: null, name: null });

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check referral context
    const ref = getStoredReferral();
    if (ref.code) {
      // Syncing from browser storage on mount; the rule can't see this external source.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveReferral(ref);
    }

    // 1. Register Service Worker automatically (production only — dev chunks are not content-hashed)
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV !== "production") {
        void navigator.serviceWorker
          .getRegistrations()
          .then((registrations) => registrations.forEach((registration) => void registration.unregister()))
          .catch(() => {});
      } else {
        window.addEventListener("load", () => {
          navigator.serviceWorker
            .register("/sw.js", { scope: "/" })
            .then((reg) => {
              // Check for service worker updates periodically
              reg.onupdatefound = () => {
                const installingWorker = reg.installing;
                if (installingWorker) {
                  installingWorker.onstatechange = () => {
                    if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                      toast("New update available", {
                        description: "Tap to reload and apply latest drop updates.",
                        action: {
                          label: "Reload",
                          onClick: () => window.location.reload(),
                        },
                        duration: 8000,
                      });
                    }
                  };
                }
              };
            })
            .catch((err) => {
              console.warn("[PWA] Service worker registration failed:", err);
            });
        });
      }
    }

    // 2. Check if already installed / running standalone
    const standaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes("android-app://");

    setIsStandalone(Boolean(standaloneMode));
    if (standaloneMode) return;

    // Check dismissal history (suppress for 7 days if dismissed)
    const lastDismissed = localStorage.getItem("skywear_pwa_dismissed");
    if (lastDismissed) {
      const daysSinceDismiss = (Date.now() - parseInt(lastDismissed, 10)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismiss < 7) {
        return;
      }
    }

    // 3. Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios|edge/.test(userAgent);

    if (isIosDevice && isSafari) {
      setIsIOS(true);
      // Give the user a moment to browse before showing the prompt
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3500);
      return () => clearTimeout(timer);
    }

    // 4. Handle Chromium / Android BeforeInstallPrompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Delay showing prompt slightly for natural feel
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // 5. Track app installed event
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowPrompt(false);
      setInstallSuccess(true);
      toast.success("SKYWEAR App Installed!", {
        description: "You can now launch Skywear directly from your home screen.",
      });
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // Handle Android/Chrome Install Action
  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstallSuccess(true);
        setShowPrompt(false);
      } else {
        dismissPrompt();
      }
    } catch (err) {
      console.error("[PWA] Installation prompt failed:", err);
    } finally {
      setDeferredPrompt(null);
    }
  };

  const dismissPrompt = () => {
    setShowPrompt(false);
    try {
      localStorage.setItem("skywear_pwa_dismissed", Date.now().toString());
    } catch {}
  };

  // If already standalone or prompt not triggered, render nothing
  if (isStandalone || !showPrompt) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="bg-[#16181D]/95 backdrop-blur-xl border border-[#282C34] text-white p-4 rounded-2xl shadow-[0_10px_35px_-5px_rgba(0,0,0,0.8)] relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00FF66] to-transparent" />

        {/* Dismiss Button */}
        <button
          onClick={dismissPrompt}
          aria-label="Dismiss app install banner"
          className="absolute top-3 right-3 text-[#8E929B] hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3.5 pr-6">
          {/* App Icon */}
          <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-[#0B0C10] border border-[#282C34] shrink-0 flex items-center justify-center shadow-inner">
            <Image
              src="/android-chrome-192x192.png"
              alt="SKYWEAR App Icon"
              width={48}
              height={48}
              className="object-cover"
              onError={(e) => {
                // Fallback to text if missing
                const target = e.target as HTMLElement;
                target.style.display = "none";
              }}
            />
            <span className="font-mono font-black text-xs text-[#00FF66] absolute">SK</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-[#00FF66] flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> OFFICIAL APP
              </span>
            </div>
            <h4 className="text-sm font-bold text-white tracking-tight mt-0.5">
              {activeReferral.code ? "Claim VIP Referral & App" : "Install SKYWEAR"}
            </h4>
            <p className="text-xs text-[#8E929B] mt-0.5 leading-snug">
              {activeReferral.code
                ? `Invited by ${activeReferral.name || activeReferral.code}. Install to unlock 100% cashback.`
                : "Instant 1-tap drops, offline bag, and 100% cashback alerts."}
            </p>
          </div>
        </div>

        {/* iOS Instruction View */}
        {isIOS ? (
          <div className="mt-3.5 pt-3 border-t border-[#282C34]/80 text-xs text-[#8E929B] space-y-2">
            <p className="text-white font-medium flex items-center gap-1.5">
              Install in 2 taps on Safari:
            </p>
            <div className="bg-[#0B0C10]/80 rounded-xl p-2.5 space-y-1.5 border border-[#282C34]/50">
              <div className="flex items-center gap-2 text-neutral-300">
                <span className="w-5 h-5 rounded-full bg-[#16181D] border border-[#282C34] flex items-center justify-center font-mono text-[10px] text-[#00FF66]">1</span>
                <span>Tap the <Share2 className="w-3.5 h-3.5 inline text-[#00F0FF] mx-1" /> <strong>Share</strong> button below</span>
              </div>
              <div className="flex items-center gap-2 text-neutral-300">
                <span className="w-5 h-5 rounded-full bg-[#16181D] border border-[#282C34] flex items-center justify-center font-mono text-[10px] text-[#00FF66]">2</span>
                <span>Select <PlusSquare className="w-3.5 h-3.5 inline text-[#00FF66] mx-1" /> <strong>Add to Home Screen</strong></span>
              </div>
            </div>
            <button
              onClick={dismissPrompt}
              className="w-full text-center text-[11px] text-[#8E929B] hover:text-white pt-1 transition-colors"
            >
              Maybe later
            </button>
          </div>
        ) : (
          /* Chrome/Android/Desktop Install Button */
          <div className="mt-3.5 pt-3 border-t border-[#282C34]/80 flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#00FF66] hover:bg-[#00FF66]/90 text-[#0B0C10] font-bold text-xs tracking-wider uppercase transition-all duration-150 active:scale-[0.98] cursor-pointer shadow-[0_0_15px_rgba(0,255,102,0.25)]"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
              INSTALL APP
            </button>
            <button
              onClick={dismissPrompt}
              className="py-2.5 px-3 rounded-xl bg-[#0B0C10] hover:bg-[#20242c] border border-[#282C34] text-xs text-[#8E929B] hover:text-white font-medium transition-colors"
            >
              Later
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
