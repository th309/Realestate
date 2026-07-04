import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ConfigService } from '@nestjs/config';
import { StripeService } from './stripe.service';
import { BillingWebhookService } from './billing-webhook.service';
import Stripe from 'stripe';

/**
 * Public billing API: checkout, portal, cancel/resume subscription, status.
 * Webhook event handling is delegated to BillingWebhookService.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly frontendUrl: string | null;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly stripe: StripeService,
    private readonly config: ConfigService,
    private readonly webhookService: BillingWebhookService,
  ) {
    const url = this.config.get<string>('FRONTEND_URL');
    if (!url) {
      this.logger.warn(
        'FRONTEND_URL not set — billing checkout and portal features are disabled',
      );
    }
    this.frontendUrl = url || null;
  }

  private getFrontendUrl(): string {
    if (!this.frontendUrl) {
      throw new ServiceUnavailableException(
        'Billing is temporarily unavailable: FRONTEND_URL is not configured on the backend.',
      );
    }
    return this.frontendUrl;
  }

  async startCheckout(
    userId: string,
    tier: string,
    interval: 'month' | 'year',
    returnContext?: string,
  ): Promise<string> {
    const client = this.supabase.getClient();

    const { data: currentProfile } = await client
      .from('user_profiles')
      .select(
        'email, stripe_customer_id, stripe_subscription_id, subscription_tier, subscription_status',
      )
      .eq('id', userId)
      .single();

    if (!currentProfile?.email) {
      throw new BadRequestException('User profile not found');
    }

    // Guard: block a NEW checkout for ANY user with a LIVE paid Stripe sub,
    // REGARDLESS of requested tier — a second concurrent sub double-charges.
    // Live paid sub = `stripe_subscription_id` populated (set for any real
    // Stripe sub incl. card-trials; NULLed by the delete webhook on cancel)
    // AND a non-terminal status (active/past_due/unpaid/trialing). Free users
    // and app-level no-card trial users (status='trialing') have NO
    // `stripe_subscription_id`, so they still convert to paid via checkout.
    // Paid subscribers change tiers via the billing portal, not a new checkout.
    const LIVE_PAID_STATUSES = ['active', 'past_due', 'unpaid', 'trialing'];
    if (
      currentProfile.stripe_subscription_id &&
      LIVE_PAID_STATUSES.includes(currentProfile.subscription_status ?? '')
    ) {
      throw new BadRequestException(
        'You already have an active subscription. To change or upgrade your ' +
          'plan, manage it from the billing portal instead of starting a new checkout.',
      );
    }

    // Get or create Stripe customer
    let stripeCustomerId: string;
    const existingProfile = currentProfile;

    if (existingProfile?.stripe_customer_id) {
      stripeCustomerId = existingProfile.stripe_customer_id;
    } else {
      stripeCustomerId = await this.stripe.getOrCreateCustomer(
        userId,
        currentProfile.email,
      );
      await client
        .from('user_profiles')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', userId);
    }

    // Look up Stripe price ID from subscription_tiers
    const priceColumn =
      interval === 'year'
        ? 'stripe_price_yearly_id'
        : 'stripe_price_monthly_id';
    const { data: tierData } = await client
      .from('subscription_tiers')
      .select(`${priceColumn}`)
      .eq('slug', tier)
      .single();

    const priceId = tierData?.[priceColumn];
    if (!priceId) {
      throw new BadRequestException(
        `No Stripe price configured for tier: ${tier} (${interval})`,
      );
    }

    // Check if trial is enabled (enterprise skips trial)
    let trialDays: number | undefined;
    if (tier !== 'enterprise') {
      const { data: trialConfig } = await client
        .from('trial_config')
        .select('is_enabled, duration_days')
        .single();

      if (trialConfig?.is_enabled && trialConfig.duration_days > 0) {
        trialDays = trialConfig.duration_days;
      }
    }

    // Build success/cancel URLs
    const baseUrl = this.getFrontendUrl();
    const returnParam = returnContext
      ? `&returnContext=${encodeURIComponent(returnContext)}`
      : '';
    const successUrl = `${baseUrl}/upgrade/success?session_id={CHECKOUT_SESSION_ID}${returnParam}`;
    const cancelUrl = `${baseUrl}/pricing`;

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
    return this.webhookService.handleWebhookEvent(event);
  }

  /**
   * Cancel the user's subscription at the end of the current billing period.
   * The user retains full access until the period ends, then Stripe fires
   * `customer.subscription.deleted` which downgrades to free.
   */
  async cancelSubscription(
    userId: string,
  ): Promise<{ cancelAt: string; currentPeriodEnd: string }> {
    const client = this.supabase.getClient();
    const { data: profile } = await client
      .from('user_profiles')
      .select('stripe_subscription_id, subscription_tier')
      .eq('id', userId)
      .single();

    if (!profile?.stripe_subscription_id) {
      throw new BadRequestException(
        'No active subscription found. Nothing to cancel.',
      );
    }

    const subscription = await this.stripe.cancelAtPeriodEnd(
      profile.stripe_subscription_id,
    );

    const periodEndUnix = subscription.items.data[0]?.current_period_end ?? 0;
    const periodEnd = new Date(periodEndUnix * 1000).toISOString();

    this.logger.log(
      `User ${userId} scheduled cancellation at period end: ${periodEnd}`,
    );

    return { cancelAt: periodEnd, currentPeriodEnd: periodEnd };
  }

  /**
   * Resume a subscription that was scheduled for cancellation,
   * so it renews normally at the end of the current billing period.
   */
  async resumeSubscription(userId: string): Promise<void> {
    const client = this.supabase.getClient();
    const { data: profile } = await client
      .from('user_profiles')
      .select('stripe_subscription_id')
      .eq('id', userId)
      .single();

    if (!profile?.stripe_subscription_id) {
      throw new BadRequestException(
        'No active subscription found. Nothing to resume.',
      );
    }

    await this.stripe.resumeSubscription(profile.stripe_subscription_id);

    this.logger.log(`User ${userId} resumed subscription`);
  }

  /**
   * Fetch the current subscription status from Stripe, including
   * whether cancellation is pending and the period end date.
   */
  async getSubscriptionStatus(userId: string): Promise<{
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string | null;
  }> {
    const client = this.supabase.getClient();
    const { data: profile } = await client
      .from('user_profiles')
      .select('stripe_subscription_id, subscription_status')
      .eq('id', userId)
      .single();

    if (!profile?.stripe_subscription_id) {
      return {
        status: profile?.subscription_status || 'none',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
      };
    }

    const subscription = await this.stripe.getSubscription(
      profile.stripe_subscription_id,
    );

    return {
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: new Date(
        (subscription.items.data[0]?.current_period_end ?? 0) * 1000,
      ).toISOString(),
    };
  }

  async getBillingPortalUrl(userId: string): Promise<string> {
    const client = this.supabase.getClient();
    const { data: profile } = await client
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (!profile?.stripe_customer_id) {
      throw new BadRequestException(
        'No billing account found. Please subscribe first.',
      );
    }

    // Fetch active tiers with Stripe product/price IDs for portal plan switching
    const { data: tiers } = await client
      .from('subscription_tiers')
      .select(
        'stripe_product_id, stripe_price_monthly_id, stripe_price_yearly_id',
      )
      .neq('slug', 'free');

    const products = (tiers ?? [])
      .filter((t) => t.stripe_product_id)
      .map((t) => ({
        productId: t.stripe_product_id as string,
        priceIds: [t.stripe_price_monthly_id, t.stripe_price_yearly_id].filter(
          Boolean,
        ) as string[],
      }))
      .filter((p) => p.priceIds.length > 0);

    let configurationId: string | undefined;
    if (products.length > 0) {
      configurationId =
        await this.stripe.getOrCreatePortalConfiguration(products);
    }

    const returnUrl = `${this.getFrontendUrl()}/account/billing`;
    return this.stripe.createBillingPortalSession(
      profile.stripe_customer_id,
      returnUrl,
      configurationId,
    );
  }
}
