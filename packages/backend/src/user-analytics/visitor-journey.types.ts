/**
 * Visitors tab — one visitor followed end to end.
 *
 * Split out of user-analytics.types.ts, which passed the 300-line hard limit
 * once these were added. Same arrangement as journey.types.ts: defined here,
 * re-exported from user-analytics.types.ts so consumers keep one import site.
 */

/**
 * A visitor's whole relationship with the product, aggregated across every
 * session in the window.
 *
 * `source`, `entryType` and `landingPage` come from the visitor's FIRST session,
 * so they describe acquisition rather than the most recent visit. `converted` is
 * true when a `signup_complete` event fired in one of those sessions — the only
 * conversion event that has ever been emitted.
 *
 * `visitorId` and `userId` are internal identifiers with no personal data
 * attached: the RPC returns no name, email or address, and none should be
 * joined in later.
 */
export interface VisitorSummary {
  visitorId: string;
  userId: string | null;
  userTier: string | null;
  firstSeen: string;
  lastSeen: string;
  sessions: number;
  pageviews: number;
  interactions: number;
  /** Engaged time, per-session capped at 30 minutes by the RPC. */
  totalSeconds: number;
  entryType: string | null;
  source: string | null;
  landingPage: string | null;
  converted: boolean;
}

export interface VisitorListResult {
  visitors: VisitorSummary[];
  /** True when the row cap was hit — more visitors exist beyond this page. */
  truncated: boolean;
  limit: number;
}

export type VisitorTimelineKind = 'session_start' | 'event';

/**
 * One moment in a visitor's journey.
 *
 * The two kinds carry different columns. A `session_start` puts the landing
 * page in `pagePath`, the entry type in `label`, and referrer/device/duration
 * in `properties`; category and action are null. An `event` fills category,
 * action, and the page it happened on.
 */
export interface VisitorTimelineEntry {
  occurredAt: string;
  sessionId: string;
  kind: VisitorTimelineKind;
  eventCategory: string | null;
  eventAction: string | null;
  pagePath: string | null;
  previousPagePath: string | null;
  label: string | null;
  properties: Record<string, unknown> | null;
}

export interface VisitorTimeline {
  visitorId: string;
  /** Chronological ascending, spanning every session of the visitor. */
  entries: VisitorTimelineEntry[];
  /** True when the cap was hit — the journey continues past the last entry. */
  truncated: boolean;
  limit: number;
  /** Distinct sessions in `entries` — not the visitor's lifetime session total. */
  sessionCount: number;
}
