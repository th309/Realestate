/**
 * AlertsTab Component
 *
 * Displays and manages confidence alerts.
 * Allows filtering, acknowledging, and resolving alerts.
 *
 * Material Design 3 compliant.
 */

'use client';

import { useState, useEffect } from 'react';
import { fetchAPIRaw } from '@/lib/data';

interface Alert {
  id: string;
  scoreType: string;
  geographyType: string;
  alertType: 'threshold' | 'degradation' | 'anomaly';
  severity: 'warning' | 'critical';
  previousConfidence: number | null;
  currentConfidence: number;
  thresholdCrossed: number;
  diagnosticSignals: Array<{
    name: string;
    description: string;
    value: string | number;
    severity: 'info' | 'warning' | 'critical';
  }>;
  recommendedActions: string[];
  status: 'open' | 'acknowledged' | 'resolved' | 'dismissed';
  createdAt: string;
}

export function AlertsTab() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<{
    status: string;
    severity: string;
    scoreType: string;
  }>({ status: 'open', severity: 'all', scoreType: 'all' });
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  useEffect(() => {
    fetchAlerts();
  }, [filter]);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.status !== 'all') params.append('status', filter.status);
      if (filter.severity !== 'all') params.append('severity', filter.severity);
      if (filter.scoreType !== 'all') params.append('scoreType', filter.scoreType);

      const response = await fetchAPIRaw(`/api/admin/alerts?${params}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (alertId: string, action: 'acknowledge' | 'resolve' | 'dismiss') => {
    try {
      const response = await fetchAPIRaw(`/api/admin/alerts/${alertId}/${action}`, {
        method: 'POST',
        credentials: 'include',
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
    return severity === 'critical'
      ? 'bg-red-100 text-red-800 border-red-200'
      : 'bg-amber-100 text-amber-800 border-amber-200';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800';
      case 'acknowledged':
        return 'bg-amber-100 text-amber-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'dismissed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
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
            <option value="dismissed">Dismissed</option>
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
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-on-surface-variant">Score:</label>
          <select
            value={filter.scoreType}
            onChange={(e) => setFilter({ ...filter, scoreType: e.target.value })}
            className="px-3 py-1.5 rounded-lg border border-outline bg-surface text-on-surface"
          >
            <option value="all">All Scores</option>
            <option value="market_health">Market Health</option>
            <option value="homeready">HomeReady</option>
            <option value="investoredge">InvestorEdge</option>
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
                    {new Date(alert.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="font-medium text-on-surface mb-1">
                  {formatScoreType(alert.scoreType)} - {alert.geographyType}
                </div>

                <div className="text-sm text-on-surface-variant">
                  Confidence: {alert.currentConfidence}%
                  {alert.previousConfidence !== null && (
                    <span className="text-red-600">
                      {' '}
                      (↓{(alert.previousConfidence - alert.currentConfidence).toFixed(1)}%)
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Alert Detail */}
        {selectedAlert && (
          <div className="bg-surface-container rounded-xl p-6 space-y-4 h-fit sticky top-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-on-surface">
                  {formatScoreType(selectedAlert.scoreType)}
                </h3>
                <p className="text-sm text-on-surface-variant capitalize">
                  {selectedAlert.geographyType} • {selectedAlert.alertType} alert
                </p>
              </div>
              <span
                className={`text-sm px-3 py-1 rounded-full border ${getSeverityColor(selectedAlert.severity)}`}
              >
                {selectedAlert.severity}
              </span>
            </div>

            <div className="p-4 rounded-lg bg-surface-container-low">
              <div className="text-3xl font-bold text-on-surface mb-1">
                {selectedAlert.currentConfidence}%
              </div>
              <div className="text-sm text-on-surface-variant">
                Threshold crossed: {selectedAlert.thresholdCrossed}%
              </div>
            </div>

            {/* Diagnostic Signals */}
            {selectedAlert.diagnosticSignals.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-on-surface-variant mb-2">
                  Diagnostic Signals
                </h4>
                <div className="space-y-2">
                  {selectedAlert.diagnosticSignals.map((signal, i) => (
                    <div key={i} className="p-3 rounded-lg bg-surface-container-low">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-on-surface">{signal.name}</span>
                        <span className="text-sm text-on-surface-variant">
                          {signal.value}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant mt-1">
                        {signal.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended Actions */}
            {selectedAlert.recommendedActions.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-on-surface-variant mb-2">
                  Recommended Actions
                </h4>
                <ul className="space-y-1">
                  {selectedAlert.recommendedActions.map((action, i) => (
                    <li key={i} className="text-sm text-on-surface flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            {selectedAlert.status === 'open' && (
              <div className="flex gap-3 pt-4 border-t border-outline-variant">
                <button
                  onClick={() => handleAction(selectedAlert.id, 'acknowledge')}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-secondary text-on-secondary"
                >
                  Acknowledge
                </button>
                <button
                  onClick={() => handleAction(selectedAlert.id, 'resolve')}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-on-primary"
                >
                  Resolve
                </button>
                <button
                  onClick={() => handleAction(selectedAlert.id, 'dismiss')}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                >
                  Dismiss
                </button>
              </div>
            )}

            {selectedAlert.status === 'acknowledged' && (
              <div className="flex gap-3 pt-4 border-t border-outline-variant">
                <button
                  onClick={() => handleAction(selectedAlert.id, 'resolve')}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-on-primary"
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

function formatScoreType(type: string): string {
  const labels: Record<string, string> = {
    market_health: 'Market Health',
    homeready: 'HomeReady',
    investoredge: 'InvestorEdge',
  };
  return labels[type] || type;
}
