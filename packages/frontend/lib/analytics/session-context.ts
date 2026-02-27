/**
 * Session context collector — captures acquisition, device, and referrer data.
 * Computed once per session and cached in sessionStorage.
 * DATA LAYER EXEMPTION: Analytics context collection, not data fetching.
 */

const SESSION_CTX_KEY = "piq-session-ctx";

export interface SessionContext {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
  referrer_domain?: string;
  entry_type: "utm" | "email" | "organic" | "direct";
  device_type: "mobile" | "tablet" | "desktop";
  screen_width: number;
  browser: string;
  os: string;
}

const EMAIL_DOMAINS = ["mail.google.com", "outlook.live.com", "mail.yahoo.com"];

function detectEntryType(
  utmSource?: string,
  referrer?: string,
): SessionContext["entry_type"] {
  if (utmSource) return "utm";
  if (referrer) {
    try {
      const domain = new URL(referrer).hostname;
      if (EMAIL_DOMAINS.some((d) => domain.includes(d))) return "email";
    } catch {
      // Invalid referrer URL
    }
    return "organic";
  }
  return "direct";
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
  let referrerDomain: string | undefined;
  if (referrer) {
    try {
      referrerDomain = new URL(referrer).hostname;
    } catch {
      // Invalid referrer
    }
  }

  const utmSource = params.get("utm_source") || undefined;
  const utmMedium = params.get("utm_medium") || undefined;
  const utmCampaign = params.get("utm_campaign") || undefined;

  const ctx: SessionContext = {
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: utmCampaign,
    referrer,
    referrer_domain: referrerDomain,
    entry_type: detectEntryType(utmSource, referrer),
    device_type: detectDeviceType(screen.width),
    screen_width: screen.width,
    browser: detectBrowser(ua),
    os: detectOS(ua),
  };

  sessionStorage.setItem(SESSION_CTX_KEY, JSON.stringify(ctx));
  return ctx;
}
