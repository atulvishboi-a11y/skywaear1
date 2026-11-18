"use client";

import React, { useState, useEffect } from "react";
import { Wrench, X } from "lucide-react";

export default function MaintenanceBanner() {
  const [active, setActive] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const isDismissed = sessionStorage.getItem("skywear_maint_dismissed");
      if (isDismissed === "true") {
        setDismissed(true);
      }
      // Only show if explicitly enabled via window or param (prevents false downtime panic)
      const urlParams = new URLSearchParams(window.location.search);
      const isParamActive = urlParams.get("maintenance") === "1";
      const isWindowActive = (window as unknown as { SKYWEAR_MAINTENANCE?: boolean }).SKYWEAR_MAINTENANCE === true;
      if (isParamActive || isWindowActive) {
        setActive(true);
      }
    } catch {}
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem("skywear_maint_dismissed", "true");
    } catch {}
  };

  if (!active || dismissed) return null;

  return (
    <aside
      aria-label="Maintenance Notice"
      className="relative z-50 w-full overflow-hidden bg-[#181204] border-b border-amber-500/30 text-amber-200 px-3 sm:px-4 py-1.5 text-xs font-mono backdrop-blur-md"
    >
      <div className="max-w-[1440px] w-full mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
          <Wrench className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <p className="text-amber-100 text-[11px] truncate">
            <strong className="text-amber-300 font-bold uppercase">Scheduled Maintenance:</strong> Some live order notifications may experience minor latency.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="min-w-[32px] min-h-[32px] flex items-center justify-center p-1 text-amber-400/80 hover:text-amber-200 hover:bg-amber-500/20 rounded-md transition-colors"
          title="Dismiss notice"
          aria-label="Dismiss maintenance notice"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}
