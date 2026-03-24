/**
 * Organization Billing Service
 *
 * Manages Stripe per-seat subscriptions for enterprise organizations.
 * Handles checkout session creation, billing portal access, seat management,
 * and usage reporting.
 *
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
import { OrgUsageResponse } from './org-billing.types';

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
  async createBillingPortalSession(orgId: string): Promise<string> {
    const { data: org, error } = await this.supabase
      .from('organizations')
      .select('stripe_customer_id, slug')
      .eq('id', orgId)
      .single();

    if (error || !org?.stripe_customer_id) {
      throw new BadRequestException(
        'No billing account found for this organization.',
      );
    }

    const returnUrl = `${this.getFrontendUrl()}/org/${org.slug}/billing`;
    return this.stripe.createBillingPortalSession(
      org.stripe_customer_id,
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
   * Get current billing usage for an organization.
   */
  async getUsage(orgId: string): Promise<OrgUsageResponse> {
    const { data: org, error: orgError } = await this.supabase
      .from('organizations')
      .select('seat_limit, extra_seats, billing_status, stripe_customer_id')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      throw new NotFoundException('Organization not found.');
    }

    const [{ count: activeMembers }, { count: pendingInvites }] =
      await Promise.all([
        this.supabase
          .from('organization_members')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('status', 'active'),
        this.supabase
          .from('organization_members')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('status', 'pending'),
      ]);

    let upcomingInvoice: OrgUsageResponse['upcomingInvoice'] = null;
    if (org.stripe_customer_id) {
      try {
        const invoice = await this.stripe.getUpcomingInvoice(
          org.stripe_customer_id,
        );
        if (invoice) {
          upcomingInvoice = {
            amountDue: invoice.amount_due,
            currency: invoice.currency,
            periodEnd: new Date((invoice.period_end ?? 0) * 1000).toISOString(),
          };
        }
      } catch {
        this.logger.debug(`No upcoming invoice for org ${orgId}`);
      }
    }

    return {
      seatLimit: org.seat_limit ?? 5,
      extraSeats: org.extra_seats ?? 0,
      activeMembers: activeMembers ?? 0,
      pendingInvites: pendingInvites ?? 0,
      billingStatus: org.billing_status ?? 'none',
      upcomingInvoice,
    };
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
