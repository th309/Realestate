/**
 * DataCardsTab Component
 *
 * Displays metric health table showing status, latest date, coverage, and source
 * for all data cards in the platform. Matches the maps page sidebar exactly.
 */

'use client';

import { useState, useEffect } from 'react';
import { fetchAPIRaw } from '@/lib/data';
import {
  MetricHealth,
  getStatusBadgeClasses,
  getCoverageColor,
} from './dataCards.types';
import { MetricTitle } from '@/app/components/MetricTitle';

export function DataCardsTab() {
  const [metrics, setMetrics] = useState<MetricHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'ok' | 'stale' | 'empty' | 'error'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    fetchMetricHealth();
  }, []);

  const fetchMetricHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchAPIRaw(`/api/health/data-cards`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setMetrics(data.checks || []);
      } else {
        setError(`API error: ${response.status} ${response.statusText}`);
        setMetrics([]);
      }
    } catch (err) {
      console.error('Error fetching metric health:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect to API');
      setMetrics([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredMetrics = metrics.filter((m) => {
    const statusMatch = filter === 'all' || m.status === filter;
    const categoryMatch = categoryFilter === 'all' || m.category === categoryFilter;
    return statusMatch && categoryMatch;
  });

  const uniqueCategories = [...new Set(metrics.map((m) => m.category))];

  const renderStatusBadge = (status: string) => {
    const classes = getStatusBadgeClasses(status);
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${classes.bg} ${classes.text}`}>
        {classes.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-surface-container">
          <div className="text-2xl font-bold text-on-surface">{metrics.length}</div>
          <div className="text-sm text-on-surface-variant">Total Metrics</div>
        </div>
        <div className="p-4 rounded-xl bg-green-50">
          <div className="text-2xl font-bold text-green-800">
            {metrics.filter((m) => m.status === 'ok').length}
          </div>
          <div className="text-sm text-green-600">Healthy</div>
        </div>
        <div className="p-4 rounded-xl bg-amber-50">
          <div className="text-2xl font-bold text-amber-800">
            {metrics.filter((m) => m.status === 'stale').length}
          </div>
          <div className="text-sm text-amber-600">Stale</div>
        </div>
        <div className="p-4 rounded-xl bg-red-50">
          <div className="text-2xl font-bold text-red-800">
            {metrics.filter((m) => m.status === 'error' || m.status === 'empty').length}
          </div>
          <div className="text-sm text-red-600">Issues</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-on-surface-variant">Status:</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="px-3 py-1.5 rounded-lg border border-outline bg-surface text-on-surface"
          >
            <option value="all">All</option>
            <option value="ok">Healthy Only</option>
            <option value="stale">Stale Only</option>
            <option value="error">Errors Only</option>
            <option value="empty">Empty Only</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-on-surface-variant">Category:</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-outline bg-surface text-on-surface"
          >
            <option value="all">All Categories</option>
            {uniqueCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="text-sm text-on-surface-variant">
          Showing {filteredMetrics.length} of {metrics.length} metrics
        </div>
      </div>

      {/* Metric Health Table */}
      <div className="overflow-x-auto bg-surface-container rounded-xl" data-testid="metric-health-table">
        {loading ? (
          <div className="p-8 text-center text-on-surface-variant">Loading...</div>
        ) : error ? (
          <div className="p-8 text-center">
            <div className="text-red-600 font-medium mb-2">Failed to load data</div>
            <div className="text-sm text-on-surface-variant mb-4">{error}</div>
            <button
              onClick={fetchMetricHealth}
              className="px-4 py-2 bg-primary text-on-primary rounded-lg hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        ) : metrics.length === 0 ? (
          <div className="p-8 text-center text-on-surface-variant">
            No metrics found. The health check API may not be returning data.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-outline-variant">
            <thead className="bg-surface-container-low">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  Metric
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  Latest
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  Coverage
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  Source
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {filteredMetrics.map((metric) => (
                <tr key={metric.metricId} data-testid="metric-health-row">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <MetricTitle metricId={metric.metricId} className="font-medium text-on-surface" />
                      {metric.isNew && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-100 text-green-700">
                          New
                        </span>
                      )}
                      {metric.isPro && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-100 text-purple-700">
                          PRO
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-on-surface-variant">{metric.tableName}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-on-surface-variant">
                    {metric.category}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{renderStatusBadge(metric.status)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-on-surface-variant">
                    {metric.latestDate || 'N/A'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-sm font-medium ${getCoverageColor(metric.coverage)}`}>
                      {metric.coverage.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-on-surface-variant">
                    {metric.source}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
