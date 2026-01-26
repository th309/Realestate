/**
 * Tiers Service
 *
 * CRUD operations for subscription tiers.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

export interface SubscriptionTier {
  id: string;
  slug: string;
  name: string;
  description?: string;
  price_monthly: number | null;
  price_yearly: number | null;
  badge_color?: string;
  display_order: number;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTierDto {
  slug: string;
  name: string;
  description?: string;
  price_monthly?: number;
  price_yearly?: number;
  badge_color?: string;
  display_order?: number;
}

export interface UpdateTierDto {
  name?: string;
  description?: string;
  price_monthly?: number;
  price_yearly?: number;
  badge_color?: string;
  display_order?: number;
  is_active?: boolean;
}

@Injectable()
export class TiersService {
  private readonly logger = new Logger(TiersService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Get all tiers
   */
  async getAll(): Promise<SubscriptionTier[]> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('subscription_tiers')
      .select('*')
      .order('display_order');

    if (error) {
      this.logger.error(`Failed to get tiers: ${error.message}`);
      throw new Error(error.message);
    }

    return data || [];
  }

  /**
   * Get active tiers only
   */
  async getActive(): Promise<SubscriptionTier[]> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('subscription_tiers')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (error) {
      throw new Error(error.message);
    }

    return data || [];
  }

  /**
   * Get tier by slug
   */
  async getBySlug(slug: string): Promise<SubscriptionTier | null> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('subscription_tiers')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Create a new tier
   */
  async create(dto: CreateTierDto): Promise<SubscriptionTier> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('subscription_tiers')
      .insert(dto)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    this.logger.log(`Created tier: ${dto.slug}`);
    return data;
  }

  /**
   * Update a tier
   */
  async update(slug: string, dto: UpdateTierDto): Promise<SubscriptionTier> {
    const client = this.supabase.getClient();

    // If updating price, record pricing history
    if (dto.price_monthly !== undefined || dto.price_yearly !== undefined) {
      const existing = await this.getBySlug(slug);
      if (existing) {
        await this.recordPricingHistory(slug, existing, dto);
      }
    }

    const { data, error } = await client
      .from('subscription_tiers')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('slug', slug)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    this.logger.log(`Updated tier: ${slug}`);
    return data;
  }

  /**
   * Record pricing history for auditing
   */
  private async recordPricingHistory(
    slug: string,
    existing: SubscriptionTier,
    update: UpdateTierDto,
  ): Promise<void> {
    const client = this.supabase.getClient();

    // Close out old pricing record
    await client
      .from('pricing_history')
      .update({ effective_until: new Date().toISOString() })
      .eq('tier_slug', slug)
      .is('effective_until', null);

    // Create new pricing record
    await client.from('pricing_history').insert({
      tier_slug: slug,
      price_monthly: update.price_monthly ?? existing.price_monthly,
      price_yearly: update.price_yearly ?? existing.price_yearly,
      effective_from: new Date().toISOString(),
      change_reason: 'Admin update',
    });
  }

  /**
   * Get pricing history for a tier
   */
  async getPricingHistory(slug: string): Promise<Array<{
    price_monthly: number;
    price_yearly: number;
    effective_from: string;
    effective_until: string | null;
    change_reason: string;
  }>> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('pricing_history')
      .select('*')
      .eq('tier_slug', slug)
      .order('effective_from', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return data || [];
  }

  /**
   * Set default tier
   */
  async setDefault(slug: string): Promise<void> {
    const client = this.supabase.getClient();

    // Remove default from all tiers
    await client
      .from('subscription_tiers')
      .update({ is_default: false })
      .neq('slug', slug);

    // Set new default
    await client
      .from('subscription_tiers')
      .update({ is_default: true })
      .eq('slug', slug);

    this.logger.log(`Set default tier: ${slug}`);
  }
}
