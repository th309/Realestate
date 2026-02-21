/**
 * Computed Time Series
 *
 * On-the-fly calculation for derived metrics that don't have stored historical data:
 * - Investment metrics (cap_rate, gross_yield, grm, rent_to_price_ratio)
 * - Overvalued spectrum (ZHVI vs median income)
 * - Permit derivatives (YoY, SF/MF ratio, value per unit)
 *
 * These functions accept a Supabase client and delegate region filtering/table lookup
 * to the extracted utility functions.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { TimeSeriesDataPoint } from './timeseries.service';
import { addRegionFilter, getTableName } from './timeseries-region-filter';

/**
 * Fetch raw time series for a single Zillow metric (used by computed methods).
 */
async function getRawSeries(
  supabase: SupabaseClient,
  source: string,
  metricName: string,
  geoLevel: string,
  regionId: string,
  startDate?: string,
  endDate?: string,
): Promise<TimeSeriesDataPoint[]> {
  const query = supabase
    .from(getTableName(source, geoLevel)!)
    .select('period_date, value')
    .eq('metric_name', metricName)
    .order('period_date', { ascending: true });

  const qWithGeo = addRegionFilter(query, geoLevel, regionId, source);

  if (startDate) qWithGeo.gte('period_date', startDate);
  if (endDate) qWithGeo.lte('period_date', endDate);

  const { data, error } = await qWithGeo.limit(2000);

  if (error || !data) return [];
  return data.map((r: any) => ({ date: r.period_date, value: r.value }));
}

/** Apply lastPoints/limit slicing to a result array. */
function applyLimits(
  result: TimeSeriesDataPoint[],
  lastPoints?: number,
  limit?: number,
): TimeSeriesDataPoint[] {
  if (lastPoints && lastPoints > 0) {
    return result.slice(Math.max(0, result.length - lastPoints));
  }
  if (limit && limit > 0) return result.slice(0, limit);
  return result;
}

/**
 * Compute Investment Metrics on the fly (cap_rate, gross_yield, grm, rent_to_price_ratio).
 */
export async function getComputedInvestmentTimeSeries(
  supabase: SupabaseClient,
  metricId: string,
  geoLevel: string,
  regionId: string,
  startDate?: string,
  endDate?: string,
  limit?: number,
  lastPoints?: number,
): Promise<TimeSeriesDataPoint[]> {
  const prices = await getRawSeries(supabase, 'zillow', 'zhvi', geoLevel, regionId, startDate, endDate);

  let rents = await getRawSeries(supabase, 'zillow', 'zori', geoLevel, regionId, startDate, endDate);
  if (rents.length === 0 && geoLevel === 'zip') {
    rents = await getRawSeries(supabase, 'zillow', 'zordi_sfr', geoLevel, regionId, startDate, endDate);
  }

  if (prices.length === 0 || rents.length === 0) return [];

  const priceMap = new Map(prices.map(p => [p.date, p.value]));
  const result: TimeSeriesDataPoint[] = [];

  for (const rent of rents) {
    const price = priceMap.get(rent.date);
    if (!price) continue;

    let val = 0;
    if (metricId === 'cap_rate') {
      val = ((rent.value * 12 * 0.6) / price) * 100;
      val = Math.round(val * 100) / 100;
    } else if (metricId === 'gross_yield') {
      val = ((rent.value * 12) / price) * 100;
      val = Math.round(val * 100) / 100;
    } else if (metricId === 'rent_to_price_ratio') {
      val = rent.value / price;
      val = Math.round(val * 10000) / 10000;
    } else if (metricId === 'grm') {
      val = price / (rent.value * 12);
      val = Math.round(val * 100) / 100;
    }

    result.push({ date: rent.date, value: val });
  }

  return applyLimits(result, lastPoints, limit);
}

/**
 * Compute Overvalued Spectrum on the fly (ZHVI vs median income).
 */
