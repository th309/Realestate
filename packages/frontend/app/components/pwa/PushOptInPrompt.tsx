"use client";

import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics/tracker";
import { useAuth } from "@/lib/auth";
import { usePushSubscription } from "@/lib/pwa/use-push-subscription";

const DISMISSED_STORAGE_KEY = "piq-push-prompt-dismissed";

/**
 * Fired by lib/watchlist/useWatchlist.ts on a successful watchlist add.
 * Kept as a literal in both files (rather than a shared constant import)
 * because useWatchlist.ts's edit budget for this feature is one line.
 */
const MARKET_WATCHED_EVENT = "piq:market-watched";

/**
 * In-context push notification opt-in prompt — appears only after the user
 * watches a market (never on page load; see MARKET_WATCHED_EVENT above).
 * Self-contained: decides on its own whether to render, so it's safe to
 * mount anywhere in the tree that stays alive across route changes (same
 * pattern as InstallBanner.tsx, whose bottom-slot offset convention this
 * reuses via `--piq-install-banner-visible`).
 *
 * Not mounted anywhere yet; the controller wires this into AppShell
 * alongside InstallBanner/ServiceWorkerManager.
 */
export function PushOptInPrompt() {
  const { user } = useAuth();
  const { isSupported, permission, subscribe, resubscribeIfNeeded } =
    usePushSubscription();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const shownFiredRef = useRef(false);

  useEffect(() => {
    setDismissed(!!window.localStorage.getItem(DISMISSED_STORAGE_KEY));
  }, []);

  useEffect(() => {
    function handleMarketWatched() {
      if (!isSupported || !user) return;
      if (permission === "granted") {
        // Already opted in on some other device/session but this device has
        // no active subscription (new browser profile, cleared site data) —
        // silently re-register instead of prompting again.
        resubscribeIfNeeded();
        return;
      }
      if (permission === "default" && !dismissed) {
        setVisible(true);
      }
    }
    window.addEventListener(MARKET_WATCHED_EVENT, handleMarketWatched);
    return () =>
      window.removeEventListener(MARKET_WATCHED_EVENT, handleMarketWatched);
  }, [isSupported, user, permission, dismissed, resubscribeIfNeeded]);

  useEffect(() => {
    if (!visible || shownFiredRef.current) return;
    shownFiredRef.current = true;
    trackEvent("pwa.push_prompt_shown", {});
  }, [visible]);

  function handleDismiss() {
    trackEvent("pwa.push_prompt_dismissed", {});
    window.localStorage.setItem(DISMISSED_STORAGE_KEY, "1");
    setDismissed(true);
    setVisible(false);
  }

  async function handleEnableClick() {
    trackEvent("pwa.push_opt_in", {});
    // requestPermission() is called synchronously inside subscribe()'s call
    // stack, still within this click handler's user-gesture window.
    const success = await subscribe();
    if (success) setVisible(false);
    // On denial, permission flips to "denied" — the eligibility check above
    // only shows this for "default", so it won't reappear on its own.
  }

  if (!visible) return null;

  return (
    <div
      // Mirrors InstallBanner's bottom-anchored slot, nudged above it via
      // `--piq-install-banner-visible` (set by InstallBanner.tsx) so the two
      // never overlap if both are eligible at once. 84px matches the value
      // ServiceWorkerManager's snackbar calibrated against the banner's
      // tallest (Android/native-prompt) variant — see its className comment.
      className="fixed bottom-[calc(64px+env(safe-area-inset-bottom)+(var(--piq-install-banner-visible,0)*84px))] lg:bottom-[calc(24px+(var(--piq-install-banner-visible,0)*84px))] inset-x-0 z-50 pb-safe px-4 pb-4 pointer-events-none animate-in slide-in-from-bottom-4 duration-200"
    >
      <div
        role="dialog"
        aria-label="Enable notifications"
        className="pointer-events-auto max-w-md mx-auto rounded-xl shadow-sm bg-surface-container border border-outline-variant p-4 flex items-center gap-3"
      >
        <p className="flex-1 text-sm text-on-surface">
          Get notified when your watched markets move
        </p>
        <button
          onClick={handleEnableClick}
          className="px-4 py-2 rounded-full bg-primary text-on-primary text-sm font-semibold shrink-0 hover:bg-primary/90 transition-colors"
        >
          Turn on notifications
        </button>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss notification prompt"
          className="text-on-surface-variant hover:text-on-surface text-lg leading-none p-1 shrink-0"
        >
          ×
        </button>
      </div>
    </div>
  );
}
