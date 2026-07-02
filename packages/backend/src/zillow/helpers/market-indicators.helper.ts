/**
 * Metro Market Indicator Helpers
 *
 * Generic metro market-indicator fetcher plus the combined price-cuts,
 * new-construction, and affordability fetchers, extracted from
 * zillow.service.ts for file-size compliance — behavior unchanged.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type {
  MarketIndicatorData,
  MarketIndicatorMetric,
  PriceCutsData,
  NewConstructionData,
  AffordabilityData,
} from '../types';
import {
  getLatestDate,
  getLatestDateForMetric,
  queryMarketIndicator,
  queryMarketIndicatorLatest,
  queryAffordability,
} from './queries';
import { buildMetroMappings, lookupMetro } from './crosswalk';

/**
 * Generic method to get market indicator data for metros
 * When no date is provided, returns the latest available data per region
 * @param metricName - The metric name (e.g., 'inventory', 'new_listings', 'dom')
 */
export async function getMetroMarketIndicator(
  supabase: SupabaseClient,
  metricName: MarketIndicatorMetric,
  date?: string,
  propertyType: string = 'sfrcondo',
): Promise<MarketIndicatorData[]> {
  // Use latest-per-region when no specific date requested
  const data = date
    ? await queryMarketIndicator(
        supabase,
        metricName,
        ['Metro', 'US'],
        date,
        propertyType,
      )
    : await queryMarketIndicatorLatest(supabase, metricName, ['Metro', 'US']);

  if (!data.length) return [];

  const { byZillowId, byCbsaCode } = await buildMetroMappings(supabase);

  return data
    .map((d: any) => {
      if (d.geography === 'US') {
        return {
          region_id: d.region_id,
          region_name: 'United States',
          value: d.value,
          date: d.date,
          property_type: d.property_type,
          geography: 'US',
        };
      }

      // Use data from query if available, fallback to crosswalk lookup
      const { metro, cbsaCode } = lookupMetro(
        d.region_id,
        byZillowId,
        byCbsaCode,
      );

      return {
        region_id: d.region_id,
        region_name: d.region_name || metro?.cbsa_name || 'Unknown',
        cbsa_code: d.cbsa_code || cbsaCode,
        state_abbrev: d.state_code || metro?.state || null,
        value: d.value,
        date: d.date,
        property_type: d.property_type,
        geography: 'Metro',
      };
    })
    .sort((a, b) => b.value - a.value);
}

export async function getMetroPriceCuts(
  supabase: SupabaseClient,
  date?: string,
): Promise<PriceCutsData[]> {
  const targetDate =
    date || (await getLatestDateForMetric(supabase, 'price_cuts', 'metro'));

  // Price cuts data is stored under 'price_cuts' metric
  const priceCutsData = await queryMarketIndicator(
    supabase,
    'price_cuts',
    ['Metro', 'US'],
    targetDate,
  );

  // Use the same data for share, amt, pct (they're all from the same metric)
  const shareData = priceCutsData;
  const amtData = priceCutsData;
  const pctData = priceCutsData;

  const { byZillowId, byCbsaCode } = await buildMetroMappings(supabase);

  // Combine the data by region_id
  const combinedMap = new Map<string, PriceCutsData>();

  for (const d of shareData) {
    const { metro, cbsaCode } = lookupMetro(
      d.region_id,
      byZillowId,
      byCbsaCode,
    );
    combinedMap.set(d.region_id, {
      region_id: d.region_id,
      region_name:
        d.geography === 'US' ? 'United States' : metro?.cbsa_name || 'Unknown',
      cbsa_code: cbsaCode,
      state_abbrev: metro?.state || null,
      date: d.date,
      geography: d.geography,
      share_with_price_cut: d.value,
      median_price_cut_amount: null,
      median_price_cut_percent: null,
    });
  }

  for (const d of amtData) {
    const existing = combinedMap.get(d.region_id);
    if (existing) {
      existing.median_price_cut_amount = d.value;
    }
  }

  for (const d of pctData) {
    const existing = combinedMap.get(d.region_id);
    if (existing) {
      existing.median_price_cut_percent = d.value;
    }
  }

  return Array.from(combinedMap.values()).sort(
    (a, b) => (b.share_with_price_cut || 0) - (a.share_with_price_cut || 0),
  );
}

