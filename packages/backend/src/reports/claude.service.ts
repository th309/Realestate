/**
 * Claude Service for PropertyIQ Reports
 *
 * Handles AI functionality for report generation (v1 pipeline):
 * - Narrative generation for report sections
 * - Conversation responses with report context
 * - Investment analysis and comparison narratives
 *
 * Delegates all AI calls to AiProviderService (model-agnostic).
 * News enhancement logic lives in claude-news-enhancement.ts.
 * Prompt construction lives in claude-prompt-builders.ts.
 */

import { Injectable, Logger } from '@nestjs/common';
import { AiProviderService } from '../ai-provider/ai-provider.service';
import { enhancePromptWithNews } from './claude-news-enhancement';
import {
  buildConversationSystemPrompt,
  buildConversationMessages,
  buildInvestmentPrompt,
  buildWhyWinnerWonPrompt,
  buildFinalRecommendationPrompt,
} from './claude-prompt-builders';

interface NarrativeSection {
  id: string;
  name?: string;
  prompt_template: string;
  max_tokens: number;
  output_format?: 'text' | 'json_array' | 'json_object';
}

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

@Injectable()
export class ClaudeService {
  private readonly logger = new Logger(ClaudeService.name);

  constructor(private readonly aiProvider: AiProviderService) {}

  /**
   * Generate AI narratives for report sections.
   * Attaches __model_used metadata for the orchestrator to persist.
   */
  async generateNarratives(
    sections: NarrativeSection[],
    context: Record<string, any>,
  ): Promise<Record<string, string | string[] | Record<string, any>>> {
    const results: Record<string, string | string[] | Record<string, any>> = {};
    let lastModelUsed = 'unknown';

    const sectionPromises = sections.map(async (section) => {
      try {
        const basePrompt = interpolateTemplate(
          section.prompt_template,
          context,
        );
        const enhancedPrompt = enhancePromptWithNews(
          basePrompt,
          context,
          section.id,
        );

        const response = await this.aiProvider.complete('report_narrative', {
          userPrompt: enhancedPrompt,
          maxTokens: section.max_tokens,
        });
        lastModelUsed = response.model;

        if (
          section.output_format === 'json_array' ||
          section.output_format === 'json_object'
        ) {
          return {
            id: section.id,
            value: parseJsonResponse(response.content, section.id, this.logger),
          };
        }
        return { id: section.id, value: response.content };
      } catch (error) {
        this.logger.error(
          `Failed to generate narrative for ${section.id}:`,
          error,
        );
        return { id: section.id, value: getFallbackNarrative(section.id) };
      }
    });

    const settled = await Promise.allSettled(sectionPromises);
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results[result.value.id] = result.value.value;
      }
    }

    (results as any).__model_used = lastModelUsed;
    return results;
  }

  /** Generate conversation response with report context */
  async generateConversationResponse(
    userMessage: string,
    history: ConversationMessage[],
    report: any,
    newsContext?: string,
  ): Promise<string> {
    const systemPrompt = buildConversationSystemPrompt(report, newsContext);
    const messages = buildConversationMessages(history, userMessage);

    try {
      const response = await this.aiProvider.completeWithMessages(
        'conversation',
        [{ role: 'system', content: systemPrompt }, ...messages],
        4096,
      );
      return (
        response.content ||
        'I apologize, but I was unable to generate a response.'
      );
    } catch (error) {
      this.logger.error('Conversation generation failed:', error);
      return 'I apologize, but I encountered an error analyzing your question. Please try again.';
    }
  }

  /** Generate investment analysis */
  async generateInvestmentAnalysis(
    geographyName: string,
    metrics: Record<string, any>,
    userInputs: Record<string, any>,
    newsContext?: string,
  ): Promise<string> {
    const prompt = buildInvestmentPrompt(
      geographyName,
      metrics,
      userInputs,
      newsContext,
    );
    try {
      const response = await this.aiProvider.complete('report_narrative', {
        userPrompt: prompt,
        maxTokens: 2000,
      });
      return response.content;
    } catch (error) {
      this.logger.error('Investment analysis failed:', error);
      return 'Investment analysis is being processed. Please refresh shortly.';
    }
  }

  /** Generate a single completion from a prompt (public wrapper) */
  async complete(prompt: string, maxTokens: number): Promise<string> {
    const response = await this.aiProvider.complete('report_narrative', {
      userPrompt: prompt,
      maxTokens,
    });
    return response.content;
  }

  /** AiProviderService is always available (throws on missing keys at startup) */
  isAvailable(): boolean {
    return true;
  }

  /** Generate the "why winner won" narrative for comparison reports */
  async generateWhyWinnerWon(context: {
    winner_name: string;
    priorities: string[];
    priority_weighted_winner: any;
    comparison_markets: any[];
    user_type: 'homebuyer' | 'investor';
  }): Promise<string[]> {
    if (!context.priority_weighted_winner) return [];

    const prompt = buildWhyWinnerWonPrompt(context);
    try {
      const response = await this.aiProvider.complete('report_narrative', {
        userPrompt: prompt,
        maxTokens: 800,
      });
      const parsed = JSON.parse(response.content);
      if (Array.isArray(parsed) && parsed.length >= 3) {
        return parsed.slice(0, 3);
      }
      return context.priority_weighted_winner.reasons.slice(0, 3);
    } catch (error) {
      this.logger.warn(
        'Failed to generate why_winner_won, using fallback:',
        error,
      );
      return context.priority_weighted_winner.reasons.slice(0, 3);
    }
  }

  /** Generate the final recommendation narrative for comparison reports */
  async generateFinalRecommendation(context: {
    winner_name: string;
    priorities: string[];
    user_type: 'homebuyer' | 'investor';
    user_inputs?: Record<string, any>;
    priority_weighted_winner: any;
    comparison_markets: any[];
    news_context?: string;
  }): Promise<string> {
    const prompt = buildFinalRecommendationPrompt(context);
    try {
      const response = await this.aiProvider.complete('report_narrative', {
        userPrompt: prompt,
        maxTokens: 2000,
      });
      return response.content;
    } catch (error) {
      this.logger.error('Failed to generate final recommendation:', error);
      return `Based on your priorities of ${context.priorities.join(', ')}, ${context.winner_name} emerges as your recommended market. This market scores highest on the factors that matter most to you. As your next step, we recommend exploring specific neighborhoods within ${context.winner_name} and connecting with local real estate professionals who can provide on-the-ground insights.`;
    }
  }
}

