/**
 * PipelineRunsTab Component
 *
 * Displays recent ETL pipeline runs with status, duration, and record counts.
 * Also shows data source freshness from actual data tables.
 * Allows manual triggering of pipelines.
 */

'use client';

import { useState, useEffect } from 'react';
import { fetchAPIRaw } from '@/lib/data';
import {
  PipelineRun,
  AVAILABLE_PIPELINES,
  formatDuration,
  formatRunDate,
} from './pipelineRuns.types';
import { PipelineStatusBadge } from './PipelineStatusBadge';

interface DataSourceHealth {
  displayName: string;
  available: boolean;
  fresh: boolean;
  daysSinceUpdate: number | null;
}

interface DataSourcesResponse {
  sources: DataSourceHealth[];
  summary: { total: number; available: number; fresh: number };
}

export function PipelineRunsTab() {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [dataSources, setDataSources] = useState<DataSourcesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch both pipeline runs and data sources in parallel
      const [runsResponse, sourcesResponse] = await Promise.all([
        fetchAPIRaw(`/api/health/pipeline-runs`, { credentials: 'include' }),
        fetchAPIRaw(`/api/health/data-sources`, { credentials: 'include' }),
      ]);

      if (runsResponse.ok) {
        const data = await runsResponse.json();
        setRuns(data.pipelines || []);
      } else {
        setRuns([]);
      }

      if (sourcesResponse.ok) {
        const data = await sourcesResponse.json();
        setDataSources(data);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect to API');
      setRuns([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPipelineRuns = fetchData;

  const handleTriggerPipeline = async (pipelineName: string) => {
    setTriggering(pipelineName);
    try {
      const response = await fetchAPIRaw(`/api/pipelines/${pipelineName}/trigger`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        // Refresh the runs list
        await fetchPipelineRuns();
      }
    } catch (error) {
      console.error('Error triggering pipeline:', error);
    } finally {
      setTriggering(null);
    }
  };


  return (
    <div className="space-y-6">
      {/* Manual Trigger */}
      <div className="p-4 rounded-xl bg-surface-container">
        <h3 className="text-sm font-medium text-on-surface mb-3">Trigger Manual Run</h3>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_PIPELINES.map((pipeline) => (
            <button
              key={pipeline.name}
              onClick={() => handleTriggerPipeline(pipeline.name)}
              disabled={triggering !== null}
              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50"
            >
              {triggering === pipeline.name ? 'Triggering...' : pipeline.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary - show data source freshness */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-surface-container">
          <div className="text-2xl font-bold text-on-surface">
            {dataSources?.summary.total || 7}
          </div>
          <div className="text-sm text-on-surface-variant">Data Sources</div>
        </div>
        <div className="p-4 rounded-xl bg-green-50">
          <div className="text-2xl font-bold text-green-800">
            {dataSources?.summary.fresh || 0}
          </div>
          <div className="text-sm text-green-600">Fresh</div>
        </div>
        <div className="p-4 rounded-xl bg-amber-50">
          <div className="text-2xl font-bold text-amber-800">
            {(dataSources?.summary.total || 0) - (dataSources?.summary.fresh || 0)}
          </div>
          <div className="text-sm text-amber-600">Stale</div>
        </div>
        <div className="p-4 rounded-xl bg-blue-50">
          <div className="text-2xl font-bold text-blue-800">
            {runs.length}
          </div>
          <div className="text-sm text-blue-600">Logged Runs</div>
        </div>
      </div>

      {/* Pipeline Runs Table */}
      <div className="overflow-x-auto bg-surface-container rounded-xl" data-testid="pipeline-runs-table">
        {loading ? (
          <div className="p-8 text-center text-on-surface-variant">Loading...</div>
        ) : error ? (
          <div className="p-8 text-center">
            <div className="text-red-600 font-medium mb-2">Failed to load pipeline runs</div>
            <div className="text-sm text-on-surface-variant mb-4">{error}</div>
            <button
              onClick={fetchPipelineRuns}
              className="px-4 py-2 bg-primary text-on-primary rounded-lg hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        ) : runs.length === 0 ? (
          <div className="p-6">
            <p className="text-center text-on-surface-variant mb-4">
              No pipeline runs logged. Showing data freshness from actual tables:
            </p>
            {dataSources && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {dataSources.sources.map((source) => (
                  <div
                    key={source.displayName}
                    className={`p-3 rounded-lg ${
                      source.fresh ? 'bg-green-50' : 'bg-amber-50'
                    }`}
                  >
                    <div className="font-medium text-on-surface text-sm">
                      {source.displayName}
                    </div>
                    <div
                      className={`text-xs ${
                        source.fresh ? 'text-green-600' : 'text-amber-600'
                      }`}
                    >
                      {source.daysSinceUpdate !== null
                        ? `${source.daysSinceUpdate}d old`
                        : 'Unknown'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-outline-variant">
            <thead className="bg-surface-container-low">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  Pipeline
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  Started
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  Records
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {runs.map((run) => (
                <tr key={run.id}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-medium text-on-surface">{run.displayName}</div>
                    <div className="text-xs text-on-surface-variant">{run.pipelineName}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-on-surface-variant">
                    {formatRunDate(run.startedAt)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-on-surface-variant">
                    {formatDuration(run.durationMs)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-on-surface">
                      {run.recordsInserted.toLocaleString()} inserted
                    </div>
                    {run.recordsFailed > 0 && (
                      <div className="text-xs text-red-600">
                        {run.recordsFailed.toLocaleString()} failed
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <PipelineStatusBadge status={run.status} />
                    {run.errorMessage && (
                      <div className="text-xs text-red-600 mt-1 max-w-xs truncate">
                        {run.errorMessage}
                      </div>
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
