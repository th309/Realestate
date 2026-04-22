import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { SupabaseModule } from '../supabase/supabase.module';
import { RedisModule } from '../redis/redis.module';
import { EventIngestionController } from './event-ingestion.controller';
import { EventIngestionService } from './event-ingestion.service';
import { SessionManagerService } from './session-manager.service';
import { IdentityStitchingService } from './identity-stitching.service';
import { OverviewAnalyticsService } from './overview-analytics.service';
import { OverviewDataFetcherService } from './overview-data-fetcher.service';
import { JourneyAnalyticsService } from './journey-analytics.service';
import { RetentionAnalyticsService } from './retention-analytics.service';
import { AcquisitionAnalyticsService } from './acquisition-analytics.service';
import { ConversionAnalyticsService } from './conversion-analytics.service';
import { DailyRollupService } from './daily-rollup.service';
import { FunnelEngineService } from './funnel-engine.service';
import { PageClassifierService } from './page-classifier.service';
import { ServerEventEmitterService } from './server-event-emitter.service';
import { UserAnalyticsController } from './user-analytics.controller';

@Module({
  imports: [
    SupabaseModule,
    RedisModule,
    ConfigModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
  ],
  controllers: [EventIngestionController, UserAnalyticsController],
  providers: [
    EventIngestionService,
    SessionManagerService,
    IdentityStitchingService,
    OverviewAnalyticsService,
    OverviewDataFetcherService,
    JourneyAnalyticsService,
    RetentionAnalyticsService,
    AcquisitionAnalyticsService,
    ConversionAnalyticsService,
    DailyRollupService,
    FunnelEngineService,
    PageClassifierService,
    ServerEventEmitterService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  exports: [
    EventIngestionService,
    SessionManagerService,
    IdentityStitchingService,
    OverviewAnalyticsService,
    JourneyAnalyticsService,
    RetentionAnalyticsService,
    AcquisitionAnalyticsService,
    ConversionAnalyticsService,
    FunnelEngineService,
    PageClassifierService,
    ServerEventEmitterService,
  ],
})
export class UserAnalyticsModule {}
