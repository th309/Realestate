/**
 * DataSourcesTab Component
 *
 * Displays data source availability, freshness, and schema status.
 */

'use client';

import { useState, useEffect } from 'react';

interface SourceHealth {
  sourceName: string;
  displayName: string;
  sourceType: 's3' | 'api';
  available: boolean;
  responseTimeMs: number | null;
  fresh: boolean;
  daysSinceUpdate: number | null;
  expectedFreshnessDays: number;
  schemaChanged: boolean;
  lastCheck: string;
  errorMessage?: string;
}

export function DataSourcesTab() {
  const [sources, setSources] = useState<SourceHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSourceHealth();
  }, []);

  const fetchSourceHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/health/data-sources`);

      if (response.ok) {
        const data = await response.json();
        setSources(data.sources || []);
      } else {
        setError(`API error: ${response.status} ${response.statusText}`);
        setSources([]);
      }
    } catch (err) {
      console.error('Error fetching source health:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect to API');
      setSources([]);
    } finally {
      setLoading(false);
    }
  };

  const getAvailabilityBadge = (available: boolean) => {
    return available ? (
      <span className="inline-flex items-center gap-1 text-green-600">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        Yes
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-red-600">
        <span className="w-2 h-2 rounded-full bg-red-500" />
        No
      </span>
    );
  };

  const getFreshnessBadge = (fresh: boolean, daysSince: number | null) => {
    if (fresh) {
      return (
        <span className="text-green-600">
          {daysSince !== null ? `${daysSince}d ago` : 'Fresh'}
        </span>
      );
    }
    return (
      <span className="text-amber-600">
        {daysSince !== null ? `${daysSince}d ago` : 'Unknown'}
      </span>
    );
  };

  const getResponseTimeColor = (ms: number | null) => {
    if (ms === null) return 'text-on-surface-variant';
    if (ms < 500) return 'text-green-600';
    if (ms < 2000) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-surface-container">
          <div className="text-2xl font-bold text-on-surface">{sources.length}</div>
          <div className="text-sm text-on-surface-variant">Data Sources</div>
        </div>
        <div className="p-4 rounded-xl bg-green-50">
          <div className="text-2xl font-bold text-green-800">
            {sources.filter((s) => s.available).length}
          </div>
          <div className="text-sm text-green-600">Available</div>
        </div>
        <div className="p-4 rounded-xl bg-blue-50">
          <div className="text-2xl font-bold text-blue-800">
            {sources.filter((s) => s.fresh).length}
          </div>
          <div className="text-sm text-blue-600">Fresh</div>
        </div>
      </div>

      {/* Source Health Table */}
      <div className="overflow-x-auto bg-surface-container rounded-xl" data-testid="source-health-table">
        {loading ? (
          <div className="p-8 text-center text-on-surface-variant">Loading...</div>
        ) : error ? (
          <div className="p-8 text-center">
            <div className="text-red-600 font-medium mb-2">Failed to load data</div>
            <div className="text-sm text-on-surface-variant mb-4">{error}</div>
            <button
              onClick={fetchSourceHealth}
              className="px-4 py-2 bg-primary text-on-primary rounded-lg hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        ) : sources.length === 0 ? (
          <div className="p-8 text-center text-on-surface-variant">
            No data sources found.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-outline-variant">
            <thead className="bg-surface-container-low">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  Source
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  Available
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  Response
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  Fresh
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  Last Update
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  Schema
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {sources.map((source) => (
                <tr key={source.sourceName}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-medium text-on-surface">{source.displayName}</div>
                    <div className="text-xs text-on-surface-variant">{source.sourceName}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-800 uppercase">
                      {source.sourceType}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {getAvailabilityBadge(source.available)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-sm ${getResponseTimeColor(source.responseTimeMs)}`}>
                      {source.responseTimeMs !== null ? `${source.responseTimeMs}ms` : 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {getFreshnessBadge(source.fresh, source.daysSinceUpdate)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-on-surface-variant">
                    {source.daysSinceUpdate !== null
                      ? `${source.daysSinceUpdate} days ago`
                      : 'Unknown'}
                    <span className="text-xs text-on-surface-variant/60 ml-1">
                      (exp: {source.expectedFreshnessDays}d)
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {source.schemaChanged ? (
                      <span className="text-amber-600">Changed</span>
                    ) : (
                      <span className="text-green-600">OK</span>
                    )}
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
