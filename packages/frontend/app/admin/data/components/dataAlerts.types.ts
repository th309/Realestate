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

export function getMockAlerts(): DataAlert[] {
  const now = new Date();
  return [
    {
      id: '1',
      alertType: 'source_stale',
      severity: 'warning',
      sourceName: 'realtor_s3',
      title: 'Realtor data slightly stale',
      message: 'Realtor data is 8 days old. Expected refresh: 7 days.',
      status: 'open',
      createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '2',
      alertType: 'pipeline_failed',
      severity: 'critical',
      pipelineName: 'realtor_metrics',
      title: 'Realtor pipeline failed',
      message: 'Connection timeout to Realtor S3 bucket.',
      status: 'acknowledged',
      createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      acknowledgedAt: new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString(),
      acknowledgedBy: 'admin@propertyiq.com',
    },
    {
      id: '3',
      alertType: 'coverage_drop',
      severity: 'info',
      sourceName: 'census_api',
      title: 'Census coverage dropped',
      message: 'Census ZIP coverage dropped from 99.5% to 98.8%.',
      status: 'resolved',
      createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      acknowledgedAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      resolvedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}
