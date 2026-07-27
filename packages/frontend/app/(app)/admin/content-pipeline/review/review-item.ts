/**
 * Pure helpers for discriminating the mixed review queue (runs + posts) and
 * deriving display strings. Kept React-free so the seam rules are unit-testable.
 *
 * Back-compat: an item with no `kind` is treated as a run — that's the shape the
 * queue returned before post items were added, so the run path stays unchanged
 * until the backend starts tagging items.
 */
import type { QueueItem } from "../lib/queue-navigator";
import type { PlannerPost } from "../lib/posts-api";

/** Post items carry `kind: 'post'`; everything else (incl. absent) is a run. */
export function isPostReviewItem(item: QueueItem): boolean {
  return item.kind === "post";
}

/**
 * A post that failed to publish. These don't come from the backend's review
 * queue (which carries work that hasn't shipped yet) — the review page folds
 * them in so a failure is reviewable in the same place as everything else.
 */
export function isFailedPostItem(item: QueueItem): boolean {
  return isPostReviewItem(item) && item.status === "failed";
}

/** Project a failed post onto the queue-item shape the navigator renders. */
export function failedPostToQueueItem(post: PlannerPost): QueueItem {
  return {
    id: post.id,
    kind: "post",
    status: post.status,
    post_type: post.post_type,
    platform: post.platform,
    copy: post.copy,
    mediaUrls: post.mediaUrls,
    created_at: post.created_at,
    error: post.error,
    attempts: post.attempts,
  };
}

/**
 * Video-script posts are suggestions, not publishable posts — no approve /
 * schedule, and the primary action is "Make this video" into the run wizard.
 */
export function isVideoScriptItem(item: QueueItem): boolean {
  return isPostReviewItem(item) && item.post_type === "video_script";
}

/** Human-readable post type, e.g. `image_post` -> "Image Post". */
export function prettyPostType(postType: string | undefined): string {
  if (!postType) return "Post";
  return postType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Sticky-header title: market query for runs, hook/post-type for posts. */
export function reviewItemTitle(item: QueueItem | undefined): string {
  if (!item) return "";
  if (isPostReviewItem(item)) {
    return item.copy?.hook?.trim() || prettyPostType(item.post_type);
  }
  return item.market_query?.trim() || "Untitled";
}
