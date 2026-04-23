"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchPlatforms } from "../lib/content-pipeline-api";
import { PlatformRow } from "./platform-row";

const ALL_PLATFORMS = [
  "youtube_shorts",
  "tiktok",
  "instagram_reels",
  "facebook_reels",
  "linkedin",
  "youtube_long",
] as const;

export default function PlatformsPage() {
  const {
    data = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["content-pipeline-platforms"],
    queryFn: fetchPlatforms,
  });

  const byPlatform = new Map(data.map((p) => [p.platform, p]));

  return (
    <div className="p-8 max-w-3xl space-y-3">
      <h1 className="text-2xl font-semibold mb-4 text-on-surface">
        Platform Credentials
      </h1>

      {isLoading && (
        <div className="rounded-xl bg-surface-container-low p-6 text-sm text-outline">
          Loading platforms...
        </div>
      )}

      {ALL_PLATFORMS.map((platform) => {
        const registered = byPlatform.get(platform);
        return (
          <PlatformRow
            key={platform}
            platform={platform}
            configured={registered?.configured ?? false}
            supported={registered?.supported ?? false}
            accountLabel={registered?.accountLabel ?? null}
            connectedAt={registered?.connectedAt ?? null}
            lastPublishedAt={registered?.lastPublishedAt ?? null}
            onChange={() => refetch()}
          />
        );
      })}
    </div>
  );
}
