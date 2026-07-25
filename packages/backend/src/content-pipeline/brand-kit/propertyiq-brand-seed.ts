// packages/backend/src/content-pipeline/brand-kit/propertyiq-brand-seed.ts
//
// Approved PropertyIQ brand copy, hardcoded server-side. Source of truth is the
// brand guide: docs/marketing/propertyiq-social-media-brand-guide.md (§3, §4,
// §4.5) and CLAUDE.md §8 / §9. The coverage stat mirrors COVERAGE_COPY in
// packages/frontend/lib/data/validation-claims.ts — kept verbatim here so the
// backend never depends on the frontend package. If the brand guide changes,
// update this file alongside it (do NOT drift the strings).
//
// Reuses the taglines / forbidden phrases / dash chars from the Gate B linter
// (../gates/voice-rules) so there is ONE source for those lists.

import {
  APPROVED_TAGLINES,
  FORBIDDEN_PHRASES,
  EM_DASH_CHARS,
} from '../gates/voice-rules';
import type {
  ApprovedCopy,
  BrandProduct,
  ToneSettings,
} from './brand-kit.types';

/**
 * EXACT approved public coverage stat (brand guide §4.5). Conservative rounded
 * floors that survive the monthly rescore's region churn. Never substitute any
 * other coverage number found in older internal docs.
 */
export const PROPERTYIQ_COVERAGE_STAT =
  '900+ metros, 3,000+ counties, 29,000+ ZIPs';

/** Short sign-offs approved for post closers (brand guide §3). */
export const PROPERTYIQ_SIGN_OFFS = [
  'The IQ Behind Every Market',
  'PropertyIQ. Now you know.',
  'Now you know.',
];

/**
 * Momentum words allowed to describe a score's direction. Quality words are
 * banned because the PropertyIQ Score is a momentum forecast, not a quality
 * grade (CLAUDE.md §9: "Charlotte: VERY POOR" is exactly what NOT to produce).
 */
const ALLOWED_MOMENTUM_WORDS = [
  'very strong',
  'strong',
  'rising',
  'firming',
  'steady',
  'easing',
  'weak',
  'very weak',
  'cooling',
  'heating up',
  'accelerating',
  'slowing',
];

const BANNED_QUALITY_WORDS = [
  'excellent',
  'good',
  'poor',
  'bad',
  'great',
  'terrible',
  'best',
  'worst',
];

/** Competitors that must NEVER be named in public copy (brand guide §10). */
const COMPETITORS = [
  'BiggerPockets',
  'Reventure',
  'Reventure App',
  'Mashvisor',
  'PropStream',
  'DealCheck',
];

export const PROPERTYIQ_TONE: ToneSettings = {
  attributes: [
    'confident',
    'conversational',
    'data-first',
    'accessible',
    'actionable',
  ],
  shorthand: 'confident, conversational, data-first, not hypey',
};

export const PROPERTYIQ_PRODUCTS: BrandProduct[] = [
  {
    name: 'PropertyIQ Score',
    summary:
      "A 1 to 99 momentum score for every U.S. metro, county, and ZIP, recalculated monthly, built from home-price momentum, median days on market, and share of listings with a price cut. 50 equals the market's own state average. Nationally computed, state-calibrated.",
  },
  {
    name: 'Interactive market map',
    summary:
      'Every U.S. metro, county, and ZIP colored by the PropertyIQ Score, with historical trends and rent data.',
  },
  {
    name: 'AI market reports',
    summary: 'Fresh, non-templated written narrative analysis for any market.',
  },
  {
    name: 'Claude (MCP) integration',
    summary:
      'One of the only products in its category with a working AI-assistant integration, letting users ask Claude directly for PropertyIQ market data.',
  },
];

export const PROPERTYIQ_VOICE_SUMMARY =
  'PropertyIQ is the Smart Friend for real estate investors and agents: confident, conversational, data-first, and never salesy. Lead with a number, a percentage, or a trend, then point to a specific, low-friction next step. Describe the PropertyIQ Score as momentum (rising, steady, easing, weak), never as quality.';

export const PROPERTYIQ_TARGET_PLATFORMS = [
  'linkedin',
  'facebook',
  'instagram',
  'youtube',
];

/** The approved-copy JSONB payload seeded into the PropertyIQ brand row. */
export const PROPERTYIQ_APPROVED_COPY: ApprovedCopy = {
  coverageStat: PROPERTYIQ_COVERAGE_STAT,
  taglines: [...APPROVED_TAGLINES],
  signOffs: PROPERTYIQ_SIGN_OFFS,
  freeTierFraming: ['No credit card required.', 'Cancel anytime.', 'free'],
  scoreLanguage: {
    allowedMomentumWords: ALLOWED_MOMENTUM_WORDS,
    bannedQualityWords: BANNED_QUALITY_WORDS,
    rule: "The PropertyIQ Score is a momentum forecast, not a quality grade. 50 equals the market's own state average. Describe direction with momentum words only. Never call a score good, bad, excellent, or poor.",
  },
  bans: {
    hypePhrases: [...FORBIDDEN_PHRASES],
    noEmOrEnDashes: true,
    neverNameCompetitors: true,
    competitors: COMPETITORS,
  },
};

/** Em/en dash characters banned in social copy (mirrors Gate B). */
export const PROPERTYIQ_BANNED_DASHES = [...EM_DASH_CHARS];

/** Canonical name used to find/seed the singleton PropertyIQ brand row. */
export const PROPERTYIQ_BRAND_NAME = 'PropertyIQ';
export const PROPERTYIQ_WEBSITE_URL = 'https://www.propertyiq.app';
