"use client";

import React from "react";
import Link from "next/link";
import { Home, Layers, Gift, Package, User } from "lucide-react";

interface BottomNavProps {
  onGoHome: () => void;
  onGoCatalog: () => void;
  onOpenOrders: () => void;
  onOpenAccount: () => void;
  walletPoints: number;
}

const CELL = "flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-none transition-[color,transform] duration-75 active:scale-95";

export default function BottomNav({
  onGoHome,
  onGoCatalog,
  onOpenOrders,
  onOpenAccount,
  walletPoints,
}: BottomNavProps) {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0B0C10] border-t border-[#282C34] pt-1.5 pb-[max(6px,env(safe-area-inset-bottom))] flex items-stretch justify-around text-[#8E929B] font-mono text-[10px] tracking-wider uppercase">
      <button onClick={onGoHome} className={`${CELL} hover:text-[#F5F5F7]`}>
        <Home className="w-5 h-5" />
        <span>Home</span>
      </button>

      <button onClick={onGoCatalog} className={`${CELL} hover:text-[#F5F5F7]`}>
        <Layers className="w-5 h-5" />
        <span>Drops</span>
      </button>

      {/* Wallet has its own page */}
      <Link href="/wallet" className={`${CELL} text-[#00FF66] hover:text-[#00FF66]/80 relative`}>
        <div className="relative">
          <Gift className="w-5 h-5" />
          {walletPoints > 0 && (
            <span className="absolute -top-1 -right-2 px-1 py-0.2 bg-[#00FF66] text-[#0B0C10] font-black text-[9px] rounded-none">
              {walletPoints}
            </span>
          )}
        </div>
        <span>Wallet</span>
      </Link>

      <button onClick={onOpenOrders} className={`${CELL} hover:text-[#F5F5F7]`}>
        <Package className="w-5 h-5" />
        <span>Orders</span>
      </button>

      <button onClick={onOpenAccount} className={`${CELL} hover:text-[#F5F5F7]`}>
        <User className="w-5 h-5" />
        <span>Account</span>
      </button>
    </nav>
  );
}
