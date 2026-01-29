import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { normalizeZipKey } from '../common/zip';
import {
  normalizeStateRegionId,
  normalizeCountyFips,
  normalizeCbsaCode,
} from '../common/geo';

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

    // Handle On-the-Fly Calculation for Investment Metrics (Cap Rate, etc.)
    // This avoids storing millions of rows of derived historical data.
    if (mapping.source === 'computed_investment') {
      return this.getComputedInvestmentTimeSeries(metricId, geoLevel, regionId, startDate, endDate, limit, lastPoints);
    }

    // Handle On-the-Fly for Overvalued (ZHVI vs Income)
    if (mapping.source === 'computed_overvalued') {
      return this.getComputedOvervaluedTimeSeries(geoLevel, regionId, startDate, endDate, limit, lastPoints);
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
   * Helper to fetch raw time series for computation
   */
  private async getRawSeries(
    source: string,
    metricName: string,
    geoLevel: string,
    regionId: string,
    startDate?: string,
    endDate?: string
  ): Promise<TimeSeriesDataPoint[]> {
    // Mock mapping for the raw metric
    const tempMapping = {
      source: source,
      columnName: 'value', // Zillow uses 'value'
      usesMetricName: true,
      metricNameValue: metricName,
    };

    const query = this.supabase
      .from(this.getTableName(source, geoLevel)!)
      .select('period_date, value')
      .eq('metric_name', metricName)
      .order('period_date', { ascending: true }); // Always get ascending for merge

    const qWithGeo = this.addRegionFilter(query, geoLevel, regionId, source);

    // We process filtering in memory if needed, but better to filter in DB
    if (startDate) qWithGeo.gte('period_date', startDate);
    if (endDate) qWithGeo.lte('period_date', endDate);

    // Fetch all (paginate if needed, but for single series it handles <1000 usually. 
    // Actually Zillow series is monthly * 10 years = 120 points. Safe.)
    const { data, error } = await qWithGeo.limit(2000);

    if (error || !data) return [];
    return data.map((r: any) => ({ date: r.period_date, value: r.value }));
  }

  /**
   * Compute Investment Metrics on the fly
   */
  private async getComputedInvestmentTimeSeries(
    metricId: string,
    geoLevel: string,
    regionId: string,
    startDate?: string,
    endDate?: string,
    limit?: number,
    lastPoints?: number
  ): Promise<TimeSeriesDataPoint[]> {
    // 1. Fetch ZHVI (Price)
    const prices = await this.getRawSeries('zillow', 'zhvi', geoLevel, regionId, startDate, endDate);

    // 2. Fetch ZORI (Rent)
    // Note: for ZIPs, we might need fallback logic? 
    // The current frontend requirements are just "get history".
    // If we want exact parity with CalculateMetricsService fallback, we'd need to fetch County ZORI too.
    // For now, let's implement direct ZORI. If missing, it will gap.
    let rents = await this.getRawSeries('zillow', 'zori', geoLevel, regionId, startDate, endDate);
    if (rents.length === 0 && geoLevel === 'zip') {
      // Try fetching zordi_sfr (Rent for houses) as backup?
      rents = await this.getRawSeries('zillow', 'zordi_sfr', geoLevel, regionId, startDate, endDate);
    }

    if (prices.length === 0 || rents.length === 0) return [];

    // 3. Align and Compute
    const priceMap = new Map(prices.map(p => [p.date, p.value]));
    const result: TimeSeriesDataPoint[] = [];

    for (const rent of rents) {
      const price = priceMap.get(rent.date);
      if (!price) continue;

      let val = 0;
      if (metricId === 'cap_rate') {
        // (Rent * 12 * 0.6) / Price * 100
        val = ((rent.value * 12 * 0.6) / price) * 100;
        val = Math.round(val * 100) / 100;
      } else if (metricId === 'gross_yield') {
        // (Rent * 12) / Price * 100
        val = ((rent.value * 12) / price) * 100;
        val = Math.round(val * 100) / 100;
      } else if (metricId === 'rent_to_price_ratio') {
        // Rent / Price
        val = rent.value / price; // Raw ratio
        val = Math.round(val * 10000) / 10000;
      } else if (metricId === 'grm') {
        // Price / (Rent * 12)
        val = price / (rent.value * 12);
        val = Math.round(val * 100) / 100;
      }

      result.push({ date: rent.date, value: val });
    }

    // Handle lastPoints logic
    if (lastPoints && lastPoints > 0) {
      // Sort desc, take N, reverse back to asc?
      // Array is currently Ascending (from Zillow queries)
      // So take LAST N
      const len = result.length;
      return result.slice(Math.max(0, len - lastPoints));
    }

    // Handle limit (if simple limit from start?)
    if (limit && limit > 0) {
      return result.slice(0, limit);
    }

    return result;
  }

  /**
   * Compute Overvalued Spectrum on the fly
   */
  private async getComputedOvervaluedTimeSeries(
    geoLevel: string,
    regionId: string,
    startDate?: string,
    endDate?: string,
    limit?: number,
    lastPoints?: number
  ): Promise<TimeSeriesDataPoint[]> {
    // 1. Fetch ZHVI
    const prices = await this.getRawSeries('zillow', 'zhvi', geoLevel, regionId, startDate, endDate);
    if (prices.length === 0) return [];

    // 2. Fetch Income (Annual)
    // This uses 'census' source, which maps to 'year'. 
    // We need to fetch it manually because getRawSeries assumes Zillow 'metric_name'.
    // Implementation: Fetch census_metro/state/county median_income.
    const incomeTable = this.getTableName('census', geoLevel);
    if (!incomeTable) return []; // Census only has some geos

    const iQuery = this.supabase
      .from(incomeTable)
      .select('year, median_household_income')
      .order('year', { ascending: true });

    const iQueryGeo = this.addRegionFilter(iQuery, geoLevel, regionId, 'census');
    const { data: incomeData } = await iQueryGeo;

    if (!incomeData || incomeData.length === 0) return [];

    // Map Year -> Income
    const incomeMap: Record<number, number> = {};
    incomeData.forEach((row: any) => {
      if (row.year && row.median_household_income) {
        incomeMap[row.year] = row.median_household_income;
      }
    });
    // Get sorted years for fallback
    const years = Object.keys(incomeMap).map(Number).sort((a, b) => a - b);
    const latestYear = years[years.length - 1];

    // 3. Merge
    const result: TimeSeriesDataPoint[] = [];
    const NATIONAL_MEDIAN_INCOME = 75000; // Fallback if no local data
    const BENCHMARK = 3.5;

    for (const p of prices) {
      const y = parseInt(p.date.substring(0, 4));
      // Find best income year <= y
      let inc = incomeMap[y];
      if (!inc) {
        // Try to find closest year <= y
        const closeY = years.reverse().find(yr => yr <= y);
        inc = closeY ? incomeMap[closeY] : incomeMap[years[0]]; // fallback to any
        years.reverse(); // put back
      }
      // Fallback to national if absolutely nothing (unlikely if table exists)
      if (!inc) inc = NATIONAL_MEDIAN_INCOME;

      const ratio = p.value / inc;
      const overvalued = ((ratio - BENCHMARK) / BENCHMARK) * 100;

      result.push({
        date: p.date,
        value: Math.round(overvalued * 10) / 10
      });
    }

    if (lastPoints && lastPoints > 0) {
      return result.slice(Math.max(0, result.length - lastPoints));
    }
    if (limit && limit > 0) return result.slice(0, limit);

    return result;
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

    // For computed metrics, use the availability of the underlying Zillow data (ZHVI)
    let source = mapping.source;
    let tableSource = source;
    let metricNameFilter = mapping.usesMetricName ? mapping.metricNameValue : undefined;

    if (source === 'computed_investment' || source === 'computed_overvalued') {
      tableSource = 'zillow';
      metricNameFilter = 'zhvi';
    }

    const table = this.getTableName(tableSource, geoLevel);
    if (!table) {
      return { minDate: '', maxDate: '', count: 0 };
    }

    try {
      let query = this.supabase
        .from(table)
        .select('period_date')
        .order('period_date', { ascending: true });

      // For Zillow tables (or if we are checking computed metrics backed by zillow), filter by metric_name
      if (metricNameFilter) {
        query = query.eq('metric_name', metricNameFilter);
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
   * Add region-specific filter based on geography level and data source.
   *
   * CONTRACT: This method accepts regionId in ANY format:
   *   - Numeric IDs (CBSA codes, FIPS codes, ZIP codes) -> query by code/id column
   *   - Text names (metro names, county names) -> query by name column with ILIKE
   *
   * The data binding layer (frontend hooks) relies on this contract to pass
   * regionIds directly from GeoJSON features without pre-processing.
   *
   * IMPORTANT: When checking whether to use code vs name lookup, ALWAYS check
   * if regionId is numeric FIRST using isNumericId(), not whether normalization
   * changed the value. This ensures IDs like "31080" (already 5 digits) still
   * use the code column, not the name column.
   *
   * Column names vary by data source:
   * - Realtor: state_id, cbsa_code/cbsa_title, county_fips/county_name, postal_code
   * - Zillow: region_name (for state/city/zip), cbsa_code, fips_code
   * - Census: state_fips/state_name, cbsa_code/cbsa_title, fips_code/county_name, zcta
   * - Economic: state_fips/state_name, cbsa_code/cbsa_title, fips_code/county_name
   * - Calculated: geography_id, geography_name, geography_type
   * - PropertyIQ: location_id, location_name, geography
   */
  private addRegionFilter(
    query: any,
    geoLevel: string,
    regionId: string,
    source: string,
  ) {
    const level = geoLevel.toLowerCase();

    // Helper: Check if regionId is a numeric code (CBSA, FIPS, ZIP)
    // CRITICAL: Use this for code vs name decisions, NOT normalization comparison
    const isNumericId = (id: string) => /^\d+$/.test(id.trim());

    // Normalize IDs so frontend can send FIPS, code, or name interchangeably
    const regionKey = level === 'zip' ? normalizeZipKey(regionId) : regionId;
    const stateNorm = level === 'state' ? normalizeStateRegionId(regionId) : null;
    const stateKey = stateNorm ? { code: stateNorm.stateCode, fips: stateNorm.stateFips, name: stateNorm.stateName } : null;
    const countyKey = level === 'county' && isNumericId(regionId) ? normalizeCountyFips(regionId) : regionId;
    const metroKey = level === 'metro' && isNumericId(regionId) ? normalizeCbsaCode(regionId) : regionId;

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
          // Use isNumericId to determine code vs name lookup
          if (isNumericId(regionId)) {
            return query.eq('geography_id', metroKey);
          }
          // Non-numeric regionId = metro name, use name-based lookup
          return query.ilike('geography_name', `${regionId}%`);

        case 'county':
          // Use isNumericId to determine code vs name lookup
          if (isNumericId(regionId)) {
            return query.eq('geography_id', countyKey);
          }
          // Non-numeric regionId = county name, use name-based lookup
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

        case 'tract':
          // Tracts use GEOID (11-digit: state 2 + county 3 + tract 6)
          if (isNumericId(regionId)) {
            return query.eq('geography_id', regionId.trim().padStart(11, '0'));
          }
          return query.ilike('geography_name', `${regionId}%`);

        default:
          return query.eq('geography_id', regionId);
      }
    }

    // Handle propertyiq_scores table (uses location_id, location_name, geography, score_type)
    if (source === 'propertyiq') {
      // Add geography filter (propertyiq_scores uses 'geography' column, not 'geography_type')
      query = query.eq('geography', level);

      switch (level) {
        case 'national':
          // National uses location_id = 'US' or location_name = 'United States'
          if (regionId === 'United States' || regionId === 'US') {
            return query.or('location_id.eq.US,location_name.ilike.United States');
          }
          return query.eq('location_id', regionId);

        case 'state':
          if (stateKey) {
            return query.eq('location_id', stateKey.code);
          }
          // Check if numeric (FIPS) or text (name/code)
          if (isNumericId(regionId) && regionId.trim().length <= 2) {
            return query.eq('location_id', regionId.trim().padStart(2, '0'));
          }
          return query.eq('location_id', regionId);

        case 'metro':
          // Use isNumericId to determine code vs name lookup
          if (isNumericId(regionId)) {
            return query.eq('location_id', metroKey);
          }
          // Non-numeric regionId = metro name, use name-based lookup
          return query.ilike('location_name', `${regionId}%`);

        case 'county':
          // Use isNumericId to determine code vs name lookup
          if (isNumericId(regionId)) {
            return query.eq('location_id', countyKey);
          }
          // Non-numeric regionId = county name, use name-based lookup
          // Parse "County, State" format if present
          const countyParts2 = regionId.split(',').map(s => s.trim());
          const countyName2 = countyParts2[0];
          return query.ilike('location_name', `${countyName2}%`);

        case 'zip':
          // ZIPs: location_id is the ZIP code (regionKey normalized)
          return query.eq('location_id', regionKey);

        case 'city':
          // Parse "City, State" format if present
          const cityParts2 = regionId.split(',').map(s => s.trim());
          const cityName2 = cityParts2[0];
          return query.ilike('location_name', `${cityName2}%`);

        case 'tract':
          // Tracts use GEOID (11-digit: state 2 + county 3 + tract 6)
          if (isNumericId(regionId)) {
            return query.eq('location_id', regionId.trim().padStart(11, '0'));
          }
          return query.ilike('location_name', `${regionId}%`);

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
        // Use isNumericId pattern for state FIPS codes
        if (isNumericId(regionId) && regionId.trim().length <= 2) {
          return query.eq('state_fips', regionId.trim().padStart(2, '0'));
        }
        return query.eq('state_name', regionId);

      case 'metro':
        // Use isNumericId to determine code vs name lookup
        if (isNumericId(regionId)) {
          return query.eq('cbsa_code', metroKey);
        }
        // Non-numeric regionId = metro name, use name-based lookup
        if (source === 'zillow') {
          return query.eq('region_name', regionId);
        }
        // Realtor: use cbsa_title with ILIKE for fuzzy matching
        // This allows matching "Chicago" to "Chicago-Naperville-Elgin, IL-IN"
        if (source === 'realtor') {
          return query.ilike('cbsa_title', `${regionId}%`);
        }
        // Census/Economic: use cbsa_title for name-based lookup
        return query.ilike('cbsa_title', `${regionId}%`);

      case 'county':
        // Use isNumericId to determine code vs name lookup
        if (isNumericId(regionId)) {
          if (source === 'realtor') {
            return query.eq('county_fips', countyKey);
          }
          return query.eq('fips_code', countyKey);
        }
        // Non-numeric regionId = county name, use name-based lookup
        // Parse "County, State" format if present (e.g., "Cook, IL")
        const countyParts3 = regionId.split(',').map(s => s.trim());
        const countyName3 = countyParts3[0];
        const countyState = countyParts3[1]; // May be undefined

        // Realtor: county_name is lowercase "cook, il" format
        if (source === 'realtor') {
          // Realtor format includes state, so we can match directly
          // e.g., "Cook, IL" -> "cook, il"
          const searchPattern = countyState
            ? `${countyName3.toLowerCase()}, ${countyState.toLowerCase()}`
            : countyName3.toLowerCase();
          return query.ilike('county_name', `${searchPattern}%`);
        }
        // Census/Economic: county_name is "Cook County, Illinois" format
        // Just match on county name prefix
        return query.ilike('county_name', `${countyName3}%`);

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

      case 'tract':
        // Tracts use GEOID (11-digit: state 2 + county 3 + tract 6)
        // Use isNumericId to determine code vs name lookup
        if (isNumericId(regionId)) {
          const tractId = regionId.trim().padStart(11, '0');
          if (source === 'census') {
            return query.eq('tract_geoid', tractId);
          }
          return query.eq('geoid', tractId);
        }
        // Non-numeric regionId = tract name, use name-based lookup
        return query.ilike('tract_name', `${regionId}%`);

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
      // CALCULATED METRICS (Direct or Computed)
      // ========================================================================
      cap_rate: {
        source: 'computed_investment',
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
        source: 'computed_investment',
        columnName: 'gross_yield',
        usesMetricName: false,
      },
      grm: {
        source: 'computed_investment',
        columnName: 'grm',
        usesMetricName: false,
      },
      rent_to_price_ratio: {
        source: 'computed_investment',
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
        source: 'computed_overvalued',
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
