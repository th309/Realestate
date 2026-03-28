/**
 * AdminMetricsModule
 *
 * Wires all admin dashboard metrics services, snapshot recorders,
 * alert evaluation, cleanup, and the API performance interceptor.
 *
 * Exports ApiMetricsBufferService and ApiMetricsInterceptor so they
 * can be registered as a global interceptor in AppModule.
 */

import { Module } from '@nestjs/common';

// Controller
import { AdminMetricsController } from './admin-metrics.controller';

// Interceptor
import { ApiMetricsInterceptor } from './interceptors/api-metrics.interceptor';

// Services — query layer
import { MetricsQueryService } from './services/metrics-query.service';
import { MetricsQueryFallbackService } from './services/metrics-query-fallback.service';
import { HeroStatsService } from './services/hero-stats.service';

// Services — snapshot recorders
import { SnapshotRecorderService } from './services/snapshot-recorder.service';
import { HealthSnapshotService } from './services/health-snapshot.service';
import { CacheSnapshotService } from './services/cache-snapshot.service';
import { UserSnapshotService } from './services/user-snapshot.service';
import { ScoreSnapshotService } from './services/score-snapshot.service';

// Services — API metrics buffer (used by interceptor)
import { ApiMetricsBufferService } from './services/api-metrics-buffer.service';

// Services — alert evaluation
import { AlertEvaluationService } from './services/alert-evaluation.service';
import { AlertThresholdRulesService } from './services/alert-threshold-rules.service';
import { AlertPersistenceService } from './services/alert-persistence.service';

// Services — cleanup
import { MetricsCleanupService } from './services/metrics-cleanup.service';

@Module({
  controllers: [AdminMetricsController],
  providers: [
    // Query layer
    MetricsQueryService,
    MetricsQueryFallbackService,
    HeroStatsService,

    // Snapshot recorders
    SnapshotRecorderService,
    HealthSnapshotService,
    CacheSnapshotService,
    UserSnapshotService,
    ScoreSnapshotService,

    // API metrics buffer + interceptor
    ApiMetricsBufferService,
    ApiMetricsInterceptor,

    // Alert evaluation
    AlertEvaluationService,
    AlertThresholdRulesService,
    AlertPersistenceService,

    // Cleanup
    MetricsCleanupService,
  ],
  exports: [ApiMetricsBufferService, ApiMetricsInterceptor],
})
export class AdminMetricsModule {}
