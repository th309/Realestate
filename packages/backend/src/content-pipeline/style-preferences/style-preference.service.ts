// packages/backend/src/content-pipeline/style-preferences/style-preference.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { BrandKitService } from '../brand-kit/brand-kit.service';
import type { BrandProfile } from '../brand-kit/brand-kit.types';
import {
  clampSignalWeight,
  STYLE_SIGNAL_WEIGHT_DEFAULT,
} from './style-preference-preamble';
import {
  LiveStyleRefs,
  normalizeRow,
  StyleReferenceAttrs,
  toStylePreferences,
} from './style-preference-normalizers';
import type {
  CollectionsPreferencesRow,
  SavedStyleRef,
  StylePreferences,
} from './style-preference.types';

/**
 * The preference-learning loop: which style references a brand has liked, and
 * how strongly they steer generation. Owns `collections_preferences` (one row
 * per brand) and produces the style block FeedService appends to the brand
 * preamble — see style-preference-preamble.ts for the signal_weight semantics.
 *
 * Saved likes hold ids only; palette/typography/layout are read live from
 * `style_references` on every prompt build, so a re-extract or a label edit
 * shows up in the next generation with no write here.
 */
@Injectable()
export class StylePreferenceService {
  private readonly logger = new Logger(StylePreferenceService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly brandKit: BrandKitService,
  ) {}

  /** Full preferences for a brand, hydrated for the admin UI. */
  async getPreferences(brandId?: string): Promise<StylePreferences> {
    const row = await this.ensureRow(await this.resolveBrandId(brandId));
    return this.hydrate(row);
  }

  /**
   * Like a style reference. Idempotent: saving an already-saved reference is a
   * no-op rather than a duplicate. Rejects an unknown reference id so a typo
   * cannot plant a dead entry that silently contributes nothing to prompts.
   */
  async saveStyleRef(
    styleReferenceId: string,
    brandId?: string,
  ): Promise<StylePreferences> {
    const label = await this.requireStyleRefLabel(styleReferenceId);
    const row = await this.ensureRow(await this.resolveBrandId(brandId));
    const already = row.saved_style_refs.some(
      (r) => r.style_reference_id === styleReferenceId,
    );
    if (already) return this.hydrate(row);

    // Newest first: the prompt builder takes the head of this list.
    const saved: SavedStyleRef[] = [
      {
        style_reference_id: styleReferenceId,
        label,
        saved_at: new Date().toISOString(),
      },
      ...row.saved_style_refs,
    ];
    return this.hydrate(await this.writeSaved(row.id, saved));
  }

  /** Unlike a style reference. Idempotent when it was not saved. */
  async unsaveStyleRef(
    styleReferenceId: string,
    brandId?: string,
  ): Promise<StylePreferences> {
    const row = await this.ensureRow(await this.resolveBrandId(brandId));
    const saved = row.saved_style_refs.filter(
      (r) => r.style_reference_id !== styleReferenceId,
    );
    if (saved.length === row.saved_style_refs.length) return this.hydrate(row);
    return this.hydrate(await this.writeSaved(row.id, saved));
  }

