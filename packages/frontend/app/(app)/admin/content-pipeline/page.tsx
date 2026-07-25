"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDashboard, fetchReviewQueue } from "./lib/content-pipeline-api";
import { API_URL } from "@/lib/data/fetchers/base";
import type { QueueItem } from "./lib/queue-navigator";
import {
  StudioGreeting,
  type InFlightCounts,
} from "./components/home/StudioGreeting";
import { ReviewStrip } from "./components/home/ReviewStrip";
import { TaskGroup } from "./components/home/TaskGroup";
import { TASK_GROUPS } from "./components/home/taskCatalog";
import { RecentWorkRail } from "./components/home/RecentWorkRail";
import { ManageToolsNav } from "./components/home/ManageToolsNav";
import { CostCapBanner } from "./components/home/CostCapBanner";
import { pipelineStateToStatusChip } from "./components/home/StatusChip";

export default function ContentPipelineHomePage() {
  const dashboard = useQuery({
    queryKey: ["content-pipeline-dashboard", "home"],
    queryFn: () => fetchDashboard(),
    refetchInterval: 60_000,
  });

  const reviewQueue = useQuery({
    queryKey: ["review-queue"],
    queryFn: fetchReviewQueue,
    refetchInterval: 30_000,
  });

  // Memoize on the stable React Query data so the counts useMemo below (and
  // the child props) don't churn a fresh array reference every render.
  const recentRuns = useMemo(
    () => dashboard.data?.recentRuns ?? [],
    [dashboard.data],
  );
  const reviewItems = useMemo(
    () => (reviewQueue.data ?? []) as QueueItem[],
    [reviewQueue.data],
  );

  const counts = useMemo<InFlightCounts>(() => {
    const next: InFlightCounts = {
      generating: 0,
      review: reviewItems.length,
      published: 0,
      attention: 0,
    };
    for (const run of recentRuns) {
      const { tone } = pipelineStateToStatusChip(run.status);
      if (tone === "generating") next.generating += 1;
      else if (tone === "published") next.published += 1;
      else if (tone === "attention") next.attention += 1;
    }
    return next;
  }, [recentRuns, reviewItems]);

  if (dashboard.isLoading) {
    return <HomeSkeleton />;
  }

  if (dashboard.isError) {
    return <HomeError error={dashboard.error} />;
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <div className="mx-auto max-w-6xl space-y-10 p-8">
        <StudioGreeting counts={counts} />

        <CostCapBanner status={dashboard.data?.costCapStatus} />

        <ReviewStrip items={reviewItems} />

        <div className="space-y-8">
          {TASK_GROUPS.map((group) => (
            <TaskGroup key={group.id} group={group} />
          ))}
        </div>

        <RecentWorkRail runs={recentRuns} />

        <ManageToolsNav />
      </div>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="min-h-screen bg-surface p-8">
      <div className="mx-auto max-w-6xl space-y-10">
        <div className="space-y-3">
          <div className="h-10 w-64 animate-pulse rounded-lg bg-surface-container-low" />
          <div className="h-6 w-80 animate-pulse rounded-lg bg-surface-container-low" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl bg-surface-container-low"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function HomeError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "";
  const looksLikeNetwork =
    message === "Failed to fetch" || message.includes("Failed to fetch");
  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="min-h-screen space-y-3 bg-surface p-8" role="alert">
      <p className="text-sm font-medium text-error">
        Couldn&apos;t load the studio{message ? `: ${message}` : "."}
      </p>
      {looksLikeNetwork && isDev && (
        <p className="max-w-xl text-sm leading-relaxed text-on-surface-variant">
          This page calls the Nest API at{" "}
          <code className="rounded bg-surface-container-low px-1 py-0.5 font-mono text-xs">
            {API_URL}
          </code>
          . Start the backend (for example{" "}
          <code className="font-mono text-xs">npm run dev:backend</code>), or
          set <code className="font-mono text-xs">NEXT_PUBLIC_API_URL</code> in{" "}
          <code className="font-mono text-xs">
            packages/frontend/.env.local
          </code>
          .
        </p>
      )}
      {looksLikeNetwork && !isDev && (
        <p className="max-w-xl text-sm leading-relaxed text-on-surface-variant">
          Set <code className="font-mono text-xs">NEXT_PUBLIC_API_URL</code> on
          the frontend deployment to your API origin, then redeploy.
        </p>
      )}
    </div>
  );
}
