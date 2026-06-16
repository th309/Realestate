import { Injectable, Logger } from '@nestjs/common';
import { MetricResolutionService } from '../metric-resolution/metric-resolution.service';
import { GeographyChainService } from '../metric-resolution/geography-chain.service';
import type {
  ResolvedMetric,
  GeoChainStep,
} from '../metric-resolution/metric-resolution.types';
import { ScoringService } from '../scoring/scoring.service';
import type { GeographyLevel } from '../scoring/formula-weights';
import { RentcastService } from '../rentcast/rentcast.service';
import { AiProviderService } from '../ai-provider/ai-provider.service';
import { AI_PURPOSES } from '../ai-provider/ai-provider.types';
import type {
  AnalyzerGeoLevel,
  MarketContextDto,
  MarketContextQueryDto,
  MetricValueDto,
} from './dto/market-context.dto';
import { chainToDto } from './chain-to-dto';
import type { AiVerdictRequestDto } from './dto/ai-verdict.dto';
import type { PropertyLookupDto } from './dto/property-lookup.dto';

/** Metric IDs requested for analyzer market context. */
const MARKET_CONTEXT_METRICS = [
  'home_value',
  'home_value_yoy',
  'rent_index',
  'market_heat',
  'net_migration',
] as const;

/** Empty payload when no geography is identifiable from the query. */
const EMPTY_CONTEXT: MarketContextDto = {
  geo_level: null,
  geo_id: null,
  home_value: null,
  home_value_yoy: null,
  rent_index: null,
  market_heat: null,
  net_migration: null,
  piq_score: null,
  chain: null,
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
    private readonly geographyChain: GeographyChainService,
    private readonly scoringService: ScoringService,
    private readonly rentcast: RentcastService,
    private readonly aiProvider: AiProviderService,
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

    // Order matters: most-specific first when caller passes multiple (defensive
    // against duplicate-param bugs). Metro slots between county and state.
    if (params.zip) {
      geoLevel = 'zip';
      geoId = params.zip;
    } else if (params.county_fips) {
      geoLevel = 'county';
      geoId = params.county_fips;
    } else if (params.cbsa_code) {
      geoLevel = 'metro';
      geoId = params.cbsa_code;
    } else if (params.state) {
      geoLevel = 'state';
      geoId = params.state;
    }

    if (!geoLevel || !geoId) {
      return { ...EMPTY_CONTEXT };
    }

    // Metrics + chain are independent — fetch in parallel. Chain is LRU-cached
    // in GeographyChainService so this is near-free on warm calls.
    const [metrics, chainSteps] = await Promise.all([
      this.metricResolution
        .resolveMetricBatch([...MARKET_CONTEXT_METRICS], geoLevel, geoId)
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `resolveMetricBatch failed for ${geoLevel}/${geoId}: ${message}`,
          );
          return {} as Record<string, ResolvedMetric>;
        }),
      this.geographyChain
        .getInheritanceChain(geoLevel, geoId)
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `getInheritanceChain failed for ${geoLevel}/${geoId}: ${message}`,
          );
          return [] as GeoChainStep[];
        }),
    ]);

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
      home_value_yoy: toMetricValueDto(metrics.home_value_yoy),
      rent_index: toMetricValueDto(metrics.rent_index),
      market_heat: toMetricValueDto(metrics.market_heat),
      net_migration: toMetricValueDto(metrics.net_migration),
      piq_score: piq,
      chain: chainSteps.length > 0 ? chainToDto(chainSteps) : null,
    };
  }

  /**
   * Fetch a consolidated property snapshot (record + AVM + rent estimate)
   * from RentCast in a single round trip.
   *
   * Uses `Promise.allSettled` so per-source failures degrade to nulls rather
   * than failing the whole request — a successful AVM is useful even if the
   * rent estimate is unavailable. Rejection reasons are surfaced via the
   * `errors` field so the UI can show *why* a section is empty (silent nulls
   * are a debugging hellscape).
   */
  async lookupProperty(address: string): Promise<PropertyLookupDto> {
    const [recordResult, avmResult, rentResult] = await Promise.allSettled([
      this.rentcast.getPropertyRecord(address),
      this.rentcast.getValueEstimate(address),
      this.rentcast.getRentEstimate(address),
    ]);

    const reason = (r: PromiseSettledResult<unknown>): string | undefined =>
      r.status === 'rejected'
        ? String((r.reason as Error)?.message ?? r.reason)
        : undefined;
    const errPropertyRecord = reason(recordResult);
    const errAvm = reason(avmResult);
    const errRent = reason(rentResult);

    const property_record =
      recordResult.status === 'fulfilled' ? recordResult.value : null;
    const avmRaw = avmResult.status === 'fulfilled' ? avmResult.value : null;
    const rentRaw = rentResult.status === 'fulfilled' ? rentResult.value : null;

    const errors: PropertyLookupDto['errors'] = {};
    if (errPropertyRecord) errors.property = errPropertyRecord;
    if (errAvm) errors.avm = errAvm;
    if (errRent) errors.rent = errRent;

    if (errPropertyRecord || errAvm || errRent) {
      this.logger.warn(
        `[lookupProperty] partial failure for "${address}" — property=${errPropertyRecord ?? 'ok'}, avm=${errAvm ?? 'ok'}, rent=${errRent ?? 'ok'}`,
      );
    }

    const resolved_address =
      avmRaw?.resolvedAddress ?? rentRaw?.resolvedAddress;

    return {
      property_record,
      avm: avmRaw
        ? {
            value: avmRaw.value,
            low: avmRaw.low,
            high: avmRaw.high,
            comps_count: avmRaw.comps.length,
          }
        : null,
      rent: rentRaw
        ? {
            value: rentRaw.rent,
            low: rentRaw.low,
            high: rentRaw.high,
            comps_count: rentRaw.comps.length,
          }
        : null,
      sales_comps: avmRaw?.comps ?? [],
      rental_comps: rentRaw?.comps ?? [],
      cache_age_days: 0,
      source: 'rentcast',
      ...(resolved_address ? { resolved_address } : {}),
      ...(Object.keys(errors).length > 0 ? { errors } : {}),
    };
  }

  /**
   * Build the user-message prompt for the AI verdict call.
   *
   * Pure / side-effect-free so unit tests can validate prompt structure
   * without wiring the rest of the service.
   */
  buildVerdictPrompt(payload: {
    input: unknown;
    result: unknown;
    marketContext?: unknown;
  }): string {
    return [
      'You are an experienced real-estate investor evaluating a single deal.',
      'Return ONLY a JSON object with this shape: {"verdict":"buy"|"negotiate"|"pass","target_price":number|null,"strengths":string[],"risks":string[],"reasoning":string}.',
      '',
      'Deal input:',
      JSON.stringify(payload.input),
      '',
      'Computed metrics:',
      JSON.stringify(payload.result),
      payload.marketContext
        ? `\nMarket context:\n${JSON.stringify(payload.marketContext)}`
        : '',
      '',
      'Consider: cap rate vs market, DSCR (must be > 1.0), cashflow margin, PropertyIQ score, rent trend.',
      'Be specific. Cite numbers. Output ONLY the JSON object.',
    ].join('\n');
  }

  /**
   * Stream an AI verdict as text deltas.
   *
   * Delegates to `AiProviderService.stream()` under the
   * `analyzer_header_verdict` purpose so model selection, API-key
   * resolution, and usage telemetry all live in the shared abstraction
   * (CLAUDE.md §1.2 — no direct SDK use here).
   */
  async *streamAiVerdict(payload: AiVerdictRequestDto): AsyncGenerator<string> {
    // Cap combined serialized input+result at 4KB to prevent cost amplification
    // via giant payloads. Real analyzer inputs are well under 1KB.
    const totalSize =
      JSON.stringify(payload.input).length +
      JSON.stringify(payload.result).length;
    if (totalSize > 4096) {
      throw new Error('payload too large');
    }

    yield* this.aiProvider.stream(AI_PURPOSES.ANALYZER_HEADER_VERDICT, {
      systemPrompt:
        'You are a precise, numerate real-estate analyst. Output ONLY valid JSON.',
      userPrompt: this.buildVerdictPrompt(payload),
      maxTokens: 800,
    });
  }
}
