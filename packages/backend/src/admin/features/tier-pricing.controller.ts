/**
 * Tier Pricing Controller
 *
 * Admin endpoint for updating subscription tier pricing and Stripe price IDs.
 */

import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { StripeService } from '../../billing/stripe.service';

interface TierPricingUpdate {
  price_monthly?: number;
  price_yearly?: number;
}

@Controller('api/admin/tier-pricing')
export class TierPricingController {
  private readonly logger = new Logger(TierPricingController.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly stripe: StripeService,
  ) {}

  /**
   * GET /api/admin/tier-pricing
   * Returns all tiers with their pricing and Stripe IDs.
   */
  @Get()
  async getTierPricing() {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('subscription_tiers')
      .select(
        'slug, name, price_monthly, price_yearly, stripe_product_id, stripe_price_monthly_id, stripe_price_yearly_id, display_order',
      )
      .eq('is_active', true)
      .neq('slug', 'admin')
      .order('display_order');

    if (error) throw new BadRequestException(error.message);

    return { success: true, data };
  }

  /**
   * PUT /api/admin/tier-pricing/:slug
   * Updates pricing for a tier. If the price amount changes, creates a new
   * Stripe price (Stripe prices are immutable) and archives the old one.
   */
  @Put(':slug')
  async updateTierPricing(
    @Param('slug') slug: string,
    @Body() body: TierPricingUpdate,
  ) {
    if (slug === 'free') {
      throw new BadRequestException('Cannot set pricing for free tier');
    }

    const client = this.supabase.getClient();

    // Get current tier data
    const { data: tier, error: fetchError } = await client
      .from('subscription_tiers')
      .select('*')
      .eq('slug', slug)
      .single();

    if (fetchError || !tier) {
      throw new BadRequestException(`Tier not found: ${slug}`);
    }

    const updates: Record<string, unknown> = {};

    // Update monthly price if changed
    if (
      body.price_monthly !== undefined &&
      body.price_monthly !== Number(tier.price_monthly)
    ) {
      updates.price_monthly = body.price_monthly;

      // Create new Stripe price if product exists
      if (tier.stripe_product_id) {
        const newPrice = await this.stripe.createPrice(
          tier.stripe_product_id,
          Math.round(body.price_monthly * 100),
          'month',
        );
        updates.stripe_price_monthly_id = newPrice.id;

        // Archive old price
        if (tier.stripe_price_monthly_id) {
          await this.stripe.archivePrice(tier.stripe_price_monthly_id);
        }
      }
    }

    // Update yearly price if changed
    if (
      body.price_yearly !== undefined &&
      body.price_yearly !== Number(tier.price_yearly)
    ) {
      updates.price_yearly = body.price_yearly;

      if (tier.stripe_product_id) {
        const newPrice = await this.stripe.createPrice(
          tier.stripe_product_id,
          Math.round(body.price_yearly * 100),
          'year',
        );
        updates.stripe_price_yearly_id = newPrice.id;

        if (tier.stripe_price_yearly_id) {
          await this.stripe.archivePrice(tier.stripe_price_yearly_id);
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return { success: true, message: 'No changes' };
    }

    updates.updated_at = new Date().toISOString();

    const { error: updateError } = await client
      .from('subscription_tiers')
      .update(updates)
      .eq('slug', slug);

    if (updateError) throw new BadRequestException(updateError.message);

    this.logger.log(`Updated pricing for ${slug}: ${JSON.stringify(updates)}`);

    return { success: true, updated: updates };
  }
}
