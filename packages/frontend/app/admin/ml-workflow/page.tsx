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
 *
 * STATELESS: Each page refresh starts fresh with all steps in pending state.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { WorkflowStepCard } from './components/WorkflowStepCard';
import {
  WorkflowStep,
  StepState,
  StepStatus,
  RunStepResponse,
} from './types';

// 6 workflow steps with full details
const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: 'data-export',
    name: 'Data Export',
    description: 'Sync full dataset to local Parquet cache for fast analysis',
    script: 'data_cache.sync_all()',
    outputs: [
      'metro: ~900K records',
      'county: ~1.5M records',
      'zip: ~1M records',
      'state: ~200K records',
    ],
    estimatedTime: '5-15 min',
  },
  {
    id: 'prepare-backtest-data',
    name: 'Prepare Backtest Data',
    description:
      'Analyze cached data for completeness and quality metrics',
    script: 'workflow_service.run_prepare_backtest_data()',
    outputs: [
      'outcome_coverage (12m/36m/60m %)',
      'valid_records by geography',
      'date_range coverage',
      'score_coverage %',
    ],
    estimatedTime: '1-2 min',
  },
  {
    id: 'calculate-benchmarks',
    name: 'Calculate Benchmarks',
    description:
      'Compute national, regional, and peer group benchmarks from full dataset',
    script: 'workflow_service.run_calculate_benchmarks()',
    outputs: [
      'national_benchmarks (12m/36m/60m)',
      'metro_benchmarks by region',
      'county_benchmarks by state',
      'benchmark_periods analyzed',
    ],
    estimatedTime: '2-5 min',
  },
  {
    id: 'feature-analysis',
    name: 'Feature Analysis',
    description: 'Correlation analysis to find which scores best predict outcomes',
    script: 'workflow_service.run_feature_analysis()',
    outputs: [
      'pearson_r by score type',
      'spearman_r by score type',
      'best_predictor identification',
      'correlations by geography',
    ],
    estimatedTime: '3-10 min',
  },
  {
    id: 'score-explanations',
    name: 'Score Explanations',
    description:
      'Generate statistical distributions and percentile breakdowns',
    script: 'workflow_service.run_score_explanations()',
    outputs: [
      'investoredge_score distribution',
      'homeready_score distribution',
      'percentiles (10/25/75/90)',
      'distributions by geography',
    ],
    estimatedTime: '2-5 min',
  },
  {
    id: 'monthly-report',
    name: 'Monthly Report',
    description:
      'Generate formula health report with validation metrics',
    script: 'workflow_service.run_monthly_report()',
    outputs: [
      'validation: pass/fail by score',
      'confidence_grade (A-F)',
      'decile spread analysis',
      'excess return verification',
    ],
    estimatedTime: '2-5 min',
    viewable: true,
  },
];

// Fresh step states - always start clean
function createFreshStepStates(): Record<string, StepState> {
  return {
    'data-export': { status: 'pending', lastRunTime: null },
    'prepare-backtest-data': { status: 'pending', lastRunTime: null },
    'calculate-benchmarks': { status: 'pending', lastRunTime: null },
    'feature-analysis': { status: 'pending', lastRunTime: null },
    'score-explanations': { status: 'pending', lastRunTime: null },
    'monthly-report': { status: 'pending', lastRunTime: null },
  };
}

interface AnalyticsHealth {
  status: string;
  service: string;
  version: string;
  timestamp: string;
}

