"use client";

import * as React from "react";
import { api } from "@/lib/client";
import type { CustomerAccount } from "@/data/rewardsEngine";

interface SessionSnapshot {
  loggedIn: boolean;
  customer: CustomerAccount | null;
}

interface SessionContextValue extends SessionSnapshot {
  refresh: () => Promise<void>;
}

const SessionContext = React.createContext<SessionContextValue | null>(null);

export function SessionProvider({
  initialLoggedIn,
  initialCustomer,
  children,
}: {
  initialLoggedIn: boolean;
  initialCustomer: CustomerAccount | null;
  children: React.ReactNode;
}) {
  const [session, setSession] = React.useState<SessionSnapshot>({
    loggedIn: initialLoggedIn,
    customer: initialCustomer,
  });

  const refresh = React.useCallback(async () => {
    try {
      const res = await api.session();
      setSession({ loggedIn: Boolean(res.customer), customer: res.customer });
    } catch {
      // Transient network failure: keep the last known session instead of flapping signed-out.
    }
  }, []);

  React.useEffect(() => {
    const handleAuthChange = () => {
      void refresh();
    };
    window.addEventListener("zenin:auth_change", handleAuthChange);
    return () => window.removeEventListener("zenin:auth_change", handleAuthChange);
  }, [refresh]);

  return (
    <SessionContext.Provider value={{ ...session, refresh }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = React.useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
