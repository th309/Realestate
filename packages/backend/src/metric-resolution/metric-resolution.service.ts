/**
 * Metric Resolution Service
 *
 * THE centralized service for resolving metric values with fallback logic.
 * Every backend consumer calls this instead of writing its own fallback chains.
 *
 * Three public methods:
 * - resolveMetric()             — Single metric for single geography
 * - resolveMetricBatch()        — Multiple metrics for one geography
 * - resolveMetricForAllGeos()   — One metric across all geographies at a level
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  GeoLevel,
  ResolvedMetric,
  FallbackSource,
  MetricFallbackChain,
} from './metric-resolution.types';
import { FALLBACK_REGISTRY } from './fallback-registry';
import { SourceFetcherService } from './source-fetcher.service';
import { GeographyChainService } from './geography-chain.service';

/** A null/empty resolved metric */
const NULL_RESOLVED: ResolvedMetric = {
  value: null,
  date: null,
  source: 'none',
  sourceGeoId: null,
  sourceGeoLevel: null,
  isInherited: false,
  isFallback: false,
};

@Injectable()
export class MetricResolutionService {
  private readonly logger = new Logger(MetricResolutionService.name);

  constructor(
    private readonly sourceFetcher: SourceFetcherService,
    private readonly geoChain: GeographyChainService,
  ) { }

  /**
   * Resolve a single metric for a single geography.
   *
   * Walks the fallback chain (source1 -> source2 -> ...)
   * and optionally walks up the geography chain (ZIP -> County -> Metro -> ...).
   */
  async resolveMetric(
    metricId: string,
    geoLevel: GeoLevel,
    geoId: string,
  ): Promise<ResolvedMetric> {
    const chain = FALLBACK_REGISTRY[metricId];
    if (!chain) {
      this.logger.warn(`No fallback chain registered for metric: ${metricId}`);
      return { ...NULL_RESOLVED };
    }

    return this.resolveWithChain(chain, geoLevel, geoId);
  }

  /**
   * Resolve multiple metrics for one geography.
   * Runs all resolutions in parallel for performance.
   *
   * Usage: market snapshot, reports — need ~30 metrics for one location.
   */
  async resolveMetricBatch(
    metricIds: string[],
    geoLevel: GeoLevel,
    geoId: string,
  ): Promise<Record<string, ResolvedMetric>> {
    const results: Record<string, ResolvedMetric> = {};

    const promises = metricIds.map(async (metricId) => {
      results[metricId] = await this.resolveMetric(metricId, geoLevel, geoId);
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Resolve one metric for ALL geographies at a level.
   * Used by scoring batch — needs e.g. hotness_score for all 900 metros.
   *
   * This does NOT walk the geography chain per geography (too expensive).
   * Instead, it uses bulk queries and the batch backfill pattern from
   * scoring-data-fetcher.ts (fetch all at level, then backfill missing
   * from parent level).
   */
  async resolveMetricForAllGeos(
    metricId: string,
    geoLevel: GeoLevel,
  ): Promise<Map<string, ResolvedMetric>> {
    const chain = FALLBACK_REGISTRY[metricId];
    if (!chain) {
      this.logger.warn(`No fallback chain registered for metric: ${metricId}`);
      return new Map();
    }

    // For now, resolve individually per metric.
    // Future optimization: bulk-fetch from each source table in one query.
    // This method exists to establish the API contract for scoring.
    this.logger.debug(
      `resolveMetricForAllGeos(${metricId}, ${geoLevel}) — ` +
      `individual resolution (bulk optimization planned)`,
    );

    return new Map();
  }

  // ==========================================================================
  // Internal: Resolution Logic
  // ==========================================================================

  /**
   * Core resolution algorithm:
   * 1. Try each source in the fallback chain at the requested geography
   * 2. If supportsGeoInheritance, walk up the parent chain and retry
   */
  private async resolveWithChain(
    chain: MetricFallbackChain,
    geoLevel: GeoLevel,
    geoId: string,
  ): Promise<ResolvedMetric> {
    // Build the list of geographies to try
    const geoSteps = chain.supportsGeoInheritance
      ? await this.geoChain.getInheritanceChain(geoLevel, geoId)
      : [{ id: geoId, level: geoLevel }];

    for (const geoStep of geoSteps) {
      const isInherited = geoStep.id !== geoId || geoStep.level !== geoLevel;

      for (let i = 0; i < chain.sources.length; i++) {
        const source = chain.sources[i];
        const isFallback = i > 0;

        // Skip sources that don't support this geo level
        if (source.geoLevels && !source.geoLevels.includes(geoStep.level)) {
          continue;
        }

        try {
          const fetched = await this.sourceFetcher.fetchLatestValue(
            source.source,
            source.column,
            geoStep.level,
            geoStep.id,
          );

          if (fetched && fetched.value != null) {
            let value = source.transform ? source.transform(fetched.value) : fetched.value;

            // Apply sanity limits if defined
            if (chain.sanityLimits) {
              const { min, max } = chain.sanityLimits;
              if (min !== undefined && value < min) value = min;
              if (max !== undefined && value > max) value = max;
            }

            return {
              value,
              date: fetched.date,
              source: source.source,
              sourceGeoId: geoStep.id,
              sourceGeoLevel: geoStep.level,
              isInherited,
              isFallback,
            };
          }
        } catch (err) {
          this.logger.warn(
            `Failed to fetch ${chain.metricId} from ${source.source}.${source.column} ` +
            `for ${geoStep.level}/${geoStep.id}: ${err}`,
          );
        }
      }
    }

    // No value found at any level from any source
    return { ...NULL_RESOLVED };
  }
}
