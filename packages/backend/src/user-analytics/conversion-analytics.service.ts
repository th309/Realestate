import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RedisService } from '../redis/redis.service';
import type {
  ConversionData,
  AnalyticsFilters,
  FunnelStep,
} from './user-analytics.types';
import { DEFAULT_TRAFFIC_SEGMENT } from './traffic-segment';
import {
  queryPaywallEffectiveness,
  queryFeatureCorrelation,
  queryTierMigration,
  queryConversionAnnotations,
} from './conversion-panel-queries';
import { queryRevenueMetrics } from './conversion-revenue-queries';

// v3: the paywall and feature panels changed SHAPE (resource->gate,
// converterRate->conversionRate). A cached v2 payload deserialises into the new
// types without complaint and then crashes on first property access, because
// the cache stores JSON and TypeScript is not there at runtime. Any change to
// what these panels RETURN must bump this, not just changes to what they mean.
const CONVERSION_CACHE_TTL = 600;

/**
 * The end-to-end funnel, defined against events that exist.
 *
 * The previous definition was Visit → Signup → Active → Trial → Paid, where
 * Trial matched `trial_start` and Paid matched `upgrade_complete`. Neither has
 * ever been emitted, so the last two stages read 0 permanently and the funnel
 * always showed a total collapse after signup.
 *
 * `Paid` now comes from user_profiles (a real subscription state) rather than
 * an event that does not exist. `Activated` uses trial.pro_feature_used, which
 * is the highest-volume genuine engagement signal in the table at 5,826 events
 * — and notably one the crawler cohort never emits.
 */
@Injectable()
export class ConversionAnalyticsService {
  private readonly logger = new Logger(ConversionAnalyticsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly redis: RedisService,
  ) {}

  async getConversion(
    days: number,
    filters: AnalyticsFilters,
  ): Promise<ConversionData> {
    const segment = filters.traffic ?? DEFAULT_TRAFFIC_SEGMENT;
    const cacheKey = `analytics:conversion:v3:${days}:${segment}:${JSON.stringify(filters)}`;
    const cached = await this.redis.getByKey(cacheKey);
    if (cached) return cached as ConversionData;

    const client = this.supabase.getClient();
    const startDate = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000,
    ).toISOString();

    const [
      fullFunnel,
      paywallEffectiveness,
      featureCorrelation,
      revenueMetrics,
      annotations,
    ] = await Promise.all([
      this.buildFullFunnel(startDate, filters),
      queryPaywallEffectiveness(client, startDate, segment),
      queryFeatureCorrelation(client, startDate, segment),
      queryRevenueMetrics(client),
      queryConversionAnnotations(client, startDate),
    ]);

    const result: ConversionData = {
      fullFunnel,
      customFunnels: [],
      paywallEffectiveness,
      featureCorrelation,
      revenueMetrics,
      // Structurally unavailable — see queryTierMigration. Kept in the payload
      // so the response shape is stable while the panel is retired.
      tierMigration: queryTierMigration(),
      annotations,
    };

    await this.redis.setByKey(cacheKey, result, CONVERSION_CACHE_TTL);
    return result;
  }

  private async buildFullFunnel(
    startDate: string,
    filters: AnalyticsFilters,
  ): Promise<FunnelStep[]> {
    const client = this.supabase.getClient();
    const traffic = filters.traffic ?? DEFAULT_TRAFFIC_SEGMENT;

    const [kpis, eventCounts, paid] = await Promise.all([
      // Aggregated in SQL. The old version counted `sessionRows.length` from an
      // unranged select, so the funnel's first stage was the 1,000-row
      // PostgREST cap rather than the visitor count.
      client.rpc('analytics_overview_kpis', {
        p_start: startDate,
        p_end: null,
        p_traffic: traffic,
        p_tier: filters.tier ?? null,
        p_device: filters.device ?? null,
      }),
      client.rpc('analytics_event_visitor_counts', {
        p_start: startDate,
        p_actions: ['signup_complete', 'pro_feature_used'],
        p_end: null,
        p_traffic: traffic,
        p_tier: filters.tier ?? null,
      }),
      client
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .in('subscription_tier', ['pro', 'enterprise'])
        .eq('subscription_status', 'active'),
    ]);

    if (kpis.error || eventCounts.error) {
      this.logger.error(
        `[ConversionAnalytics] Full funnel failed: ${
          kpis.error?.message ?? eventCounts.error?.message
        }`,
      );
      return [];
    }

    const byAction = new Map<string, number>();
    for (const row of (eventCounts.data ?? []) as any[]) {
      byAction.set(row.event_action, Number(row.visitors));
    }

    const visitCount = Number(kpis.data?.[0]?.unique_visitors ?? 0);

    return this.buildFunnelSteps(visitCount, [
      { name: 'Visited', count: visitCount },
      { name: 'Signed up', count: byAction.get('signup_complete') ?? 0 },
      {
        name: 'Used a Pro feature',
        count: byAction.get('pro_feature_used') ?? 0,
      },
      { name: 'Paid', count: paid.count ?? 0 },
    ]);
  }

  private buildFunnelSteps(
    firstCount: number,
    steps: { name: string; count: number }[],
  ): FunnelStep[] {
    return steps.map((step, i) => ({
      name: step.name,
      count: step.count,
      rateFromPrevious:
        i === 0
          ? 1
          : steps[i - 1].count === 0
            ? 0
            : step.count / steps[i - 1].count,
      rateFromFirst: firstCount > 0 ? step.count / firstCount : 0,
    }));
  }
}
