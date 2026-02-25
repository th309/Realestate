/**
 * AI Provider Abstraction Service
 *
 * Wraps DeepSeek (via OpenAI SDK) and Anthropic Claude behind a single
 * async-generator streaming interface. Routes to the correct SDK based
 * on provider selection, keeping all LLM wiring in one place.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { AiProvider, ChatMessage } from './ai-insights.types';

@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);
  private deepseekClient: OpenAI | null = null;
  private anthropicClient: Anthropic | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initializeClients();
  }

  private initializeClients(): void {
    const deepseekKey = this.configService.get<string>('DEEPSEEK_API_KEY');
    if (deepseekKey) {
      this.deepseekClient = new OpenAI({
        apiKey: deepseekKey,
        baseURL:
          this.configService.get<string>('DEEPSEEK_BASE_URL') ||
          'https://api.deepseek.com/v1',
      });
      this.logger.log('DeepSeek client initialized');
    }

    const anthropicKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (anthropicKey) {
      this.anthropicClient = new Anthropic({ apiKey: anthropicKey });
      this.logger.log('Anthropic client initialized');
    }
  }

  /**
   * Stream LLM completions from the selected provider.
   * Yields text chunks as they arrive from the upstream API.
   */
  async *streamCompletion(
    systemPrompt: string,
    messages: ChatMessage[],
    provider: AiProvider,
  ): AsyncGenerator<string> {
    if (provider === 'deepseek') {
      yield* this.streamDeepSeek(systemPrompt, messages);
    } else {
      yield* this.streamClaude(systemPrompt, messages);
    }
  }

  private async *streamDeepSeek(
    systemPrompt: string,
    messages: ChatMessage[],
  ): AsyncGenerator<string> {
    if (!this.deepseekClient) {
      throw new Error(
        'DeepSeek client not initialized — check DEEPSEEK_API_KEY',
      );
    }

    const model =
      this.configService.get<string>('DEEPSEEK_MODEL') || 'deepseek-chat';

    const stream = await this.deepseekClient.chat.completions.create({
      model,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ],
      temperature: 0.7,
      max_tokens: 4096,
    });

    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  private async *streamClaude(
    systemPrompt: string,
    messages: ChatMessage[],
  ): AsyncGenerator<string> {
    if (!this.anthropicClient) {
      throw new Error(
        'Anthropic client not initialized — check ANTHROPIC_API_KEY',
      );
    }

    const model =
      this.configService.get<string>('CLAUDE_INSIGHTS_MODEL') ||
      'claude-sonnet-4-6-20250514';

    const stream = await this.anthropicClient.messages.stream({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      temperature: 0.7,
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
    }
  }

  /** Returns which providers have valid API keys configured. */
  getAvailableProviders(): AiProvider[] {
    const available: AiProvider[] = [];
    if (this.deepseekClient) available.push('deepseek');
    if (this.anthropicClient) available.push('claude');
    return available;
  }
}
