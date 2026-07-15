// Backend v1.2.0 - Added affordable_home_price endpoints
import {
  Module,
  MiddlewareConsumer,
  NestModule,
  ExecutionContext,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { cronScheduleImports } from './config/cron-schedule.imports';
import { devWalkthroughImports } from './admin/dev-walkthrough/dev-walkthrough.imports';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
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
import { AnalyticsPersistenceModule } from './analytics-persistence/analytics-persistence.module';
import { FeaturesModule } from './admin/features/features.module';
import { UsersModule as AdminUsersModule } from './admin/users/users.module';
import { AnalyticsModule as AdminAnalyticsModule } from './admin/analytics/analytics.module';
import { TrialModule } from './admin/trial/trial.module';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { BillingModule } from './billing/billing.module';
import { RedisModule } from './redis/redis.module';
import { MarketAnalysisModule } from './market-analysis/market-analysis.module';
import { PartnersModule } from './partners/partners.module';
import { MarketSnapshotModule } from './market-snapshot/market-snapshot.module';
import { BenchmarksModule } from './benchmarks/benchmarks.module';
import { AlertsModule } from './alerts/alerts.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { EmailModule } from './email/email.module';
import { PushModule } from './push/push.module';
import { SupportModule } from './support/support.module';
import { MetricResolutionModule } from './metric-resolution/metric-resolution.module';
import { PricingModule } from './pricing/pricing.module';
import { UserAnalyticsModule } from './user-analytics/user-analytics.module';
import { AuthHooksModule } from './auth-hooks/auth-hooks.module';
import { InsightsModule } from './insights/insights.module';
import { PreferencesModule } from './preferences/preferences.module';
import { AiProviderModule } from './ai-provider/ai-provider.module';
import { OrgAuditModule } from './org-audit/org-audit.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { OrgBillingModule } from './org-billing/org-billing.module';
import { OrgBrandingModule } from './org-branding/org-branding.module';
import { OrgEmbedsModule } from './org-embeds/org-embeds.module';
import { OrgApiKeysModule } from './org-api-keys/org-api-keys.module';
import { UserApiKeysModule } from './user-api-keys/user-api-keys.module';
import { PlatformApiModule } from './platform-api/platform-api.module';
import { DeviceAuthModule } from './device-auth/device-auth.module';
import { AdminMetricsModule } from './admin-metrics/admin-metrics.module';
import { SurveysModule } from './surveys/surveys.module';
import { ReferralsModule } from './referrals/referrals.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { SocialProofModule } from './social-proof/social-proof.module';
import { SchedulingModule } from './scheduling/scheduling.module';
import { ApiMetricsInterceptor } from './admin-metrics/interceptors/api-metrics.interceptor';
import { ContentPipelineModule } from './content-pipeline/content-pipeline.module';
import { MigrationModule } from './migration/migration.module';
import { EmploymentSectorsModule } from './employment-sectors/employment-sectors.module';
import { AnonymousModule } from './anonymous/anonymous.module';
import { AnalyzerModule } from './analyzer/analyzer.module';
import { RentcastModule } from './rentcast/rentcast.module';
import { SeoRevalidationModule } from './seo-revalidation/seo-revalidation.module';
import { ScreenerModule } from './screener/screener.module';
import { UsageModule } from './usage/usage.module';
import { MarketExplorerModule } from './market-explorer/market-explorer.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ...cronScheduleImports(),
    ...devWalkthroughImports(),
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'short', ttl: 1000, limit: 20 },
        { name: 'medium', ttl: 60000, limit: 100 },
        { name: 'long', ttl: 600000, limit: 500 },
      ],
      // Skip per-IP throttling for trusted internal callers. The Next.js frontend's
      // server-side ISR/build/regeneration data fetches carry the shared
      // REVALIDATE_SECRET in the x-internal-key header. They originate from a single
      // egress IP in large bursts (prerendering ~150 metros, ISR regeneration,
      // crawl-driven regeneration) and would otherwise be 429'd — rendering the SEO
      // market pages with empty data. Public/anonymous traffic stays throttled.
      skipIf: (context: ExecutionContext): boolean => {
        const secret = process.env.REVALIDATE_SECRET;
        if (!secret) return false;
        const req = context.switchToHttp().getRequest<{
          headers?: Record<string, string | string[] | undefined>;
        }>();
        return req.headers?.['x-internal-key'] === secret;
      },
    }),
    RedisModule,
    SupabaseModule,
    AiProviderModule,
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
    AnalyticsPersistenceModule,
    FeaturesModule,
    AdminUsersModule,
    AdminAnalyticsModule,
    TrialModule,
    EntitlementsModule,
    BillingModule,
    MarketAnalysisModule,
    PartnersModule,
    MarketSnapshotModule,
    BenchmarksModule,
    AlertsModule,
    RecommendationsModule,
    EmailModule,
    PushModule,
    SupportModule,
    MetricResolutionModule,
    PricingModule,
    UserAnalyticsModule,
    AuthHooksModule,
    InsightsModule,
    PreferencesModule,
    OrgAuditModule,
    OrganizationsModule,
    OrgBillingModule,
    OrgBrandingModule,
    OrgEmbedsModule,
    OrgApiKeysModule,
    UserApiKeysModule,
    PlatformApiModule,
    DeviceAuthModule,
    AdminMetricsModule,
    SurveysModule,
    ReferralsModule,
    OnboardingModule,
    SocialProofModule,
    SchedulingModule,
    ContentPipelineModule,
    MigrationModule,
    EmploymentSectorsModule,
    AnonymousModule,
    AnalyzerModule,
    RentcastModule,
    SeoRevalidationModule,
    ScreenerModule,
    UsageModule,
    MarketExplorerModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiMetricsInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
