import { Module } from '@nestjs/common';
import { ContentPipelineController } from './content-pipeline.controller';
import { ContentPipelineService } from './content-pipeline.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { EmailModule } from '../email/email.module';
import { MarketsModule } from '../markets/markets.module';
import { ScoringModule } from '../scoring/scoring.module';
import { GeographyModule } from '../geography/geography.module';
import { MarketSnapshotModule } from '../market-snapshot/market-snapshot.module';

import { QueueModule } from './orchestrator/queue.module';
import { RunOrchestratorService } from './orchestrator/run-orchestrator.service';
import { HandlersBootstrapService } from './orchestrator/handlers-bootstrap.service';
import { FetchDataHandler } from './orchestrator/job-handlers/fetch-data.handler';
import { GenerateScriptHandler } from './orchestrator/job-handlers/generate-script.handler';
import { VerifyDataHandler } from './orchestrator/job-handlers/verify-data.handler';
import { LintVoiceHandler } from './orchestrator/job-handlers/lint-voice.handler';
import { SynthesizeAudioHandler } from './orchestrator/job-handlers/synthesize-audio.handler';
import { RenderVideoHandler } from './orchestrator/job-handlers/render-video.handler';
import { PublishHandler } from './orchestrator/job-handlers/publish.handler';
import { PublishYouTubeShortsHandler } from './orchestrator/job-handlers/publish-youtube-shorts.handler';
import { GenerateLeadMagnetHandler } from './orchestrator/job-handlers/generate-lead-magnet.handler';

import { ContentDataService } from './data/content-data.service';

import { AnthropicScriptGenerator } from './drivers/anthropic-script-generator';
import { SCRIPT_GENERATOR } from './drivers/script-generator.interface';
import { DataVerifierService } from './gates/data-verifier.service';
import { BrandVoiceLinterService } from './gates/brand-voice-linter.service';
import { EdgeTTSDriver } from './drivers/edge-tts-driver';
import { AzureSpeechDriver } from './drivers/azure-speech-driver';
import { TTSDriverFactory } from './drivers/tts-driver.factory';
import { CredentialCrypto } from './drivers/credential-crypto';
import { YouTubeShortsPublisher } from './drivers/youtube-shorts-publisher';
import { PLATFORM_PUBLISHERS } from './drivers/platform-publisher.interface';
import { RemotionCLIRenderer } from './drivers/remotion-cli-renderer';
import { VIDEO_RENDERER } from './drivers/video-renderer.interface';
import { PuppeteerLeadMagnetRenderer } from './drivers/puppeteer-lead-magnet-renderer';
import { LEAD_MAGNET_RENDERER } from './drivers/lead-magnet-renderer.interface';

import { ShortLinkService } from './short-links/short-link.service';
import { ShortLinkController } from './short-links/short-link.controller';
import { AttributionService } from './short-links/attribution.service';

import { YouTubeMetricsService } from './analytics/youtube-metrics.service';
import { MetricsPullerService } from './analytics/metrics-puller.service';
import { Pull24hMetricsCron } from './crons/pull-24h-metrics.cron';
import { RecoverStuckRunsCron } from './crons/recover-stuck-runs.cron';

import { PlatformManagerService } from './platform-manager.service';
import { PipelineSettingsService } from './pipeline-settings.service';
import { PlatformCredentialsService } from './platform-credentials.service';

@Module({
  imports: [
    SupabaseModule,
    EmailModule,
    QueueModule,
    MarketsModule,
    ScoringModule,
    GeographyModule,
    MarketSnapshotModule,
  ],
  controllers: [ContentPipelineController, ShortLinkController],
  providers: [
    ContentPipelineService,
    RunOrchestratorService,

    ContentDataService,

    AnthropicScriptGenerator,
    { provide: SCRIPT_GENERATOR, useExisting: AnthropicScriptGenerator },
    DataVerifierService,
    BrandVoiceLinterService,

    EdgeTTSDriver,
    AzureSpeechDriver,
    TTSDriverFactory,
    CredentialCrypto,

    YouTubeShortsPublisher,
    {
      provide: PLATFORM_PUBLISHERS,
      useFactory: (yt: YouTubeShortsPublisher) => [yt],
      inject: [YouTubeShortsPublisher],
    },

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
    PublishHandler,
    PublishYouTubeShortsHandler,
    GenerateLeadMagnetHandler,
    HandlersBootstrapService,

    PlatformManagerService,
    PipelineSettingsService,
    PlatformCredentialsService,
  ],
  exports: [
    ContentPipelineService,
    RunOrchestratorService,
    ContentDataService,
    ShortLinkService,
    AttributionService,
    TTSDriverFactory,
    MetricsPullerService,
    PlatformCredentialsService,
  ],
})
export class ContentPipelineModule {}
