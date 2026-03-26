/**
 * Platform API Module
 *
 * Registers all v1 Platform API controllers and their shared providers
 * (response interceptor, throttle guard). Imports the modules that export
 * the services these controllers inject.
 *
 * Global modules (SupabaseModule, RedisModule) do not need explicit imports.
 */

import { Module } from '@nestjs/common';
import { OrgApiKeysModule } from '../org-api-keys/org-api-keys.module';
import { ScoringModule } from '../scoring/scoring.module';
import { ReportsModule } from '../reports/reports.module';

// v1 controllers
import { HealthV1Controller } from './v1/health.controller';
import { ScoresV1Controller } from './v1/scores.controller';
import { MetricsV1Controller } from './v1/metrics.controller';
import { TimeseriesV1Controller } from './v1/timeseries.controller';
import { RankingsV1Controller } from './v1/rankings.controller';
import { PlatformReportsController } from './v1/reports.controller';
import { PlatformWatchlistController } from './v1/watchlist.controller';

// Shared providers
import { ApiResponseInterceptor } from './api-response.interceptor';
import { ApiThrottleGuard } from './api-throttle.guard';

@Module({
  imports: [OrgApiKeysModule, ScoringModule, ReportsModule],
  controllers: [
    HealthV1Controller,
    ScoresV1Controller,
    MetricsV1Controller,
    TimeseriesV1Controller,
    RankingsV1Controller,
    PlatformReportsController,
    PlatformWatchlistController,
  ],
  providers: [ApiResponseInterceptor, ApiThrottleGuard],
})
export class PlatformApiModule {}
