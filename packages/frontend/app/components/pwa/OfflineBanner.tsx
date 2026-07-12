"use client";

import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";

/**
 * Persistent top banner shown while the browser has no network connection —
 * reassures the user they're looking at the last saved data, not a broken
 * app. Always mounted (never conditionally returns null) so the transform
 * transition can slide it in on offline and back out on reconnect instead
 * of popping.
 *
 * Not mounted anywhere yet; the controller wires this into
 * providers.tsx/AppShell. Top-anchored, below the page header — the bottom
 * slot is already crowded with InstallBanner and ServiceWorkerManager's
 * update snackbar.
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-0 inset-x-0 z-50 pt-safe px-4 pointer-events-none transition-transform duration-200 ease-out ${
        isOnline ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="pointer-events-auto max-w-md mx-auto mt-2 rounded-xl shadow-sm bg-inverse-surface px-4 py-2.5 flex items-center gap-2">
        <WifiOff className="w-4 h-4 text-inverse-on-surface shrink-0" />
        <p className="text-sm font-medium text-inverse-on-surface">
          You&rsquo;re offline — showing saved data
        </p>
      </div>
    </div>
  );
}
