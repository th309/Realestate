/**
 * Ranking Resolver Service
 *
 * Resolves top/bottom N market rankings for a given metric, geography level,
 * and scope (national, state, or metro). Used by the content pipeline's
 * top_10_ranking and bottom_10_ranking video formats.
 *
 * Query helpers (crosswalk, countExcluded, fetchRankedRows) live in
 * ranking-queries.ts to keep this file under the 300-line hard limit.
 */

import { Injectable } from '@nestjs/common';
import { MetricResolutionService } from '../../metric-resolution/metric-resolution.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { formatRankingValue, MetricFormat } from './format-value';
import {
  RankingMetricConfig,
  RANKING_METRIC_CATALOG,
} from './ranking-metric-catalog';
import {
  resolveScopeRegionIds,
  countExcluded,
  fetchRankedRows,
} from './ranking-queries';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type RankingFormat = 'top_10_ranking' | 'bottom_10_ranking';
export type RankingDirection = 'top' | 'bottom';
export type GeoLevel = 'metro' | 'county' | 'zip';
export type ScopeType = 'national' | 'state' | 'metro';

export interface ResolveRankingInput {
  format: RankingFormat;
  metric_id: string;
  geo_level: GeoLevel;
  scope_type: ScopeType;
  scope_id: string | null;
  limit?: number;
}

export interface RankingEntry {
  rank: number;
  region_id: string;
  region_name: string;
  state: string | null;
  value: number;
  value_formatted: string;
}

export interface ResolveRankingResult {
  metric: { id: string; label: string; unit: string; format: MetricFormat };
  scope: { type: ScopeType; id: string | null; label: string };
  geo_level: GeoLevel;
  direction: RankingDirection;
  as_of: string | null;
  eligible_count: number;
  excluded_count: number;
  rankings: RankingEntry[];
  insufficient_data: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MIN_RANKINGS = 5;
const DEFAULT_LIMIT = 10;
const MAX_FETCH_MULTIPLIER = 3;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class RankingResolverService {
  constructor(
    // Injected for NestJS DI wiring; ranking queries bypass per-metric
    // resolution and go directly to source tables for bulk performance.
    private readonly metricResolution: MetricResolutionService,
    private readonly supabase: SupabaseService,
  ) {}

  async resolve(input: ResolveRankingInput): Promise<ResolveRankingResult> {
    const metric = this.lookupMetric(input.metric_id);
    const direction: RankingDirection =
      input.format === 'bottom_10_ranking' ? 'bottom' : 'top';
    const limit = input.limit ?? DEFAULT_LIMIT;
    const tableConfig = this.resolveTableConfig(metric, input.geo_level);
    const cutoffDate = this.buildCutoffDate(metric.stalenessDays);
    const client = this.supabase.getClient();

    const scopeRegionIds = await resolveScopeRegionIds(
      client,
      input.scope_type,
      input.scope_id,
      input.geo_level,
    );

    const [excludedCount, rows] = await Promise.all([
      countExcluded(client, tableConfig, cutoffDate, scopeRegionIds),
      fetchRankedRows(
        client,
        tableConfig,
        cutoffDate,
        scopeRegionIds,
        direction,
        limit * MAX_FETCH_MULTIPLIER,
      ),
    ]);

    const sliced = rows.slice(0, limit);

    if (sliced.length < MIN_RANKINGS) {
      return this.buildResult(
        input,
        metric,
        direction,
        [],
        rows.length,
        excludedCount,
        null,
        true,
      );
    }

    const rankings: RankingEntry[] = sliced.map((row, idx) => ({
      rank: idx + 1,
      region_id: String(row[tableConfig.idColumn] ?? ''),
      region_name: tableConfig.nameColumn
        ? String(row[tableConfig.nameColumn] ?? row[tableConfig.idColumn] ?? '')
        : String(row[tableConfig.idColumn] ?? ''),
      state: tableConfig.stateColumn
        ? ((row[tableConfig.stateColumn] as string | null) ?? null)
        : null,
      value: row.value as number,
      value_formatted: formatRankingValue(row.value as number, metric.format),
    }));

    return this.buildResult(
      input,
      metric,
      direction,
      rankings,
      rows.length,
      excludedCount,
      (rows[0]?.period_date as string) ?? null,
      false,
    );
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private lookupMetric(metricId: string): RankingMetricConfig {
    const config = RANKING_METRIC_CATALOG[metricId];
    if (!config) {
      throw new Error(
        `Unknown ranking metric: ${metricId}. Add it to RANKING_METRIC_CATALOG.`,
      );
    }
    return config;
  }

  /** Swap '_metro' table suffix for county/zip geo levels. */
  private resolveTableConfig(
    metric: RankingMetricConfig,
    geoLevel: GeoLevel,
  ): RankingMetricConfig {
    if (geoLevel === 'metro') return metric;
    const table = metric.sourceTable.replace(/_metro$/, `_${geoLevel}`);
    const idCol = geoLevel === 'county' ? 'county_fips' : 'postal_code';
    return { ...metric, sourceTable: table, idColumn: idCol };
  }

  private buildCutoffDate(stalenessDays: number): string {
    const d = new Date();
    d.setDate(d.getDate() - stalenessDays);
    return d.toISOString().slice(0, 10);
  }

  private buildResult(
    input: ResolveRankingInput,
    metric: RankingMetricConfig,
    direction: RankingDirection,
    rankings: RankingEntry[],
    eligibleCount: number,
    excludedCount: number,
    asOf: string | null,
    insufficientData: boolean,
  ): ResolveRankingResult {
    return {
      metric: {
        id: input.metric_id,
        label: metric.label,
        unit: metric.unit,
        format: metric.format,
      },
      scope: {
        type: input.scope_type,
        id: input.scope_id,
        label: input.scope_id ?? 'National',
      },
      geo_level: input.geo_level,
      direction,
      as_of: asOf,
      eligible_count: eligibleCount,
      excluded_count: excludedCount,
      rankings,
      insufficient_data: insufficientData,
    };
  }
}
