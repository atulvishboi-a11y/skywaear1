import type { ZeninState } from "./store";
import seedStateData from "@/data/seed-state.json";

export function seedState(): ZeninState {
  try {
    if (seedStateData && (seedStateData as any).version) {
      return JSON.parse(JSON.stringify(seedStateData)) as ZeninState;
    }
  } catch (err) {
    console.error("[seedState] Failed to parse seed-state.json:", err);
  }

  // Fallback default if seed-state.json cannot be read
  return {
    version: 2,
    revision: 100,
    rewardRules: (seedStateData as any)?.rewardRules ?? {
      dailyClaimPercent: 3,
      minWithdrawalCoins: 500,
      referralCommissionPercent: 10,
    },
    support: (seedStateData as any)?.support ?? {
      phone: "+91 80855 20414",
      email: "support@skywear.in",
      hours: "10:00 AM - 7:00 PM IST",
      whatsappNumber: "+918085520414",
    },
    products: (seedStateData as any)?.products ?? [],
    customers: (seedStateData as any)?.customers ?? [],
    activeCustomerId: (seedStateData as any)?.activeCustomerId ?? "usr_aman_01",
    orders: (seedStateData as any)?.orders ?? [],
    transactions: (seedStateData as any)?.transactions ?? [],
    referrals: (seedStateData as any)?.referrals ?? [],
    withdrawals: (seedStateData as any)?.withdrawals ?? [],
    auditLogs: (seedStateData as any)?.auditLogs ?? [],
    notifications: (seedStateData as any)?.notifications ?? [],
    reviews: (seedStateData as any)?.reviews ?? [],
  };
}

