/**
 * Query helpers for the acquisition analytics service.
 *
 * Every session aggregate here goes through a SQL aggregate function, never
 * through `.select()` + reduce-in-JS.
 *
 * THE BUG THIS REPLACES: each helper ran
 * `client.from('user_sessions').select(...)` with no `.range()`. PostgREST caps
 * an unranged select at 1,000 rows and neither errors nor warns — it returns a
 * well-formed array, and the JS then computes a perfectly correct percentage
 * against the wrong denominator. A trailing-30-day window holds ~48,000
 * sessions, so every Acquisition panel was reporting ~2% of the data as if it
 * were all of it. Raising a `.limit()` is no defence; the max-rows cap applies
 * regardless. Aggregating server-side removes the failure mode rather than
 * moving the ceiling: there is no array left to truncate.
 *
 * It also makes the traffic segment a parameter instead of a hardcoded
 * `is_bot = false`, so the bot/unclassified views stop being unreachable.
 *
 * All functions operate directly on a SupabaseClient so they carry no
 * injectable state and can be tested in isolation.
 */

import { Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  AnalyticsFilters,
  SourceMetric,
  LandingPerf,
  TimeSeriesPoint,
  Annotation,
} from './user-analytics.types';
import { DEFAULT_TRAFFIC_SEGMENT } from './traffic-segment';

const logger = new Logger('AcquisitionSessionQueries');

/** Landing-page rows returned per call. Well above the ~40 distinct landing pages seen in a 30-day window. */
const LANDING_PAGE_LIMIT = 50;

function trafficSegment(filters: AnalyticsFilters): string {
  return filters.traffic ?? DEFAULT_TRAFFIC_SEGMENT;
}

interface TrafficSourceRow {
  entry_type: string | null;
  source: string | null;
  sessions: number | string;
  visitors: number | string;
}

interface LandingPerformanceRow {
  page: string;
  sessions: number | string;
  bounce_rate: number | string;
  avg_time: number | string;
  signups: number | string;
  conversion_rate: number | string;
}

interface ChannelTrendRow {
  day: string;
  entry_type: string | null;
  sessions: number | string;
}

export async function queryTrafficSources(
  client: SupabaseClient,
  startDate: string,
  filters: AnalyticsFilters = {},
): Promise<SourceMetric[]> {
  const { data, error } = await client.rpc('analytics_traffic_sources', {
    p_start: startDate,
    p_end: null,
    p_traffic: trafficSegment(filters),
  });

  if (error) {
    logger.error(
      `[AcquisitionAnalytics] Traffic sources rpc failed: ${error.message}`,
    );
    return [];
  }

  const rows = (data ?? []) as TrafficSourceRow[];

  // The denominator is the sum over the FULL grouped result, so a share is a
  // share of every session in the segment — not of the first page of them.
  const total = rows.reduce((sum, row) => sum + Number(row.sessions), 0);

  return rows
    .map((row) => {
      const sessions = Number(row.sessions);
      return {
        source: row.source ?? 'direct',
        entryType: row.entry_type ?? 'unknown',
        sessions,
        percentage: total > 0 ? Math.round((sessions / total) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.sessions - a.sessions);
}

export async function queryLandingPagePerformance(
  client: SupabaseClient,
  startDate: string,
  filters: AnalyticsFilters = {},
): Promise<LandingPerf[]> {
  const { data, error } = await client.rpc('analytics_landing_performance', {
    p_start: startDate,
    p_end: null,
    p_traffic: trafficSegment(filters),
    p_limit: LANDING_PAGE_LIMIT,
  });

  if (error) {
    logger.error(
      `[AcquisitionAnalytics] Landing performance rpc failed: ${error.message}`,
    );
    return [];
  }

  // Already grouped, ordered by sessions desc and limited server-side.
  return ((data ?? []) as LandingPerformanceRow[]).map((row) => ({
    page: row.page,
    sessions: Number(row.sessions),
    bounceRate: Number(row.bounce_rate),
    avgTime: Math.round(Number(row.avg_time)),
    signups: Number(row.signups),
    conversionRate: Number(row.conversion_rate),
  }));
}

export async function queryChannelTrend(
  client: SupabaseClient,
  startDate: string,
  filters: AnalyticsFilters = {},
): Promise<{ channel: string; data: TimeSeriesPoint[] }[]> {
  const { data, error } = await client.rpc('analytics_channel_trend', {
    p_start: startDate,
    p_end: null,
    p_traffic: trafficSegment(filters),
  });

  if (error) {
    logger.error(
      `[AcquisitionAnalytics] Channel trend rpc failed: ${error.message}`,
    );
    return [];
  }

  const channelSeries = new Map<string, TimeSeriesPoint[]>();

  for (const row of (data ?? []) as ChannelTrendRow[]) {
    const channel = row.entry_type ?? 'unknown';
    const points = channelSeries.get(channel) ?? [];
    points.push({
      date: String(row.day).slice(0, 10),
      value: Number(row.sessions),
    });
    channelSeries.set(channel, points);
  }

  return Array.from(channelSeries.entries()).map(([channel, points]) => ({
    channel,
    data: points.sort((a, b) => a.date.localeCompare(b.date)),
  }));
}

export async function queryAnnotations(
  client: SupabaseClient,
  startDate: string,
): Promise<Annotation[]> {
  const { data, error } = await client
    .from('analytics_annotations')
    .select('id, annotation_date, label, description')
    .gte('annotation_date', startDate.slice(0, 10))
    .order('annotation_date', { ascending: true });

  if (error) {
    logger.warn(
      `[AcquisitionAnalytics] Annotations query failed: ${error.message}`,
    );
    return [];
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    annotationDate: row.annotation_date as string,
    label: row.label as string,
    description: (row.description as string | null) ?? undefined,
  }));
}
