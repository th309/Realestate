/**
 * Claude Service for PropertyIQ Reports
 *
 * Handles all Claude (Anthropic) AI functionality:
 * - Deep analysis and reasoning
 * - Narrative generation for reports
 * - Conversation responses with report context
 *
 * Note: Real-time news/indicators are handled by GeminiNewsService
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

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
  private claudeClient: Anthropic | null = null;
  private readonly claudeModel = 'claude-sonnet-4-20250514';

  constructor(private readonly configService: ConfigService) {
    const anthropicKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (anthropicKey) {
      this.claudeClient = new Anthropic({ apiKey: anthropicKey });
      this.logger.log('Claude initialized for analysis and narratives');
    } else {
      this.logger.warn(
        'ANTHROPIC_API_KEY not configured - AI features limited',
      );
    }
  }

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  /**
   * Generate AI narratives for report sections
   */
  async generateNarratives(
    sections: NarrativeSection[],
    context: Record<string, any>,
  ): Promise<Record<string, string | string[] | Record<string, any>>> {
    const results: Record<string, string | string[] | Record<string, any>> = {};

    for (const section of sections) {
      try {
        const prompt = this.interpolateTemplate(
          section.prompt_template,
          context,
        );
        const response = await this.generateCompletion(
          prompt,
          section.max_tokens,
        );

        if (
          section.output_format === 'json_array' ||
          section.output_format === 'json_object'
        ) {
          try {
            results[section.id] = JSON.parse(response);
          } catch {
            results[section.id] = response;
          }
        } else {
          results[section.id] = response;
        }
      } catch (error) {
        this.logger.error(
          `Failed to generate narrative for ${section.id}:`,
          error,
        );
        results[section.id] = this.getFallbackNarrative(section.id);
      }
    }

    return results;
  }

  /**
   * Generate conversation response with report context
   */
  async generateConversationResponse(
    userMessage: string,
    history: ConversationMessage[],
    report: any,
  ): Promise<string> {
    const systemPrompt = this.buildConversationSystemPrompt(report);
    const messages = this.buildConversationMessages(history, userMessage);

    try {
      return await this.generateConversation(systemPrompt, messages);
    } catch (error) {
      this.logger.error('Conversation generation failed:', error);
      return 'I apologize, but I encountered an error analyzing your question. Please try again.';
    }
  }

  /**
   * Generate investment analysis
   */
  async generateInvestmentAnalysis(
    geographyName: string,
    metrics: Record<string, any>,
    userInputs: Record<string, any>,
  ): Promise<string> {
    const prompt = `Analyze this real estate investment opportunity in ${geographyName}.

Market Metrics:
${JSON.stringify(metrics, null, 2)}

User Investment Parameters:
${JSON.stringify(userInputs, null, 2)}

Provide a concise investment analysis covering:
1. Cash flow potential
2. Appreciation outlook
3. Risk factors
4. Entry point assessment
5. Recommendation

Keep the analysis under 400 words and be specific with numbers.`;

    try {
      return await this.generateCompletion(prompt, 600);
    } catch (error) {
      this.logger.error('Investment analysis failed:', error);
      return 'Investment analysis is being processed. Please refresh shortly.';
    }
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    return !!this.claudeClient;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async generateCompletion(
    prompt: string,
    maxTokens: number,
  ): Promise<string> {
    if (!this.claudeClient) {
      throw new Error('Claude client not initialized');
    }

    const response = await this.claudeClient.messages.create({
      model: this.claudeModel,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    return textBlock?.text || '';
  }

  private async generateConversation(
    systemPrompt: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Promise<string> {
    if (!this.claudeClient) {
      throw new Error('Claude client not initialized');
    }

    const response = await this.claudeClient.messages.create({
      model: this.claudeModel,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    return (
      textBlock?.text || 'I apologize, but I was unable to generate a response.'
    );
  }

  private interpolateTemplate(
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

  private buildConversationSystemPrompt(report: any): string {
    const userType = report.user_type || 'homebuyer';
    const heroScore = userType === 'investor' ? 'InvestorEdge' : 'HomeReady';
    const geographyName =
      report.primary_geography_name || 'the selected market';

    return `You are an expert real estate market analyst for PropertyIQ, helping ${
      userType === 'investor'
        ? 'real estate investors'
        : 'homebuyers and renters'
    } make informed decisions.

You are discussing a ${report.template?.name || 'Market'} report for ${geographyName}.

Key Market Data:
- ${heroScore} Score: ${userType === 'investor' ? report.investoredge_score : report.homeready_score}/100
- Geography Type: ${report.primary_geography_type}
${report.scores_snapshot ? `- Market Scores: ${JSON.stringify(report.scores_snapshot)}` : ''}

Guidelines:
1. Be helpful, concise, and data-driven
2. Focus on ${userType === 'investor' ? 'investment decisions (cash flow, appreciation, risk)' : 'homebuying decisions (affordability, timing, neighborhoods)'}
3. Reference specific data points from the report
4. Acknowledge limitations when asked about unavailable data
5. Provide actionable recommendations
6. Keep responses under 300 words unless more detail is requested`;
  }

  private buildConversationMessages(
    history: ConversationMessage[],
    currentMessage: string,
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    const recentHistory = history.slice(-20);

    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }
    messages.push({ role: 'user', content: currentMessage });

    return messages;
  }

  private getFallbackNarrative(sectionId: string): string {
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
}
