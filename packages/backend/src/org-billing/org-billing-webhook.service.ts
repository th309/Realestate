/**
 * Organization Billing Webhook Service
 *
 * Handles Stripe webhook events that have org_slug in their metadata.
 * Called by BillingWebhookService when it detects org-specific events.
 *
 * Updates organization billing_status, stripe_customer_id, and
 * stripe_subscription_id in Supabase based on Stripe events.
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { OrgAuditService } from '../org-audit/org-audit.service';
import { OrgDowngradeHandlerService } from './org-downgrade-handler.service';
import { McpEntitlementsInvalidator } from '../entitlements/mcp-entitlements-invalidator.service';
import Stripe from 'stripe';

@Injectable()
export class OrgBillingWebhookService {
  private readonly logger = new Logger(OrgBillingWebhookService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly auditService: OrgAuditService,
    private readonly downgradeHandler: OrgDowngradeHandlerService,
    private readonly mcpInvalidator: McpEntitlementsInvalidator,
  ) {}

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    this.logger.log(`Processing org webhook event: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        await this.handleCheckoutComplete(session);
        break;
      }
      case 'invoice.paid': {
        const invoice = event.data.object;
        await this.handleInvoicePaid(invoice);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await this.handlePaymentFailed(invoice);
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
      default:
        this.logger.debug(`Unhandled org webhook event: ${event.type}`);
    }
  }

  private async handleCheckoutComplete(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const orgSlug = session.metadata?.org_slug;
    const ownerId = session.metadata?.owner_id;

    if (!orgSlug || !ownerId) {
      this.logger.warn('Org checkout session missing org_slug or owner_id');
      return;
    }

    const customerId =
      typeof session.customer === 'string'
        ? session.customer
        : session.customer?.id;
    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;

    const { data: org, error } = await this.supabase
      .from('organizations')
      .update({
        billing_status: 'active',
        stripe_customer_id: customerId ?? null,
        stripe_subscription_id: subscriptionId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('slug', orgSlug)
      .select('id')
      .single();

    if (error || !org) {
      this.logger.error(
        `Failed to activate billing for org "${orgSlug}": ${error?.message ?? 'not found'}`,
      );
      return;
    }

    this.logger.log(`Org "${orgSlug}" billing activated`);

    await this.mcpInvalidator.invalidateOrgMembers(org.id);

    await this.auditService.log({
      organizationId: org.id,
      actorId: ownerId,
      action: 'billing_status_changed',
      targetType: 'billing',
      targetId: org.id,
      details: { status: 'active', source: 'checkout.session.completed' },
    });
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const org = await this.findOrgByCustomerId(invoice);
    if (!org) return;

    await this.supabase
      .from('organizations')
      .update({
        billing_status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', org.id);

    await this.mcpInvalidator.invalidateOrgMembers(org.id);

    this.logger.log(`Invoice paid for org ${org.id}`);
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const org = await this.findOrgByCustomerId(invoice);
    if (!org) return;

    await this.supabase
      .from('organizations')
      .update({
        billing_status: 'past_due',
        updated_at: new Date().toISOString(),
      })
      .eq('id', org.id);

    await this.mcpInvalidator.invalidateOrgMembers(org.id);

    this.logger.warn(`Payment failed for org ${org.id}`);

    await this.auditService.log({
      organizationId: org.id,
      actorId: 'system',
      action: 'billing_status_changed',
      targetType: 'billing',
      targetId: org.id,
      details: { status: 'past_due', source: 'invoice.payment_failed' },
    });
  }

  private async handleSubscriptionUpdated(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const org = await this.findOrgBySubscriptionCustomer(subscription);
    if (!org) return;

    // Detect downgrade: subscription canceled or moved to a non-enterprise plan
    if (
      subscription.status === 'canceled' ||
      subscription.status === 'unpaid'
    ) {
      const newTier = 'free';
      this.logger.log(
        `Subscription ${subscription.id} status is ${subscription.status} — triggering downgrade for org ${org.id}`,
      );
      // Invalidate BEFORE downgrade removes membership rows
      await this.mcpInvalidator.invalidateOrgMembers(org.id);
      await this.downgradeHandler.handleDowngrade(org.id, newTier);
      return;
    }

    // Sync seat count if changed externally (e.g., via Stripe dashboard)
    const seatItem = subscription.items.data.find(
      (item) => item.price.recurring?.usage_type !== 'metered',
    );

    if (seatItem && seatItem.quantity !== undefined) {
      this.logger.debug(
        `Subscription updated for org ${org.id}, seat quantity: ${seatItem.quantity}`,
      );
    }

    await this.mcpInvalidator.invalidateOrgMembers(org.id);
  }

  private async handleSubscriptionDeleted(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const org = await this.findOrgBySubscriptionCustomer(subscription);
    if (!org) return;

    // Clear Stripe subscription reference
    await this.supabase
      .from('organizations')
      .update({
        stripe_subscription_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', org.id);

    // Invalidate BEFORE downgrade removes membership rows
    await this.mcpInvalidator.invalidateOrgMembers(org.id);

    // Full downgrade: revoke features, free members, update tiers
    await this.downgradeHandler.handleDowngrade(org.id, 'free');

    this.logger.log(
      `Subscription deleted for org ${org.id} — downgrade triggered`,
    );

    await this.auditService.log({
      organizationId: org.id,
      actorId: 'system',
      action: 'billing_status_changed',
      targetType: 'billing',
      targetId: org.id,
      details: { status: 'canceled', source: 'customer.subscription.deleted' },
    });
  }

  /** Find org by Stripe customer ID extracted from an invoice event. */
  private async findOrgByCustomerId(
    invoice: Stripe.Invoice,
  ): Promise<{ id: string } | null> {
    const customerId =
      typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id;

    if (!customerId) return null;

    const { data } = await this.supabase
      .from('organizations')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();

    return data;
  }

  /** Find org by Stripe customer ID extracted from a subscription event. */
  private async findOrgBySubscriptionCustomer(
    subscription: Stripe.Subscription,
  ): Promise<{ id: string } | null> {
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;

    const { data } = await this.supabase
      .from('organizations')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();

    return data;
  }
}
