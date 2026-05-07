import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { AlertDispatcherService } from '../observability/alert-dispatcher.service';

@Injectable()
export class SuccessRateService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly alerts: AlertDispatcherService,
  ) {}

  async checkAll(): Promise<void> {
    const client = this.supabase.getClient();
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { data: runs } = await client
      .from('content_runs')
      .select('format, status')
      .gte('created_at', weekAgo);
    if (!runs) return;

    const byFormat = new Map<string, { total: number; success: number }>();
    for (const r of runs as any[]) {
      const f = r.format as string;
      if (!byFormat.has(f)) byFormat.set(f, { total: 0, success: 0 });
      const entry = byFormat.get(f)!;
      entry.total++;
      if (r.status === 'published' || r.status === 'published_partial') {
        entry.success++;
      }
    }

    for (const [format, { total, success }] of byFormat.entries()) {
      if (total < 5) continue;
      const rate = success / total;
      if (rate < 0.95) {
        await this.alerts.sendAlert(
          'warn',
          'format_success_rate_low',
          `Format ${format} success rate is ${(rate * 100).toFixed(0)}% over last 7 days (${success}/${total}).`,
          { format, rate, success, total },
        );
      }
    }
  }
}

