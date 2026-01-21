/**
 * PipelineRunsTab Component
 *
 * Displays recent ETL pipeline runs with status, duration, and record counts.
 * Allows manual triggering of pipelines.
 */

'use client';

import { useState, useEffect } from 'react';

interface PipelineRun {
  id: string;
  pipelineName: string;
  displayName: string;
  startedAt: string;
  endedAt: string | null;
  status: 'running' | 'success' | 'failed' | 'partial';
  recordsProcessed: number;
  recordsInserted: number;
  recordsFailed: number;
  durationMs: number | null;
  errorMessage?: string;
}

export function PipelineRunsTab() {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);

  useEffect(() => {
    fetchPipelineRuns();
  }, []);

  const fetchPipelineRuns = async () => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/health/pipeline-runs`);

      if (response.ok) {
        const data = await response.json();
        setRuns(data.pipelines || []);
      } else {
        setRuns(getMockRuns());
      }
    } catch (error) {
      console.error('Error fetching pipeline runs:', error);
      setRuns(getMockRuns());
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Running
          </span>
        );
      case 'success':
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">
            Success
          </span>
        );
      case 'failed':
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800">
            Failed
          </span>
        );
      case 'partial':
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800">
            Partial
          </span>
        );
      default:
        return null;
    }
  };

  const formatDuration = (ms: number | null) => {
    if (ms === null) return 'In progress...';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    if (isToday) return `Today ${time}`;
    if (isYesterday) return `Yesterday ${time}`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` ${time}`;
  };

  const availablePipelines = [
    { name: 'zillow_zhvi', label: 'Zillow ZHVI' },
    { name: 'zillow_zori', label: 'Zillow ZORI' },
    { name: 'census_population', label: 'Census Population' },
    { name: 'bls_unemployment', label: 'BLS Unemployment' },
    { name: 'realtor_metrics', label: 'Realtor Metrics' },
  ];

  return (
    <div className="space-y-6">
      {/* Manual Trigger */}
      <div className="p-4 rounded-xl bg-surface-container">
        <h3 className="text-sm font-medium text-on-surface mb-3">Trigger Manual Run</h3>
        <div className="flex flex-wrap gap-2">
          {availablePipelines.map((pipeline) => (
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
                    {formatDate(run.startedAt)}
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
                    {getStatusBadge(run.status)}
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

function getMockRuns(): PipelineRun[] {
  const now = new Date();
  return [
    {
      id: '1',
      pipelineName: 'zillow_zhvi',
      displayName: 'Zillow ZHVI',
      startedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
      endedAt: new Date(now.getTime() - 3.5 * 60 * 60 * 1000).toISOString(),
      status: 'success',
      recordsProcessed: 33500,
      recordsInserted: 33120,
      recordsFailed: 0,
      durationMs: 272000,
    },
    {
      id: '2',
      pipelineName: 'zillow_zori',
      displayName: 'Zillow ZORI',
      startedAt: new Date(now.getTime() - 3.5 * 60 * 60 * 1000).toISOString(),
      endedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
      status: 'success',
      recordsProcessed: 29000,
      recordsInserted: 28450,
      recordsFailed: 0,
      durationMs: 198000,
    },
    {
      id: '3',
      pipelineName: 'bls_unemployment',
      displayName: 'BLS Unemployment',
      startedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      endedAt: new Date(now.getTime() - 1.8 * 60 * 60 * 1000).toISOString(),
      status: 'success',
      recordsProcessed: 3250,
      recordsInserted: 3221,
      recordsFailed: 29,
      durationMs: 132000,
    },
    {
      id: '4',
      pipelineName: 'realtor_metrics',
      displayName: 'Realtor Metrics',
      startedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      endedAt: new Date(now.getTime() - 23.5 * 60 * 60 * 1000).toISOString(),
      status: 'failed',
      recordsProcessed: 0,
      recordsInserted: 0,
      recordsFailed: 0,
      durationMs: 45000,
      errorMessage: 'Connection timeout to Realtor S3',
    },
    {
      id: '5',
      pipelineName: 'census_population',
      displayName: 'Census Population',
      startedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      endedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 + 600000).toISOString(),
      status: 'success',
      recordsProcessed: 33200,
      recordsInserted: 33000,
      recordsFailed: 200,
      durationMs: 600000,
    },
  ];
}
