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

export interface ProviderPreset {
  baseUrl: string;
  defaultModel: string;
  defaultTemperature: number;
  envKeyName: string;
  supportsSystemPrompt: boolean;
  /** Available models for this provider, shown in admin UI dropdown. */
  availableModels: Array<{ id: string; label: string; context?: string }>;
}

export const PROVIDER_PRESETS: Record<AiProviderType, ProviderPreset> = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    defaultTemperature: 0.7,
    envKeyName: 'DEEPSEEK_API_KEY',
    supportsSystemPrompt: true,
    availableModels: [
      { id: 'deepseek-chat', label: 'DeepSeek Chat (V3)', context: '64K' },
      {
        id: 'deepseek-reasoner',
        label: 'DeepSeek Reasoner (R1)',
        context: '64K',
      },
    ],
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-20250514',
    defaultTemperature: 0.7,
    envKeyName: 'ANTHROPIC_API_KEY',
    supportsSystemPrompt: true,
    availableModels: [
      { id: 'claude-opus-4-20250514', label: 'Claude Opus 4', context: '200K' },
      {
        id: 'claude-sonnet-4-20250514',
        label: 'Claude Sonnet 4',
        context: '200K',
      },
      {
        id: 'claude-haiku-4-20250414',
        label: 'Claude Haiku 4',
        context: '200K',
      },
      {
        id: 'claude-sonnet-4-20250514',
        label: 'Claude Sonnet 3.5 v2',
        context: '200K',
      },
    ],
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    defaultTemperature: 0.7,
    envKeyName: 'OPENAI_API_KEY',
    supportsSystemPrompt: true,
    availableModels: [
      { id: 'gpt-4o', label: 'GPT-4o', context: '128K' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini', context: '128K' },
      { id: 'gpt-4-turbo', label: 'GPT-4 Turbo', context: '128K' },
      { id: 'o3', label: 'o3 (Reasoning)', context: '200K' },
      { id: 'o3-mini', label: 'o3-mini (Reasoning)', context: '200K' },
      { id: 'o4-mini', label: 'o4-mini (Reasoning)', context: '200K' },
    ],
  },
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.5-flash',
    defaultTemperature: 0.7,
    envKeyName: 'GOOGLE_AI_API_KEY',
    supportsSystemPrompt: true,
    availableModels: [
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', context: '1M' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', context: '1M' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', context: '1M' },
    ],
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-sonnet-4',
    defaultTemperature: 0.7,
    envKeyName: 'OPENROUTER_API_KEY',
    supportsSystemPrompt: true,
    availableModels: [
      {
        id: 'anthropic/claude-opus-4',
        label: 'Claude Opus 4',
        context: '200K',
      },
      {
        id: 'anthropic/claude-sonnet-4',
        label: 'Claude Sonnet 4',
        context: '200K',
      },
      { id: 'openai/gpt-4o', label: 'GPT-4o', context: '128K' },
      { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', context: '1M' },
      { id: 'deepseek/deepseek-chat', label: 'DeepSeek Chat', context: '64K' },
      {
        id: 'deepseek/deepseek-reasoner',
        label: 'DeepSeek Reasoner',
        context: '64K',
      },
    ],
  },
  custom: {
    baseUrl: '',
    defaultModel: '',
    defaultTemperature: 0.7,
    envKeyName: 'CUSTOM_AI_API_KEY',
    supportsSystemPrompt: true,
    availableModels: [],
  },
};
