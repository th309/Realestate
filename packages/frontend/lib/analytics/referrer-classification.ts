/**
 * Referrer channel classification.
 *
 * Turns a raw referrer URL into an acquisition channel. This replaces the
 * previous binary split in session-context.ts, which labelled EVERY non-email
 * referrer as "organic" — collapsing search, social, AI assistants and genuine
 * backlinks into one indistinguishable bucket.
 *
 * Pure and dependency-free (no window/document access) so it can be unit
 * tested directly and reused server-side if we ever classify from the
 * forwarded Referer header.
 */

export type ReferrerChannel =
  | "utm"
  | "internal"
  | "ai"
  | "email"
  | "search"
  | "social"
  | "referral"
  | "direct";

/**
 * Suffix-matched host lists. Matching is on the registrable tail, so
 * "www.google.com" and "com.google.android.googlequicksearchbox" both need
 * their own entries — Android app referrers use reversed-DNS package names.
 */
const AI_HOSTS = [
  "chatgpt.com",
  "chat.openai.com",
  "claude.ai",
  "perplexity.ai",
  "copilot.microsoft.com",
  "gemini.google.com",
  "notebooklm.google.com",
  "duck.ai",
  "poe.com",
  "you.com",
  "phind.com",
];

const SEARCH_HOSTS = [
  "google.com",
  "bing.com",
  "duckduckgo.com",
  "search.yahoo.com",
  "search.brave.com",
  "kagi.com",
  "ecosia.org",
  "startpage.com",
  "baidu.com",
  "yandex.com",
  "com.google.android.googlequicksearchbox",
];

const SOCIAL_HOSTS = [
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "t.co",
  "linkedin.com",
  "lnkd.in",
  "reddit.com",
  "youtube.com",
  "tiktok.com",
  "pinterest.com",
  "threads.net",
  "news.ycombinator.com",
];

const EMAIL_HOSTS = [
  "mail.google.com",
  "outlook.live.com",
  "outlook.office.com",
  "mail.yahoo.com",
  "com.google.android.gm",
];

/** Hosts that are us. Traffic from these is internal navigation, not acquisition. */
const INTERNAL_HOSTS = ["propertyiq.app", "localhost"];

function matchesHost(hostname: string, list: string[]): boolean {
  return list.some(
    (candidate) => hostname === candidate || hostname.endsWith(`.${candidate}`),
  );
}

/** True when a hostname is one of ours — used to skip self-referrals and to
 *  tell internal navigation apart from genuine outbound clicks. */
export function isInternalHost(hostname: string): boolean {
  return matchesHost(hostname.toLowerCase(), INTERNAL_HOSTS);
}

/** Extract a hostname from a referrer URL, or null when absent/malformed. */
export function referrerHostname(referrer?: string): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.toLowerCase();
  } catch {
    // Android app referrers ("com.google.android.gm") are not valid URLs but
    // are still meaningful sources, so fall back to the raw value.
    const raw = referrer.trim().toLowerCase();
    return raw.includes("/") || raw === "" ? null : raw;
  }
}

/**
 * Classify a session's acquisition channel.
 *
 * Order matters. AI is checked before search because several assistants live
 * on search-engine domains (notebooklm.google.com, copilot.microsoft.com) and
 * would otherwise be miscounted as organic search — the exact conflation this
 * module exists to fix.
 */
export function classifyReferrer(
  referrer: string | undefined,
  utmSource?: string,
): { channel: ReferrerChannel; sourceDomain: string | null } {
  const hostname = referrerHostname(referrer);

  if (utmSource) return { channel: "utm", sourceDomain: hostname };
  if (!hostname) return { channel: "direct", sourceDomain: null };
  if (matchesHost(hostname, INTERNAL_HOSTS))
    return { channel: "internal", sourceDomain: hostname };
  if (matchesHost(hostname, AI_HOSTS))
    return { channel: "ai", sourceDomain: hostname };
  if (matchesHost(hostname, EMAIL_HOSTS))
    return { channel: "email", sourceDomain: hostname };
  if (matchesHost(hostname, SEARCH_HOSTS))
    return { channel: "search", sourceDomain: hostname };
  if (matchesHost(hostname, SOCIAL_HOSTS))
    return { channel: "social", sourceDomain: hostname };

  return { channel: "referral", sourceDomain: hostname };
}
