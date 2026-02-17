/**
 * Claude Service for PropertyIQ Reports
 *
 * Handles all Claude (Anthropic) AI functionality:
 * - Deep analysis and reasoning
 * - Narrative generation for reports
 * - Conversation responses with report context
 *
 * Note: Real-time news/indicators are handled by ClaudeNewsService
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

interface NewsContext {
  news_context?: string;
  market_signal_summary?: string;
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

    // Generate all narratives in parallel for performance
    const sectionPromises = sections.map(async (section) => {
      try {
        const basePrompt = this.interpolateTemplate(
          section.prompt_template,
          context,
        );

        // Each section gets news filtered to its relevant categories
        const enhancedPrompt = this.enhancePromptWithNews(
          basePrompt,
          context,
          section.id,
        );

        const response = await this.generateCompletion(
          enhancedPrompt,
          section.max_tokens,
        );

        if (
          section.output_format === 'json_array' ||
          section.output_format === 'json_object'
        ) {
          try {
            return { id: section.id, value: JSON.parse(response) };
          } catch {
            return { id: section.id, value: response };
          }
        }
        return { id: section.id, value: response };
      } catch (error) {
        this.logger.error(
          `Failed to generate narrative for ${section.id}:`,
          error,
        );
        return { id: section.id, value: this.getFallbackNarrative(section.id) };
      }
    });

    const settled = await Promise.allSettled(sectionPromises);
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results[result.value.id] = result.value.value;
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
    newsContext?: string,
  ): Promise<string> {
    const systemPrompt = this.buildConversationSystemPrompt(report, newsContext);
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
    newsContext?: string,
  ): Promise<string> {
    let prompt = `Analyze this real estate investment opportunity in ${geographyName}.

Market Metrics:
${JSON.stringify(metrics, null, 2)}

User Investment Parameters:
${JSON.stringify(userInputs, null, 2)}`;

    // Add news context if available
    if (newsContext && newsContext !== 'No recent news available for this market.') {
      prompt += `

Recent Local News & Market Intelligence:
${newsContext}`;
    }

    prompt += `

Provide a concise investment analysis covering:
1. Cash flow potential
2. Appreciation outlook
3. Risk factors${newsContext ? ' (include any news-related risks)' : ''}
4. Entry point assessment
5. Recommendation

${newsContext ? `When relevant, incorporate recent news into your analysis. For example:
- How might employer expansions/layoffs affect rental demand?
- What impact could new development projects have on supply?
- Are there policy changes that could affect investment returns?
Reference specific news items that strengthen or weaken the investment case.

` : ''}Keep the analysis under 400 words and be specific with numbers.`;

    try {
      return await this.generateCompletion(prompt, 600);
    } catch (error) {
      this.logger.error('Investment analysis failed:', error);
      return 'Investment analysis is being processed. Please refresh shortly.';
    }
  }

  /**
   * Generate a single completion from a prompt (public wrapper)
   */
  async complete(prompt: string, maxTokens: number): Promise<string> {
    return this.generateCompletion(prompt, maxTokens);
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

  private buildConversationSystemPrompt(report: any, newsContext?: string): string {
    const userType = report.user_type || 'homebuyer';
    const heroScore = userType === 'investor' ? 'InvestorEdge' : 'HomeReady';
    const geographyName =
      report.primary_geography_name || 'the selected market';

    let prompt = `You are an expert real estate market analyst for PropertyIQ, helping ${
      userType === 'investor'
        ? 'real estate investors'
        : 'homebuyers and renters'
    } make informed decisions.

You are discussing a ${report.template?.name || 'Market'} report for ${geographyName}.

Key Market Data:
- ${heroScore} Score: ${userType === 'investor' ? report.investoredge_score : report.homeready_score}/100
- Geography Type: ${report.primary_geography_type}
${report.scores_snapshot ? `- Market Scores: ${JSON.stringify(report.scores_snapshot)}` : ''}`;

    // Add news context if available
    if (newsContext && newsContext !== 'No recent news available for this market.') {
      prompt += `

Recent Local News & Market Intelligence:
${newsContext}`;
    }

    prompt += `

Guidelines:
1. Be helpful, concise, and data-driven
2. Focus on ${userType === 'investor' ? 'investment decisions (cash flow, appreciation, risk)' : 'homebuying decisions (affordability, timing, neighborhoods)'}
3. Reference specific data points from the report
4. When relevant, incorporate recent local news to provide timely, contextual insights
5. Acknowledge limitations when asked about unavailable data
6. Provide actionable recommendations
7. Keep responses under 300 words unless more detail is requested

When using news context:
- Reference specific developments, employers, or events when they support your analysis
- Explain how recent news might impact the user's decision (e.g., "The recent announcement of [employer] expanding could drive rental demand...")
- Be balanced - consider both positive and negative news implications
- Don't force news into every response - only use it when genuinely relevant to the question`;

    return prompt;
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

  /**
   * News categories relevant to each report section.
   * Used to filter news items so each section gets contextually relevant news.
   */
  private static readonly SECTION_NEWS_CATEGORIES: Record<string, string[]> = {
    hero_verdict: [], // Gets signal summary only, no full news
    score_story: ['market_report', 'market_investment', 'employer_expansion', 'employer_layoffs'],
    affordability_narrative: [
      'employer_hiring', 'employer_expansion', 'employer_layoffs',
      'policy_housing', 'policy_taxes', 'development_residential',
      'demographic_migration', 'demographic_growth',
    ],
    market_timing_narrative: [
      'market_report', 'market_investment', 'development_residential',
      'development_commercial', 'policy_zoning', 'policy_housing',
    ],
    stability_narrative: [
      'climate_disaster', 'climate_risk', 'climate_insurance',
      'policy_taxes', 'policy_zoning', 'market_report',
    ],
    growth_potential_narrative: [
      'employer_expansion', 'employer_hiring', 'employer_new_facility',
      'employer_relocation', 'infrastructure_transit', 'infrastructure_roads',
      'infrastructure_airport', 'development_commercial', 'development_industrial',
      'demographic_migration', 'demographic_growth', 'education_university',
    ],
    bottom_line_narrative: [], // Gets all high-relevance news
    bottom_line_actions: [], // Gets signal summary only
  };

  /**
   * Build section-specific news enhancement from raw news data.
   * Filters news items by category relevance to the section.
   */
  private buildNewsEnhancementForSection(
    context: Record<string, any>,
    sectionId: string,
  ): string | null {
    const newsItems: any[] = context.raw_news_items || [];
    const indicators: any[] = context.raw_economic_indicators || [];
    const signals: any[] = context.raw_market_signals || [];
    const signalSummary: string | null = context.market_signal_summary || null;
    const nationalContext: any = context.raw_national_context || null;

    if (newsItems.length === 0 && indicators.length === 0 && signals.length === 0) {
      return null;
    }

    const parts: string[] = [];
    parts.push('\n\n---\nMARKET INTELLIGENCE\n');

    // Filter news by section-relevant categories
    const relevantCategories = ClaudeService.SECTION_NEWS_CATEGORIES[sectionId];
    let filteredNews: any[];

    if (!relevantCategories || relevantCategories.length === 0) {
      // For hero_verdict/bottom_line_actions: just high-relevance items
      // For bottom_line_narrative: all high-relevance news
      if (sectionId === 'bottom_line_narrative') {
        filteredNews = newsItems.filter((n: any) => n.relevance === 'high').slice(0, 5);
      } else {
        filteredNews = []; // hero_verdict, bottom_line_actions just get signal summary
      }
    } else {
      filteredNews = newsItems
        .filter((n: any) => relevantCategories.includes(n.category))
        .slice(0, 4);
      // If no category matches, fall back to high-relevance items
      if (filteredNews.length === 0) {
        filteredNews = newsItems.filter((n: any) => n.relevance === 'high').slice(0, 3);
      }
    }

    if (filteredNews.length > 0) {
      parts.push('## RELEVANT NEWS\n');
      for (const item of filteredNews) {
        parts.push(`**${item.headline}** (${item.source})`);
        parts.push(`${item.summary}`);
        parts.push(`Impact: ${item.impact_on_real_estate} | Sentiment: ${item.sentiment}\n`);
      }
    }

    // Economic indicators - only for affordability, growth, bottom_line sections
    const economicSections = ['affordability_narrative', 'growth_potential_narrative', 'bottom_line_narrative', 'score_story'];
    if (economicSections.includes(sectionId) && indicators.length > 0) {
      parts.push('\n## ECONOMIC INDICATORS\n');
      for (const ind of indicators.slice(0, 4)) {
        parts.push(`**${ind.indicator_name}** (${ind.geography_level}): ${ind.current_value}`);
        parts.push(`${ind.change_description} — Housing impact: ${ind.impact_on_housing}\n`);
      }
    }

    // Market signals - include for all sections
    if (signals.length > 0 && signalSummary) {
      parts.push(`\n## MARKET SIGNALS: ${signalSummary}\n`);
      for (const signal of signals.slice(0, 3)) {
        const arrow = signal.signal_type === 'bullish' ? '↑' : signal.signal_type === 'bearish' ? '↓' : '→';
        parts.push(`${arrow} **${signal.headline}**: ${signal.description}`);
      }
    }

    // National context - only for stability, bottom_line, market_timing
    const nationalSections = ['stability_narrative', 'bottom_line_narrative', 'market_timing_narrative'];
    if (nationalSections.includes(sectionId) && nationalContext) {
      parts.push('\n## NATIONAL CONTEXT\n');
      if (nationalContext.fed_rate_news) parts.push(`Fed: ${nationalContext.fed_rate_news}`);
      if (nationalContext.mortgage_rate_trend) parts.push(`Mortgages: ${nationalContext.mortgage_rate_trend}`);
      if (nationalContext.economic_outlook) parts.push(`Outlook: ${nationalContext.economic_outlook}`);
    }

    parts.push('\n---\n');

    // Only return if we actually have content beyond the header/footer
    if (parts.length <= 2) return null;
    return parts.join('');
  }

  /**
   * Enhance a prompt with section-specific news context and instructions
   */
  private enhancePromptWithNews(
    basePrompt: string,
    context: Record<string, any>,
    sectionId: string,
  ): string {
    const newsEnhancement = this.buildNewsEnhancementForSection(context, sectionId);
    if (!newsEnhancement) {
      return basePrompt;
    }

    // Section-specific instructions for incorporating news
    const newsInstructions = this.getNewsInstructionsForSection(sectionId);

    return `${basePrompt}
${newsEnhancement}
${newsInstructions}`;
  }

  /**
   * Get section-specific instructions for incorporating news context
   */
  private getNewsInstructionsForSection(sectionId: string): string {
    const instructions: Record<string, string> = {
      // HomeReady report sections
      hero_verdict: `If market signals are provided, let them influence the tone of your verdict.`,

      score_story: `
IMPORTANT: Connect the news and economic data above to the score components. Explain what real-world events are DRIVING the numbers — employer moves affecting demand, development impacting supply, policy changes shifting affordability. Make the score feel alive with current events.`,

      affordability_narrative: `
IMPORTANT: Use the news above to explain WHY affordability is where it is. Connect employer hiring/layoffs to income trends, housing policy changes to price dynamics, new development to supply-side relief. The reader should understand what forces are actively shaping affordability in this market.`,

      market_timing_narrative: `
IMPORTANT: Reference the news above to explain the current market timing signals. New development projects affect future inventory. Policy changes shift demand. Connect each timing indicator to a real-world cause when possible. Help the reader understand not just WHAT the market is doing, but WHY.`,

      stability_narrative: `
IMPORTANT: Use national context (Fed policy, mortgage rates) and local news (climate events, policy changes) to explain stability risks and strengths. Connect market volatility to real events. If there are climate risks or insurance issues, these directly affect market stability.`,

      growth_potential_narrative: `
IMPORTANT: This section MUST connect growth metrics to their drivers. Use employer expansion, infrastructure projects, and migration news to explain population growth. Use development projects and economic indicators to project where the market is heading. Every growth stat should have a "because" rooted in real events.`,

      bottom_line_narrative: `
IMPORTANT: Synthesize the most impactful news into your overall verdict. The reader wants to know: given current events and trends, is now a good time? Reference the strongest signals — positive AND negative — that should influence their decision.`,

      bottom_line_actions: `
IMPORTANT: Make action items NEWS-AWARE. If mortgage rates are trending a certain way, factor that in. If there's new development coming, mention timing around it. Actions should feel current and specific to this moment in the market.`,

      // Investor sections
      investment_thesis: `
IMPORTANT: Factor news into the investment case — employer moves affect rental demand, development impacts supply competition, infrastructure shifts desirability. Cite specific developments.`,

      risk_factors: `
IMPORTANT: Include news-based risks alongside data-driven risks — layoffs, new supply, climate events, policy changes. Be specific.`,

      // Comparison report sections
      why_winner_won: `
IMPORTANT: Generate exactly 3 compelling reasons. Reference news/developments that support the advantage if relevant. Output as a JSON array of 3 strings.`,

      final_recommendation: `
IMPORTANT: Be decisive. Factor in any relevant news that affects the decision. Include 2-3 specific next steps.`,

      comparison_overview: `
IMPORTANT: Reference the user's priorities. Use specific data points. Keep tone objective but helpful.`,
    };

    const defaultInstruction = `
IMPORTANT: If any of the market intelligence above is relevant, incorporate it naturally. Reference specific developments, employers, or events that support your points. Explain what is DRIVING the metrics, not just what the metrics show.`;

    return instructions[sectionId] || defaultInstruction;
  }

  // ============================================================================
  // Comparison Report Narrative Generation
  // ============================================================================

  /**
   * Generate the "why winner won" narrative for comparison reports
   */
  async generateWhyWinnerWon(
    context: {
      winner_name: string;
      priorities: string[];
      priority_weighted_winner: any;
      comparison_markets: any[];
      user_type: 'homebuyer' | 'investor';
    },
  ): Promise<string[]> {
    if (!this.claudeClient || !context.priority_weighted_winner) {
      return [];
    }

    const priorityLabels: Record<string, string> = {
      affordability: 'Affordability',
      appreciation: 'Appreciation Potential',
      job_market: 'Job Market Strength',
      market_timing: 'Market Timing',
      lifestyle: 'Lifestyle Factors',
      cash_flow: 'Cash Flow',
      tenant_demand: 'Tenant Demand',
      entry_price: 'Entry Price',
      stability: 'Market Stability',
    };

    const prompt = `You are analyzing a market comparison report. The user is a ${context.user_type} who prioritized: ${context.priorities.map(p => priorityLabels[p] || p).join(', ')}.

The winner is ${context.winner_name}.

Priority analysis results:
${JSON.stringify(context.priority_weighted_winner.priorityScores, null, 2)}

Generate exactly 3 compelling, specific reasons why ${context.winner_name} is the best choice for this user. Each reason should:
1. Directly tie to one of the user's priorities
2. Include specific metric comparisons when available
3. Be 1-2 sentences maximum

Return ONLY a JSON array of 3 strings, no other text. Example format:
["Reason 1", "Reason 2", "Reason 3"]`;

    try {
      const response = await this.generateCompletion(prompt, 400);
      const parsed = JSON.parse(response);
      if (Array.isArray(parsed) && parsed.length >= 3) {
        return parsed.slice(0, 3);
      }
      return context.priority_weighted_winner.reasons.slice(0, 3);
    } catch (error) {
      this.logger.warn('Failed to generate why_winner_won, using fallback:', error);
      return context.priority_weighted_winner.reasons.slice(0, 3);
    }
  }

  /**
   * Generate the final recommendation narrative for comparison reports
   */
  async generateFinalRecommendation(
    context: {
      winner_name: string;
      priorities: string[];
      user_type: 'homebuyer' | 'investor';
      user_inputs?: Record<string, any>;
      priority_weighted_winner: any;
      comparison_markets: any[];
      news_context?: string;
    },
  ): Promise<string> {
    if (!this.claudeClient) {
      return `Based on your priorities, ${context.winner_name} is your recommended market.`;
    }

    const userContext = context.user_type === 'homebuyer'
      ? 'homebuyer looking for a place to live'
      : 'real estate investor seeking returns';

    const priorityLabels: Record<string, string> = {
      affordability: 'Affordability',
      appreciation: 'Appreciation Potential',
      job_market: 'Job Market Strength',
      market_timing: 'Market Timing',
      lifestyle: 'Lifestyle Factors',
      cash_flow: 'Cash Flow',
      tenant_demand: 'Tenant Demand',
      entry_price: 'Entry Price',
      stability: 'Market Stability',
    };

    let prompt = `You are a real estate expert providing a final recommendation to a ${userContext}.

Their top priorities are: ${context.priorities.map(p => priorityLabels[p] || p).join(', ')}

Based on comprehensive analysis, ${context.winner_name} is the recommended market because:
${context.priority_weighted_winner.reasons.join('\n')}

${context.user_inputs?.budget ? `Budget: ${context.user_inputs.budget}` : ''}
${context.user_inputs?.timeline ? `Timeline: ${context.user_inputs.timeline}` : ''}`;

    if (context.news_context && context.news_context !== 'No recent news available for this market.') {
      prompt += `

Recent market developments to consider:
${context.news_context.slice(0, 500)}`;
    }

    prompt += `

Write a personalized final recommendation in 2-3 paragraphs that:
1. Clearly states the recommended market and why it aligns with their priorities
2. Acknowledges any trade-offs or considerations
3. Provides 2-3 specific next steps they should take

Be warm but professional. Use "you" to address the user directly.`;

    try {
      return await this.generateCompletion(prompt, 500);
    } catch (error) {
      this.logger.error('Failed to generate final recommendation:', error);
      return `Based on your priorities of ${context.priorities.join(', ')}, ${context.winner_name} emerges as your recommended market. This market scores highest on the factors that matter most to you. As your next step, we recommend exploring specific neighborhoods within ${context.winner_name} and connecting with local real estate professionals who can provide on-the-ground insights.`;
    }
  }
}
