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
  | 'recruitment_angle';

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
