"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { fetchDashboard } from "./lib/content-pipeline-api";
import { STATE_LABELS } from "./lib/state-labels";
import type { PipelineStatus } from "./lib/content-pipeline-api";

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["content-pipeline-dashboard"],
    queryFn: fetchDashboard,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="p-8 text-on-surface-variant text-sm">Loading...</div>
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
              {data.reviewQueueCount} video
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
          {data.recentRuns.length === 0 ? (
            <div className="rounded-xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
              No runs yet. Start one with the Create a run button.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {data.recentRuns.map((run) => (
                <Link
                  key={run.id}
                  href={`/admin/content-pipeline/runs/${run.id}`}
                  className="block rounded-xl bg-surface-container-low p-3 shadow-sm hover:shadow-md transition-shadow duration-200"
                >
                  <div className="aspect-[9/16] rounded-lg bg-surface-container mb-2 overflow-hidden">
                    {run.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={run.thumbnail_url}
                        alt={run.market_query}
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="text-xs font-medium truncate text-on-surface">
                    {run.market_query}
                  </div>
                  <div className="text-xs text-on-surface-variant truncate">
                    {STATE_LABELS[run.status as PipelineStatus] ?? run.status}
                  </div>
                </Link>
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
