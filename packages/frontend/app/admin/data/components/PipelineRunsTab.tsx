/**
 * PipelineRunsTab Component
 *
 * Displays recent ETL pipeline runs with status, duration, and record counts.
 * Allows manual triggering of pipelines.
 */

'use client';

import { useState, useEffect } from 'react';
import {
  PipelineRun,
  AVAILABLE_PIPELINES,
  formatDuration,
  formatRunDate,
} from './pipelineRuns.types';
import { PipelineStatusBadge } from './PipelineStatusBadge';

export function PipelineRunsTab() {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState<string | null>(null);

  useEffect(() => {
    fetchPipelineRuns();
  }, []);

  const fetchPipelineRuns = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/health/pipeline-runs`);

      if (response.ok) {
        const data = await response.json();
        setRuns(data.pipelines || []);
      } else {
        setError(`API error: ${response.status} ${response.statusText}`);
        setRuns([]);
      }
    } catch (err) {
      console.error('Error fetching pipeline runs:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect to API');
      setRuns([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerPipeline = async (pipelineName: string) => {
    setTriggering(pipelineName);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/pipelines/${pipelineName}/trigger`, {
        method: 'POST',
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

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-surface-container">
          <div className="text-2xl font-bold text-on-surface">{runs.length}</div>
          <div className="text-sm text-on-surface-variant">Recent Runs</div>
        </div>
        <div className="p-4 rounded-xl bg-green-50">
          <div className="text-2xl font-bold text-green-800">
            {runs.filter((r) => r.status === 'success').length}
          </div>
          <div className="text-sm text-green-600">Successful</div>
        </div>
        <div className="p-4 rounded-xl bg-red-50">
          <div className="text-2xl font-bold text-red-800">
            {runs.filter((r) => r.status === 'failed').length}
          </div>
          <div className="text-sm text-red-600">Failed</div>
        </div>
        <div className="p-4 rounded-xl bg-blue-50">
          <div className="text-2xl font-bold text-blue-800">
            {runs.filter((r) => r.status === 'running').length}
          </div>
          <div className="text-sm text-blue-600">Running</div>
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
          <div className="p-8 text-center text-on-surface-variant">
            No pipeline runs found in the last 72 hours.
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
