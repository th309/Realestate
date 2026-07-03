import { Injectable, Inject, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { GeoLevel } from '../metric-resolution/metric-resolution.types';
import { getFallbackChain } from '../metric-resolution/fallback-registry';
import { getWideTableRoute } from '../metric-resolution/table-routes';

/** One region's latest value for the map choropleth. region_id is the true
 * CBSA / county-FIPS / ZIP so the frontend snapshot transform keys on it. */
interface SnapshotRow {
  region_id: string;
  region_name: string | null;
  value: number | null;
  date: string;
}

export interface SnapshotResponse {
  success: boolean;
  count: number;
  metric: string;
  geography: string;
  date: string | null;
  data: SnapshotRow[];
}

interface CacheEntry {
  data: SnapshotResponse;
  expiry: number;
}

/**
 * Serves latest-period snapshots of Redfin Data Center DISPLAY metrics across
 * ALL regions at a geo level, for the map choropleth. Fully generic: the metric
 * id resolves (table, column) through the fallback registry + table routes, so
 * adding a redfin_dc metric to the registry is all that's needed — no new code
 * here. Restricted to redfin_dc* sources so this endpoint can't be used to read
 * arbitrary metrics.
 *
 * ZIP is fetched nationally (redfin_dc ZIP rows carry no state column and their
 * region_name is the bare ZIP), so state filtering isn't possible; a TTL cache
 * keeps repeat loads cheap.
 */
@Injectable()
export class RedfinDcSnapshotService {
  private readonly logger = new Logger(RedfinDcSnapshotService.name);
  private readonly PAGE_SIZE = 1000; // Supabase per-request row cap
  private readonly PARALLEL_PAGES = 6;
  private readonly CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4h
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async getSnapshot(
    metricId: string,
    geoLevel: GeoLevel,
  ): Promise<SnapshotResponse> {
    const empty: SnapshotResponse = {
      success: true,
      count: 0,
      metric: metricId,
      geography: geoLevel,
      date: null,
      data: [],
    };

    const chain = getFallbackChain(metricId);
    const primary = chain?.sources[0];
    // Scope: only redfin_dc* metrics are servable here.
    if (!primary || !primary.source.startsWith('redfin_dc')) return empty;

    const route = getWideTableRoute(primary.source, geoLevel);
    if (!route) return empty;

    const { table, dateColumn } = route;
    const column = primary.column;
    const cacheKey = `${table}:${column}:${geoLevel}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) return cached.data;

    const latest = await this.latestPeriod(table, column, dateColumn);
    if (!latest) return empty;

    const rows = await this.fetchAllRegions(table, column, dateColumn, latest);
    const response: SnapshotResponse = {
      success: true,
      count: rows.length,
      metric: metricId,
      geography: geoLevel,
      date: latest,
      data: rows,
    };
    this.cache.set(cacheKey, {
      data: response,
      expiry: Date.now() + this.CACHE_TTL_MS,
    });
    return response;
  }

  /** Latest period with a non-null value for this column. */
  private async latestPeriod(
    table: string,
    column: string,
    dateColumn: string,
  ): Promise<string | null> {
    const { data, error } = await this.supabase
      .from(table)
      .select(dateColumn)
      .not(column, 'is', null)
      .order(dateColumn, { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return String((data as unknown as Record<string, unknown>)[dateColumn]);
  }

  /** Fetch every region at `latest`, paginating in parallel past the 1000 cap. */
  private async fetchAllRegions(
    table: string,
    column: string,
    dateColumn: string,
    latest: string,
  ): Promise<SnapshotRow[]> {
    const rows: SnapshotRow[] = [];
    let base = 0;
    for (;;) {
      const pages = await Promise.all(
        Array.from({ length: this.PARALLEL_PAGES }, (_, i) =>
          this.fetchPage(
            table,
            column,
            dateColumn,
            latest,
            base + i * this.PAGE_SIZE,
          ),
        ),
      );
      for (const page of pages) rows.push(...page);
      // Any short page means we've reached the end.
      if (pages.some((p) => p.length < this.PAGE_SIZE)) break;
      base += this.PARALLEL_PAGES * this.PAGE_SIZE;
    }
    return rows;
  }

  private async fetchPage(
    table: string,
    column: string,
    dateColumn: string,
    latest: string,
    offset: number,
  ): Promise<SnapshotRow[]> {
    const { data, error } = await this.supabase
      .from(table)
      .select(`region_id, region_name, ${column}, ${dateColumn}`)
      .eq(dateColumn, latest)
      .not(column, 'is', null)
      .order('region_id', { ascending: true })
      .range(offset, offset + this.PAGE_SIZE - 1);
    if (error || !data) {
      if (error)
        this.logger.warn(`redfin-dc snapshot page failed: ${error.message}`);
      return [];
    }
    return (data as unknown as Record<string, unknown>[]).map((r) => ({
      region_id: String(r.region_id),
      region_name: (r.region_name as string | null) ?? null,
      value: r[column] == null ? null : Number(r[column]),
      date: latest,
    }));
  }
}
