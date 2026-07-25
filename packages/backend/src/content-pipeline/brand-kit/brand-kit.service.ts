// packages/backend/src/content-pipeline/brand-kit/brand-kit.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { BrandProfile, BrandRow } from './brand-kit.types';
import type { UpdateBrandDto } from './dto/update-brand.dto';
import {
  PROPERTYIQ_APPROVED_COPY,
  PROPERTYIQ_BRAND_NAME,
  PROPERTYIQ_PRODUCTS,
  PROPERTYIQ_TARGET_PLATFORMS,
  PROPERTYIQ_TONE,
  PROPERTYIQ_VOICE_SUMMARY,
  PROPERTYIQ_WEBSITE_URL,
} from './propertyiq-brand-seed';
import { deepMergeJsonb, rowToBrandProfile } from './brand-profile-normalizers';
import { buildBrandPromptPreamble } from './brand-preamble';

/**
 * Brand kit: the single service every generator asks for its brand profile.
 * On first use it seeds one PropertyIQ brand row from the approved copy in
 * propertyiq-brand-seed.ts (source: docs/marketing/propertyiq-social-media-brand-guide.md).
 *
 * getBrandProfile(brandId?) returns the normalized, generator-facing profile;
 * buildPromptPreamble(profile) turns it into the prompt preamble string that
 * grounds post generation in the brand voice and hard content rules.
 */
@Injectable()
export class BrandKitService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Return the generator-facing brand profile. With no brandId, returns (and
   * seeds on first use) the singleton PropertyIQ brand.
   */
  async getBrandProfile(brandId?: string): Promise<BrandProfile> {
    const row = brandId
      ? await this.getRowById(brandId)
      : await this.ensurePropertyIqBrand();
    return rowToBrandProfile(row);
  }

  /** List all brand rows (admin UI). */
  async listBrands(): Promise<BrandProfile[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('brands')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data as BrandRow[]).map(rowToBrandProfile);
  }

  /**
   * Update mutable brand fields; returns the refreshed profile. JSONB objects
   * (tone_settings, approved_copy) are DEEP-MERGED onto the existing row, so a
   * partial PATCH like { approvedCopy: { coverageStat } } preserves the sibling
   * fields (taglines, bans, etc.) instead of silently dropping them. Scalars and
   * arrays (name, targetPlatforms, products) are replaced wholesale.
   */
  async updateBrand(
    brandId: string,
    patch: UpdateBrandDto,
  ): Promise<BrandProfile> {
    const existing = await this.getRowById(brandId);
    const client = this.supabase.getClient();
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.websiteUrl !== undefined) update.website_url = patch.websiteUrl;
    if (patch.voiceSummary !== undefined)
      update.voice_summary = patch.voiceSummary;
    if (patch.products !== undefined) update.products = patch.products;
    if (patch.targetPlatforms !== undefined)
      update.target_platforms = patch.targetPlatforms;
    if (patch.toneSettings !== undefined)
      update.tone_settings = deepMergeJsonb(
        existing.tone_settings,
        patch.toneSettings,
      );
    if (patch.approvedCopy !== undefined)
      update.approved_copy = deepMergeJsonb(
        existing.approved_copy,
        patch.approvedCopy,
      );

    const { data, error } = await client
      .from('brands')
      .update(update)
      .eq('id', brandId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException(`brand ${brandId} not found`);
    return rowToBrandProfile(data as BrandRow);
  }

  /** Build the generator prompt preamble for a profile. */
  buildPromptPreamble(profile: BrandProfile): string {
    return buildBrandPromptPreamble(profile);
  }

  /**
   * Find or seed the singleton PropertyIQ brand row. Race-safe: an atomic upsert
   * (INSERT ON CONFLICT (name) DO NOTHING, backed by the unique index on
   * brands.name) means concurrent cold starts cannot create a duplicate row; the
   * select afterward returns the single canonical row.
   */
  async ensurePropertyIqBrand(): Promise<BrandRow> {
    const client = this.supabase.getClient();

    const { error: upsertError } = await client.from('brands').upsert(
      {
        name: PROPERTYIQ_BRAND_NAME,
        website_url: PROPERTYIQ_WEBSITE_URL,
        voice_summary: PROPERTYIQ_VOICE_SUMMARY,
        tone_settings: PROPERTYIQ_TONE,
        products: PROPERTYIQ_PRODUCTS,
        target_platforms: PROPERTYIQ_TARGET_PLATFORMS,
        approved_copy: PROPERTYIQ_APPROVED_COPY,
      },
      { onConflict: 'name', ignoreDuplicates: true },
    );
    if (upsertError) throw upsertError;

    const { data, error } = await client
      .from('brands')
      .select('*')
      .eq('name', PROPERTYIQ_BRAND_NAME)
      .maybeSingle();
    if (error) throw error;
    if (!data)
      throw new Error('Failed to seed or read the PropertyIQ brand row.');
    return data as BrandRow;
  }

  private async getRowById(brandId: string): Promise<BrandRow> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('brands')
      .select('*')
      .eq('id', brandId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException(`brand ${brandId} not found`);
    return data as BrandRow;
  }
}
