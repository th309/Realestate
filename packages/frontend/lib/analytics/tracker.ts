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

// Telemetry posts to a same-origin Next.js proxy (app/api/usage/*) which
// forwards to the backend. Going same-origin bypasses third-party-tracker
// blocking by privacy extensions (uBlock, Adblock Plus + EasyPrivacy, etc.).
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
  user_id?: string;
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
let currentUserId: string | null = null;
let trackingExcluded = false;
let currentVariant: string | null = null;

/**
 * Set the landing A/B variant ('A' | 'B') to auto-stamp onto every event's
 * `properties` JSONB. No-op until set, so this is inert outside the homepage.
 * The per-variant conversion readout filters on `properties->>'variant'`.
 */
export function setVariant(variant: string | null): void {
  currentVariant = variant;
}

let variantCookieCache: string | null | undefined; // undefined = not yet read
function readVariantCookie(): string | null {
  if (variantCookieCache !== undefined) return variantCookieCache;
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )piq-variant=([^;]*)/);
  variantCookieCache = match ? decodeURIComponent(match[1]) : null;
  return variantCookieCache;
}

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
 * Forward an event to GA4 (gtag) in addition to the internal pipeline.
 *
 * The internal `trackEvent` above posts to our own `user_events` store and
 * never reaches Google Analytics, so GA4 shows 0 conversions even when the
 * internal funnel is healthy. Use this for events we want visible as GA4 key
 * events (e.g. `sign_up`). Fire-and-forget; self-gates on `window.gtag`, so it
 * no-ops during SSR and when GA is unconfigured (NEXT_PUBLIC_GA_MEASUREMENT_ID
 * unset). Mirrors the guard in components/analytics/WebVitals.tsx.
 *
 * Best-effort: no retry or dataLayer buffering, so an event fired before gtag
 * finishes loading is dropped. Acceptable here because both signup call sites
 * fire deep in the flow (post-OTP / after async round-trips), well after GA's
 * afterInteractive load — not at cold page load.
 */
export function gtagEvent(
  name: string,
  params: Record<string, unknown> = {},
): void {
  if (typeof window === "undefined") return;
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void })
    .gtag;
  if (typeof gtag !== "function") return;
  gtag("event", name, params);
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
  if (trackingExcluded) return;

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

  // Stamp the landing A/B variant on every event so the funnel readout can group
  // by variant (properties->>'variant'). Falls back to the sticky piq-variant
  // cookie so events fired AFTER the visitor leaves `/` (e.g. signup_completed
  // on /auth/*) still carry the assignment. Inert for visitors with no cookie.
  const variant = currentVariant ?? readVariantCookie();
  if (variant && enrichedProperties.variant == null) {
    enrichedProperties = { ...enrichedProperties, variant };
  }

  const event: AnalyticsEvent = {
    client_event_id: generateClientEventId(),
    event_type: eventCategory,
    event_name: eventAction,
    event_category: eventCategory,
    event_action: eventAction,
    visitor_id: getVisitorId(),
    user_id: currentUserId || undefined,
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
 * Set the authenticated user ID for inclusion in events.
 */
export function setUserId(userId: string | null): void {
  currentUserId = userId;
}

/**
 * Exclude this browser from all analytics tracking.
 * Called when the authenticated user's email matches the exclusion list.
 */
export function setTrackingExcluded(excluded: boolean): void {
  trackingExcluded = excluded;
}

/**
 * Check if tracking is currently excluded.
 */
export function isTrackingExcluded(): boolean {
  return trackingExcluded;
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
    const sent = navigator.sendBeacon(`/api/usage/events`, blob);
    if (sent) return;
  }

  // Fallback to fetch (fire and forget)
  fetch(`/api/usage/events`, {
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
