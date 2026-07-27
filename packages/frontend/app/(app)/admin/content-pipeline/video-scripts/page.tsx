"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPosts, generatePost, skipPost } from "../lib/posts-api";
import { useToast } from "../lib/toast";
import { VideoScriptCard } from "./VideoScriptCard";

const VIDEO_SCRIPTS_KEY = ["cp-posts", "video-scripts"] as const;

/**
 * Video Scripts — a suggestions surface (not a publish queue). Shows
 * video_script drafts from the feed as text-forward cards; the key action turns
 * one into a real video via the run wizard. Video scripts never schedule/publish
 * as posts, so this page is deliberately separate from the planner and review
 * feed.
 */
export default function VideoScriptsPage() {
  const qc = useQueryClient();
  const toast = useToast();

  const query = useQuery({
    queryKey: VIDEO_SCRIPTS_KEY,
    // The posts list has no post_type filter, so pull pending drafts and keep
    // the video_script ones client-side.
    queryFn: () => fetchPosts({ status: "pending_review", limit: 200 }),
    refetchInterval: 60_000,
  });

  const scripts = useMemo(
    () =>
      (query.data?.posts ?? []).filter((p) => p.post_type === "video_script"),
    [query.data],
  );

  const suggestMut = useMutation({
    mutationFn: () => generatePost({ type: "video_script" }),
    onSuccess: () => {
      toast.success("New video idea added");
      qc.invalidateQueries({ queryKey: VIDEO_SCRIPTS_KEY });
    },
    onError: (e: Error) => toast.error(`Couldn't suggest one: ${e.message}`),
  });

  const skipMut = useMutation({
    mutationFn: (id: string) => skipPost(id),
    onSuccess: () => {
      toast.success("Script skipped");
      qc.invalidateQueries({ queryKey: VIDEO_SCRIPTS_KEY });
    },
    onError: (e: Error) => toast.error(`Couldn't skip: ${e.message}`),
  });

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <div className="mx-auto max-w-6xl space-y-6 p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link
              href="/admin/content-pipeline"
              className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant transition-colors duration-200 hover:text-on-surface"
            >
              <span aria-hidden>←</span>
              <span>Studio</span>
            </Link>
            <h1 className="mt-2 text-2xl font-semibold">Video scripts</h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              Fresh video ideas grounded in live market data. Read one, or hand
              it to the video maker.
            </p>
          </div>
          <SuggestButton
            onClick={() => suggestMut.mutate()}
            pending={suggestMut.isPending}
          />
        </div>

        {query.isLoading ? (
          <GridSkeleton />
        ) : query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : scripts.length === 0 ? (
          <EmptyState
            onSuggest={() => suggestMut.mutate()}
            suggesting={suggestMut.isPending}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {scripts.map((post) => (
              <VideoScriptCard
                key={post.id}
                post={post}
                onSkip={(id) => skipMut.mutate(id)}
                skipping={skipMut.isPending && skipMut.variables === post.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SuggestButton({
  onClick,
  pending,
}: {
  onClick: () => void;
  pending: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary/90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {pending ? "Writing…" : "Suggest one now"}
    </button>
  );
}

function EmptyState({
  onSuggest,
  suggesting,
}: {
  onSuggest: () => void;
  suggesting: boolean;
}) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-10 text-center">
      <h2 className="text-lg font-medium text-on-surface">
        Fresh video ideas appear here automatically
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-on-surface-variant">
        The feed drafts scripts from markets that are moving. Want one right
        now?
      </p>
      <button
        type="button"
        onClick={onSuggest}
        disabled={suggesting}
        className="mt-5 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-on-primary transition-colors duration-200 hover:bg-primary/90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {suggesting ? "Writing…" : "Suggest one now"}
      </button>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded-xl border border-error/40 bg-error-container/40 px-5 py-4"
    >
      <p className="text-sm text-on-surface">
        Couldn&apos;t load video scripts.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 rounded-full border border-outline-variant bg-surface px-3.5 py-1.5 text-sm font-medium text-on-surface transition-colors duration-200 hover:bg-surface-container-high"
      >
        Retry
      </button>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-48 animate-pulse rounded-xl bg-surface-container-low"
        />
      ))}
    </div>
  );
}
