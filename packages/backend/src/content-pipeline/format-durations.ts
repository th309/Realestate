/**
 * Backend mirror of video-template's FORMAT_CONFIGS.durationInFrames.
 * Used by RunActionsService.regenerateThumbnail to validate a requested
 * frame is within the format's range. Mirroring is acceptable here because
 * adding a new format already requires changes in three places (frontend
 * registry, video-template, prompts) — adding a fourth that's a single
 * number is not the architectural break to fight.
 */

import type { ContentFormat } from './types';

/** Must match packages/video-template `LONG_FORM_MAX_DURATION_FRAMES` (5 min @ 30fps). */
export const LONG_FORM_MAX_DURATION_FRAMES = 5 * 60 * 30;

export const FORMAT_DURATIONS_IN_FRAMES: Record<ContentFormat, number> = {
  grade_reveal: 900,
  top_10_ranking: 1800,
  bottom_10_ranking: 1800,
  score_mover: 900,
  head_to_head: 1800,
  long_form_deep_dive: LONG_FORM_MAX_DURATION_FRAMES,
  farm_area_spotlight: 1800,
  brokerage_market_share: 2250,
  recruitment_angle: 2700,
};
