// packages/backend/src/content-pipeline/feed/feed.types.ts
//
// The feed generator keeps N draft posts pending review. It picks a mix of post
// types, grounds each in real market data, generates copy via the DeepSeek
// purposes, lints it through Gate B, and inserts a `posts` row (pending_review).

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

/** Which social platform a generated post_type targets. */
export const FEED_POST_TYPE_PLATFORM: Record<FeedPostType, string> = {
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
