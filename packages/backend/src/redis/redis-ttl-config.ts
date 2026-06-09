/**
 * Redis TTL Configuration
 *
 * TTL strategy by domain and tool name (in seconds).
 */

export const TTL_MAP: Record<string, number> = {
  // ── Domain-level TTLs ──
  metric_snapshot: 21600, // 6 hours
  time_series: 21600, // 6 hours
  scores: 21600, // 6 hours
  geojson: 86400, // 24 hours
  market_lists: 43200, // 12 hours
  benchmarks: 21600, // 6 hours
  entitlements: 1800, // 30 minutes (per-tier)
  watchlist: 300, // 5 minutes
  recommendations: 3600, // 1 hour

  // Fallback for any domain not listed above.
  default: 1800, // 30 minutes
};
