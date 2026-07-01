import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { guardedAnthropic } from '../ai-provider/ai-spend-guard.shared';

export interface MessagesParams {
  model: string;
  max_tokens: number;
  system?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  temperature?: number;
}

export interface MessagesResponse {
  content: Array<{ type: string; text?: string }>;
  stop_reason?: string | null;
  usage?: { input_tokens: number; output_tokens: number };
}

/**
 * Thin DI wrapper around the Anthropic SDK's `messages.create` API.
 *
 * Why: lets services that need Claude inject `AnthropicService` and easily
 * mock it in tests. Other consumers (content-pipeline) use
 * the SDK directly because they need provider-specific features (streaming,
 * tool use); this wrapper is for the simpler request/response cases.
 */
@Injectable()
export class AnthropicService {
  private client: Anthropic;
  private logger = new Logger(AnthropicService.name);

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // App MUST crash if a secret is missing per CLAUDE.md Section 1.2.
      throw new Error('ANTHROPIC_API_KEY is not set');
    }
    this.client = new Anthropic({ apiKey });
  }

  async messages(params: MessagesParams): Promise<MessagesResponse> {
    const response = await guardedAnthropic(params.model, () =>
      this.client.messages.create({
        model: params.model,
        max_tokens: params.max_tokens,
        system: params.system,
        messages: params.messages,
        ...(params.temperature !== undefined
          ? { temperature: params.temperature }
          : {}),
      }),
    );
    return response as MessagesResponse;
  }
}
