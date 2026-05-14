import { Inject, Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { SupabaseClient } from '@supabase/supabase-js';
import * as crypto from 'node:crypto';
import { MetricResolutionService } from '../metric-resolution/metric-resolution.service';
import type { ResolvedMetric } from '../metric-resolution/metric-resolution.types';
import { ScoringService } from '../scoring/scoring.service';
import type { GeographyLevel } from '../scoring/formula-weights';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import type {
  AnalyzerGeoLevel,
  MarketContextDto,
  MarketContextQueryDto,
  MetricValueDto,
} from './dto/market-context.dto';
import type { AiVerdictRequestDto } from './dto/ai-verdict.dto';
import type { AnalysisSnapshotDto } from './dto/analysis-snapshot.dto';

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
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
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
   * Hard-crashes if ANTHROPIC_API_KEY is missing (CLAUDE.md §1.2 — no
   * default fallbacks for secrets). The content-pipeline and analytics-chat
   * modules wrap the SDK in their own services for streaming/tool-use needs;
   * we instantiate directly here for the same reason — `AnthropicService`
   * only exposes the non-streaming `messages.create` path.
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

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }
    const client = new Anthropic({ apiKey });

    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system:
        'You are a precise, numerate real-estate analyst. Output ONLY valid JSON.',
      messages: [{ role: 'user', content: this.buildVerdictPrompt(payload) }],
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
    }
  }

  /**
   * Insert a new saved analysis for the owner with a generated share token.
   *
   * Returns the new row's `id` and `share_token`; the share token is the
   * only piece a caller needs to build a `/share/:token` link.
   */
  async save(ownerId: string, dto: AnalysisSnapshotDto) {
    // 24 bytes → 32 base64url chars → 192 bits of entropy.
    const shareToken = crypto.randomBytes(24).toString('base64url');
    const { data, error } = await this.supabase
      .from('deal_analyses')
      .insert({ owner_id: ownerId, share_token: shareToken, ...dto })
      .select('id, share_token')
      .single();
    if (error) throw new Error(`save failed: ${error.message}`);
    return data;
  }

  /**
   * List saved analyses for the owner, newest first. Cursor is the
   * `created_at` of the last row from the previous page.
   */
  async list(
    ownerId: string,
    opts: { limit: number; cursor?: string } = { limit: 20 },
  ) {
    let q = this.supabase
      .from('deal_analyses')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(opts.limit);
    if (opts.cursor) q = q.lt('created_at', opts.cursor);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data;
  }

  /**
   * Fetch a single saved analysis owned by the caller. Returns `null` if
   * not found or not owned by them (caller turns this into a 404).
   */
  async getOne(ownerId: string, id: string) {
    const { data, error } = await this.supabase
      .from('deal_analyses')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('id', id)
      .single();
    if (error) return null;
    return data;
  }

  /**
   * Delete a saved analysis owned by the caller. Idempotent — deleting a
   * row that doesn't exist (or isn't owned) is a no-op from PostgREST.
   */
  async remove(ownerId: string, id: string) {
    const { error } = await this.supabase
      .from('deal_analyses')
      .delete()
      .eq('owner_id', ownerId)
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  /**
   * Resolve a public share token via the SECURITY DEFINER RPC from Task 8's
   * migration. Returns the first row (the RPC is designed to return at most
   * one) or `null` if the token isn't valid.
   */
  async getShared(token: string) {
    const { data, error } = await this.supabase.rpc('get_shared_analysis', {
      p_token: token,
    });
    if (error) return null;
    if (!data || data.length === 0) return null;
    return data[0];
  }
}
