import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { StripeService } from '../billing/stripe.service';
import { EmailService } from '../email/email.service';

/**
 * Handles applying referral credits when a referred user converts to a paid plan.
 * Injected into BillingWebhookService to hook into checkout.session.completed.
 *
 * Credit rules:
 *  - Referrer is paid (active/trialing): extend Stripe subscription by 30 days
 *  - Referrer is free: increment referral_credit_months_remaining on user_profiles
 */
@Injectable()
export class ReferralCreditService {
  private readonly logger = new Logger(ReferralCreditService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly stripe: StripeService,
    private readonly email: EmailService,
  ) {}

  /**
   * Called after a successful checkout. Checks if the paying user was referred,
   * and if so, credits the referrer and marks the referral event as converted.
   */
  async handleConversion(newPayingUserId: string): Promise<void> {
    const client = this.supabase.getClient();

    // Find an unconverted referral event for this user
    const { data: event, error } = await client
      .from('referral_events')
      .select('id, referrer_id')
      .eq('referred_id', newPayingUserId)
      .eq('state', 'signed_up')
      .is('credit_applied_at', null)
      .maybeSingle();

    if (error) {
      this.logger.error(`Referral event lookup failed: ${error.message}`);
      return;
    }
    if (!event) return; // User was not referred

    // Mark converted immediately to prevent duplicate credits
    const { error: updateErr } = await client
      .from('referral_events')
      .update({ state: 'converted', credit_applied_at: new Date().toISOString() })
      .eq('id', event.id);

    if (updateErr) {
      this.logger.error(`Failed to mark referral converted: ${updateErr.message}`);
      return;
    }

    await this.applyCredit(event.referrer_id);
  }

  private async applyCredit(referrerId: string): Promise<void> {
    const client = this.supabase.getClient();

    const { data: profile } = await client
      .from('user_profiles')
      .select('email, subscription_tier, subscription_status, stripe_customer_id')
      .eq('id', referrerId)
      .maybeSingle();

    if (!profile) {
      this.logger.warn(`Referrer profile not found: ${referrerId}`);
      return;
    }

    const isPaidActive =
      (profile.subscription_tier === 'pro' || profile.subscription_tier === 'enterprise') &&
      (profile.subscription_status === 'active' || profile.subscription_status === 'trialing');

    if (isPaidActive && profile.stripe_customer_id) {
      try {
        await this.stripe.extendSubscriptionByDays(profile.stripe_customer_id, 30);
        this.logger.log(`Extended subscription 30 days for referrer ${referrerId}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Stripe extension failed for ${referrerId}: ${msg}. Storing credit instead.`);
        await client.rpc('increment_referral_credit', { target_user_id: referrerId });
      }
    } else {
      // Free user: store credit to be applied at subscribe time
      const { error } = await client.rpc('increment_referral_credit', { target_user_id: referrerId });
      if (error) {
        this.logger.error(`Failed to increment referral credit for ${referrerId}: ${error.message}`);
      }
    }

    if (profile.email) {
      this.email
        .sendEmail({
          to: profile.email,
          subject: 'You earned 1 free month of Pro!',
          html: `
            <p>Your referral paid off — someone you invited just became a paying PropertyIQ Pro subscriber.</p>
            <p>We've automatically added 1 free month to your account.</p>
            <p>Keep sharing your referral link to earn more free months!</p>
            <p>— The PropertyIQ Team</p>
          `,
          emailType: 'referral_credit_earned',
          userId: referrerId,
        })
        .catch((err: Error) =>
          this.logger.warn(`Credit email failed for ${referrerId}: ${err.message}`),
        );
    }
  }
}
