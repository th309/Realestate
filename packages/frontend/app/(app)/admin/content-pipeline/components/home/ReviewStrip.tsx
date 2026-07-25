/**
 * "Ready for review" strip — the one place on the home that pulls for action.
 * Shows up to three runs waiting on the operator plus a link into the full
 * queue. Rendered only when something is actually waiting (an empty strip is
 * noise), so the caller passes a non-empty list.
 */
import Link from "next/link";
import type { QueueItem } from "../../lib/queue-navigator";
import { ReviewPeekCard } from "./ReviewPeekCard";

const MAX_VISIBLE = 3;

export function ReviewStrip({ items }: { items: QueueItem[] }) {
  if (items.length === 0) return null;

  const visible = items.slice(0, MAX_VISIBLE);
  const overflow = items.length - visible.length;

  return (
    <section
      aria-labelledby="review-strip-heading"
      className="rounded-xl border border-primary/30 bg-primary-container/40 p-5"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2
            id="review-strip-heading"
            className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant"
          >
            Ready for review
          </h2>
          <span className="font-mono text-sm tabular-nums text-on-surface">
            {items.length} waiting
          </span>
        </div>
        <Link
          href="/admin/content-pipeline/review"
          className="rounded-full px-3 py-1.5 text-sm font-medium text-primary transition-colors duration-200 hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Review all
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((item) => (
          <ReviewPeekCard key={item.id} item={item} />
        ))}
      </div>

      {overflow > 0 && (
        <p className="mt-3 text-sm text-on-surface-variant">
          + {overflow} more in the queue.
        </p>
      )}
    </section>
  );
}
