import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { normalizeZipKey } from '../common/zip';
import {
  normalizeStateRegionId,
  normalizeCountyFips,
  normalizeCbsaCode,
} from '../common/geo.js';

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
 *
 * @version 2.0.0 - Fixed column name mappings for all data sources
 */
/** Supabase default row limit; we paginate when no limit is requested so graphs can get full history. */
const TIMESERIES_PAGE_SIZE = 1000;

@Injectable()
export class TimeSeriesService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) { }

  /**
   * Get time series data for a specific metric/geography/region.
   * When lastPoints is set, returns the most recent lastPoints points (for history/trend).
   */
  async getTimeSeries(
    metricId: string,
    geoLevel: string,
    regionId: string,
    startDate?: string,
    endDate?: string,
    limit?: number,
    lastPoints?: number,
  ): Promise<TimeSeriesDataPoint[]> {
    console.log('[TimeSeriesService] getTimeSeries called:', {
      metricId,
      geoLevel,
      regionId,
      startDate,
      endDate,
    });

    const mapping = this.getMetricMapping(metricId);
    if (!mapping) {
      console.log('[TimeSeriesService] No mapping found for metric:', metricId);
      return [];
    }
    console.log('[TimeSeriesService] Mapping:', {
      source: mapping.source,
      columnName: mapping.columnName,
      usesMetricName: mapping.usesMetricName,
    });

    const table = this.getTableName(mapping.source, geoLevel);
    if (!table) {
      console.log('[TimeSeriesService] No table found for:', {
        source: mapping.source,
        geoLevel,
      });
      return [];
    }
    console.log('[TimeSeriesService] Using table:', table);

    try {
      // Census tables use 'year' field, others use 'period_date'
      // PropertyIQ scores use 'score_date'
      const dateField = mapping.source === 'census' 
        ? 'year' 
        : mapping.source === 'propertyiq'
        ? 'score_date'
        : 'period_date';

      // When lastPoints is set we need most recent points: order desc, limit, then reverse
      const useLastPoints = lastPoints != null && lastPoints > 0 && !startDate && !endDate;
      let query = this.supabase
        .from(table)
        .select(`${dateField}, ${mapping.columnName}`)
        .order(dateField, { ascending: !useLastPoints });

      // Add region filter
      query = this.addRegionFilter(query, geoLevel, regionId, mapping.source);

      // For calculated metrics, filter out null values
      if (mapping.source === 'calculated') {
        query = query.not(mapping.columnName, 'is', null);
      }

      // For PropertyIQ scores, filter by score_type and exclude null values
      if (mapping.source === 'propertyiq') {
        query = query.eq('score_type', mapping.metricNameValue);
        query = query.not(mapping.columnName, 'is', null);
      }

      // For Zillow tables, add metric_name filter
      if (mapping.usesMetricName && mapping.source === 'zillow') {
        query = query.eq('metric_name', mapping.metricNameValue);
      }

      // Add date/year filters
      if (startDate) {
        if (mapping.source === 'census') {
          // Extract year from date string (YYYY-MM-DD -> YYYY)
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

      // Add limit (when lastPoints we take that many; else use limit). When no limit and date range, paginate to get full history.
      if (useLastPoints) {
        query = query.limit(lastPoints!);
      } else if (limit) {
        query = query.limit(limit);
      }

      type Row = Record<string, unknown>;
      let data: Row[];
      if (!useLastPoints && !limit) {
        // Paginate to bypass Supabase default row cap so graphing page can get all history
        data = [];
        let offset = 0;
        let page: Row[];
        do {
          const { data: pageData, error: pageError } = await query.range(
            offset,
            offset + TIMESERIES_PAGE_SIZE - 1,
          );
          if (pageError) {
            throw new Error(
              `Error fetching time series for ${metricId}: ${pageError.message}`,
            );
          }
          page = (pageData ?? []) as unknown as Row[];
          data = data.concat(page);
          offset += page.length;
        } while (page.length === TIMESERIES_PAGE_SIZE);
      } else {
        const res = await query;
        if (res.error) {
          throw new Error(
            `Error fetching time series for ${metricId}: ${res.error.message}`,
          );
        }
        data = (res.data ?? []) as unknown as Row[];
      }

      console.log('[TimeSeriesService] Query result:', {
        rowCount: data?.length || 0,
        sampleRow: data?.[0],
      });

      if (!data || data.length === 0) {
        console.log('[TimeSeriesService] No data returned');
        return [];
      }

      // Transform to standard format
      let result: TimeSeriesDataPoint[] = data.map((row: Row) => {
        const rawDate = row[dateField];
        const dateStr =
          mapping.source === 'census'
            ? `${String(rawDate ?? '')}-01-01`
            : String(rawDate ?? '');
        return {
          date: dateStr,
          value: Number(row[mapping.columnName]) || 0,
        };
      });
      if (useLastPoints && result.length > 0) {
        result = result.reverse();
      }
      console.log(
        '[TimeSeriesService] Returning',
        result.length,
        'points, sample:',
        result[0],
      );
      return result;
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
      let query = this.supabase
        .from(table)
        .select('period_date')
        .order('period_date', { ascending: true });

      // For Zillow tables, filter by metric_name
      if (mapping.usesMetricName) {
        query = query.eq('metric_name', mapping.metricNameValue);
      }

      const { data, error } = await query;

      if (error || !data || data.length === 0) {
        return { minDate: '', maxDate: '', count: 0 };
      }

      const dates = data.map((d) => d.period_date);
      const uniqueDates = [...new Set(dates)];

      return {
        minDate: uniqueDates[0],
        maxDate: uniqueDates[uniqueDates.length - 1],
        count: uniqueDates.length,
      };
    } catch (err) {
      console.error(`Error getting date range for ${metricId}:`, err);
      return { minDate: '', maxDate: '', count: 0 };
    }
  }

  /**
   * Add region-specific filter based on geography level and data source
   *
   * Column names vary by data source:
   * - Realtor: state_name, county_fips, postal_code, country
   * - Zillow: region_name (for state/city/zip), cbsa_code, fips_code
   * - Census: state_name, cbsa_code, fips_code, zcta, place_name
   * - Economic: state_name, cbsa_code, fips_code
   * - Calculated: geography_id, geography_name, geography_type
   */
  private addRegionFilter(
    query: any,
    geoLevel: string,
    regionId: string,
    source: string,
  ) {
    const level = geoLevel.toLowerCase();
    // Normalize IDs so frontend can send FIPS, code, or name interchangeably
    const regionKey = level === 'zip' ? normalizeZipKey(regionId) : regionId;
    const stateNorm = level === 'state' ? normalizeStateRegionId(regionId) : null;
    const stateKey = stateNorm ? { code: stateNorm.stateCode, fips: stateNorm.stateFips, name: stateNorm.stateName } : null;
    const countyKey = level === 'county' && /^\d+$/.test(regionId.trim()) ? normalizeCountyFips(regionId) : regionId;
    const metroKey = level === 'metro' && /^\d+$/.test(regionId.trim()) ? normalizeCbsaCode(regionId) : regionId;

    // Handle calculated_metrics table (uses geography_id and geography_type)
    if (source === 'calculated') {
      // First, add geography_type filter
      query = query.eq('geography_type', level);

      switch (level) {
        case 'national':
          // National uses geography_id = 'US' or geography_name = 'United States'
          if (regionId === 'United States' || regionId === 'US') {
            return query.or('geography_id.eq.US,geography_name.ilike.United States');
          }
          return query.eq('geography_id', regionId);

        case 'state':
          // States: geography_id is state code; accept FIPS, code, or name
          if (stateKey) {
            return query.eq('geography_id', stateKey.code);
          }
          return query.or(`geography_id.ilike.${regionId},geography_name.ilike.${regionId}`);

        case 'metro':
          // Metros: If numeric, use geography_id (CBSA code, normalized), otherwise match geography_name
          if (metroKey !== regionId) {
            return query.eq('geography_id', metroKey);
          }
          return query.ilike('geography_name', `${regionId}%`);

        case 'county':
          // Counties: If numeric (FIPS), use geography_id (5-digit normalized), otherwise match geography_name
          if (countyKey !== regionId) {
            return query.eq('geography_id', countyKey);
          }
          // Parse "County, State" format if present
          const countyParts = regionId.split(',').map(s => s.trim());
          const countyName = countyParts[0];
          return query.ilike('geography_name', `${countyName}%`);

        case 'zip':
          // ZIPs: geography_id is the ZIP code (regionKey normalized)
          return query.eq('geography_id', regionKey);

        case 'city':
          // Cities: match by geography_name
          const cityParts = regionId.split(',').map(s => s.trim());
          const cityName = cityParts[0];
          return query.ilike('geography_name', `${cityName}%`);

        default:
          return query.eq('geography_id', regionId);
      }
    }

    // Handle propertyiq_scores table (uses location_id, location_name, geography, score_type)
    if (source === 'propertyiq') {
      // Add geography filter (propertyiq_scores uses 'geography' column, not 'geography_type')
      query = query.eq('geography', level);

      switch (level) {
        case 'state':
          if (stateKey) {
            return query.eq('location_id', stateKey.code);
          }
          return query.eq('location_id', regionId);

        case 'metro':
          if (metroKey !== regionId) {
            return query.eq('location_id', metroKey);
          }
          return query.ilike('location_name', `${regionId}%`);

        case 'county':
          if (countyKey !== regionId) {
            return query.eq('location_id', countyKey);
          }
          // Parse "County, State" format if present
          const countyParts = regionId.split(',').map(s => s.trim());
          const countyName = countyParts[0];
          return query.ilike('location_name', `${countyName}%`);

        case 'zip':
          // ZIPs: location_id is the ZIP code (regionKey normalized)
          return query.eq('location_id', regionKey);

        default:
          return query.eq('location_id', regionId);
      }
    }

    switch (level) {
      case 'national':
        // Realtor national uses 'country' column
        // Census/Economic national tables have only one row per period, no region filter needed
        if (source === 'realtor') {
          return query.eq('country', 'United States');
        }
        // Census and Economic national tables don't need a region filter
        // They have only one row per period_date/year
        return query;

      case 'state':
        // Realtor: state_id (2-letter); Zillow: region_name (full name); Census/Economic: state_fips or state_name
        if (stateKey) {
          if (source === 'realtor') {
            return query.eq('state_id', stateKey.code);
          }
          if (source === 'zillow') {
            return query.eq('region_name', stateKey.name);
          }
          return query.eq('state_fips', stateKey.fips);
        }
        if (source === 'realtor') {
          if (regionId.length === 2 && /^[A-Za-z]{2}$/.test(regionId)) {
            return query.eq('state_id', regionId.toUpperCase());
          }
          return query.eq('state_name', regionId);
        }
        if (source === 'zillow') {
          return query.eq('region_name', regionId);
        }
        if (/^\d{1,2}$/.test(regionId.trim())) {
          return query.eq('state_fips', regionId.trim().padStart(2, '0'));
        }
        return query.eq('state_name', regionId);

      case 'metro':
        if (metroKey !== regionId) {
          return query.eq('cbsa_code', metroKey);
        }
        // Zillow: use region_name for text-based lookup
        if (source === 'zillow') {
          return query.eq('region_name', regionId);
        }
        // Realtor: use cbsa_title with ILIKE for fuzzy matching
        // This allows matching "Chicago" to "Chicago-Naperville-Elgin, IL-IN"
        if (source === 'realtor') {
          return query.ilike('cbsa_title', `${regionId}%`);
        }
        // Census/Economic: try cbsa_title first (text), fall back to cbsa_code
        return query.ilike('cbsa_title', `${regionId}%`);

      case 'county':
        if (countyKey !== regionId) {
          if (source === 'realtor') {
            return query.eq('county_fips', countyKey);
          }
          return query.eq('fips_code', countyKey);
        }
        // Parse "County, State" format if present (e.g., "Cook, IL")
        const countyParts = regionId.split(',').map(s => s.trim());
        const countyName = countyParts[0];
        const countyState = countyParts[1]; // May be undefined

        // Realtor: county_name is lowercase "cook, il" format
        if (source === 'realtor') {
          // Realtor format includes state, so we can match directly
          // e.g., "Cook, IL" -> "cook, il"
          const searchPattern = countyState
            ? `${countyName.toLowerCase()}, ${countyState.toLowerCase()}`
            : countyName.toLowerCase();
          return query.ilike('county_name', `${searchPattern}%`);
        }
        // Census/Economic: county_name is "Cook County, Illinois" format
        // Just match on county name prefix
        return query.ilike('county_name', `${countyName}%`);

      case 'zip':
        // Realtor: postal_code; Zillow: region_name; Census: zcta (all stored normalized)
        if (source === 'realtor') {
          return query.eq('postal_code', regionKey);
        } else if (source === 'zillow') {
          return query.eq('region_name', regionKey);
        } else if (source === 'census') {
          return query.eq('zcta', regionKey);
        }
        return query.eq('postal_code', regionKey);

      case 'city':
        // Parse "City, State" format if present (e.g., "Miami, FL")
        const cityParts = regionId.split(',').map(s => s.trim());
        const cityName = cityParts[0];
        const stateCode = cityParts[1]; // May be undefined

        // Zillow: has separate region_name and state_code columns
        if (source === 'zillow') {
          if (stateCode) {
            return query.eq('region_name', cityName).eq('state_code', stateCode);
          }
          return query.eq('region_name', cityName);
        }
        // Census: place_name has suffix like "Miami city", "Miami Beach city"
        // Use ILIKE to match "Miami" to "Miami city"
        return query.ilike('place_name', `${cityName}%`);

      default:
        return query.eq('region_id', regionId);
    }
  }

  /**
   * Get table name based on data source and geography level
   */
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

    if (source === 'calculated') {
      return 'calculated_metrics';
    }

    if (source === 'propertyiq') {
      return 'propertyiq_scores';
    }

    return null;
  }

  /**
   * Map frontend metric ID to database table source and column name.
   *
   * This mapping EXACTLY matches what the map page uses:
   * - Realtor tables: Direct column names (e.g., median_listing_price)
   * - Zillow tables: metric_name filter + value column
   */
  private getMetricMapping(metricId: string): {
    source: string;
    columnName: string;
    usesMetricName: boolean;
    metricNameValue?: string;
  } | null {
    const mappings: Record<
      string,
      {
        source: string;
        columnName: string;
        usesMetricName: boolean;
        metricNameValue?: string;
      }
    > = {
      // ========================================================================
      // REALTOR METRICS (Direct Column Names)
      // ========================================================================
      listing_price: {
        source: 'realtor',
        columnName: 'median_listing_price',
        usesMetricName: false,
      },
      home_value_yoy: {
        source: 'realtor',
        columnName: 'median_listing_price_yy',
        usesMetricName: false,
      },
      home_value_mom: {
        source: 'realtor',
        columnName: 'median_listing_price_mm',
        usesMetricName: false,
      },
      for_sale_inventory: {
        source: 'realtor',
        columnName: 'active_listing_count',
        usesMetricName: false,
      },
      inventory_yoy: {
        source: 'realtor',
        columnName: 'active_listing_count_yy',
        usesMetricName: false,
      },
      days_on_market: {
        source: 'realtor',
        columnName: 'median_days_on_market',
        usesMetricName: false,
      },
      new_listings: {
        source: 'realtor',
        columnName: 'new_listing_count',
        usesMetricName: false,
      },
      pending_listings: {
        source: 'realtor',
        columnName: 'pending_listing_count',
        usesMetricName: false,
      },
      price_cut_pct: {
        source: 'realtor',
        columnName: 'price_reduced_share',
        usesMetricName: false,
      },
      price_per_sqft: {
        source: 'realtor',
        columnName: 'median_listing_price_per_square_foot',
        usesMetricName: false,
      },
      pending_ratio: {
        source: 'realtor',
        columnName: 'pending_ratio',
        usesMetricName: false,
      },
      hotness_score: {
        source: 'realtor',
        columnName: 'hotness_score',
        usesMetricName: false,
      },
      supply_score: {
        source: 'realtor',
        columnName: 'supply_score',
        usesMetricName: false,
      },
      demand_score: {
        source: 'realtor',
        columnName: 'demand_score',
        usesMetricName: false,
      },
      price_increase_pct: {
        source: 'realtor',
        columnName: 'price_increased_share',
        usesMetricName: false,
      },
      new_listings_yoy: {
        source: 'realtor',
        columnName: 'new_listing_count_yy',
        usesMetricName: false,
      },


      // ========================================================================
      // ZILLOW METRICS (Uses metric_name + value column)
      // ========================================================================
      home_value: {
        source: 'zillow',
        columnName: 'value',
        usesMetricName: true,
        metricNameValue: 'zhvi',
      },
      home_price_forecast: {
        source: 'zillow',
        columnName: 'value',
        usesMetricName: true,
        metricNameValue: 'zhvf_12m',
      },
      rent_index: {
        source: 'zillow',
        columnName: 'value',
        usesMetricName: true,
        metricNameValue: 'zori',
      },
      rent_for_houses: {
        source: 'zillow',
        columnName: 'value',
        usesMetricName: true,
        metricNameValue: 'zordi_sfr',
      },
      sale_price: {
        source: 'zillow',
        columnName: 'value',
        usesMetricName: true,
        metricNameValue: 'sale_price',
      },
      sale_to_list: {
        source: 'zillow',
        columnName: 'value',
        usesMetricName: true,
        metricNameValue: 'sale_to_list',
      },
      home_sales: {
        source: 'zillow',
        columnName: 'value',
        usesMetricName: true,
        metricNameValue: 'sales_count',
      },
      market_heat: {
        source: 'zillow',
        columnName: 'value',
        usesMetricName: true,
        metricNameValue: 'market_heat_index',
      },
      new_construction_sales: {
        source: 'zillow',
        columnName: 'value',
        usesMetricName: true,
        metricNameValue: 'new_con_sales',
      },
      new_construction_price: {
        source: 'zillow',
        columnName: 'value',
        usesMetricName: true,
        metricNameValue: 'new_con_median_price',
      },
      new_construction_ppsf: {
        source: 'zillow',
        columnName: 'value',
        usesMetricName: true,
        metricNameValue: 'new_con_median_price_per_sqft',
      },

      // ========================================================================
      // CENSUS/DEMOGRAPHIC METRICS (Direct Column Names, uses 'year' not 'period_date')
      // ========================================================================
      population: {
        source: 'census',
        columnName: 'total_population',
        usesMetricName: false,
      },
      population_growth: {
        source: 'census',
        columnName: 'population_yoy',
        usesMetricName: false,
      },
      median_income: {
        source: 'census',
        columnName: 'median_household_income',
        usesMetricName: false,
      },
      income_growth: {
        source: 'census',
        columnName: 'income_yoy',
        usesMetricName: false,
      },
      median_age: {
        source: 'census',
        columnName: 'median_age',
        usesMetricName: false,
      },
      homeownership_rate: {
        source: 'census',
        columnName: 'homeownership_rate',
        usesMetricName: false,
      },

      // ========================================================================
      // ECONOMIC METRICS (Direct Column Names)
      // ========================================================================
      unemployment_rate: {
        source: 'economic',
        columnName: 'unemployment_rate',
        usesMetricName: false,
      },
      job_growth: {
        source: 'economic',
        columnName: 'employment_yoy',
        usesMetricName: false,
      },
      gdp_growth: {
        source: 'economic',
        columnName: 'gdp_yoy',
        usesMetricName: false,
      },
      cost_of_living: {
        source: 'economic',
        columnName: 'rpp_all_items',
        usesMetricName: false,
      },
      // ========================================================================
      // CALCULATED METRICS (from calculated_metrics table)
      // ========================================================================
      cap_rate: {
        source: 'calculated',
        columnName: 'cap_rate',
        usesMetricName: false,
      },
      income_to_buy: {
        source: 'calculated',
        columnName: 'income_to_buy',
        usesMetricName: false,
      },
      years_to_save: {
        source: 'calculated',
        columnName: 'years_to_save',
        usesMetricName: false,
      },
      affordable_home_price: {
        source: 'calculated',
        columnName: 'affordable_home_price',
        usesMetricName: false,
      },
      gross_yield: {
        source: 'calculated',
        columnName: 'gross_yield',
        usesMetricName: false,
      },
      grm: {
        source: 'calculated',
        columnName: 'grm',
        usesMetricName: false,
      },
      rent_to_price_ratio: {
        source: 'calculated',
        columnName: 'rent_to_price_ratio',
        usesMetricName: false,
      },
      investment_score: {
        source: 'calculated',
        columnName: 'investment_score',
        usesMetricName: false,
      },
      long_term_growth_score: {
        source: 'calculated',
        columnName: 'long_term_growth_score',
        usesMetricName: false,
      },
      overvalued_pct: {
        source: 'calculated',
        columnName: 'overvalued_pct',
        usesMetricName: false,
      },
      inventory_surplus: {
        source: 'calculated',
        columnName: 'inventory_surplus_pct',
        usesMetricName: false,
      },
      // ========================================================================
      // PROPERTYIQ SCORES (from propertyiq_scores table)
      // ========================================================================
      homeready_score: {
        source: 'propertyiq',
        columnName: 'score',
        usesMetricName: true,
        metricNameValue: 'homeready',
      },
      investoredge_score: {
        source: 'propertyiq',
        columnName: 'score',
        usesMetricName: true,
        metricNameValue: 'investoredge',
      },
      market_health_score: {
        source: 'propertyiq',
        columnName: 'score',
        usesMetricName: true,
        metricNameValue: 'markethealth',
      },
    };

    return mappings[metricId] || null;
  }
}
