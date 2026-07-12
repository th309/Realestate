import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { SupabaseService } from '../supabase/supabase.service';
import { EmailService } from '../email/email.service';
import { buildPaymentFailedEmail } from '../email/billing-trigger-emails';
import { getEmailLinkBaseUrl } from '../email/email-link-base';
import { buildUnsubscribe } from '../email/unsubscribe-link.util';

/**
 * Sends a transactional "your payment didn't go through — update your card"
 * notice when Stripe reports `invoice.payment_failed`. Delegated from
 * BillingWebhookService, mirroring TrialEndingNotificationService's
 * claim-before-send idempotency pattern.
 * Transactional billing notice — deliberately NOT gated on marketing opt-out.
 */
@Injectable()
export class PaymentFailedNotificationService {
  private readonly logger = new Logger(PaymentFailedNotificationService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId =
      typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id;
    if (!customerId) return;

    const client = this.supabase.getClient();
    const { data: profile } = await client
      .from('user_profiles')
      .select('id, email')
      .eq('stripe_customer_id', customerId)
      .single();
    if (!profile?.id || !profile?.email) return;

    const userId = profile.id;

    // Claim the send FIRST — email_triggers has UNIQUE(user_id, trigger_name),
    // so under Stripe's at-least-once (possibly concurrent) redelivery a losing
    // insert conflicts and we skip, rather than double-sending. Keyed per
    // invoice so a later, separate failure still gets its own notice.
    const triggerName = `payment_failed:${invoice.id}`;
    const { error: claimError } = await client.from('email_triggers').insert({
      user_id: userId,
      trigger_name: triggerName,
      metadata: { invoice_id: invoice.id },
    });
    if (claimError) return; // already claimed (or transient) — Stripe will retry

    const appUrl = getEmailLinkBaseUrl(this.config);
    const unsub = buildUnsubscribe(this.config, userId);
    const html = buildPaymentFailedEmail(
      profile.email.split('@')[0],
      `${appUrl}/account/billing`,
      unsub?.url ?? `${appUrl}/account/notifications`,
    );

    const sent = await this.emailService.sendEmail({
      to: profile.email,
      subject: 'Action needed: your PropertyIQ payment failed',
      html,
      userId,
      emailType: 'payment_failed',
      headers: unsub?.headers,
    });

    if (sent) {
      this.logger.log(`Sent payment_failed notice to user ${userId}`);
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
