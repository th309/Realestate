/**
 * Report Generation V2 Service
 *
 * Two-pass AI narrative generation pipeline:
 *   Pass 1: Generate a structural outline (low temperature) for narrative coherence
 *   Pass 2: Generate all sections in parallel, each receiving the outline as context
 *
 * Uses AiProviderService (model-agnostic) instead of the legacy ClaudeService.
 * Section configs come from prompts-v2/ (per-report-type prompt definitions).
 */

import { Injectable, Logger } from '@nestjs/common';
import { AiProviderService } from '../ai-provider/ai-provider.service';
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
} from './report-generation-v2-helpers';
import {
  buildCustomOutlinePrompt,
  buildCustomSectionsFromOutline,
} from './report-generation-v2-custom';

type ReportType = 'homeready' | 'investoredge' | 'comparison' | 'custom';

@Injectable()
export class ReportGenerationV2Service {
  private readonly logger = new Logger(ReportGenerationV2Service.name);
  private lastModelUsed = 'unknown';

  constructor(private readonly aiProvider: AiProviderService) {}

  /**
   * Generate all AI narratives for a report using the two-pass pipeline.
   *
   * @returns Record keyed by section ID, plus `_meta` with version and outline.
   */
  async generateNarratives(
    reportType: ReportType,
    context: Record<string, any>,
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
    const userPrompt = this.buildOutlinePrompt(context, reportType);

    try {
      const response = await this.aiProvider.complete('report_outline', {
        systemPrompt,
        userPrompt,
        maxTokens: 500,
        temperature: 0.4,
      });
      this.logger.log(
        `[v2] Outline generated for ${reportType} in ${response.durationMs}ms`,
      );
      return response.content;
    } catch (error: any) {
      this.logger.error(`[v2] Outline generation failed: ${error.message}`);
      return ''; // Sections can still generate without an outline
    }
  }

  private buildOutlinePrompt(
    context: Record<string, any>,
    reportType: ReportType,
  ): string {
    if (reportType === 'custom') {
      return buildCustomOutlinePrompt(context);
    }

    const audienceLabel =
      reportType === 'investoredge' ? 'real estate investor' : 'homebuyer';
    const scoreKey =
      reportType === 'investoredge' ? 'investoredge_score' : 'homeready_score';
    const score = context[scoreKey] ?? 'N/A';

    return `You are planning a ${reportType} market report for ${context.geography_name || 'a market'}.

Key inputs:
- Audience: ${audienceLabel}
- Overall score: ${score}/100
- Strongest component: ${context.strongest_component || 'N/A'} (${context.strongest_score || 'N/A'}/100)
- Weakest component: ${context.weakest_component || 'N/A'} (${context.weakest_score || 'N/A'}/100)
- Key tension: ${context.key_tension || 'N/A'}
- User goal: ${context.user_goal_summary || context.user_type || 'N/A'}
- Median price: ${context.median_listing_price || context.zhvi || 'N/A'}
- Market signal summary: ${context.market_signal_summary || 'None available'}

Also generate the following (place these BEFORE the outline body):
TITLE: A compelling, insight-driven report title (max 20 words) that captures the key finding. Not "HomeReady Report: Tampa, FL" — something that tells the reader what they'll learn.
SUBTITLE: One sentence expanding on the title.

Then produce a 150-200 word analytical outline for this report. Include:
1. The headline story arc (what is the ONE thing this report should make the reader understand?)
2. Which sections should receive the most emphasis and why
3. Key cross-references between sections (e.g., "affordability section should reference the growth tension")
4. Any contrarian or non-obvious insight the data suggests

This outline will be shared with each section writer to ensure narrative coherence. Be specific and analytical, not generic.`;
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
  ): Promise<Record<string, any>> {
    const results: Record<string, any> = {};

    const promises = sectionIds.map(async (sectionId) => {
      const config = sectionsMap[sectionId];
      if (!config) {
        this.logger.warn(`[v2] No config found for section: ${sectionId}`);
        return { id: sectionId, value: null };
      }

      try {
        const value = await this.generateSection(
          sectionId,
          config,
          systemPrompt,
          context,
          outline,
        );
        return { id: sectionId, value };
      } catch (error: any) {
        this.logger.error(`[v2] Section ${sectionId} failed: ${error.message}`);
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
  ): Promise<string | any> {
    let userPrompt = interpolateTemplate(config.prompt_template, context);

    // Inject outline context
    if (outline) {
      userPrompt = `## REPORT OUTLINE (for narrative coherence)\n${outline}\n\n---\n\n${userPrompt}`;
    }

    // Append news context if available
    userPrompt = appendNewsContext(userPrompt, context);

    const response = await this.aiProvider.complete('report_narrative', {
      systemPrompt,
      userPrompt,
      maxTokens: config.max_tokens,
      responseFormat:
        config.output_format === 'json_object' ? 'json' : undefined,
    });

    // Track last model used for provenance metadata
    this.lastModelUsed = response.model;

    return parseAiResponse(response.content, config.output_format, sectionId);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Private: Section map lookup
  // ════════════════════════════════════════════════════════════════════════

  private getSectionsConfig(reportType: ReportType): {
    sectionIds: readonly string[];
    sectionsMap: Record<string, NarrativePromptConfig>;
  } {
    switch (reportType) {
      case 'homeready':
        return {
          sectionIds: HOMEREADY_V2_SECTION_ORDER,
          sectionsMap: HOMEREADY_V2_SECTIONS,
        };
      case 'investoredge':
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
