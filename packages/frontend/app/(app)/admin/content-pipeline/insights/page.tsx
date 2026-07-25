"use client";
/**
 * Insights — a 30-day social-analytics dashboard: headline Reach / Engagement /
 * Net-followers cards with delta-vs-prior, a per-platform breakdown, and the
 * published-posts feed. Renders a graceful "no data yet" state until the feed
 * starts publishing (Phase 5) and the backend insights endpoints land.
 */
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { fetchInsightsOverview, fetchInsightsPosts } from "../lib/insights-api";
import { HeadlineCards } from "./HeadlineCards";
import { PlatformBreakdown } from "./PlatformBreakdown";
import { PublishedPostsList } from "./PublishedPostsList";

export default function InsightsPage() {
  const overviewQuery = useQuery({
    queryKey: ["cp-insights", "overview", 30],
    queryFn: () => fetchInsightsOverview(30),
    refetchInterval: 5 * 60_000,
  });
  const postsQuery = useQuery({
    queryKey: ["cp-insights", "posts", 30],
    queryFn: () => fetchInsightsPosts(30, 50),
    refetchInterval: 5 * 60_000,
  });

  const isLoading = overviewQuery.isLoading || postsQuery.isLoading;
  const isError = overviewQuery.isError || postsQuery.isError;
  const posts = postsQuery.data ?? [];
  const overview = overviewQuery.data;
  const isEmpty = !isLoading && !isError && posts.length === 0;

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <div className="mx-auto max-w-6xl space-y-6 p-8">
        <header>
          <h1 className="text-3xl font-semibold text-on-surface">Insights</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            How your published content performed — last 30 days vs the prior 30.
          </p>
        </header>

        {isError && (
          <div
            role="alert"
            className="rounded-xl border border-error/40 bg-error-container/40 px-5 py-4 text-sm text-on-surface"
          >
            Couldn&apos;t load insights. Refresh to retry.
          </div>
        )}

        {isLoading ? (
          <InsightsSkeleton />
        ) : isEmpty ? (
          <EmptyState />
        ) : (
          <>
            {overview && (
              <HeadlineCards
                totals={overview.totals}
                priorTotals={overview.priorTotals}
              />
            )}
            {overview && <PlatformBreakdown rows={overview.perPlatform} />}
            <PublishedPostsList posts={posts} />
          </>
        )}
      </div>
    </div>
  );
}

function InsightsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-xl bg-surface-container-low"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-surface-container-low" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-10 text-center">
      <h2 className="text-lg font-medium text-on-surface">
        No published posts yet
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-on-surface-variant">
        Connect your accounts and approve content — once posts publish, their
        reach and engagement show up here.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link
          href="/admin/content-pipeline/platforms"
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-on-primary transition-colors duration-200 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Connect accounts
        </Link>
        <Link
          href="/admin/content-pipeline/review"
          className="rounded-full border border-outline-variant bg-surface px-5 py-2.5 text-sm font-medium text-on-surface transition-colors duration-200 hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Review content
        </Link>
      </div>
    </div>
  );
}
