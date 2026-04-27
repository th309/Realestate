import { Module } from '@nestjs/common';
import { ContentPipelineController } from './content-pipeline.controller';
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
import { RefreshArchetypesCron } from './crons/refresh-archetypes.cron';
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
import { HandlersBootstrapService } from './orchestrator/handlers-bootstrap.service';
import { FetchDataHandler } from './orchestrator/job-handlers/fetch-data.handler';
import { GenerateScriptHandler } from './orchestrator/job-handlers/generate-script.handler';
import { VerifyDataHandler } from './orchestrator/job-handlers/verify-data.handler';
import { LintVoiceHandler } from './orchestrator/job-handlers/lint-voice.handler';
import { SynthesizeAudioHandler } from './orchestrator/job-handlers/synthesize-audio.handler';
import { RenderVideoHandler } from './orchestrator/job-handlers/render-video.handler';
import { RenderThumbnailHandler } from './orchestrator/job-handlers/render-thumbnail.handler';
import { PublishHandler } from './orchestrator/job-handlers/publish.handler';
import { PublishYouTubeShortsHandler } from './orchestrator/job-handlers/publish-youtube-shorts.handler';
import { PublishTikTokHandler } from './orchestrator/job-handlers/publish-tiktok.handler';
import { PublishInstagramHandler } from './orchestrator/job-handlers/publish-instagram.handler';
import { PublishFacebookHandler } from './orchestrator/job-handlers/publish-facebook.handler';
import { PublishLinkedInHandler } from './orchestrator/job-handlers/publish-linkedin.handler';
import { GenerateLeadMagnetHandler } from './orchestrator/job-handlers/generate-lead-magnet.handler';
import { TimeCaptionsHandler } from './orchestrator/job-handlers/time-captions.handler';

import { ContentDataService } from './data/content-data.service';

import { AnthropicScriptGenerator } from './drivers/anthropic-script-generator';
import { SCRIPT_GENERATOR } from './drivers/script-generator.interface';
import { DataVerifierService } from './gates/data-verifier.service';
import { BrandVoiceLinterService } from './gates/brand-voice-linter.service';
import { EdgeTTSDriver } from './drivers/edge-tts-driver';
import { AzureSpeechDriver } from './drivers/azure-speech-driver';
import { OpenAITTSDriver } from './drivers/openai-tts-driver';
import { TTSDriverFactory } from './drivers/tts-driver.factory';
import { CredentialCrypto } from './drivers/credential-crypto';
import { YouTubeShortsPublisher } from './drivers/youtube-shorts-publisher';
import { YouTubeLongFormPublisher } from './drivers/youtube-longform-publisher';
import { TikTokPublisher } from './drivers/tiktok-publisher';
import { InstagramReelsPublisher } from './drivers/instagram-reels-publisher';
import { FacebookReelsPublisher } from './drivers/facebook-reels-publisher';
import { LinkedInPublisher } from './drivers/linkedin-publisher';
import { PlatformPublisherRegistry } from './drivers/platform-publisher.registry';
import { PLATFORM_PUBLISHERS } from './drivers/platform-publisher.interface';
import { RemotionCLIRenderer } from './drivers/remotion-cli-renderer';
import { VIDEO_RENDERER } from './drivers/video-renderer.interface';
import { PuppeteerLeadMagnetRenderer } from './drivers/puppeteer-lead-magnet-renderer';
import { LEAD_MAGNET_RENDERER } from './drivers/lead-magnet-renderer.interface';
import { OpenAIWhisperTimer } from './drivers/openai-whisper-timer';
import { CAPTION_TIMER } from './drivers/caption-timer.interface';

import { ShortLinkService } from './short-links/short-link.service';
import { ShortLinkController } from './short-links/short-link.controller';
import { AttributionService } from './short-links/attribution.service';

import { YouTubeMetricsService } from './analytics/youtube-metrics.service';
import { MetricsPullerService } from './analytics/metrics-puller.service';
import { Pull24hMetricsCron } from './crons/pull-24h-metrics.cron';
import { RecoverStuckRunsCron } from './crons/recover-stuck-runs.cron';

