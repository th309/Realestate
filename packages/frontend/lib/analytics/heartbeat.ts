/**
 * Heartbeat hook — sends lightweight keepalive pings while the tab is visible.
 * Used to compute accurate session duration (30s resolution).
 * DATA LAYER EXEMPTION: Analytics emission, not data fetching.
 */
"use client";

import { useEffect } from "react";
import { getVisitorId } from "./visitor-identity";
import { getAnonymousSessionId } from "@/lib/entitlements/session";
import { isTrackingExcluded } from "./tracker";

const HEARTBEAT_INTERVAL = 30000; // 30 seconds

/**
 * One early ping, well before the 30s cadence.
 *
 * Without it, session duration is derived from a single beacon, so
 * `last_activity_at === started_at` and duration is 0 for anyone who leaves
 * inside the first 30 seconds — which was ~95% of all sessions. That made a
 * real visitor who read a page for 10 seconds byte-for-byte identical to a
 * one-shot crawler hit, and left average-duration metrics meaningless.
 *
 * A crawler that renders for a fraction of a second never reaches this ping, so
 * a non-zero duration becomes positive evidence of a human.
 */
const EARLY_HEARTBEAT_MS = 5000; // 5 seconds

export function useHeartbeat() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let earlyTimeoutId: ReturnType<typeof setTimeout> | null = null;

    function sendHeartbeat() {
      if (document.visibilityState !== "visible") return;
      if (isTrackingExcluded()) return;

      const payload = JSON.stringify({
        session_id: getAnonymousSessionId(),
        visitor_id: getVisitorId(),
      });

      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon(`/api/usage/heartbeat`, blob);
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        if (!intervalId) {
          intervalId = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
        }
      } else {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }
    }

    // Start immediately if visible
    if (document.visibilityState === "visible") {
      // One early ping so sub-30s visits register a real duration, then the
      // regular cadence takes over.
      earlyTimeoutId = setTimeout(sendHeartbeat, EARLY_HEARTBEAT_MS);
      intervalId = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (earlyTimeoutId) clearTimeout(earlyTimeoutId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}
