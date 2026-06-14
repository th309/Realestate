/**
 * Data Alerts Types and Utilities
 *
 * Type definitions and helper functions for data alerts management.
 */

export interface DataAlert {
  id: string;
  alertType: 'source_unavailable' | 'source_stale' | 'pipeline_failed' | 'schema_change' | 'coverage_drop';
  severity: 'critical' | 'warning' | 'info';
  sourceName?: string;
  pipelineName?: string;
  title: string;
  message: string;
  details?: Record<string, unknown>;
  status: 'open' | 'acknowledged' | 'resolved';
  createdAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface AlertFilter {
  status: string;
  severity: string;
  type: string;
}

export function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'warning':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'info':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    default:
      return 'bg-surface-container-low text-on-surface-variant border-outline-variant';
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'open':
      return 'bg-red-100 text-red-800';
    case 'acknowledged':
      return 'bg-amber-100 text-amber-800';
    case 'resolved':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-surface-container-low text-on-surface-variant';
  }
}

export function getAlertTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    source_unavailable: 'Source Unavailable',
    source_stale: 'Source Stale',
    pipeline_failed: 'Pipeline Failed',
    schema_change: 'Schema Change',
    coverage_drop: 'Coverage Drop',
  };
  return labels[type] || type;
}

export function formatAlertDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// No mock data - all data comes from the API at /api/health/data-alerts
