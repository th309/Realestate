// packages/backend/src/content-pipeline/content-pipeline-driver.providers.ts
import { Provider } from '@nestjs/common';
import { AnthropicScriptGenerator } from './drivers/anthropic-script-generator';
import { SCRIPT_GENERATOR } from './drivers/script-generator.interface';
import { EdgeTTSDriver } from './drivers/edge-tts-driver';
import { AzureSpeechDriver } from './drivers/azure-speech-driver';
import { OpenAITTSDriver } from './drivers/openai-tts-driver';
import { TTSDriverFactory } from './drivers/tts-driver.factory';
import { CredentialCrypto } from './drivers/credential-crypto';
import { OpenAIWhisperTimer } from './drivers/openai-whisper-timer';
import { CAPTION_TIMER } from './drivers/caption-timer.interface';
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
import { PuppeteerPostImageRenderer } from './post-images/post-image-renderer';
import { POST_IMAGE_RENDERER } from './post-images/post-image-renderer.interface';

/**
 * Concrete third-party adapters (LLM, TTS, captioning, social publishers,
 * video/PDF/image renderers) plus the interface tokens the pipeline services
 * inject them by.
 */
export const CONTENT_PIPELINE_DRIVER_PROVIDERS: Provider[] = [
  AnthropicScriptGenerator,
  { provide: SCRIPT_GENERATOR, useExisting: AnthropicScriptGenerator },

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

  PuppeteerPostImageRenderer,
  { provide: POST_IMAGE_RENDERER, useExisting: PuppeteerPostImageRenderer },
];
