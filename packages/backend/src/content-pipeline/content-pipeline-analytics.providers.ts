// packages/backend/src/content-pipeline/content-pipeline-analytics.providers.ts
import { Provider } from '@nestjs/common';
import { YouTubeMetricsService } from './analytics/youtube-metrics.service';
import { MetricsPullerService } from './analytics/metrics-puller.service';
import { TikTokMetricsService } from './analytics/tiktok-metrics.service';
import { InstagramMetricsService } from './analytics/instagram-metrics.service';
import { FacebookMetricsService } from './analytics/facebook-metrics.service';
import { LinkedInMetricsService } from './analytics/linkedin-metrics.service';
import { HookABService } from './analytics/hook-ab.service';
import { HookPromoterService } from './analytics/hook-promoter.service';
import { RevenueAttributionService } from './analytics/revenue-attribution.service';
import { PerformanceService } from './analytics/performance.service';
import { SuggestedRunsService } from './analytics/suggested-runs.service';
import { SuccessRateService } from './analytics/success-rate.service';
import { AlertDispatcherService } from './observability/alert-dispatcher.service';
import { StallDetectorService } from './observability/stall-detector.service';
import { QueueMonitorService } from './observability/queue-monitor.service';
import { CostCapService } from './auto-ideation/cost-cap.service';
import { TriggerRuleEvaluatorService } from './auto-ideation/trigger-rule-evaluator.service';
import { AutoIdeationService } from './auto-ideation/auto-ideation.service';
import { Pull24hMetricsCron } from './crons/pull-24h-metrics.cron';
import { Pull7dMetricsCron } from './crons/pull-7d-metrics.cron';
import { Pull30dMetricsCron } from './crons/pull-30d-metrics.cron';
import { HookPromotionCron } from './crons/hook-promotion.cron';
import { CredentialHealthProbeCron } from './crons/credential-health-probe.cron';
import { QueueMonitorCron } from './crons/queue-monitor.cron';
import { SuccessRateCheckCron } from './crons/success-rate-check.cron';
import { MagnetPromotionCron } from './crons/magnet-promotion.cron';
import { AutoIdeationScoreScanCron } from './crons/auto-ideation-score-scan.cron';
import { AutoIdeationRankScanCron } from './crons/auto-ideation-rank-scan.cron';
import { AutoIdeationThresholdScanCron } from './crons/auto-ideation-threshold-scan.cron';
import { RecoverStuckRunsCron } from './crons/recover-stuck-runs.cron';
import { CleanupTransientRefsCron } from './crons/cleanup-transient-refs.cron';
import { RefreshArchetypesCron } from './crons/refresh-archetypes.cron';
import { FeedTopUpCron } from './crons/feed-topup.cron';

/**
 * Post-publish measurement (platform metrics, revenue attribution, hook A/B),
 * pipeline observability, auto-ideation, and every scheduled job that drives
 * them.
 */
export const CONTENT_PIPELINE_ANALYTICS_PROVIDERS: Provider[] = [
  YouTubeMetricsService,
  TikTokMetricsService,
  InstagramMetricsService,
  FacebookMetricsService,
  LinkedInMetricsService,
  MetricsPullerService,
  HookABService,
  HookPromoterService,
  RevenueAttributionService,
  PerformanceService,
  SuggestedRunsService,
  AlertDispatcherService,
  StallDetectorService,
  QueueMonitorService,
  SuccessRateService,
  CostCapService,
  TriggerRuleEvaluatorService,
  AutoIdeationService,

  Pull24hMetricsCron,
  Pull7dMetricsCron,
  Pull30dMetricsCron,
  HookPromotionCron,
  CredentialHealthProbeCron,
  QueueMonitorCron,
  SuccessRateCheckCron,
  MagnetPromotionCron,
  AutoIdeationScoreScanCron,
  AutoIdeationRankScanCron,
  AutoIdeationThresholdScanCron,
  RecoverStuckRunsCron,
  CleanupTransientRefsCron,
  RefreshArchetypesCron,
  FeedTopUpCron,
];
