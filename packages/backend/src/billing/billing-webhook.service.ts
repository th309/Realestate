import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { OrgBillingWebhookService } from '../org-billing/org-billing-webhook.service';
import Stripe from 'stripe';

/**
 * Handles Stripe webhook events and syncs subscription state to user_profiles.
 *
 * Org-specific events (identified by metadata.org_slug) are routed to
 * OrgBillingWebhookService. All other events are handled here for
 * individual user subscriptions.
 */
@Injectable()
export class BillingWebhookService {
  private readonly logger = new Logger(BillingWebhookService.name);

  constructor(
    private readonly supabase: SupabaseService,
    @Optional()
    @Inject(OrgBillingWebhookService)
    private readonly orgWebhook?: OrgBillingWebhookService,
  ) {}

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    this.logger.log(`Processing webhook event: ${event.type}`);

    // Route org-specific events to OrgBillingWebhookService
    const eventData = event.data.object as Record<string, any>;
    if (eventData?.metadata?.org_slug && this.orgWebhook) {
      return this.orgWebhook.handleWebhookEvent(event);
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        await this.handleCheckoutComplete(session);
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        await this.handleSubscriptionUpdated(subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await this.handleSubscriptionDeleted(subscription);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await this.handlePaymentFailed(invoice);
        break;
      }
      default:
        this.logger.debug(`Unhandled webhook event type: ${event.type}`);
    }
  }

  private async handleCheckoutComplete(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const userId = session.metadata?.user_id;
    const tier = session.metadata?.tier;

    if (!userId || !tier) {
      this.logger.warn('Checkout session missing user_id or tier metadata');
      return;
    }

    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;

    if (!subscriptionId) {
      this.logger.warn('Checkout session missing subscription ID');
      return;
    }

    await this.syncUserTier(userId, tier, subscriptionId);
  }

  private async handleSubscriptionUpdated(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const userId = subscription.metadata?.user_id;
    if (!userId) {
      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id;
      await this.syncFromCustomerId(customerId, subscription);
      return;
    }

    const status = subscription.status;
    const client = this.supabase.getClient();

    if (status === 'active' || status === 'trialing') {
      const priceId = subscription.items.data[0]?.price.id;
      const tier = await this.tierFromPriceId(priceId);
      if (!tier) {
        this.logger.error(
          `Unknown price ID ${priceId} for user ${userId} — skipping tier sync to avoid granting unearned access`,
        );
        return;
      }
      await this.syncUserTier(userId, tier, subscription.id);
    } else if (status === 'past_due' || status === 'unpaid') {
      await client
        .from('user_profiles')
        .update({ subscription_status: status })
        .eq('id', userId);
    }
  }

  private async handleSubscriptionDeleted(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;

    const client = this.supabase.getClient();
    const { data: profile } = await client
      .from('user_profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (profile) {
      // Never downgrade admin users — their tier is not Stripe-driven
      const { data: adminRow } = await client
        .from('admin_users')
        .select('id')
        .eq('id', profile.id)
        .single();

      if (adminRow) {
        this.logger.log(
          `Skipping cancellation downgrade for admin user ${profile.id}`,
        );
        return;
      }

      await client
        .from('user_profiles')
        .update({
          subscription_tier: 'free',
          subscription_status: 'cancelled',
          stripe_subscription_id: null,
        })
        .eq('id', profile.id);

      this.logger.log(`Subscription cancelled for user ${profile.id}`);
    }
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId =
      typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id;

    if (!customerId) return;

    const client = this.supabase.getClient();
    const { data: profile } = await client
      .from('user_profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (profile) {
      await client
        .from('user_profiles')
        .update({ subscription_status: 'past_due' })
        .eq('id', profile.id);

      this.logger.warn(`Payment failed for user ${profile.id}`);
    }
  }

  private async syncUserTier(
    userId: string,
    tier: string,
    stripeSubscriptionId: string,
  ): Promise<void> {
    const client = this.supabase.getClient();

    // Never overwrite admin users' tiers — their tier is managed manually
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

  private async syncFromCustomerId(
    customerId: string,
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const client = this.supabase.getClient();
    const { data: profile } = await client
      .from('user_profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (profile) {
      const priceId = subscription.items.data[0]?.price.id;
      const tier = await this.tierFromPriceId(priceId);
      const status = subscription.status;

      if (status === 'active' || status === 'trialing') {
        if (!tier) {
          this.logger.error(
            `Unknown price ID ${priceId} for customer ${customerId} — skipping tier sync`,
          );
          return;
        }
        await this.syncUserTier(profile.id, tier, subscription.id);
      }
    }
  }

  private async tierFromPriceId(priceId: string): Promise<string | null> {
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
