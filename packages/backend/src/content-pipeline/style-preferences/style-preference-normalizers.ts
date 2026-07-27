// packages/backend/src/content-pipeline/style-preferences/style-preference-normalizers.ts
//
// Pure row → view mapping for style preferences, split out of the service so it
// stays I/O-only (mirrors brand-kit/brand-profile-normalizers.ts).

import {
  buildStylePreferencePreamble,
  clampSignalWeight,
  MAX_REFS_IN_PREAMBLE,
} from './style-preference-preamble';
import type {
  CollectionsPreferencesRow,
  HydratedStyleRef,
  SavedStyleRef,
  StylePreferences,
} from './style-preference.types';

/** Extracted attributes as stored on a `style_references` row. */
export interface StyleReferenceAttrs {
  palette?: string[];
  typography?: string[];
  layout?: string[];
  summary?: string;
}

/** Live `style_references` data keyed by id, for hydrating saved likes. */
export type LiveStyleRefs = Map<
  string,
  { label: string; attributes: StyleReferenceAttrs }
>;

/**
 * Put likes in canonical newest-first order and apply the persisted-row cap.
 *
 * Ordering is explicit rather than relying on callers prepending, so "the
 * newest N" is well defined no matter how the stored array was written. Entries
 * with an unparseable saved_at sort last (treated as oldest) instead of
 * poisoning the comparison.
 *
 * `maxSaved` is the STORAGE bound, not the prompt cap — see MAX_SAVED_STYLE_REFS
 * in style-preference.service.ts for why overflow evicts the oldest.
 */
export function orderNewestFirstAndCap(
  refs: SavedStyleRef[],
  maxSaved: number,
): { saved: SavedStyleRef[]; evicted: number } {
  const at = (r: SavedStyleRef) => {
    const t = Date.parse(r.saved_at ?? '');
    return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
  };
  const ordered = [...refs].sort((a, b) => at(b) - at(a));
  return {
    saved: ordered.slice(0, maxSaved),
    evicted: Math.max(0, ordered.length - maxSaved),
  };
}

/** Coerce a raw Supabase row into the typed shape (JSONB arrives loose). */
export function normalizeRow(data: unknown): CollectionsPreferencesRow {
  const row = data as CollectionsPreferencesRow;
  return {
    ...row,
    saved_style_refs: Array.isArray(row.saved_style_refs)
      ? row.saved_style_refs.filter((r) => !!r?.style_reference_id)
      : [],
    signal_weight: Number(row.signal_weight),
  };
}

/**
 * Join saved likes to their live style references. The live label wins over the
 * denormalized one, so renaming a reference is reflected without a write here.
 */
export function hydrateSavedRefs(
  row: CollectionsPreferencesRow,
  live: LiveStyleRefs,
): HydratedStyleRef[] {
  return row.saved_style_refs.map((r) => {
    const hit = live.get(r.style_reference_id);
    return {
      ...r,
      label: hit?.label || r.label,
      exists: !!hit,
      palette: hit?.attributes.palette ?? [],
      typography: hit?.attributes.typography ?? [],
      layout: hit?.attributes.layout ?? [],
      summary: hit?.attributes.summary ?? '',
    };
  });
}

/**
 * Build the generator-facing + UI-facing view, including the exact prompt block
 * the current weight produces. Deleted references contribute nothing to the
 * prompt but stay in the list (exists: false) so the operator can see why a
 * like stopped counting.
 */
export function toStylePreferences(
  row: CollectionsPreferencesRow,
  live: LiveStyleRefs,
): StylePreferences {
  const savedStyleRefs = hydrateSavedRefs(row, live);
  return {
    brandId: row.brand_id,
    signalWeight: clampSignalWeight(Number(row.signal_weight)),
    savedStyleRefs,
    stylePreamble: buildStylePreferencePreamble(
      savedStyleRefs.filter((r) => r.exists).slice(0, MAX_REFS_IN_PREAMBLE),
      Number(row.signal_weight),
    ),
  };
}
