/**
 * Source Fetcher Service
 *
 * Abstracts the knowledge of which DB table, ID column, and date column
 * to use for each (dataSource, geoLevel) pair. This was previously
 * hardcoded differently in every consumer (market-snapshot, reports, scoring).
 *
 * Table routing is defined in table-routes.ts.
 * Bulk fetch methods are in source-fetcher-bulk.service.ts.
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
import { GeoLevel, DataSource, TableRoute } from './metric-resolution.types';
import {
  getWideTableRoute,
  getZillowRoute,
  getRedfinRoute,
} from './table-routes';
import { MetroRollupGeoService } from './metro-rollup-geo.service';

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
    private readonly metroRollup: MetroRollupGeoService,
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
    if (source === 'hud_fmr') return this.fetchHudFmr(column, geoLevel, geoId);
    if (source === 'zillow')
      return this.fetchZillowMetric(column, geoLevel, geoId);
    if (source === 'calculated')
      return this.fetchCalculatedMetric(column, geoLevel, geoId);
    if (source === 'redfin')
      return this.fetchRedfinMetric(column, geoLevel, geoId);
    if (source === 'irs_metro_rollup')
      return this.metroRollup.fetchMetroValue(column, geoLevel, geoId);
    return this.fetchWideTableMetric(source, column, geoLevel, geoId);
  }

  // Public route accessors for SourceFetcherBulkService
  getWideTableRoute(source: DataSource, geoLevel: GeoLevel): TableRoute | null {
    return getWideTableRoute(source, geoLevel);
  }

  getZillowRoute(geoLevel: GeoLevel): TableRoute | null {
    return getZillowRoute(geoLevel);
  }

  // ==========================================================================
  // Single-value fetch methods
  // ==========================================================================

  private async fetchWideTableMetric(
    source: DataSource,
    column: string,
    geoLevel: GeoLevel,
    geoId: string,
  ): Promise<FetchedValue | null> {
    const route = getWideTableRoute(source, geoLevel);
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

    if (
      rawValue == null ||
      (typeof rawValue === 'number' && rawValue === -666666666)
    ) {
      return null;
    }

    return {
      value: Number(rawValue),
      date: row[dateCol] ? String(row[dateCol]) : null,
    };
  }

  private async fetchZillowMetric(
    metricName: string,
    geoLevel: GeoLevel,
    geoId: string,
  ): Promise<FetchedValue | null> {
    const route = getZillowRoute(geoLevel);
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

  private async fetchHudFmr(
    column: string,
    geoLevel: GeoLevel,
    geoId: string,
  ): Promise<FetchedValue | null> {
    if (geoLevel !== 'zip') return null;

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

  private async fetchRedfinMetric(
    column: string,
    geoLevel: GeoLevel,
    geoId: string,
  ): Promise<FetchedValue | null> {
    const route = getRedfinRoute(geoLevel);
    if (!route) return null;

    const normalizedId = this.normalizeGeoId(geoLevel, geoId, 'redfin');

    const { data, error } = await this.supabase
      .from(route.table)
      .select(`${column}, ${route.dateColumn}`)
      .eq(route.idColumn, normalizedId)
      .eq('property_type', 'All Residential')
      .order(route.dateColumn, { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    const row = data as Record<string, any>;
    if (row[column] == null) return null;

    return {
      value: Number(row[column]),
      date: row[route.dateColumn] ? String(row[route.dateColumn]) : null,
    };
  }

  // ==========================================================================
  // Geography ID Normalization
  // ==========================================================================

  private normalizeGeoId(
    geoLevel: GeoLevel,
    geoId: string,
    source: DataSource,
  ): string {
    switch (geoLevel) {
      case 'zip':
        return normalizeZipKey(geoId);
      case 'county':
        return /^\d+$/.test(geoId.trim()) ? normalizeCountyFips(geoId) : geoId;
      case 'metro':
        return /^\d+$/.test(geoId.trim()) ? normalizeCbsaCode(geoId) : geoId;
      case 'state':
        if (
          source === 'census' ||
          source === 'economic' ||
          source === 'permits' ||
          // Redfin Data Center state tables key region_id on STATE FIPS ('08'),
          // not the 2-letter code — covers 'redfin_dc' and every 'redfin_dc_*'.
          source.startsWith('redfin_dc')
        ) {
          return normalizeStateToFips(geoId);
        }
        if (source === 'calculated') {
          return normalizeStateToCode(geoId);
        }
        return normalizeStateToCode(geoId);
      default:
        return geoId;
    }
  }
}
