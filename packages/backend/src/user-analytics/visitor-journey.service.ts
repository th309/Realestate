import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type {
  AnalyticsFilters,
  VisitorListResult,
  VisitorSummary,
  VisitorTimeline,
  VisitorTimelineEntry,
} from './user-analytics.types';
import { DEFAULT_TRAFFIC_SEGMENT } from './traffic-segment';

export const VISITOR_LIST_DEFAULT_LIMIT = 100;
export const VISITOR_LIST_MAX_LIMIT = 500;
export const VISITOR_TIMELINE_DEFAULT_LIMIT = 500;
export const VISITOR_TIMELINE_MAX_LIMIT = 2000;

/** Row shapes returned by the two RPCs, before camel-casing. */
interface VisitorListRow {
  visitor_id: string;
  user_id: string | null;
  user_tier: string | null;
  first_seen: string;
  last_seen: string;
  sessions: number | string;
  pageviews: number | string;
  interactions: number | string;
  total_seconds: number | string;
  entry_type: string | null;
  source: string | null;
  landing_page: string | null;
  converted: boolean;
}

interface VisitorTimelineRow {
  occurred_at: string;
  session_id: string;
  kind: string;
  event_category: string | null;
  event_action: string | null;
  page_path: string | null;
  previous_page_path: string | null;
  label: string | null;
  properties: Record<string, unknown> | null;
}

/**
 * The supabase client types `.rpc()` loosely, so destructuring it straight into
 * `data`/`error` spreads `any` through the mapping below. Narrowed once here
 * instead of casting at each call site.
 */
interface RpcResponse<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/**
 * Bound an untrusted limit. Fails to the default rather than to the maximum —
 * a malformed value must not be an accidental request for every row.
 */
function clampLimit(value: number | undefined, fallback: number, max: number) {
  if (!Number.isFinite(value) || (value as number) < 1) return fallback;
  return Math.min(Math.trunc(value as number), max);
}

/**
 * One visitor, followed end to end.
 *
 * The two RPCs do the aggregation in SQL, so this service is a thin, honest
 * mapping layer: name the columns, coerce the numerics PostgREST hands back as
 * strings (`bigint` and `numeric` both arrive quoted), and report whether the
 * row cap was hit.
 *
 * Deliberately NOT Redis-cached, unlike the five aggregate tabs. Those answer
 * "what is the population doing"; this answers "what did THIS person just do",
 * and a five-minute-stale journey is the one thing an investigator cannot use.
 * React Query already dedupes on the client.
 *
 * Errors throw rather than degrading to an empty array. On an aggregate tile a
 * zero is survivable; on a drill-down, "this visitor did nothing" and "the
 * query failed" are opposite conclusions and must not render identically.
 */
@Injectable()
export class VisitorJourneyService {
  private readonly logger = new Logger(VisitorJourneyService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async listVisitors(
    days: number,
    filters: AnalyticsFilters,
    options: { onlyConverted?: boolean; limit?: number } = {},
  ): Promise<VisitorListResult> {
    const limit = clampLimit(
      options.limit,
      VISITOR_LIST_DEFAULT_LIMIT,
      VISITOR_LIST_MAX_LIMIT,
    );
    const { start, end } = resolveWindow(days, filters);

    const { data, error } = (await this.supabase
      .getClient()
      .rpc('analytics_visitor_list', {
        p_start: start,
        p_end: end,
        // The segment decides which population the list describes, exactly as
        // it does on every other tab. Never left to a downstream default.
        p_traffic: filters.traffic ?? DEFAULT_TRAFFIC_SEGMENT,
        p_only_converted: options.onlyConverted ?? false,
        p_limit: limit,
      })) as RpcResponse<VisitorListRow>;

    if (error) {
      this.logger.error(
        `[VisitorJourney] Visitor list failed: ${error.message}`,
      );
      throw new Error(`Failed to load visitors: ${error.message}`);
    }

    const rows = data ?? [];
    return {
      visitors: rows.map(toVisitorSummary),
      limit,
      truncated: rows.length >= limit,
    };
  }

  async getTimeline(
    visitorId: string,
    limit?: number,
  ): Promise<VisitorTimeline> {
    const cappedLimit = clampLimit(
      limit,
      VISITOR_TIMELINE_DEFAULT_LIMIT,
      VISITOR_TIMELINE_MAX_LIMIT,
    );

    const { data, error } = (await this.supabase
      .getClient()
      .rpc('analytics_visitor_timeline', {
        p_visitor_id: visitorId,
        p_limit: cappedLimit,
      })) as RpcResponse<VisitorTimelineRow>;

    if (error) {
      this.logger.error(
        `[VisitorJourney] Timeline failed for ${visitorId}: ${error.message}`,
      );
      throw new Error(`Failed to load visitor timeline: ${error.message}`);
    }

    const rows = data ?? [];
    const entries = rows.map(toTimelineEntry);

    return {
      visitorId,
      entries,
      limit: cappedLimit,
      // The RPC orders ascending then caps, so a full page means the journey
      // continues past the last entry rather than ending there. The UI has to
      // say so, or a truncated relationship reads as a completed one.
      truncated: rows.length >= cappedLimit,
      sessionCount: new Set(entries.map((e) => e.sessionId)).size,
    };
  }
}

/** Window precedence: an explicit range wins, otherwise the rolling day count. */
function resolveWindow(
  days: number,
  filters: AnalyticsFilters,
): { start: string; end: string | null } {
  const start = filters.startDate
    ? new Date(filters.startDate).toISOString()
    : new Date(Date.now() - days * 86_400_000).toISOString();
  const end = filters.endDate ? new Date(filters.endDate).toISOString() : null;
  return { start, end };
}

function toVisitorSummary(row: VisitorListRow): VisitorSummary {
  return {
    visitorId: row.visitor_id,
    userId: row.user_id ?? null,
    userTier: row.user_tier ?? null,
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
    sessions: Number(row.sessions ?? 0),
    pageviews: Number(row.pageviews ?? 0),
    interactions: Number(row.interactions ?? 0),
    totalSeconds: Number(row.total_seconds ?? 0),
    entryType: row.entry_type ?? null,
    source: row.source ?? null,
    landingPage: row.landing_page ?? null,
    converted: row.converted === true,
  };
}

function toTimelineEntry(row: VisitorTimelineRow): VisitorTimelineEntry {
  return {
    occurredAt: row.occurred_at,
    sessionId: row.session_id,
    kind: row.kind === 'session_start' ? 'session_start' : 'event',
    eventCategory: row.event_category ?? null,
    eventAction: row.event_action ?? null,
    pagePath: row.page_path ?? null,
    previousPagePath: row.previous_page_path ?? null,
    label: row.label ?? null,
    properties: row.properties ?? null,
  };
}
