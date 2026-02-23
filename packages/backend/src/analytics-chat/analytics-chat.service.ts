/** Analytics Chat Service - Orchestrates NL analytics via Claude tool-use. */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { AnalyticsToolsService } from './analytics-tools.service';
import { SupabaseService } from '../supabase/supabase.service';
import { RedisService } from '../redis/redis.service';
import { AIProvider } from './interfaces/ai-provider.interface';
import { OpenAIProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { AppConfigService } from '../config/app-config.service';
import { RankingsCacheService } from '../market-intelligence/rankings-cache.service';
import { BriefingGeneratorService } from '../market-intelligence/briefing-generator.service';
import { MarketBriefing } from '../market-intelligence/market-intelligence.types';
export type { ChatMessage, StructuredData } from './analytics-chat.types';
import { ConversationState, StructuredData } from './analytics-chat.types';
import { getQueryIntent, getMaxIterations, getRelevantTools } from './analytics-chat-query-router';
import { buildUserProfilePrompt, buildDynamicContext } from './analytics-chat-prompt-builders';
import { buildDataDigest, warmCache } from './analytics-chat-cache';
import { extractStructuredData, buildFallbackResponseFromStructuredData } from './analytics-chat-structured-data';
import { lookupBriefingContext, lookupRankingsCache, formatBriefingForPrompt } from './analytics-chat-intelligence.helpers';

@Injectable()
export class AnalyticsChatService {
  private readonly logger = new Logger(AnalyticsChatService.name);
  private anthropicClient: Anthropic | null = null;
  private openaiClient: OpenAI | null = null;
  private provider: 'anthropic' | 'openai' = 'anthropic';
  private modelName = '';
  private providers: Map<string, AIProvider> = new Map();
  private readonly MODEL_BALANCED = 'claude-3-5-sonnet-20241022';
  private conversations: Map<string, ConversationState> = new Map();
  private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
  private cleanupIntervalId: NodeJS.Timeout | null = null;
  private dataDigest = '';

  constructor(
    private readonly configService: ConfigService,
    private readonly toolsService: AnalyticsToolsService,
    private readonly supabase: SupabaseService,
    private readonly redisService: RedisService,
    private readonly appConfig: AppConfigService,
    private readonly rankingsCache: RankingsCacheService,
    private readonly briefingGenerator: BriefingGeneratorService,
  ) {
    this.initializeProviders();
    this.initializeCacheWarmup();
    this.startConversationCleanup();
  }

  private initializeProviders(): void {
    const cfg = this.configService;
    const rawProvider = cfg.get<string>('AI_PROVIDER', 'anthropic').toLowerCase();
    this.provider = ['openai', 'novita', 'groq', 'deepseek'].includes(rawProvider) ? 'openai' : 'anthropic';

    const anthropicKey = cfg.get<string>('ANTHROPIC_API_KEY');
    const isDeepSeek = rawProvider === 'deepseek' || rawProvider === 'novita';
    const openaiKey = isDeepSeek
      ? (cfg.get<string>('DEEPSEEK_API_KEY') || cfg.get<string>('OPENAI_API_KEY'))
      : (cfg.get<string>('OPENAI_API_KEY') || cfg.get<string>('DEEPSEEK_API_KEY'));

    this.modelName = cfg.get<string>('AI_MODEL')
      || (this.provider === 'openai' ? 'deepseek-chat' : this.MODEL_BALANCED);
    this.logger.log(`[Quinn Init] Provider: ${this.provider.toUpperCase()}, Model: ${this.modelName}`);

    if (openaiKey) {
      try {
        const client = new OpenAI({ apiKey: openaiKey, baseURL: cfg.get<string>('AI_BASE_URL') });
        this.openaiClient = client;
        this.providers.set('openai', new OpenAIProvider(client, this.toolsService));
      } catch (e) { this.logger.error(`[Quinn Init] OpenAI init failed: ${e.message}`); }
    }
    if (anthropicKey) {
      if (anthropicKey.includes(' ') || anthropicKey.length < 10)
        this.logger.error('[Quinn Init] Invalid Anthropic API Key format');
      try {
        const client = new Anthropic({ apiKey: anthropicKey });
        this.anthropicClient = client;
        this.providers.set('anthropic', new AnthropicProvider(client, this.toolsService));
      } catch (e) { this.logger.error(`[Quinn Init] Anthropic init failed: ${e.message}`); }
    }
    if (!this.openaiClient && !this.anthropicClient)
      this.logger.error('[Quinn Init] No valid API keys found!');
  }

  private initializeCacheWarmup(): void {
    const shouldWarm = this.configService.get<string>('QUINN_CACHE_WARM_ON_STARTUP', 'true') === 'true';
    if (!this.isAvailable() || !shouldWarm) return;
    warmCache(this.redisService, this.toolsService, this.configService)
      .then(() => buildDataDigest(this.redisService))
      .then((digest) => { this.dataDigest = digest; })
      .catch((err) => this.logger.error(`[Quinn Cache] Warm-up error: ${err.message}`));
  }

  isAvailable(): boolean { return !!this.anthropicClient || !!this.openaiClient; }
  private providerOrder(): string[] { return this.provider === 'anthropic' ? ['anthropic', 'openai'] : ['openai', 'anthropic']; }
  private modelForProvider(id: string): string {
    return id !== this.provider ? (id === 'anthropic' ? this.MODEL_BALANCED : 'deepseek-chat') : this.modelName;
  }

  private startConversationCleanup(): void {
    this.cleanupIntervalId = setInterval(() => this.cleanupStaleConversations(), this.CLEANUP_INTERVAL_MS);
    process.on('beforeExit', () => this.stopConversationCleanup());
  }

  private stopConversationCleanup(): void {
    if (this.cleanupIntervalId) { clearInterval(this.cleanupIntervalId); this.cleanupIntervalId = null; }
  }

  private async cleanupStaleConversations(): Promise<void> {
    const ttlMs = (await this.appConfig.getNumber('QUINN_CONVERSATION_TTL_MINUTES', 30)) * 60_000;
    const maxConversations = await this.appConfig.getNumber('QUINN_MAX_CONVERSATIONS', 1000);
    const now = Date.now();
    let cleaned = 0;
    for (const [id, conv] of this.conversations.entries()) {
      if (now - new Date(conv.lastMessageAt).getTime() > ttlMs) { this.conversations.delete(id); cleaned++; }
    }
    if (this.conversations.size > maxConversations) {
      const sorted = [...this.conversations.entries()]
        .sort((a, b) => new Date(a[1].lastMessageAt).getTime() - new Date(b[1].lastMessageAt).getTime());
      for (const [id] of sorted.slice(0, this.conversations.size - maxConversations)) {
        this.conversations.delete(id); cleaned++;
      }
    }
    if (cleaned > 0) this.logger.log(`[Quinn Cleanup] Removed ${cleaned} stale conversations. Active: ${this.conversations.size}`);
  }

  getConversation(id: string): ConversationState | undefined { return this.conversations.get(id); }
  clearConversation(id: string): boolean {
    const existed = this.conversations.has(id);
    this.conversations.delete(id);
    if (existed) this.logger.log(`Cleared conversation: ${id}`);
    return existed;
  }
  listConversations(): string[] { return [...this.conversations.keys()]; }

  private async enrichSystemPrompt(
    queryIntent: string, conversation: ConversationState, userMessage: string,
  ): Promise<string> {
    const userMode = (conversation.context?.userMode as 'homebuyer' | 'investor') || 'homebuyer';
    const profilePrompt = buildUserProfilePrompt(userMode, conversation.context as any);
    const digestIntents = ['conversational', 'ranking', 'filtering', 'comparison', 'analysis'];
    let prompt = this.dataDigest && digestIntents.includes(queryIntent)
      ? `${profilePrompt}\n${this.dataDigest}` : profilePrompt;

    const [briefingResult, rankingsContext] = await Promise.all([
      lookupBriefingContext(this.supabase.getClient(), this.briefingGenerator, userMessage, conversation.context),
      lookupRankingsCache(this.appConfig, this.rankingsCache, userMessage),
    ]);

    if (briefingResult) {
      prompt += formatBriefingForPrompt(briefingResult.briefing, briefingResult.freshNews);
      this.logger.log(`[Quinn Intelligence] Injected briefing for ${briefingResult.briefing.geography_name}`);
    }
    if (rankingsContext) {
      prompt += `\n\n${rankingsContext}`;
      this.logger.log(`[Quinn Intelligence] Injected cached rankings context`);
    }
    return prompt;
  }

  private getOrCreateConversation(conversationId: string, context?: Record<string, any>): ConversationState {
    let conversation = this.conversations.get(conversationId);
    if (!conversation) {
      conversation = {
        id: conversationId, messages: [], context,
        createdAt: new Date().toISOString(), lastMessageAt: new Date().toISOString(),
      };
      this.conversations.set(conversationId, conversation);
    }
    if (context) conversation.context = { ...conversation.context, ...context };
    return conversation;
  }

  private async prepareConversation(conversationId: string, userMessage: string, context?: Record<string, any>) {
    const conversation = this.getOrCreateConversation(conversationId, context);
    const intent = getQueryIntent(userMessage);
    const tools = getRelevantTools(userMessage, this.toolsService.getToolDefinitions());
    const systemPrompt = await this.enrichSystemPrompt(intent, conversation, userMessage);
    conversation.messages.push({ role: 'user', content: userMessage });
    conversation.lastMessageAt = new Date().toISOString();
    return { conversation, intent, tools, systemPrompt, maxIterations: getMaxIterations(intent) };
  }

  private async ensureIntelligenceEnabled(): Promise<boolean> {
    return this.appConfig.getBool('BRIEFING_GENERATION_ENABLED', false);
  }

  async * chatStream(
    conversationId: string, userMessage: string, context?: Record<string, any>,
  ): AsyncGenerator<{ type: 'text' | 'tool' | 'done'; content: any }> {
    if (!await this.ensureIntelligenceEnabled()) {
      yield { type: 'text', content: 'Quinn is currently offline. Market intelligence features are being configured.' };
      yield { type: 'done', content: null };
      return;
    }
    if (!this.providers.size) throw new Error('AI Provider not initialized - check API Keys');

    const { conversation, tools, systemPrompt, maxIterations } =
      await this.prepareConversation(conversationId, userMessage, context);
    let lastError: Error | null = null;
    let accumulatedText = '';

    for (const providerId of this.providerOrder()) {
      const prov = this.providers.get(providerId);
      if (!prov) continue;
      try {
        const stream = prov.chatStream({
          conversationId, messages: conversation.messages, tools,
          systemPrompt, model: this.modelForProvider(providerId), maxIterations,
        });
        for await (const chunk of stream) {
          if (chunk.type === 'text') accumulatedText += chunk.content;
          yield chunk;
        }
        conversation.messages.push({ role: 'assistant', content: accumulatedText });
        return;
      } catch (e) {
        this.logger.warn(`[Quinn Stream] ${providerId} failed: ${e.message}`);
        lastError = e;
      }
    }
    throw lastError || new Error('No AI provider available');
  }

  async chat(
    conversationId: string, userMessage: string, context?: Record<string, any>,
  ): Promise<{
    response: string; toolsUsed: string[]; structuredData?: StructuredData;
    modelUsed?: string; metadata?: { intent: string; toolCallCount: number; totalExecutionTime: number };
  }> {
    if (!await this.ensureIntelligenceEnabled()) {
      return { response: 'Quinn is currently offline. Market intelligence features are being configured.', toolsUsed: [] };
    }
    if (!this.providers.size) throw new Error('AI Provider not initialized - check API Keys');

    const { conversation, intent, tools, systemPrompt, maxIterations } =
      await this.prepareConversation(conversationId, userMessage, context);
    const dynamicCtx = buildDynamicContext(conversation.messages);
    let lastError: Error | null = null;
    let finalResult: any = null;
    let usedModel = '';
    const startTime = Date.now();

    for (const providerId of this.providerOrder()) {
      const prov = this.providers.get(providerId);
      if (!prov) continue;
      const model = this.modelForProvider(providerId);
      try {
        const messagesWithContext = conversation.messages.map((m, i, arr) =>
          i === arr.length - 1 && m.role === 'user' ? { ...m, content: `${dynamicCtx}\n${m.content}` } : m,
        );
        const result = await prov.chat({
          conversationId, messages: messagesWithContext, tools,
          systemPrompt, model, maxIterations,
        });
        conversation.messages.push({ role: 'assistant', content: result.content });
        finalResult = result;
        usedModel = model;
        break;
      } catch (e) {
        this.logger.warn(`[Quinn Chat] ${providerId} failed: ${e.message}`);
        lastError = e;
      }
    }
    if (!finalResult) throw lastError || new Error('No AI provider available');

    const toolResultsData = finalResult.toolResults.map(
      (r: any) => ({ toolName: r.toolName || 'unknown', data: r.data }),
    );
    const structuredData = extractStructuredData(toolResultsData, userMessage);
    if (!finalResult.content && structuredData) {
      finalResult.content = buildFallbackResponseFromStructuredData(structuredData);
      conversation.messages[conversation.messages.length - 1].content = finalResult.content;
    }

    const toolsUsed = finalResult.toolsUsed;
    const fallbackResponse = toolsUsed.length > 0
      ? 'Here are the results from your request.' : 'I processed that but have no text response.';
    return {
      response: finalResult.content || fallbackResponse,
      toolsUsed, structuredData, modelUsed: usedModel,
      metadata: { intent, toolCallCount: toolsUsed.length, totalExecutionTime: Date.now() - startTime },
    };
  }

  /** Test compatibility shim -- delegates to the extracted helper. */
  private formatBriefingForPrompt(briefing: MarketBriefing, freshNews: any[]): string {
    return formatBriefingForPrompt(briefing, freshNews);
  }
}
