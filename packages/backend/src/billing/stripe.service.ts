import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

export interface PortalProduct {
  productId: string;
  priceIds: string[];
}

@Injectable()
export class StripeService {
  private readonly stripe: Stripe | null;
  private readonly logger = new Logger(StripeService.name);
  private readonly webhookSecret: string;
  private portalConfigurationId: string | null = null;

  constructor(private readonly config: ConfigService) {
    const stripeKey = this.readEnvValue([
      'STRIPE_SECRET_KEY',
      'STRIPE_API_KEY',
    ]);
    if (!stripeKey) {
      this.logger.warn(
        'Stripe key not set (checked STRIPE_SECRET_KEY, STRIPE_API_KEY) - Stripe billing features are disabled',
      );
      this.stripe = null;
    } else {
      this.logger.log(`Stripe key detected (${this.maskedKeyInfo(stripeKey)})`);
      this.stripe = new Stripe(stripeKey);
    }

    const webhookSecret = this.readEnvValue(['STRIPE_WEBHOOK_SECRET']);
    if (this.stripe && !webhookSecret) {
      throw new Error(
        'STRIPE_WEBHOOK_SECRET is required when Stripe is enabled. ' +
          'Webhook signature verification cannot be bypassed.',
      );
    }
    this.webhookSecret = webhookSecret || '';
  }

  private getStripeClient(): Stripe {
    if (!this.stripe) {
      throw new ServiceUnavailableException(
        'Billing is temporarily unavailable: Stripe is not configured on the backend.',
      );
    }
    return this.stripe;
  }

