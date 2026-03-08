/**
 * Research Brief Service
 *
 * Orchestrates the Custom Research report generation pipeline:
 * 1. generateClarifyingQuestions() — AI generates scoping questions
 * 2. executeResearch() — AI tool-use loop gathers data
 * 3. generateNarrative() — AI writes the final research brief
 *
 * All AI calls go through AiProviderService (model-agnostic).
 * Narrative generation delegated to research-narrative-generator.ts.
 */

import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { AiProviderService } from '../../ai-provider/ai-provider.service';
import { ScoringService } from '../../scoring/scoring.service';
import { MetricResolutionService } from '../../metric-resolution/metric-resolution.service';
import { TimeSeriesService } from '../../timeseries/timeseries.service';
import { NewsScoutService } from '../news-scout.service';
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
import {
  enrichResearchWithNews,
  extractAllRegionNames,
} from './research-news-enricher';

/** Maximum tool-use loop iterations to prevent runaway agents */
const MAX_TOOL_ITERATIONS = 15;

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

  constructor(
    private readonly aiProvider: AiProviderService,
    private readonly scoringService: ScoringService,
    private readonly metricResolution: MetricResolutionService,
    private readonly timeSeriesService: TimeSeriesService,
    private readonly newsService: NewsScoutService,
  ) {}

  /**
   * Generate 2-3 clarifying questions to scope the research.
   */
  async generateClarifyingQuestions(
    userQuestion: string,
    userContext?: string,
  ): Promise<ClarifyingQuestion[]> {
    const prompt = userContext
      ? `User question: "${userQuestion}"\nUser context: ${userContext}`
      : `User question: "${userQuestion}"`;

    const response = await this.aiProvider.complete('research_clarifying', {
      systemPrompt: CLARIFYING_QUESTIONS_PROMPT,
      userPrompt: prompt,
      maxTokens: 1024,
      responseFormat: 'json',
    });

    try {
      const parsed = extractJson(response.content);
      return parsed.questions || [];
    } catch {
      this.logger.warn('Failed to parse clarifying questions response');
      return [];
    }
  }

  /**
   * Execute the research agent tool-use loop.
   * AI calls tools to gather data, up to MAX_TOOL_ITERATIONS rounds.
   */
  async executeResearch(
    userQuestion: string,
    clarifyingAnswers?: Record<string, string>,
    userContext?: string,
  ): Promise<ResearchResult> {
    const { client, model } =
      await this.aiProvider.getClientForPurpose('research_agent');

    const startTime = Date.now();
    let userPrompt = `Research question: "${userQuestion}"`;
    if (clarifyingAnswers && Object.keys(clarifyingAnswers).length > 0) {
      userPrompt += `\n\nUser clarifications:\n${JSON.stringify(clarifyingAnswers, null, 2)}`;
    }
    if (userContext) {
      userPrompt += `\n\nAdditional context: ${userContext}`;
    }

    let messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: RESEARCH_AGENT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];
    let toolCallCount = 0;
    let calledSearchNews = false;
    let lastResearchData: Record<string, unknown> = {};

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const response = await client.chat.completions.create({
        model,
        max_tokens: 4096,
        tools: RESEARCH_TOOLS,
        messages,
      });

      const choice = response.choices[0];
      if (!choice) break;

      const toolCalls = choice.message.tool_calls;

      // If no tool calls, the model is done — extract final answer
      if (!toolCalls || toolCalls.length === 0) {
        lastResearchData = extractResearchData([
          { type: 'text', text: choice.message.content || '' },
        ]);
        break;
      }

      // Add assistant message with tool calls to history
      messages = [...messages, choice.message];

      // Execute each tool call and build tool result messages
      for (const toolCall of toolCalls) {
        if (toolCall.type !== 'function') continue;
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);
        toolCallCount++;
        if (toolName === 'search_news') calledSearchNews = true;
        this.logger.log(`Tool call #${toolCallCount}: ${toolName}`);

        const result = await executeToolCall(
          toolName,
          toolArgs,
          this.scoringService,
          this.metricResolution,
          this.timeSeriesService,
          this.newsService,
        );

        messages = [
          ...messages,
          { role: 'tool', tool_call_id: toolCall.id, content: result },
        ];
      }
    }

    // Force search_news if the model skipped it — news context is essential
    if (!calledSearchNews) {
      this.logger.log(
        'Model skipped search_news — forcing news fetch for all analyzed regions',
      );
      const regionNames = extractAllRegionNames(lastResearchData);
      if (regionNames.length > 0) {
        const newsResults = await Promise.all(
          regionNames.slice(0, 2).map(async (name) => {
            const result = await executeToolCall(
              'search_news',
              { region_name: name, geography_level: 'metro' },
              this.scoringService,
              this.metricResolution,
              this.timeSeriesService,
              this.newsService,
            );
            toolCallCount++;
            try {
              return { region: name, ...JSON.parse(result) };
            } catch {
              return { region: name, raw: result };
            }
          }),
        );
        (lastResearchData as any).forced_news = newsResults;
      }
    }

    return {
      researchData: lastResearchData,
      toolCallCount,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Enrich research data with direct news fetch (same pattern as HomeReady/InvestorEdge).
   * Does NOT rely on the agent's search_news tool call — fetches news directly.
   */
  async enrichWithNews(
    researchData: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return enrichResearchWithNews(researchData, this.newsService);
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
    return generateNarrative(
      this.aiProvider,
      userQuestion,
      researchData,
      clarifyingContext,
    );
  }

  /** Check if the service is operational (AiProviderService handles config). */
  isAvailable(): { research: boolean; narrative: boolean } {
    return { research: true, narrative: true };
  }
}
