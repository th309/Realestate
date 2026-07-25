import { NotFoundException } from '@nestjs/common';
import { LateApiError } from './late-client.types';
import type { PostCopy } from '../content-pipeline/posts/post.types';

/** Scheduler tuning. Small batch + bounded retry so a bad run can't storm Late. */
export const SCHEDULER_BATCH = 10;
export const MAX_PUBLISH_ATTEMPTS = 3;
/** A post stuck in 'publishing' longer than this is re-attempted (crash recovery). */
export const STUCK_PUBLISHING_MIN = 5;

/** Honest failure for YouTube feed posts — never silently skipped (Decision 2). */
export const YOUTUBE_FAILURE_MESSAGE =
  'YouTube publishes via the video pipeline — create a video run instead';

/**
 * Honest failure for TikTok posts that carry images. TikTok photo posts require
 * a top-level `tiktokSettings` with TikTok's legally-mandated consent flags
 * (`content_preview_confirmed` + `express_consent_given`) — assertions an
 * unattended auto-publisher must not fabricate on the operator's behalf. Rather
 * than strip the images and silently post text-only, we fail the post so the
 * operator can post it manually. Text-only TikTok posts are unaffected.
 * Verified against Late/Zernio docs 2026-07-25 (docs.zernio.com/platforms/tiktok).
 */
export const TIKTOK_IMAGE_UNSUPPORTED_MESSAGE =
  'TikTok photo posts require TikTok’s mandated consent settings, which ' +
  'auto-publishing cannot assert on your behalf — post this image to TikTok ' +
  'manually, or publish it to the other connected platforms instead';

/** Flatten a post's structured copy into the single caption string Late wants. */
export function renderPostCopy(copy: PostCopy): string {
  const parts: string[] = [];
  if (copy.hook) parts.push(copy.hook);
  if (copy.body) parts.push(copy.body);
  if (copy.cta) parts.push(copy.cta);
  let text = parts.join('\n\n');
  if (copy.hashtags?.length) {
    const tags = copy.hashtags
      .map((h) => (h.startsWith('#') ? h : `#${h}`))
      .join(' ');
    text += (text ? '\n\n' : '') + tags;
  }
  return text.trim();
}

/**
 * Permanent failures should fail the post immediately; transient ones are left
 * in 'publishing' for the age-based recovery to retry (bounded by attempts).
 */
export function isPermanentPublishError(err: unknown): boolean {
  if (err instanceof NotFoundException) return true; // no connected account
  if (err instanceof LateApiError) {
    if (err.status === 429) return false; // rate limited → retry
    return err.status >= 400 && err.status < 500; // other 4xx → permanent
  }
  return false; // network / 5xx / not-configured → transient
}

/** One-line error text for the 'failed' status (truncated for the DB column). */
export function toPostError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, 2000);
}
