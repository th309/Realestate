/**
 * Research Brief Service
 *
 * Orchestrates the Custom Research report generation pipeline:
 * 1. generateClarifyingQuestions() — Claude generates scoping questions
 * 2. executeResearch() — Claude tool-use loop gathers data
 * 3. generateNarrative() — DeepSeek writes the final research brief
 *
 * Narrative generation delegated to research-narrative-generator.ts.
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { ScoringService } from '../../scoring/scoring.service';
import { MetricResolutionService } from '../../metric-resolution/metric-resolution.service';
import { TimeSeriesService } from '../../timeseries/timeseries.service';
import { ClaudeNewsService } from '../claude-news.service';
import { RESEARCH_TOOLS } from './research-tools';
import {
  RESEARCH_AGENT_SYSTEM_PROMPT,
  CLARIFYING_QUESTIONS_PROMPT,
} from './research-prompts';
import { executeToolCall } from './research-tool-executor';
import {
  generateNarrative,
  extractResearchData,
  extractJson,
} from './research-narrative-generator';

/** Maximum tool-use loop iterations to prevent runaway agents */
const MAX_TOOL_ITERATIONS = 15;

/** Claude model for research agent (tool-use) */
const RESEARCH_MODEL = 'claude-sonnet-4-20250514';

export interface ClarifyingQuestion {
  id: string;
  question: string;
  options: Array<{ value: string; label: string }>;
}

export interface ResearchResult {
  researchData: Record<string, unknown>;
  toolCallCount: number;
  durationMs: number;
}

export interface ResearchBriefResult {
  narrative: string;
  researchData: Record<string, unknown>;
  totalDurationMs: number;
}

