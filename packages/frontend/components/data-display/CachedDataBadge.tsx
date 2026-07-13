"use client";

import { useOnlineStatus } from "@/lib/hooks/use-online-status";
import { formatRelativeTimeShort } from "@/lib/format/relative-time";

const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

interface CachedDataBadgeProps {
  /** Epoch ms the data was last fetched — React Query's `dataUpdatedAt`, or
   * an equivalent timestamp tracked by a non-React-Query fetch loop.
   * `undefined` means nothing has loaded yet, so the badge stays silent. */
  dataUpdatedAt: number | undefined;
  className?: string;
}

/**
 * "data from X ago" chip. Silent by default — only appears once the cached
 * data is stale (>10min old) or the browser is offline, so it doesn't add
 * noise to a normal, freshly-loaded page.
 */
export function CachedDataBadge({
  dataUpdatedAt,
  className = "",
}: CachedDataBadgeProps) {
  const isOnline = useOnlineStatus();

  if (dataUpdatedAt === undefined) return null;

  const ageMs = Date.now() - dataUpdatedAt;
  const isStale = ageMs > STALE_THRESHOLD_MS;
  if (!isStale && isOnline) return null;

  return (
    <span
      className={`inline-flex items-center rounded-full bg-surface-container px-2.5 py-1 text-xs text-on-surface-variant ${className}`}
    >
      data from {formatRelativeTimeShort(ageMs, { zeroLabel: "moments ago" })}
    </span>
  );
}
