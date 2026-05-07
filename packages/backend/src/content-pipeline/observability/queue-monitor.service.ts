import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { QueueService, QueueName } from '../orchestrator/queue.service';
import { AlertDispatcherService } from './alert-dispatcher.service';

@Injectable()
export class QueueMonitorService {
  constructor(
    private readonly queue: QueueService,
    private readonly supabase: SupabaseService,
    private readonly alerts: AlertDispatcherService,
  ) {}

  async sampleAll(): Promise<void> {
    const queues: QueueName[] = [
      'orchestrator',
      'render-audio',
      'render-captions',
      'render-video',
      'render-pdf',
      'publish-youtube',
      'publish-tiktok',
      'publish-instagram',
      'publish-facebook',
      'publish-linkedin',
      'metrics-pull',
    ];

    const client = this.supabase.getClient();

    for (const q of queues) {
      const depth = await this.queue.getBoss().getQueueSize(q);
      await client.from('observability_queue_samples').insert({
        queue_name: q,
        depth,
      });
    }

    // If last 10 minutes all samples are above threshold, alert.
    const since = new Date(Date.now() - 10 * 60_000).toISOString();
    const sustainedDepth = 20;
    const minSamples = 3;

    for (const q of queues) {
      const { data: recent } = await client
        .from('observability_queue_samples')
        .select('depth')
        .eq('queue_name', q)
        .gte('sampled_at', since);

      if (
        recent &&
        recent.length >= minSamples &&
        recent.every((r: any) => Number(r.depth) > sustainedDepth)
      ) {
        await this.alerts.sendAlert(
          'warn',
          'queue_backlog',
          `Queue ${q} depth sustained above ${sustainedDepth} for 10+ minutes.`,
          { queue: q, threshold: sustainedDepth, minutes: 10 },
        );
      }
    }
  }
}

