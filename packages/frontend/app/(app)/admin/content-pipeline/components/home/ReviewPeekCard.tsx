/**
 * A single "waiting on you" card in the review strip. Links straight into the
 * review queue focused on this run (the queue page reads `?run=`). Uses the
 * shared StatusChip so no raw state name ever shows.
 */
import Link from "next/link";
import type { QueueItem } from "../../lib/queue-navigator";
import { FORMAT_META } from "../../lib/format-previews";
import { StatusChip } from "./StatusChip";

export function ReviewPeekCard({ item }: { item: QueueItem }) {
  const marketLabel = item.market_query?.trim() || "Untitled run";
  const formatLabel = item.format
    ? (FORMAT_META[item.format]?.displayName ?? item.format)
    : null;

  return (
    <Link
      href={`/admin/content-pipeline/review?run=${item.id}`}
      className="group flex items-center gap-3 rounded-xl border border-outline-variant bg-surface p-3 transition-shadow duration-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-primary-container to-surface-container-high">
        {item.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnail_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-on-surface">
          {marketLabel}
        </div>
        {formatLabel && (
          <div className="mt-0.5 truncate text-xs text-on-surface-variant">
            {formatLabel}
          </div>
        )}
        <div className="mt-1.5">
          <StatusChip status={item.status ?? "ready_for_review"} />
        </div>
      </div>
    </Link>
  );
}
