"use client";

import { useOnlineStatus } from "@/lib/hooks/use-online-status";

const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

/** "12m ago" / "3h ago" / "2d ago" — matches the m/h/d convention used
 * elsewhere in the app (e.g. admin AlertItem, PipelineRunsCard). */
function formatAge(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "moments ago";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

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
      data from {formatAge(ageMs)}
    </span>
  );
}
