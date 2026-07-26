"use client";

import { useEffect, useState } from "react";
import { useOnlineStatus } from "./use-online-status";

// Same-origin, non-image static asset — safe from host-scoped content blockers
// (the thing that filters cross-origin image requests can't touch this), and
// present in every build. Cache-busted + no-store so we measure the live
// network rather than a cached or service-worker response.
const PROBE_URL = "/manifest.webmanifest";
const PROBE_TIMEOUT_MS = 3000;
const RECHECK_INTERVAL_MS = 15_000;

/**
 * Whether a real same-origin request reaches our own origin. Any response —
 * even a 404 — proves connectivity; only a network error / timeout counts as
 * unreachable.
 */
async function originReachable(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(`${PROBE_URL}?connectivity=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Verified "offline" signal for user-facing offline UI.
 *
 * `navigator.onLine` is unreliable in both directions: it can report offline
 * while the network is fine (a browser extension or VPN quirk), and it can miss
 * the transition back to online and strand a stale value. So we never surface
 * "offline" on the browser flag alone — only when the browser says offline AND
 * a lightweight same-origin request actually fails. While offline we re-probe
 * on an interval so the state clears itself even if no `online` event ever
 * fires. This is what the OfflineBanner should key off; the raw
 * `useOnlineStatus` remains for non-blocking hints.
 */
export function useVerifiedOffline(): boolean {
  const browserOnline = useOnlineStatus();
  // Tracks ONLY the probe outcome; whether we're online is derived below so the
  // effect never has to setState synchronously (which would cascade-render).
  const [probeFailed, setProbeFailed] = useState(false);

  useEffect(() => {
    // Trust "online": no probe needed, and the derived return already treats
    // an online browser as not-offline regardless of the last probe result.
    if (browserOnline) return;

    // Browser says offline — verify before showing anything. setState happens
    // only inside this async callback, never in the effect body.
    let cancelled = false;
    const check = async () => {
      const reachable = await originReachable();
      if (!cancelled) setProbeFailed(!reachable);
    };
    void check();
    const interval = setInterval(() => void check(), RECHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [browserOnline]);

  // Offline only when the browser says offline AND a real request confirmed it.
  return !browserOnline && probeFailed;
}
