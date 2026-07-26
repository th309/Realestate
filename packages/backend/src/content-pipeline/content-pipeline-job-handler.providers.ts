// packages/backend/src/content-pipeline/content-pipeline-job-handler.providers.ts
import { Provider } from '@nestjs/common';
import { HandlersBootstrapService } from './orchestrator/handlers-bootstrap.service';
import { FetchDataHandler } from './orchestrator/job-handlers/fetch-data.handler';
import { GenerateScriptHandler } from './orchestrator/job-handlers/generate-script.handler';
import { VerifyDataHandler } from './orchestrator/job-handlers/verify-data.handler';
import { LintVoiceHandler } from './orchestrator/job-handlers/lint-voice.handler';
import { SynthesizeAudioHandler } from './orchestrator/job-handlers/synthesize-audio.handler';
import { RenderVideoHandler } from './orchestrator/job-handlers/render-video.handler';
import { RenderThumbnailHandler } from './orchestrator/job-handlers/render-thumbnail.handler';
import { TimeCaptionsHandler } from './orchestrator/job-handlers/time-captions.handler';
import { PublishHandler } from './orchestrator/job-handlers/publish.handler';
import { PublishYouTubeShortsHandler } from './orchestrator/job-handlers/publish-youtube-shorts.handler';
import { PublishTikTokHandler } from './orchestrator/job-handlers/publish-tiktok.handler';
import { PublishInstagramHandler } from './orchestrator/job-handlers/publish-instagram.handler';
import { PublishFacebookHandler } from './orchestrator/job-handlers/publish-facebook.handler';
import { PublishLinkedInHandler } from './orchestrator/job-handlers/publish-linkedin.handler';
import { GenerateLeadMagnetHandler } from './orchestrator/job-handlers/generate-lead-magnet.handler';

/** One handler per pipeline step, plus the bootstrapper that registers them with the queue. */
export const CONTENT_PIPELINE_JOB_HANDLER_PROVIDERS: Provider[] = [
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
];
