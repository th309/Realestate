/**
 * Insights Data Fetcher Service
 *
 * Orchestrates gathering of all platform data needed by the AI Insights
 * engine. Runs core Supabase queries (via InsightsSupabaseQueriesService)
 * and UserAnalyticsModule services in parallel, using Promise.allSettled
 * for the analytics tier so a single service failure does not block the
 * rest of the snapshot.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PaywallAnalyticsService } from './paywall-analytics.service';
import { InsightsSupabaseQueriesService } from './insights-supabase-queries.service';
import { OverviewAnalyticsService } from '../../user-analytics/overview-analytics.service';
import { JourneyAnalyticsService } from '../../user-analytics/journey-analytics.service';
import { RetentionAnalyticsService } from '../../user-analytics/retention-analytics.service';
import { AcquisitionAnalyticsService } from '../../user-analytics/acquisition-analytics.service';
import { ConversionAnalyticsService } from '../../user-analytics/conversion-analytics.service';
import { InsightsDataSnapshot, GrowthProgress } from './ai-insights.types';

@Injectable()
export class InsightsDataFetcherService {
  private readonly logger = new Logger(InsightsDataFetcherService.name);

  constructor(
    private readonly queries: InsightsSupabaseQueriesService,
    private readonly paywallAnalytics: PaywallAnalyticsService,
    private readonly overview: OverviewAnalyticsService,
    private readonly journeys: JourneyAnalyticsService,
    private readonly retention: RetentionAnalyticsService,
    private readonly acquisition: AcquisitionAnalyticsService,
    private readonly conversion: ConversionAnalyticsService,
  ) {}

  async gatherSnapshot(
    days: number,
    growthProgress: GrowthProgress,
  ): Promise<InsightsDataSnapshot> {
    const now = new Date();
    const startIso = new Date(
      now.getTime() - days * 24 * 60 * 60 * 1000,
    ).toISOString();
    const endIso = now.toISOString();

    // Core platform data — all must succeed
    const [
      paywallStats,
      funnelData,
      revenueData,
      trialData,
      featureUsage,
      tierMatrix,
      userAggregates,
    ] = await Promise.all([
      this.paywallAnalytics
        .getStats({ startDate: startIso, endDate: endIso })
        .then((s) => s as unknown as Record<string, unknown>),
      this.paywallAnalytics.getFunnelData({
        startDate: startIso,
        endDate: endIso,
      }),
      this.queries.fetchRevenueSnapshot(startIso),
      this.queries.fetchTrialSnapshot(startIso),
      this.queries.fetchFeatureUsageSnapshot(startIso),
      this.queries.fetchTierMatrix(),
      this.queries.fetchUserAggregates(startIso),
    ]);

    // User analytics — isolated so failures don't block core data
    const analytics = await Promise.allSettled([
      this.overview.getOverview(days, {}),
      this.journeys.getJourneys(days, {}),
      this.retention.getRetention(days, {}),
      this.acquisition.getAcquisition(days, {}),
      this.conversion.getConversion(days, {}),
    ]);

    return {
      paywallStats,
      funnelData,
      revenueData,
      trialData,
      featureUsage,
      tierMatrix,
      userAggregates,
      growthProgress,
      overview: this.extractResult(analytics[0], 'overview'),
      journeys: this.extractResult(analytics[1], 'journeys'),
      retention: this.extractResult(analytics[2], 'retention'),
      acquisition: this.extractResult(analytics[3], 'acquisition'),
      conversion: this.extractResult(analytics[4], 'conversion'),
    };
  }

  private extractResult(
    result: PromiseSettledResult<unknown>,
    label: string,
  ): Record<string, unknown> | null {
    if (result.status === 'fulfilled') {
      return result.value as Record<string, unknown>;
    }
    this.logger.warn(
      `[InsightsDataFetcher] ${label} analytics failed — omitting from prompt`,
      result.reason,
    );
    return null;
  }
}
