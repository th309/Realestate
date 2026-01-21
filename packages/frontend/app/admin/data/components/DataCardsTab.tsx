/**
 * DataCardsTab Component
 *
 * Displays metric health table showing status, latest date, coverage, and source
 * for all data cards in the platform.
 */

'use client';

import { useState, useEffect } from 'react';

interface MetricHealth {
  metricId: string;
  metricName: string;
  category: string;
  tableName: string;
  status: 'ok' | 'stale' | 'empty' | 'error';
  latestDate: string | null;
  recordCount: number;
  coverage: number;
  source: string;
  message?: string;
}

export function DataCardsTab() {
  const [metrics, setMetrics] = useState<MetricHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'ok' | 'stale' | 'empty' | 'error'>('all');

  useEffect(() => {
    fetchMetricHealth();
  }, []);

  const fetchMetricHealth = async () => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/health/data-cards`);

      if (response.ok) {
        const data = await response.json();
        setMetrics(data.checks || []);
      } else {
        // Mock data for development
        setMetrics(getMockMetrics());
      }
    } catch (error) {
      console.error('Error fetching metric health:', error);
      setMetrics(getMockMetrics());
    } finally {
      setLoading(false);
    }
  };

  const filteredMetrics = filter === 'all'
    ? metrics
    : metrics.filter((m) => m.status === filter);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ok':
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">
            OK
          </span>
        );
      case 'stale':
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800">
            Stale
          </span>
        );
      case 'empty':
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
            Empty
          </span>
        );
      case 'error':
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800">
            Error
          </span>
        );
      default:
        return null;
    }
  };

  const getCoverageColor = (coverage: number) => {
    if (coverage >= 90) return 'text-green-600';
    if (coverage >= 70) return 'text-amber-600';
    return 'text-red-600';
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

      {/* Filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-on-surface-variant">Filter:</label>
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

      {/* Metric Health Table */}
      <div className="overflow-x-auto bg-surface-container rounded-xl" data-testid="metric-health-table">
        {loading ? (
          <div className="p-8 text-center text-on-surface-variant">Loading...</div>
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
                    <div className="font-medium text-on-surface">{metric.metricName}</div>
                    <div className="text-xs text-on-surface-variant">{metric.tableName}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-on-surface-variant">
                    {metric.category}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {getStatusBadge(metric.status)}
                  </td>
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

function getMockMetrics(): MetricHealth[] {
  return [
    { metricId: 'zhvi', metricName: 'ZHVI', category: 'Home Values', tableName: 'zillow_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 33120, coverage: 98.5, source: 'Zillow' },
    { metricId: 'zori', metricName: 'ZORI', category: 'Rentals', tableName: 'zillow_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 28450, coverage: 87.2, source: 'Zillow' },
    { metricId: 'inventory', metricName: 'Inventory', category: 'Market Trends', tableName: 'zillow_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 31200, coverage: 95.3, source: 'Zillow' },
    { metricId: 'population', metricName: 'Population', category: 'Demographics', tableName: 'census_zip', status: 'ok', latestDate: '2023', recordCount: 33000, coverage: 99.1, source: 'Census' },
    { metricId: 'median_income', metricName: 'Median Income', category: 'Economics', tableName: 'census_zip', status: 'ok', latestDate: '2023', recordCount: 32800, coverage: 98.8, source: 'Census' },
    { metricId: 'unemployment', metricName: 'Unemployment Rate', category: 'Economics', tableName: 'economic_county', status: 'stale', latestDate: 'Nov 2023', recordCount: 3221, coverage: 95.0, source: 'BLS' },
    { metricId: 'median_list', metricName: 'Median List Price', category: 'Home Values', tableName: 'realtor_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 29500, coverage: 89.4, source: 'Realtor' },
    { metricId: 'permits', metricName: 'Building Permits', category: 'Market Trends', tableName: 'permits_county', status: 'ok', latestDate: 'Dec 2023', recordCount: 3100, coverage: 92.1, source: 'Census' },
  ];
}
