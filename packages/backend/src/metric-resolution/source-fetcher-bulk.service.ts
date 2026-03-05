/**
 * Source Fetcher Bulk Service
 *
 * Bulk fetch methods for fetching the latest value of a metric across
 * ALL regions at a geography level. Used by resolveMetricForAllGeos
 * and the rank_by_metric research tool.
 *
 * Extracted from SourceFetcherService for file size compliance.
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { GeoLevel, DataSource } from './metric-resolution.types';
import { getWideTableRoute, getZillowRoute } from './table-routes';

/** Result row from a bulk fetch */
export interface BulkFetchedRow {
  regionId: string;
  regionName: string | null;
  value: number;
  date: string | null;
}

@Injectable()
export class SourceFetcherBulkService {
  private readonly logger = new Logger(SourceFetcherBulkService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Fetch the latest value of a metric for ALL regions at a geography level.
   * Returns rows sorted by value descending.
   */
  async fetchLatestForAllRegions(
    source: DataSource,
    column: string,
    geoLevel: GeoLevel,
  ): Promise<BulkFetchedRow[]> {
    if (source === 'zillow') return this.fetchZillowBulk(column, geoLevel);
    if (source === 'calculated')
      return this.fetchCalculatedBulk(column, geoLevel);
    return this.fetchWideTableBulk(source, column, geoLevel);
  }

  private async fetchZillowBulk(
    metricName: string,
    geoLevel: GeoLevel,
  ): Promise<BulkFetchedRow[]> {
    const route = getZillowRoute(geoLevel);
    if (!route) return [];

    const { data: dateRow } = await this.supabase
      .from(route.table)
      .select('period_date')
      .eq('metric_name', metricName)
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    if (!dateRow) return [];
    const latestDate = (dateRow as any).period_date;

    const nameCol = route.nameColumn || 'region_name';
    const { data, error } = await this.supabase
      .from(route.table)
      .select(`${route.idColumn}, ${nameCol}, value, period_date`)
      .eq('metric_name', metricName)
      .eq('period_date', latestDate)
      .not('value', 'is', null)
      .order('value', { ascending: false })
      .limit(500);

    if (error || !data) return [];
    return (data as any[]).map((r) => ({
      regionId: String(r[route.idColumn]),
      regionName: r[nameCol] || null,
      value: Number(r.value),
      date: latestDate,
    }));
  }

  private async fetchWideTableBulk(
    source: DataSource,
    column: string,
    geoLevel: GeoLevel,
  ): Promise<BulkFetchedRow[]> {
    const route = getWideTableRoute(source, geoLevel);
    if (!route) return [];

    const nameCol = route.nameColumn || route.idColumn;
    const { data: dateRow } = await this.supabase
      .from(route.table)
      .select(route.dateColumn)
      .not(column, 'is', null)
      .order(route.dateColumn, { ascending: false })
      .limit(1)
      .single();

    if (!dateRow) return [];
    const latestDate = (dateRow as any)[route.dateColumn];

    const { data, error } = await this.supabase
      .from(route.table)
      .select(`${route.idColumn}, ${nameCol}, ${column}, ${route.dateColumn}`)
      .eq(route.dateColumn, latestDate)
      .not(column, 'is', null)
      .order(column, { ascending: false })
      .limit(500);

    if (error || !data) return [];
    return (data as any[])
      .filter((r) => r[column] != null && r[column] !== -666666666)
      .map((r) => ({
        regionId: String(r[route.idColumn]),
        regionName: nameCol !== route.idColumn ? r[nameCol] || null : null,
        value: Number(r[column]),
        date: String(latestDate),
      }));
  }

  private async fetchCalculatedBulk(
    column: string,
    geoLevel: GeoLevel,
  ): Promise<BulkFetchedRow[]> {
    const { data, error } = await this.supabase
      .from('calculated_metrics')
      .select(`geography_id, geography_name, ${column}, calculated_at`)
      .eq('geography_type', geoLevel)
      .not(column, 'is', null)
      .order(column, { ascending: false })
      .limit(500);

    if (error || !data) return [];
    return (data as any[])
      .filter((r) => r[column] != null)
      .map((r) => ({
        regionId: String(r.geography_id),
        regionName: r.geography_name || null,
        value: Number(r[column]),
        date: r.calculated_at ? String(r.calculated_at) : null,
      }));
  }
}
