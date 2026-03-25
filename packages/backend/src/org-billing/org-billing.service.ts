/**
 * Organization Billing Service
 *
 * Manages Stripe per-seat subscriptions for enterprise organizations.
 * Handles checkout session creation, billing portal access, and seat management.
 *
 * Usage reporting (read-only) is in OrgBillingUsageService.
 * Uses StripeService from the billing module for all Stripe API calls.
 */

import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { StripeService } from '../billing/stripe.service';
import { OrgAuditService } from '../org-audit/org-audit.service';

@Injectable()
export class OrgBillingService {
  private readonly logger = new Logger(OrgBillingService.name);
  private readonly frontendUrl: string | null;

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly stripe: StripeService,
    private readonly auditService: OrgAuditService,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = this.config.get<string>('FRONTEND_URL') || null;

    if (!this.frontendUrl) {
      this.logger.warn(
        'FRONTEND_URL not set — org billing checkout/portal disabled',
      );
    }
  }

  /** Read the enterprise tier's Stripe price ID from the DB (source of truth). */
  private async getEnterprisePriceId(): Promise<string | null> {
    const { data } = await this.supabase
      .from('subscription_tiers')
      .select('stripe_price_monthly_id')
      .eq('slug', 'enterprise')
      .single();
    return (
      data?.stripe_price_monthly_id ??
      this.config.get<string>('STRIPE_ENTERPRISE_PRICE_ID') ??
      null
    );
  }

  /** Read the seat add-on Stripe price ID from the DB (source of truth). */
  private async getSeatPriceId(): Promise<string | null> {
    const { data } = await this.supabase
      .from('subscription_tiers')
      .select('stripe_price_monthly_id')
      .eq('slug', 'enterprise-seat')
      .single();
    return (
      data?.stripe_price_monthly_id ??
      this.config.get<string>('STRIPE_ENTERPRISE_SEAT_PRICE_ID') ??
      null
    );
  }

  private getFrontendUrl(): string {
    if (!this.frontendUrl) {
      throw new ServiceUnavailableException(
        'Org billing unavailable: FRONTEND_URL is not configured.',
      );
    }
    return this.frontendUrl;
  }

  /**
   * Create a Stripe checkout session for a new enterprise org subscription.
   */
  async createCheckoutSession(
    orgName: string,
    orgSlug: string,
    ownerEmail: string,
    ownerId: string,
  ): Promise<string> {
    const enterprisePriceId = await this.getEnterprisePriceId();
    if (!enterprisePriceId) {
      throw new ServiceUnavailableException(
        'Org billing unavailable: enterprise price not configured.',
      );
    }

    const customerId = await this.stripe.getOrCreateCustomer(
      ownerId,
      ownerEmail,
    );

    const baseUrl = this.getFrontendUrl();
    const successUrl = `${baseUrl}/org/${orgSlug}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/org/new?checkout=cancelled`;

    return this.stripe.createCheckoutSession({
      customerId,
      priceId: enterprisePriceId,
      successUrl,
      cancelUrl,
      metadata: {
        org_slug: orgSlug,
        org_name: orgName,
        owner_id: ownerId,
      },
    });
  }

  /**
   * Create a Stripe billing portal session for an existing org.
   */
  async createBillingPortalSession(
    orgId: string,
    userId: string,
  ): Promise<string> {
    // Billing lives on the USER, not the org — use the user's Stripe customer ID
    const { data: org } = await this.supabase
      .from('organizations')
      .select('slug')
      .eq('id', orgId)
      .single();

    const { data: profile } = await this.supabase
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (!profile?.stripe_customer_id) {
      throw new BadRequestException(
        'No billing account found. Please set up a subscription first.',
      );
    }

    const returnUrl = `${this.getFrontendUrl()}/org/${org?.slug || ''}/admin/billing`;
    return this.stripe.createBillingPortalSession(
      profile.stripe_customer_id,
      returnUrl,
    );
  }

  /**
   * Update extra seats. Validates member count does not exceed new capacity.
   */
  async updateSeats(
    orgId: string,
    additionalSeats: number,
    actorId: string,
  ): Promise<void> {
    if (additionalSeats < 0) {
      throw new BadRequestException('Additional seats cannot be negative.');
    }

    const { data: org, error: orgError } = await this.supabase
      .from('organizations')
      .select('id, seat_limit, extra_seats, stripe_subscription_id')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      throw new NotFoundException('Organization not found.');
    }
    if (!org.stripe_subscription_id) {
      throw new BadRequestException('No active subscription for this org.');
    }

    const { count: activeMemberCount } = await this.supabase
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'active');

    const totalCapacity = (org.seat_limit ?? 0) + additionalSeats;
    if ((activeMemberCount ?? 0) > totalCapacity) {
      throw new BadRequestException({
        code: 'SEATS_IN_USE',
        message: `Cannot reduce: ${activeMemberCount} active members exceed limit of ${totalCapacity}.`,
      });
    }

    await this.syncSeatLineItem(org.stripe_subscription_id, additionalSeats);

    const { error: updateError } = await this.supabase
      .from('organizations')
      .update({
        extra_seats: additionalSeats,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orgId);

    if (updateError) {
      this.logger.error(`Failed to update extra_seats: ${updateError.message}`);
    }

    await this.auditService.log({
      organizationId: orgId,
      actorId,
      action: 'seats_updated',
      targetType: 'billing',
      targetId: orgId,
      details: {
        previousExtraSeats: org.extra_seats ?? 0,
        newExtraSeats: additionalSeats,
      },
    });
  }

  /**
   * Create a Stripe checkout session for an enterprise user's billing setup.
   * The subscription trial_end aligns with the user's grace period expiry,
   * so the first charge happens when the 30-day grace window closes.
   */
  async createEnterpriseTrialCheckout(
    userId: string,
    email: string,
  ): Promise<string> {
    const enterprisePriceId = await this.getEnterprisePriceId();
    if (!enterprisePriceId) {
      throw new ServiceUnavailableException(
        'Enterprise billing unavailable: enterprise price not configured.',
      );
    }

    // Look up the user's grace expiry to align the Stripe trial end
    const { data: profile } = await this.supabase
      .from('user_profiles')
      .select('enterprise_grace_expires_at')
      .eq('id', userId)
      .single();

    // If grace period exists, use it as trial end. Otherwise start billing immediately.
    let trialEndUnix: number | undefined;
    if (profile?.enterprise_grace_expires_at) {
      const graceExpiresAt = new Date(profile.enterprise_grace_expires_at);
      // Stripe requires trial_end to be at least 48 hours in the future
      const minTrialEnd = Math.floor((Date.now() + 48 * 60 * 60 * 1000) / 1000);
      trialEndUnix = Math.max(
        Math.floor(graceExpiresAt.getTime() / 1000),
        minTrialEnd,
      );
    }

    const customerId = await this.stripe.getOrCreateCustomer(userId, email);

    const baseUrl = this.getFrontendUrl();
    const successUrl = `${baseUrl}/settings/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/settings/billing?checkout=cancelled`;

    return this.stripe.createCheckoutSession({
      customerId,
      priceId: enterprisePriceId,
      successUrl,
      cancelUrl,
      trialEnd: trialEndUnix,
      metadata: {
        user_id: userId,
        checkout_type: 'enterprise_grace_billing',
      },
    });
  }

  /** Sync the seat add-on line item on the Stripe subscription. */
  private async syncSeatLineItem(
    subscriptionId: string,
    additionalSeats: number,
  ): Promise<void> {
    const seatPriceId = await this.getSeatPriceId();
    if (!seatPriceId) {
      throw new ServiceUnavailableException(
        'Seat add-on price not configured in subscription_tiers or env.',
      );
    }

    const subscription = await this.stripe.getSubscription(subscriptionId);
    const seatItem = subscription.items.data.find(
      (item) => item.price.id === seatPriceId,
    );

    if (additionalSeats === 0 && seatItem) {
      await this.stripe.updateSubscriptionItems(subscriptionId, {
        removeItemIds: [seatItem.id],
      });
    } else if (additionalSeats > 0 && seatItem) {
      await this.stripe.updateSubscriptionItems(subscriptionId, {
        updateItems: [{ id: seatItem.id, quantity: additionalSeats }],
      });
    } else if (additionalSeats > 0 && !seatItem) {
      await this.stripe.updateSubscriptionItems(subscriptionId, {
        addItems: [{ priceId: seatPriceId, quantity: additionalSeats }],
      });
    }
  }
}
