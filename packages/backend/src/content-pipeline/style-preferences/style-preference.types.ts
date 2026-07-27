// packages/backend/src/content-pipeline/style-preferences/style-preference.types.ts
//
// Types for the preference-learning loop over `collections_preferences`.
//
// Three neighbouring directories, kept distinct on purpose:
//   style-refs/        — the style reference LIBRARY (CRUD, upload, Vision extract)
//   style-references/  — the A/B binding that picks ONE reference per render
//   style-preferences/ — THIS: which references an operator liked for a brand,
//                        and how strongly they steer generation prompts
//
// A "liked" reference is stored by id only; the palette/typography/layout are
// read live from `style_references` at prompt-build time so re-extracting a
// reference immediately changes what generation sees.

/** One entry in `collections_preferences.saved_style_refs` (JSONB array). */
export interface SavedStyleRef {
  style_reference_id: string;
  /** Denormalized for display; the live label still wins when hydrating. */
  label: string;
  saved_at: string;
}

/** Raw `collections_preferences` row. */
export interface CollectionsPreferencesRow {
  id: string;
  brand_id: string;
  saved_style_refs: SavedStyleRef[];
  signal_weight: number;
  created_at: string;
  updated_at: string;
}

/** A saved reference joined with its live extracted attributes (admin UI). */
export interface HydratedStyleRef extends SavedStyleRef {
  /** False when the underlying style reference has since been deleted. */
  exists: boolean;
  palette: string[];
  typography: string[];
  layout: string[];
  summary: string;
}

/** Generator-facing + UI-facing view of a brand's style preferences. */
export interface StylePreferences {
  brandId: string;
  signalWeight: number;
  savedStyleRefs: HydratedStyleRef[];
  /**
   * The exact block appended to the generation prompt preamble at this weight.
   * Empty string when nothing is saved or the signal is switched off — the admin
   * UI shows it verbatim so "what is influencing generation" is never a guess.
   */
  stylePreamble: string;
}
