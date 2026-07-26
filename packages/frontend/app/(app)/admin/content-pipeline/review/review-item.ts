/**
 * Pure helpers for discriminating the mixed review queue (runs + posts) and
 * deriving display strings. Kept React-free so the seam rules are unit-testable.
 *
 * Back-compat: an item with no `kind` is treated as a run — that's the shape the
 * queue returned before post items were added, so the run path stays unchanged
 * until the backend starts tagging items.
 */
import type { QueueItem } from "../lib/queue-navigator";

/** Post items carry `kind: 'post'`; everything else (incl. absent) is a run. */
export function isPostReviewItem(item: QueueItem): boolean {
  return item.kind === "post";
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
