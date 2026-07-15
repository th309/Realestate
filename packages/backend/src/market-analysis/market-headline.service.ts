import { Injectable, Logger } from '@nestjs/common';
import { ReportAiService } from '../reports/report-ai.service';
import { RedisService } from '../redis/redis.service';
import { extractJsonObject } from '../ai/extract-json';
import {
  buildHeadlinePrompt,
  buildHeadlineFallback,
  type HeadlineRequest,
  type HeadlineContent,
} from './market-headline-prompt';

export interface MarketHeadlineResult {
  headline: string;
  summary: string;
  generatedAt: string;
  cached: boolean;
}

// 24h — same freshness contract as the 6-section analysis; inputs change slowly.
const CACHE_TTL_SECONDS = 86400;

@Injectable()
export class MarketHeadlineService {
  private readonly logger = new Logger(MarketHeadlineService.name);
  private readonly inflight = new Map<string, Promise<MarketHeadlineResult>>();

  constructor(
    private readonly reportAiService: ReportAiService,
    private readonly redisService: RedisService,
  ) {}

  async generateHeadline(
    request: HeadlineRequest,
  ): Promise<MarketHeadlineResult> {
    const cacheKey = `piq:market-headline:v1:${request.geoType}:${request.geoId}:${request.audience}`;

    const cached = await this.redisService.getByKey(cacheKey);
    if (cached) {
      return { ...(cached as MarketHeadlineResult), cached: true };
    }

    const existing = this.inflight.get(cacheKey);
    if (existing) return existing;

    const promise = this.computeAndCache(request, cacheKey);
    this.inflight.set(cacheKey, promise);
    try {
      return await promise;
    } finally {
      this.inflight.delete(cacheKey);
    }
  }

  private async computeAndCache(
    request: HeadlineRequest,
    cacheKey: string,
  ): Promise<MarketHeadlineResult> {
    let content: HeadlineContent;

    if (this.reportAiService.isAvailable()) {
      content = await this.generateWithAi(request);
    } else {
      this.logger.warn('[MarketHeadline] AI unavailable, using fallback');
      content = buildHeadlineFallback(request);
    }

    const result: MarketHeadlineResult = {
      headline: content.headline,
      summary: content.summary,
      generatedAt: new Date().toISOString(),
      cached: false,
    };

    await this.redisService.setByKey(cacheKey, result, CACHE_TTL_SECONDS);
    return result;
  }

  private async generateWithAi(
    request: HeadlineRequest,
  ): Promise<HeadlineContent> {
    try {
      // Short output — 500 tokens is ample for a headline + 3 sentences and keeps
      // this well under the report-narrative cost of the 6-section analysis.
      const response = await this.reportAiService.complete(
        buildHeadlinePrompt(request),
        500,
      );
      const parsed = extractJsonObject<{ headline?: string; summary?: string }>(
        response,
      );
      if (
        typeof parsed.headline === 'string' &&
        typeof parsed.summary === 'string'
      ) {
        return { headline: parsed.headline, summary: parsed.summary };
      }
      throw new Error('MarketHeadline: AI response missing headline/summary');
    } catch (error) {
      this.logger.error(
        `[MarketHeadline] AI generation failed: ${error.message}`,
      );
      return buildHeadlineFallback(request);
    }
  }
}
