import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';

export interface TimeSeriesDataPoint {
  date: string;
  value: number;
}

export interface DateRange {
  minDate: string;
  maxDate: string;
  count: number;
}

/**
 * TimeSeriesService
 *
 * Provides unified historical time-series data access across all metrics and geographies.
 * This service replicates the exact query patterns used by the map page, but returns
 * ALL historical data instead of just the latest value.
 *
 * Key Differences in Table Structures:
 * - Realtor tables: Each metric is a dedicated column (e.g., median_listing_price)
 * - Zillow tables: Use metric_name column + value column
 * - Scoring tables: Use score_type filter + score column
 *
 * @version 2.1.0 - Added support for scoring trending
 */
@Injectable()
export class TimeSeriesService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) { }

  /**
   * Get time series data for a specific metric/geography/region
   */
  async getTimeSeries(
    metricId: string,
    geoLevel: string,
    regionId: string,
    startDate?: string,
    endDate?: string,
    limit?: number,
  ): Promise<TimeSeriesDataPoint[]> {
    const mapping = this.getMetricMapping(metricId);
    if (!mapping) {
      return [];
    }

    const table = this.getTableName(mapping.source, geoLevel);
    if (!table) {
      return [];
    }

    try {
      // Census tables use 'year' field, others use 'period_date'
      // propertyiq_scores uses 'score_date'
      let dateField = 'period_date';
      if (mapping.source === 'census') dateField = 'year';
      if (mapping.source === 'scoring') dateField = 'score_date';

      // Build and execute query
      let query = this.supabase
        .from(table)
        .select(`${dateField}, ${mapping.columnName}`)
        .order(dateField, { ascending: true });

      // Add region filter
      query = this.addRegionFilter(query, geoLevel, regionId, mapping.source);

      // For Zillow tables, add metric_name filter
      if (mapping.usesMetricName) {
        query = query.eq('metric_name', mapping.metricNameValue);
      }

      // For scoring, add score_type filter
      if (mapping.source === 'scoring') {
        query = query.eq('score_type', mapping.scoreType);
      }

      // Add date/year filters
      if (startDate) {
        if (mapping.source === 'census') {
          const year = parseInt(startDate.split('-')[0]);
          query = query.gte(dateField, year);
        } else {
          query = query.gte(dateField, startDate);
        }
      }
      if (endDate) {
        if (mapping.source === 'census') {
          const year = parseInt(endDate.split('-')[0]);
          query = query.lte(dateField, year);
        } else {
          query = query.lte(dateField, endDate);
        }
      }

      // Add limit
      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Error fetching time series for ${metricId}: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Transform to standard format
      return data.map((row) => ({
        date: mapping.source === 'census' ? `${row[dateField]}-01-01` : row[dateField],
        value: Number(row[mapping.columnName]) || 0,
      }));
    } catch (err) {
      console.error(`[TimeSeriesService] Error for ${metricId}:`, err);
      return [];
    }
  }

  /**
   * Get available date range for a metric/geography
   */
  async getAvailableDates(
    metricId: string,
    geoLevel: string,
  ): Promise<DateRange> {
    const mapping = this.getMetricMapping(metricId);
    if (!mapping) {
      return { minDate: '', maxDate: '', count: 0 };
    }

    const table = this.getTableName(mapping.source, geoLevel);
    if (!table) {
      return { minDate: '', maxDate: '', count: 0 };
    }

    try {
      const dateField = mapping.source === 'scoring' ? 'score_date' : 'period_date';
      let query = this.supabase
        .from(table)
        .select(dateField)
        .order(dateField, { ascending: true });

      if (mapping.usesMetricName) {
        query = query.eq('metric_name', mapping.metricNameValue);
      }
      if (mapping.source === 'scoring') {
        query = query.eq('score_type', mapping.scoreType);
      }

      const { data, error } = await query;

      if (error || !data || data.length === 0) {
        return { minDate: '', maxDate: '', count: 0 };
      }

      const dates = data.map((d) => d[dateField]);
      const uniqueDates = [...new Set(dates)];

      return {
        minDate: uniqueDates[0] as string,
        maxDate: uniqueDates[uniqueDates.length - 1] as string,
        count: uniqueDates.length,
      };
    } catch (err) {
      console.error(`Error getting date range for ${metricId}:`, err);
      return { minDate: '', maxDate: '', count: 0 };
    }
  }

  private addRegionFilter(
    query: any,
    geoLevel: string,
    regionId: string,
    source: string,
  ) {
    if (source === 'scoring') {
      return query.eq('location_id', regionId);
    }
    const level = geoLevel.toLowerCase();

    switch (level) {
      case 'national':
        if (source === 'realtor') return query.eq('country', 'United States');
        return query;

      case 'state':
        if (source === 'realtor') {
          if (regionId.length === 2) return query.eq('state_id', regionId.toUpperCase());
          return query.eq('state_name', regionId);
        } else if (source === 'zillow') {
          return query.eq('region_name', regionId);
        }
        return query.eq('state_name', regionId);

      case 'metro':
        if (/^\d+$/.test(regionId)) return query.eq('cbsa_code', regionId);
        if (source === 'zillow') return query.eq('region_name', regionId);
        return query.ilike(source === 'realtor' ? 'cbsa_title' : 'cbsa_title', `${regionId}%`);

      case 'county':
        if (/^\d+$/.test(regionId)) {
          return query.eq(source === 'realtor' ? 'county_fips' : 'fips_code', regionId);
        }
        const countyParts = regionId.split(',').map(s => s.trim());
        const countyName = countyParts[0];
        const countyState = countyParts[1];
        if (source === 'realtor') {
          const searchPattern = countyState ? `${countyName.toLowerCase()}, ${countyState.toLowerCase()}` : countyName.toLowerCase();
          return query.ilike('county_name', `${searchPattern}%`);
        }
        return query.ilike('county_name', `${countyName}%`);

      case 'zip':
        if (source === 'realtor') return query.eq('postal_code', regionId);
        if (source === 'zillow') return query.eq('region_name', regionId);
        if (source === 'census') return query.eq('zcta', regionId);
        return query.eq('postal_code', regionId);

      case 'city':
        const cityParts = regionId.split(',').map(s => s.trim());
        const cityName = cityParts[0];
        const stateCode = cityParts[1];
        if (source === 'zillow') {
          if (stateCode) return query.eq('region_name', cityName).eq('state_code', stateCode);
          return query.eq('region_name', cityName);
        }
        return query.ilike('place_name', `${cityName}%`);

      default:
        return query.eq('region_id', regionId);
    }
  }

  private getTableName(source: string, geoLevel: string): string | null {
    const level = geoLevel.toLowerCase();
    if (source === 'zillow') {
      if (level === 'metro') return 'zillow_metro';
      if (level === 'state') return 'zillow_state';
      if (level === 'county') return 'zillow_county';
      if (level === 'zip') return 'zillow_zip';
      if (level === 'city') return 'zillow_city';
    }
    if (source === 'realtor') {
      if (level === 'national') return 'realtor_national';
      if (level === 'metro') return 'realtor_metro';
      if (level === 'state') return 'realtor_state';
      if (level === 'county') return 'realtor_county';
      if (level === 'zip') return 'realtor_zip';
    }
    if (source === 'census') {
      if (level === 'national') return 'census_national';
      if (level === 'state') return 'census_state';
      if (level === 'metro') return 'census_metro';
      if (level === 'county') return 'census_county';
      if (level === 'city') return 'census_city';
      if (level === 'zip') return 'census_zip';
    }
    if (source === 'economic') {
      if (level === 'national') return 'economic_national';
      if (level === 'state') return 'economic_state';
      if (level === 'metro') return 'economic_metro';
      if (level === 'county') return 'economic_county';
    }
    if (source === 'calculated') return 'calculated_metrics';
    if (source === 'scoring') return 'propertyiq_scores';
    return null;
  }

  private getMetricMapping(metricId: string): {
    source: string;
    columnName: string;
    usesMetricName: boolean;
    metricNameValue?: string;
    scoreType?: string;
  } | null {
    const mappings: Record<string, any> = {
      listing_price: { source: 'realtor', columnName: 'median_listing_price', usesMetricName: false },
      home_value_yoy: { source: 'realtor', columnName: 'median_listing_price_yy', usesMetricName: false },
      home_value_mom: { source: 'realtor', columnName: 'median_listing_price_mm', usesMetricName: false },
      for_sale_inventory: { source: 'realtor', columnName: 'active_listing_count', usesMetricName: false },
      inventory_yoy: { source: 'realtor', columnName: 'active_listing_count_yy', usesMetricName: false },
      days_on_market: { source: 'realtor', columnName: 'median_days_on_market', usesMetricName: false },
      new_listings: { source: 'realtor', columnName: 'new_listing_count', usesMetricName: false },
      pending_listings: { source: 'realtor', columnName: 'pending_listing_count', usesMetricName: false },
      price_cut_pct: { source: 'realtor', columnName: 'price_reduced_share', usesMetricName: false },
      price_per_sqft: { source: 'realtor', columnName: 'median_listing_price_per_square_foot', usesMetricName: false },
      pending_ratio: { source: 'realtor', columnName: 'pending_ratio', usesMetricName: false },
      hotness_score: { source: 'realtor', columnName: 'hotness_score', usesMetricName: false },
      supply_score: { source: 'realtor', columnName: 'supply_score', usesMetricName: false },
      demand_score: { source: 'realtor', columnName: 'demand_score', usesMetricName: false },
      price_increase_pct: { source: 'realtor', columnName: 'price_increased_share', usesMetricName: false },
      new_listings_yoy: { source: 'realtor', columnName: 'new_listing_count_yy', usesMetricName: false },
      home_value: { source: 'zillow', columnName: 'value', usesMetricName: true, metricNameValue: 'zhvi' },
      home_price_forecast: { source: 'zillow', columnName: 'value', usesMetricName: true, metricNameValue: 'zhvf_12m' },
      rent_index: { source: 'zillow', columnName: 'value', usesMetricName: true, metricNameValue: 'zori' },
      rent_for_houses: { source: 'zillow', columnName: 'value', usesMetricName: true, metricNameValue: 'zordi_sfr' },
      sale_price: { source: 'zillow', columnName: 'value', usesMetricName: true, metricNameValue: 'sale_price' },
      sale_to_list: { source: 'zillow', columnName: 'value', usesMetricName: true, metricNameValue: 'sale_to_list' },
      home_sales: { source: 'zillow', columnName: 'value', usesMetricName: true, metricNameValue: 'sales_count' },
      market_heat: { source: 'zillow', columnName: 'value', usesMetricName: true, metricNameValue: 'market_heat_index' },
      new_construction_sales: { source: 'zillow', columnName: 'value', usesMetricName: true, metricNameValue: 'new_con_sales' },
      new_construction_price: { source: 'zillow', columnName: 'value', usesMetricName: true, metricNameValue: 'new_con_median_price' },
      new_construction_ppsf: { source: 'zillow', columnName: 'value', usesMetricName: true, metricNameValue: 'new_con_median_price_per_sqft' },
      population: { source: 'census', columnName: 'total_population', usesMetricName: false },
      population_growth: { source: 'census', columnName: 'population_yoy', usesMetricName: false },
      median_income: { source: 'census', columnName: 'median_household_income', usesMetricName: false },
      income_growth: { source: 'census', columnName: 'income_yoy', usesMetricName: false },
      median_age: { source: 'census', columnName: 'median_age', usesMetricName: false },
      homeownership_rate: { source: 'census', columnName: 'homeownership_rate', usesMetricName: false },
      unemployment_rate: { source: 'economic', columnName: 'unemployment_rate', usesMetricName: false },
      job_growth: { source: 'economic', columnName: 'employment_yoy', usesMetricName: false },
      gdp_growth: { source: 'economic', columnName: 'gdp_yoy', usesMetricName: false },
      cost_of_living: { source: 'economic', columnName: 'rpp_all_items', usesMetricName: false },
      cap_rate: { source: 'calculated', columnName: 'cap_rate', usesMetricName: false },
      homeready: { source: 'scoring', columnName: 'score', usesMetricName: false, scoreType: 'homeready' },
      investoredge: { source: 'scoring', columnName: 'score', usesMetricName: false, scoreType: 'investoredge' },
      markethealth: { source: 'scoring', columnName: 'score', usesMetricName: false, scoreType: 'markethealth' },
    };
    return mappings[metricId] || null;
  }
}
