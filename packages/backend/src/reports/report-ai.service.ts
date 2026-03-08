/**
 * Claude Service for PropertyIQ Reports
 *
 * Handles AI functionality beyond narrative generation:
 * - Conversation responses with report context
 * - Investment analysis and comparison narratives
 *
 * Delegates all AI calls to AiProviderService (model-agnostic).
 * Prompt construction lives in claude-prompt-builders.ts.
 *
 * Note: Narrative generation is handled by ReportGenerationV2Service.
 */

import { Injectable, Logger } from '@nestjs/common';
import { AiProviderService } from '../ai-provider/ai-provider.service';
import {
  buildConversationSystemPrompt,
  buildConversationMessages,
  buildInvestmentPrompt,
  buildWhyWinnerWonPrompt,
  buildFinalRecommendationPrompt,
} from './claude-prompt-builders';

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
