/**
 * AiInsightsService — generates AI insights for analyzer sections.
 *
 * - `completeAllSections()` is the primary path: one Anthropic call returning
 *   all six section annotations as JSON. Replaces the per-section pattern
 *   that fired six concurrent requests and tripped Anthropic's upstream rate
 *   limit on every analyzer page load.
 * - `complete()` remains for callers that need a single section (e.g., admin
 *   smoke tests) but is no longer used by the analyzer page.
 * - `stream()` is the header-verdict SSE path, unchanged.
 * - Composite cache key from deterministic input + provider responses (24h TTL)
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AiInsightsCache, CachedInsight } from './ai-insights.cache';
import { AiProviderService } from '../ai-provider/ai-provider.service';
import {
  getSectionPrompt,
  buildBatchedSectionTasks,
  BATCHED_SECTION_IDS,
  type SectionId,
  type BatchedSectionId,
} from './prompts/section-prompts';
import { type AnalysisStrategy } from './prompts/strategy-context';
import {
  assemblePrompt,
  type AssemblePromptPayload,
} from './prompts/assemble-prompt';

export type { AnalysisStrategy };

export type InsightPayload = AssemblePromptPayload;

export interface InsightResult extends CachedInsight {
  cacheHit: boolean;
}

export type BatchedInsightResult = Record<BatchedSectionId, InsightResult>;

const SYSTEM_PROMPT = [
  'You are a precise, numerate real-estate analyst speaking to the investor like a knowledgeable friend.',
  'Cite specific numbers from the data provided. Never invent figures.',
  'Money: always whole dollars, no cents. Write "$1,068" not "$1,068.49". Write "$552,800" not "$552,800.00". Round to the nearest dollar before writing.',
  'Other numbers (ratios, percents, days, scores) keep their natural precision. "0.71 DSCR" stays "0.71".',
  'Write conversational prose. No markdown formatting at all: no asterisks for bold, no underscores around words.',
  'No em-dashes. Use commas, periods, or the word "and" instead.',
  'When the data contains code-style identifiers (UPPER_SNAKE_CASE like REFI_NOT_FINANCEABLE, or camelCase field names like rentMonthly, interestRatePct), translate them into plain English. "REFI_NOT_FINANCEABLE" becomes "the refinance can\'t be financed". "rentMonthly" becomes "monthly rent". Never leave the identifier raw in the output.',
  'CRITICAL: never leave a thought unfinished. Every sentence you write must end with a period and a complete idea. If you are running low on space, stop at the previous complete sentence rather than starting one you can\'t finish. Never end with "$" or any other dangling fragment.',
  'Length: follow the section task brief. Be tight.',
].join(' ');

/**
 * Per-section token budget. Most sections need 1-2 sentences and 200 tokens
 * is plenty. The recommendation_analysis section is the centerpiece of the
 * grade card and asks for 3-5 sentences with concrete numbers, so it gets a
 * larger budget to avoid mid-thought truncation. Header verdict is also a
 * single sentence at most.
 */
function maxTokensForSection(sectionId: SectionId): number {
  if (sectionId === 'recommendation_analysis') return 450;
  return 200;
}

/** Batched call must fit recommendation_analysis (~450) + five short sections
 *  (~150 each) plus JSON syntax overhead. 1600 leaves comfortable headroom. */
const BATCH_MAX_TOKENS = 1600;

@Injectable()
export class AiInsightsService {
  private readonly logger = new Logger(AiInsightsService.name);

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

    const userPrompt = assemblePrompt(payload, getSectionPrompt(sectionId));
    const purpose =
      sectionId === 'header_verdict'
        ? 'analyzer_header_verdict'
        : 'analyzer_section_annotation';

    const response = await this.provider.complete(purpose, {
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: maxTokensForSection(sectionId),
    });

    const result: CachedInsight = {
      text: response.content ?? '',
      threadId: randomUUID(),
      citedFacts: [],
    };
    await this.cache.set(key, result);
    return { ...result, cacheHit: false };
  }

  /**
   * Generate all six section annotations in ONE Anthropic call. This is what
   * the analyzer page uses. Cached under a single composite key so identical
   * payloads short-circuit before hitting the provider at all.
   */
  async completeAllSections(
    payload: InsightPayload,
  ): Promise<BatchedInsightResult> {
    const key = this.cache.computeKey(payload, 'batch');
    const cached = await this.cache.get(key);
    if (cached) {
      const parsed = this.parseBatchedJson(cached.text);
      return this.buildBatchedResult(parsed, cached.threadId, true);
    }

    const userPrompt = assemblePrompt(payload, buildBatchedSectionTasks());
    // Reuse the existing analyzer_section_annotation purpose so this inherits
    // the same model/temperature config admins have already tuned for section
    // annotations. Avoids requiring a new ai_model_config row to ship.
    const response = await this.provider.complete(
      'analyzer_section_annotation',
      {
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        maxTokens: BATCH_MAX_TOKENS,
        responseFormat: 'json',
      },
    );

    const rawText = response.content ?? '';
    const parsed = this.parseBatchedJson(rawText);

    const threadId = randomUUID();
    await this.cache.set(key, {
      text: rawText,
      threadId,
      citedFacts: [],
    });

    return this.buildBatchedResult(parsed, threadId, false);
  }

  async *stream(payload: InsightPayload): AsyncGenerator<string> {
    const userPrompt = assemblePrompt(
      payload,
      getSectionPrompt('header_verdict'),
    );
    yield* this.provider.stream('analyzer_header_verdict', {
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 200,
    });
  }

  /**
   * Parse the batched JSON response. Tolerates accidental code-fence wrapping
   * by stripping ``` fences before parsing. Missing keys are filled with an
   * empty string downstream so a partial response doesn't crash the page.
   */
  private parseBatchedJson(
    text: string,
  ): Partial<Record<BatchedSectionId, string>> {
    const stripped = text
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '');
    try {
      const obj = JSON.parse(stripped);
      return obj && typeof obj === 'object' ? obj : {};
    } catch (err) {
      this.logger.warn(
        `Batched insights JSON parse failed: ${err instanceof Error ? err.message : String(err)}. Falling back to empty sections.`,
      );
      return {};
    }
  }

  private buildBatchedResult(
    parsed: Partial<Record<BatchedSectionId, string>>,
    threadId: string,
    cacheHit: boolean,
  ): BatchedInsightResult {
    const result = {} as BatchedInsightResult;
    for (const id of BATCHED_SECTION_IDS) {
      result[id] = {
        text: typeof parsed[id] === 'string' ? parsed[id] : '',
        threadId,
        citedFacts: [],
        cacheHit,
      };
    }
    return result;
  }
}
