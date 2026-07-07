import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { SupabaseService } from '../supabase/supabase.service';
import { EmailService } from '../email/email.service';
import { buildTrialWillEndEmail } from '../email/behavioral-trigger-emails';
import { getEmailLinkBaseUrl } from '../email/email-link-base';
import { buildUnsubscribe } from '../email/unsubscribe-link.util';

/**
 * Sends a transactional "your Pro trial ends soon — $X will be charged on
 * <date>" notice ~3 days before a trialing subscription's first charge
 * (Stripe `customer.subscription.trial_will_end`). Delegated from
 * BillingWebhookService, mirroring TrialConversionService / BillingUserSyncService.
 * Transactional billing notice — deliberately NOT gated on marketing opt-out.
 */
@Injectable()
export class TrialEndingNotificationService {
  private readonly logger = new Logger(TrialEndingNotificationService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  async handleTrialWillEnd(subscription: Stripe.Subscription): Promise<void> {
    // Stripe can also fire this when a trial ends early or after payment has
    // already been collected, so only notify users genuinely still on trial.
    if (subscription.status !== 'trialing') return;

    // A subscriber who cancelled during the trial keeps status 'trialing' until
    // the end date but will NOT be charged — don't send them a "you'll be
    // charged" notice.
    if (subscription.cancel_at_period_end || subscription.cancel_at) return;

    const client = this.supabase.getClient();

    // Prefer the user_id stamped on the subscription at checkout; otherwise
    // resolve via the Stripe customer id (mirrors the other webhook handlers).
    let userId = subscription.metadata?.user_id ?? null;
    if (!userId) {
      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id;
      if (!customerId) return;
      const { data } = await client
        .from('user_profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();
      userId = data?.id ?? null;
    }
    if (!userId) return;

    const { data: profile } = await client
      .from('user_profiles')
      .select('email')
      .eq('id', userId)
      .single();
    if (!profile?.email) return;

    // Claim the send FIRST — email_triggers has UNIQUE(user_id, trigger_name),
    // so under Stripe's at-least-once (possibly concurrent) redelivery a losing
    // insert conflicts and we skip, rather than double-sending. Keyed per
    // subscription so a later, separate trial still gets its own notice.
    const triggerName = `trial_will_end:${subscription.id}`;
    const { error: claimError } = await client.from('email_triggers').insert({
      user_id: userId,
      trigger_name: triggerName,
      metadata: { subscription_id: subscription.id },
    });
    if (claimError) return; // already claimed (or transient) — Stripe will retry

    const cents = subscription.items.data[0]?.price?.unit_amount ?? 0;
    const amountLabel = `$${(cents / 100).toFixed(2)}`;
    const chargeDateLabel = subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : 'your trial end date';

    const appUrl = getEmailLinkBaseUrl(this.config);
    const unsub = buildUnsubscribe(this.config, userId);
    const html = buildTrialWillEndEmail(
      profile.email.split('@')[0],
      amountLabel,
      chargeDateLabel,
      `${appUrl}/account/billing`,
      unsub?.url ?? `${appUrl}/account/notifications`,
    );

    const sent = await this.emailService.sendEmail({
      to: profile.email,
      subject: `Your PropertyIQ Pro trial ends soon — ${amountLabel}/mo starts ${chargeDateLabel}`,
      html,
      userId,
      emailType: 'trial_will_end',
      headers: unsub?.headers,
    });

    if (sent) {
      this.logger.log(`Sent trial_will_end notice to user ${userId}`);
    } else {
      // Release the claim so a Stripe retry can resend.
      await client
        .from('email_triggers')
        .delete()
        .eq('user_id', userId)
        .eq('trigger_name', triggerName);
    }
  }
}
