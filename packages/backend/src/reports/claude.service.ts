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

    // Build news context enhancement for all narratives
    const newsEnhancement = this.buildNewsEnhancement(context);

    for (const section of sections) {
      try {
        const basePrompt = this.interpolateTemplate(
          section.prompt_template,
          context,
        );

        // Enhance prompt with news context when available
        const enhancedPrompt = this.enhancePromptWithNews(
          basePrompt,
          newsEnhancement,
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
   * Build news enhancement context from available news data
   */
  private buildNewsEnhancement(context: Record<string, any>): string | null {
    const newsContext = context.news_context;
    const signalSummary = context.market_signal_summary;

    if (!newsContext || newsContext === 'No recent news available for this market.') {
      return null;
    }

    const parts: string[] = [];

    parts.push('\n\n---\nRECENT LOCAL NEWS & MARKET INTELLIGENCE\n');
    parts.push(newsContext);

    if (signalSummary) {
      parts.push(`\n${signalSummary}`);
    }

    parts.push('\n---\n');

    return parts.join('');
  }

  /**
   * Enhance a prompt with news context and instructions
   */
  private enhancePromptWithNews(
    basePrompt: string,
    newsEnhancement: string | null,
    sectionId: string,
  ): string {
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
      market_summary: `
IMPORTANT: Incorporate relevant recent news into your analysis. For example:
- If there's employer expansion news, mention how it could drive housing demand
- If there's new development announced, note its potential impact on supply
- If there are infrastructure projects, discuss accessibility improvements
- If there are policy changes, explain implications for buyers/investors
Be specific but concise - reference the actual news when relevant to the market narrative.`,

      trend_observations: `
IMPORTANT: When identifying trends, consider recent local news that may explain or amplify observed patterns:
- Employment news affecting demand trends
- Development projects impacting supply
- Economic indicators supporting or contradicting price movements
Reference specific news items when they help explain a trend.`,

      investment_thesis: `
IMPORTANT: Factor recent news into your investment assessment:
- Major employer moves (expansion/layoffs) affect rental demand and appreciation
- New development projects impact future supply and competition
- Infrastructure investments can shift neighborhood desirability
- Policy changes may affect investment returns (taxes, regulations)
Cite specific news that strengthens or weakens the investment case.`,

      risk_factors: `
IMPORTANT: Consider recent news when assessing risks:
- Employer layoffs or departures increase vacancy risk
- New supply from development projects could pressure rents
- Climate events may signal insurance or disaster risk
- Policy changes could affect returns or regulations
Include news-based risks alongside data-driven risks.`,

      economic_outlook: `
IMPORTANT: Incorporate recent economic news into your outlook:
- Job growth announcements from specific employers
- Industry changes affecting the local economy
- Infrastructure investments improving economic potential
- Migration trends supported by employment opportunities
Ground your outlook in both data and recent developments.`,

      migration_analysis: `
IMPORTANT: Consider news that may explain migration patterns:
- Major employer relocations or expansions attracting workers
- Cost of living changes driving migration
- Quality of life improvements (infrastructure, amenities)
- Remote work trends affecting location choices
Reference specific news that supports migration trends.`,

      cycle_explanation: `
IMPORTANT: Use recent news to contextualize cycle position:
- Development pipeline affecting future supply
- Economic indicators supporting the current phase
- Policy changes that may accelerate or slow cycle progression
Connect news events to where we are in the market cycle.`,

      market_story: `
IMPORTANT: Weave recent news into the market narrative:
- Who is moving here and why (employment, lifestyle)?
- What developments are shaping the community?
- How are local policies affecting housing?
- What economic forces are driving change?
Use specific news items to bring the story to life.`,

      affordability_outlook: `
IMPORTANT: Factor recent developments into affordability projections:
- Income growth from employer expansions
- Housing supply from new developments
- Policy changes affecting affordability programs
- Economic trends impacting household budgets
Ground your outlook in recent local developments.`,

      // Comparison report sections
      why_winner_won: `
IMPORTANT: Generate exactly 3 compelling reasons why the winner market is the best choice based on the user's stated priorities.
- Each reason should directly tie to one of the user's priorities
- Include specific metric comparisons (e.g., "Cap rate of 6.2% vs 4.8%")
- Reference news/developments that support the advantage if relevant
- Keep each reason to 1-2 sentences
Output as a JSON array of 3 strings.`,

      final_recommendation: `
IMPORTANT: Provide a personalized final recommendation based on:
- The user's stated priorities (weigh these heavily)
- The data-driven winner analysis
- The user's profile (homebuyer vs investor)
- Any relevant news that affects the decision
Be decisive - clearly state which market is recommended and why.
Include 2-3 specific next steps the user should take.`,

      comparison_overview: `
IMPORTANT: Provide a balanced overview comparing the markets:
- Acknowledge strengths of each market
- Explain the key differentiators
- Reference the user's priorities in your analysis
- Use specific data points to support comparisons
Keep the tone objective but helpful.`,
    };

    // Default instruction for sections not specifically mapped
    const defaultInstruction = `
IMPORTANT: If any of the recent local news above is relevant to your analysis, incorporate it naturally. Reference specific developments, employers, or events that support your points. This makes the analysis more timely and locally relevant.`;

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
