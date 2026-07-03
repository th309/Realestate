import { CalculatedMetricsService } from './calculated-metrics.service';

// National median household income benchmark (approximate 2024 value)
export const NATIONAL_MEDIAN_INCOME = 75000;
// Traditional price-to-income affordability benchmark
export const PRICE_TO_INCOME_BENCHMARK = 3.5;

/**
 * Shared response for map metrics that exist ONLY as pre-calculated columns in
 * calculated_metrics (months_of_supply, county/zip overvalued_pct). They are
 * produced by the monthly calculated-metrics refresh and have no on-the-fly
 * fallback, so an empty result reports success:false rather than computing.
 */
export async function precalculatedMapResponse(
  calculatedMetricsService: CalculatedMetricsService,
  metricName: 'months_of_supply' | 'overvalued_pct',
  geographyType: 'metro' | 'county' | 'zip',
  geographyLabel: string,
) {
  const pre = await calculatedMetricsService.getInvestmentMetricsForMap(
    metricName,
    geographyType,
  );
  return {
    success: pre.success && pre.data.length > 0,
    count: pre.data.length,
    geography: geographyLabel,
    metric: metricName,
    source: 'pre-calculated',
    data: pre.data,
  };
}
