/**
 * Reports Data Fetcher — historical supplement
 *
 * Supplements snapshot-derived market metrics with historical calculations the
 * snapshot doesn't provide (3yr/5yr ZHVI CAGR, ZORI YoY, population growth).
 * Extracted from reports-data-fetcher.ts for file-size compliance. Mutates the
 * passed `metrics` object in place, matching the original inline behavior.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { MarketMetrics } from './reports-market-comparison';

/**
 * Supplement market metrics with historical CAGR/YoY/growth calculations that
 * the market snapshot doesn't provide. Mutates `metrics` in place.
 */
export async function supplementHistoricalMetrics(
  supabaseClient: SupabaseClient,
  metrics: MarketMetrics,
  geographyType: 'metro' | 'county' | 'zip',
  geographyId: string,
): Promise<void> {
  // Calculate 3yr/5yr CAGR and YoY from ZHVI history
  if (metrics.zhvi_3y_cagr == null || metrics.zori_yoy == null) {
    const zillowTable =
      geographyType === 'metro'
        ? 'zillow_metro'
        : geographyType === 'county'
          ? 'zillow_county'
          : 'zillow_zip';
    const zillowIdCol =
      geographyType === 'metro'
        ? 'cbsa_code'
        : geographyType === 'county'
          ? 'fips_code'
          : 'region_name';

    // ZHVI history for 3yr CAGR
    if (metrics.zhvi_3y_cagr == null) {
      const { data: zhviHistory } = await supabaseClient
        .from(zillowTable)
        .select('value, period_date')
        .eq(zillowIdCol, geographyId)
        .eq('metric_name', 'zhvi')
        .order('period_date', { ascending: false })
        .limit(61);

      if (zhviHistory && zhviHistory.length >= 1) {
        const current = zhviHistory[0]?.value;
        if (zhviHistory.length >= 36) {
          const threeYrAgo =
            zhviHistory[Math.min(36, zhviHistory.length - 1)]?.value;
          if (current && threeYrAgo && threeYrAgo > 0) {
            metrics.zhvi_3y_cagr =
              (Math.pow(current / threeYrAgo, 1 / 3) - 1) * 100;
          }
        }
        if (metrics.zhvi_5y_cagr == null && zhviHistory.length >= 60) {
          const fiveYrAgo =
            zhviHistory[Math.min(60, zhviHistory.length - 1)]?.value;
          if (current && fiveYrAgo && fiveYrAgo > 0) {
            metrics.zhvi_5y_cagr =
              (Math.pow(current / fiveYrAgo, 1 / 5) - 1) * 100;
          }
        }
      }
    }

    // ZORI history for rent YoY
    if (metrics.zori_yoy == null) {
      const { data: zoriHistory } = await supabaseClient
        .from(zillowTable)
        .select('value, period_date')
        .eq(zillowIdCol, geographyId)
        .eq('metric_name', 'zori')
        .order('period_date', { ascending: false })
        .limit(13);

      if (zoriHistory && zoriHistory.length >= 12) {
        const currentRent = zoriHistory[0]?.value;
        const rentYearAgo = zoriHistory[12]?.value;
        if (currentRent && rentYearAgo && rentYearAgo > 0) {
          metrics.zori_yoy = ((currentRent - rentYearAgo) / rentYearAgo) * 100;
        }
      }
    }
  }

  // Calculate population_growth_yoy from census if snapshot didn't provide it
  if (metrics.population_growth_yoy == null && metrics.population != null) {
    const censusTable =
      geographyType === 'metro'
        ? 'census_metro'
        : geographyType === 'county'
          ? 'census_county'
          : 'census_zip';
    const censusIdCol =
      geographyType === 'metro'
        ? 'cbsa_code'
        : geographyType === 'county'
          ? 'fips_code'
          : 'zcta';

    const { data: censusRows } = await supabaseClient
      .from(censusTable)
      .select('total_population')
      .eq(censusIdCol, geographyId)
      .order('year', { ascending: false })
      .limit(2);

    if (censusRows && censusRows.length >= 2) {
      const curr = censusRows[0]?.total_population;
      const prev = censusRows[1]?.total_population;
      if (curr && prev && prev > 0) {
        metrics.population_growth_yoy = ((curr - prev) / prev) * 100;
      }
    }
  }
}
