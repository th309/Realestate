// packages/backend/src/content-pipeline/brand-kit/brand-kit.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  ApprovedCopy,
  BrandProduct,
  BrandProfile,
  BrandRow,
  ToneSettings,
} from './brand-kit.types';
import {
  PROPERTYIQ_APPROVED_COPY,
  PROPERTYIQ_BRAND_NAME,
  PROPERTYIQ_PRODUCTS,
  PROPERTYIQ_TARGET_PLATFORMS,
  PROPERTYIQ_TONE,
  PROPERTYIQ_VOICE_SUMMARY,
  PROPERTYIQ_WEBSITE_URL,
} from './propertyiq-brand-seed';

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
  private readonly logger = new Logger(BrandKitService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Return the generator-facing brand profile. With no brandId, returns (and
   * seeds on first use) the singleton PropertyIQ brand.
   */
  async getBrandProfile(brandId?: string): Promise<BrandProfile> {
    const row = brandId
      ? await this.getRowById(brandId)
      : await this.ensurePropertyIqBrand();
    return this.toProfile(row);
  }

  /** List all brand rows (admin UI). */
  async listBrands(): Promise<BrandProfile[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('brands')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data as BrandRow[]).map((r) => this.toProfile(r));
  }

  /** Update mutable brand fields; returns the refreshed profile. */
  async updateBrand(
    brandId: string,
    patch: Partial<{
      name: string;
      websiteUrl: string | null;
      voiceSummary: string | null;
      toneSettings: ToneSettings;
      products: BrandProduct[];
      targetPlatforms: string[];
      approvedCopy: ApprovedCopy;
    }>,
  ): Promise<BrandProfile> {
    const client = this.supabase.getClient();
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.websiteUrl !== undefined) update.website_url = patch.websiteUrl;
    if (patch.voiceSummary !== undefined)
      update.voice_summary = patch.voiceSummary;
    if (patch.toneSettings !== undefined)
      update.tone_settings = patch.toneSettings;
    if (patch.products !== undefined) update.products = patch.products;
    if (patch.targetPlatforms !== undefined)
      update.target_platforms = patch.targetPlatforms;
    if (patch.approvedCopy !== undefined)
      update.approved_copy = patch.approvedCopy;

    const { data, error } = await client
      .from('brands')
      .update(update)
      .eq('id', brandId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException(`brand ${brandId} not found`);
    return this.toProfile(data as BrandRow);
  }

  /**
   * Build the prompt preamble a generator prepends to its user prompt. Encodes
   * the brand voice, approved sign-offs/coverage stat, and the hard bans so the
   * model produces on-brand copy before Gate B ever runs.
   */
  buildPromptPreamble(profile: BrandProfile): string {
    const c = profile.approvedCopy;
    const lines: string[] = [];
    lines.push(`You are the in-house content writer for ${profile.name}.`);
    if (profile.voiceSummary) lines.push(profile.voiceSummary);
    lines.push(`Voice: ${profile.tone.shorthand}.`);
    lines.push('');
    lines.push('HARD RULES (content is rejected if any are broken):');
    lines.push(
      '- Do NOT use em dashes or en dashes. Use a period, comma, or colon.',
    );
    lines.push(
      `- Do NOT use hype phrases: ${c.bans.hypePhrases.slice(0, 12).join(', ')}.`,
    );
    lines.push(
      `- Never name competitors (${c.bans.competitors.join(', ')}) or any rival product.`,
    );
    lines.push(`- ${c.scoreLanguage.rule}`);
    lines.push(
      `- Momentum words allowed for a score: ${c.scoreLanguage.allowedMomentumWords.join(', ')}. Never quality words: ${c.scoreLanguage.bannedQualityWords.join(', ')}.`,
    );
    lines.push(
      `- Establish "PropertyIQ Score" (or "PIQ Score") before referring to "the score".`,
    );
    lines.push('');
    lines.push('APPROVED COPY (use verbatim, do not remix):');
    lines.push(`- Coverage stat (only this one): ${c.coverageStat}.`);
    lines.push(`- Taglines: ${c.taglines.map((t) => `"${t}"`).join('; ')}.`);
    lines.push(`- Sign-offs: ${c.signOffs.map((t) => `"${t}"`).join('; ')}.`);
    lines.push(
      `- When mentioning the free tier, include: ${c.freeTierFraming.map((t) => `"${t}"`).join(', ')}.`,
    );
    if (profile.products.length) {
      lines.push('');
      lines.push('PRODUCT CONTEXT:');
      for (const p of profile.products) lines.push(`- ${p.name}: ${p.summary}`);
    }
    return lines.join('\n');
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

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

  /**
   * Find or seed the singleton PropertyIQ brand row. Idempotent: selects by
   * canonical name first; inserts only when absent. On a concurrent double
   * insert, converges on the earliest-created row.
   */
  async ensurePropertyIqBrand(): Promise<BrandRow> {
    const client = this.supabase.getClient();

    const existing = await client
      .from('brands')
      .select('*')
      .eq('name', PROPERTYIQ_BRAND_NAME)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return existing.data as BrandRow;

    const { error: insertError } = await client.from('brands').insert({
      name: PROPERTYIQ_BRAND_NAME,
      website_url: PROPERTYIQ_WEBSITE_URL,
      voice_summary: PROPERTYIQ_VOICE_SUMMARY,
      tone_settings: PROPERTYIQ_TONE,
      products: PROPERTYIQ_PRODUCTS,
      target_platforms: PROPERTYIQ_TARGET_PLATFORMS,
      approved_copy: PROPERTYIQ_APPROVED_COPY,
    });
    // Ignore duplicate-insert races; the re-select below wins.
    if (insertError) {
      this.logger.warn(
        `PropertyIQ brand insert returned an error (continuing to re-select): ${insertError.message}`,
      );
    } else {
      this.logger.log('Seeded PropertyIQ brand row (first use).');
    }

    const seeded = await client
      .from('brands')
      .select('*')
      .eq('name', PROPERTYIQ_BRAND_NAME)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (seeded.error) throw seeded.error;
    if (!seeded.data) {
      throw new Error('Failed to seed or read the PropertyIQ brand row.');
    }
    return seeded.data as BrandRow;
  }

  private toProfile(row: BrandRow): BrandProfile {
    return {
      id: row.id,
      name: row.name,
      websiteUrl: row.website_url ?? null,
      voiceSummary: row.voice_summary ?? null,
      tone: this.coerceTone(row.tone_settings),
      products: Array.isArray(row.products)
        ? (row.products as BrandProduct[])
        : [],
      targetPlatforms: Array.isArray(row.target_platforms)
        ? row.target_platforms
        : [],
      approvedCopy: this.coerceApprovedCopy(row.approved_copy),
    };
  }

  private coerceTone(raw: unknown): ToneSettings {
    const t = (raw ?? {}) as Partial<ToneSettings>;
    return {
      attributes: Array.isArray(t.attributes) ? t.attributes : [],
      shorthand: typeof t.shorthand === 'string' ? t.shorthand : '',
    };
  }

  /**
   * Normalize the approved_copy JSONB. Falls back to the approved PropertyIQ
   * defaults for any missing field so a generator preamble is never malformed.
   */
  private coerceApprovedCopy(raw: unknown): ApprovedCopy {
    const a = (raw ?? {}) as Partial<ApprovedCopy>;
    const d = PROPERTYIQ_APPROVED_COPY;
    return {
      coverageStat:
        typeof a.coverageStat === 'string' ? a.coverageStat : d.coverageStat,
      taglines: Array.isArray(a.taglines) ? a.taglines : d.taglines,
      signOffs: Array.isArray(a.signOffs) ? a.signOffs : d.signOffs,
      freeTierFraming: Array.isArray(a.freeTierFraming)
        ? a.freeTierFraming
        : d.freeTierFraming,
      scoreLanguage: {
        allowedMomentumWords: Array.isArray(
          a.scoreLanguage?.allowedMomentumWords,
        )
          ? a.scoreLanguage.allowedMomentumWords
          : d.scoreLanguage.allowedMomentumWords,
        bannedQualityWords: Array.isArray(a.scoreLanguage?.bannedQualityWords)
          ? a.scoreLanguage.bannedQualityWords
          : d.scoreLanguage.bannedQualityWords,
        rule:
          typeof a.scoreLanguage?.rule === 'string'
            ? a.scoreLanguage.rule
            : d.scoreLanguage.rule,
      },
      bans: {
        hypePhrases: Array.isArray(a.bans?.hypePhrases)
          ? a.bans.hypePhrases
          : d.bans.hypePhrases,
        noEmOrEnDashes:
          typeof a.bans?.noEmOrEnDashes === 'boolean'
            ? a.bans.noEmOrEnDashes
            : d.bans.noEmOrEnDashes,
        neverNameCompetitors:
          typeof a.bans?.neverNameCompetitors === 'boolean'
            ? a.bans.neverNameCompetitors
            : d.bans.neverNameCompetitors,
        competitors: Array.isArray(a.bans?.competitors)
          ? a.bans.competitors
          : d.bans.competitors,
      },
    };
  }
}
