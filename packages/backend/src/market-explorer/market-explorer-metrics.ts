/**
 * The 8 timeseries metrics fetched for every scope request. Mirrors the
 * frontend's FETCHED_METRICS
 * (packages/frontend/app/(app)/market/explorer/lib/explorer-config.ts) —
 * kept as a duplicated literal rather than a shared package, matching this
 * repo's existing pattern for small cross-stack config.
 */
export const FETCHED_METRICS = [
  'propertyiq_score',
  'home_value',
  'rent_index',
  'for_sale_inventory',
  'days_on_market',
  'hotness_score',
  'new_listings',
  'home_sales',
] as const;
export type FetchedMetric = (typeof FETCHED_METRICS)[number];
