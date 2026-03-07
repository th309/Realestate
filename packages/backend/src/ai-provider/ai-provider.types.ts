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
      { id: 'deepseek-chat', label: 'DeepSeek Chat (V3.2)', context: '128K' },
      {
        id: 'deepseek-reasoner',
        label: 'DeepSeek Reasoner (V3.2)',
        context: '128K',
      },
    ],
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-6',
    defaultTemperature: 0.7,
    envKeyName: 'ANTHROPIC_API_KEY',
    supportsSystemPrompt: true,
    availableModels: [
      { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', context: '1M' },
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', context: '200K' },
      {
        id: 'claude-sonnet-4-5',
        label: 'Claude Sonnet 4.5',
        context: '200K',
      },
      {
        id: 'claude-haiku-4-5',
        label: 'Claude Haiku 4.5',
        context: '200K',
      },
    ],
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-5.4',
    defaultTemperature: 0.7,
    envKeyName: 'OPENAI_API_KEY',
    supportsSystemPrompt: true,
    availableModels: [
      { id: 'gpt-5.4', label: 'GPT-5.4', context: '200K' },
      { id: 'gpt-5.4-pro', label: 'GPT-5.4 Pro', context: '200K' },
      { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex', context: '200K' },
      { id: 'gpt-4.1', label: 'GPT-4.1', context: '1M' },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', context: '1M' },
      { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano', context: '1M' },
      { id: 'o3', label: 'o3 (Reasoning)', context: '200K' },
      { id: 'o3-pro', label: 'o3 Pro (Reasoning)', context: '200K' },
      { id: 'o4-mini', label: 'o4-mini (Reasoning)', context: '200K' },
      { id: 'gpt-4o', label: 'GPT-4o (Legacy)', context: '128K' },
    ],
  },
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.5-pro',
    defaultTemperature: 0.7,
    envKeyName: 'GOOGLE_AI_API_KEY',
    supportsSystemPrompt: true,
    availableModels: [
      {
        id: 'gemini-3.1-pro-preview',
        label: 'Gemini 3.1 Pro Preview',
        context: '1M',
      },
      {
        id: 'gemini-3.1-flash-lite-preview',
        label: 'Gemini 3.1 Flash Lite Preview',
        context: '1M',
      },
      { id: 'gemini-3-flash', label: 'Gemini 3 Flash', context: '1M' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', context: '1M' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', context: '1M' },
      {
        id: 'gemini-2.5-flash-lite',
        label: 'Gemini 2.5 Flash Lite',
        context: '1M',
      },
    ],
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-sonnet-4-6',
    defaultTemperature: 0.7,
    envKeyName: 'OPENROUTER_API_KEY',
    supportsSystemPrompt: true,
    availableModels: [
      {
        id: 'anthropic/claude-opus-4-6',
        label: 'Claude Opus 4.6',
        context: '1M',
      },
      {
        id: 'anthropic/claude-sonnet-4-6',
        label: 'Claude Sonnet 4.6',
        context: '200K',
      },
      { id: 'openai/gpt-5.4', label: 'GPT-5.4', context: '200K' },
      { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', context: '1M' },
      { id: 'google/gemini-3-flash', label: 'Gemini 3 Flash', context: '1M' },
      { id: 'deepseek/deepseek-chat', label: 'DeepSeek Chat', context: '128K' },
      {
        id: 'deepseek/deepseek-reasoner',
        label: 'DeepSeek Reasoner',
        context: '128K',
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
