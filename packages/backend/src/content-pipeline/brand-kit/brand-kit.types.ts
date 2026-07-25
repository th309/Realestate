// packages/backend/src/content-pipeline/brand-kit/brand-kit.types.ts
//
// Shared types for the brand-kit module. A "brand profile" is the normalized,
// generator-facing view of a `brands` row: voice, approved copy, and the hard
// rules every generator's prompt preamble must encode.

/** Score-language rules — momentum words only, never quality words. */
export interface ScoreLanguageRules {
  /** How to describe a score's direction (per CLAUDE.md §9 + brand guide §4.5). */
  allowedMomentumWords: string[];
  /** Quality words that make a momentum signal read as a verdict — always banned. */
  bannedQualityWords: string[];
  rule: string;
}

/** Hard content bans enforced by Gate B and encoded in every prompt preamble. */
export interface BrandBans {
  /** Hype phrases to avoid (editable — admins may extend the list). */
  hypePhrases: string[];
  /**
   * FIXED, always-on. The preamble emits the em-dash and no-competitor rules
   * unconditionally and these coerce to true on read, so they are NOT exposed
   * as editable in UpdateBrandDto (toggling them would be a silent no-op). Per
   * the brand guide these rules are not optional.
   */
  noEmOrEnDashes: boolean;
  neverNameCompetitors: boolean;
  /** Named for prompt context so the model knows who NOT to mention (editable). */
  competitors: string[];
}

/** Approved, verbatim copy the generators may reuse. */
export interface ApprovedCopy {
  /** EXACT public coverage stat. Never any other coverage number. */
  coverageStat: string;
  /** Brand taglines — use verbatim, do not remix. */
  taglines: string[];
  /** Short sign-offs for post closers. */
  signOffs: string[];
  /** Free-tier framing to include with CTAs. */
  freeTierFraming: string[];
  scoreLanguage: ScoreLanguageRules;
  bans: BrandBans;
}

export interface ToneSettings {
  attributes: string[];
  /** Internal shorthand the AI content system uses. */
  shorthand: string;
}

export interface BrandProduct {
  name: string;
  summary: string;
}

/** The full generator-facing brand profile derived from a `brands` row. */
export interface BrandProfile {
  id: string;
  name: string;
  websiteUrl: string | null;
  voiceSummary: string | null;
  tone: ToneSettings;
  products: BrandProduct[];
  targetPlatforms: string[];
  approvedCopy: ApprovedCopy;
}

/** Raw `brands` table row shape. */
export interface BrandRow {
  id: string;
  name: string;
  website_url: string | null;
  voice_summary: string | null;
  tone_settings: ToneSettings | Record<string, unknown>;
  products: BrandProduct[] | unknown[];
  target_platforms: string[];
  approved_copy: ApprovedCopy | Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
