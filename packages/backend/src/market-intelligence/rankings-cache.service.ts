/**
 * Pre-computes top/bottom 10 rankings for each metric across geography levels.
 * Rankings are refreshed periodically by the cron job and served from cache.
 */

import { Injectable, Logger } from '@nestjs/common';
import { MetricResolutionService } from '../metric-resolution/metric-resolution.service';
import { SupabaseService } from '../supabase/supabase.service';
import {
  RankingEntry,
  RANKINGS_METRIC_IDS,
} from './market-intelligence.types';

/** Metric IDs that should be formatted as currency (dollars) */
const CURRENCY_METRICS = new Set([
  'home_value',
  'rent_index',
  'median_income',
]);

/** Metric IDs that should be formatted as percentages */
const PERCENT_METRICS = new Set([
  'appreciation_yoy',
  'cap_rate',
  'vacancy_rate',
  'population_growth',
  'unemployment_rate',
  'permits_growth',
]);

/** Metric IDs that should be formatted as days */
const DAYS_METRICS = new Set(['dom']);

/** Metric IDs that use a ratio format (e.g. 20.8x) */
const RATIO_METRICS = new Set(['price_to_rent']);

type RankingsGeoLevel = 'metro' | 'county' | 'state';
const GEO_LEVELS: RankingsGeoLevel[] = ['metro', 'county', 'state'];

@Injectable()
export class RankingsCacheService {
  private readonly logger = new Logger(RankingsCacheService.name);

  constructor(
    private readonly metricResolution: MetricResolutionService,
    private readonly supabase: SupabaseService,
  ) {}

  /**
   * Refresh all rankings for all metrics x all geo levels.
   * Returns a summary of how many succeeded vs failed.
   */
  async refreshAll(): Promise<{ succeeded: number; failed: number }> {
    let succeeded = 0;
    let failed = 0;

    for (const metricId of RANKINGS_METRIC_IDS) {
      for (const geoType of GEO_LEVELS) {
        try {
          await this.refreshMetric(metricId, geoType);
          succeeded++;
        } catch (error: any) {
          this.logger.warn(
            `Failed to refresh ranking: ${metricId}/${geoType}: ${error.message}`,
          );
          failed++;
        }
      }
    }

    this.logger.log(
      `Rankings refresh complete: ${succeeded} succeeded, ${failed} failed`,
    );
    return { succeeded, failed };
  }

  /**
   * Refresh rankings for a single metric + geo level.
   * Fetches all geography values, sorts, and stores top/bottom 10.
   */
  async refreshMetric(
    metricId: string,
    geoType: RankingsGeoLevel,
  ): Promise<void> {
    const resolvedMap = await this.metricResolution.resolveMetricForAllGeos(metricId, geoType);

    const regionIds: string[] = [];
    const valuesByRegion = new Map<string, number>();
    for (const [regionId, resolved] of resolvedMap.entries()) {
      if (resolved.value != null) {
        regionIds.push(regionId);
        valuesByRegion.set(regionId, resolved.value);
      }
    }

    const nameMap = await this.fetchGeographyNames(regionIds, geoType);

    const entries: RankingEntry[] = regionIds.map((regionId) => ({
      geography_id: regionId,
      geography_name: nameMap.get(regionId) || regionId,
      value: valuesByRegion.get(regionId)!,
      formatted: this.formatValue(valuesByRegion.get(regionId)!, metricId),
      rank: 0,
    }));

    const top10 = [...entries]
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
      .map((entry, i) => ({ ...entry, rank: i + 1 }));

    const bottom10 = [...entries]
      .sort((a, b) => a.value - b.value)
      .slice(0, 10)
      .map((entry, i) => ({ ...entry, rank: i + 1 }));

    await this.storeRanking(metricId, geoType, 'top', top10);
    await this.storeRanking(metricId, geoType, 'bottom', bottom10);
  }

  /**
   * Retrieve a cached ranking from the database.
   * Returns null if no cached data exists.
   */
  async getRanking(
    metricId: string,
    geoType: string,
    direction: 'top' | 'bottom',
  ): Promise<RankingEntry[] | null> {
    const client = this.supabase.getClient();
    const { data } = await client
      .from('rankings_cache')
      .select('rankings')
      .eq('metric_id', metricId)
      .eq('geography_type', geoType)
      .eq('direction', direction)
      .eq('is_latest', true)
      .single();

    return data?.rankings ?? null;
  }

  /** Store a ranking, marking previous entries as not latest. */
  private async storeRanking(
    metricId: string,
    geoType: string,
    direction: 'top' | 'bottom',
    rankings: RankingEntry[],
  ): Promise<void> {
    const client = this.supabase.getClient();
    const today = new Date().toISOString().split('T')[0];

    // Mark old entries as not latest
    await client
      .from('rankings_cache')
      .update({ is_latest: false })
      .eq('metric_id', metricId)
      .eq('geography_type', geoType)
      .eq('direction', direction)
      .eq('is_latest', true);

    // Insert new ranking
    await client.from('rankings_cache').insert({
      metric_id: metricId,
      geography_type: geoType,
      direction,
      rank_count: rankings.length,
      generated_date: today,
      is_latest: true,
      rankings,
    });
  }

  /** Fetch geography names in bulk. Returns a Map of geography_id -> name. */
  private async fetchGeographyNames(
    regionIds: string[],
    geoType: string,
  ): Promise<Map<string, string>> {
    const nameMap = new Map<string, string>();
    if (regionIds.length === 0) return nameMap;

    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('geographies')
      .select('geography_id, name')
      .eq('geography_type', geoType)
      .in('geography_id', regionIds);

    if (error || !data) {
      this.logger.warn(
        `Failed to fetch geography names for ${geoType}: ${error?.message}`,
      );
      return nameMap;
    }

    for (const row of data as Array<{ geography_id: string; name: string }>) {
      nameMap.set(row.geography_id, row.name);
    }

    return nameMap;
  }

  /** Format a numeric value for display based on the metric type. */
  private formatValue(value: number, metricId: string): string {
    if (CURRENCY_METRICS.has(metricId)) return '$' + Math.round(value).toLocaleString('en-US');
    if (PERCENT_METRICS.has(metricId)) return `${parseFloat(value.toFixed(2))}%`;
    if (DAYS_METRICS.has(metricId)) return `${Math.round(value)} days`;
    if (RATIO_METRICS.has(metricId)) return `${parseFloat(value.toFixed(1))}x`;

    return Number.isInteger(value)
      ? value.toLocaleString('en-US')
      : parseFloat(value.toFixed(2)).toLocaleString('en-US');
  }
}
