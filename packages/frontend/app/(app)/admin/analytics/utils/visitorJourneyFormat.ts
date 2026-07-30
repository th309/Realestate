/**
 * Presentation logic for the Visitors tab.
 *
 * Pure functions, no React, so the timeline components stay under the component
 * line limit and the grouping rules can be reasoned about on their own.
 */

import type {
  VisitorTimelineEntry,
  VisitorSummary,
} from "@/lib/data/fetchers/admin-analytics.types";

/** The event that marks a conversion. The only one ever emitted. */
export const CONVERSION_ACTION = "signup_complete";

export function isConversionEntry(entry: VisitorTimelineEntry): boolean {
  return entry.kind === "event" && entry.eventAction === CONVERSION_ACTION;
}

/**
 * Internal identifiers are shown truncated.
 *
 * They are opaque keys, not names, and a full UUID on every row crowds out the
 * facts that actually tell the story. The full value stays available in a
 * `title` attribute for anyone who needs to copy it.
 */
export function truncateIdentifier(id: string, chars = 8): string {
  return id.length <= chars ? id : `${id.slice(0, chars)}…`;
}

/** `map_filter` → `Map filter`. Never surface a raw underscored token. */
export function humanizeToken(token: string): string {
  const spaced = token.replace(/[_-]+/g, " ").trim();
  if (!spaced) return "";
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function formatEngagedTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainderMinutes = minutes % 60;
  return remainderMinutes ? `${hours}h ${remainderMinutes}m` : `${hours}h`;
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatClockTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "3d ago" / "just now". Compact enough for a list row. */
export function formatRelativeFromNow(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  return describeElapsed(Date.now() - then, "ago");
}

/** The gap between two sessions, so returning visits read as a relationship. */
export function formatGapBetween(earlierIso: string, laterIso: string): string {
  const gap = new Date(laterIso).getTime() - new Date(earlierIso).getTime();
  if (Number.isNaN(gap) || gap < 60_000) return "";
  return describeElapsed(gap, "later");
}

function describeElapsed(ms: number, suffix: string): string {
  if (ms < 60_000) return suffix === "ago" ? "just now" : "";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m ${suffix}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${suffix}`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ${suffix}`;
  const months = Math.floor(days / 30);
  return `${months}mo ${suffix}`;
}

/** Span of the whole relationship, first touch to last. */
export function formatRelationshipSpan(visitor: VisitorSummary): string {
  const span =
    new Date(visitor.lastSeen).getTime() -
    new Date(visitor.firstSeen).getTime();
  if (Number.isNaN(span) || span < 86_400_000) return "Single day";
  const days = Math.round(span / 86_400_000);
  return days === 1 ? "1 day" : `${days} days`;
}

// ============================================================
// Session grouping
// ============================================================

export interface TimelineNode {
  key: string;
  entry: VisitorTimelineEntry;
  /** How many identical consecutive events collapsed into this node. */
  repeatCount: number;
}

export interface SessionGroup {
  sessionId: string;
  /** 1-based, in the order the sessions appear in the timeline. */
  index: number;
  startedAt: string;
  /** The session_start row, when the row cap did not cut it off. */
  sessionStart: VisitorTimelineEntry | null;
  nodes: TimelineNode[];
}

/**
 * Group a flat timeline into one block per session.
 *
 * Keyed by session id rather than by consecutive runs, so a visitor with two
 * tabs open does not produce two blocks for the same session.
 *
 * The session_start row is pulled out to become the block header. It is often
 * absent: the RPC orders ascending then caps, so a long relationship returns
 * events whose session began before the window of rows returned. When it is
 * missing the header falls back to the first event's time and page — never to
 * a fabricated one.
 */
export function groupTimelineBySession(
  entries: VisitorTimelineEntry[],
): SessionGroup[] {
  const groups = new Map<string, SessionGroup>();

  for (const entry of entries) {
    let group = groups.get(entry.sessionId);
    if (!group) {
      group = {
        sessionId: entry.sessionId,
        index: groups.size + 1,
        startedAt: entry.occurredAt,
        sessionStart: null,
        nodes: [],
      };
      groups.set(entry.sessionId, group);
    }

    if (entry.kind === "session_start") {
      group.sessionStart = entry;
      group.startedAt = entry.occurredAt;
      continue;
    }

    const previous = group.nodes[group.nodes.length - 1];
    if (previous && isSameAction(previous.entry, entry)) {
      // Six identical `region_select` rows in the same millisecond is a real
      // pattern in this data. Listed one per line it buries the journey.
      previous.repeatCount += 1;
      continue;
    }

    group.nodes.push({
      key: `${entry.sessionId}-${entry.occurredAt}-${group.nodes.length}`,
      entry,
      repeatCount: 1,
    });
  }

  return [...groups.values()];
}

function isSameAction(a: VisitorTimelineEntry, b: VisitorTimelineEntry) {
  return (
    a.eventCategory === b.eventCategory &&
    a.eventAction === b.eventAction &&
    a.pagePath === b.pagePath
  );
}

// ============================================================
// Entry + session descriptions
// ============================================================

export interface EntryDescription {
  title: string;
  /** The page it happened on, when that adds something the title does not. */
  path: string | null;
}

/**
 * Say what happened in words, not column values.
 *
 * A pageview's action is the literal string `view`, which tells a reader
 * nothing; the page is the fact. Everything else leads with the action.
 */
export function describeTimelineEntry(
  entry: VisitorTimelineEntry,
): EntryDescription {
  if (entry.eventCategory === "pageview") {
    return { title: "Viewed", path: entry.pagePath };
  }

  if (isConversionEntry(entry)) {
    return { title: "Signed up", path: entry.pagePath };
  }

  const action = entry.eventAction ? humanizeToken(entry.eventAction) : "";
  const label = entry.label ? humanizeToken(entry.label) : "";
  const title = action || humanizeToken(entry.eventCategory ?? "") || "Event";

  return {
    title: label && label !== title ? `${title} · ${label}` : title,
    path: entry.pagePath,
  };
}

export interface SessionMeta {
  entryType: string | null;
  referrerDomain: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  utmSource: string | null;
  durationSeconds: number | null;
  pageCount: number | null;
}

/** Read the session_start properties blob without trusting its shape. */
export function readSessionMeta(
  sessionStart: VisitorTimelineEntry | null,
): SessionMeta {
  const props = sessionStart?.properties ?? {};
  return {
    entryType: sessionStart?.label ?? null,
    referrerDomain: readString(props, "referrer_domain"),
    deviceType: readString(props, "device_type"),
    browser: readString(props, "browser"),
    os: readString(props, "os"),
    utmSource: readString(props, "utm_source"),
    durationSeconds: readNumber(props, "duration_seconds"),
    pageCount: readNumber(props, "page_count"),
  };
}

function readString(
  props: Record<string, unknown>,
  key: string,
): string | null {
  const value = props[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumber(
  props: Record<string, unknown>,
  key: string,
): number | null {
  const value = Number(props[key]);
  return Number.isFinite(value) ? value : null;
}