  /** Set how strongly the saved looks steer generation (0 = off, 2 = max). */
  async setSignalWeight(
    signalWeight: number,
    brandId?: string,
  ): Promise<StylePreferences> {
    const row = await this.ensureRow(await this.resolveBrandId(brandId));
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('collections_preferences')
      .update({
        signal_weight: clampSignalWeight(signalWeight),
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException(`preferences ${row.id} not found`);
    return this.hydrate(normalizeRow(data));
  }

  /**
   * THE generation preamble: the brand voice + hard rules, then the brand's
   * saved-style block. This is the preference-learning loop closing — liking a
   * reference on the Style Library page changes what the next generated post is
   * told to look like, with no other wiring.
   *
   * Composed here rather than in BrandKitService because this service already
   * depends on that one; the reverse would be a circular dependency.
   */
  async buildGenerationPreamble(brand: BrandProfile): Promise<string> {
    const brandPreamble = this.brandKit.buildPromptPreamble(brand);
    const styleBlock = await this.buildStylePreamble(brand.id);
    return styleBlock ? `${brandPreamble}\n\n${styleBlock}` : brandPreamble;
  }

  /**
   * The style block for a generation prompt, or '' when nothing is saved or the
   * signal is off. Never throws: preference learning is an enhancement, so a
   * Supabase hiccup degrades to brand-only prompts instead of failing the post.
   */
  async buildStylePreamble(brandId?: string): Promise<string> {
    try {
      return (await this.getPreferences(brandId)).stylePreamble;
    } catch (err) {
      this.logger.warn(
        `style preference preamble unavailable, generating brand-only: ${(err as Error).message}`,
      );
      return '';
    }
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private async resolveBrandId(brandId?: string): Promise<string> {
    if (brandId) return brandId;
    return (await this.brandKit.ensurePropertyIqBrand()).id;
  }

  /**
   * Read (or create) the brand's single preferences row.
   *
   * Always reads the EARLIEST row for the brand, so if two concurrent cold
   * creates ever race past the pre-check, the extra row is inert rather than
   * splitting a brand's likes across two rows. Migration
   * 20260726231500_collections_preferences_unique_brand.sql adds the unique
   * index that stops the race at the database; this ordering keeps the service
   * correct on an environment where that migration has not landed yet.
   */
  private async ensureRow(brandId: string): Promise<CollectionsPreferencesRow> {
    const existing = await this.readRow(brandId);
    if (existing) return existing;

    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('collections_preferences')
      .insert({
        brand_id: brandId,
        saved_style_refs: [],
        signal_weight: STYLE_SIGNAL_WEIGHT_DEFAULT,
      })
      .select('*')
      .maybeSingle();
    if (data) return normalizeRow(data);

    // Lost the race (or the unique index rejected us): the winner's row counts.
    const raced = await this.readRow(brandId);
    if (raced) return raced;
    throw (
      error ?? new Error(`failed to create preferences for brand ${brandId}`)
    );
  }

  private async readRow(
    brandId: string,
  ): Promise<CollectionsPreferencesRow | null> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('collections_preferences')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? normalizeRow(data) : null;
  }

  /**
   * Read-modify-write of the saved list. Two operators liking different
   * references in the same instant can drop one like; this is a single-operator
   * admin surface and the fix is to like it again, so it is not worth a lock.
   */
  private async writeSaved(
    rowId: string,
    saved: SavedStyleRef[],
  ): Promise<CollectionsPreferencesRow> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('collections_preferences')
      .update({ saved_style_refs: saved, updated_at: new Date().toISOString() })
      .eq('id', rowId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException(`preferences ${rowId} not found`);
    return normalizeRow(data);
  }

  /** Label of an existing style reference; 404s when the id is unknown. */
  private async requireStyleRefLabel(
    styleReferenceId: string,
  ): Promise<string> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('style_references')
      .select('label')
      .eq('id', styleReferenceId)
      .maybeSingle();
    if (error) throw error;
    if (!data)
      throw new NotFoundException(
        `style reference ${styleReferenceId} not found`,
      );
    const label = (data as { label?: string | null }).label;
    return typeof label === 'string' ? label : '';
  }

  private async hydrate(
    row: CollectionsPreferencesRow,
  ): Promise<StylePreferences> {
    const ids = row.saved_style_refs.map((r) => r.style_reference_id);
    return toStylePreferences(row, await this.readLiveAttributes(ids));
  }

  private async readLiveAttributes(ids: string[]): Promise<LiveStyleRefs> {
    const out: LiveStyleRefs = new Map();
    if (ids.length === 0) return out;
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('style_references')
      .select('id, label, extracted_attributes')
      .in('id', ids);
    if (error) throw error;
    for (const r of (data ?? []) as Array<{
      id: string;
      label: string | null;
      extracted_attributes: StyleReferenceAttrs | null;
    }>) {
      out.set(r.id, {
        label: r.label ?? '',
        attributes: r.extracted_attributes ?? {},
      });
    }
    return out;
  }
}
