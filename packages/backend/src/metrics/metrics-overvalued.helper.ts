import { SupabaseClient } from '@supabase/supabase-js';
import { CalculatedMetricsService } from './calculated-metrics.service';
import {
  NATIONAL_MEDIAN_INCOME,
  PRICE_TO_INCOME_BENCHMARK,
} from './metrics-controller.helpers';

/**
 * On-the-fly overvalued-% compute for metros. Extracted verbatim from the
 * original MetricsController.getMetroOvervalued body. Uses pre-calculated data
 * from calculated_metrics when available; otherwise computes from zillow_metro
 * (long-format) ZHVI and Census median income.
 * Calculated as: ((ZHVI / median_income) - 3.5) / 3.5 * 100
 */
export async function computeMetroOvervalued(
  supabase: SupabaseClient,
  calculatedMetricsService: CalculatedMetricsService,
  date?: string,
) {
  // Try pre-calculated data first (same pattern as cap rate)
  const preCalculated =
    await calculatedMetricsService.getInvestmentMetricsForMap(
      'overvalued_pct',
      'metro',
    );
  if (preCalculated.success && preCalculated.data.length > 0) {
    return {
      success: true,
      count: preCalculated.data.length,
      geography: 'Metro',
      metric: 'overvalued_pct',
      source: 'pre-calculated',
      data: preCalculated.data,
    };
  }

  // Fallback: compute on-the-fly from zillow_metro (long-format)
  let targetDate = date;
  if (!targetDate) {
    const { data: latestDate } = await supabase
      .from('zillow_metro')
      .select('period_date')
      .eq('metric_name', 'zhvi')
      .order('period_date', { ascending: false })
      .limit(1)
      .single();
    targetDate = latestDate?.period_date;
  }

  if (!targetDate) {
    return { success: false, error: 'No ZHVI data available', data: [] };
  }

  const { data: zhviData, error: zhviError } = await supabase
    .from('zillow_metro')
    .select('region_id, region_name, value, cbsa_code')
    .eq('metric_name', 'zhvi')
    .eq('period_date', targetDate)
    .not('value', 'is', null);

  if (zhviError || !zhviData) {
    return {
      success: false,
      error: zhviError?.message || 'Failed to fetch ZHVI data',
      data: [],
    };
  }

  const { data: incomeData } = await supabase
    .from('census_data')
    .select('geography_id, value')
    .eq('geography_type', 'metro')
    .eq('metric_name', 'median_income')
    .order('year', { ascending: false });

  const incomeByGeo: Record<string, number> = {};
  if (incomeData) {
    for (const row of incomeData) {
      if (row.value && !incomeByGeo[row.geography_id]) {
        incomeByGeo[row.geography_id] = Number(row.value);
      }
    }
  }

  const results = zhviData.map((metro) => {
    const zhvi = metro.value;
    const cbsaCode = metro.cbsa_code;
    const medianIncome =
      (cbsaCode && incomeByGeo[cbsaCode]) || NATIONAL_MEDIAN_INCOME;
    const priceToIncome = zhvi / medianIncome;
    const overvaluedPct =
      ((priceToIncome - PRICE_TO_INCOME_BENCHMARK) /
        PRICE_TO_INCOME_BENCHMARK) *
      100;

    return {
      region_id: metro.region_id,
      region_name: metro.region_name,
      cbsa_code: cbsaCode,
      zhvi,
      median_income: medianIncome,
      price_to_income: Math.round(priceToIncome * 100) / 100,
      overvalued_pct: Math.round(overvaluedPct * 10) / 10,
    };
  });

  return {
    success: true,
    count: results.length,
    geography: 'Metro',
    metric: 'overvalued_pct',
    benchmark: {
      price_to_income_ratio: PRICE_TO_INCOME_BENCHMARK,
      national_median_income: NATIONAL_MEDIAN_INCOME,
    },
    data: results,
  };
}
