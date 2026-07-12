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
import { GeoLevel, DataSource, TableRoute } from './metric-resolution.types';
import { normalizeGeoId } from './geo-id-normalize';
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
    anchorNonNull = false,
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
    return this.fetchWideTableMetric(
      source,
      column,
      geoLevel,
      geoId,
      anchorNonNull,
    );
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
    anchorNonNull = false,
  ): Promise<FetchedValue | null> {
    const route = getWideTableRoute(source, geoLevel);
    if (!route) return null;

    const normalizedId = normalizeGeoId(geoLevel, geoId, source);
    const dateCol = route.dateColumn;

    let query = this.supabase
      .from(route.table)
      .select(`${column}, ${dateCol}`)
      .eq(route.idColumn, normalizedId);

    // Anchor on the most recent row where THIS column is non-null for (a) the
    // economic_* multi-importer tables, whose columns land on different-dated
    // rows by cadence, and (b) sources whose registry entry opts in via
    // anchorNonNull (display metrics the upstream ships a period late, e.g.
    // Realtor hotness). Everything else keeps latest-row semantics so a
    // genuine current-period gap falls through to the next source rather than
    // serving stale data — critical for score inputs like days_on_market.
    if (
      anchorNonNull ||
      source === 'economic' ||
      source === 'qcew' ||
      source === 'ces'
    ) {
      query = query.not(column, 'is', null);
    }

    const { data, error } = await query
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

    const normalizedId = normalizeGeoId(geoLevel, geoId, 'zillow');

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
    const normalizedId = normalizeGeoId(geoLevel, geoId, 'calculated');

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

    const normalizedId = normalizeGeoId(geoLevel, geoId, 'redfin');

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
}
