"use client";

import { useEffect, useState } from "react";
import { registerServiceWorker } from "@/lib/pwa/register-service-worker";

/**
 * Registers the service worker on mount and renders a non-blocking M3
 * snackbar when an update is waiting to activate. The user must tap
 * "Refresh" to apply it — this component never auto-reloads on its own.
 * Tapping the dismiss (×) action just hides the snackbar for this mount;
 * the waiting worker is untouched, so the snackbar can reappear on the next
 * full load until the user refreshes.
 *
 * Not mounted anywhere yet; the controller wires this into AppShell/Providers.
 */
export function ServiceWorkerManager() {
  const [applyUpdate, setApplyUpdate] = useState<(() => void) | null>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    registerServiceWorker((apply) => {
      setApplyUpdate(() => apply);
      // Defer a frame so the entrance transition actually runs instead of
      // mounting already in its "shown" state.
      requestAnimationFrame(() => setVisible(true));
    });
  }, []);

  if (!applyUpdate || dismissed) return null;

  return (
    <div
      role="status"
      // Mobile: stack above BottomNavBar (fixed, 64px + safe-area — see
      // BOTTOM_NAV_HEIGHT_PX in src/components/layout/BottomNavBar.tsx) plus
      // a 16px gap, since that CSS var doesn't cascade to this sibling.
      // Desktop: nav doesn't render, so float with a small margin.
      className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom)+16px)] lg:bottom-4 z-[100] flex justify-center px-4 pb-safe pointer-events-none"
    >
      <div
        className={`pointer-events-auto flex items-center gap-4 rounded-lg bg-inverse-surface px-4 py-3 shadow-lg transition-all duration-200 ${
          visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
      >
        <span className="text-sm font-medium text-inverse-on-surface">
          New version available
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={applyUpdate}
            className="text-sm font-semibold text-inverse-primary hover:underline"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss update notification"
            className="text-inverse-on-surface/70 hover:text-inverse-on-surface text-lg leading-none p-1"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
