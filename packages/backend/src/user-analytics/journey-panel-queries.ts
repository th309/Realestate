/**
 * Query helpers for every panel on the Journeys tab.
 *
 * All six go through SQL aggregate functions, never through `.select()` +
 * reduce-in-JS. The previous implementation pulled raw rows with `.limit(5000)`
 * and `.limit(10000)` — both ABOVE PostgREST's max-rows ceiling of 1,000, so
 * neither limit ever applied. Each request returned a well-formed 1,000-row
 * array and the JS aggregated it perfectly, producing exactly correct answers
 * about ~1% of a ~112,000-event window. Raising the limit does not help; the
 * ceiling wins. Aggregating server-side removes the array there is to truncate.
 *
 * `resolveDeviceSessionIds` is gone with it. It pulled session ids with
 * `.limit(20000)` to filter events in memory, so a device filter silently meant
 * "whichever 1,000 session ids came back first". Device is now `p_device`,
 * evaluated inside each function.
 *
 * These operate directly on a SupabaseClient so they carry no injectable state
 * and can be tested in isolation — same shape as acquisition-session-queries.ts.
 *
 * SQL: supabase/migrations/20260729213000_analytics_journeys.sql
 */

import { Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import type {
  DurationBucket,
  ExitPageMetric,
  LandingPageMetric,
  NavigationFlow,
  OutboundDestination,
  PathSequence,
} from './journey.types';

const logger = new Logger('JourneyPanelQueries');

/**
 * The filter set every Journeys RPC takes, in the exact parameter names the SQL
 * functions declare. Built once per request so no panel can drift onto a
 * different population than the one beside it.
 */
export interface JourneyRpcArgs {
  p_start: string;
  p_end: string | null;
  p_traffic: string;
  p_tier: string | null;
  p_device: string | null;
}

/**
 * Run an RPC and degrade to an empty array on failure.
 *
 * One broken panel must not blank the whole tab, and an error is logged rather
 * than swallowed — the failure mode being replaced was silent by construction.
 */
async function callRpc<TRow>(
  client: SupabaseClient,
  fn: string,
  params: JourneyRpcArgs | (JourneyRpcArgs & { p_limit: number }),
): Promise<TRow[]> {
  // supabase-js types `.rpc()` against generated DB types, which this project
  // does not generate, so the response is `any`. Name the shape here — once, at
  // the boundary — instead of letting it spread through every mapper below.
  const { data, error } = (await client.rpc(fn, params)) as {
    data: TRow[] | null;
    error: { message: string } | null;
  };

  if (error) {
    logger.error(`[JourneyPanelQueries] ${fn} failed: ${error.message}`);
    return [];
  }
  return data ?? [];
}

interface NavigationFlowRow {
  from_path: string;
  to_path: string;
  transitions: number | string;
  visitors: number | string;
}

/**
 * Page-to-page transitions, ordered by volume.
 *
 * The from-path is `user_events.previous_page_path` (the promoted top-level
 * column) with a fallback to the JSONB property it was promoted from, because
 * the column was not backfilled — see the migration for the row counts and for
 * when the fallback can be dropped. Self-transitions are excluded in SQL: on a
 * pageview they are a duplicate emitted by a client-side re-render, not a
 * navigation, and a self-linked node cannot be laid out in a Sankey.
 */
export async function queryNavigationFlows(
  client: SupabaseClient,
  args: JourneyRpcArgs,
  limit = 50,
): Promise<NavigationFlow[]> {
  const rows = await callRpc<NavigationFlowRow>(
    client,
    'analytics_navigation_flows',
    { ...args, p_limit: limit },
  );

  return rows.map((row) => ({
    fromPage: row.from_path,
    toPage: row.to_path,
    transitions: Number(row.transitions),
    visitors: Number(row.visitors),
  }));
}

interface LandingPageRow {
  page: string;
  sessions: number | string;
  bounce_rate: number | string;
  avg_duration: number | string;
}

export async function queryLandingPages(
  client: SupabaseClient,
  args: JourneyRpcArgs,
  limit = 20,
): Promise<LandingPageMetric[]> {
  const rows = await callRpc<LandingPageRow>(
    client,
    'analytics_journey_landing_pages',
    { ...args, p_limit: limit },
  );

  return rows.map((row) => ({
    page: row.page,
    sessions: Number(row.sessions),
    bounceRate: Number(row.bounce_rate),
    avgDuration: Number(row.avg_duration),
  }));
}

interface ExitPageRow {
  page: string;
  exits: number | string;
}

export async function queryExitPages(
  client: SupabaseClient,
  args: JourneyRpcArgs,
  limit = 20,
): Promise<ExitPageMetric[]> {
  const rows = await callRpc<ExitPageRow>(client, 'analytics_exit_pages', {
    ...args,
    p_limit: limit,
  });

  return rows.map((row) => ({ page: row.page, exits: Number(row.exits) }));
}

interface DurationBucketRow {
  bucket: string;
  bucket_order: number;
  sessions: number | string;
}

/**
 * Session duration histogram.
 *
 * Bucket boundaries are defined in SQL, not here, and they are deliberately
 * asymmetric: an early heartbeat fires once at exactly 5s so ~2,000 sessions sit
 * on that single value, and ~94% sit at 0 because they never heartbeated at all.
 * Both get their own bucket. The migration carries the full reasoning. SQL
 * returns every bucket in display order, so there is nothing to re-sort or
 * backfill.
 */
export async function queryDurationBuckets(
  client: SupabaseClient,
  args: JourneyRpcArgs,
): Promise<DurationBucket[]> {
  const rows = await callRpc<DurationBucketRow>(
    client,
    'analytics_session_duration_buckets',
    args,
  );

  return rows.map((row) => ({
    bucket: row.bucket,
    count: Number(row.sessions),
  }));
}

interface CommonPathRow {
  path: string[];
  sessions: number | string;
}

export async function queryCommonPaths(
  client: SupabaseClient,
  args: JourneyRpcArgs,
  limit = 20,
): Promise<PathSequence[]> {
  const rows = await callRpc<CommonPathRow>(client, 'analytics_common_paths', {
    ...args,
    p_limit: limit,
  });

  return rows.map((row) => ({
    path: row.path ?? [],
    sessions: Number(row.sessions),
  }));
}

interface OutboundRow {
  domain: string;
  clicks: number | string;
  sessions: number | string;
  top_url: string;
  from_page: string;
}

/**
 * Outbound link clicks by destination domain.
 *
 * Click-time data only. A browser gives the departing page no access to where a
 * navigation lands, so exits by typed URL, bookmark or tab close are
 * unobservable and simply absent here — absent, not zero.
 */
export async function queryOutboundDestinations(
  client: SupabaseClient,
  args: JourneyRpcArgs,
  limit = 25,
): Promise<OutboundDestination[]> {
  const rows = await callRpc<OutboundRow>(
    client,
    'analytics_outbound_destinations',
    { ...args, p_limit: limit },
  );

  return rows.map((row) => ({
    domain: row.domain,
    clicks: Number(row.clicks),
    sessions: Number(row.sessions),
    topUrl: row.top_url ?? '',
    fromPage: row.from_page ?? '',
  }));
}

/**
 * Mean pages per session, read from the Overview KPI aggregate rather than
 * recomputed. It takes the identical filter set, so reusing it guarantees the
 * Journeys figure and the Overview tile cannot drift apart.
 */
export async function queryAvgPagesPerSession(
  client: SupabaseClient,
  args: JourneyRpcArgs,
): Promise<number> {
  const rows = await callRpc<{ pages_per_session: number | string }>(
    client,
    'analytics_overview_kpis',
    args,
  );
  return Number(rows[0]?.pages_per_session ?? 0);
}
