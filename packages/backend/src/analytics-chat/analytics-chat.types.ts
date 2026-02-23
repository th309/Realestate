/**
 * Analytics Chat Types
 *
 * All interfaces and types used by the analytics chat service and its helpers.
 * Single source of truth for chat-related type definitions.
 */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ConversationState {
  id: string;
  messages: ChatMessage[];
  context?: Record<string, any>;
  createdAt: string;
  lastMessageAt: string;
}

/** Structured data for visual rendering in frontend */
export interface StructuredData {
  chart?: ChartConfig;
  table?: TableConfig;
  comparison?: ComparisonConfig;
  rankings?: RankingsData;
  /** When the analytics service returns an error in the body (e.g. no data for filter) */
  errorMessage?: string;
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'scatter' | 'distribution';
  title?: string;
  xLabel?: string;
  yLabel?: string;
  data: Array<{ name: string; value: number; label?: string }>;
  colorScale?: 'score' | 'appreciation' | 'neutral';
  referenceLine?: number;
  referenceLabel?: string;
}

export interface TableConfig {
  title?: string;
  columns: Array<{
    key: string;
    label: string;
    type?: 'text' | 'number' | 'score' | 'percent' | 'rank';
  }>;
  rows: Array<Record<string, string | number | null>>;
  maxRows?: number;
  highlightTop?: number;
  highlightBottom?: number;
}

export interface ComparisonConfig {
  title?: string;
  filteredLabel: string;
  benchmarkLabel: string;
  metrics: Array<{
    label: string;
    filtered: number | null;
    benchmark: number | null;
    unit?: 'score' | 'percent' | 'number';
    higherIsBetter?: boolean;
  }>;
}

export interface RankingsData {
  title?: string;
  direction: 'top' | 'bottom';
  items: Array<{
    rank: number;
    name: string;
    score?: number;
    appreciation?: number;
    state?: string;
  }>;
}

export type QueryIntent =
  | 'conversational'
  | 'ranking'
  | 'filtering'
  | 'comparison'
  | 'analysis'
  | 'raw_data'
  | 'ml_analysis'
  | 'news'
  | 'geography';
