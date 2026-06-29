/**
 * Report Generation V2 Service
 *
 * Two-pass AI narrative generation pipeline:
 *   Pass 1: Generate a structural outline (low temperature) for narrative coherence
 *   Pass 2: Generate all sections in parallel, each receiving the outline as context
 *
 * Uses AiProviderService (model-agnostic) instead of the legacy ReportAiService.
 * Section configs come from prompts-v2/ (per-report-type prompt definitions).
 */

import { Injectable, Logger } from '@nestjs/common';
import { AiProviderService } from '../ai-provider/ai-provider.service';
import { AI_PURPOSES } from '../ai-provider/ai-provider.types';
import {
  HOMEREADY_V2_SECTIONS,
  HOMEREADY_V2_SECTION_ORDER,
  INVESTOREDGE_V2_SECTIONS,
  INVESTOR_V2_SECTION_ORDER,
  COMPARISON_V2_SECTIONS,
  COMPARISON_V2_SECTION_ORDER,
  getSystemPromptForReportType,
} from './prompts-v2';
import type { NarrativePromptConfig } from './narrative-prompt-shared';
import {
  interpolateTemplate,
  appendNewsContext,
  parseAiResponse,
  extractTitleAndSubtitle,
  extractActionItems,
  buildOutlinePrompt,
} from './report-generation-v2-helpers';
import { buildCustomSectionsFromOutline } from './report-generation-v2-custom';
import { retryWithBackoff } from './report-ai-text-helpers';

type ReportType =
  | 'propertyiq'
  | 'homeready'
  | 'investoredge'
  | 'comparison'
  | 'custom';

@Injectable()
export class ReportGenerationV2Service {
  private readonly logger = new Logger(ReportGenerationV2Service.name);
  private lastModelUsed = 'unknown';

  // Global cap on concurrent section AI calls (see withSectionSlot).
  private static readonly MAX_CONCURRENT_SECTIONS = 8;
  private activeSectionCalls = 0;
  private readonly sectionWaiters: Array<() => void> = [];

  constructor(private readonly aiProvider: AiProviderService) {}

  /**
   * Run `fn` under a global concurrency cap. Comparison reports generate the
   * synthesis + every per-market narrative in parallel, each fanning out its own
   * sections; without a cap a 4-market comparison fires ~30+ provider calls at
   * once and a single 429 would trigger a synchronized retry wave (which could
   * even make the orchestrator's empty-narrative guard false-fail). 8-wide keeps
   * strong parallelism while staying within provider rate limits.
   */
  private async withSectionSlot<T>(fn: () => Promise<T>): Promise<T> {
    if (
      this.activeSectionCalls >=
      ReportGenerationV2Service.MAX_CONCURRENT_SECTIONS
    ) {
      await new Promise<void>((resolve) => this.sectionWaiters.push(resolve));
    }
    this.activeSectionCalls++;
    try {
      return await fn();
    } finally {
      this.activeSectionCalls--;
      this.sectionWaiters.shift()?.();
    }
  }

