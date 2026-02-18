/**
 * Recommendations API — re-exports from the unified data layer.
 *
 * All data fetching goes through @/lib/data as required by CLAUDE.md.
 * This file exists for backwards compatibility with existing imports.
 */
export { fetchMarketsToWatch, type MarketRecommendation } from '@/lib/data';
