/**
 * DataAlertsTab Component
 *
 * Displays and manages data-related alerts (stale data, source unavailable, pipeline failed, etc.).
 * Allows acknowledging and resolving alerts.
 */

'use client';

import { useState, useEffect } from 'react';

interface DataAlert {
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

export function DataAlertsTab() {
  const [alerts, setAlerts] = useState<DataAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{
    status: string;
    severity: string;
    type: string;
  }>({ status: 'open', severity: 'all', type: 'all' });
  const [selectedAlert, setSelectedAlert] = useState<DataAlert | null>(null);

  useEffect(() => {
    fetchAlerts();
  }, [filter]);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const params = new URLSearchParams();
      if (filter.status !== 'all') params.append('status', filter.status);
      if (filter.severity !== 'all') params.append('severity', filter.severity);
      if (filter.type !== 'all') params.append('type', filter.type);

      const response = await fetch(`${apiUrl}/api/health/data-alerts?${params}`);

      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts || []);
      } else {
        setAlerts(getMockAlerts());
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
      setAlerts(getMockAlerts());
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (alertId: string, action: 'acknowledge' | 'resolve') => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/health/data-alerts/${alertId}/${action}`, {
        method: 'POST',
      });

      if (response.ok) {
        await fetchAlerts();
        if (selectedAlert?.id === alertId) {
          setSelectedAlert(null);
        }
      }
    } catch (error) {
      console.error(`Error ${action}ing alert:`, error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'warning':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'info':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800';
      case 'acknowledged':
        return 'bg-amber-100 text-amber-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getAlertTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      source_unavailable: 'Source Unavailable',
      source_stale: 'Source Stale',
      pipeline_failed: 'Pipeline Failed',
      schema_change: 'Schema Change',
      coverage_drop: 'Coverage Drop',
    };
    return labels[type] || type;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-surface-container rounded-xl">
        <div className="flex items-center gap-2">
          <label className="text-sm text-on-surface-variant">Status:</label>
          <select
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            className="px-3 py-1.5 rounded-lg border border-outline bg-surface text-on-surface"
          >
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-on-surface-variant">Severity:</label>
          <select
            value={filter.severity}
            onChange={(e) => setFilter({ ...filter, severity: e.target.value })}
            className="px-3 py-1.5 rounded-lg border border-outline bg-surface text-on-surface"
          >
            <option value="all">All</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-on-surface-variant">Type:</label>
          <select
            value={filter.type}
            onChange={(e) => setFilter({ ...filter, type: e.target.value })}
            className="px-3 py-1.5 rounded-lg border border-outline bg-surface text-on-surface"
          >
            <option value="all">All Types</option>
            <option value="source_unavailable">Source Unavailable</option>
            <option value="source_stale">Source Stale</option>
            <option value="pipeline_failed">Pipeline Failed</option>
            <option value="schema_change">Schema Change</option>
            <option value="coverage_drop">Coverage Drop</option>
          </select>
        </div>
      </div>

      {/* Alert List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          {loading ? (
            <div className="p-8 text-center text-on-surface-variant">Loading...</div>
          ) : alerts.length === 0 ? (
            <div className="p-8 text-center bg-surface-container rounded-xl text-on-surface-variant">
              No alerts found
            </div>
          ) : (
            alerts.map((alert) => (
              <button
                key={alert.id}
                onClick={() => setSelectedAlert(alert)}
                className={`
                  w-full p-4 text-left rounded-xl transition-all
                  ${
                    selectedAlert?.id === alert.id
                      ? 'ring-2 ring-primary bg-primary-container'
                      : 'bg-surface-container hover:bg-surface-container-high'
                  }
                `}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${getSeverityColor(alert.severity)}`}
                    >
                      {alert.severity}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(alert.status)}`}>
                      {alert.status}
                    </span>
                  </div>
                  <span className="text-xs text-on-surface-variant">
                    {formatDate(alert.createdAt)}
                  </span>
                </div>

                <div className="font-medium text-on-surface mb-1">{alert.title}</div>

                <div className="text-sm text-on-surface-variant">{alert.message}</div>
              </button>
            ))
          )}
        </div>

        {/* Alert Detail */}
        {selectedAlert && (
          <div className="bg-surface-container rounded-xl p-6 space-y-4 h-fit sticky top-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-on-surface">{selectedAlert.title}</h3>
                <p className="text-sm text-on-surface-variant">
                  {getAlertTypeLabel(selectedAlert.alertType)}
                </p>
              </div>
              <span
                className={`text-sm px-3 py-1 rounded-full border ${getSeverityColor(selectedAlert.severity)}`}
              >
                {selectedAlert.severity}
              </span>
            </div>

            <div className="p-4 rounded-lg bg-surface-container-low">
              <p className="text-on-surface">{selectedAlert.message}</p>
            </div>

            {selectedAlert.sourceName && (
              <div className="text-sm">
                <span className="text-on-surface-variant">Source: </span>
                <span className="text-on-surface font-medium">{selectedAlert.sourceName}</span>
              </div>
            )}

            {selectedAlert.pipelineName && (
              <div className="text-sm">
                <span className="text-on-surface-variant">Pipeline: </span>
                <span className="text-on-surface font-medium">{selectedAlert.pipelineName}</span>
              </div>
            )}

            <div className="text-sm">
              <span className="text-on-surface-variant">Created: </span>
              <span className="text-on-surface">{formatDate(selectedAlert.createdAt)}</span>
            </div>

            {selectedAlert.acknowledgedAt && (
              <div className="text-sm">
                <span className="text-on-surface-variant">Acknowledged: </span>
                <span className="text-on-surface">
                  {formatDate(selectedAlert.acknowledgedAt)}
                  {selectedAlert.acknowledgedBy && ` by ${selectedAlert.acknowledgedBy}`}
                </span>
              </div>
            )}

            {/* Actions */}
            {selectedAlert.status === 'open' && (
              <div className="flex gap-3 pt-4 border-t border-outline-variant">
                <button
                  onClick={() => handleAction(selectedAlert.id, 'acknowledge')}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-secondary text-on-secondary"
                  data-testid="acknowledge-button"
                >
                  Acknowledge
                </button>
                <button
                  onClick={() => handleAction(selectedAlert.id, 'resolve')}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-on-primary"
                  data-testid="resolve-button"
                >
                  Resolve
                </button>
              </div>
            )}

            {selectedAlert.status === 'acknowledged' && (
              <div className="flex gap-3 pt-4 border-t border-outline-variant">
                <button
                  onClick={() => handleAction(selectedAlert.id, 'resolve')}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-on-primary"
                  data-testid="resolve-button"
                >
                  Resolve
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getMockAlerts(): DataAlert[] {
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
