import { Injectable, OnModuleInit } from '@nestjs/common';
import { QueueService } from './queue.service';
import { FetchDataHandler } from './job-handlers/fetch-data.handler';
import { GenerateScriptHandler } from './job-handlers/generate-script.handler';
import { VerifyDataHandler } from './job-handlers/verify-data.handler';
import { LintVoiceHandler } from './job-handlers/lint-voice.handler';
import { SynthesizeAudioHandler } from './job-handlers/synthesize-audio.handler';
import { RenderVideoHandler } from './job-handlers/render-video.handler';
import { PublishHandler } from './job-handlers/publish.handler';
import { PublishYouTubeShortsHandler } from './job-handlers/publish-youtube-shorts.handler';
import {
  GenerateLeadMagnetHandler,
  GenerateLeadMagnetJob,
} from './job-handlers/generate-lead-magnet.handler';

@Injectable()
export class HandlersBootstrapService implements OnModuleInit {
  constructor(
    private readonly queue: QueueService,
    private readonly fetchData: FetchDataHandler,
    private readonly genScript: GenerateScriptHandler,
    private readonly verify: VerifyDataHandler,
    private readonly lint: LintVoiceHandler,
    private readonly synthesize: SynthesizeAudioHandler,
    private readonly renderVideo: RenderVideoHandler,
    private readonly publish: PublishHandler,
    private readonly publishYT: PublishYouTubeShortsHandler,
    private readonly leadMagnet: GenerateLeadMagnetHandler,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.work<{ runId: string; status: string }>(
      'orchestrator',
      async (job) => {
        const { runId, status } = job.data;
        switch (status) {
          case 'fetching_data':
            return this.fetchData.handle(runId);
          case 'scripting':
            return this.genScript.handle(runId);
          case 'verifying_data':
            return this.verify.handle(runId);
          case 'linting_voice':
            return this.lint.handle(runId);
          case 'publishing':
            return this.publish.handle(runId);
        }
      },
    );
    await this.queue.work<{ runId: string }>('render-audio', async (job) =>
      this.synthesize.handle(job.data.runId),
    );
    await this.queue.work<{ runId: string }>('render-video', async (job) =>
      this.renderVideo.handle(job.data.runId),
    );
    await this.queue.work<{ runId: string; platform: string }>(
      'publish-youtube',
      async (job) => {
        if (job.data.platform === 'youtube_shorts')
          await this.publishYT.handle(job.data.runId);
      },
    );
    await this.queue.work<GenerateLeadMagnetJob>('render-pdf', async (job) =>
      this.leadMagnet.handle(job.data),
    );
  }
}
