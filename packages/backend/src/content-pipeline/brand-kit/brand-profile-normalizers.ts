// packages/backend/src/content-pipeline/brand-kit/brand-profile-normalizers.ts
//
// Normalizes a raw `brands` row into the generator-facing BrandProfile, filling
// approved-copy defaults for any missing/legacy field so a prompt preamble is
// never malformed. Extracted from BrandKitService to keep that file lean.
//
// The two ban booleans (noEmOrEnDashes, neverNameCompetitors) are FIXED: they
// always coerce to true regardless of stored value, because the preamble emits
// those rules unconditionally and the brand guide treats them as non-optional.

import { PROPERTYIQ_APPROVED_COPY } from './propertyiq-brand-seed';
import type {
  ApprovedCopy,
  BrandProduct,
  BrandProfile,
  BrandRow,
  ToneSettings,
} from './brand-kit.types';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Deep-merge a JSONB patch onto a base value: nested plain objects merge
 * recursively; arrays and scalars from the patch replace the base. Used so a
 * partial PATCH to tone_settings/approved_copy preserves the sibling fields the
 * caller did not send (a full-column overwrite would silently drop them).
 */
export function deepMergeJsonb(base: unknown, patch: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    out[k] = k in out ? deepMergeJsonb(out[k], v) : v;
  }
  return out;
}

/** Keep only product entries that have BOTH a non-blank name and summary. */
export function coerceProducts(raw: unknown): BrandProduct[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (p): p is BrandProduct =>
      isPlainObject(p) &&
      typeof p.name === 'string' &&
      p.name.trim().length > 0 &&
      typeof p.summary === 'string' &&
      p.summary.trim().length > 0,
  );
}

export function coerceTone(raw: unknown): ToneSettings {
  const t = (raw ?? {}) as Partial<ToneSettings>;
  return {
    attributes: Array.isArray(t.attributes) ? t.attributes : [],
    shorthand: typeof t.shorthand === 'string' ? t.shorthand : '',
  };
}

export function coerceApprovedCopy(raw: unknown): ApprovedCopy {
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
      allowedMomentumWords: Array.isArray(a.scoreLanguage?.allowedMomentumWords)
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
      // Fixed rules — always true, never driven by stored/editable state.
      noEmOrEnDashes: true,
      neverNameCompetitors: true,
      competitors: Array.isArray(a.bans?.competitors)
        ? a.bans.competitors
        : d.bans.competitors,
    },
  };
}

export function rowToBrandProfile(row: BrandRow): BrandProfile {
  return {
    id: row.id,
    name: row.name,
    websiteUrl: row.website_url ?? null,
    voiceSummary: row.voice_summary ?? null,
    tone: coerceTone(row.tone_settings),
    products: coerceProducts(row.products),
    targetPlatforms: Array.isArray(row.target_platforms)
      ? row.target_platforms
      : [],
    approvedCopy: coerceApprovedCopy(row.approved_copy),
  };
}
