import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { AlertDispatcherService } from '../observability/alert-dispatcher.service';

@Injectable()
export class MagnetABPromoterService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly alerts: AlertDispatcherService,
  ) {}

  async evaluate(format: string): Promise<void> {
    const client = this.supabase.getClient();
    const { data: bindings } = await client
      .from('format_magnet_bindings')
      .select('id, magnet_kind')
      .eq('format', format)
      .eq('enabled', true);
    if (!bindings || bindings.length < 2) return;

    const results: Array<{ bindingId: string; delivered: number; converted: number }> =
      [];

    for (const b of bindings as any[]) {
      const { data: deliveries } = await client
        .from('lead_magnet_deliveries')
        .select('user_id')
        .eq('binding_id', b.id);
      const userIds = (deliveries ?? []).map((d: any) => d.user_id).filter(Boolean);
      if (userIds.length === 0) {
        results.push({ bindingId: b.id, delivered: 0, converted: 0 });
        continue;
      }

      const { count: converted } = await client
        .from('signup_attributions')
        .select('id', { count: 'exact', head: true })
        .in('user_id', userIds)
        .neq('tier_at_signup', 'free');

      results.push({
        bindingId: b.id,
        delivered: userIds.length,
        converted: converted ?? 0,
      });
    }

    const eligible = results.filter((r) => r.delivered >= 50);
    if (eligible.length < 2) return;

    eligible.sort((a, b) => b.converted / b.delivered - a.converted / a.delivered);
    const winner = eligible[0];
    const loser = eligible[1];
    const winnerRate = winner.converted / winner.delivered;
    const loserRate = loser.converted / loser.delivered;
    if (loserRate === 0) return;
    const lift = (winnerRate - loserRate) / loserRate;
    if (lift < 0.3) return;

    await client.from('format_magnet_bindings').update({ enabled: false }).eq('id', loser.bindingId);

    await this.alerts.sendAlert(
      'info',
      'magnet_auto_promoted',
      `Lead magnet winner promoted for ${format}. Loser binding disabled.`,
      { format, winner: winner.bindingId, loser: loser.bindingId, lift },
    );
  }
}

