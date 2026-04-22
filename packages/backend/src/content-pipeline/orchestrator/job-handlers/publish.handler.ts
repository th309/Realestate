import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service';
import { QueueService } from '../queue.service';
import { RunOrchestratorService } from '../run-orchestrator.service';
import { Platform } from '../../types';

const PLATFORM_TO_QUEUE: Partial<
  Record<
    Platform,
    | 'publish-youtube'
    | 'publish-tiktok'
    | 'publish-instagram'
    | 'publish-facebook'
    | 'publish-linkedin'
  >
> = {
  youtube_shorts: 'publish-youtube',
  youtube_long: 'publish-youtube',
  tiktok: 'publish-tiktok',
  instagram_reels: 'publish-instagram',
  facebook_reels: 'publish-facebook',
  linkedin: 'publish-linkedin',
};

@Injectable()
export class PublishHandler {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly queue: QueueService,
    private readonly orchestrator: RunOrchestratorService,
  ) {}

  async handle(runId: string): Promise<void> {
    const client = this.supabase.getClient();
    const { data: run } = await client
      .from('content_runs')
      .select('selected_platforms')
      .eq('id', runId)
      .single();
    if (!run) throw new Error(`run ${runId} not found`);

    const platforms = (run.selected_platforms ?? []) as Platform[];

    // If no platforms are selected (dry-run or test mode), mark published
    // immediately. The run produced a video artifact and is considered
    // successful at that point; there's simply nothing to publish to.
    if (platforms.length === 0) {
      await this.orchestrator.transitionTo(runId, 'published', {
        reason: 'no_platforms_selected',
        enqueueNext: false,
      });
      return;
    }

    for (const platform of platforms) {
      const queueName = PLATFORM_TO_QUEUE[platform];
      if (queueName) await this.queue.send(queueName, { runId, platform });
    }
  }
}
