/**
 * Shared types for the reports orchestrator pipeline.
 */

import { Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import type { ScoringService } from '../scoring/scoring.service';
import type { NewsScoutService } from './news-scout.service';
import type { EntitlementsService } from '../entitlements/entitlements.service';
import type { PartnersService } from '../partners/partners.service';
import type { MarketSnapshotService } from '../market-snapshot/market-snapshot.service';
import type { TimeSeriesService } from '../timeseries/timeseries.service';
import type { MetricResolutionService } from '../metric-resolution/metric-resolution.service';
import type { ReportGenerationV2Service } from './report-generation-v2.service';

/** All service dependencies required by the orchestrator. */
export interface ReportDeps {
  supabase: SupabaseClient;
  logger: Logger;
  scoringService: ScoringService;
  newsScoutService: NewsScoutService;
  entitlementsService: EntitlementsService;
  partnersService: PartnersService;
  marketSnapshotService: MarketSnapshotService;
  timeSeriesService: TimeSeriesService;
  metricResolutionService: MetricResolutionService;
  reportGenerationV2: ReportGenerationV2Service;
}
