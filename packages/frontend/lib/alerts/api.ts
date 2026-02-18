/**
 * Alerts API — re-exports from the unified data layer.
 *
 * All data fetching goes through @/lib/data as required by CLAUDE.md.
 * This file exists for backwards compatibility with existing imports.
 */
export {
  fetchAlerts,
  createAlert,
  updateAlert,
  deleteAlert,
  fetchAlertHistory,
  markAlertRead,
  type Alert,
  type AlertHistoryEntry,
} from '@/lib/data';
