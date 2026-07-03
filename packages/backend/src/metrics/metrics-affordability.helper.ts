import { SupabaseClient } from '@supabase/supabase-js';
import { normalizeStateToCode } from '../common/geo';

/**
 * Affordability map fetchers, relocated VERBATIM from the original
 * MetricsController private helpers (getIncomeToBuyByGeo,
 * getAffordableHomePriceByGeo, getYearsToSaveByGeo). Each reads a single
 * pre-calculated column from calculated_metrics for the latest period and
 * shapes it into the map-friendly response. They are intentionally kept as
 * three separate functions (not collapsed) to preserve exact behavior.
 */

/**
 * Generic income-to-buy fetcher for all geography types
 */
export async function getIncomeToBuyByGeo(
  supabase: SupabaseClient,
  geoType: string,
  geoLabel: string,
  stateFilter?: string,
) {
  if (stateFilter) stateFilter = normalizeStateToCode(stateFilter);
  // Get latest date from calculated_metrics
  const { data: latestRow } = await supabase
    .from('calculated_metrics')
    .select('period_date')
    .eq('geography_type', geoType)
    .not('income_to_buy', 'is', null)
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  if (!latestRow?.period_date) {
    return {
      success: false,
      error: `No income_to_buy data available for ${geoLabel}`,
      data: [],
    };
  }

  const targetDate = latestRow.period_date;

  // Build query
  const query = supabase
    .from('calculated_metrics')
    .select('geography_id, geography_name, income_to_buy, period_date')
    .eq('geography_type', geoType)
    .eq('period_date', targetDate)
    .not('income_to_buy', 'is', null);

  // ZIP: do not filter by state. Return all zip income_to_buy for the date.
  // The map only loads state-specific GeoJSON, so it only has shapes for the selected state;
  // it looks up mapData[zipCode] per feature, so every zip with data will match when the
  // frontend has the shape. Filtering here by census/realtor allow-list was dropping zips
  // (null zip_name, or missing from census), causing missing coverage vs listing price.

  // Paginate for large datasets (county and zip)
  const allData: any[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data: pageData, error } = await query.range(
      offset,
      offset + pageSize - 1,
    );

    if (error) {
      return { success: false, error: error.message, data: [] };
    }

    if (!pageData || pageData.length === 0) break;
    allData.push(...pageData);
    if (pageData.length < pageSize) break;
    offset += pageSize;
  }

  // Transform to map-friendly format
  const results = allData.map((row) => {
    const result: any = {
      region_id: row.geography_id,
      region_name: row.geography_name,
      income_to_buy: row.income_to_buy,
      value: row.income_to_buy,
      date: row.period_date,
    };

    // Add geography-specific ID fields
    if (geoType === 'metro') {
      result.cbsa_code = row.geography_id;
    } else if (geoType === 'county') {
      result.county_fips = row.geography_id;
    } else if (geoType === 'zip') {
      result.postal_code = row.geography_id;
    }

    return result;
  });

  return {
    success: true,
    count: results.length,
    geography: geoLabel,
    metric: 'income_to_buy',
    source: 'pre-calculated',
    date: targetDate,
    data: results,
  };
}

/**
 * Generic affordable-home-price fetcher for all geography types
 */
export async function getAffordableHomePriceByGeo(
  supabase: SupabaseClient,
  geoType: string,
  geoLabel: string,
  stateFilter?: string,
) {
  if (stateFilter) stateFilter = normalizeStateToCode(stateFilter);
  // Get latest date from calculated_metrics
  const { data: latestRow } = await supabase
    .from('calculated_metrics')
    .select('period_date')
    .eq('geography_type', geoType)
    .not('affordable_home_price', 'is', null)
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  if (!latestRow?.period_date) {
    return {
      success: false,
      error: `No affordable_home_price data available for ${geoLabel}`,
      data: [],
    };
  }

  const targetDate = latestRow.period_date;

  // Build query
  const query = supabase
    .from('calculated_metrics')
    .select('geography_id, geography_name, affordable_home_price, period_date')
    .eq('geography_type', geoType)
    .eq('period_date', targetDate)
    .not('affordable_home_price', 'is', null);

  // ZIP: do not filter by state (same as income_to_buy). Return all zip rows; map uses state-specific GeoJSON.

  // Paginate for large datasets (county and zip)
  const allData: any[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data: pageData, error } = await query.range(
      offset,
      offset + pageSize - 1,
    );

    if (error) {
      return { success: false, error: error.message, data: [] };
    }

    if (!pageData || pageData.length === 0) break;
    allData.push(...pageData);
    if (pageData.length < pageSize) break;
    offset += pageSize;
  }

  // Transform to map-friendly format
  const results = allData.map((row) => {
    const result: any = {
      region_id: row.geography_id,
      region_name: row.geography_name,
      affordable_home_price: row.affordable_home_price,
      value: row.affordable_home_price,
      date: row.period_date,
    };

    // Add geography-specific ID fields
    if (geoType === 'metro') {
      result.cbsa_code = row.geography_id;
    } else if (geoType === 'county') {
      result.county_fips = row.geography_id;
    } else if (geoType === 'zip') {
      result.postal_code = row.geography_id;
    }

    return result;
  });

  return {
    success: true,
    count: results.length,
    geography: geoLabel,
    metric: 'affordable_home_price',
    source: 'pre-calculated',
    date: targetDate,
    data: results,
  };
}

/**
 * Generic years-to-save fetcher for all geography types
 */
export async function getYearsToSaveByGeo(
  supabase: SupabaseClient,
  geoType: string,
  geoLabel: string,
  stateFilter?: string,
) {
  if (stateFilter) stateFilter = normalizeStateToCode(stateFilter);
  // Get latest date from calculated_metrics
  const { data: latestRow } = await supabase
    .from('calculated_metrics')
    .select('period_date')
    .eq('geography_type', geoType)
    .not('years_to_save', 'is', null)
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  if (!latestRow?.period_date) {
    return {
      success: false,
      error: `No years_to_save data available for ${geoLabel}`,
      data: [],
    };
  }

  const targetDate = latestRow.period_date;

  // Build query
  const query = supabase
    .from('calculated_metrics')
    .select('geography_id, geography_name, years_to_save, period_date')
    .eq('geography_type', geoType)
    .eq('period_date', targetDate)
    .not('years_to_save', 'is', null);

  // ZIP: do not filter by state (same as income_to_buy). Return all zip rows; map uses state-specific GeoJSON.

  // Paginate for large datasets (county and zip)
  const allData: any[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data: pageData, error } = await query.range(
      offset,
      offset + pageSize - 1,
    );

    if (error) {
      return { success: false, error: error.message, data: [] };
    }

    if (!pageData || pageData.length === 0) break;
    allData.push(...pageData);
    if (pageData.length < pageSize) break;
    offset += pageSize;
  }

  // Transform to map-friendly format
  const results = allData.map((row) => {
    const result: any = {
      region_id: row.geography_id,
      region_name: row.geography_name,
      years_to_save: row.years_to_save,
      value: row.years_to_save,
      date: row.period_date,
    };

    // Add geography-specific ID fields
    if (geoType === 'metro') {
      result.cbsa_code = row.geography_id;
    } else if (geoType === 'county') {
      result.county_fips = row.geography_id;
    } else if (geoType === 'zip') {
      result.postal_code = row.geography_id;
    }

    return result;
  });

  return {
    success: true,
    count: results.length,
    geography: geoLabel,
    metric: 'years_to_save',
    source: 'pre-calculated',
    date: targetDate,
    data: results,
  };
}
