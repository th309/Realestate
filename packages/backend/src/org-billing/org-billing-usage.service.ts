/**
 * Organization Billing Usage Service
 *
 * Reads billing usage data: seat counts, member counts, Stripe subscription
 * details, and upcoming invoice information. Separated from the mutation
 * service (OrgBillingService) to keep files under the 300-line limit.
 */

import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { StripeService } from '../billing/stripe.service';
import { OrgUsageResponse } from './org-billing.types';

@Injectable()
export class OrgBillingUsageService {
  private readonly logger = new Logger(OrgBillingUsageService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly stripe: StripeService,
  ) {}

  /**
   * Get current billing usage for an organization.
   *
   * Returns snake_case keys to match the frontend API contract.
   */
  async getUsage(orgId: string): Promise<OrgUsageResponse> {
    const { data: org, error: orgError } = await this.supabase
      .from('organizations')
      .select(
        'seat_limit, extra_seats, billing_status, stripe_customer_id, stripe_subscription_id',
      )
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
          .from('organization_invites')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('status', 'pending'),
      ]);

    const subscriptionDetails = await this.fetchSubscriptionDetails(
      org.stripe_subscription_id,
      org.billing_status,
    );

    const upcomingInvoice = await this.fetchUpcomingInvoice(
      org.stripe_customer_id,
      orgId,
    );

    return {
      seats_included: org.seat_limit ?? 5,
      additional_seats: org.extra_seats ?? 0,
      seats_used: activeMembers ?? 0,
      pending_invites: pendingInvites ?? 0,
      plan_name: subscriptionDetails.planName,
      status: subscriptionDetails.status,
      current_period_start: subscriptionDetails.periodStart,
      current_period_end: subscriptionDetails.periodEnd,
      upcoming_invoice: upcomingInvoice,
    };
  }

  /** Fetch plan name and billing period from Stripe subscription. */
  private async fetchSubscriptionDetails(
    subscriptionId: string | null,
    fallbackStatus: string | null,
  ): Promise<{
    planName: string;
    status: string;
    periodStart: string | null;
    periodEnd: string | null;
  }> {
    const defaults = {
      planName: 'Enterprise',
      status: fallbackStatus ?? 'none',
      periodStart: null as string | null,
      periodEnd: null as string | null,
    };

    if (!subscriptionId) return defaults;

    try {
      const subscription = await this.stripe.getSubscription(subscriptionId);
      if (!subscription) return defaults;

      defaults.status = subscription.status ?? defaults.status;

      // Period dates live on the subscription item, not the subscription itself
      const firstItem = subscription.items?.data?.[0];
      const periodStartUnix = firstItem?.current_period_start;
      const periodEndUnix = firstItem?.current_period_end;

      defaults.periodStart = periodStartUnix
        ? new Date(periodStartUnix * 1000).toISOString()
        : null;
      defaults.periodEnd = periodEndUnix
        ? new Date(periodEndUnix * 1000).toISOString()
        : null;

      if (firstItem?.price?.product) {
        const product = firstItem.price.product;
        if (typeof product === 'object' && 'name' in product) {
          defaults.planName = (product as { name: string }).name;
        }
      }
    } catch {
      this.logger.debug(
        `Could not fetch subscription details for subscription ${subscriptionId}`,
      );
    }

    return defaults;
  }

  /** Fetch upcoming invoice summary from Stripe. */
  private async fetchUpcomingInvoice(
    stripeCustomerId: string | null,
    orgId: string,
  ): Promise<OrgUsageResponse['upcoming_invoice']> {
    if (!stripeCustomerId) return null;

    try {
      const invoice = await this.stripe.getUpcomingInvoice(stripeCustomerId);
      if (!invoice) return null;

      return {
        amount_due: invoice.amount_due,
        currency: invoice.currency,
        period_end: new Date((invoice.period_end ?? 0) * 1000).toISOString(),
      };
    } catch {
      this.logger.debug(`No upcoming invoice for org ${orgId}`);
      return null;
    }
  }
}