  private readEnvValue(names: string[]): string | undefined {
    for (const name of names) {
      const fromConfig = this.config.get<string>(name);
      const fromProcess = process.env[name];
      const raw = fromConfig ?? fromProcess;
      if (!raw) continue;

      const cleaned = raw.trim().replace(/^['"]|['"]$/g, '');
      if (!cleaned) continue;

      if (cleaned !== raw) {
        this.logger.warn(
          `Normalized ${name} value by trimming whitespace/quotes`,
        );
      } else {
        this.logger.log(`Loaded ${name} from environment`);
      }

      return cleaned;
    }

    return undefined;
  }

  private maskedKeyInfo(value: string): string {
    const prefix = value.slice(0, 7);
    return `prefix=${prefix}..., len=${value.length}`;
  }

  async getOrCreateCustomer(userId: string, email: string): Promise<string> {
    const stripe = this.getStripeClient();

    // Search for existing customer by metadata
    const existing = await stripe.customers.search({
      query: `metadata['user_id']:'${userId}'`,
    });

    if (existing.data.length > 0) {
      return existing.data[0].id;
    }

    const customer = await stripe.customers.create({
      email,
      metadata: { user_id: userId },
    });

    return customer.id;
  }

  async createCheckoutSession(params: {
    customerId: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
    trialPeriodDays?: number;
    /** Unix timestamp for exact trial end (mutually exclusive with trialPeriodDays). */
    trialEnd?: number;
  }): Promise<string> {
    const stripe = this.getStripeClient();

    // Build subscription_data with trial — trial_end takes precedence
    let subscriptionData: Record<string, unknown> | undefined;
    if (params.trialEnd) {
      subscriptionData = { trial_end: params.trialEnd };
    } else if (params.trialPeriodDays) {
      subscriptionData = { trial_period_days: params.trialPeriodDays };
    }

    const session = await stripe.checkout.sessions.create({
      customer: params.customerId,
      mode: 'subscription',
      line_items: [{ price: params.priceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata,
      allow_promotion_codes: true,
      ...(subscriptionData ? { subscription_data: subscriptionData } : {}),
    });

    return session.url!;
  }

  /**
   * Get or create a Stripe Billing Portal Configuration that enables
   * plan switching, cancellation, payment method updates, and invoice history.
   * The configuration ID is cached in-memory for the lifetime of the process.
   */
  async getOrCreatePortalConfiguration(
    products: PortalProduct[],
  ): Promise<string> {
    if (this.portalConfigurationId) {
      return this.portalConfigurationId;
    }

    const stripe = this.getStripeClient();

    // Build the product list for subscription updates
    const portalProducts = products
      .filter((p) => p.productId && p.priceIds.length > 0)
      .map((p) => ({
        product: p.productId,
        prices: p.priceIds,
      }));

    const frontendUrl = this.config.get<string>('FRONTEND_URL');
    if (!frontendUrl) {
      throw new ServiceUnavailableException(
        'Cannot create portal configuration: FRONTEND_URL is not configured.',
      );
    }

    const configuration = await stripe.billingPortal.configurations.create({
      business_profile: {
        privacy_policy_url: `${frontendUrl}/privacy`,
        terms_of_service_url: `${frontendUrl}/terms`,
      },
      features: {
        subscription_update: {
          enabled: portalProducts.length > 0,
          default_allowed_updates: ['price'],
          proration_behavior: 'create_prorations',
          products: portalProducts,
        },
        subscription_cancel: {
          enabled: true,
          mode: 'at_period_end',
        },
        payment_method_update: {
          enabled: true,
        },
        invoice_history: {
          enabled: true,
        },
      },
    });

    this.portalConfigurationId = configuration.id;
    this.logger.log(
      `Created billing portal configuration: ${configuration.id}`,
    );
    return configuration.id;
  }

  async createBillingPortalSession(
    customerId: string,
    returnUrl: string,
    configurationId?: string,
  ): Promise<string> {
    const stripe = this.getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
      ...(configurationId ? { configuration: configurationId } : {}),
    });

    return session.url;
  }

  constructWebhookEvent(body: Buffer, signature: string): Stripe.Event {
    const stripe = this.getStripeClient();
    return stripe.webhooks.constructEvent(body, signature, this.webhookSecret);
  }

  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    const stripe = this.getStripeClient();
    return stripe.subscriptions.retrieve(subscriptionId);
  }

  /**
   * Mark a subscription to cancel at the end of the current billing period.
   * The user retains access until `current_period_end`.
   */
  async cancelAtPeriodEnd(
    subscriptionId: string,
  ): Promise<Stripe.Subscription> {
    const stripe = this.getStripeClient();
    return stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }

  /**
   * Undo a pending cancellation — resume the subscription so it renews normally.
   */
  async resumeSubscription(
    subscriptionId: string,
  ): Promise<Stripe.Subscription> {
    const stripe = this.getStripeClient();
    return stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
  }

  async createPrice(
    productId: string,
    unitAmount: number,
    interval: 'month' | 'year',
  ): Promise<Stripe.Price> {
    const stripe = this.getStripeClient();
    return stripe.prices.create({
      product: productId,
      unit_amount: unitAmount,
      currency: 'usd',
      recurring: { interval },
    });
  }

  async archivePrice(priceId: string): Promise<void> {
    const stripe = this.getStripeClient();
    await stripe.prices.update(priceId, { active: false });
  }

  /**
   * Update subscription line items: add, update quantity, or remove items.
   * Used by org billing for per-seat add-on management.
   */
  async updateSubscriptionItems(
    subscriptionId: string,
    params: {
      addItems?: { priceId: string; quantity: number }[];
      updateItems?: { id: string; quantity: number }[];
      removeItemIds?: string[];
    },
  ): Promise<Stripe.Subscription> {
    const stripe = this.getStripeClient();
    const items: Stripe.SubscriptionUpdateParams.Item[] = [];

    for (const add of params.addItems ?? []) {
      items.push({ price: add.priceId, quantity: add.quantity });
    }
    for (const update of params.updateItems ?? []) {
      items.push({ id: update.id, quantity: update.quantity });
    }
    for (const removeId of params.removeItemIds ?? []) {
      items.push({ id: removeId, deleted: true });
    }

    return stripe.subscriptions.update(subscriptionId, { items });
  }

  /** Fetch the upcoming invoice preview for a customer (next charge). */
  async getUpcomingInvoice(customerId: string): Promise<Stripe.Invoice> {
    const stripe = this.getStripeClient();
    return stripe.invoices.createPreview({ customer: customerId });
  }

  /**
   * Extend a subscription's effective end date by the given number of days.
   * Uses trial_end so the billing cycle is not disrupted.
   * If the subscription is already in trial, extends from the existing trial_end.
   */
  async extendSubscriptionByDays(
    customerId: string,
    days: number,
  ): Promise<void> {
    const stripe = this.getStripeClient();

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      expand: ['data.items'],
    });

    let sub = subscriptions.data.find(
      (s) => s.status === 'active' || s.status === 'trialing',
    );
    if (!sub) return;

    const extraSeconds = days * 24 * 60 * 60;
    // current_period_end lives on SubscriptionItem in Stripe SDK v18+
    const periodEnd = sub.items.data[0]?.current_period_end ?? 0;
    const base =
      sub.trial_end && sub.trial_end > Math.floor(Date.now() / 1000)
        ? sub.trial_end
        : periodEnd;

    await stripe.subscriptions.update(sub.id, {
      trial_end: base + extraSeconds,
      proration_behavior: 'none',
    });
  }
}