@Injectable()
export class ResearchBriefService {
  private readonly logger = new Logger(ResearchBriefService.name);
  private readonly anthropic: Anthropic | null = null;
  private readonly deepseek: OpenAI | null = null;
  private readonly deepseekModel: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly scoringService: ScoringService,
    private readonly metricResolution: MetricResolutionService,
    private readonly timeSeriesService: TimeSeriesService,
    @Optional() private readonly newsService: ClaudeNewsService | null,
  ) {
    const anthropicKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (anthropicKey) {
      this.anthropic = new Anthropic({ apiKey: anthropicKey });
      this.logger.log('Anthropic client initialized for research agent');
    } else {
      this.logger.warn(
        'ANTHROPIC_API_KEY not configured — research agent disabled',
      );
    }

    const deepseekKey = this.configService.get<string>('DEEPSEEK_API_KEY');
    this.deepseekModel =
      this.configService.get<string>('AI_MODEL') || 'deepseek-chat';
    if (deepseekKey) {
      this.deepseek = new OpenAI({
        apiKey: deepseekKey,
        baseURL:
          this.configService.get<string>('AI_BASE_URL') ||
          'https://api.deepseek.com/v1',
        timeout: 120_000,
      });
      this.logger.log('DeepSeek client initialized for narrative generation');
    } else {
      this.logger.warn(
        'DEEPSEEK_API_KEY not configured — narrative generation disabled',
      );
    }
  }

  /**
   * Generate 2-3 clarifying questions to scope the research.
   */
  async generateClarifyingQuestions(
    userQuestion: string,
    userContext?: string,
  ): Promise<ClarifyingQuestion[]> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not configured');
    }

    const prompt = userContext
      ? `User question: "${userQuestion}"\nUser context: ${userContext}`
      : `User question: "${userQuestion}"`;

    const response = await this.anthropic.messages.create({
      model: RESEARCH_MODEL,
      max_tokens: 1024,
      system: CLARIFYING_QUESTIONS_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    try {
      const parsed = extractJson(text);
      return parsed.questions || [];
    } catch {
      this.logger.warn('Failed to parse clarifying questions response');
      return [];
    }
  }

  /**
   * Execute the research agent tool-use loop.
   * Claude calls tools to gather data, up to MAX_TOOL_ITERATIONS rounds.
   */
  async executeResearch(
    userQuestion: string,
    clarifyingAnswers?: Record<string, string>,
    userContext?: string,
  ): Promise<ResearchResult> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not configured');
    }

    const startTime = Date.now();
    let prompt = `Research question: "${userQuestion}"`;
    if (clarifyingAnswers && Object.keys(clarifyingAnswers).length > 0) {
      prompt += `\n\nUser clarifications:\n${JSON.stringify(clarifyingAnswers, null, 2)}`;
    }
    if (userContext) {
      prompt += `\n\nAdditional context: ${userContext}`;
    }

    let messages: Anthropic.Messages.MessageParam[] = [
      { role: 'user', content: prompt },
    ];
    let toolCallCount = 0;
    let calledSearchNews = false;
    let lastResearchData: Record<string, unknown> = {};

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const response = await this.anthropic.messages.create({
        model: RESEARCH_MODEL,
        max_tokens: 4096,
        system: RESEARCH_AGENT_SYSTEM_PROMPT,
        tools: RESEARCH_TOOLS,
        messages,
      });

      // If the model is done (no more tool calls), extract the final answer
      if (response.stop_reason === 'end_turn') {
        lastResearchData = extractResearchData(response.content);
        break;
      }

      // Process tool calls
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use',
      );

      if (toolUseBlocks.length === 0) {
        lastResearchData = extractResearchData(response.content);
        break;
      }

      // Execute each tool call and build tool_result messages
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
      for (const toolUse of toolUseBlocks) {
        toolCallCount++;
        if (toolUse.name === 'search_news') calledSearchNews = true;
        this.logger.log(`Tool call #${toolCallCount}: ${toolUse.name}`);

        const result = await executeToolCall(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
          this.scoringService,
          this.metricResolution,
          this.timeSeriesService,
          this.newsService,
        );

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result,
        });
      }

      // Continue the conversation with tool results
      messages = [
        ...messages,
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults },
      ];
    }

    // Force search_news if Claude skipped it — news context is essential
    if (!calledSearchNews && this.newsService) {
      this.logger.log('Claude skipped search_news — forcing news fetch');
      const topRegion = this.extractTopRegionName(lastResearchData);
      if (topRegion) {
        const newsResult = await executeToolCall(
          'search_news',
          { region_name: topRegion, geography_level: 'metro' },
          this.scoringService,
          this.metricResolution,
          this.timeSeriesService,
          this.newsService,
        );
        toolCallCount++;
        try {
          (lastResearchData as any).forced_news = JSON.parse(newsResult);
        } catch {
          (lastResearchData as any).forced_news = newsResult;
        }
      }
    }

    return {
      researchData: lastResearchData,
      toolCallCount,
      durationMs: Date.now() - startTime,
    };
  }

  /** Extract the top region name from research data for forced news lookup. */
  private extractTopRegionName(data: Record<string, unknown>): string | null {
    try {
      const regions = data.regions_analyzed as string[] | undefined;
      if (regions?.length) return regions[0];
      const findings = data.key_findings as string[] | undefined;
      if (findings?.length)
        return (
          findings[0].match(/[A-Z][a-z]+(?:[\s-][A-Z][a-z]+)*/)?.[0] ?? null
        );
    } catch {
      /* best-effort */
    }
    return null;
  }

  /**
   * Generate the final narrative from structured research data.
   * Delegates to research-narrative-generator.
   */
  async generateNarrative(
    userQuestion: string,
    researchData: Record<string, unknown>,
    clarifyingContext?: string,
  ): Promise<string> {
    if (!this.deepseek) {
      throw new Error('DeepSeek client not configured');
    }
    return generateNarrative(
      this.deepseek,
      this.deepseekModel,
      userQuestion,
      researchData,
      clarifyingContext,
    );
  }

  /** Check if the service is fully operational. */
  isAvailable(): { research: boolean; narrative: boolean } {
    return {
      research: !!this.anthropic,
      narrative: !!this.deepseek,
    };
  }
}
