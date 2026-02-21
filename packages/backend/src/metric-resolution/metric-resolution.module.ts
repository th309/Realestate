/**
 * Metric Resolution Module
 *
 * Provides the centralized MetricResolutionService that all backend
 * consumers use for metric fallback/resolution logic. Replaces the
 * scattered fallback chains in market-snapshot, reports, and scoring.
 *
 * Exports:
 * - MetricResolutionService  — Public API (3 methods)
 * - GeographyChainService    — Geography parent chain lookups
 * - SourceFetcherService     — Low-level DB queries by source
 */

import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { MetricResolutionService } from './metric-resolution.service';
import { SourceFetcherService } from './source-fetcher.service';
import { GeographyChainService } from './geography-chain.service';

@Module({
  imports: [SupabaseModule],
  providers: [
    MetricResolutionService,
    SourceFetcherService,
    GeographyChainService,
  ],
  exports: [
    MetricResolutionService,
    GeographyChainService,
    SourceFetcherService,
  ],
})
export class MetricResolutionModule {}
