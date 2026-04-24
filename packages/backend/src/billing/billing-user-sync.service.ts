import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import Stripe from 'stripe';

/**
 * Low-level DB helpers for syncing individual user subscription state.
 * Called by BillingWebhookService after Stripe events are processed.
 *
 * Extracted to keep BillingWebhookService within the 300-line hard limit
 * (CLAUDE.md §1.3) and to give these persistence concerns a single home.
 */
@Injectable()
export class BillingUserSyncService {
  private readonly logger = new Logger(BillingUserSyncService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Updates subscription_tier, subscription_status, and stripe_subscription_id
   * for the given user. Admin users are skipped — their tier is not Stripe-driven.
   */
  async syncUserTier(
    userId: string,
    tier: string,
    stripeSubscriptionId: string,
  ): Promise<void> {
    const client = this.supabase.getClient();

    const { data: adminRow } = await client
      .from('admin_users')
      .select('id')
      .eq('id', userId)
      .single();

    if (adminRow) {
      this.logger.log(
        `Skipping tier sync for admin user ${userId} — admin tier is not Stripe-driven`,
      );
      return;
    }

    await client
      .from('user_profiles')
      .update({
        subscription_tier: tier,
        subscription_status: 'active',
        stripe_subscription_id: stripeSubscriptionId,
      })
      .eq('id', userId);

    this.logger.log(`Synced user ${userId} to tier ${tier}`);
  }

  /**
   * Looks up a user by Stripe customer ID, syncs their tier when the
   * subscription is active or trialing, and returns the resolved user ID.
   * Returns null when no profile is found or the sync is skipped.
   */
  async syncFromCustomerId(
    customerId: string,
    subscription: Stripe.Subscription,
  ): Promise<string | null> {
    const client = this.supabase.getClient();
    const { data: profile } = await client
      .from('user_profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (!profile) return null;

    const priceId = subscription.items.data[0]?.price.id;
    const tier = await this.tierFromPriceId(priceId);
    const status = subscription.status;

    if (status === 'active' || status === 'trialing') {
      if (!tier) {
        this.logger.error(
          `Unknown price ID ${priceId} for customer ${customerId} — skipping tier sync`,
        );
        return null;
      }
      await this.syncUserTier(profile.id, tier, subscription.id);
      return profile.id;
    }

    return null;
  }

  /**
   * Resolves a Stripe price ID to a subscription tier slug by checking
   * monthly then yearly price columns in subscription_tiers.
   */
  async tierFromPriceId(priceId: string): Promise<string | null> {
    const client = this.supabase.getClient();

    // Check monthly price first, then yearly — avoids string interpolation in .or()
    const { data: monthly } = await client
      .from('subscription_tiers')
      .select('slug')
      .eq('stripe_price_monthly_id', priceId)
      .single();

    if (monthly?.slug) return monthly.slug;

    const { data: yearly } = await client
      .from('subscription_tiers')
      .select('slug')
      .eq('stripe_price_yearly_id', priceId)
      .single();

    return yearly?.slug || null;
  }
}
