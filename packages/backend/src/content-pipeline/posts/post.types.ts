// packages/backend/src/content-pipeline/posts/post.types.ts
//
// The generalized `posts` model: one row per social post of any type. Status
// lifecycle is enforced by ALLOWED_POST_STATUS_TRANSITIONS (below) so the API
// and feed generator can never move a post into an invalid state.

export const POST_STATUSES = [
  'draft',
  'pending_review',
  'approved',
  'scheduled',
  'publishing',
  'published',
  'failed',
  'skipped',
] as const;

export type PostStatus = (typeof POST_STATUSES)[number];

/** Post source: where the row came from. */
export type PostSource = 'ai_generated' | 'manual' | 'repurposed';

/**
 * Allowed status transitions. A key's array lists the statuses it may move to.
 * `published` and `skipped` are terminal (empty arrays). Publishing (Phase 5)
 * and the feed generator both go through PostsService.updateStatus, which
 * rejects any transition not listed here.
 */
export const ALLOWED_POST_STATUS_TRANSITIONS: Record<PostStatus, PostStatus[]> =
  {
    draft: ['pending_review', 'skipped'],
    pending_review: ['approved', 'draft', 'skipped'],
    approved: ['scheduled', 'published', 'skipped'],
    // 'publishing' is the Phase 5 in-flight claim: the scanner flips
    // scheduled->publishing before calling the external API. scheduled->failed
    // stays for the pre-claim honest-fail path (e.g. YouTube).
    scheduled: ['publishing', 'published', 'failed', 'skipped'],
    publishing: ['published', 'failed'],
    published: [],
    failed: ['pending_review', 'scheduled', 'skipped'],
    skipped: [],
  };

export function isAllowedPostStatusTransition(
  from: PostStatus,
  to: PostStatus,
): boolean {
  if (from === to) return true;
  return (ALLOWED_POST_STATUS_TRANSITIONS[from] ?? []).includes(to);
}

/**
 * JSONB `copy` payload. These typed keys are the schema the DTO validates and
 * the generators/linter read; no index signature, so the validated PostCopyDto
 * (which also drops it) is assignable here. Extra keys a model might emit are
 * dropped by DTO validation before persistence.
 */
export interface PostCopy {
  hook?: string;
  body?: string;
  cta?: string;
  hashtags?: string[];
  /** Carousel slides / multi-part copy. */
  slides?: Array<{ heading?: string; body?: string }>;
}

/** A media reference (image/video asset) attached to a post. */
export interface PostMediaRef {
  kind: string;
  url?: string;
  storage_path?: string;
  [key: string]: unknown;
}

/** Raw `posts` table row. */
export interface PostRow {
  id: string;
  brand_id: string;
  platform: string;
  post_type: string;
  copy: PostCopy;
  media_refs: PostMediaRef[];
  status: PostStatus;
  scheduled_at: string | null;
  published_at: string | null;
  platform_post_id: string | null;
  source: string;
  error: string | null;
  /** Publish attempt counter (Phase 5 bounded retry). Added in migration 20260725183849. */
  attempts: number;
  created_at: string;
  updated_at: string;
}

/** Input shape for inserting a post (feed generator + manual create). */
export interface CreatePostInput {
  brandId: string;
  platform: string;
  postType: string;
  copy: PostCopy;
  mediaRefs?: PostMediaRef[];
  status?: PostStatus;
  source?: PostSource;
  scheduledAt?: string | null;
}
