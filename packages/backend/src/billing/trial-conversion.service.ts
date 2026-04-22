import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ServerEventEmitterService } from '../user-analytics/server-event-emitter.service';
import Stripe from 'stripe';

/**
 * Detects when a Stripe `customer.subscription.created` event represents
 * a trial-to-paid conversion, marks the user_trials row as converted
 * (idempotent), and emits `trial.converted` with tier + MRR + days
 * since trial start.
 *
 * The 5-minute `converted_at > now() - 5m` window handles the race where
 * another code path (e.g. a separate trial-convert admin action) marked
 * the trial converted just before the webhook fired.
 */
@Injectable()
export class TrialConversionService {
  private readonly logger = new Logger(TrialConversionService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly eventEmitter: ServerEventEmitterService,
  ) {}

  async handleSubscriptionCreated(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const userId = await this.resolveUserId(subscription);
    if (!userId) {
      this.logger.debug(
        `subscription.created ${subscription.id}: no user mapping — skipping trial conversion check`,
      );
      return;
    }

    const client = this.supabase.getClient();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString();

    // Find an active trial, or one just-converted by another code path
    // within the last 5 minutes (race tolerance).
    const { data: trial } = await client
      .from('user_trials')
      .select('id, tier, started_at, converted_at')
      .eq('user_id', userId)
      .is('cancelled_at', null)
      .or(`converted_at.is.null,converted_at.gte.${fiveMinutesAgo}`)
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!trial) {
      // Non-trial signup (e.g. enterprise sales). No event to emit.
      return;
    }

    // Idempotent: only set converted_at if not already set.
    if (!trial.converted_at) {
      await client
        .from('user_trials')
        .update({ converted_at: new Date().toISOString() })
        .eq('id', trial.id)
        .is('converted_at', null);
    }

    const priceItem = subscription.items.data[0];
    const tier = priceItem?.price?.nickname ?? trial.tier ?? 'unknown';
    const mrrCents = priceItem?.price?.unit_amount ?? 0;
    const daysSinceTrialStart = Math.floor(
      (Date.now() - new Date(trial.started_at).getTime()) / 86_400_000,
    );

    await this.eventEmitter.emit('trial', 'converted', userId, {
      tier,
      mrr_cents: mrrCents,
      days_since_trial_start: daysSinceTrialStart,
    });

    this.logger.log(
      `trial.converted emitted for user ${userId} (tier=${tier}, mrr_cents=${mrrCents}, days=${daysSinceTrialStart})`,
    );
  }

  /**
   * Resolve the PropertyIQ user_id from a Stripe subscription.
   * Prefers subscription.metadata.user_id (set at checkout); falls back
   * to user_profiles.stripe_customer_id lookup (same pattern as the
   * existing handleSubscriptionDeleted / handlePaymentFailed paths).
   */
  private async resolveUserId(
    subscription: Stripe.Subscription,
  ): Promise<string | null> {
    const metadataUserId = subscription.metadata?.user_id;
    if (metadataUserId) return metadataUserId;

    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id;
    if (!customerId) return null;

    const client = this.supabase.getClient();
    const { data: profile } = await client
      .from('user_profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();

    return profile?.id ?? null;
  }
}