  /**
   * Generate all AI narratives for a report using the two-pass pipeline.
   *
   * @returns Record keyed by section ID, plus `_meta` with version and outline.
   */
  async generateNarratives(
    reportType: ReportType,
    context: Record<string, any>,
    /** Route section calls to the faster comparison model (deepseek-v4-flash). */
    useComparisonModel = false,
  ): Promise<Record<string, string | any>> {
    const systemPrompt = getSystemPromptForReportType(reportType);

    // ── Pass 1: Generate outline ──────────────────────────────────────
    const outline = await this.generateOutline(
      systemPrompt,
      context,
      reportType,
    );

    // ── Pass 2: Build section config and generate in parallel ─────────
    const { sectionIds, sectionsMap } =
      reportType === 'custom'
        ? buildCustomSectionsFromOutline(outline, context)
        : this.getSectionsConfig(reportType);

    const results = await this.generateAllSections(
      sectionIds,
      sectionsMap,
      systemPrompt,
      context,
      outline,
      useComparisonModel,
    );

    const { title, subtitle } = extractTitleAndSubtitle(outline);
    results._meta = { version: 'v2', outline, title, subtitle };
    (results as any).__model_used = this.lastModelUsed;
    return results;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Private: Pass 1 — Outline
  // ════════════════════════════════════════════════════════════════════════

  private async generateOutline(
    systemPrompt: string,
    context: Record<string, any>,
    reportType: ReportType,
  ): Promise<string> {
    const userPrompt = buildOutlinePrompt(context, reportType);

    try {
      const response = await retryWithBackoff(
        () =>
          this.aiProvider.complete(AI_PURPOSES.REPORT_OUTLINE, {
            systemPrompt,
            userPrompt,
            maxTokens: 500,
            temperature: 0.4,
          }),
        'v2:outline',
        this.logger,
      );
      this.logger.log(
        `[v2] Outline generated for ${reportType} in ${response.durationMs}ms`,
      );
      return response.content;
    } catch (error: any) {
      this.logger.error(`[v2] Outline generation failed: ${error.message}`);
      return ''; // Sections can still generate without an outline
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Private: Pass 2 — Section generation (parallel)
  // ════════════════════════════════════════════════════════════════════════

  private async generateAllSections(
    sectionIds: readonly string[],
    sectionsMap: Record<string, NarrativePromptConfig>,
    systemPrompt: string,
    context: Record<string, any>,
    outline: string,
    useComparisonModel = false,
  ): Promise<Record<string, any>> {
    const results: Record<string, any> = {};

    const promises = sectionIds.map(async (sectionId) => {
      const config = sectionsMap[sectionId];
      if (!config) {
        this.logger.warn(`[v2] No config found for section: ${sectionId}`);
        return { id: sectionId, value: null };
      }

      try {
        const value = await retryWithBackoff(
          () =>
            this.generateSection(
              sectionId,
              config,
              systemPrompt,
              context,
              outline,
              useComparisonModel,
            ),
          `v2:${sectionId}`,
          this.logger,
        );
        return { id: sectionId, value };
      } catch (error: any) {
        this.logger.error(
          `[v2] Section ${sectionId} failed after all retries: ${error.message}`,
        );
        return { id: sectionId, value: null };
      }
    });

    const settled = await Promise.allSettled(promises);
    for (const result of settled) {
      if (result.status === 'fulfilled' && result.value.value !== null) {
        results[result.value.id] = result.value.value;
      }
    }

    return results;
  }

  private async generateSection(
    sectionId: string,
    config: NarrativePromptConfig,
    systemPrompt: string,
    context: Record<string, any>,
    outline: string,
    useComparisonModel = false,
  ): Promise<string | any> {
    let userPrompt = interpolateTemplate(config.prompt_template, context);

    // Inject outline context
    if (outline) {
      userPrompt = `## REPORT OUTLINE (for narrative coherence)\n${outline}\n\n---\n\n${userPrompt}`;
    }

    // Append news context if available
    userPrompt = appendNewsContext(userPrompt, context);

    const response = await this.withSectionSlot(() =>
      this.aiProvider.complete(
        useComparisonModel
          ? AI_PURPOSES.REPORT_NARRATIVE_COMPARISON
          : AI_PURPOSES.REPORT_NARRATIVE,
        {
          systemPrompt,
          userPrompt,
          maxTokens: config.max_tokens,
          responseFormat:
            config.output_format === 'json_object' ? 'json' : undefined,
        },
      ),
    );

    // Track last model used for provenance metadata
    this.lastModelUsed = response.model;

    // Empty completion = failure (reasoning model starved its answer budget);
    // retry instead of storing a blank section. resolveMaxTokens is the root fix.
    if (!response.content || response.content.trim().length === 0) {
      throw new Error(`Empty completion for section ${sectionId}`);
    }

    const parsed = parseAiResponse(
      response.content,
      config.output_format,
      sectionId,
    );

    // Extract ACTION_ITEMS_JSON from text sections that embed it
    if (
      typeof parsed === 'string' &&
      (sectionId === 'investment_thesis' || sectionId === 'verdict_and_actions')
    ) {
      const { narrative, action_items } = extractActionItems(parsed);
      if (action_items) {
        return { narrative, action_items };
      }
      return narrative;
    }

    return parsed;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Private: Section map lookup
  // ════════════════════════════════════════════════════════════════════════

  private getSectionsConfig(reportType: ReportType): {
    sectionIds: readonly string[];
    sectionsMap: Record<string, NarrativePromptConfig>;
  } {
    switch (reportType) {
      case 'propertyiq':
      case 'homeready': // legacy backward compat
        return {
          sectionIds: HOMEREADY_V2_SECTION_ORDER,
          sectionsMap: HOMEREADY_V2_SECTIONS,
        };
      case 'investoredge': // legacy backward compat
        return {
          sectionIds: INVESTOR_V2_SECTION_ORDER,
          sectionsMap: INVESTOREDGE_V2_SECTIONS,
        };
      case 'comparison':
        return {
          sectionIds: COMPARISON_V2_SECTION_ORDER,
          sectionsMap: COMPARISON_V2_SECTIONS,
        };
      default:
        return { sectionIds: [], sectionsMap: {} };
    }
  }
}
