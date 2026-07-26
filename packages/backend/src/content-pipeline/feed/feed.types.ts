// packages/backend/src/content-pipeline/feed/feed.types.ts
//
// The feed generator keeps N draft posts pending review. It picks a mix of post
// types, grounds each in real market data, generates copy via the DeepSeek
// purposes, lints it through Gate B, and inserts a `posts` row (pending_review).

import {
  SOCIAL_PLATFORMS,
  type SocialPlatform,
} from '../../social-connect/late-client.types';

/**
 * Platforms a feed post can target. SOCIAL_PLATFORMS is the canonical
 * Late-publishable set (single source of truth in social-connect). 'youtube' is
 * appended only as a generic marker for the direct-YouTube path: video_script
 * posts publish via the direct YouTube integration, never Late. The Phase 5
 * publisher routes youtube by `platform.startsWith('youtube')`, so this generic
 * id matches without needing the concrete 'youtube_shorts'/'youtube_long' ids
 * from content-pipeline/types.ts.
 */
export const PUBLISH_PLATFORMS = [...SOCIAL_PLATFORMS, 'youtube'] as const;
export type PublishPlatform = SocialPlatform | 'youtube';

/** Post types the feed rotates through. */
export type FeedPostType =
  | 'linkedin_post'
  | 'facebook_post'
  | 'carousel_copy'
  | 'video_script';

export const FEED_POST_TYPES: FeedPostType[] = [
  'linkedin_post',
  'facebook_post',
  'carousel_copy',
  'video_script',
];

/**
 * Which platform a generated post_type targets. Typed as PublishPlatform so a
 * typo is a compile error. NOTE: `video_script` maps to 'youtube', which is NOT
 * a Late `SocialPlatform` — youtube-typed posts route to the direct YouTube
 * publisher (Phase 5), never the Late publish path (whose PublishViaConnectionDto
 * validates @IsIn(SOCIAL_PLATFORMS) and would reject 'youtube'). Whoever wires
 * Phase 5 must branch on platform === 'youtube' before dispatching to Late.
 */
export const FEED_POST_TYPE_PLATFORM: Record<FeedPostType, PublishPlatform> = {
  linkedin_post: 'linkedin',
  facebook_post: 'facebook',
  carousel_copy: 'linkedin',
  video_script: 'youtube',
};

/**
 * Compact, real market-data grounding passed into the generation prompt. Sourced
 * from ContentDataService (score movers + snapshot) so every post cites true
 * numbers. Kept small and JSON-serializable so it can be embedded in the prompt.
 */
export interface FeedMarketGrounding {
  geoLevel: 'metro' | 'county' | 'zip';
  geoId: string;
  marketName: string;
  state: string | null;
  score: number | null;
  scoreLabel: string | null;
  confidence: string | null;
  previousScore: number | null;
  scoreDelta: number | null;
  homeValue: number | null;
  homeValueYoyPct: number | null;
  rent: number | null;
  rentYoyPct: number | null;
}

/**
 * A market to ground a post in. A score-mover (ScoreMoverItem, from the cron
 * candidate pick) and a resolved market (ResolvedMarket, from an on-demand
 * marketQuery) both satisfy this; the score fields are optional because a
 * resolved market has none until getMarketSnapshot fills them.
 */
export interface GroundingTarget {
  id: string;
  canonical_name: string;
  geography: 'metro' | 'county' | 'zip';
  current_score?: number | null;
  previous_score?: number | null;
  delta?: number | null;
  state?: string | null;
}

/** Result of one feed generation attempt (for logging / tests). */
export interface FeedGenerationOutcome {
  postType: FeedPostType;
  marketName: string;
  status:
    | 'inserted'
    | 'lint_failed'
    | 'empty_completion'
    | 'skipped_budget'
    | 'error';
  postId?: string;
  reason?: string;
}

/** Config for a top-up cycle. */
export interface FeedConfig {
  /** Target number of pending_review draft posts to keep queued. */
  targetDrafts: number;
}
