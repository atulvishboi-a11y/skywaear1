"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import { Moon, Sun } from "lucide-react";

export type AdminTheme = "light" | "dark";

const STORAGE_KEY = "skywear.admin.theme";

const AdminThemeContext = createContext<{
  theme: AdminTheme;
  toggle: () => void;
} | null>(null);

// useLayoutEffect before first paint keeps a stored light theme from flashing dark.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function readStoredTheme(): AdminTheme {
  if (typeof window === "undefined") return "dark";
  try {
    return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<AdminTheme>(readStoredTheme);

  useIsoLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-admin-theme", theme);
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    return () => document.documentElement.removeAttribute("data-admin-theme");
  }, []);

  const toggle = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  return (
    <AdminThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </AdminThemeContext.Provider>
  );
}

export function useAdminTheme() {
  const context = useContext(AdminThemeContext);
  if (!context) throw new Error("useAdminTheme must be used inside AdminThemeProvider");
  return context;
}

export function AdminThemeToggle({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { theme, toggle } = useAdminTheme();
  const next = theme === "dark" ? "Light mode" : "Dark mode";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={theme === "light"}
      aria-label={`Switch to ${next.toLowerCase()}`}
      title={`Switch to ${next.toLowerCase()}`}
      className={
        compact
          ? `inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--adm-border)] bg-[var(--adm-surface)] text-[var(--adm-text-muted)] transition-colors hover:border-[var(--adm-accent)] hover:text-[var(--adm-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--adm-accent)] ${className}`
          : `inline-flex w-full items-center justify-center gap-2 rounded-md border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)] transition-colors hover:border-[var(--adm-accent)] hover:text-[var(--adm-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--adm-accent)] ${className}`
      }
    >
      {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
      {compact ? null : <span>{next}</span>}
    </button>
  );
}
