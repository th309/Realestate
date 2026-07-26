import { Module } from '@nestjs/common';
import { ContentPipelineController } from './content-pipeline.controller';
import { ContentPipelineRunsController } from './content-pipeline-runs.controller';
import { ContentPipelinePlatformsController } from './content-pipeline-platforms.controller';
import { PlatformOAuthCallbackController } from './platform-oauth-callback.controller';
import { ContentRunsService } from './content-runs.service';
import { ContentPipelineQueriesService } from './content-pipeline-queries.service';
import { RunActionsService } from './run-actions.service';
import { RunThumbnailService } from './run-thumbnail.service';
import { MagnetLibraryService } from './magnets/magnet-library.service';
import { MagnetLibraryController } from './magnets/magnet-library.controller';
import { FormatsController } from './formats/formats.controller';
import { ScopeController } from './scope/scope.controller';
import { ScopeService } from './scope/scope.service';
import { BatchRunsController } from './batch-runs.controller';
import { VisionExtractorService } from './style-refs/vision-extractor.service';
import { StyleReferenceService } from './style-refs/style-reference.service';
import { StyleReferenceController } from './style-refs/style-reference.controller';
import { YouTubeDiscoveryService } from './archetypes/youtube-discovery.service';
import { TranscriptFetcherService } from './archetypes/transcript-fetcher.service';
import { ArchetypeClusteringService } from './archetypes/archetype-clustering.service';
import { ScriptArchetypeService } from './archetypes/script-archetype.service';
import { ArchetypeRouter } from './archetypes/archetype-router.service';
import { ArchetypeLibraryController } from './archetypes/archetype-library.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { EmailModule } from '../email/email.module';
import { MarketsModule } from '../markets/markets.module';
import { ScoringModule } from '../scoring/scoring.module';
import { GeographyModule } from '../geography/geography.module';
import { MarketSnapshotModule } from '../market-snapshot/market-snapshot.module';
import { MetricResolutionModule } from '../metric-resolution/metric-resolution.module';

import { QueueModule } from './orchestrator/queue.module';
import { RunOrchestratorService } from './orchestrator/run-orchestrator.service';
import { ScriptRepairService } from './orchestrator/script-repair.service';

import { ContentDataService } from './data/content-data.service';

import { DataVerifierService } from './gates/data-verifier.service';
import { BrandVoiceLinterService } from './gates/brand-voice-linter.service';

import { ShortLinkService } from './short-links/short-link.service';
import { ShortLinkController } from './short-links/short-link.controller';
import { AttributionService } from './short-links/attribution.service';

import { AutoIdeationController } from './auto-ideation/auto-ideation.controller';

import { RankingResolverController } from './ranking/ranking-resolver.controller';
import { RankingResolverService } from './ranking/ranking-resolver.service';
import { MetroHeroImageService } from './metro-hero-image.service';
import { MetroPhotoService } from './media/metro-photo.service';

import { PlatformManagerService } from './platform-manager.service';
import { PipelineSettingsService } from './pipeline-settings.service';
import { PlatformCredentialsService } from './platform-credentials.service';
import { PlatformAppCredentialsService } from './platform-app-credentials.service';

import { DashboardMagnetsService } from './magnets/dashboard-magnets.service';
import { DashboardMagnetsController } from './magnets/dashboard-magnets.controller';
import { LeadMagnetBindingService } from './magnets/lead-magnet-binding.service';
import { MagnetABPromoterService } from './magnets/magnet-ab-promoter.service';
import { FFmpegWrapperService } from './style-refs/ffmpeg-wrapper.service';
import { YtDlpWrapperService } from './style-refs/yt-dlp-wrapper.service';
import { StyleABService } from './style-references/style-ab.service';

import { PostsBrandKitModule } from './posts-brand-kit.module';
import { FeedService } from './feed/feed.service';
import { FeedPostGeneratorService } from './feed/feed-post-generator.service';
import { PostGenerateController } from './feed/post-generate.controller';
import { PostImageRenderService } from './post-images/post-image-render.service';

// Registered via the provider groups below; imported here because the module
// re-exports them to other feature modules.
import { TTSDriverFactory } from './drivers/tts-driver.factory';
import { PlatformPublisherRegistry } from './drivers/platform-publisher.registry';
import { MetricsPullerService } from './analytics/metrics-puller.service';

import { CONTENT_PIPELINE_DRIVER_PROVIDERS } from './content-pipeline-driver.providers';
import { CONTENT_PIPELINE_JOB_HANDLER_PROVIDERS } from './content-pipeline-job-handler.providers';
import { CONTENT_PIPELINE_ANALYTICS_PROVIDERS } from './content-pipeline-analytics.providers';

@Module({
  imports: [
    SupabaseModule,
    EmailModule,
    QueueModule,
    MarketsModule,
    ScoringModule,
    GeographyModule,
    MarketSnapshotModule,
    MetricResolutionModule,
    PostsBrandKitModule,
  ],
  controllers: [
    ContentPipelineRunsController,
    ContentPipelineController,
    ContentPipelinePlatformsController,
    PlatformOAuthCallbackController,
    ShortLinkController,
    MagnetLibraryController,
    DashboardMagnetsController,
    StyleReferenceController,
    ArchetypeLibraryController,
    FormatsController,
    ScopeController,
    BatchRunsController,
    RankingResolverController,
    AutoIdeationController,
    PostGenerateController,
  ],
  providers: [
    ContentRunsService,
    ContentPipelineQueriesService,
    RunActionsService,
    RunThumbnailService,
    MagnetLibraryService,
    DashboardMagnetsService,
    LeadMagnetBindingService,
    MagnetABPromoterService,
    VisionExtractorService,
    StyleReferenceService,
    StyleABService,
    FFmpegWrapperService,
    YtDlpWrapperService,
    YouTubeDiscoveryService,
    TranscriptFetcherService,
    ArchetypeClusteringService,
    ScriptArchetypeService,
    ArchetypeRouter,
    RunOrchestratorService,
    ScriptRepairService,

    ContentDataService,

    DataVerifierService,
    BrandVoiceLinterService,

    ShortLinkService,
    AttributionService,

    PlatformManagerService,
    PipelineSettingsService,
    PlatformCredentialsService,
    PlatformAppCredentialsService,
    ScopeService,
    RankingResolverService,
    MetroHeroImageService,
    MetroPhotoService,

    FeedService,
    FeedPostGeneratorService,
    PostImageRenderService,

    ...CONTENT_PIPELINE_DRIVER_PROVIDERS,
    ...CONTENT_PIPELINE_JOB_HANDLER_PROVIDERS,
    ...CONTENT_PIPELINE_ANALYTICS_PROVIDERS,
  ],
  exports: [
    ContentRunsService,
    ContentPipelineQueriesService,
    RunActionsService,
    RunOrchestratorService,
    ContentDataService,
    ShortLinkService,
    AttributionService,
    TTSDriverFactory,
    MetricsPullerService,
    PlatformCredentialsService,
    PlatformPublisherRegistry,
    RankingResolverService,
    MetroHeroImageService,
  ],
})
export class ContentPipelineModule {}
