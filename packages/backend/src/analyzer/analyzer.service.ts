import { Injectable, Logger } from '@nestjs/common';
import { MetricResolutionService } from '../metric-resolution/metric-resolution.service';
import type { ResolvedMetric } from '../metric-resolution/metric-resolution.types';
import { ScoringService } from '../scoring/scoring.service';
import type { GeographyLevel } from '../scoring/formula-weights';
import type {
  AnalyzerGeoLevel,
  MarketContextDto,
  MarketContextQueryDto,
  MetricValueDto,
} from './dto/market-context.dto';

/** Metric IDs requested for analyzer market context. */
const MARKET_CONTEXT_METRICS = [
  'home_value',
  'rent_index',
  'market_heat',
  'net_migration',
] as const;

/** Empty payload when no geography is identifiable from the query. */
const EMPTY_CONTEXT: MarketContextDto = {
  geo_level: null,
  geo_id: null,
  home_value: null,
  rent_index: null,
  market_heat: null,
  net_migration: null,
  piq_score: null,
};

/**
 * Convert MetricResolutionService's ResolvedMetric into the lighter
 * (value, source) shape the analyzer exposes to its clients.
 *
 * The resolver returns `source: 'none'` when no source produced a value.
 * We normalize that to `null` so callers don't need to treat 'none' specially.
 */
function toMetricValueDto(
  resolved: ResolvedMetric | undefined,
): MetricValueDto | null {
  if (!resolved) return null;
  if (resolved.value == null) {
    return { value: null, source: null };
  }
  return {
    value: resolved.value,
    source: resolved.source === 'none' ? null : resolved.source,
  };
}

@Injectable()
export class AnalyzerService {
  private readonly logger = new Logger(AnalyzerService.name);

  constructor(
    private readonly metricResolution: MetricResolutionService,
    private readonly scoringService: ScoringService,
  ) {}

  /**
   * Aggregate market-context payload for the deal analyzer.
   *
   * Resolves four key metrics through MetricResolutionService (so the
   * configured fallback chains apply), plus the PropertyIQ score for
   * the same geography. Per-field failures degrade to nulls; the call
   * never throws.
   *
   * Note on `state`: the PropertyIQ scoring engine only supports
   * metro / county / zip geographies (see GeographyLevel). When the
   * caller asks for a state, metrics still resolve but `piq_score` is null.
   */
  async getMarketContext(
    params: MarketContextQueryDto,
  ): Promise<MarketContextDto> {
    let geoLevel: AnalyzerGeoLevel | null = null;
    let geoId: string | null = null;

    if (params.zip) {
      geoLevel = 'zip';
      geoId = params.zip;
    } else if (params.county_fips) {
      geoLevel = 'county';
      geoId = params.county_fips;
    } else if (params.state) {
      geoLevel = 'state';
      geoId = params.state;
    }

    if (!geoLevel || !geoId) {
      return { ...EMPTY_CONTEXT };
    }

    const metrics = await this.metricResolution
      .resolveMetricBatch([...MARKET_CONTEXT_METRICS], geoLevel, geoId)
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `resolveMetricBatch failed for ${geoLevel}/${geoId}: ${message}`,
        );
        return {} as Record<string, ResolvedMetric>;
      });

    let piq: MarketContextDto['piq_score'] = null;
    if (geoLevel !== 'state') {
      try {
        const result = await this.scoringService.getScore(
          geoId,
          geoLevel as GeographyLevel,
        );
        const piqResult = result?.scores?.propertyiq;
        if (piqResult && typeof piqResult.score === 'number') {
          piq = { value: piqResult.score, label: piqResult.grade };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `PropertyIQ score lookup failed for ${geoLevel}/${geoId}: ${message}`,
        );
      }
    }

    return {
      geo_level: geoLevel,
      geo_id: geoId,
      home_value: toMetricValueDto(metrics.home_value),
      rent_index: toMetricValueDto(metrics.rent_index),
      market_heat: toMetricValueDto(metrics.market_heat),
      net_migration: toMetricValueDto(metrics.net_migration),
      piq_score: piq,
    };
  }
}
