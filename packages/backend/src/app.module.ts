// Backend v1.2.0 - Added affordable_home_price endpoints
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase/supabase.module';
import { MarketsModule } from './markets/markets.module';
import { ZillowModule } from './zillow/zillow.module';
import { RealtorModule } from './realtor/realtor.module';
import { ScoringModule } from './scoring/scoring.module';
import { GeographyModule } from './geography/geography.module';
import { MetricsModule } from './metrics/metrics.module';
import { CensusModule } from './census/census.module';
import { EconomicModule } from './economic/economic.module';
import { ReportsModule } from './reports/reports.module';
import { TimeSeriesModule } from './timeseries/timeseries.module';
import { PermitsModule } from './permits/permits.module';
import { HealthModule } from './health/health.module';
import { MLWorkflowModule } from './ml-workflow/ml-workflow.module';
import { DataIngestionModule } from './data-ingestion/data-ingestion.module';
import { AnalyticsChatModule } from './analytics-chat/analytics-chat.module';
import { AnalyticsPersistenceModule } from './analytics-persistence/analytics-persistence.module';
import { FeaturesModule } from './admin/features/features.module';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { RedisModule } from './redis/redis.module';
import { MarketAnalysisModule } from './market-analysis/market-analysis.module';
import { PartnersModule } from './partners/partners.module';
import { MarketSnapshotModule } from './market-snapshot/market-snapshot.module';
import { CacheRefreshJob } from './jobs/cache-refresh.job';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ScheduleModule.forRoot(),
    RedisModule,
    SupabaseModule,
    MarketsModule,
    ZillowModule,
    RealtorModule,
    ScoringModule,
    GeographyModule,
    MetricsModule,
    CensusModule,
    EconomicModule,
    ReportsModule,
    TimeSeriesModule,
    PermitsModule,
    HealthModule,
    MLWorkflowModule,
    DataIngestionModule,
    AnalyticsChatModule,
    AnalyticsPersistenceModule,
    FeaturesModule,
    EntitlementsModule,
    MarketAnalysisModule,
    PartnersModule,
    MarketSnapshotModule,
  ],
  controllers: [AppController],
  providers: [AppService, CacheRefreshJob],
})
export class AppModule { }
