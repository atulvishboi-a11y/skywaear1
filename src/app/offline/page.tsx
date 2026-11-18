"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { WifiOff, RefreshCw, ShoppingBag, Home, Zap } from "lucide-react";

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      // Auto-reload once network restores
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleRetry = () => {
    setRetrying(true);
    setTimeout(() => {
      window.location.reload();
    }, 400);
  };

  return (
    <main className="min-h-screen bg-[#0B0C10] text-[#F5F5F7] flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden font-mono selection:bg-[#00FF66] selection:text-[#0B0C10]">
      {/* Background ambient neon glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#00FF66]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-[#00F0FF]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Cyber Grid Lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#16181D_1px,transparent_1px),linear-gradient(to_bottom,#16181D_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

      <div className="relative z-10 max-w-md w-full bg-[#16181D]/90 border border-[#282C34] rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl text-center">
        {/* Signal Status Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase border border-red-500/30 bg-red-500/10 text-red-400 mb-6">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          {isOnline ? "Network Restored" : "Offline Protocol Active"}
        </div>

        {/* Icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[#0B0C10] border border-[#282C34] flex items-center justify-center text-[#00FF66] shadow-[0_0_30px_rgba(0,255,102,0.15)]">
          <WifiOff className="w-10 h-10 stroke-[1.5]" />
        </div>

        {/* Heading */}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-sans text-white mb-2">
          OFFLINE PROTOCOL
        </h1>

        <p className="text-[#8E929B] text-sm leading-relaxed mb-6">
          You're currently disconnected from the grid. Some cached features and your saved bag remain accessible, but live drops and checkout require an active connection.
        </p>

        {/* Status Box */}
        <div className="bg-[#0B0C10] border border-[#282C34] rounded-xl p-4 text-left text-xs mb-6 space-y-2">
          <div className="flex justify-between items-center text-[#8E929B]">
            <span>SYSTEM STATUS</span>
            <span className="text-[#00FF66] flex items-center gap-1 font-semibold">
              <Zap className="w-3 h-3" /> PWA STANDALONE
            </span>
          </div>
          <div className="flex justify-between items-center text-[#8E929B]">
            <span>CONNECTION</span>
            <span className={isOnline ? "text-[#00FF66] font-bold" : "text-red-400 font-bold"}>
              {isOnline ? "ONLINE — RECONNECTING..." : "DISCONNECTED"}
            </span>
          </div>
          <div className="flex justify-between items-center text-[#8E929B]">
            <span>SAVED BAG</span>
            <span className="text-white">STORED LOCALLY</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-[#00FF66] hover:bg-[#00FF66]/90 text-[#0B0C10] font-bold text-sm tracking-wide uppercase transition-all duration-150 active:scale-[0.98] cursor-pointer shadow-[0_0_20px_rgba(0,255,102,0.3)] disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${retrying ? "animate-spin" : ""}`} />
            {retrying ? "RECONNECTING..." : "TRY RECONNECTING"}
          </button>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <Link
              href="/"
              className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-[#0B0C10] hover:bg-[#1f232b] border border-[#282C34] text-white text-xs font-semibold tracking-wider uppercase transition-colors"
            >
              <Home className="w-3.5 h-3.5 text-[#8E929B]" />
              HOME
            </Link>
            <Link
              href="/cart"
              className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-[#0B0C10] hover:bg-[#1f232b] border border-[#282C34] text-white text-xs font-semibold tracking-wider uppercase transition-colors"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-[#00FF66]" />
              VIEW BAG
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center text-xs text-[#8E929B]/60 tracking-wider">
        SKYWEAR // 240 GSM HEAVYWEIGHT STREETWEAR APPAREL
      </div>
    </main>
  );
}
