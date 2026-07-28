/**
 * Session context collector — captures acquisition, device, and referrer data.
 * Computed once per session and cached in sessionStorage.
 * DATA LAYER EXEMPTION: Analytics context collection, not data fetching.
 */

import {
  classifyReferrer,
  type ReferrerChannel,
} from "./referrer-classification";

const SESSION_CTX_KEY = "piq-session-ctx";

export interface SessionContext {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
  referrer_domain?: string;
  /**
   * Acquisition channel. Previously only ever "utm" | "email" | "organic" |
   * "direct", where "organic" meant "had any referrer at all" — search, social,
   * AI assistants and backlinks were indistinguishable. Now classified properly
   * by `classifyReferrer`. Historical rows keep the old "organic" value.
   */
  entry_type: ReferrerChannel;
  device_type: "mobile" | "tablet" | "desktop";
  screen_width: number;
  browser: string;
  os: string;
}

function detectDeviceType(width: number): SessionContext["device_type"] {
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

function detectBrowser(ua: string): string {
  if (ua.includes("Firefox/")) return "Firefox";
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("Chrome/")) return "Chrome";
  if (ua.includes("Safari/") && !ua.includes("Chrome")) return "Safari";
  return "Other";
}

function detectOS(ua: string): string {
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac OS")) return "macOS";
  if (ua.includes("Linux")) return "Linux";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  return "Other";
}

export function getSessionContext(): SessionContext {
  if (typeof window === "undefined") {
    return {
      entry_type: "direct",
      device_type: "desktop",
      screen_width: 0,
      browser: "Unknown",
      os: "Unknown",
    };
  }

  const cached = sessionStorage.getItem(SESSION_CTX_KEY);
  if (cached) {
    try {
      return JSON.parse(cached) as SessionContext;
    } catch {
      // Corrupted cache, recompute
    }
  }

  const params = new URLSearchParams(window.location.search);
  const ua = navigator.userAgent;
  const referrer = document.referrer || undefined;

  const utmSource = params.get("utm_source") || undefined;
  const utmMedium = params.get("utm_medium") || undefined;
  const utmCampaign = params.get("utm_campaign") || undefined;

  const { channel, sourceDomain } = classifyReferrer(referrer, utmSource);

  const ctx: SessionContext = {
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: utmCampaign,
    referrer,
    referrer_domain: sourceDomain ?? undefined,
    entry_type: channel,
    device_type: detectDeviceType(screen.width),
    screen_width: screen.width,
    browser: detectBrowser(ua),
    os: detectOS(ua),
  };

  sessionStorage.setItem(SESSION_CTX_KEY, JSON.stringify(ctx));
  return ctx;
}
