/**
 * Single source of truth for the "12m ago" / "3h ago" / "2d ago" short
 * relative-time convention. Previously duplicated across CachedDataBadge,
 * AlertItem, and PipelineRunsCard with slightly different call signatures —
 * each call site now passes its own `zeroLabel` (or omits it) to reproduce
 * its prior behavior exactly rather than changing what renders.
 */

export interface RelativeTimeShortOptions {
  /**
   * Label shown when `ageMs` is below `zeroThresholdMs` (e.g. "Just now",
   * "moments ago"). Omit to fall through to "0m ago" for very recent times.
   */
  zeroLabel?: string;
  /** Age in ms below which `zeroLabel` applies. Default: 60_000 (1 minute). */
  zeroThresholdMs?: number;
}

export function formatRelativeTimeShort(
  ageMs: number,
  { zeroLabel, zeroThresholdMs = 60_000 }: RelativeTimeShortOptions = {},
): string {
  if (zeroLabel !== undefined && ageMs < zeroThresholdMs) return zeroLabel;
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
