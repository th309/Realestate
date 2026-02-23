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
  private readonly CONVERSATION_TTL_MS = 30 * 60 * 1000;
  private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
  private readonly MAX_CONVERSATIONS = 1000;
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
    const cfg = this.configService;
    const rawProvider = cfg.get<string>('AI_PROVIDER', 'anthropic').toLowerCase();
    this.provider = (['openai', 'novita', 'groq', 'deepseek'].includes(rawProvider) ? 'openai' : 'anthropic') as any;
    const anthropicKey = cfg.get<string>('ANTHROPIC_API_KEY');
    const isDeepSeek = rawProvider === 'deepseek' || rawProvider === 'novita';
    const openaiKey = isDeepSeek
      ? (cfg.get<string>('DEEPSEEK_API_KEY') || cfg.get<string>('OPENAI_API_KEY'))
      : (cfg.get<string>('OPENAI_API_KEY') || cfg.get<string>('DEEPSEEK_API_KEY'));
    const baseURL = cfg.get<string>('AI_BASE_URL');
    this.modelName = cfg.get<string>('AI_MODEL') || (this.provider === 'openai' ? 'deepseek-chat' : this.MODEL_BALANCED);
    this.logger.log(`[Quinn Init] Provider: ${this.provider.toUpperCase()}, Model: ${this.modelName}`);
    if (openaiKey) {
      try {
        const c = new OpenAI({ apiKey: openaiKey, baseURL });
        this.openaiClient = c;
        this.providers.set('openai', new OpenAIProvider(c, this.toolsService));
      } catch (e) { this.logger.error(`[Quinn Init] OpenAI init failed: ${e.message}`); }
    }
    if (anthropicKey) {
      try {
        const c = new Anthropic({ apiKey: anthropicKey });
        this.anthropicClient = c;
        this.providers.set('anthropic', new AnthropicProvider(c, this.toolsService));
      } catch (e) { this.logger.error(`[Quinn Init] Anthropic init failed: ${e.message}`); }
    }
    if (anthropicKey && (anthropicKey.includes(' ') || anthropicKey.length < 10))
      this.logger.error('[Quinn Init] Invalid Anthropic API Key format');
    if (!this.openaiClient && !this.anthropicClient)
      this.logger.error('[Quinn Init] No valid API keys found!');
    if (this.isAvailable() && cfg.get<string>('QUINN_CACHE_WARM_ON_STARTUP', 'true') === 'true') {
      warmCache(this.redisService, this.toolsService, cfg)
        .then(() => buildDataDigest(this.redisService))
        .then((d) => { this.dataDigest = d; })
        .catch((err) => this.logger.error(`[Quinn Cache] Warm-up error: ${err.message}`));
    }
    this.startConversationCleanup();
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

  private cleanupStaleConversations(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, conv] of this.conversations.entries()) {
      if (now - new Date(conv.lastMessageAt).getTime() > this.CONVERSATION_TTL_MS) {
        this.conversations.delete(id); cleaned++;
      }
    }
    if (this.conversations.size > this.MAX_CONVERSATIONS) {
      const sorted = Array.from(this.conversations.entries())
        .sort((a, b) => new Date(a[1].lastMessageAt).getTime() - new Date(b[1].lastMessageAt).getTime());
      for (const [id] of sorted.slice(0, this.conversations.size - this.MAX_CONVERSATIONS)) {
        this.conversations.delete(id); cleaned++;
      }
    }
    if (cleaned > 0) this.logger.log(`[Quinn Cleanup] Removed ${cleaned} stale conversations. Active: ${this.conversations.size}`);
  }

  getConversation(conversationId: string): ConversationState | undefined { return this.conversations.get(conversationId); }

  clearConversation(conversationId: string): boolean {
    const existed = this.conversations.has(conversationId);
    this.conversations.delete(conversationId);
    if (existed) this.logger.log(`Cleared conversation: ${conversationId}`);
    return existed;
  }

  listConversations(): string[] { return Array.from(this.conversations.keys()); }

  private async enrichSystemPrompt(
    queryIntent: string, conversation: ConversationState, userMessage: string,
  ): Promise<string> {
    const userMode = (conversation.context?.userMode as 'homebuyer' | 'investor') || 'homebuyer';
    const userProfilePrompt = buildUserProfilePrompt(userMode, conversation.context as any);
    const digestIntents = new Set(['conversational', 'ranking', 'filtering', 'comparison', 'analysis']);
    let systemPrompt = this.dataDigest && digestIntents.has(queryIntent)
      ? `${userProfilePrompt}\n${this.dataDigest}` : userProfilePrompt;

    const briefingResult = await lookupBriefingContext(
      this.supabase.getClient(), this.briefingGenerator, userMessage, conversation.context,
    );
    const rankingsContext = await lookupRankingsCache(this.appConfig, this.rankingsCache, userMessage);

    if (briefingResult) {
      systemPrompt += formatBriefingForPrompt(briefingResult.briefing, briefingResult.freshNews);
      this.logger.log(`[Quinn Intelligence] Injected briefing for ${briefingResult.briefing.geography_name}`);
    }
    if (rankingsContext) {
      systemPrompt += `\n\n${rankingsContext}`;
      this.logger.log(`[Quinn Intelligence] Injected cached rankings context`);
    }
    return systemPrompt;
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

  async * chatStream(
    conversationId: string, userMessage: string, context?: Record<string, any>,
  ): AsyncGenerator<{ type: 'text' | 'tool' | 'done'; content: any }> {
    const intelligenceEnabled = await this.appConfig.getBool('BRIEFING_GENERATION_ENABLED', false);
    if (!intelligenceEnabled) {
      yield { type: 'text', content: 'Quinn is currently offline. Market intelligence features are being configured.' };
      yield { type: 'done', content: null };
      return;
    }
    if (!this.providers.size) throw new Error('AI Provider not initialized - check API Keys');

    const conversation = this.getOrCreateConversation(conversationId, context);
    const intent = getQueryIntent(userMessage);
    const maxIter = getMaxIterations(intent);
    const rawTools = getRelevantTools(userMessage, this.toolsService.getToolDefinitions());
    const systemPrompt = await this.enrichSystemPrompt(intent, conversation, userMessage);
    conversation.messages.push({ role: 'user', content: userMessage });
    conversation.lastMessageAt = new Date().toISOString();
    let successful = false; let lastError: Error | null = null; let accumulatedText = '';
    for (const providerId of this.providerOrder()) {
      const prov = this.providers.get(providerId);
      if (!prov) continue;
      const model = this.modelForProvider(providerId);
      try {
        const stream = prov.chatStream({
          conversationId, messages: conversation.messages, tools: rawTools,
          systemPrompt, model, maxIterations: maxIter,
        });
        for await (const chunk of stream) {
          if (chunk.type === 'text') accumulatedText += chunk.content;
          yield chunk;
        }
        successful = true; break;
      } catch (e) { this.logger.warn(`[Quinn Stream] ${providerId} failed: ${e.message}`); lastError = e; }
    }
    if (!successful) throw lastError || new Error('No AI provider available');
    conversation.messages.push({ role: 'assistant', content: accumulatedText });
  }

  async chat(
    conversationId: string, userMessage: string, context?: Record<string, any>,
  ): Promise<{
    response: string; toolsUsed: string[]; structuredData?: StructuredData;
    modelUsed?: string; metadata?: { intent: string; toolCallCount: number; totalExecutionTime: number };
  }> {
    const intelligenceEnabled = await this.appConfig.getBool('BRIEFING_GENERATION_ENABLED', false);
    if (!intelligenceEnabled) {
      return { response: 'Quinn is currently offline. Market intelligence features are being configured.', toolsUsed: [] };
    }
    if (!this.providers.size) throw new Error('AI Provider not initialized - check API Keys');

    const conversation = this.getOrCreateConversation(conversationId, context);
    const intent = getQueryIntent(userMessage);
    const maxIter = getMaxIterations(intent);
    const rawTools = getRelevantTools(userMessage, this.toolsService.getToolDefinitions());
    conversation.messages.push({ role: 'user', content: userMessage });
    conversation.lastMessageAt = new Date().toISOString();
    const systemPrompt = await this.enrichSystemPrompt(intent, conversation, userMessage);
    const dynamicCtx = buildDynamicContext(conversation.messages);
    let successful = false; let lastError: Error | null = null; let finalResult: any = null;
    let usedModel = ''; const t0 = Date.now(); let toolsUsed: string[] = [];
    for (const providerId of this.providerOrder()) {
      const prov = this.providers.get(providerId);
      if (!prov) continue;
      const model = this.modelForProvider(providerId);
      try {
        const msgs = conversation.messages.map((m, i, arr) =>
          i === arr.length - 1 && m.role === 'user' ? { ...m, content: `${dynamicCtx}\n${m.content}` } : m);
        const result = await prov.chat({
          conversationId, messages: msgs, tools: rawTools, systemPrompt, model, maxIterations: maxIter,
        });
        conversation.messages.push({ role: 'assistant', content: result.content });
        finalResult = result; usedModel = model; toolsUsed = result.toolsUsed;
        successful = true; break;
      } catch (e) { this.logger.warn(`[Quinn Chat] ${providerId} failed: ${e.message}`); lastError = e; }
    }
    if (!successful) throw lastError || new Error('No AI provider available');
    const toolResultsData = finalResult.toolResults.map((r: any) => ({ toolName: r.toolName || 'unknown', data: r.data }));
    const structuredData = extractStructuredData(toolResultsData, userMessage);
    if (!finalResult.content && structuredData) {
      finalResult.content = buildFallbackResponseFromStructuredData(structuredData);
      conversation.messages[conversation.messages.length - 1].content = finalResult.content;
    }
    const elapsed = Date.now() - t0;
    return {
      response: finalResult.content || (toolsUsed.length > 0
        ? 'Here are the results from your request.' : 'I processed that but have no text response.'),
      toolsUsed, structuredData, modelUsed: usedModel,
      metadata: { intent, toolCallCount: toolsUsed.length, totalExecutionTime: elapsed },
    };
  }

  /**
   * Delegate to the extracted helper for formatting a briefing as prompt text.
   * Kept as a private method so existing tests that call
   * `(service as any).formatBriefingForPrompt` continue to work.
   */
  private formatBriefingForPrompt(briefing: MarketBriefing, freshNews: any[]): string {
    return formatBriefingForPrompt(briefing, freshNews);
  }
}
