"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  fetchPlatforms,
  type PlatformStatus,
} from "../lib/content-pipeline-api";
import { useUpdateFormatDefault } from "../lib/use-format-mutations";

const PLATFORM_LABELS: Record<string, string> = {
  youtube_shorts: "YouTube Shorts",
  youtube_long: "YouTube",
  tiktok: "TikTok",
  instagram_reels: "Instagram",
  facebook_reels: "Facebook",
  linkedin: "LinkedIn",
};

// All publishable platforms in the order they appear in chip rows.
// Includes regular YouTube (horizontal) plus Shorts — pick per format defaults.
const ALL_PLATFORMS = [
  "youtube_long",
  "youtube_shorts",
  "tiktok",
  "instagram_reels",
  "facebook_reels",
  "linkedin",
] as const;

/**
 * Multi-select for `default_platforms` on a format. Renders a chip per
 * supported platform with three states:
 *   active+connected   filled secondary-container chip
 *   inactive+connected outlined chip with hover lift
 *   disabled            dimmed; not clickable; tooltip → /platforms
 *
 * Optimistic via useUpdateFormatDefault — clicks toggle the array
 * membership and the cache updates immediately.
 */
export function PlatformChips({
  format,
  selected,
}: {
  format: string;
  selected: string[];
}) {
  const { data: platforms = [] } = useQuery({
    queryKey: ["content-pipeline-platforms"],
    queryFn: fetchPlatforms,
    staleTime: 60 * 1000,
  });
  const updateMut = useUpdateFormatDefault();

  const platformByKey = new Map<string, PlatformStatus>(
    platforms.map((p) => [p.platform, p]),
  );

  const disconnectedActive = ALL_PLATFORMS.filter(
    (p) => !platformByKey.get(p)?.configured,
  );

  function toggle(platform: string) {
    const next = selected.includes(platform)
      ? selected.filter((p) => p !== platform)
      : [...selected, platform];
    updateMut.mutate({ format, patch: { default_platforms: next } });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {ALL_PLATFORMS.map((platform) => {
          const status = platformByKey.get(platform);
          const connected = !!status?.configured;
          const active = selected.includes(platform);
          return (
            <button
              key={platform}
              type="button"
              onClick={() => connected && toggle(platform)}
              disabled={!connected}
              title={
                connected
                  ? active
                    ? `Click to remove ${PLATFORM_LABELS[platform]}`
                    : `Click to add ${PLATFORM_LABELS[platform]}`
                  : `${PLATFORM_LABELS[platform]} not connected`
              }
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
                !connected
                  ? "bg-surface-container-low text-on-surface-variant border-outline-variant opacity-60 cursor-not-allowed"
                  : active
                    ? "bg-secondary-container text-on-secondary-container border-transparent"
                    : "bg-surface text-on-surface border-outline hover:bg-surface-container-low"
              }`}
            >
              {active && connected && (
                <span className="mr-1.5 text-[10px]" aria-hidden>
                  ✓
                </span>
              )}
              {PLATFORM_LABELS[platform] ?? platform}
            </button>
          );
        })}
      </div>
      {disconnectedActive.length > 0 && (
        <p className="text-[11px] text-on-surface-variant">
          {disconnectedActive.map((p) => PLATFORM_LABELS[p]).join(" / ")} not
          connected →{" "}
          <Link
            href="/admin/content-pipeline/platforms"
            className="text-primary hover:underline"
          >
            Platforms
          </Link>
        </p>
      )}
    </div>
  );
}
