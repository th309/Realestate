/**
 * AiInsightsService — generates AI insights for analyzer sections.
 *
 * - Composite cache key from deterministic input + provider responses (24h TTL)
 * - Resolves model purpose: header_verdict → analyzer_header_verdict,
 *   else → analyzer_section_annotation
 * - Streams header verdict via async generator
 */

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AiInsightsCache, CachedInsight } from './ai-insights.cache';
import { AiProviderService } from '../ai-provider/ai-provider.service';
import { getSectionPrompt, SectionId } from './prompts/section-prompts';

export interface InsightPayload {
  input: any;
  result: any;
  rentcast: any;
  piq: any;
}

export interface InsightResult extends CachedInsight {
  cacheHit: boolean;
}

const SYSTEM_PROMPT =
  'You are a precise, numerate real-estate analyst. Cite specific numbers from the data provided. Never invent figures. Output 1-2 sentences max.';

@Injectable()
export class AiInsightsService {
  constructor(
    private readonly cache: AiInsightsCache,
    private readonly provider: AiProviderService,
  ) {}

  async complete(
    payload: InsightPayload,
    sectionId: SectionId,
  ): Promise<InsightResult> {
    const key = this.cache.computeKey(payload, sectionId);
    const cached = await this.cache.get(key);
    if (cached) return { ...cached, cacheHit: true };

    const userPrompt = this.assemblePrompt(payload, sectionId);
    const purpose =
      sectionId === 'header_verdict'
        ? 'analyzer_header_verdict'
        : 'analyzer_section_annotation';

    const response = await this.provider.complete(purpose, {
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 200,
    });

    const result: CachedInsight = {
      text: response.content ?? '',
      threadId: randomUUID(),
      citedFacts: [],
    };
    await this.cache.set(key, result);
    return { ...result, cacheHit: false };
  }

  async *stream(payload: InsightPayload): AsyncGenerator<string> {
    const userPrompt = this.assemblePrompt(payload, 'header_verdict');
    yield* this.provider.stream('analyzer_header_verdict', {
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 200,
    });
  }

  private assemblePrompt(
    payload: InsightPayload,
    sectionId: SectionId,
  ): string {
    const comps = (payload.rentcast?.salesComps ?? []).slice(0, 5);
    const rentComps = (payload.rentcast?.rentalComps ?? []).slice(0, 5);
    return [
      'DEAL INPUT:',
      JSON.stringify(payload.input, null, 2),
      '',
      'COMPUTED METRICS (analyzer-core, deterministic):',
      JSON.stringify(payload.result, null, 2),
      '',
      'PROPERTY DATA (RentCast):',
      `- AVM: ${payload.rentcast?.avm?.value ?? 'unavailable'}`,
      `- Rent estimate: ${payload.rentcast?.rent?.value ?? 'unavailable'}`,
      `- Top sales comps: ${comps.map((c: any) => `${c.address} $${c.price} (${c.distance}mi)`).join('; ')}`,
      `- Top rental comps: ${rentComps.map((c: any) => `${c.address} $${c.rent}/mo`).join('; ')}`,
      '',
      'MARKET CONTEXT (PropertyIQ):',
      `- PIQ Score: ${payload.piq?.score ?? 'n/a'} (${payload.piq?.label ?? ''})`,
      `- Market heat: ${payload.piq?.marketHeat ?? 'n/a'}`,
      `- Rent index: ${payload.piq?.rentIndex ?? 'n/a'}`,
      `- Net migration: ${payload.piq?.netMigration ?? 'n/a'}`,
      '',
      'TASK:',
      getSectionPrompt(sectionId),
    ].join('\n');
  }
}
