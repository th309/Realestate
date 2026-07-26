"use client";
import type { PlatformStatus } from "../lib/content-pipeline-api";

const PLATFORM_LABELS: Record<string, string> = {
  youtube_shorts: "YouTube Shorts",
  youtube_long: "YouTube (regular)",
  tiktok: "TikTok",
  instagram_reels: "Instagram",
  facebook_reels: "Facebook",
  linkedin: "LinkedIn",
};

/** Short-form destinations (9x16, etc.). */
const SHORT_FORM_PLATFORMS = [
  "youtube_shorts",
  "tiktok",
  "instagram_reels",
  "facebook_reels",
  "linkedin",
] as const;

/** Long-form Deep Dive: 16x9 → standard YouTube upload + optional LinkedIn. */
const LONG_FORM_PLATFORMS = ["youtube_long", "linkedin"] as const;

export function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform;
}

/**
 * Ensures long-form runs target regular YouTube (not Shorts) and allowed
 * platforms only. Migrates mistaken Shorts defaults away.
 */
export function sanitizeSelectedForFormat(
  format: string,
  platforms: string[],
): string[] {
  if (format !== "long_form_deep_dive") return platforms;
  const allowed = new Set<string>(LONG_FORM_PLATFORMS);
  let next = platforms.filter((p) => allowed.has(p));
  if (!next.includes("youtube_long")) {
    next = ["youtube_long", ...next];
  }
  return Array.from(new Set(next));
}

function platformsForConfirmFormat(format: string): readonly string[] {
  if (format === "long_form_deep_dive") return LONG_FORM_PLATFORMS;
  return SHORT_FORM_PLATFORMS;
}

export function PlatformChips({
  format,
  batchSize,
  selected,
  defaultPlatforms,
  operatorPicked,
  platformByKey,
  onToggle,
}: {
  format: string;
  batchSize: number;
  selected: string[];
  defaultPlatforms: string[];
  operatorPicked: boolean;
  platformByKey: Map<string, PlatformStatus>;
  onToggle: (p: string) => void;
}) {
  const platformsShown = platformsForConfirmFormat(format);
  const disconnectedSelected = selected.filter(
    (p) => !platformByKey.get(p)?.configured,
  );
  return (
    <fieldset className="mt-6">
      <legend className="text-xs text-outline mb-2 uppercase tracking-wide">
        Publish {batchSize > 1 ? `all ${batchSize} runs` : ""} to
        {!operatorPicked && (
          <span className="ml-2 normal-case text-[10px] opacity-70">
            (using format defaults — click to override)
          </span>
        )}
      </legend>
      {format === "long_form_deep_dive" && (
        <p className="text-[11px] text-on-surface-variant mb-2">
          Long-form uploads use standard YouTube videos (same Google connection
          as Shorts under Platforms).
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {platformsShown.map((p) => {
          const status = platformByKey.get(p);
          const connected = !!status?.configured;
          const active = selected.includes(p);
          const isDefault = defaultPlatforms.includes(p);
          return (
            <button
              key={p}
              type="button"
              onClick={() => connected && onToggle(p)}
              disabled={!connected}
              title={
                connected
                  ? active
                    ? `Click to remove ${platformLabel(p)}`
                    : `Click to add ${platformLabel(p)}`
                  : `${platformLabel(p)} not connected — set up on /platforms first`
              }
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 inline-flex items-center gap-1.5 ${
                !connected
                  ? "bg-surface-container-low text-on-surface-variant border-outline-variant opacity-60 cursor-not-allowed"
                  : active
                    ? "bg-secondary-container text-on-secondary-container border-transparent"
                    : "bg-surface text-on-surface border-outline hover:bg-surface-container-low"
              }`}
            >
              {active && connected && (
                <span className="text-[10px]" aria-hidden>
                  ✓
                </span>
              )}
              <span>{platformLabel(p)}</span>
              {isDefault && !operatorPicked && (
                <span className="text-[9px] opacity-60 font-mono">default</span>
              )}
            </button>
          );
        })}
      </div>
      {disconnectedSelected.length > 0 && (
        <p className="text-[11px] text-error mt-2">
          {disconnectedSelected.map(platformLabel).join(", ")} not connected —
          those publishes will fail. Connect on{" "}
          <a
            href="/admin/content-pipeline/platforms"
            className="text-primary underline"
          >
            Platforms
          </a>{" "}
          or remove them from this run.
        </p>
      )}
    </fieldset>
  );
}
