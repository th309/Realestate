/**
 * DataAlertsTab Component
 *
 * Displays and manages data-related alerts.
 * Material Design 3 compliant.
 */

'use client';

import { useState, useEffect } from 'react';
import { DataAlert, AlertFilter } from './dataAlerts.types';
import { AlertListItem } from './AlertListItem';
import { AlertDetail } from './AlertDetail';

export function DataAlertsTab() {
  const [alerts, setAlerts] = useState<DataAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<AlertFilter>({
    status: 'open',
    severity: 'all',
    type: 'all',
  });
  const [selectedAlert, setSelectedAlert] = useState<DataAlert | null>(null);

  useEffect(() => {
    fetchAlerts();
  }, [filter]);

  const fetchAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const params = new URLSearchParams();
      if (filter.status !== 'all') params.append('status', filter.status);
      if (filter.severity !== 'all') params.append('severity', filter.severity);
      if (filter.type !== 'all') params.append('type', filter.type);

      const response = await fetch(`${apiUrl}/api/health/data-alerts?${params}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts || []);
      } else {
        setError(`API error: ${response.status} ${response.statusText}`);
        setAlerts([]);
      }
    } catch (err) {
      console.error('Error fetching alerts:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect to API');
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (alertId: string, action: 'acknowledge' | 'resolve') => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/health/data-alerts/${alertId}/${action}`, {
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

      {/* Alert List and Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          {loading ? (
            <div className="p-8 text-center text-on-surface-variant">Loading...</div>
          ) : error ? (
            <div className="p-8 text-center bg-surface-container rounded-xl">
              <div className="text-red-600 font-medium mb-2">Failed to load alerts</div>
              <div className="text-sm text-on-surface-variant mb-4">{error}</div>
              <button
                onClick={fetchAlerts}
                className="px-4 py-2 bg-primary text-on-primary rounded-lg hover:bg-primary/90"
              >
                Retry
              </button>
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-8 text-center bg-surface-container rounded-xl text-on-surface-variant">
              No alerts found matching the current filters.
            </div>
          ) : (
            alerts.map((alert) => (
              <AlertListItem
                key={alert.id}
                alert={alert}
                isSelected={selectedAlert?.id === alert.id}
                onSelect={setSelectedAlert}
              />
            ))
          )}
        </div>

        {selectedAlert && (
          <AlertDetail
            alert={selectedAlert}
            onAcknowledge={(id) => handleAction(id, 'acknowledge')}
            onResolve={(id) => handleAction(id, 'resolve')}
          />
        )}
      </div>
    </div>
  );
}
