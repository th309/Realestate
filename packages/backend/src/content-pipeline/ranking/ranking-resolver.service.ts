/**
 * Ranking Resolver Service
 *
 * Resolves top/bottom N market rankings for the content pipeline's
 * top_10_ranking and bottom_10_ranking video formats.
 *
 * Two paths:
 *  - PIQ score (`propertyiq_score`) → query propertyiq_scores directly.
 *    Same pattern RankingsV1Controller and score-mover-context.queries use.
 *  - Raw market metrics → SourceFetcherBulkService.fetchLatestForAllRegions,
 *    routed via FALLBACK_REGISTRY (the canonical metric-resolution layer).
 *
 * Shape: pull latest snapshot, optional scope filter, sort, slice 10. That's it.
 */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { FALLBACK_REGISTRY } from '../../metric-resolution/fallback-registry';
import {
  SourceFetcherBulkService,
  BulkFetchedRow,
} from '../../metric-resolution/source-fetcher-bulk.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { formatRankingValue, MetricFormat } from './format-value';
import { getMetricFormat, getMetricLabel } from './ranking-display-metadata';
import {
  fetchPiqRankings,
  parseLocationName,
  resolveScopeRegionIds,
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
const PIQ_METRIC_ID = 'propertyiq_score';

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class RankingResolverService {
  private readonly logger = new Logger(RankingResolverService.name);

  constructor(
    private readonly sourceFetcherBulk: SourceFetcherBulkService,
    private readonly supabase: SupabaseService,
  ) {}

  async resolve(input: ResolveRankingInput): Promise<ResolveRankingResult> {
    const ascending = input.format === 'bottom_10_ranking';
    const direction: RankingDirection = ascending ? 'bottom' : 'top';
    const limit = input.limit ?? DEFAULT_LIMIT;

    if (input.metric_id === PIQ_METRIC_ID) {
      return this.resolvePiq(input, direction, ascending, limit);
    }
    return this.resolveRaw(input, direction, ascending, limit);
  }

  // -----------------------------------------------------------------------
  // PIQ path — propertyiq_scores
  // -----------------------------------------------------------------------

  private async resolvePiq(
    input: ResolveRankingInput,
    direction: RankingDirection,
    ascending: boolean,
    limit: number,
  ): Promise<ResolveRankingResult> {
    const client = this.supabase.getClient();
    const scopeRegionIds = await resolveScopeRegionIds(
      client,
      input.scope_type,
      input.scope_id,
      input.geo_level,
    );

    const rows = await fetchPiqRankings(
      client,
      input.geo_level,
      scopeRegionIds,
      ascending,
      limit,
    );

    const format = getMetricFormat(PIQ_METRIC_ID);
    const rankings: RankingEntry[] = rows.map((row, idx) => {
      const score = Number(row.score);
      const parsed = parseLocationName(row.location_name);
      return {
        rank: idx + 1,
        region_id: String(row.location_id),
        region_name: parsed.name,
        state: parsed.state,
        value: score,
        value_formatted: formatRankingValue(score, format),
      };
    });

    return this.buildResult(
      input,
      direction,
      rankings,
      rows[0]?.score_date ?? null,
      rows.length,
    );
  }

  // -----------------------------------------------------------------------
  // Raw-metric path — canonical SourceFetcherBulkService
  // -----------------------------------------------------------------------

  private async resolveRaw(
    input: ResolveRankingInput,
    direction: RankingDirection,
    ascending: boolean,
    limit: number,
  ): Promise<ResolveRankingResult> {
    const chain = FALLBACK_REGISTRY[input.metric_id];
    if (!chain) {
      throw new BadRequestException(
        `Metric '${input.metric_id}' is not registered for ranking. ` +
          `Add it to FALLBACK_REGISTRY in metric-resolution.`,
      );
    }

    // Walk the fallback chain — first source with rows wins.
    let rows: BulkFetchedRow[] = [];
    for (const source of chain.sources) {
      if (source.geoLevels && !source.geoLevels.includes(input.geo_level)) {
        continue;
      }
      const fetched = await this.sourceFetcherBulk.fetchLatestForAllRegions(
        source.source,
        source.column,
        input.geo_level,
      );
      if (fetched.length > 0) {
        rows = source.transform
          ? fetched.map((r) => ({
              ...r,
              value: source.transform!(r.value),
            }))
          : fetched;
        break;
      }
    }

    if (rows.length === 0) {
      return this.buildResult(input, direction, [], null, 0);
    }

    // Apply scope filter
    const client = this.supabase.getClient();
    const scopeRegionIds = await resolveScopeRegionIds(
      client,
      input.scope_type,
      input.scope_id,
      input.geo_level,
    );
    if (scopeRegionIds !== null) {
      const scopeSet = new Set(scopeRegionIds);
      rows = rows.filter((r) => scopeSet.has(r.regionId));
    }

    // Apply sanityLimits if present
    if (chain.sanityLimits) {
      const { min, max } = chain.sanityLimits;
      rows = rows.map((r) => {
        let v = r.value;
        if (min !== undefined && v < min) v = min;
        if (max !== undefined && v > max) v = max;
        return { ...r, value: v };
      });
    }

    rows.sort((a, b) => (ascending ? a.value - b.value : b.value - a.value));
    const eligibleCount = rows.length;
    const top = rows.slice(0, limit);

    const format = getMetricFormat(input.metric_id);
    const rankings: RankingEntry[] = top.map((row, idx) => {
      const parsed = row.regionName
        ? parseLocationName(row.regionName)
        : { name: row.regionId, state: null };
      return {
        rank: idx + 1,
        region_id: row.regionId,
        region_name: parsed.name,
        state: parsed.state,
        value: row.value,
        value_formatted: formatRankingValue(row.value, format),
      };
    });

    return this.buildResult(
      input,
      direction,
      rankings,
      top[0]?.date ?? null,
      eligibleCount,
    );
  }

  // -----------------------------------------------------------------------
  // Shared response builder
  // -----------------------------------------------------------------------

  private buildResult(
    input: ResolveRankingInput,
    direction: RankingDirection,
    rankings: RankingEntry[],
    asOf: string | null,
    eligibleCount: number,
  ): ResolveRankingResult {
    const format = getMetricFormat(input.metric_id);
    const insufficient = rankings.length < MIN_RANKINGS;
    return {
      metric: {
        id: input.metric_id,
        label: getMetricLabel(input.metric_id),
        unit: '',
        format,
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
      excluded_count: 0,
      rankings: insufficient ? [] : rankings,
      insufficient_data: insufficient,
    };
  }
}
