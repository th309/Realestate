"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchPlatforms } from "../lib/content-pipeline-api";
import { PlatformRow } from "./platform-row";

/**
 * Admin page: Platform Credentials.
 * Lists every platform publisher registered on the backend and exposes
 * a Connect button per row. In P1 only `youtube_shorts` has a working
 * OAuth handshake; other rows surface "Not connected" with no action.
 */
export default function PlatformsPage() {
  const {
    data = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["content-pipeline-platforms"],
    queryFn: fetchPlatforms,
  });

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

      {!isLoading && data.length === 0 && (
        <div className="rounded-xl bg-surface-container-low p-6 text-sm text-outline">
          No publishers registered yet.
        </div>
      )}

      {data.map((p) => (
        <PlatformRow
          key={p.platform}
          platform={p.platform}
          configured={p.configured}
          lastPublishedAt={p.lastPublishedAt}
          onChange={() => refetch()}
        />
      ))}
    </div>
  );
}
