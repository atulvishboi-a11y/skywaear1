"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Download,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Zap,
  Gift,
  Share2,
  PlusSquare,
  ExternalLink,
  Flame,
} from "lucide-react";
import { saveReferral } from "@/lib/referral-tracker";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function ReferralInvitePage() {
  const params = useParams();
  const router = useRouter();
  const rawCode = (params?.code as string) || "";
  const code = rawCode.trim().toUpperCase();

  const [referrerName, setReferrerName] = useState<string>("VIP Member");
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isWhatsApp, setIsWhatsApp] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSModal, setShowIOSModal] = useState<boolean>(false);
  const [installing, setInstalling] = useState<boolean>(false);

  useEffect(() => {
    if (!code || typeof window === "undefined") return;

    // 1. Immediately Lock Referral in Client Tri-Storage (localStorage + Cookie)
    saveReferral(code);

    // 2. Lookup Referrer info & record fingerprint on server
    fetch(`/api/referrals/lookup?code=${encodeURIComponent(code)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setIsValid(true);
          const name = data.name || "VIP Member";
          setReferrerName(name);
          saveReferral(code, name);
        } else {
          setIsValid(false);
        }
      })
      .catch(() => {
        setIsValid(true); // Graceful fallback
      });

    // 3. Detect environment
    const ua = window.navigator.userAgent.toLowerCase();
    const isWa = ua.includes("whatsapp") || ua.includes("fban") || ua.includes("fbav") || ua.includes("instagram");
    setIsWhatsApp(isWa);

    const isIosDevice = /iphone|ipad|ipod/.test(ua);
    const isSafari = ua.includes("safari") && !ua.includes("chrome") && !ua.includes("crios");
    setIsIOS(isIosDevice && isSafari);

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(Boolean(standalone));

    // 4. Catch BeforeInstallPrompt
    const handlePrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handlePrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
    };
  }, [code]);

  const handleInstallClick = async () => {
    if (isStandalone) {
      router.push(`/register?ref=${code}`);
      return;
    }

    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (deferredPrompt) {
      setInstalling(true);
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          // Redirect to register after install accepted
          setTimeout(() => {
            router.push(`/register?ref=${code}`);
          }, 1500);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setInstalling(false);
      }
    } else {
      // If prompt not available yet, forward to register with code applied
      router.push(`/register?ref=${code}`);
    }
  };

  return (
    <main className="min-h-screen bg-[#0B0C10] text-[#F5F5F7] flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden font-mono selection:bg-[#00FF66] selection:text-[#0B0C10]">
      {/* Background Ambience */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#00FF66]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-[#00F0FF]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Cyber Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#16181D_1px,transparent_1px),linear-gradient(to_bottom,#16181D_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

      {/* WhatsApp In-App Browser Helper Tip */}
      {isWhatsApp && (
        <div className="relative z-20 w-full max-w-md mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 flex items-start gap-2 backdrop-blur-md">
          <ExternalLink className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
          <div>
            <strong>Open in Chrome for best experience:</strong> Tap the 3 dots (⋮) at top-right and choose <em>"Open in Chrome / Browser"</em> to install the app.
          </div>
        </div>
      )}

      {/* Main Invitation Card */}
      <div className="relative z-10 max-w-md w-full bg-[#16181D]/95 border border-[#282C34] rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl text-center">
        {/* Skywear Brand Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border border-[#00FF66]/30 bg-[#00FF66]/10 text-[#00FF66] mb-5">
          <Sparkles className="w-3 h-3" /> VIP REFERRAL INVITATION
        </div>

        {/* App Icon / Graphic */}
        <div className="relative w-20 h-20 mx-auto mb-5 rounded-2xl bg-[#0B0C10] border border-[#282C34] flex items-center justify-center shadow-[0_0_25px_rgba(0,255,102,0.2)]">
          <Image
            src="/android-chrome-192x192.png"
            alt="SKYWEAR"
            width={72}
            height={72}
            className="rounded-xl object-cover"
          />
        </div>

        {/* Referrer Callout */}
        <p className="text-xs font-mono uppercase tracking-wider text-[#8E929B] mb-1">
          YOU'VE BEEN INVITED BY
        </p>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-sans text-white mb-2">
          {referrerName}
        </h1>

        {/* Referral Code Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0B0C10] border border-[#282C34] font-mono text-xs text-[#00FF66] mb-6">
          <span className="text-[#8E929B]">CODE:</span>
          <span className="font-bold tracking-wider">{code}</span>
          <ShieldCheck className="w-4 h-4 text-[#00FF66]" />
        </div>

        {/* Exclusive Benefits Bento Box */}
        <div className="bg-[#0B0C10] border border-[#282C34] rounded-xl p-4 text-left text-xs mb-6 space-y-3">
          <div className="flex items-center gap-3 text-white">
            <div className="w-7 h-7 rounded-lg bg-[#00FF66]/10 border border-[#00FF66]/20 flex items-center justify-center text-[#00FF66] shrink-0">
              <Gift className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-white leading-snug">100% Instant Cashback</p>
              <p className="text-[11px] text-[#8E929B]">Credited automatically to your Skywear coin wallet</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-white">
            <div className="w-7 h-7 rounded-lg bg-[#00F0FF]/10 border border-[#00F0FF]/20 flex items-center justify-center text-[#00F0FF] shrink-0">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-white leading-snug">240 GSM Luxury Apparel</p>
              <p className="text-[11px] text-[#8E929B]">Exclusive heavy-duty oversized anime streetwear</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Primary Action: Install App */}
          <button
            onClick={handleInstallClick}
            disabled={installing}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-[#00FF66] hover:bg-[#00FF66]/90 text-[#0B0C10] font-bold text-sm tracking-wider uppercase transition-all duration-150 active:scale-[0.98] cursor-pointer shadow-[0_0_20px_rgba(0,255,102,0.35)] disabled:opacity-50"
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            {isStandalone
              ? "OPEN APP & CLAIM"
              : isIOS
              ? "INSTALL APP ON IPHONE"
              : "INSTALL APP & CLAIM CASHBACK"}
          </button>

          {/* Secondary Action: Continue on Web */}
          <Link
            href={`/register?ref=${code}`}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#0B0C10] hover:bg-[#20242c] border border-[#282C34] text-[#F5F5F7] text-xs font-semibold tracking-wider uppercase transition-colors"
          >
            CONTINUE ON WEB / BROWSER
            <ArrowRight className="w-3.5 h-3.5 text-[#8E929B]" />
          </Link>
        </div>

        {/* Small Trust Micro-copy */}
        <p className="text-[10px] text-[#8E929B]/70 mt-5">
          Referral code <span className="text-white font-mono">{code}</span> is locked & will auto-apply when you create your account.
        </p>
      </div>

      {/* iOS Instructions Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#16181D] border border-[#282C34] rounded-2xl p-6 max-w-sm w-full text-white space-y-4 shadow-2xl">
            <h3 className="font-bold text-base flex items-center gap-2">
              <Share2 className="w-4 h-4 text-[#00F0FF]" /> Add SKYWEAR to Home Screen
            </h3>
            <p className="text-xs text-[#8E929B] leading-relaxed">
              Install the official app in 2 taps to keep your referral bonus locked:
            </p>

            <div className="bg-[#0B0C10] rounded-xl p-3 border border-[#282C34] space-y-2.5 text-xs">
              <div className="flex items-center gap-2 text-neutral-200">
                <span className="w-5 h-5 rounded-full bg-[#16181D] border border-[#282C34] flex items-center justify-center font-mono text-[10px] text-[#00FF66]">1</span>
                <span>Tap Safari's <Share2 className="w-3.5 h-3.5 inline text-[#00F0FF] mx-1" /> <strong>Share</strong> icon below</span>
              </div>
              <div className="flex items-center gap-2 text-neutral-200">
                <span className="w-5 h-5 rounded-full bg-[#16181D] border border-[#282C34] flex items-center justify-center font-mono text-[10px] text-[#00FF66]">2</span>
                <span>Scroll & tap <PlusSquare className="w-3.5 h-3.5 inline text-[#00FF66] mx-1" /> <strong>Add to Home Screen</strong></span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Link
                href={`/register?ref=${code}`}
                className="flex-1 py-2.5 text-center text-xs font-bold uppercase rounded-xl bg-[#00FF66] text-[#0B0C10]"
              >
                Or Continue on Web
              </Link>
              <button
                onClick={() => setShowIOSModal(false)}
                className="py-2.5 px-4 text-xs font-medium rounded-xl bg-[#0B0C10] border border-[#282C34] text-[#8E929B]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
