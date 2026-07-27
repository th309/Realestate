/**
 * Shared types for the content-pipeline module.
 * See docs/content-pipeline/design.md for authoritative descriptions.
 */

export type ContentFormat =
  | 'grade_reveal'
  | 'top_10_ranking'
  | 'bottom_10_ranking'
  | 'score_mover'
  | 'head_to_head'
  | 'long_form_deep_dive'
  | 'farm_area_spotlight'
  | 'brokerage_market_share'
  | 'recruitment_angle'
  // Static NotebookLM infographic. Unlike every other format this one is NOT
  // advanced by the backend job handlers — see `infographics/`.
  | 'infographic';

export type Audience = 'investor' | 'agent' | 'broker' | 'mixed';

export type Platform =
  | 'youtube_shorts'
  | 'youtube_long'
  | 'tiktok'
  | 'instagram_reels'
  | 'facebook_reels'
  | 'linkedin';

export type PostMode = 'direct' | 'draft' | 'scheduled';

export type ApprovalMode = 'auto' | 'review' | 'draft';

export type PipelineStatus =
  | 'queued'
  | 'fetching_data'
  | 'scripting'
  | 'verifying_data'
  | 'linting_voice'
  | 'rendering_voice'
  | 'timing_captions'
  | 'rendering_video'
  // Infographic lane only. Deliberately absent from RecoverStuckRunsCron's
  // STEP_TIMEOUT_MIN and STATE_TO_QUEUE tables: no backend queue can advance
  // these, so the cron must never try to re-enqueue them. `infographic_ready`
  // is terminal — the generated PNG waits for review as a draft post, not as
  // a run, which is also why it is NOT `ready_for_review` (that status offers
  // operators a resume action that would push the run into the video pipeline).
  | 'generating_infographic'
  | 'infographic_ready'
  | 'ready_for_review'
  | 'publishing'
  | 'published'
  | 'published_partial'
  | 'rejected'
  | 'failed'
  | 'cancelled';

export interface GeoRef {
  geography: 'state' | 'metro' | 'county' | 'zip';
  id: string;
  canonical_name: string;
}
