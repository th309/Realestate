/**
 * Quinn - AI Analytics Assistant
 *
 * Quinn is PropertyIQ's AI-powered analytics assistant that helps users
 * explore real estate market data through natural language conversations.
 *
 * Features:
 * - Natural language queries about market metrics
 * - Market comparisons and rankings
 * - Time series analysis and trends
 * - Visual charts and data tables
 * - Saved queries and watchlists
 * - Shareable links and CSV export
 *
 * Usage:
 *
 * // Button that opens Quinn
 * import { Quinn } from '@/components/analytics-assistant';
 * <Quinn.Button />
 *
 * // With custom props
 * <Quinn.Button label="Ask Quinn" variant="primary" />
 *
 * // Standalone panel
 * <Quinn.Panel />
 *
 * // Modal wrapper
 * <Quinn.Modal isOpen={open} onClose={() => setOpen(false)} />
 *
 * // Feature-gated access
 * <Quinn.Gate userId={userId}>
 *   <Quinn.Panel />
 * </Quinn.Gate>
 */

// Re-export main components with Quinn branding
export { AnalyticsAssistantButton as QuinnButton } from './AnalyticsAssistantButton';
export { AnalyticsAssistantModal as QuinnModal } from './AnalyticsAssistantModal';
export { AnalyticsAssistantPanel as QuinnPanel } from './AnalyticsAssistantPanel';
export { useAnalyticsChat as useQuinn } from './hooks/useAnalyticsChat';

// Feature gating
export { FeatureGate as QuinnGate } from './FeatureGate';
export { UpgradePrompt as QuinnUpgradePrompt } from './UpgradePrompt';

// Visual components
export { ChartRenderer as QuinnChart } from './visuals';
export { DataTable as QuinnTable } from './visuals';
export { ComparisonCard as QuinnComparison } from './visuals';

// Persistence hooks
export { useSavedQueries as useQuinnSavedQueries } from './persistence';
export { useWatchlist as useQuinnWatchlist } from './persistence';
export { useConversations as useQuinnConversations } from './persistence';
export { useAlerts as useQuinnAlerts } from './persistence';

// Export & Share
export { ExportButton as QuinnExportButton } from './ExportButton';
export { ShareDialog as QuinnShareDialog } from './ShareDialog';

/**
 * Quinn namespace object for convenient access
 */
import { AnalyticsAssistantButton } from './AnalyticsAssistantButton';
import { AnalyticsAssistantModal } from './AnalyticsAssistantModal';
import { AnalyticsAssistantPanel } from './AnalyticsAssistantPanel';
import { useAnalyticsChat } from './hooks/useAnalyticsChat';
import { FeatureGate } from './FeatureGate';
import { UpgradePrompt } from './UpgradePrompt';
import { ChartRenderer, DataTable, ComparisonCard } from './visuals';
import { ExportButton } from './ExportButton';
import { ShareDialog } from './ShareDialog';

export const Quinn = {
  /** Button that opens Quinn modal */
  Button: AnalyticsAssistantButton,
  /** Modal container for Quinn */
  Modal: AnalyticsAssistantModal,
  /** Standalone panel component */
  Panel: AnalyticsAssistantPanel,
  /** Feature gate wrapper */
  Gate: FeatureGate,
  /** Upgrade prompt for locked features */
  UpgradePrompt: UpgradePrompt,
  /** Chart visualization */
  Chart: ChartRenderer,
  /** Data table display */
  Table: DataTable,
  /** Market comparison card */
  Comparison: ComparisonCard,
  /** Export button with CSV/JSON */
  ExportButton: ExportButton,
  /** Share dialog for creating links */
  ShareDialog: ShareDialog,
  /** Hook for chat functionality */
  useChat: useAnalyticsChat,
} as const;

/**
 * Quinn metadata
 */
export const QUINN_VERSION = '1.0.0';
export const QUINN_NAME = 'Quinn';
export const QUINN_DESCRIPTION = 'AI-powered real estate analytics assistant';
