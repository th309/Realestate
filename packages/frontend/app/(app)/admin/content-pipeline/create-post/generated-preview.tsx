import Link from "next/link";
import type { PlannerPost } from "../lib/posts-api";

/**
 * Success state: the freshly generated draft. Shows the rendered image (full,
 * not cropped — carousels flag their slide count) alongside the copy, then
 * points the operator to where it actually landed: the review feed. "Create
 * another" resets the flow without a round-trip to the home page.
 */
export function GeneratedPreview({
  post,
  onReset,
}: {
  post: PlannerPost;
  onReset: () => void;
}) {
  const cover = post.mediaUrls?.[0];
  const slideCount = post.mediaUrls?.length ?? 0;
  const isCarousel = post.post_type === "carousel" || slideCount > 1;
  const copy = post.copy ?? {};
  const hashtags = copy.hashtags ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-primary/30 bg-primary-container/40 px-5 py-4">
        <p className="text-sm font-semibold text-on-surface">
          It&apos;s in your review feed
        </p>
        <p className="mt-0.5 text-sm text-on-surface-variant">
          This draft is waiting for your approval before anything publishes.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,220px)_1fr]">
        <div className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container-high">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt=""
              className="h-full max-h-80 w-full object-contain"
            />
          ) : (
            <div className="flex aspect-square items-center justify-center px-4 text-center text-sm text-on-surface-variant">
              No image rendered — copy only.
            </div>
          )}
          {isCarousel && slideCount > 1 && (
            <span className="absolute right-2 top-2 rounded-full bg-on-surface/70 px-2 py-0.5 text-xs font-semibold text-surface backdrop-blur-sm">
              ×{slideCount}
            </span>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          {copy.hook && (
            <p className="text-base font-semibold text-on-surface">
              {copy.hook}
            </p>
          )}
          {copy.body && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-on-surface-variant">
              {copy.body}
            </p>
          )}
          {copy.cta && (
            <p className="text-sm font-medium text-on-surface">{copy.cta}</p>
          )}
          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {hashtags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs text-on-surface-variant"
                >
                  {tag.startsWith("#") ? tag : `#${tag}`}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/content-pipeline/review"
          className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary/90"
        >
          Go to review
        </Link>
        <Link
          href="/admin/content-pipeline/planner"
          className="rounded-full border border-outline-variant px-6 py-2.5 text-sm font-semibold text-on-surface transition-colors duration-200 hover:bg-surface-container-high"
        >
          Open planner
        </Link>
        <button
          type="button"
          onClick={onReset}
          className="rounded-full px-5 py-2.5 text-sm font-semibold text-primary transition-colors duration-200 hover:bg-primary/10"
        >
          Create another
        </button>
      </div>
    </div>
  );
}
