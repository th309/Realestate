"use client";

import { useEffect, useState } from "react";
import { registerServiceWorker } from "@/lib/pwa/register-service-worker";

/**
 * Registers the service worker on mount and renders a non-blocking M3
 * snackbar when an update is waiting to activate. The user must tap
 * "Refresh" to apply it — this component never auto-reloads on its own.
 *
 * Not mounted anywhere yet; the controller wires this into AppShell/Providers.
 */
export function ServiceWorkerManager() {
  const [applyUpdate, setApplyUpdate] = useState<(() => void) | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    registerServiceWorker((apply) => {
      setApplyUpdate(() => apply);
      // Defer a frame so the entrance transition actually runs instead of
      // mounting already in its "shown" state.
      requestAnimationFrame(() => setVisible(true));
    });
  }, []);

  if (!applyUpdate) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-4 z-[100] flex justify-center px-4 pb-safe pointer-events-none"
    >
      <div
        className={`pointer-events-auto flex items-center gap-4 rounded-lg bg-inverse-surface px-4 py-3 shadow-lg transition-all duration-200 ${
          visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
      >
        <span className="text-sm font-medium text-inverse-on-surface">
          New version available
        </span>
        <button
          type="button"
          onClick={applyUpdate}
          className="text-sm font-semibold text-inverse-primary hover:underline"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
