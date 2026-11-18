"use client";

import React, { useEffect } from "react";
import { Theme } from "@astryxdesign/core/theme";
import { themes, defaultThemeSlug } from "@/astryx-themes";
import { useAdminTheme } from "@/components/admin/AdminTheme";
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";

/**
 * Astryx clears the root theme attributes on unmount, so restore the storefront's
 * fixed light mode for whichever page mounts next.
 */
function useRestoreAppTheme() {
  useEffect(() => {
    return () => {
      const root = document.documentElement;
      root.classList.remove("dark");
      root.classList.add("light");
      root.setAttribute("data-theme", "light");
    };
  }, []);
}

export function AstryxAdminTheme({ children }: { children: React.ReactNode }) {
  const { theme } = useAdminTheme();
  useRestoreAppTheme();
  return (
    <Theme theme={themes[defaultThemeSlug]} mode={theme}>
      {children}
    </Theme>
  );
}
