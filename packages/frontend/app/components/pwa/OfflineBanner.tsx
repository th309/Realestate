"use client";

import { WifiOff } from "lucide-react";
import { useVerifiedOffline } from "@/lib/hooks/use-verified-offline";

/**
 * Persistent top banner shown while the app is genuinely offline — reassures
 * the user they're looking at the last saved data, not a broken app. Always
 * mounted (never conditionally returns null) so the transform transition can
 * slide it in on offline and back out on reconnect instead of popping.
 *
 * Keys off `useVerifiedOffline`, NOT the raw `navigator.onLine`: that flag
 * false-positives (it stranded this banner on-screen while the network worked),
 * so we only show after a real same-origin request actually fails.
 *
 * Top-anchored, below the page header — the bottom slot is already crowded with
 * InstallBanner and ServiceWorkerManager's update snackbar.
 */
export function OfflineBanner() {
  const isOffline = useVerifiedOffline();

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-0 inset-x-0 z-[60] pt-safe px-4 pointer-events-none transition-transform duration-200 ease-out ${
        isOffline ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      {/* z-[60] beats the sticky Header's z-50 (same-z DOM order painted the
          header over this banner — it never showed); the whole overlay stays
          pointer-events-none since the pill has no interactive content, so
          header taps pass through where they overlap. */}
      <div className="max-w-md mx-auto mt-2 rounded-xl shadow-sm bg-inverse-surface px-4 py-2.5 flex items-center gap-2">
        <WifiOff className="w-4 h-4 text-inverse-on-surface shrink-0" />
        <p className="text-sm font-medium text-inverse-on-surface">
          You&rsquo;re offline — showing saved data
        </p>
      </div>
    </div>
  );
}
