import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RedisService } from '../redis/redis.service';
import type {
  JourneyData,
  AnalyticsFilters,
  Annotation,
} from './user-analytics.types';
import { DEFAULT_TRAFFIC_SEGMENT } from './traffic-segment';
import {
  JourneyRpcArgs,
  queryAvgPagesPerSession,
  queryCommonPaths,
  queryDurationBuckets,
  queryExitPages,
  queryLandingPages,
  queryNavigationFlows,
  queryOutboundDestinations,
} from './journey-panel-queries';

const CACHE_TTL_SECONDS = 900;

interface AnnotationRow {
  id: string;
  annotation_date: string;
  label: string;
  description: string | null;
}

/**
 * Assembles the Journeys tab.
 *
 * Every panel is a SQL aggregate. This service previously fetched raw rows and
 * reduced them in Node behind `.limit(5000)` / `.limit(10000)`, both of which
 * exceed PostgREST's 1,000-row max-rows ceiling and therefore never applied —
 * so each panel described ~1,000 of ~112,000 events without any error to say so.
 * See journey-panel-queries.ts and the migration for the full account.
 */
@Injectable()
export class JourneyAnalyticsService {
  private readonly logger = new Logger(JourneyAnalyticsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly redis: RedisService,
  ) {}

  async getJourneys(
    days: number,
    filters: AnalyticsFilters,
  ): Promise<JourneyData> {
    // The traffic segment MUST be part of the key. It changes which population
    // every number describes, so sharing a cache entry across segments would
    // serve bot figures under a "human" label.
    const segment = filters.traffic ?? DEFAULT_TRAFFIC_SEGMENT;
    const cacheKey = `analytics:journeys:v2:${days}:${segment}:${JSON.stringify(filters)}`;

    const cached = (await this.redis.getByKey(cacheKey)) as JourneyData | null;
    if (cached) return cached;

    const client = this.supabase.getClient();

    // Built once so no panel can silently run against a different population
    // than the one rendered beside it.
    const args: JourneyRpcArgs = {
      p_start: new Date(Date.now() - days * 86400000).toISOString(),
      p_end: null,
      p_traffic: segment,
      p_tier: filters.tier ?? null,
      p_device: filters.device ?? null,
    };

    const [
      navigationFlows,
      landingPages,
      exitPages,
      commonPaths,
      sessionDurationDistribution,
      outboundDestinations,
      avgPagesPerSession,
      annotations,
    ] = await Promise.all([
      queryNavigationFlows(client, args),
      queryLandingPages(client, args),
      queryExitPages(client, args),
      queryCommonPaths(client, args),
      queryDurationBuckets(client, args),
      queryOutboundDestinations(client, args),
      queryAvgPagesPerSession(client, args),
      this.fetchAnnotations(client, args.p_start),
    ]);

    const result: JourneyData = {
      navigationFlows,
      landingPages,
      exitPages,
      commonPaths,
      outboundDestinations,
      avgPagesPerSession,
      sessionDurationDistribution,
      annotations,
    };

    await this.redis.setByKey(cacheKey, result, CACHE_TTL_SECONDS);
    return result;
  }

  private async fetchAnnotations(
    client: ReturnType<SupabaseService['getClient']>,
    startDate: string,
  ): Promise<Annotation[]> {
    const { data, error } = await client
      .from('analytics_annotations')
      .select('id, annotation_date, label, description')
      .gte('annotation_date', startDate)
      .order('annotation_date', { ascending: true });

    if (error) {
      this.logger.warn(`Failed to fetch annotations: ${error.message}`);
      return [];
    }

    // Supabase hands back `any` without generated DB types; name the shape at
    // the boundary rather than letting it leak into the mapping below.
    const rows = (data ?? []) as AnnotationRow[];
    return rows.map((row) => ({
      id: row.id,
      annotationDate: row.annotation_date,
      label: row.label,
      description: row.description ?? undefined,
    }));
  }
}
