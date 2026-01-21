/**
 * AutomatedRunsTab Component
 *
 * Admin interface for viewing and managing automated backtest runs.
 * Features:
 * - Run configuration form
 * - Trigger backtest button
 * - Recent runs table with status indicators
 * - Run detail view with full results matrix
 * - Sampling visualization
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

interface BacktestMetrics {
  r2: number;
  directional_accuracy: number;
  mae: number;
  rmse: number;
  quintile_spread: number;
  sample_size: number;
}

interface ConfidenceResult {
  confidence_score: number;
  status: string;
  r2_component: number;
  sample_component: number;
  recency_component: number;
}

interface BacktestCellResult {
  score_type: string;
  horizon: string;
  geography_type: string;
  metrics: BacktestMetrics;
  confidence: ConfidenceResult;
}

interface BacktestRun {
  id: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  config: {
    score_types: string[];
    horizons: string[];
    county_sample: number;
    zip_sample: number;
  };
  total_geographies_tested: number;
  total_score_calculations: number;
  status: string;
  results: BacktestCellResult[];
  alert_count: number;
}

interface BacktestSample {
  geography_type: string;
  sample_size: number;
  sampling_method: string;
}

interface RunStatistics {
  totalRuns: number;
  lastRunDate: string | null;
  averageDuration: number;
  statusCounts: Record<string, number>;
}

interface TriggerConfig {
  score_types: string[];
  horizons: string[];
  county_sample: number;
  zip_sample: number;
  random_seed: number;
}

const DEFAULT_CONFIG: TriggerConfig = {
  score_types: ['market_health', 'homeready', 'investoredge'],
  horizons: ['6m', '1y', '3y', '5y'],
  county_sample: 500,
  zip_sample: 2000,
  random_seed: 42,
};

const SCORE_TYPES = [
  { id: 'market_health', label: 'Market Health' },
  { id: 'homeready', label: 'HomeReady' },
  { id: 'investoredge', label: 'InvestorEdge' },
];

const HORIZONS = [
  { id: '6m', label: '6 Months' },
  { id: '1y', label: '1 Year' },
  { id: '3y', label: '3 Years' },
  { id: '5y', label: '5 Years' },
];

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    healthy: { bg: 'bg-green-100', text: 'text-green-800', label: 'Healthy' },
    review_needed: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Review Needed' },
    action_required: { bg: 'bg-red-100', text: 'text-red-800', label: 'Action Required' },
    running: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Running' },
    queued: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Queued' },
    failed: { bg: 'bg-red-100', text: 'text-red-800', label: 'Failed' },
  };

  const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number; status: string }) {
  let colorClass = 'text-gray-600';
  if (confidence >= 70) colorClass = 'text-green-600';
  else if (confidence >= 55) colorClass = 'text-amber-600';
  else if (confidence >= 40) colorClass = 'text-orange-600';
  else colorClass = 'text-red-600';

  return <span className={`font-medium ${colorClass}`}>{confidence.toFixed(1)}%</span>;
}

export function AutomatedRunsTab() {
  const [runs, setRuns] = useState<BacktestRun[]>([]);
  const [statistics, setStatistics] = useState<RunStatistics | null>(null);
  const [selectedRun, setSelectedRun] = useState<BacktestRun | null>(null);
  const [samples, setSamples] = useState<BacktestSample[]>([]);
  const [config, setConfig] = useState<TriggerConfig>(DEFAULT_CONFIG);
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerJobId, setTriggerJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch runs and statistics
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [runsRes, statsRes] = await Promise.all([
        fetch('/api/admin/backtest-runs?limit=10'),
        fetch('/api/admin/backtest-runs/statistics'),
      ]);

      if (!runsRes.ok || !statsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const runsData = await runsRes.json();
      const statsData = await statsRes.json();

      if (runsData.success) {
        setRuns(runsData.data);
      }

      if (statsData.success) {
        setStatistics(statsData.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch run details
  const fetchRunDetails = async (runId: string) => {
    try {
      const [runRes, samplesRes] = await Promise.all([
        fetch(`/api/admin/backtest-runs/${runId}`),
        fetch(`/api/admin/backtest-runs/${runId}/samples`),
      ]);

      if (runRes.ok) {
        const runData = await runRes.json();
        if (runData.success) {
          setSelectedRun(runData.data);
        }
      }

      if (samplesRes.ok) {
        const samplesData = await samplesRes.json();
        if (samplesData.success) {
          setSamples(samplesData.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch run details:', err);
    }
  };

  // Poll job status
  useEffect(() => {
    if (!triggerJobId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/backtest-runs/job/${triggerJobId}/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            if (data.data.status === 'completed' || data.data.status === 'failed') {
              setIsTriggering(false);
              setTriggerJobId(null);
              fetchData();
            }
          }
        }
      } catch (err) {
        console.error('Failed to poll job status:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [triggerJobId, fetchData]);

  // Trigger backtest
  const handleTrigger = async () => {
    try {
      setIsTriggering(true);
      setError(null);

      const res = await fetch('/api/admin/backtest-runs/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const data = await res.json();

      if (data.success) {
        setTriggerJobId(data.data.jobId);
      } else {
        throw new Error(data.error || 'Failed to trigger backtest');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger backtest');
      setIsTriggering(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    if (seconds < 60) return `${seconds.toFixed(0)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toFixed(0)}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-error-container text-on-error-container rounded-lg">
          {error}
        </div>
      )}

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-surface-container rounded-lg p-4">
            <div className="text-sm text-on-surface-variant">Total Runs</div>
            <div className="text-2xl font-semibold text-on-surface">{statistics.totalRuns}</div>
          </div>
          <div className="bg-surface-container rounded-lg p-4">
            <div className="text-sm text-on-surface-variant">Last Run</div>
            <div className="text-lg font-medium text-on-surface">
              {statistics.lastRunDate ? formatDate(statistics.lastRunDate) : 'Never'}
            </div>
          </div>
          <div className="bg-surface-container rounded-lg p-4">
            <div className="text-sm text-on-surface-variant">Avg Duration</div>
            <div className="text-2xl font-semibold text-on-surface">
              {formatDuration(statistics.averageDuration)}
            </div>
          </div>
          <div className="bg-surface-container rounded-lg p-4">
            <div className="text-sm text-on-surface-variant">Status Distribution</div>
            <div className="flex gap-2 mt-1">
              {Object.entries(statistics.statusCounts).map(([status, count]) => (
                <span key={status} className="text-sm">
                  <StatusBadge status={status} /> {count}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Configuration & Trigger */}
      <div className="bg-surface-container rounded-lg p-6">
        <h3 className="text-lg font-medium text-on-surface mb-4">Trigger New Backtest</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Score Types */}
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Score Types</label>
            <div className="flex flex-wrap gap-2">
              {SCORE_TYPES.map((type) => (
                <label key={type.id} className="inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={config.score_types.includes(type.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setConfig({ ...config, score_types: [...config.score_types, type.id] });
                      } else {
                        setConfig({
                          ...config,
                          score_types: config.score_types.filter((t) => t !== type.id),
                        });
                      }
                    }}
                    className="rounded border-outline"
                  />
                  <span className="ml-2 text-sm text-on-surface">{type.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Horizons */}
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Horizons</label>
            <div className="flex flex-wrap gap-2">
              {HORIZONS.map((h) => (
                <label key={h.id} className="inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={config.horizons.includes(h.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setConfig({ ...config, horizons: [...config.horizons, h.id] });
                      } else {
                        setConfig({
                          ...config,
                          horizons: config.horizons.filter((t) => t !== h.id),
                        });
                      }
                    }}
                    className="rounded border-outline"
                  />
                  <span className="ml-2 text-sm text-on-surface">{h.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Sample Sizes */}
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">County Sample</label>
            <input
              type="number"
              value={config.county_sample}
              onChange={(e) => setConfig({ ...config, county_sample: parseInt(e.target.value) || 500 })}
              className="w-full px-3 py-2 border border-outline rounded-lg bg-surface text-on-surface"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">ZIP Sample</label>
            <input
              type="number"
              value={config.zip_sample}
              onChange={(e) => setConfig({ ...config, zip_sample: parseInt(e.target.value) || 2000 })}
              className="w-full px-3 py-2 border border-outline rounded-lg bg-surface text-on-surface"
            />
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={handleTrigger}
            disabled={isTriggering || config.score_types.length === 0 || config.horizons.length === 0}
            className="px-6 py-2 bg-primary text-on-primary rounded-lg font-medium
                       disabled:opacity-50 disabled:cursor-not-allowed
                       hover:bg-primary/90 transition-colors"
          >
            {isTriggering ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-on-primary"></span>
                Running...
              </span>
            ) : (
              'Trigger Backtest'
            )}
          </button>
        </div>
      </div>

      {/* Recent Runs Table */}
      <div className="bg-surface-container rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant">
          <h3 className="text-lg font-medium text-on-surface">Recent Backtest Runs</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-container-high">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-on-surface-variant">Run ID</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-on-surface-variant">Started</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-on-surface-variant">Duration</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-on-surface-variant">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-on-surface-variant">Geographies</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-on-surface-variant">Alerts</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-on-surface-variant">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {runs.map((run) => (
                <tr key={run.id} className="hover:bg-surface-container-low">
                  <td className="px-4 py-3 text-sm font-mono text-on-surface">{run.id}</td>
                  <td className="px-4 py-3 text-sm text-on-surface">{formatDate(run.started_at)}</td>
                  <td className="px-4 py-3 text-sm text-on-surface">{formatDuration(run.duration_seconds)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-on-surface">{run.total_geographies_tested.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm">
                    {run.alert_count > 0 ? (
                      <span className="text-error font-medium">{run.alert_count}</span>
                    ) : (
                      <span className="text-on-surface-variant">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => fetchRunDetails(run.id)}
                      className="text-sm text-primary hover:underline"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-on-surface-variant">
                    No backtest runs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Run Details Modal */}
      {selectedRun && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
              <h3 className="text-lg font-medium text-on-surface">
                Backtest Run: {selectedRun.id}
              </h3>
              <button
                onClick={() => {
                  setSelectedRun(null);
                  setSamples([]);
                }}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Run Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-on-surface-variant">Status</div>
                  <StatusBadge status={selectedRun.status} />
                </div>
                <div>
                  <div className="text-sm text-on-surface-variant">Duration</div>
                  <div className="font-medium text-on-surface">
                    {formatDuration(selectedRun.duration_seconds)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-on-surface-variant">Geographies</div>
                  <div className="font-medium text-on-surface">
                    {selectedRun.total_geographies_tested.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-on-surface-variant">Alerts</div>
                  <div className={`font-medium ${selectedRun.alert_count > 0 ? 'text-error' : 'text-on-surface'}`}>
                    {selectedRun.alert_count}
                  </div>
                </div>
              </div>

              {/* Sampling Details */}
              {samples.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-on-surface mb-2">Sampling</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {samples.map((sample) => (
                      <div key={sample.geography_type} className="bg-surface-container-low rounded p-2">
                        <div className="text-sm font-medium text-on-surface capitalize">
                          {sample.geography_type}
                        </div>
                        <div className="text-sm text-on-surface-variant">
                          {sample.sample_size.toLocaleString()} ({sample.sampling_method})
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Results Matrix */}
              <div>
                <h4 className="text-sm font-medium text-on-surface mb-2">Confidence Results</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-container-high">
                      <tr>
                        <th className="px-3 py-2 text-left text-on-surface-variant">Score</th>
                        <th className="px-3 py-2 text-left text-on-surface-variant">Geography</th>
                        <th className="px-3 py-2 text-left text-on-surface-variant">Horizon</th>
                        <th className="px-3 py-2 text-right text-on-surface-variant">R²</th>
                        <th className="px-3 py-2 text-right text-on-surface-variant">Dir. Acc.</th>
                        <th className="px-3 py-2 text-right text-on-surface-variant">Samples</th>
                        <th className="px-3 py-2 text-right text-on-surface-variant">Confidence</th>
                        <th className="px-3 py-2 text-left text-on-surface-variant">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                      {selectedRun.results.map((result, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2 font-medium text-on-surface capitalize">
                            {result.score_type.replace('_', ' ')}
                          </td>
                          <td className="px-3 py-2 text-on-surface capitalize">{result.geography_type}</td>
                          <td className="px-3 py-2 text-on-surface">{result.horizon}</td>
                          <td className="px-3 py-2 text-right text-on-surface">
                            {result.metrics.r2.toFixed(3)}
                          </td>
                          <td className="px-3 py-2 text-right text-on-surface">
                            {(result.metrics.directional_accuracy * 100).toFixed(1)}%
                          </td>
                          <td className="px-3 py-2 text-right text-on-surface">
                            {result.metrics.sample_size.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <ConfidenceBadge
                              confidence={result.confidence.confidence_score}
                              status={result.confidence.status}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <StatusBadge status={result.confidence.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