export default function MLWorkflowPage() {
  // Always start fresh - no loading of previous state
  const [stepStates, setStepStates] = useState<Record<string, StepState>>(createFreshStepStates);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRunningFullWorkflow, setIsRunningFullWorkflow] = useState(false);
  const [analyticsHealth, setAnalyticsHealth] = useState<AnalyticsHealth | null>(null);
  const [lastStepResult, setLastStepResult] = useState<Record<string, unknown> | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);

  // Track active polling
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

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
      } else {
        setAnalyticsHealth(null);
      }
    } catch (err) {
      console.error('Error fetching analytics health:', err);
      setAnalyticsHealth(null);
    }
  }, []);

  // Check health on mount and periodically
  useEffect(() => {
    fetchAnalyticsHealth();
    const interval = setInterval(fetchAnalyticsHealth, 15000);
    return () => clearInterval(interval);
  }, [fetchAnalyticsHealth]);

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

  // Run a single step and wait for completion
  const runStepAndWait = useCallback(
    async (stepId: string): Promise<{ success: boolean; result?: Record<string, unknown>; error?: string }> => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      // Update UI - running
      updateStepState(stepId, {
        status: 'running',
        progress: 0,
        error: undefined,
      });

      try {
        // Start the step
        const res = await fetch(`${apiUrl}/api/admin/ml-workflow/run/${stepId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errorText}`);
        }

        const data: RunStepResponse = await res.json();

        if (!data.success) {
          throw new Error((data as { error?: string }).error || 'Step failed to start');
        }

        const jobId = data.data?.jobId;
        if (!jobId) {
          throw new Error('No job ID returned');
        }

        // Poll for completion
        let attempts = 0;
        const maxAttempts = 300; // 5 minutes max (1 second intervals)

        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;

          try {
            const jobRes = await fetch(`${apiUrl}/api/admin/ml-workflow/job/${jobId}`);
            if (!jobRes.ok) continue;

            const jobData = await jobRes.json();

            if (jobData.success && jobData.data) {
              const { status, progress, error: jobError, result } = jobData.data;

              // Update progress
              if (progress !== undefined) {
                updateStepState(stepId, { progress });
              }

              if (status === 'completed') {
                updateStepState(stepId, {
                  status: 'completed',
                  lastRunTime: new Date().toISOString(),
                  progress: 100,
                });
                return { success: true, result };
              }

              if (status === 'error' || status === 'failed') {
                updateStepState(stepId, {
                  status: 'error',
                  error: jobError || 'Step failed',
                });
                return { success: false, error: jobError || 'Step failed' };
              }
            }
          } catch (pollErr) {
            console.error('Poll error:', pollErr);
          }
        }

        // Timeout
        updateStepState(stepId, {
          status: 'error',
          error: 'Step timed out after 5 minutes',
        });
        return { success: false, error: 'Step timed out' };

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        updateStepState(stepId, {
          status: 'error',
          error: errorMsg,
        });
        return { success: false, error: errorMsg };
      }
    },
    [updateStepState],
  );

  // Run full workflow sequentially
  const runFullWorkflow = useCallback(async () => {
    // Reset everything first
    setStepStates(createFreshStepStates());
    setError(null);
    setLastStepResult(null);
    setIsRunningFullWorkflow(true);
    setCurrentStepIndex(0);

    for (let i = 0; i < WORKFLOW_STEPS.length; i++) {
      const step = WORKFLOW_STEPS[i];
      setCurrentStepIndex(i);

      const { success, result, error: stepError } = await runStepAndWait(step.id);

      if (result) {
        setLastStepResult(result);
      }

      if (!success) {
        setError(`Workflow stopped at step ${i + 1}: ${step.name} - ${stepError}`);
        break;
      }
    }

    setIsRunningFullWorkflow(false);
    setCurrentStepIndex(-1);
  }, [runStepAndWait]);

  // Run a single step (manual)
  const runSingleStep = useCallback(async (stepId: string) => {
    setError(null);
    const { result, error: stepError } = await runStepAndWait(stepId);
    
    if (result) {
      setLastStepResult(result);
    }
    
    if (stepError) {
      setError(`Step failed: ${stepError}`);
    }
  }, [runStepAndWait]);

  // Reset all states
  const resetWorkflow = useCallback(() => {
    setStepStates(createFreshStepStates());
    setError(null);
    setLastStepResult(null);
    setIsRunningFullWorkflow(false);
    setCurrentStepIndex(-1);
  }, []);

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
                onClick={resetWorkflow}
                disabled={isRunningFullWorkflow}
                className="px-3 py-2 text-sm font-medium rounded-lg border border-outline-variant text-on-surface hover:bg-surface-container disabled:opacity-50"
              >
                Reset
              </button>
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
                    Running Step {currentStepIndex + 1}/{WORKFLOW_STEPS.length}...
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
              onRun={() => runSingleStep(step.id)}
              disabled={isRunningFullWorkflow || hasRunningStep || !analyticsHealth}
            />
          ))}
        </div>

        {/* Last Step Result */}
        {lastStepResult && (
          <div className="mt-6 p-4 bg-surface-container rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-medium text-on-surface">
                Last Step Result
              </h2>
              <button
                onClick={() => setLastStepResult(null)}
                className="text-xs text-on-surface-variant hover:text-on-surface"
              >
                Clear
              </button>
            </div>
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
                  <strong>Initial sync:</strong> Fetches full dataset using 1,000-record batches (Supabase row limit).
                </p>
                <p>
                  <strong>Incremental updates:</strong> Only fetches new records since last cache update.
                </p>
                <p>
                  <strong>Auto-recovery:</strong> Detects incomplete caches and forces full refresh.
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
                      <td className="py-2 pr-4"><code>/api/v1/cache/sync</code></td>
                      <td className="py-2">Sync cache (incremental by default)</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4"><code className="bg-primary-container text-on-primary-container px-1 rounded">POST</code></td>
                      <td className="py-2 pr-4"><code>/api/v1/backtest/analyze</code></td>
                      <td className="py-2">Full decile backtest analysis</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4"><code className="bg-primary-container text-on-primary-container px-1 rounded">POST</code></td>
                      <td className="py-2 pr-4"><code>/api/v1/workflow/:stepId</code></td>
                      <td className="py-2">Run workflow step (data-export, calculate-benchmarks, etc.)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Configuration */}
        <div className="mt-6 p-6 bg-surface-container-low rounded-xl">
          <h2 className="text-lg font-medium text-on-surface mb-4">
            Configuration
          </h2>
          <div className="text-xs text-on-surface-variant space-y-2">
            <p><code className="bg-surface-container px-1 rounded">ANALYTICS_SERVICE_URL</code> - URL of Analytics microservice (default: http://localhost:8000)</p>
            <p><code className="bg-surface-container px-1 rounded">SUPABASE_URL</code> - Supabase project URL</p>
            <p><code className="bg-surface-container px-1 rounded">SUPABASE_SERVICE_KEY</code> - Supabase service role key</p>
            <p><code className="bg-surface-container px-1 rounded">CACHE_DIR</code> - Parquet cache directory (default: /tmp/propertyiq-cache)</p>
          </div>
        </div>
      </main>
    </div>
  );
}
