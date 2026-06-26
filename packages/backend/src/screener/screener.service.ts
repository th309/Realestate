import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import {
  ScreenerQueryDto,
  ScreenerMoversQueryDto,
  SORTABLE_COLUMNS,
  SortableColumn,
  WINDOW_TO_COLUMN,
  MoverWindow,
} from './screener.dto';

export interface ScreenerRow {
  geo_level: string;
  region_id: string;
  region_name: string;
  state_code: string;
  score: number | null;
  grade: string | null;
  confidence: number | null;
  median_price: number | null;
  home_value: number | null;
  rent: number | null;
  cap_rate: number | null;
  gross_yield: number | null;
  rent_to_price_ratio: number | null;
  grm: number | null;
  months_of_supply: number | null;
  overvalued_pct: number | null;
  score_chg_1m: number | null;
  score_chg_3m: number | null;
  score_chg_6m: number | null;
  score_chg_1y: number | null;
  score_chg_3y: number | null;
  score_chg_5y: number | null;
  population: number | null;
  as_of: string | null;
  refreshed_at: string | null;
}

export interface ScreenerResult {
  data: ScreenerRow[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ScreenerMoversResult {
  window: string;
  gainers: ScreenerRow[];
  losers: ScreenerRow[];
}

const DEFAULT_SORT_BY: SortableColumn = 'score';
const DEFAULT_SORT_ORDER = 'desc' as const;
const DEFAULT_PAGE = 0;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

@Injectable()
export class ScreenerService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Market-size floor (de-noise, beta backlog #26/#29). Rows whose population is
   * >= populationMin OR NULL pass — "size unknown" is never hidden, so legitimate
   * unmatched metros (e.g. territories) still appear. NO score is touched; this
   * only changes which rows are returned. population in screener_snapshot is the
   * region's own value for metro/county and the parent county's for ZIP.
   */
  private applyPopulationFloor<T extends { or(filters: string): T }>(
    query: T,
    populationMin?: number,
  ): T {
    if (populationMin == null) return query;
    return query.or(`population.is.null,population.gte.${populationMin}`);
  }

  /**
   * Rebuilds the screener_snapshot table via the Postgres function.
   * Returns the number of rows refreshed.
   */
  async refreshScreenerSnapshot(): Promise<number> {
    const { data, error } = await this.supabase.rpc(
      'refresh_screener_snapshot',
    );
    if (error) {
      throw new Error(`Failed to refresh screener_snapshot: ${error.message}`);
    }
    return data ?? 0;
  }

  /**
   * Query screener_snapshot with optional filters, sorting, and pagination.
   */
  async queryScreener(
    geoLevel: 'metro' | 'county' | 'zip',
    opts: ScreenerQueryDto,
  ): Promise<ScreenerResult> {
    // Validate and resolve sortBy against the allowlist (security critical)
    const rawSortBy = opts.sortBy ?? DEFAULT_SORT_BY;
    const sortBy: SortableColumn = (
      SORTABLE_COLUMNS as readonly string[]
    ).includes(rawSortBy)
      ? rawSortBy
      : DEFAULT_SORT_BY;

    // Defense-in-depth (mirrors sortBy): never trust the raw value for an
    // internal caller that bypasses the controller's ValidationPipe.
    const sortOrder =
      opts.sortOrder === 'asc' || opts.sortOrder === 'desc'
        ? opts.sortOrder
        : DEFAULT_SORT_ORDER;
    const page = opts.page ?? DEFAULT_PAGE;
    const pageSize = Math.min(
      opts.pageSize ?? DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE,
    );
    const rangeFrom = page * pageSize;
    const rangeTo = rangeFrom + pageSize - 1;

    let query = this.supabase
      .from('screener_snapshot')
      .select('*', { count: 'exact' })
      .eq('geo_level', geoLevel);

    // Optional equality filter
    if (opts.state) {
      query = query.eq('state_code', opts.state.toUpperCase());
    }

    // Numeric range filters
    if (opts.scoreMin != null) query = query.gte('score', opts.scoreMin);
    if (opts.scoreMax != null) query = query.lte('score', opts.scoreMax);
    if (opts.capRateMin != null) query = query.gte('cap_rate', opts.capRateMin);
    if (opts.capRateMax != null) query = query.lte('cap_rate', opts.capRateMax);
    if (opts.monthsOfSupplyMin != null)
      query = query.gte('months_of_supply', opts.monthsOfSupplyMin);
    if (opts.monthsOfSupplyMax != null)
      query = query.lte('months_of_supply', opts.monthsOfSupplyMax);
    if (opts.overvaluedMin != null)
      query = query.gte('overvalued_pct', opts.overvaluedMin);
    if (opts.overvaluedMax != null)
      query = query.lte('overvalued_pct', opts.overvaluedMax);
    if (opts.medianPriceMin != null)
      query = query.gte('median_price', opts.medianPriceMin);
    if (opts.medianPriceMax != null)
      query = query.lte('median_price', opts.medianPriceMax);

    // Market-size floor (de-noise) — NULL population passes through.
    query = this.applyPopulationFloor(query, opts.populationMin);

    // Score-movers Δ filter — applies to the active window's precomputed column.
    if (
      opts.changeWindow &&
      (opts.changeMin != null || opts.changeMax != null)
    ) {
      const col = WINDOW_TO_COLUMN[opts.changeWindow];
      if (opts.changeMin != null) query = query.gte(col, opts.changeMin);
      if (opts.changeMax != null) query = query.lte(col, opts.changeMax);
    }

    // Sorting and pagination
    const {
      data: rows,
      count,
      error,
    } = await query
      .order(sortBy, { ascending: sortOrder === 'asc', nullsFirst: false })
      .range(rangeFrom, rangeTo);

    if (error) {
      throw new Error(`screener_snapshot query failed: ${error.message}`);
    }

    const total = count ?? 0;

    return {
      data: (rows ?? []) as ScreenerRow[],
      total,
      page,
      pageSize,
      hasMore: (page + 1) * pageSize < total,
    };
  }

  /**
   * Top gainers + losers for a score window. Two ordered reads of the same
   * snapshot on the precomputed Δ column, NULL deltas excluded from both lists.
   */
  async queryMovers(
    geoLevel: 'metro' | 'county' | 'zip',
    dto: ScreenerMoversQueryDto,
  ): Promise<ScreenerMoversResult> {
    const window: MoverWindow = dto.window;
    const col = WINDOW_TO_COLUMN[window];
    const limit = Math.min(dto.limit ?? 25, 100);

    const baseQuery = () => {
      let q = this.supabase
        .from('screener_snapshot')
        .select('*')
        .eq('geo_level', geoLevel)
        .not(col, 'is', null);
      if (dto.state) q = q.eq('state_code', dto.state.toUpperCase());
      // Market-size floor (de-noise) — keeps micro-markets out of movers lists.
      q = this.applyPopulationFloor(q, dto.populationMin);
      return q;
    };

    // Primary sort on the Δ column; tie-break by current score desc then name
    // (spec §7) so equal-delta rows order deterministically across reloads.
    const [gainersRes, losersRes] = await Promise.all([
      baseQuery()
        .order(col, { ascending: false, nullsFirst: false })
        .order('score', { ascending: false, nullsFirst: false })
        .order('region_name', { ascending: true })
        .limit(limit),
      baseQuery()
        .order(col, { ascending: true, nullsFirst: false })
        .order('score', { ascending: false, nullsFirst: false })
        .order('region_name', { ascending: true })
        .limit(limit),
    ]);

    if (gainersRes.error) {
      throw new Error(
        `screener movers (gainers) failed: ${gainersRes.error.message}`,
      );
    }
    if (losersRes.error) {
      throw new Error(
        `screener movers (losers) failed: ${losersRes.error.message}`,
      );
    }

    return {
      window,
      gainers: (gainersRes.data ?? []) as ScreenerRow[],
      losers: (losersRes.data ?? []) as ScreenerRow[],
    };
  }
}