export async function getMetroNewConstruction(
  supabase: SupabaseClient,
  date?: string,
): Promise<NewConstructionData[]> {
  // Get latest date for new construction metrics
  const targetDate =
    date || (await getLatestDate(supabase, 'metro', 'new_con_sales' as any));

  // Query all new construction metrics from zillow_metro in one call
  const newConMetrics = [
    'new_con_sales',
    'new_con_median_price',
    'new_con_median_price_per_sqft',
  ];

  const { data, error } = await supabase
    .from('zillow_metro')
    .select(
      'region_id, region_name, cbsa_code, state_code, period_date, metric_name, value',
    )
    .in('metric_name', newConMetrics)
    .eq('period_date', targetDate)
    .limit(5000);

  if (error) {
    console.error('Error fetching new construction data:', error.message);
    return [];
  }

  if (!data || data.length === 0) return [];

  // Group by region_id to combine metrics
  const combinedMap = new Map<string, NewConstructionData>();

  for (const row of data) {
    const regionId = String(row.region_id);

    if (!combinedMap.has(regionId)) {
      combinedMap.set(regionId, {
        region_id: regionId,
        region_name: row.region_name || 'Unknown',
        cbsa_code: row.cbsa_code || null,
        state_abbrev: row.state_code || null,
        date: row.period_date,
        geography: 'Metro',
        sales_count: null,
        median_sale_price: null,
        price_per_sqft: null,
      });
    }

    const entry = combinedMap.get(regionId)!;

    // Map metric names to fields
    if (
      row.metric_name === 'new_con_sales' ||
      row.metric_name === 'new_con_sales_count'
    ) {
      entry.sales_count = row.value;
    }
    if (row.metric_name === 'new_con_median_price') {
      entry.median_sale_price = row.value;
    }
    if (row.metric_name === 'new_con_median_price_per_sqft') {
      entry.price_per_sqft = row.value;
    }
  }

  // Resolve real CBSA codes via crosswalk
  const { byZillowId, byCbsaCode } = await buildMetroMappings(supabase);
  return Array.from(combinedMap.values())
    .map((d) => {
      const { cbsaCode } = lookupMetro(
        String(d.region_id),
        byZillowId,
        byCbsaCode,
      );
      return { ...d, cbsa_code: cbsaCode || d.cbsa_code };
    })
    .filter((d) => d.cbsa_code)
    .sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0));
}

export async function getMetroAffordability(
  supabase: SupabaseClient,
  date?: string,
): Promise<AffordabilityData[]> {
  // Use cached latest date for affordability metrics
  const targetDate =
    date || (await getLatestDate(supabase, 'metro', 'homeowner_income'));
  if (!targetDate) return [];

  const data = await queryAffordability(supabase, ['Metro'], targetDate);

  if (!data.length) return [];

  // Resolve real CBSA codes via crosswalk
  const { byZillowId, byCbsaCode } = await buildMetroMappings(supabase);
  return data
    .map((d) => {
      const { metro, cbsaCode } = lookupMetro(
        String(d.region_id),
        byZillowId,
        byCbsaCode,
      );
      return {
        region_id: d.region_id,
        region_name: metro?.cbsa_name || d.region_name || 'Unknown',
        cbsa_code: cbsaCode || d.cbsa_code,
        state_abbrev: metro?.state || d.state_code || null,
        date: d.date,
        geography: 'Metro',
        homeowner_income_needed: d.homeowner_income_needed,
        renter_income_needed: d.renter_income_needed,
        affordable_home_price: d.affordable_home_price,
        years_to_save: d.years_to_save,
        homeowner_affordability_percent: d.homeowner_affordability_percent,
        renter_affordability_percent: d.renter_affordability_percent,
        down_payment_percent: d.down_payment_percent,
        property_type: d.property_type,
      };
    })
    .filter((d) => d.cbsa_code)
    .sort(
      (a, b) =>
        (b.homeowner_income_needed || 0) - (a.homeowner_income_needed || 0),
    );
}
