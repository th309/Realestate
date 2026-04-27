"use client";

import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  fetchDashboard,
  fetchAssetSignedUrl,
  type RunSummary,
} from "./lib/content-pipeline-api";
import { STATE_LABELS } from "./lib/state-labels";
import type { PipelineStatus } from "./lib/content-pipeline-api";
import { RunCardOverlay } from "./components/run-card-overlay";
import { useCancelRun, useDeleteRun } from "./lib/use-run-mutations";
import { API_URL } from "@/lib/data/fetchers/base";

function DashboardContent() {
  const searchParams = useSearchParams();
  const batchId = searchParams.get("batch") ?? undefined;

  /** Single mutation scope for the whole grid — avoids N× useDeleteRun/useCancelRun per card firing duplicate onSuccess/onError. */
  const deleteMut = useDeleteRun();
  const cancelMut = useCancelRun();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["content-pipeline-dashboard", batchId ?? "all"],
    queryFn: () => fetchDashboard({ batchId }),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="p-8 text-on-surface-variant text-sm">Loading...</div>
    );
  }
  if (isError) {
    const msg = error instanceof Error ? error.message : "";
    const looksLikeNetwork =
      msg === "Failed to fetch" || msg.includes("Failed to fetch");
    const isDev = process.env.NODE_ENV === "development";
    return (
      <div className="min-h-screen bg-surface p-8 space-y-3" role="alert">
        <p className="text-error text-sm font-medium">
          Failed to load dashboard{msg ? `: ${msg}` : "."}
        </p>
        {isDev && looksLikeNetwork && (
          <p className="text-on-surface-variant text-sm max-w-xl leading-relaxed">
            This page calls the Nest API at{" "}
            <code className="rounded bg-surface-container-low px-1 py-0.5 font-mono text-xs">
              {API_URL}
            </code>
            . Start the backend (for example{" "}
            <code className="font-mono text-xs">npm run dev:backend</code>
            ), or set{" "}
            <code className="font-mono text-xs">NEXT_PUBLIC_API_URL</code> in{" "}
            <code className="font-mono text-xs">packages/frontend/.env.local</code>
            .
          </p>
        )}
        {!isDev && looksLikeNetwork && (
          <p className="text-on-surface-variant text-sm max-w-xl leading-relaxed">
            Set{" "}
            <code className="font-mono text-xs">NEXT_PUBLIC_API_URL</code> on the
            frontend deployment to your API origin (same value as production), then
            redeploy.
          </p>
        )}
      </div>
    );
  }
  if (!data) {
    return <div className="p-8 text-on-surface-variant text-sm">No data.</div>;
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <div className="p-8 space-y-8">
        <h1 className="text-3xl font-semibold text-on-surface">This Week</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Published" value={data.thisWeek.published} />
          <Stat label="In Review" value={data.thisWeek.inReview} />
          <Stat label="Attributed Signups" value={data.thisWeek.signups} />
          <Stat
            label="Revenue MRR"
            value={`$${data.thisWeek.revenueUsd.toFixed(0)}`}
          />
        </div>

        {data.reviewQueueCount > 0 && (
          <div className="bg-primary-container text-on-primary-container rounded-xl p-6 flex items-center justify-between">
            <div className="font-medium">
              {data.reviewQueueCount} run
              {data.reviewQueueCount === 1 ? "" : "s"} waiting on you
            </div>
            <Link
              href="/admin/content-pipeline/review"
              className="bg-primary text-on-primary rounded-full px-6 py-2 font-semibold hover:bg-primary/90 transition-colors duration-200"
            >
              Review now
            </Link>
          </div>
        )}

        <div>
          <h2 className="text-xl font-semibold mb-4 text-on-surface">
            Last 7 days
          </h2>
          {batchId && (
            <div className="rounded-xl bg-secondary-container/40 px-4 py-3 mb-4 text-sm flex items-center gap-3">
              <span>
                Showing batch{" "}
                <span className="font-mono text-xs">{batchId}</span>
                {" — "}
                <strong>{data.recentRuns.length}</strong> runs
              </span>
              <a
                href="/admin/content-pipeline"
                className="ml-auto text-primary text-xs hover:underline"
              >
                Show all
              </a>
            </div>
          )}
          {data.recentRuns.length === 0 ? (
            <div className="rounded-xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
              No runs yet. Start one with the Create a run button.
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {data.recentRuns.map((run) => (
                <RunCard
                  key={run.id}
                  run={run}
                  executeDelete={() => deleteMut.mutateAsync(run.id)}
                  executeCancel={() =>
                    cancelMut.mutateAsync({
                      id: run.id,
                      reason: "user_cancelled",
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-8 right-8 z-10">
        <Link
          href="/admin/content-pipeline/new"
          className="bg-primary text-on-primary rounded-full px-8 py-4 font-semibold shadow-lg hover:bg-primary/90 transition-colors duration-200 inline-flex items-center gap-2"
        >
          <span className="text-xl leading-none">+</span>
          <span>Create a run</span>
        </Link>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface p-8 text-on-surface-variant text-sm">
          Loading...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-surface-container-low p-6 shadow-sm">
      <div className="text-sm text-on-surface-variant mb-1">{label}</div>
      <div className="text-3xl font-mono font-bold text-on-surface">
        {value}
      </div>
    </div>
  );
}

function RunCard({
  run,
  executeDelete,
  executeCancel,
}: {
  run: RunSummary;
  executeDelete: () => Promise<unknown>;
  executeCancel: () => Promise<unknown>;
}) {
  const { data: videoData } = useQuery({
    queryKey: ["content-pipeline-asset-url", run.id, "video_master"],
    queryFn: () => fetchAssetSignedUrl(run.id, "video_master"),
    enabled: Boolean(run.has_video),
    staleTime: 50 * 60 * 1000,
  });

  const runHref = `/admin/content-pipeline/runs/${run.id}`;

  return (
    <div className="group relative w-[240px] rounded-xl bg-surface-container-low p-3 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="relative aspect-[9/16] rounded-lg bg-gradient-to-br from-primary-container to-surface-container-high mb-2 overflow-hidden flex items-center justify-center">
        {/* Link only covers the preview — overlay actions are siblings, not nested in <a> */}
        <Link
          href={runHref}
          aria-label={`View run: ${run.market_query}`}
          className="absolute inset-0 z-0 flex items-center justify-center"
        >
          {videoData?.url ? (
            <video
              src={videoData.url}
              muted
              loop
              playsInline
              preload="metadata"
              onMouseEnter={(e) => {
                const v = e.currentTarget;
                v.play().catch(() => {});
              }}
              onMouseLeave={(e) => {
                const v = e.currentTarget;
                v.pause();
                v.currentTime = 0;
              }}
              className="pointer-events-none h-full w-full object-cover"
            />
          ) : run.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={run.thumbnail_url}
              alt=""
              className="pointer-events-none h-full w-full object-cover"
            />
          ) : (
            <div className="text-on-primary-container pointer-events-none text-xs font-semibold text-center px-2">
              {run.market_query.split(",")[0]}
            </div>
          )}
        </Link>
        <RunCardOverlay
          runId={run.id}
          status={run.status as PipelineStatus}
          marketQuery={run.market_query}
          executeDelete={executeDelete}
          executeCancel={executeCancel}
        />
      </div>
      <Link href={runHref} className="block">
        <div className="text-xs font-medium truncate text-on-surface">
          {run.market_query}
        </div>
        <div className="text-xs text-on-surface-variant truncate">
          {STATE_LABELS[run.status as PipelineStatus] ?? run.status}
        </div>
      </Link>
    </div>
  );
}
