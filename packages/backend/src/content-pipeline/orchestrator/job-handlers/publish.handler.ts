import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service';
import { QueueService } from '../queue.service';
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
  ) {}

  async handle(runId: string): Promise<void> {
    const client = this.supabase.getClient();
    const { data: run } = await client
      .from('content_runs')
      .select('selected_platforms')
      .eq('id', runId)
      .single();
    if (!run) throw new Error(`run ${runId} not found`);

    for (const platform of run.selected_platforms as Platform[]) {
      const queueName = PLATFORM_TO_QUEUE[platform];
      if (queueName) await this.queue.send(queueName, { runId, platform });
    }
  }
}
