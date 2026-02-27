/**
 * Pure query helpers for the acquisition analytics service.
 * All functions operate directly on a SupabaseClient so they carry no
 * injectable state and can be tested in isolation.
 */

import { Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  SourceMetric,
  LandingPerf,
  TimeSeriesPoint,
  Annotation,
} from './user-analytics.types';

const logger = new Logger('AcquisitionSessionQueries');

export async function queryTrafficSources(
  client: SupabaseClient,
  startDate: string,
): Promise<SourceMetric[]> {
  const { data: sessions, error } = await client
    .from('user_sessions')
    .select('entry_type, utm_source, referrer_domain')
    .gte('started_at', startDate);

  if (error) {
    logger.error(
      `[AcquisitionAnalytics] Traffic sources query failed: ${error.message}`,
    );
    return [];
  }

  const counts = new Map<string, { entryType: string; count: number }>();

  for (const row of sessions ?? []) {
    const entryType: string = row.entry_type ?? 'unknown';
    const sourceLabel: string =
      row.utm_source ?? row.referrer_domain ?? 'direct';
    const mapKey = `${entryType}__${sourceLabel}`;

    const existing = counts.get(mapKey);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(mapKey, { entryType, count: 1 });
    }
  }

  const total = (sessions ?? []).length;

  return Array.from(counts.entries())
    .map(([key, { entryType, count }]) => ({
      source: key.split('__')[1],
      entryType,
      sessions: count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions);
}

export async function queryLandingPagePerformance(
  client: SupabaseClient,
  startDate: string,
): Promise<LandingPerf[]> {
  const { data: sessions, error } = await client
    .from('user_sessions')
    .select('landing_page, is_bounce, duration_seconds, converted')
    .gte('started_at', startDate)
    .not('landing_page', 'is', null);

  if (error) {
    logger.error(
      `[AcquisitionAnalytics] Landing page performance query failed: ${error.message}`,
    );
    return [];
  }

  const pageGroups = new Map<
    string,
    {
      totalSessions: number;
      bounces: number;
      totalDuration: number;
      signups: number;
    }
  >();

  for (const row of sessions ?? []) {
    const page: string = row.landing_page;
    const existing = pageGroups.get(page) ?? {
      totalSessions: 0,
      bounces: 0,
      totalDuration: 0,
      signups: 0,
    };

    existing.totalSessions += 1;
    existing.bounces += row.is_bounce ? 1 : 0;
    existing.totalDuration += row.duration_seconds ?? 0;
    existing.signups += row.converted ? 1 : 0;

    pageGroups.set(page, existing);
  }

  return Array.from(pageGroups.entries())
    .map(([page, stats]) => ({
      page,
      sessions: stats.totalSessions,
      bounceRate:
        stats.totalSessions > 0 ? stats.bounces / stats.totalSessions : 0,
      avgTime:
        stats.totalSessions > 0
          ? Math.round(stats.totalDuration / stats.totalSessions)
          : 0,
      signups: stats.signups,
      conversionRate:
        stats.totalSessions > 0 ? stats.signups / stats.totalSessions : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions);
}

export async function queryChannelTrend(
  client: SupabaseClient,
  startDate: string,
): Promise<{ channel: string; data: TimeSeriesPoint[] }[]> {
  const { data: sessions, error } = await client
    .from('user_sessions')
    .select('started_at, entry_type')
    .gte('started_at', startDate);

  if (error) {
    logger.error(
      `[AcquisitionAnalytics] Channel trend query failed: ${error.message}`,
    );
    return [];
  }

  const channelDates = new Map<string, Map<string, number>>();

  for (const row of sessions ?? []) {
    const channel: string = row.entry_type ?? 'unknown';
    const date = (row.started_at as string).slice(0, 10);

    if (!channelDates.has(channel)) {
      channelDates.set(channel, new Map());
    }

    const dateCounts = channelDates.get(channel)!;
    dateCounts.set(date, (dateCounts.get(date) ?? 0) + 1);
  }

  return Array.from(channelDates.entries()).map(([channel, dateCounts]) => ({
    channel,
    data: Array.from(dateCounts.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date)),
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
