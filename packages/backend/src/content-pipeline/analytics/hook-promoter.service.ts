import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { HookABService } from './hook-ab.service';
import { AlertDispatcherService } from '../observability/alert-dispatcher.service';

@Injectable()
export class HookPromoterService {
  private readonly logger = new Logger(HookPromoterService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly hookAb: HookABService,
    private readonly alerts: AlertDispatcherService,
  ) {}

  async evaluate(format: string): Promise<void> {
    const winner = await this.hookAb.determineWinner(format);
    if (!winner) return;

    const client = this.supabase.getClient();
    await client.from('hook_archetypes').upsert({
      format,
      active_archetype: `variant_${winner.winnerVariantId}`,
      active_prompt_append: `\n\nPROMOTED_HOOK_VARIANT=${winner.winnerVariantId}\n`,
      last_promoted_at: new Date().toISOString(),
      last_winner_variant: winner.winnerVariantId,
      last_winner_confidence: winner.confidence,
      last_winner_lift: winner.lift,
    });

    this.logger.log(
      `auto-promoted hook variant ${winner.winnerVariantId} for ${format} lift=${(
        winner.lift * 100
      ).toFixed(0)}% conf=${(winner.confidence * 100).toFixed(0)}%`,
    );

    await this.alerts.sendAlert(
      'info',
      'hook_promotion',
      `Hook variant ${winner.winnerVariantId} auto-promoted for ${format} with ${(
        winner.lift * 100
      ).toFixed(0)}% lift at ${(winner.confidence * 100).toFixed(0)}% confidence.`,
      {
        format,
        winnerVariantId: winner.winnerVariantId,
        lift: winner.lift,
        confidence: winner.confidence,
        aSamples: winner.aSamples,
        bSamples: winner.bSamples,
        aMeanRetention: winner.aMeanRetention,
        bMeanRetention: winner.bMeanRetention,
      },
    );
  }
}

