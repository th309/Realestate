"use client";
import Link from "next/link";
import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchReviewQueue, fetchRun } from "../lib/content-pipeline-api";
import { approvePost, skipPost } from "../lib/posts-api";
import {
  QueueNavigatorProvider,
  useQueueNavigator,
} from "../lib/queue-navigator";
import { KeybindingScopeProvider } from "../lib/keybinding-scope";
import { useToast } from "../lib/toast";
import { ReviewCard } from "./review-card";
import { PostReviewCard } from "./post-review-card";
import { isPostReviewItem, reviewItemTitle } from "./review-item";
import { QueueRibbon } from "./queue-ribbon";

export default function ReviewQueuePage() {
  const { data: queue = [], isLoading } = useQuery({
    queryKey: ["review-queue"],
    queryFn: fetchReviewQueue,
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return <ReviewSkeleton />;
  }

  if (queue.length === 0) {
    return <CaughtUpEmptyState />;
  }

  return (
    <KeybindingScopeProvider>
      <QueueNavigatorProvider items={queue}>
        <Suspense fallback={<ReviewSkeleton />}>
          <ReviewShell />
        </Suspense>
      </QueueNavigatorProvider>
    </KeybindingScopeProvider>
  );
}

function ReviewShell() {
  const nav = useQueueNavigator();
  const { items, currentId, jumpTo, prev, next, currentIndex, totalCount } =
    nav;
  const qc = useQueryClient();
  const toast = useToast();
  const searchParams = useSearchParams();
  const deepLinkRunId = searchParams.get("run");

  useEffect(() => {
    if (!deepLinkRunId) return;
    if (!items.some((i) => i.id === deepLinkRunId)) return;
    if (currentId === deepLinkRunId) return;
    jumpTo(deepLinkRunId);
  }, [deepLinkRunId, items, currentId, jumpTo]);

  const currentItem = items.find((i) => i.id === currentId);
  const isPost = currentItem ? isPostReviewItem(currentItem) : false;

  // Only runs have a detail document — post items render straight from the
  // queue row, so never fire a run fetch for them (a 404 otherwise).
  const { data: detail } = useQuery({
    queryKey: ["review-run", currentId],
    queryFn: () => (currentId ? fetchRun(currentId) : null),
    enabled: !!currentId && !isPost,
  });

  const afterPostAction = () => {
    nav.removeCurrent();
    qc.invalidateQueries({ queryKey: ["review-queue"] });
  };
  const approveMut = useMutation({
    mutationFn: (id: string) => approvePost(id),
    onSuccess: () => {
      toast.success("Post approved");
      afterPostAction();
    },
    onError: (e: Error) => toast.error(`Couldn't approve: ${e.message}`),
  });
  const skipMut = useMutation({
    mutationFn: (id: string) => skipPost(id),
    onSuccess: () => {
      toast.success("Post skipped");
      afterPostAction();
    },
    onError: (e: Error) => toast.error(`Couldn't skip: ${e.message}`),
  });

  const headerTitle = isPost
    ? reviewItemTitle(currentItem)
    : (detail?.run?.market_query ?? "Loading…");
  const headerFormat =
    !isPost && detail?.run?.format ? detail.run.format : null;

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      {/* Header strip — sticky, dense, navigator-aware */}
      <header className="sticky top-0 z-20 bg-surface-container-low border-b border-outline-variant">
        <div className="flex items-center gap-6 px-6 h-14">
          <Link
            href="/admin/content-pipeline"
            className="text-sm text-on-surface-variant hover:text-on-surface inline-flex items-center gap-1.5 transition-colors duration-200"
          >
            <span aria-hidden>←</span>
            <span>Dashboard</span>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-medium text-on-surface truncate">
              {headerTitle}
              {headerFormat ? (
                <span className="ml-2 text-on-surface-variant text-xs font-mono">
                  · {headerFormat}
                </span>
              ) : null}
            </h1>
          </div>
          <div className="text-xs font-mono text-on-surface-variant">
            <button
              type="button"
              onClick={prev}
              className="px-2 py-1 rounded hover:bg-on-surface/8 transition-colors duration-200 disabled:opacity-30"
              disabled={currentIndex <= 0}
              aria-label="Previous item"
            >
              ‹
            </button>
            <span className="mx-2">
              {currentIndex + 1} of {totalCount}
            </span>
            <button
              type="button"
              onClick={next}
              className="px-2 py-1 rounded hover:bg-on-surface/8 transition-colors duration-200 disabled:opacity-30"
              disabled={currentIndex >= totalCount - 1}
              aria-label="Next item"
            >
              ›
            </button>
          </div>
        </div>
        <QueueRibbon />
      </header>

      <main className="flex-1">
        {isPost && currentItem ? (
          <PostReviewCard
            item={currentItem}
            onApprove={() => approveMut.mutate(currentItem.id)}
            onSkip={() => skipMut.mutate(currentItem.id)}
            approving={approveMut.isPending}
            skipping={skipMut.isPending}
          />
        ) : detail ? (
          <ReviewCard run={detail} />
        ) : (
          <div className="p-12 text-center text-on-surface-variant text-sm">
            Loading run…
          </div>
        )}
      </main>
    </div>
  );
}

function ReviewSkeleton() {
  return (
    <div className="min-h-screen bg-surface p-8">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="h-14 bg-surface-container-low rounded-xl animate-pulse" />
        <div className="h-24 bg-surface-container-low rounded-xl animate-pulse" />
        <div className="grid grid-cols-[minmax(360px,40vw)_1fr] gap-6">
          <div className="aspect-[9/16] bg-surface-container-low rounded-xl animate-pulse" />
          <div className="space-y-3">
            <div className="h-8 bg-surface-container-low rounded-lg animate-pulse" />
            <div className="h-64 bg-surface-container-low rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

function CaughtUpEmptyState() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4" aria-hidden>
          ✓
        </div>
        <h1 className="text-2xl font-medium text-on-surface mb-2">
          All caught up
        </h1>
        <p className="text-sm text-on-surface-variant mb-6">
          Nothing is waiting for review right now. Posts, video scripts, and
          rendered videos all land here the moment they&apos;re ready for your
          eyes.
        </p>
        <Link
          href="/admin/content-pipeline"
          className="inline-block px-6 py-2.5 rounded-full bg-primary text-on-primary text-sm font-medium hover:bg-primary/90 transition-colors duration-200"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
