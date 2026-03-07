/**
 * AI Provider Types
 *
 * Model-agnostic type definitions for the unified AI provider abstraction.
 * Supports multiple LLM providers via OpenAI-compatible API format.
 */

export type AiProviderType =
  | 'deepseek'
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'openrouter'
  | 'custom';

export interface AiProviderConfig {
  provider: AiProviderType;
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature?: number;
  maxRetries?: number;
}

export interface AiCompletionRequest {
  systemPrompt?: string;
  userPrompt: string;
  maxTokens: number;
  temperature?: number;
  responseFormat?: 'text' | 'json';
}

export interface AiCompletionResponse {
  content: string;
  model: string;
  provider: AiProviderType;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  durationMs: number;
}

export const PROVIDER_PRESETS: Record<
  AiProviderType,
  {
    baseUrl: string;
    defaultModel: string;
    defaultTemperature: number;
    envKeyName: string;
    supportsSystemPrompt: boolean;
  }
> = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    defaultTemperature: 0.7,
    envKeyName: 'DEEPSEEK_API_KEY',
    supportsSystemPrompt: true,
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-20250514',
    defaultTemperature: 0.7,
    envKeyName: 'ANTHROPIC_API_KEY',
    supportsSystemPrompt: true,
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    defaultTemperature: 0.7,
    envKeyName: 'OPENAI_API_KEY',
    supportsSystemPrompt: true,
  },
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.5-flash',
    defaultTemperature: 0.7,
    envKeyName: 'GOOGLE_AI_API_KEY',
    supportsSystemPrompt: true,
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-sonnet-4',
    defaultTemperature: 0.7,
    envKeyName: 'OPENROUTER_API_KEY',
    supportsSystemPrompt: true,
  },
  custom: {
    baseUrl: '',
    defaultModel: '',
    defaultTemperature: 0.7,
    envKeyName: 'CUSTOM_AI_API_KEY',
    supportsSystemPrompt: true,
  },
};
