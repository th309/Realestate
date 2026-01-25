/**
 * Analytics Assistant Types
 */

import type { ChartConfig } from './visuals/ChartRenderer';
import type { DataTableConfig } from './visuals/DataTable';
import type { ComparisonConfig } from './visuals/ComparisonCard';

/** Structured data that can be rendered as visuals */
export interface StructuredData {
  chart?: ChartConfig;
  table?: DataTableConfig;
  comparison?: ComparisonConfig;
  rankings?: RankingsData;
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

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
  timestamp: string;
  isError?: boolean;
  /** Structured data for visual rendering */
  data?: StructuredData;
}

export interface AnalyticsContext {
  /** Optional: scope the assistant to a specific geography */
  geographyType?: 'state' | 'metro' | 'county' | 'zip';
  geographyId?: string;
  geographyName?: string;

  /** Optional: pre-select score type */
  scoreType?: 'investoredge' | 'homeready';
}

export interface AnalyticsAssistantProps {
  /** Optional context to scope the conversation */
  context?: AnalyticsContext;

  /** Callback when modal/panel is closed */
  onClose?: () => void;

  /** Custom starter prompts */
  starterPrompts?: string[];

  /** Title override */
  title?: string;

  /** Subtitle override */
  subtitle?: string;
}
