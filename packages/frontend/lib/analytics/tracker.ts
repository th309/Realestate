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

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const BATCH_INTERVAL = 5000; // 5 seconds
const MAX_BATCH_SIZE = 50;

interface AnalyticsEvent {
  event_type: string;
  event_name: string;
  properties: Record<string, unknown>;
  user_tier?: string;
  page_path?: string;
  session_id?: string;
  timestamp: string;
}

let eventQueue: AnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let initialized = false;

function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = sessionStorage.getItem('piq-anon-session-id');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('piq-anon-session-id', id);
  }
  return id;
}

function getPagePath(): string {
  if (typeof window === 'undefined') return '';
  return window.location.pathname;
}

function getUserTier(): string | undefined {
  // Read from entitlements context if available, stored in sessionStorage
  if (typeof window === 'undefined') return undefined;
  return sessionStorage.getItem('piq-user-tier') || undefined;
}

/**
 * Track an analytics event
 *
 * @param eventName - Event name (e.g., 'paywall.view', 'feature.market_save')
 * @param properties - Additional event properties
 */
export function trackEvent(
  eventName: string,
  properties: Record<string, unknown> = {},
): void {
  if (typeof window === 'undefined') return;

  // Parse event type from name (e.g., 'paywall.view' -> type='paywall', name='view')
  const [eventType, ...rest] = eventName.split('.');
  const name = rest.join('.') || eventName;

  const event: AnalyticsEvent = {
    event_type: eventType,
    event_name: name,
    properties,
    user_tier: getUserTier(),
    page_path: getPagePath(),
    session_id: getSessionId(),
    timestamp: new Date().toISOString(),
  };

  eventQueue.push(event);

  // Flush if batch is full
  if (eventQueue.length >= MAX_BATCH_SIZE) {
    flush();
  }

  // Initialize periodic flush and unload handler
  if (!initialized) {
    initialize();
  }
}

/**
 * Set the user tier for auto-inclusion in events
 */
export function setUserTier(tier: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem('piq-user-tier', tier);
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
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' });
    const sent = navigator.sendBeacon(`${API_URL}/api/analytics/events`, blob);
    if (sent) return;
  }

  // Fallback to fetch (fire and forget)
  fetch(`${API_URL}/api/analytics/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => {
    // Silently fail — analytics should never break the app
  });
}

function initialize(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  // Periodic flush
  flushTimer = setInterval(flush, BATCH_INTERVAL);

  // Flush on page unload
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flush();
    }
  });

  // Also flush on beforeunload as a fallback
  window.addEventListener('beforeunload', flush);
}
