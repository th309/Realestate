/**
 * Analytics Assistant - Public Exports
 *
 * Usage:
 *
 * // Button that opens modal
 * import { AnalyticsAssistantButton } from '@/components/analytics-assistant';
 * <AnalyticsAssistantButton />
 *
 * // With custom label and variant
 * <AnalyticsAssistantButton label="Analyze" variant="secondary" />
 *
 * // Icon only
 * <AnalyticsAssistantButton iconOnly />
 *
 * // With context (scoped to a geography)
 * <AnalyticsAssistantButton
 *   context={{
 *     geographyType: 'metro',
 *     geographyId: '12420',
 *     geographyName: 'Austin, TX'
 *   }}
 *   starterPrompts={[
 *     'How does Austin compare to other Texas metros?',
 *     'What is Austin historical performance?',
 *   ]}
 * />
 *
 * // Standalone panel (for embedding)
 * import { AnalyticsAssistantPanel } from '@/components/analytics-assistant';
 * <AnalyticsAssistantPanel />
 *
 * // Custom hook for advanced usage
 * import { useAnalyticsChat } from '@/components/analytics-assistant';
 * const { messages, sendMessage, isLoading } = useAnalyticsChat();
 */

export { AnalyticsAssistantButton } from './AnalyticsAssistantButton';
export { AnalyticsAssistantModal } from './AnalyticsAssistantModal';
export { AnalyticsAssistantPanel } from './AnalyticsAssistantPanel';
export { useAnalyticsChat } from './hooks/useAnalyticsChat';
export type {
  Message,
  AnalyticsContext,
  AnalyticsAssistantProps,
  StructuredData,
  RankingsData,
} from './types';

// Visual components (for custom integrations)
export { ChartRenderer, DataTable, ComparisonCard } from './visuals';
export type {
  ChartConfig,
  ChartDataPoint,
  ChartType,
  DataTableConfig,
  TableColumn,
  TableRow,
  ComparisonConfig,
  ComparisonMetric,
} from './visuals';