// ============================================================================
// Module-level helpers (pure functions, no class dependency)
// ============================================================================

function interpolateTemplate(
  template: string,
  context: Record<string, any>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = context[key];
    if (value === undefined || value === null) return match;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });
}

function parseJsonResponse(
  raw: string,
  sectionId: string,
  logger: Logger,
): any {
  const cleaned = raw
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    if (cleaned.startsWith('[')) {
      try {
        const lastObj = cleaned.lastIndexOf('}');
        if (lastObj > 0) {
          const truncated = cleaned.substring(0, lastObj + 1) + ']';
          const parsed = JSON.parse(truncated);
          if (Array.isArray(parsed) && parsed.length > 0) {
            logger.warn(
              `Recovered ${parsed.length} items from truncated JSON for ${sectionId}`,
            );
            return parsed;
          }
        }
      } catch {
        // Recovery also failed
      }
    }
    logger.warn(`Failed to parse JSON for ${sectionId}, storing as raw string`);
    return raw;
  }
}

function getFallbackNarrative(sectionId: string): string {
  const fallbacks: Record<string, string> = {
    market_summary:
      'Market analysis is being processed. Please check back shortly.',
    trend_observations: 'Trend analysis is being compiled from market data.',
    investment_assessment: 'Investment potential is being calculated.',
    affordability_analysis: 'Affordability metrics are being processed.',
  };
  return (
    fallbacks[sectionId] ||
    'Analysis pending. Please refresh to see updated insights.'
  );
}
