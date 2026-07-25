"use client";

import type { GeneratePostPlatform } from "../lib/posts-api";
import { CREATE_POST_PLATFORMS } from "./create-post-machine";
import { PlatformGlyph } from "../planner/platform-glyph";

const PLATFORM_LABELS: Record<GeneratePostPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  x: "X",
};

/**
 * Step 3: pick the one platform to render for. The generate endpoint takes a
 * single platform, so this is a single-select (radio semantics) — choosing one
 * replaces the last, and Generate stays disabled until something is chosen.
 */
export function PlatformStep({
  selected,
  onSelect,
  onBack,
  onGenerate,
  error,
}: {
  selected?: GeneratePostPlatform;
  onSelect: (platform: GeneratePostPlatform) => void;
  onBack: () => void;
  onGenerate: () => void;
  error: string | null;
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-sm font-medium text-on-surface">
          Where&apos;s this going?
        </p>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {CREATE_POST_PLATFORMS.map((platform) => {
            const active = selected === platform;
            return (
              <button
                key={platform}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onSelect(platform)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  active
                    ? "border-transparent bg-secondary-container text-on-secondary-container"
                    : "border-outline bg-surface text-on-surface hover:bg-surface-container-low"
                }`}
              >
                <PlatformGlyph platform={platform} />
                <span>{PLATFORM_LABELS[platform]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-error/40 bg-error-container/40 px-4 py-3 text-sm text-on-surface"
        >
          Couldn&apos;t generate this post: {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full px-5 py-2.5 text-sm font-semibold text-on-surface transition-colors duration-200 hover:bg-surface-container-high"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onGenerate}
          disabled={!selected}
          className="rounded-full bg-primary px-8 py-2.5 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary/90 disabled:opacity-50"
        >
          {error ? "Try again" : "Generate"}
        </button>
      </div>
    </div>
  );
}
