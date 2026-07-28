/**
 * Automated-traffic classification for incoming sessions.
 *
 * Context: roughly 95% of recorded sessions are crawlers. The www.google.com
 * referrer alone produced 26,944 sessions across 26,936 distinct visitors,
 * averaging 0.4 seconds and exactly 1.00 pages each. Until these are separated,
 * every dashboard number — visitors, bounce rate, conversion rate, traffic
 * sources — is a measurement of crawler behaviour.
 *
 * Classification happens at ingestion using the real browser User-Agent, which
 * only reaches us because the same-origin proxy forwards it as
 * `x-client-user-agent`. Client-reported `browser`/`device_type` are useless
 * here: they come from parsing navigator.userAgent, and headless Chrome
 * reports itself as ordinary desktop Chrome.
 */

/**
 * Signals available when a session row is first written.
 *
 * Deliberately narrow. A session is classified on its FIRST batch, when we know
 * the User-Agent and little else — duration is still 0 and the visitor has no
 * history yet, by definition. Those are not evidence of anything.
 */
export interface BotSignals {
  /** Raw User-Agent forwarded by the same-origin proxy. Empty when unknown. */
  userAgent: string;
  /** Pageviews in the first batch for this session. */
  pageCount: number;
}

/**
 * Substrings that appear in self-identifying crawler User-Agents.
 * Matched case-insensitively against the raw UA.
 */
export const KNOWN_BOT_UA_SUBSTRINGS = [
  'bot',
  'crawler',
  'spider',
  'slurp',
  'headlesschrome',
  'phantomjs',
  'puppeteer',
  'playwright',
  'selenium',
  'scrapy',
  'curl/',
  'wget/',
  'python-requests',
  'python-urllib',
  'go-http-client',
  'java/',
  'okhttp',
  'axios/',
  'node-fetch',
  'lighthouse',
  'pagespeed',
  'gptbot',
  'claudebot',
  'anthropic-ai',
  'perplexitybot',
  'ccbot',
  'bytespider',
  'ahrefs',
  'semrush',
  'mj12',
  'dotbot',
  'petalbot',
  'dataforseo',
  'facebookexternalhit',
  'embedly',
  'preview',
];

/** True when the User-Agent self-identifies as automation. */
export function hasBotUserAgent(userAgent: string): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return KNOWN_BOT_UA_SUBSTRINGS.some((needle) => ua.includes(needle));
}

/**
 * Decide whether a newly seen session is automated.
 *
 * Deliberately User-Agent only. The behavioural signature of the crawler cohort
 * (one pageview, sub-second duration, never returns) is real, but it is NOT
 * safely separable from a genuine visitor at write time:
 *
 *   - Duration is derived from `last_activity_at - started_at`, and the only
 *     thing that advances `last_activity_at` is the heartbeat. A real person who
 *     reads a page and leaves inside the heartbeat window therefore records a
 *     duration of 0 and exactly 1 pageview — byte-for-byte identical to a
 *     one-shot crawler hit.
 *   - "Never returns" is unknowable at insert; every visitor is new once.
 *
 * The error cost is asymmetric. A false positive hides a real person from a
 * funnel that sees roughly 8 signups a month, where losing even one visitor
 * distorts the conversion picture. A false negative merely leaves some crawler
 * noise in data that is already ~95% noise. That asymmetry says: flag only on a
 * definitive signal, never on a behavioural one that a real visitor also emits.
 *
 * Known limitation: this does not catch a headless crawler that spoofs an
 * ordinary browser User-Agent, and some of the observed google.com cohort may
 * do exactly that. Rather than guess, `heartbeat.ts` now sends an early ping a
 * few seconds in — see EARLY_HEARTBEAT_MS. Once that has been live for a few
 * days, a session with a real duration is demonstrably human, and any remaining
 * zero-duration cohort can be reclassified on evidence instead of assumption.
 */
export function classifyAsBot(sig: BotSignals): boolean {
  return hasBotUserAgent(sig.userAgent);
}
