/**
 * Quinn - AI Analytics Assistant
 *
 * Quinn is PropertyIQ's AI-powered analytics assistant for exploring
 * real estate market data through natural language.
 *
 * Usage:
 *
 * // Using the Quinn namespace (recommended)
 * import { Quinn } from '@/components/analytics-assistant';
 * <Quinn.Button />
 * <Quinn.Panel />
 *
 * // Or individual components
 * import { AnalyticsAssistantButton } from '@/components/analytics-assistant';
 * <AnalyticsAssistantButton />
 *
 * // With context (scoped to a geography)
 * <Quinn.Button
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
 * // Feature-gated access
 * <Quinn.Gate feature="analytics_assistant_enabled" userId={userId}>
 *   <Quinn.Panel />
 * </Quinn.Gate>
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

// Persistence (saved queries, watchlist, conversations, alerts)
export {
  useSavedQueries,
  useWatchlist,
  useConversations,
  useAlerts,
  ConversationsSidebar,
  SaveQueryDialog,
} from './persistence';
export type {
  SavedQuery,
  WatchlistItem,
  Note,
  Conversation,
  ConversationMessage,
  Alert,
  AlertCondition,
} from './persistence';

// Feature Gating
export { UpgradePrompt } from './UpgradePrompt';
export { FeatureGate, useFeatureAccess } from './FeatureGate';
export { GrandfatheredBadge, GrandfatheredInfo, FeatureCard } from './GrandfatheredBadge';

// Export & Share
export { ExportButton } from './ExportButton';
export { ShareDialog } from './ShareDialog';

// ============================================================================
// QUINN - Branded exports
// ============================================================================
export { Quinn, QUINN_VERSION, QUINN_NAME, QUINN_DESCRIPTION } from './quinn';
export {
  QuinnButton,
  QuinnModal,
  QuinnPanel,
  QuinnGate,
  QuinnChart,
  QuinnTable,
  QuinnComparison,
  QuinnExportButton,
  QuinnShareDialog,
  useQuinn,
  useQuinnSavedQueries,
  useQuinnWatchlist,
  useQuinnConversations,
  useQuinnAlerts,
} from './quinn';
