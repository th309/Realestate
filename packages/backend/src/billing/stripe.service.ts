import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe | null;
  private readonly logger = new Logger(StripeService.name);
  private readonly webhookSecret: string;

  constructor(private readonly config: ConfigService) {
    const stripeKey = this.readEnvValue(['STRIPE_SECRET_KEY', 'STRIPE_API_KEY']);
    if (!stripeKey) {
      this.logger.warn(
        'Stripe key not set (checked STRIPE_SECRET_KEY, STRIPE_API_KEY) - Stripe billing features are disabled',
      );
      this.stripe = null;
    } else {
      this.logger.log(`Stripe key detected (${this.maskedKeyInfo(stripeKey)})`);
      this.stripe = new Stripe(stripeKey, {
        apiVersion: '2026-01-28.clover',
      });
    }

    const webhookSecret = this.readEnvValue(['STRIPE_WEBHOOK_SECRET']);
    if (!webhookSecret) {
      this.logger.warn('STRIPE_WEBHOOK_SECRET not set – webhook verification will fail');
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
        this.logger.warn(`Normalized ${name} value by trimming whitespace/quotes`);
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
  }): Promise<string> {
    const stripe = this.getStripeClient();
    const session = await stripe.checkout.sessions.create({
      customer: params.customerId,
      mode: 'subscription',
      line_items: [{ price: params.priceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata,
      allow_promotion_codes: true,
      ...(params.trialPeriodDays ? { subscription_data: { trial_period_days: params.trialPeriodDays } } : {}),
    });

    return session.url!;
  }

  async createBillingPortalSession(customerId: string, returnUrl: string): Promise<string> {
    const stripe = this.getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
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
}
