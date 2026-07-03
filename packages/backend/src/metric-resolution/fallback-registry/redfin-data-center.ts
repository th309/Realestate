import { MetricFallbackChain } from '../metric-resolution.types';

/**
 * Redfin Data Center DISPLAY metrics (redfin_dc_* tables). Each is a
 * single-source chain — these signals exist only in Redfin's Data Center, so
 * there is no fallback. All percent columns are already 0-100 form (e.g. 42.37),
 * so no transform; the frontend renders them with `format: 'percent_abs'`.
 *
 * These are display/report metrics ONLY — Redfin never feeds the PropertyIQ
 * score (see scoring/formula-weights PROPERTYIQ_FORMULA_METRICS).
 *
 * metro note: the redfin_dc metro tables store split-CBSA metros (e.g. LA +
 * Anaheim -> 31080) as two division rows sharing one region_id. The single-row
 * fetch picks one division for those ~1-2% of metros. We still expose metro
 * (the map/markets cards need it) and accept that minor caveat, since these
 * metrics have no CBSA-correct alternative source (unlike sale_to_list, which
 * falls back to Zillow at metro).
 */
export const redfinDataCenterMetrics: Record<string, MetricFallbackChain> = {
  sold_above_list_share: {
    metricId: 'sold_above_list_share',
    sources: [
      { source: 'redfin_dc', column: 'share_sold_above_original_list' },
    ],
    supportsGeoInheritance: false,
  },
  listings_delisted_share: {
    metricId: 'listings_delisted_share',
    sources: [
      { source: 'redfin_dc_delistings', column: 'share_of_listings_delisted' },
    ],
    supportsGeoInheritance: false,
  },
  pending_cancellation_share: {
    metricId: 'pending_cancellation_share',
    sources: [
      {
        source: 'redfin_dc_cancellations',
        column: 'percent_of_pending_sales',
      },
    ],
    supportsGeoInheritance: false,
  },
  investor_market_share: {
    metricId: 'investor_market_share',
    sources: [
      { source: 'redfin_dc_investors', column: 'investor_market_share' },
    ],
    supportsGeoInheritance: false,
  },
  all_cash_share: {
    metricId: 'all_cash_share',
    sources: [{ source: 'redfin_dc_cash_loan', column: 'percent_all_cash' }],
    supportsGeoInheritance: false,
  },
};
