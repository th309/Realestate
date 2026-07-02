import {
  GeoType,
  MarketSnapshotMetric,
  MarketSnapshotResponse,
  REALTOR_COLUMN_MAP,
  REALTOR_PERCENT_COLS,
  ZILLOW_METRIC_MAP,
  ZILLOW_AFFORD_MAP,
} from './market-snapshot.types';

// ============================================================================
// Snapshot Assembler (shared helpers + primary sources)
//
// Pure transforms that fold each settled data-source result into a shared
// accumulator. Extracted verbatim from MarketSnapshotService.buildSnapshot so
// the service keeps only orchestration (async fan-out + fallbacks). No `this`,
// no I/O — order of application is preserved by the caller. Secondary sources
// (census/economic/calculated/permits) live in
// market-snapshot-source-processors.helper.ts.
// ============================================================================

export interface SnapshotAccumulator {
  metrics: Record<string, MarketSnapshotMetric>;
  geographyName: string;
  lastUpdated: string;
  readonly defaultName: string;
}

export type ToMetric = (
  value: number,
  date: string | null | undefined,
  source: string,
  overrides?: Partial<
    Pick<
      MarketSnapshotMetric,
      'sourceGeoId' | 'sourceGeoLevel' | 'isInherited' | 'isFallback'
    >
  >,
) => MarketSnapshotMetric;

export type RealtorFetch = {
  data: Record<string, any>;
  name: string | null;
  date: string | null;
};
export type ZillowFetch = { rows: Record<string, any>[]; name: string | null };
export type SourceFetch = { data: Record<string, any>; name: string | null };
export type DataOnlyFetch = { data: Record<string, any> };

export function createAccumulator(defaultName: string): SnapshotAccumulator {
  return {
    metrics: {},
    geographyName: defaultName,
    lastUpdated: new Date().toISOString(),
    defaultName,
  };
}

export function makeToMetric(geoType: GeoType, geoId: string): ToMetric {
  return (value, date, source, overrides) => ({
    value,
    date: date ?? null,
    source,
    sourceGeoId: overrides?.sourceGeoId ?? geoId,
    sourceGeoLevel: overrides?.sourceGeoLevel ?? geoType,
    isInherited: overrides?.isInherited ?? false,
    isFallback: overrides?.isFallback ?? false,
  });
}

export function processRealtor(
  acc: SnapshotAccumulator,
  result: PromiseSettledResult<RealtorFetch | null>,
  toMetric: ToMetric,
): void {
  if (result.status !== 'fulfilled' || !result.value) return;
  const { data, name, date } = result.value;
  if (name) acc.geographyName = name;
  if (date) acc.lastUpdated = date;
  for (const [col, metricId] of Object.entries(REALTOR_COLUMN_MAP)) {
    const raw = data[col];
    if (raw != null) {
      const value = REALTOR_PERCENT_COLS.has(col)
        ? Number(raw) * 100
        : Number(raw);
      acc.metrics[metricId] = toMetric(
        value,
        data.period_date ?? date ?? null,
        'realtor',
      );
    }
  }
  // home_sales_yoy from Realtor
  if (data.pending_listing_count_yy != null) {
    acc.metrics['home_sales_yoy'] = toMetric(
      Number(data.pending_listing_count_yy) * 100,
      data.period_date ?? date ?? null,
      'realtor',
    );
  }
}

export function processZillow(
  acc: SnapshotAccumulator,
  result: PromiseSettledResult<ZillowFetch | null>,
  toMetric: ToMetric,
): void {
  if (result.status !== 'fulfilled' || !result.value) return;
  const { rows, name } = result.value;
  if (name && acc.geographyName === acc.defaultName) acc.geographyName = name;
  for (const row of rows) {
    const metricName = row.metric_name as string;
    const val = row.value as number | null;
    const date = row.period_date as string | null;

    // Standard metrics
    const metricId = ZILLOW_METRIC_MAP[metricName];
    if (metricId && val != null) {
      // sale_to_list is stored as a fraction (0.98 = 98%); convert to display form
      const displayValue = metricName === 'sale_to_list' ? val * 100 : val;
      acc.metrics[metricId] = toMetric(displayValue, date, 'zillow');
    }

    // Affordability metrics (metro only)
    const affordId = ZILLOW_AFFORD_MAP[metricName];
    if (affordId && val != null) {
      acc.metrics[affordId] = toMetric(val, date, 'zillow');
    }
  }
}

// Fallback: home_value when Zillow ZHVI is unavailable
// Priority: Census ACS median_home_value (survey-based median, more representative)
//   then:   Realtor median_listing_price (can be skewed by low listing count)
export function applyHomeValueFallback(
  acc: SnapshotAccumulator,
  censusResult: PromiseSettledResult<SourceFetch | null>,
  realtorResult: PromiseSettledResult<RealtorFetch | null>,
  toMetric: ToMetric,
): void {
  if (acc.metrics['home_value']) return;
  // Try Census ACS first (same pattern as scoring-data-fetcher.ts line 264-266)
  if (censusResult.status === 'fulfilled' && censusResult.value) {
    const censusVal = Number(censusResult.value.data.median_home_value);
    if (censusVal > 0 && censusVal !== -666666666) {
      const year = censusResult.value.data.year
        ? `${censusResult.value.data.year}-01-01`
        : null;
      acc.metrics['home_value'] = toMetric(censusVal, year, 'census', {
        isFallback: true,
      });
    }
  }
  // Then Realtor listing price (same pattern as reports-data-fetcher.ts line 97-100)
  if (
    !acc.metrics['home_value'] &&
    realtorResult.status === 'fulfilled' &&
    realtorResult.value
  ) {
    const listingPrice = realtorResult.value.data.median_listing_price;
    if (listingPrice != null) {
      acc.metrics['home_value'] = toMetric(
        Number(listingPrice),
        realtorResult.value.data.period_date ??
          realtorResult.value.date ??
          null,
        'realtor',
        { isFallback: true },
      );
    }
  }
}

export function processScores(
  acc: SnapshotAccumulator,
  result: PromiseSettledResult<any>,
  toMetric: ToMetric,
): MarketSnapshotResponse['scores'] {
  let scores: MarketSnapshotResponse['scores'] = { propertyiq: null };
  if (result.status !== 'fulfilled' || !result.value) return scores;

  const s = result.value;
  if (s.location_name) acc.geographyName = s.location_name;
  if (s.score_date) acc.lastUpdated = s.score_date;
  scores = {
    propertyiq: s.scores?.propertyiq
      ? {
          score: Math.round(s.scores.propertyiq.score),
          grade: s.scores.propertyiq.grade,
          // The "score receipts" exposed to SEO pages are the four raw v4
          // inputs, which live on the top-level z_scores (NOT components,
          // which is a legacy ScoreComponentBreakdown[] that report builders
          // iterate — see scoring-retrieval.ts).
          components: s.z_scores,
        }
      : null,
  };

  // Also add score value as metric for data card display
  if (s.scores?.propertyiq) {
    acc.metrics['propertyiq_score'] = toMetric(
      Math.round(s.scores.propertyiq.score),
      s.score_date ?? null,
      'propertyiq',
    );
  }
  return scores;
}
