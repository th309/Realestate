"use client";
/**
 * "Needs attention" — posts that failed to publish.
 *
 * A failed post used to disappear: the planner only reads `scheduled`, and the
 * review queue only carries work that hasn't shipped yet, so a post that ran out
 * of publish attempts left no trace on any screen. This is the surface that
 * catches it.
 *
 * Structurally it's the review strip's sibling — same eyebrow, same count, same
 * card shape — in the warning tone the StatusChip already uses for "Needs
 * attention", so the two read as one system. It lists rows rather than a grid of
 * peek cards because a failure list is worked top to bottom, not browsed.
 */
import { MAX_PUBLISH_ATTEMPTS, type PlannerPost } from "../../lib/posts-api";
import { useFailedPosts } from "../../lib/use-failed-posts";
import { useReschedulePost, useSkipPost } from "../../lib/use-post-mutations";
import { FailedPostRow } from "./FailedPostRow";

const MAX_VISIBLE = 5;

export function NeedsAttentionCard() {
  const { data, isError, refetch } = useFailedPosts();

  const reschedule = useReschedulePost();
  const skip = useSkipPost();

  if (isError) {
    return (
      <section
        role="alert"
        className="flex items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning-container/40 px-5 py-4"
      >
        <p className="text-sm text-on-surface">
          Couldn&apos;t check for failed posts. Some may need your attention.
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="shrink-0 rounded-full border border-outline-variant bg-surface px-3.5 py-1.5 text-sm font-medium text-on-surface transition-colors duration-200 hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Retry
        </button>
      </section>
    );
  }

  const failed: PlannerPost[] = data?.posts ?? [];
  if (failed.length === 0) return null;

  const visible = failed.slice(0, MAX_VISIBLE);
  const overflow = failed.length - visible.length;
  const busy = reschedule.isPending || skip.isPending;

  return (
    <section
      aria-labelledby="needs-attention-heading"
      className="rounded-xl border border-warning/40 bg-warning-container/40 p-5"
    >
      <div className="mb-1 flex items-baseline gap-3">
        <h2
          id="needs-attention-heading"
          className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant"
        >
          Needs attention
        </h2>
        <span className="font-mono text-sm tabular-nums text-on-surface">
          {failed.length} failed to publish
        </span>
      </div>
      <p className="mb-3 text-xs text-on-surface-variant">
        Trying again puts a post back in the publish queue, which sweeps every
        minute. Skipping retires it for good.
      </p>

      <ul className="space-y-3">
        {visible.map((post) => (
          <FailedPostRow
            key={post.id}
            post={post}
            maxAttempts={MAX_PUBLISH_ATTEMPTS}
            busy={busy}
            onRetryNow={() =>
              reschedule.mutate({ id: post.id, iso: new Date().toISOString() })
            }
            onRetryAt={(iso) => reschedule.mutate({ id: post.id, iso })}
            onSkip={() => skip.mutate(post.id)}
          />
        ))}
      </ul>

      {overflow > 0 && (
        <p className="mt-3 text-sm text-on-surface-variant">
          + {overflow} more failed post{overflow === 1 ? "" : "s"}.
        </p>
      )}
    </section>
  );
}
