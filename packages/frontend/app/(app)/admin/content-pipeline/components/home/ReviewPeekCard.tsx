/**
 * A single "waiting on you" card in the review strip. The mixed queue holds runs
 * AND posts, so this discriminates on `kind`:
 *   - video_script post → compact "video idea" pointer to the Video Scripts page
 *     (suggestions, not publishable posts).
 *   - other post → mockup-first: the rendered image IS the card, with the post's
 *     own copy hook as the title and its post-lifecycle status chip. Links to the
 *     review page with `?post=` so it never triggers a run-detail fetch.
 *   - run (or any item without `kind`, for back-compat) → the compact
 *     thumbnail-beside-text row, linked with `?run=`.
 */
import Link from "next/link";
import type { QueueItem } from "../../lib/queue-navigator";
import { FORMAT_META } from "../../lib/format-previews";
import {
  isPostReviewItem,
  isVideoScriptItem,
  prettyPostType,
  reviewItemTitle,
} from "../../review/review-item";
import { PostMediaThumb } from "../PostMediaThumb";
import { PlatformGlyph } from "../../planner/platform-glyph";
import { StatusChip, postStatusToStatusChip } from "./StatusChip";

export function ReviewPeekCard({ item }: { item: QueueItem }) {
  if (isVideoScriptItem(item)) {
    return <VideoIdeaPeek item={item} />;
  }
  if (isPostReviewItem(item)) {
    return <MockupPeek item={item} />;
  }
  return <RunPeek item={item} />;
}

/** Image-first card — the rendered mockup leads, copy hook + post status below. */
function MockupPeek({ item }: { item: QueueItem }) {
  const chip = postStatusToStatusChip(item.status);
  return (
    <Link
      href={`/admin/content-pipeline/review?post=${item.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface transition-shadow duration-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className="relative">
        {item.mediaUrls?.[0] ? (
          <PostMediaThumb
            urls={item.mediaUrls}
            className="w-full aspect-[4/5]"
            rounded="rounded-none"
          />
        ) : (
          <div className="flex aspect-[4/5] w-full items-center justify-center bg-surface-container-high text-xs font-medium text-on-surface-variant">
            {prettyPostType(item.post_type)}
          </div>
        )}
        {item.platform && (
          <span className="absolute left-2 top-2 rounded-md bg-on-surface/70 p-1 backdrop-blur-sm">
            <PlatformGlyph
              platform={item.platform}
              className="!bg-transparent !text-surface"
            />
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 p-3">
        <span className="truncate text-sm font-medium text-on-surface">
          {reviewItemTitle(item)}
        </span>
        <StatusChip tone={chip.tone} label={chip.label} />
      </div>
    </Link>
  );
}

/** Text-forward suggestion pointer — video scripts live on their own page. */
function VideoIdeaPeek({ item }: { item: QueueItem }) {
  return (
    <Link
      href="/admin/content-pipeline/video-scripts"
      className="group flex items-center gap-3 rounded-xl border border-outline-variant bg-surface p-3 transition-shadow duration-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span className="flex h-16 w-12 shrink-0 items-center justify-center rounded-lg bg-tertiary-container text-on-tertiary-container">
        <PlayIcon />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-on-surface">
          {reviewItemTitle(item)}
        </div>
        <div className="mt-0.5 text-xs text-on-surface-variant">Video idea</div>
        <div className="mt-1.5 text-xs font-medium text-primary">
          Review scripts →
        </div>
      </div>
    </Link>
  );
}

/** Compact video-run row (thumbnail beside text) — the original treatment. */
function RunPeek({ item }: { item: QueueItem }) {
  const label = item.market_query?.trim() || "Untitled";
  const formatLabel = item.format
    ? (FORMAT_META[item.format]?.displayName ?? item.format)
    : null;
  return (
    <Link
      href={`/admin/content-pipeline/review?run=${item.id}`}
      className="group flex items-center gap-3 rounded-xl border border-outline-variant bg-surface p-3 transition-shadow duration-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-primary-container to-surface-container-high">
        {item.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnail_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-on-surface">
          {label}
        </div>
        {formatLabel && (
          <div className="mt-0.5 truncate text-xs text-on-surface-variant">
            {formatLabel}
          </div>
        )}
        <div className="mt-1.5">
          <StatusChip status={item.status ?? "ready_for_review"} />
        </div>
      </div>
    </Link>
  );
}

function PlayIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
