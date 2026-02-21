/**
 * Source Fetcher Service
 *
 * Abstracts the knowledge of which DB table, ID column, and date column
 * to use for each (dataSource, geoLevel) pair. This was previously
 * hardcoded differently in every consumer (market-snapshot, reports, scoring).
 *
 * All table/column routing lives HERE. No other file should hardcode
 * table names like 'zillow_metro' or 'census_county'.
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { normalizeZipKey } from '../common/zip';
import {
  normalizeStateToFips,
  normalizeStateToCode,
  normalizeCountyFips,
  normalizeCbsaCode,
} from '../common/geo';
import {
  GeoLevel,
  DataSource,
  TableRoute,
} from './metric-resolution.types';

/** Result from a single-value fetch */
export interface FetchedValue {
  value: number;
  date: string | null;
}

@Injectable()
export class SourceFetcherService {
  private readonly logger = new Logger(SourceFetcherService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Fetch the latest value for a single (source, column, geoLevel, geoId).
   * Returns null if no data found.
   */
  async fetchLatestValue(
    source: DataSource,
    column: string,
    geoLevel: GeoLevel,
    geoId: string,
  ): Promise<FetchedValue | null> {
    // HUD FMR is special — requires a county crosswalk lookup from ZIP
    if (source === 'hud_fmr') {
      return this.fetchHudFmr(column, geoLevel, geoId);
    }

    // Zillow uses a long-format table (metric_name column)
    if (source === 'zillow') {
      return this.fetchZillowMetric(column, geoLevel, geoId);
    }

    // Calculated metrics use geography_id + geography_type pattern
    if (source === 'calculated') {
      return this.fetchCalculatedMetric(column, geoLevel, geoId);
    }

    // Standard wide-format tables (realtor, census, economic, permits)
    return this.fetchWideTableMetric(source, column, geoLevel, geoId);
  }

  /**
   * Fetch from wide-format tables (realtor_*, census_*, economic_*, permits_*).
   * These have one column per metric and use geography-specific ID columns.
   */
  private async fetchWideTableMetric(
    source: DataSource,
    column: string,
    geoLevel: GeoLevel,
    geoId: string,
  ): Promise<FetchedValue | null> {
    const route = this.getWideTableRoute(source, geoLevel);
    if (!route) return null;

    const normalizedId = this.normalizeGeoId(geoLevel, geoId, source);
    const dateCol = route.dateColumn;

    const { data, error } = await this.supabase
      .from(route.table)
      .select(`${column}, ${dateCol}`)
      .eq(route.idColumn, normalizedId)
      .order(dateCol, { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    const row = data as Record<string, any>;
    const rawValue = row[column];

    if (rawValue == null || (typeof rawValue === 'number' && rawValue === -666666666)) {
      return null;
    }

    return {
      value: Number(rawValue),
      date: row[dateCol] ? String(row[dateCol]) : null,
    };
  }

  /**
   * Fetch from Zillow long-format tables (zillow_*).
   * These store each metric as a separate row with metric_name, value, period_date.
   */
  private async fetchZillowMetric(
    metricName: string,
    geoLevel: GeoLevel,
    geoId: string,
  ): Promise<FetchedValue | null> {
    const route = this.getZillowRoute(geoLevel);
    if (!route) return null;

    const normalizedId = this.normalizeGeoId(geoLevel, geoId, 'zillow');

    const { data, error } = await this.supabase
      .from(route.table)
      .select('value, period_date')
      .eq(route.idColumn, normalizedId)
      .eq('metric_name', metricName)
      .order('period_date', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) return null;
    const row = data[0] as Record<string, any>;

    if (row.value == null) return null;

    return {
      value: Number(row.value),
      date: row.period_date ? String(row.period_date) : null,
    };
  }

  /**
   * Fetch from calculated_metrics table.
   * Uses geography_id + geography_type pattern. Merges latest 3 rows
   * (different batch jobs may write at different dates).
   */
  private async fetchCalculatedMetric(
    column: string,
    geoLevel: GeoLevel,
    geoId: string,
  ): Promise<FetchedValue | null> {
    const normalizedId = this.normalizeGeoId(geoLevel, geoId, 'calculated');

    const { data, error } = await this.supabase
      .from('calculated_metrics')
      .select(`${column}, period_date`)
      .eq('geography_id', normalizedId)
      .eq('geography_type', geoLevel)
      .order('period_date', { ascending: false })
      .limit(3);

    if (error || !data || data.length === 0) return null;

    // Merge: latest non-null value wins (handles staggered batch writes)
    for (const row of data as Record<string, any>[]) {
      if (row[column] != null) {
        return {
          value: Number(row[column]),
          date: row.period_date ? String(row.period_date) : null,
        };
      }
    }

    return null;
  }

  /**
   * Fetch HUD Fair Market Rent for a ZIP code.
   * Requires looking up the county FIPS first via the geographies table.
   */
  private async fetchHudFmr(
    column: string,
    geoLevel: GeoLevel,
    geoId: string,
  ): Promise<FetchedValue | null> {
    if (geoLevel !== 'zip') return null;

    // Step 1: Get county FIPS from geographies table
    const { data: geo } = await this.supabase
      .from('geographies')
      .select('fips_code')
      .eq('geography_id', geoId)
      .eq('geography_type', 'zip')
      .limit(1)
      .single();

    const geoRow = geo as Record<string, any> | null;
    if (!geoRow?.fips_code) return null;
    const countyFips = String(geoRow.fips_code).padStart(5, '0');

    // Step 2: Get latest HUD FMR for that county
    const { data: fmr } = await this.supabase
      .from('hud_fmr')
      .select(`${column}, year`)
      .eq('fips_code', countyFips)
      .not(column, 'is', null)
      .order('year', { ascending: false })
      .limit(1)
      .single();

    const fmrRow = fmr as Record<string, any> | null;
    if (!fmrRow?.[column]) return null;

    return {
      value: Number(fmrRow[column]),
      date: fmrRow.year ? `${fmrRow.year}-01-01` : null,
    };
  }

  // ==========================================================================
  // Table Routing
  // ==========================================================================

  private getWideTableRoute(source: DataSource, geoLevel: GeoLevel): TableRoute | null {
    switch (source) {
      case 'realtor':
        return this.getRealtorRoute(geoLevel);
      case 'census':
        return this.getCensusRoute(geoLevel);
      case 'economic':
        return this.getEconomicRoute(geoLevel);
      case 'permits':
        return this.getPermitsRoute(geoLevel);
      default:
        return null;
    }
  }

  private getRealtorRoute(geoLevel: GeoLevel): TableRoute | null {
    switch (geoLevel) {
      case 'metro':
        return { table: 'realtor_metro', idColumn: 'cbsa_code', nameColumn: 'cbsa_title', dateColumn: 'period_date' };
      case 'county':
        return { table: 'realtor_county', idColumn: 'county_fips', nameColumn: 'county_name', dateColumn: 'period_date' };
      case 'zip':
        return { table: 'realtor_zip', idColumn: 'postal_code', nameColumn: 'zip_name', dateColumn: 'period_date' };
      case 'state':
        return { table: 'realtor_state', idColumn: 'state_id', nameColumn: 'state_name', dateColumn: 'period_date' };
      default:
        return null;
    }
  }

  private getZillowRoute(geoLevel: GeoLevel): TableRoute | null {
    switch (geoLevel) {
      case 'metro':
        return { table: 'zillow_metro', idColumn: 'cbsa_code', dateColumn: 'period_date' };
      case 'county':
        return { table: 'zillow_county', idColumn: 'fips_code', dateColumn: 'period_date' };
      case 'zip':
        return { table: 'zillow_zip', idColumn: 'region_name', dateColumn: 'period_date' };
      case 'state':
        return { table: 'zillow_state', idColumn: 'state_code', dateColumn: 'period_date' };
      default:
        return null;
    }
  }

  private getCensusRoute(geoLevel: GeoLevel): TableRoute | null {
    switch (geoLevel) {
      case 'metro':
        return { table: 'census_metro', idColumn: 'cbsa_code', nameColumn: 'cbsa_title', dateColumn: 'year' };
      case 'county':
        return { table: 'census_county', idColumn: 'fips_code', nameColumn: 'county_name', dateColumn: 'year' };
      case 'zip':
        return { table: 'census_zip', idColumn: 'zcta', dateColumn: 'year' };
      case 'state':
        return { table: 'census_state', idColumn: 'state_fips', nameColumn: 'state_name', dateColumn: 'year' };
      default:
        return null;
    }
  }

  private getEconomicRoute(geoLevel: GeoLevel): TableRoute | null {
    switch (geoLevel) {
      case 'metro':
        return { table: 'economic_metro', idColumn: 'cbsa_code', nameColumn: 'cbsa_title', dateColumn: 'period_date' };
      case 'county':
        return { table: 'economic_county', idColumn: 'fips_code', nameColumn: 'county_name', dateColumn: 'period_date' };
      case 'state':
        return { table: 'economic_state', idColumn: 'state_fips', nameColumn: 'state_name', dateColumn: 'period_date' };
      default:
        return null;
    }
  }

  private getPermitsRoute(geoLevel: GeoLevel): TableRoute | null {
    switch (geoLevel) {
      case 'county':
        return { table: 'permits_county', idColumn: 'fips_code', dateColumn: 'period_date' };
      case 'state':
        return { table: 'permits_state', idColumn: 'state_fips', dateColumn: 'period_date' };
      case 'metro':
        return { table: 'permits_metro', idColumn: 'cbsa_code', dateColumn: 'period_date' };
      default:
        return null;
    }
  }

  // ==========================================================================
  // Geography ID Normalization
  // ==========================================================================

  private normalizeGeoId(geoLevel: GeoLevel, geoId: string, source: DataSource): string {
    switch (geoLevel) {
      case 'zip':
        return normalizeZipKey(geoId);
      case 'county':
        return /^\d+$/.test(geoId.trim()) ? normalizeCountyFips(geoId) : geoId;
      case 'metro':
        return /^\d+$/.test(geoId.trim()) ? normalizeCbsaCode(geoId) : geoId;
      case 'state':
        // Different tables use different state ID formats
        if (source === 'census' || source === 'economic' || source === 'permits') {
          return normalizeStateToFips(geoId);
        }
        if (source === 'calculated') {
          return normalizeStateToCode(geoId);
        }
        // Realtor uses state_id (2-letter), Zillow uses state_code (2-letter)
        return normalizeStateToCode(geoId);
      default:
        return geoId;
    }
  }
}