export async function getComputedOvervaluedTimeSeries(
  supabase: SupabaseClient,
  geoLevel: string,
  regionId: string,
  startDate?: string,
  endDate?: string,
  limit?: number,
  lastPoints?: number,
): Promise<TimeSeriesDataPoint[]> {
  const prices = await getRawSeries(supabase, 'zillow', 'zhvi', geoLevel, regionId, startDate, endDate);
  if (prices.length === 0) return [];

  const incomeTable = getTableName('census', geoLevel);
  if (!incomeTable) return [];

  const iQuery = supabase
    .from(incomeTable)
    .select('year, median_household_income')
    .order('year', { ascending: true });

  const iQueryGeo = addRegionFilter(iQuery, geoLevel, regionId, 'census');
  const { data: incomeData } = await iQueryGeo;

  if (!incomeData || incomeData.length === 0) return [];

  const incomeMap: Record<number, number> = {};
  incomeData.forEach((row: any) => {
    if (row.year && row.median_household_income) {
      incomeMap[row.year] = row.median_household_income;
    }
  });
  const years = Object.keys(incomeMap).map(Number).sort((a, b) => a - b);

  const result: TimeSeriesDataPoint[] = [];
  const NATIONAL_MEDIAN_INCOME = 75000;
  const BENCHMARK = 3.5;

  for (const p of prices) {
    const y = parseInt(p.date.substring(0, 4));
    let inc = incomeMap[y];
    if (!inc) {
      const closeY = years.reverse().find(yr => yr <= y);
      inc = closeY ? incomeMap[closeY] : incomeMap[years[0]];
      years.reverse();
    }
    if (!inc) inc = NATIONAL_MEDIAN_INCOME;

    const ratio = p.value / inc;
    const overvalued = ((ratio - BENCHMARK) / BENCHMARK) * 100;

    result.push({
      date: p.date,
      value: Math.round(overvalued * 10) / 10,
    });
  }

  return applyLimits(result, lastPoints, limit);
}

/**
 * Compute derived permit metrics (YoY, SF/MF ratio, value per unit) on the fly.
 */
export async function getComputedPermitsTimeSeries(
  supabase: SupabaseClient,
  metricId: string,
  geoLevel: string,
  regionId: string,
  startDate?: string,
  endDate?: string,
  limit?: number,
  lastPoints?: number,
): Promise<TimeSeriesDataPoint[]> {
  const table = geoLevel === 'county' ? 'permits_county' : 'permits_state';
  const dateField = 'period_date';

  let query = supabase
    .from(table)
    .select(`${dateField}, total_units, sf_units, large_multi_units, total_value`)
    .order(dateField, { ascending: true });

  query = addRegionFilter(query, geoLevel, regionId, 'permits');

  if (startDate) query = query.gte(dateField, startDate);
  if (endDate) query = query.lte(dateField, endDate);

  const { data, error } = await query.limit(2000);
  if (error || !data || data.length === 0) return [];

  const sorted = (data as any[]).sort(
    (a, b) => new Date(a[dateField]).getTime() - new Date(b[dateField]).getTime(),
  );

  let result: TimeSeriesDataPoint[] = [];

  if (metricId === 'permits_yoy') {
    for (let i = 12; i < sorted.length; i++) {
      const current = sorted[i].total_units;
      const prior = sorted[i - 12].total_units;
      if (current != null && prior != null && prior !== 0) {
        result.push({
          date: sorted[i][dateField],
          value: Math.round(((current - prior) / Math.abs(prior)) * 10000) / 100,
        });
      }
    }
  } else if (metricId === 'sf_mf_ratio') {
    for (const row of sorted) {
      const sf = row.sf_units;
      const total = row.total_units;
      if (sf != null && total != null && total > 0) {
        result.push({
          date: row[dateField],
          value: Math.round((sf / total) * 10000) / 100,
        });
      }
    }
  } else if (metricId === 'permit_value_per_unit') {
    for (const row of sorted) {
      const value = row.total_value;
      const units = row.total_units;
      if (value != null && units != null && units > 0) {
        result.push({
          date: row[dateField],
          value: Math.round(value / units),
        });
      }
    }
  }

  return applyLimits(result, lastPoints, limit);
}
