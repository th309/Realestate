import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ConfigService } from '@nestjs/config';
import { StripeService } from './stripe.service';
import Stripe from 'stripe';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly stripe: StripeService,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
  }

  async startCheckout(userId: string, tier: string, interval: 'month' | 'year', returnContext?: string): Promise<string> {
    // Get user email
    const client = this.supabase.getClient();
    const { data: profile } = await client
      .from('user_profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (!profile?.email) {
      throw new BadRequestException('User profile not found');
    }

    // Get or create Stripe customer
    let stripeCustomerId: string;
    const { data: existingProfile } = await client
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (existingProfile?.stripe_customer_id) {
      stripeCustomerId = existingProfile.stripe_customer_id;
    } else {
      stripeCustomerId = await this.stripe.getOrCreateCustomer(userId, profile.email);
      await client
        .from('user_profiles')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', userId);
    }

    // Look up Stripe price ID from subscription_tiers
    const priceColumn = interval === 'year' ? 'stripe_price_yearly_id' : 'stripe_price_monthly_id';
    const { data: tierData } = await client
      .from('subscription_tiers')
      .select(`${priceColumn}`)
      .eq('slug', tier)
      .single();

    const priceId = tierData?.[priceColumn];
    if (!priceId) {
      throw new BadRequestException(`No Stripe price configured for tier: ${tier} (${interval})`);
    }

    // Check if trial is enabled
    let trialDays: number | undefined;
    const { data: trialConfig } = await client
      .from('trial_config')
      .select('is_enabled, duration_days')
      .single();

    if (trialConfig?.is_enabled && trialConfig.duration_days > 0) {
      trialDays = trialConfig.duration_days;
    }

    // Build success/cancel URLs
    const returnParam = returnContext ? `&returnContext=${encodeURIComponent(returnContext)}` : '';
    const successUrl = `${this.frontendUrl}/upgrade/success?session_id={CHECKOUT_SESSION_ID}${returnParam}`;
    const cancelUrl = `${this.frontendUrl}/pricing`;

    return this.stripe.createCheckoutSession({
      customerId: stripeCustomerId,
      priceId,
      successUrl,
      cancelUrl,
      metadata: { user_id: userId, tier, interval },
      trialPeriodDays: trialDays,
    });
  }

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    this.logger.log(`Processing webhook event: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await this.handleCheckoutComplete(session);
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.handleSubscriptionUpdated(subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.handleSubscriptionDeleted(subscription);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await this.handlePaymentFailed(invoice);
        break;
      }
      default:
        this.logger.debug(`Unhandled webhook event type: ${event.type}`);
    }
  }

  async getBillingPortalUrl(userId: string): Promise<string> {
    const client = this.supabase.getClient();
    const { data: profile } = await client
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (!profile?.stripe_customer_id) {
      throw new BadRequestException('No billing account found. Please subscribe first.');
    }

    const returnUrl = `${this.frontendUrl}/account/billing`;
    return this.stripe.createBillingPortalSession(profile.stripe_customer_id, returnUrl);
  }

  private async handleCheckoutComplete(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.user_id;
    const tier = session.metadata?.tier;

    if (!userId || !tier) {
      this.logger.warn('Checkout session missing user_id or tier metadata');
      return;
    }

    const subscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;

    if (!subscriptionId) {
      this.logger.warn('Checkout session missing subscription ID');
      return;
    }

    await this.syncUserTier(userId, tier, subscriptionId);
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.user_id;
    if (!userId) {
      // Try to find user by stripe_customer_id
      const customerId = typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;
      await this.syncFromCustomerId(customerId, subscription);
      return;
    }

    const status = subscription.status;
    const client = this.supabase.getClient();

    if (status === 'active' || status === 'trialing') {
      // Look up tier from the price
      const priceId = subscription.items.data[0]?.price.id;
      const tier = await this.tierFromPriceId(priceId);
      await this.syncUserTier(userId, tier || 'pro', subscription.id);
    } else if (status === 'past_due' || status === 'unpaid') {
      await client
        .from('user_profiles')
        .update({ subscription_status: status })
        .eq('id', userId);
    }
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

    const client = this.supabase.getClient();
    const { data: profile } = await client
      .from('user_profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (profile) {
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
    const customerId = typeof invoice.customer === 'string'
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

  private async syncUserTier(userId: string, tier: string, stripeSubscriptionId: string): Promise<void> {
    const client = this.supabase.getClient();
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

  private async syncFromCustomerId(customerId: string, subscription: Stripe.Subscription): Promise<void> {
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
        await this.syncUserTier(profile.id, tier || 'pro', subscription.id);
      }
    }
  }

  private async tierFromPriceId(priceId: string): Promise<string | null> {
    const client = this.supabase.getClient();
    const { data } = await client
      .from('subscription_tiers')
      .select('slug')
      .or(`stripe_price_monthly_id.eq.${priceId},stripe_price_yearly_id.eq.${priceId}`)
      .single();

    return data?.slug || null;
  }
}
