/**
 * Lightweight analytics event tracker
 *
 * Batches events and sends them periodically (every 5 seconds)
 * or on page unload via navigator.sendBeacon.
 *
 * DATA LAYER EXEMPTION: This module is intentionally exempt from the
 * @/lib/data data-layer rule. It performs fire-and-forget event emission
 * (via sendBeacon / keepalive fetch), not data fetching. Routing analytics
 * through the data layer would add unnecessary overhead and is incompatible
 * with the sendBeacon API used during page unload.
 */

import { getAnonymousSessionId } from "@/lib/entitlements/session";
import { getVisitorId } from "./visitor-identity";
import { getSessionContext } from "./session-context";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const BATCH_INTERVAL = 5000; // 5 seconds
const MAX_BATCH_SIZE = 50;

function generateClientEventId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

interface AnalyticsEvent {
  client_event_id: string;
  event_type: string;
  event_name: string;
  event_category: string;
  event_action: string;
  visitor_id: string;
  properties: Record<string, unknown>;
  user_tier?: string;
  page_path?: string;
  session_id?: string;
  timestamp: string;
}

let eventQueue: AnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let initialized = false;
let sessionContextAttached = false;

function getSessionId(): string {
  return getAnonymousSessionId();
}

function getPagePath(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname;
}

function getUserTier(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return sessionStorage.getItem("piq-user-tier") || undefined;
}

/**
 * Track an analytics event
 *
 * @param eventName - Dot-separated name (e.g., 'pageview.view', 'feature.map_filter')
 *   The part before the dot becomes event_category, the part after becomes event_action.
 * @param properties - Additional event properties
 */
export function trackEvent(
  eventName: string,
  properties: Record<string, unknown> = {},
): void {
  if (typeof window === "undefined") return;

  // Parse category.action from name (e.g., 'pageview.view' -> category='pageview', action='view')
  const [eventCategory, ...rest] = eventName.split(".");
  const eventAction = rest.join(".") || eventName;

  // Attach session context on first event of each session
  let enrichedProperties = { ...properties };
  if (!sessionContextAttached) {
    const ctx = getSessionContext();
    enrichedProperties = { ...enrichedProperties, ...ctx };
    sessionContextAttached = true;
  }

  const event: AnalyticsEvent = {
    client_event_id: generateClientEventId(),
    event_type: eventCategory,
    event_name: eventAction,
    event_category: eventCategory,
    event_action: eventAction,
    visitor_id: getVisitorId(),
    properties: enrichedProperties,
    user_tier: getUserTier(),
    page_path: getPagePath(),
    session_id: getSessionId(),
    timestamp: new Date().toISOString(),
  };

  eventQueue.push(event);

  if (eventQueue.length >= MAX_BATCH_SIZE) {
    flush();
  }

  if (!initialized) {
    initialize();
  }
}

/**
 * Set the user tier for auto-inclusion in events
 */
export function setUserTier(tier: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem("piq-user-tier", tier);
}

/**
 * Flush queued events to the server
 */
export function flush(): void {
  if (eventQueue.length === 0) return;

  const events = [...eventQueue];
  eventQueue = [];

  const payload = JSON.stringify({ events });

  // Try sendBeacon first (works during page unload)
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" });
    const sent = navigator.sendBeacon(`${API_URL}/api/analytics/events`, blob);
    if (sent) return;
  }

  // Fallback to fetch (fire and forget)
  fetch(`${API_URL}/api/analytics/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {
    // Silently fail — analytics should never break the app
  });
}

function initialize(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  // Periodic flush
  flushTimer = setInterval(flush, BATCH_INTERVAL);

  // Flush on page unload
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flush();
    }
  });

  // Also flush on beforeunload as a fallback
  window.addEventListener("beforeunload", flush);
}
