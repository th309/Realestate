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
const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export function useHeartbeat() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    function sendHeartbeat() {
      if (document.visibilityState !== "visible") return;
      if (isTrackingExcluded()) return;

      const payload = JSON.stringify({
        session_id: getAnonymousSessionId(),
        visitor_id: getVisitorId(),
      });

      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon(`${API_URL}/api/analytics/heartbeat`, blob);
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
      intervalId = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}
