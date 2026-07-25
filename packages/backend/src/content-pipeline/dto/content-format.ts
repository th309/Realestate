import type { ContentFormat } from '../types';

/**
 * Runtime allow-list for `ContentFormat` (a compile-time union in types.ts).
 * Used to validate the `:format` path param on PATCH /settings/formats/:format,
 * which class-validator DTOs can't reach directly.
 */
export const CONTENT_FORMATS: readonly ContentFormat[] = [
  'grade_reveal',
  'top_10_ranking',
  'bottom_10_ranking',
  'score_mover',
  'head_to_head',
  'long_form_deep_dive',
  'farm_area_spotlight',
  'brokerage_market_share',
  'recruitment_angle',
];

export function isContentFormat(value: string): value is ContentFormat {
  return (CONTENT_FORMATS as readonly string[]).includes(value);
}
