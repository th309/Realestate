import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RedisService } from '../redis/redis.service';
import {
  AcquisitionData,
  AnalyticsFilters,
  AttributionRow,
} from './user-analytics.types';
import {
  queryTrafficSources,
  queryLandingPagePerformance,
  queryChannelTrend,
  queryAnnotations,
} from './acquisition-session-queries';

const CACHE_TTL_SECONDS = 900;

@Injectable()
export class AcquisitionAnalyticsService {
  private readonly logger = new Logger(AcquisitionAnalyticsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly redis: RedisService,
  ) {}

  async getAcquisition(
    days: number,
    filters: AnalyticsFilters,
  ): Promise<AcquisitionData> {
    const cacheKey = `analytics:acquisition:${days}:${JSON.stringify(filters)}`;

    const cached = await this.redis.getByKey(cacheKey);
    if (cached) {
      this.logger.log(`[AcquisitionAnalytics] Cache HIT for key ${cacheKey}`);
      return cached as AcquisitionData;
    }

    const startDate = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000,
    ).toISOString();
    const client = this.supabase.getClient();

    const [
      trafficSources,
      landingPagePerformance,
      sourceToConversion,
      channelTrend,
      annotations,
    ] = await Promise.all([
      queryTrafficSources(client, startDate),
      queryLandingPagePerformance(client, startDate),
      this.querySourceToConversionAttribution(startDate),
      queryChannelTrend(client, startDate),
      queryAnnotations(client, startDate),
    ]);

    const result: AcquisitionData = {
      trafficSources,
      landingPagePerformance,
      sourceToConversion,
      channelTrend,
      annotations,
    };

    await this.redis.setByKey(cacheKey, result, CACHE_TTL_SECONDS);
    return result;
  }

  /**
   * Joins visitor_identities to their earliest session source, then tallies
   * conversion events (signup / trial_start / paid_conversion) per source.
   * Kept in-class because it spans two tables via Supabase's nested select
   * and requires stateful Set-based visitor deduplication.
   */
  private async querySourceToConversionAttribution(
    startDate: string,
  ): Promise<AttributionRow[]> {
    const client = this.supabase.getClient();

    const { data: rows, error } = await client
      .from('visitor_identities')
      .select(
        `
        visitor_id,
        user_id,
        first_seen_at,
        user_sessions!inner(entry_type, utm_source, referrer_domain, started_at),
        analytics_events(event_action, event_category)
      `,
      )
      .gte('first_seen_at', startDate);

    if (error) {
      this.logger.error(
        `[AcquisitionAnalytics] Attribution query failed: ${error.message}`,
      );
      return [];
    }

    type SessionRow = {
      entry_type: string | null;
      utm_source: string | null;
      referrer_domain: string | null;
      started_at: string;
    };
    type EventRow = { event_action: string; event_category: string };

    const attribution = new Map<
      string,
      { visitors: Set<string>; signups: number; trials: number; paid: number }
    >();

    for (const identity of rows ?? []) {
      const identityRecord = identity as Record<string, unknown>;

      const sessions: SessionRow[] = Array.isArray(
        identityRecord['user_sessions'],
      )
        ? (identityRecord['user_sessions'] as SessionRow[])
        : [];

      const earliestSession = sessions
        .slice()
        .sort(
          (a, b) =>
            new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
        )[0];

      if (!earliestSession) continue;

      const source: string =
        earliestSession.utm_source ??
        earliestSession.referrer_domain ??
        earliestSession.entry_type ??
        'direct';

      const bucket = attribution.get(source) ?? {
        visitors: new Set<string>(),
        signups: 0,
        trials: 0,
        paid: 0,
      };

      bucket.visitors.add(identity.visitor_id as string);

      const events: EventRow[] = Array.isArray(
        identityRecord['analytics_events'],
      )
        ? (identityRecord['analytics_events'] as EventRow[])
        : [];

      for (const event of events) {
        if (event.event_action === 'signup') bucket.signups += 1;
        if (event.event_action === 'trial_start') bucket.trials += 1;
        if (event.event_action === 'paid_conversion') bucket.paid += 1;
      }

      attribution.set(source, bucket);
    }

    return Array.from(attribution.entries())
      .map(([source, stats]) => {
        const visitors = stats.visitors.size;
        return {
          source,
          visitors,
          signups: stats.signups,
          trials: stats.trials,
          paid: stats.paid,
          conversionRate:
            visitors > 0
              ? Math.round((stats.signups / visitors) * 1000) / 10
              : 0,
        };
      })
      .sort((a, b) => b.visitors - a.visitors);
  }
}
