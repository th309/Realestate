/**
 * ML Workflow Admin Page
 *
 * Manages PropertyIQ ML workflow steps:
 * 1. Data Export - Sync data to Parquet cache
 * 2. Prepare Backtest Data - Check data availability
 * 3. Calculate Benchmarks - Compute national/regional/peer benchmarks
 * 4. Feature Analysis - Correlation analysis
 * 5. Score Explanations - Statistical distributions
 * 6. Monthly Report - Formula health report
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { WorkflowStepCard } from './components/WorkflowStepCard';
import {
  WorkflowStep,
  StepState,
  StepStatus,
  WorkflowStatusResponse,
  RunStepResponse,
  JobStatusResponse,
} from './types';

// 6 workflow steps with full details
const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: 'data-export',
    name: 'Data Export',
    description: 'Sync full dataset to local Parquet cache for fast analysis',
    script: 'data_cache.sync_all()',
    outputs: [
      'scores_history_metro.parquet',
      'scores_history_county.parquet',
      'scores_history_zip.parquet',
      'scores_history_state.parquet',
    ],
    estimatedTime: '5-15 min',
  },
  {
    id: 'prepare-backtest-data',
    name: 'Prepare Backtest Data',
    description:
      'Analyze cached data for completeness and quality metrics',
    script: 'workflow_service.run_prepare_backtest_data()',
    outputs: ['data quality report'],
    estimatedTime: '1-2 min',
  },
  {
    id: 'calculate-benchmarks',
    name: 'Calculate Benchmarks',
    description:
      'Compute national, regional, and peer group benchmarks from full dataset',
    script: 'workflow_service.run_calculate_benchmarks()',
    outputs: ['national_benchmarks', 'geography_benchmarks'],
    estimatedTime: '2-5 min',
  },
  {
    id: 'feature-analysis',
    name: 'Feature Analysis',
    description: 'Correlation analysis to find which scores best predict outcomes',
    script: 'workflow_service.run_feature_analysis()',
    outputs: ['correlations by score type and geography'],
    estimatedTime: '3-10 min',
  },
  {
    id: 'score-explanations',
    name: 'Score Explanations',
    description:
      'Generate statistical distributions and percentile breakdowns',
    script: 'workflow_service.run_score_explanations()',
    outputs: ['score distributions'],
    estimatedTime: '2-5 min',
  },
  {
    id: 'monthly-report',
    name: 'Monthly Report',
    description:
      'Generate formula health report with validation metrics',
    script: 'workflow_service.run_monthly_report()',
    outputs: ['monthly_report.json'],
    estimatedTime: '2-5 min',
    viewable: true,
  },
];

// Default step states (for initial render before API response)
const DEFAULT_STEP_STATES: Record<string, StepState> = {
  'data-export': { status: 'pending', lastRunTime: null },
  'prepare-backtest-data': { status: 'pending', lastRunTime: null },
  'calculate-benchmarks': { status: 'pending', lastRunTime: null },
  'feature-analysis': { status: 'pending', lastRunTime: null },
  'score-explanations': { status: 'pending', lastRunTime: null },
  'monthly-report': { status: 'pending', lastRunTime: null },
};

interface CacheStatus {
  caches: Record<string, {
    exists: boolean;
    file_size_mb: number;
    record_count: number;
    last_date: string | null;
    last_updated: string | null;
  }>;
}

interface AnalyticsHealth {
  status: string;
  service: string;
  version: string;
  timestamp: string;
}

export default function MLWorkflowPage() {
  const [stepStates, setStepStates] =
    useState<Record<string, StepState>>(DEFAULT_STEP_STATES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRunningFullWorkflow, setIsRunningFullWorkflow] = useState(false);
  const [analyticsHealth, setAnalyticsHealth] = useState<AnalyticsHealth | null>(null);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null);
  const [lastStepResult, setLastStepResult] = useState<Record<string, unknown> | null>(null);

  // Track polling intervals for cleanup
  const pollingIntervals = useRef<Record<string, NodeJS.Timeout>>({});

  // Fetch analytics service health
  const fetchAnalyticsHealth = useCallback(async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/admin/ml-workflow/health`);

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setAnalyticsHealth(data.data);
        }
      }
    } catch (err) {
      console.error('Error fetching analytics health:', err);
      setAnalyticsHealth(null);
    }
  }, []);

  // Fetch workflow status from API
  const fetchWorkflowStatus = useCallback(async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/admin/ml-workflow/status`);

      if (!res.ok) {
        throw new Error('Failed to fetch workflow status');
      }

      const data: WorkflowStatusResponse = await res.json();

      if (data.success && data.data?.steps) {
        setStepStates((prev) => ({
          ...prev,
          ...data.data.steps,
        }));
      }
    } catch (err) {
      console.error('Error fetching workflow status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch status on mount
  useEffect(() => {
    fetchAnalyticsHealth();
    fetchWorkflowStatus();

    // Refresh health every 30 seconds
    const healthInterval = setInterval(fetchAnalyticsHealth, 30000);

    // Cleanup polling intervals on unmount
    return () => {
      clearInterval(healthInterval);
      Object.values(pollingIntervals.current).forEach(clearInterval);
    };
  }, [fetchWorkflowStatus, fetchAnalyticsHealth]);

  // Update a single step's state
  const updateStepState = useCallback(
    (stepId: string, updates: Partial<StepState>) => {
      setStepStates((prev) => ({
        ...prev,
        [stepId]: {
          ...prev[stepId],
          ...updates,
        },
      }));
    },
    [],
  );

  // Poll job status
  const startPolling = useCallback(
    (stepId: string, jobId: string) => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      const interval = setInterval(async () => {
        try {
          const res = await fetch(
            `${apiUrl}/api/admin/ml-workflow/job/${jobId}`,
          );
          if (!res.ok) return;

          const data: JobStatusResponse = await res.json();

          if (data.success && data.data) {
            updateStepState(stepId, {
              status: data.data.status,
              progress: data.data.progress,
              error: data.data.error,
            });

            // Stop polling when job is done
            if (
              data.data.status === 'completed' ||
              data.data.status === 'error'
            ) {
              clearInterval(interval);
              delete pollingIntervals.current[stepId];

              if (data.data.status === 'completed') {
                updateStepState(stepId, {
                  lastRunTime: data.data.completedAt || new Date().toISOString(),
                });
                // Store result for display
                if ((data.data as Record<string, unknown>).result) {
                  setLastStepResult((data.data as Record<string, unknown>).result as Record<string, unknown>);
                }
                // Refresh to get output files
                fetchWorkflowStatus();
              }
            }
          }
        } catch (err) {
          console.error('Error polling job status:', err);
        }
      }, 3000); // Poll every 3 seconds

      pollingIntervals.current[stepId] = interval;
    },
    [updateStepState, fetchWorkflowStatus],
  );

  // Run a single step
  const runStep = useCallback(
    async (stepId: string) => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      try {
        // Update UI immediately
        updateStepState(stepId, {
          status: 'running',
          progress: 0,
          error: undefined,
        });

        const res = await fetch(`${apiUrl}/api/admin/ml-workflow/run/${stepId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
          throw new Error('Failed to start step');
        }

        const data: RunStepResponse = await res.json();

        if (data.success && data.data?.jobId) {
          updateStepState(stepId, { jobId: data.data.jobId });
          startPolling(stepId, data.data.jobId);
        } else {
          throw new Error((data as { error?: string }).error || 'Failed to start step');
        }
      } catch (err) {
        console.error(`Error running step ${stepId}:`, err);
        updateStepState(stepId, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Failed to run step',
        });
      }
    },
    [updateStepState, startPolling],
  );

  // Wait for a step to complete
  const waitForStepCompletion = useCallback(
    (stepId: string): Promise<StepStatus> => {
      return new Promise((resolve) => {
        const checkStatus = () => {
          const status = stepStates[stepId]?.status;
          if (status === 'completed' || status === 'error') {
            resolve(status);
          } else {
            setTimeout(checkStatus, 1000);
          }
        };
        checkStatus();
      });
    },
    [stepStates],
  );

  // Run full workflow sequentially
  const runFullWorkflow = useCallback(async () => {
    setIsRunningFullWorkflow(true);
    setError(null);

    for (const step of WORKFLOW_STEPS) {
      // Start the step
      await runStep(step.id);

      // Wait for completion
      const status = await waitForStepCompletion(step.id);

      // Stop if step failed
      if (status === 'error') {
        setError(`Workflow stopped: ${step.name} failed`);
        break;
      }
    }

    setIsRunningFullWorkflow(false);
  }, [runStep, waitForStepCompletion]);

  // Check if any step is currently running
  const hasRunningStep = Object.values(stepStates).some(
    (s) => s.status === 'running',
  );

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="bg-surface-container border-b border-outline-variant">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-on-surface">
                ML Workflow Management
              </h1>
              <p className="mt-1 text-sm text-on-surface-variant">
                Manage PropertyIQ ML optimization pipeline
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* Analytics Service Status */}
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${analyticsHealth ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-xs text-on-surface-variant">
                  Analytics: {analyticsHealth ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <span className="px-3 py-1 text-xs font-medium rounded-full bg-tertiary-container text-on-tertiary-container">
                Admin Access
              </span>
              <button
                onClick={runFullWorkflow}
                disabled={isRunningFullWorkflow || hasRunningStep || !analyticsHealth}
                className={`
                  px-4 py-2 text-sm font-medium rounded-lg transition-colors
                  ${
                    isRunningFullWorkflow || hasRunningStep || !analyticsHealth
                      ? 'bg-surface-container-high text-on-surface-variant cursor-not-allowed'
                      : 'bg-primary text-on-primary hover:bg-primary/90'
                  }
                `}
              >
                {isRunningFullWorkflow ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-on-surface-variant/30 border-t-on-surface-variant rounded-full animate-spin" />
                    Running Workflow...
                  </span>
                ) : (
                  'Run Full Workflow'
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="bg-error-container border-b border-error">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-on-error-container">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-on-error-container hover:text-on-error-container/80"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {WORKFLOW_STEPS.map((step, index) => (
              <WorkflowStepCard
                key={step.id}
                step={step}
                stepNumber={index + 1}
                status={stepStates[step.id]?.status || 'pending'}
                lastRunTime={stepStates[step.id]?.lastRunTime || null}
                progress={stepStates[step.id]?.progress}
                error={stepStates[step.id]?.error}
                outputFiles={stepStates[step.id]?.outputs}
                onRun={() => runStep(step.id)}
                disabled={isRunningFullWorkflow || hasRunningStep || !analyticsHealth}
              />
            ))}
          </div>
        )}

        {/* Last Step Result */}
        {lastStepResult && (
          <div className="mt-6 p-4 bg-surface-container rounded-xl">
            <h2 className="text-sm font-medium text-on-surface mb-2">
              Last Step Result
            </h2>
            <pre className="text-xs text-on-surface-variant bg-surface-container-low p-3 rounded-lg overflow-auto max-h-64">
              {JSON.stringify(lastStepResult, null, 2)}
            </pre>
          </div>
        )}

        {/* How It Works Section */}
        <div className="mt-8 p-6 bg-surface-container-low rounded-xl">
          <h2 className="text-lg font-medium text-on-surface mb-4">
            How It Works
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-on-surface mb-2">Architecture</h3>
              <div className="text-xs text-on-surface-variant space-y-2">
                <p>
                  <strong>Frontend (Vercel)</strong> → <strong>Backend (Railway/NestJS)</strong> → <strong>Analytics (Railway/Python)</strong>
                </p>
                <p>
                  The Analytics microservice processes the full 3.6M+ historical score records using a Parquet-based caching system for fast analysis.
                </p>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-on-surface mb-2">Data Caching Strategy</h3>
              <div className="text-xs text-on-surface-variant space-y-2">
                <p>
                  <strong>Initial sync:</strong> Fetches full dataset using 10,000-record batches to avoid timeouts.
                </p>
                <p>
                  <strong>Incremental updates:</strong> Only fetches new records since last cache update.
                </p>
                <p>
                  <strong>Local Parquet:</strong> Enables millisecond reads for analysis.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Workflow Steps Description */}
        <div className="mt-6 p-6 bg-surface-container-low rounded-xl">
          <h2 className="text-lg font-medium text-on-surface mb-4">
            Workflow Steps
          </h2>
          <div className="space-y-3 text-sm text-on-surface-variant">
            <p>
              <strong>1. Data Export:</strong> Syncs the full historical dataset to local Parquet cache. First run fetches all records; subsequent runs only fetch new data (incremental).
            </p>
            <p>
              <strong>2. Prepare Backtest Data:</strong> Analyzes cached data quality - checks outcome availability (12m, 36m, 60m), score coverage, and date ranges.
            </p>
            <p>
              <strong>3. Calculate Benchmarks:</strong> Computes national averages and geography-specific benchmarks for measuring excess returns against the market.
            </p>
            <p>
              <strong>4. Feature Analysis:</strong> Runs Pearson and Spearman correlation analysis to find which scores (InvestorEdge, HomeReady) best predict actual appreciation.
            </p>
            <p>
              <strong>5. Score Explanations:</strong> Generates statistical distributions with mean, std, percentiles for each score type and geography.
            </p>
            <p>
              <strong>6. Monthly Report:</strong> Produces a comprehensive validation report with confidence metrics and recommendations.
            </p>
          </div>
        </div>

        {/* API Endpoints Documentation */}
        <div className="mt-6 p-6 bg-surface-container-low rounded-xl">
          <h2 className="text-lg font-medium text-on-surface mb-4">
            API Endpoints
          </h2>
          
          <div className="space-y-4">
            {/* Backend Endpoints */}
            <div>
              <h3 className="text-sm font-medium text-on-surface mb-2">Backend (NestJS)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-on-surface-variant">
                  <thead>
                    <tr className="border-b border-outline-variant">
                      <th className="text-left py-2 pr-4 font-medium">Method</th>
                      <th className="text-left py-2 pr-4 font-medium">Endpoint</th>
                      <th className="text-left py-2 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/50">
                    <tr>
                      <td className="py-2 pr-4"><code className="bg-surface-container px-1 rounded">GET</code></td>
                      <td className="py-2 pr-4"><code>/api/admin/ml-workflow/status</code></td>
                      <td className="py-2">Get status of all workflow steps</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4"><code className="bg-surface-container px-1 rounded">GET</code></td>
                      <td className="py-2 pr-4"><code>/api/admin/ml-workflow/health</code></td>
                      <td className="py-2">Check analytics service health</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4"><code className="bg-primary-container text-on-primary-container px-1 rounded">POST</code></td>
                      <td className="py-2 pr-4"><code>/api/admin/ml-workflow/run/:stepId</code></td>
                      <td className="py-2">Run a specific workflow step</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4"><code className="bg-surface-container px-1 rounded">GET</code></td>
                      <td className="py-2 pr-4"><code>/api/admin/ml-workflow/job/:jobId</code></td>
                      <td className="py-2">Get job status by ID</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Analytics Endpoints */}
            <div>
              <h3 className="text-sm font-medium text-on-surface mb-2">Analytics Service (Python FastAPI)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-on-surface-variant">
                  <thead>
                    <tr className="border-b border-outline-variant">
                      <th className="text-left py-2 pr-4 font-medium">Method</th>
                      <th className="text-left py-2 pr-4 font-medium">Endpoint</th>
                      <th className="text-left py-2 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/50">
                    <tr>
                      <td className="py-2 pr-4"><code className="bg-surface-container px-1 rounded">GET</code></td>
                      <td className="py-2 pr-4"><code>/api/v1/health</code></td>
                      <td className="py-2">Health check with version</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4"><code className="bg-surface-container px-1 rounded">GET</code></td>
                      <td className="py-2 pr-4"><code>/api/v1/cache/status</code></td>
                      <td className="py-2">Get cache status for all geography types</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4"><code className="bg-primary-container text-on-primary-container px-1 rounded">POST</code></td>
                      <td className="py-2 pr-4"><code>/api/v1/cache/sync?geo_type=metro</code></td>
                      <td className="py-2">Sync cache (incremental by default)</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4"><code className="bg-primary-container text-on-primary-container px-1 rounded">POST</code></td>
                      <td className="py-2 pr-4"><code>/api/v1/cache/sync?force_full=true</code></td>
                      <td className="py-2">Force full cache refresh</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4"><code className="bg-error-container text-on-error-container px-1 rounded">DELETE</code></td>
                      <td className="py-2 pr-4"><code>/api/v1/cache/clear</code></td>
                      <td className="py-2">Clear all cached data</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4"><code className="bg-primary-container text-on-primary-container px-1 rounded">POST</code></td>
                      <td className="py-2 pr-4"><code>/api/v1/backtest/analyze</code></td>
                      <td className="py-2">Full decile backtest analysis</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4"><code className="bg-surface-container px-1 rounded">GET</code></td>
                      <td className="py-2 pr-4"><code>/api/v1/backtest/status</code></td>
                      <td className="py-2">Data availability status</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4"><code className="bg-primary-container text-on-primary-container px-1 rounded">POST</code></td>
                      <td className="py-2 pr-4"><code>/api/v1/workflow/data-export</code></td>
                      <td className="py-2">Step 1: Sync data to cache</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4"><code className="bg-primary-container text-on-primary-container px-1 rounded">POST</code></td>
                      <td className="py-2 pr-4"><code>/api/v1/workflow/prepare-backtest-data</code></td>
                      <td className="py-2">Step 2: Check data quality</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4"><code className="bg-primary-container text-on-primary-container px-1 rounded">POST</code></td>
                      <td className="py-2 pr-4"><code>/api/v1/workflow/calculate-benchmarks</code></td>
                      <td className="py-2">Step 3: Calculate benchmarks</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4"><code className="bg-primary-container text-on-primary-container px-1 rounded">POST</code></td>
                      <td className="py-2 pr-4"><code>/api/v1/workflow/feature-analysis</code></td>
                      <td className="py-2">Step 4: Correlation analysis</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4"><code className="bg-primary-container text-on-primary-container px-1 rounded">POST</code></td>
                      <td className="py-2 pr-4"><code>/api/v1/workflow/score-explanations</code></td>
                      <td className="py-2">Step 5: Score distributions</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4"><code className="bg-primary-container text-on-primary-container px-1 rounded">POST</code></td>
                      <td className="py-2 pr-4"><code>/api/v1/workflow/monthly-report</code></td>
                      <td className="py-2">Step 6: Generate report</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Materialized Views */}
            <div>
              <h3 className="text-sm font-medium text-on-surface mb-2">Supabase Materialized Views (Option 3)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-on-surface-variant">
                  <thead>
                    <tr className="border-b border-outline-variant">
                      <th className="text-left py-2 pr-4 font-medium">View</th>
                      <th className="text-left py-2 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/50">
                    <tr>
                      <td className="py-2 pr-4"><code>mv_backtest_decile_stats</code></td>
                      <td className="py-2">Pre-aggregated decile statistics by score type, geography, period</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4"><code>mv_backtest_benchmarks</code></td>
                      <td className="py-2">National/regional benchmark returns by period</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4"><code>mv_backtest_summary</code></td>
                      <td className="py-2">Quick status check for data availability</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4"><code>refresh_backtest_views()</code></td>
                      <td className="py-2">Function to refresh all views after data imports</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Environment Variables */}
        <div className="mt-6 p-6 bg-surface-container-low rounded-xl">
          <h2 className="text-lg font-medium text-on-surface mb-4">
            Configuration
          </h2>
          <div className="text-xs text-on-surface-variant space-y-2">
            <p><code className="bg-surface-container px-1 rounded">ANALYTICS_SERVICE_URL</code> - URL of Analytics microservice (default: http://localhost:8000)</p>
            <p><code className="bg-surface-container px-1 rounded">SUPABASE_URL</code> - Supabase project URL</p>
            <p><code className="bg-surface-container px-1 rounded">SUPABASE_SERVICE_KEY</code> - Supabase service role key</p>
            <p><code className="bg-surface-container px-1 rounded">CACHE_DIR</code> - Parquet cache directory (default: /data/cache)</p>
          </div>
        </div>
      </main>
    </div>
  );
}
