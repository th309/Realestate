"use client";

import { useState } from "react";
import Link from "next/link";
import type { QueueItem } from "../lib/queue-navigator";
import { PlatformGlyph } from "../planner/platform-glyph";
import {
  StatusChip,
  postStatusToStatusChip,
} from "../components/home/StatusChip";
import {
  normalizeVideoScript,
  buildMakeVideoHref,
} from "../video-scripts/video-script-copy";
import { isVideoScriptItem, prettyPostType } from "./review-item";

/**
 * Review-queue detail for a POST item (image/carousel or video_script). Renders
 * from the queue item's own copy + signed media — no run detail fetch. Image
 * posts are mockup-first (approve/skip); video scripts are script-forward with a
 * "Make this video" handoff instead of approve (they're suggestions, not
 * publishable posts).
 */
export function PostReviewCard({
  item,
  onApprove,
  onSkip,
  approving = false,
  skipping = false,
}: {
  item: QueueItem;
  onApprove: () => void;
  onSkip: () => void;
  approving?: boolean;
  skipping?: boolean;
}) {
  if (isVideoScriptItem(item)) {
    return <ScriptReview item={item} onSkip={onSkip} skipping={skipping} />;
  }
  return (
    <MockupReview
      item={item}
      onApprove={onApprove}
      onSkip={onSkip}
      approving={approving}
      skipping={skipping}
    />
  );
}

function ChipRow({ item }: { item: QueueItem }) {
  const chip = postStatusToStatusChip(item.status);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {item.platform && <PlatformGlyph platform={item.platform} />}
      <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] font-medium text-on-surface-variant">
        {prettyPostType(item.post_type)}
      </span>
      <StatusChip tone={chip.tone} label={chip.label} />
    </div>
  );
}

function MockupReview({
  item,
  onApprove,
  onSkip,
  approving,
  skipping,
}: {
  item: QueueItem;
  onApprove: () => void;
  onSkip: () => void;
  approving: boolean;
  skipping: boolean;
}) {
  const urls = item.mediaUrls ?? [];
  const [slide, setSlide] = useState(0);
  const current = urls[Math.min(slide, urls.length - 1)];
  const copy = item.copy ?? {};
  const hashtags = copy.hashtags ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <ChipRow item={item} />

      <div className="mx-auto w-full max-w-sm">
        <div
          className="relative overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-high"
          style={{ aspectRatio: "1080 / 1350" }}
        >
          {current ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current}
              alt=""
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-on-surface-variant">
              No image on this post yet.
            </div>
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
        <button
          type="button"
          onClick={onApprove}
          disabled={approving}
          className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary/90 disabled:opacity-60"
        >
          {approving ? "Approving…" : "Approve"}
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={skipping}
          className="rounded-full border border-outline-variant px-6 py-2.5 text-sm font-semibold text-on-surface transition-colors duration-200 hover:bg-surface-container-high disabled:opacity-60"
        >
          {skipping ? "Skipping…" : "Skip"}
        </button>
      </div>
    </div>
  );
}

function ScriptReview({
  item,
  onSkip,
  skipping,
}: {
  item: QueueItem;
  onSkip: () => void;
  skipping: boolean;
}) {
  const script = normalizeVideoScript(item);

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-6">
      <ChipRow item={item} />
      <h2 className="text-xl font-semibold text-on-surface">{script.title}</h2>

      <div className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-low p-5">
        {script.hook && <ScriptBlock label="Hook" text={script.hook} />}
        {script.body && <ScriptBlock label="Body" text={script.body} />}
        {script.close && <ScriptBlock label="Close" text={script.close} />}
        {script.sceneDirection && (
          <ScriptBlock label="Scene direction" text={script.sceneDirection} />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={buildMakeVideoHref(item)}
          className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary/90"
        >
          Make this video
        </Link>
        <button
          type="button"
          onClick={onSkip}
          disabled={skipping}
          className="rounded-full border border-outline-variant px-6 py-2.5 text-sm font-semibold text-on-surface transition-colors duration-200 hover:bg-surface-container-high disabled:opacity-60"
        >
          {skipping ? "Skipping…" : "Skip"}
        </button>
        <Link
          href="/admin/content-pipeline/video-scripts"
          className="rounded-full px-4 py-2.5 text-sm font-semibold text-primary transition-colors duration-200 hover:bg-primary/10"
        >
          All video ideas
        </Link>
      </div>
    </div>
  );
}

function ScriptBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
        {label}
      </p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-on-surface">
        {text}
      </p>
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
