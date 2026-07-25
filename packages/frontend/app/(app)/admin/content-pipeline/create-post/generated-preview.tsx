"use client";

import { useState } from "react";
import Link from "next/link";
import type { PlannerPost } from "../lib/posts-api";

/**
 * Success state: the freshly generated draft, shown mockup-first — the full-size
 * rendered image is the payoff. Carousels get a lightweight slide pager. If the
 * image render failed (no media + an error), we say so honestly and offer a
 * regenerate rather than dressing up a bare text blob as the post. Then a pointer
 * to where it landed (the review feed).
 */
export function GeneratedPreview({
  post,
  onReset,
  onRegenerate,
}: {
  post: PlannerPost;
  onReset: () => void;
  onRegenerate: () => void;
}) {
  const urls = post.mediaUrls ?? [];
  const [slide, setSlide] = useState(0);
  const current = urls[Math.min(slide, urls.length - 1)];
  const renderFailed = urls.length === 0 && Boolean(post.error);
  const copy = post.copy ?? {};
  const hashtags = copy.hashtags ?? [];

  // Reserve the frame's aspect from the media ref so the image doesn't shift in.
  const ref = post.media_refs?.[0];
  const aspectRatio =
    ref?.width && ref?.height ? `${ref.width} / ${ref.height}` : "1080 / 1350";

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

      <div className="mx-auto w-full max-w-sm">
        <div
          className="relative overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-high"
          style={{ aspectRatio }}
        >
          {current ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current}
              alt=""
              className="h-full w-full object-contain"
            />
          ) : (
            <FailedOrEmpty renderFailed={renderFailed} />
          )}
          {urls.length > 1 && (
            <span className="absolute right-2 top-2 rounded-full bg-on-surface/70 px-2 py-0.5 text-xs font-semibold text-surface backdrop-blur-sm">
              {slide + 1} / {urls.length}
            </span>
          )}
        </div>

        {urls.length > 1 && (
          <div className="mt-3 flex items-center justify-center gap-4">
            <PagerButton
              label="Previous slide"
              disabled={slide === 0}
              onClick={() => setSlide((s) => Math.max(0, s - 1))}
            >
              ‹
            </PagerButton>
            <span className="text-xs tabular-nums text-on-surface-variant">
              Slide {slide + 1} of {urls.length}
            </span>
            <PagerButton
              label="Next slide"
              disabled={slide >= urls.length - 1}
              onClick={() => setSlide((s) => Math.min(urls.length - 1, s + 1))}
            >
              ›
            </PagerButton>
          </div>
        )}

        {renderFailed && (
          <button
            type="button"
            onClick={onRegenerate}
            className="mt-3 w-full rounded-full border border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors duration-200 hover:bg-surface-container-high"
          >
            Regenerate image
          </button>
        )}
      </div>

      <div className="space-y-3">
        {copy.hook && (
          <p className="text-base font-semibold text-on-surface">{copy.hook}</p>
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

function FailedOrEmpty({ renderFailed }: { renderFailed: boolean }) {
  return (
    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-on-surface-variant">
      {renderFailed
        ? "The image didn't render. Your copy is ready below — regenerate to try the image again."
        : "No image on this post — copy only."}
    </div>
  );
}

function PagerButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant text-lg text-on-surface transition-colors duration-200 hover:bg-surface-container-high disabled:opacity-40"
    >
      {children}
    </button>
  );
}