import { RankingResolverController } from './ranking/ranking-resolver.controller';
import { RankingResolverService } from './ranking/ranking-resolver.service';

import { PlatformManagerService } from './platform-manager.service';
import { PipelineSettingsService } from './pipeline-settings.service';
import { PlatformCredentialsService } from './platform-credentials.service';
import { PlatformAppCredentialsService } from './platform-app-credentials.service';

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
  ],
  controllers: [
    ContentPipelineController,
    ContentPipelinePlatformsController,
    PlatformOAuthCallbackController,
    ShortLinkController,
    MagnetLibraryController,
    StyleReferenceController,
    ArchetypeLibraryController,
    FormatsController,
    ScopeController,
    BatchRunsController,
    RankingResolverController,
  ],
  providers: [
    ContentRunsService,
    ContentPipelineQueriesService,
    RunActionsService,
    RunThumbnailService,
    MagnetLibraryService,
    VisionExtractorService,
    StyleReferenceService,
    YouTubeDiscoveryService,
    TranscriptFetcherService,
    ArchetypeClusteringService,
    ScriptArchetypeService,
    ArchetypeRouter,
    RefreshArchetypesCron,
    RunOrchestratorService,
    ScriptRepairService,

    ContentDataService,

    AnthropicScriptGenerator,
    { provide: SCRIPT_GENERATOR, useExisting: AnthropicScriptGenerator },
    DataVerifierService,
    BrandVoiceLinterService,

    EdgeTTSDriver,
    AzureSpeechDriver,
    OpenAITTSDriver,
    TTSDriverFactory,
    CredentialCrypto,

    OpenAIWhisperTimer,
    { provide: CAPTION_TIMER, useExisting: OpenAIWhisperTimer },

    YouTubeShortsPublisher,
    YouTubeLongFormPublisher,
    TikTokPublisher,
    InstagramReelsPublisher,
    FacebookReelsPublisher,
    LinkedInPublisher,
    {
      provide: PLATFORM_PUBLISHERS,
      useFactory: (
        yt: YouTubeShortsPublisher,
        ytLong: YouTubeLongFormPublisher,
        tt: TikTokPublisher,
        ig: InstagramReelsPublisher,
        fb: FacebookReelsPublisher,
        li: LinkedInPublisher,
      ) => [yt, ytLong, tt, ig, fb, li],
      inject: [
        YouTubeShortsPublisher,
        YouTubeLongFormPublisher,
        TikTokPublisher,
        InstagramReelsPublisher,
        FacebookReelsPublisher,
        LinkedInPublisher,
      ],
    },
    PlatformPublisherRegistry,

    RemotionCLIRenderer,
    { provide: VIDEO_RENDERER, useExisting: RemotionCLIRenderer },

    PuppeteerLeadMagnetRenderer,
    { provide: LEAD_MAGNET_RENDERER, useExisting: PuppeteerLeadMagnetRenderer },

    ShortLinkService,
    AttributionService,

    YouTubeMetricsService,
    MetricsPullerService,
    Pull24hMetricsCron,
    RecoverStuckRunsCron,

    FetchDataHandler,
    GenerateScriptHandler,
    VerifyDataHandler,
    LintVoiceHandler,
    SynthesizeAudioHandler,
    RenderVideoHandler,
    RenderThumbnailHandler,
    TimeCaptionsHandler,
    PublishHandler,
    PublishYouTubeShortsHandler,
    PublishTikTokHandler,
    PublishInstagramHandler,
    PublishFacebookHandler,
    PublishLinkedInHandler,
    GenerateLeadMagnetHandler,
    HandlersBootstrapService,

    PlatformManagerService,
    PipelineSettingsService,
    PlatformCredentialsService,
    PlatformAppCredentialsService,
    ScopeService,
    RankingResolverService,
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
  ],
})
export class ContentPipelineModule {}
