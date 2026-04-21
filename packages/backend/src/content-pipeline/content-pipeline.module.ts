import { Module } from '@nestjs/common';
import { ContentPipelineController } from './content-pipeline.controller';
import { ContentPipelineService } from './content-pipeline.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { MarketsModule } from '../markets/markets.module';
import { ScoringModule } from '../scoring/scoring.module';
import { GeographyModule } from '../geography/geography.module';
import { QueueModule } from './orchestrator/queue.module';
import { ContentDataService } from './data/content-data.service';
import { AnthropicScriptGenerator } from './drivers/anthropic-script-generator';
import { SCRIPT_GENERATOR } from './drivers/script-generator.interface';
import { DataVerifierService } from './gates/data-verifier.service';
import { BrandVoiceLinterService } from './gates/brand-voice-linter.service';
import { EdgeTTSDriver } from './drivers/edge-tts-driver';
import { TTSDriverFactory } from './drivers/tts-driver.factory';
import { CredentialCrypto } from './drivers/credential-crypto';
import { YouTubeShortsPublisher } from './drivers/youtube-shorts-publisher';
import { PLATFORM_PUBLISHERS } from './drivers/platform-publisher.interface';
import { ShortLinkService } from './short-links/short-link.service';
import { ShortLinkController } from './short-links/short-link.controller';

@Module({
  imports: [
    SupabaseModule,
    QueueModule,
    MarketsModule,
    ScoringModule,
    GeographyModule,
  ],
  controllers: [ContentPipelineController, ShortLinkController],
  providers: [
    ContentPipelineService,
    ContentDataService,
    AnthropicScriptGenerator,
    { provide: SCRIPT_GENERATOR, useExisting: AnthropicScriptGenerator },
    DataVerifierService,
    BrandVoiceLinterService,
    EdgeTTSDriver,
    TTSDriverFactory,
    CredentialCrypto,
    YouTubeShortsPublisher,
    {
      provide: PLATFORM_PUBLISHERS,
      useFactory: (yt: YouTubeShortsPublisher) => [yt],
      inject: [YouTubeShortsPublisher],
    },
    ShortLinkService,
  ],
  exports: [
    ContentPipelineService,
    ContentDataService,
    ShortLinkService,
    TTSDriverFactory,
  ],
})
export class ContentPipelineModule {}
