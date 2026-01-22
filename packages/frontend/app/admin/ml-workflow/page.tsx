/**
 * ML Workflow Admin Page
 *
 * Manages PropertyIQ ML workflow steps:
 * 1. Data Export - Export data to Parquet files
 * 2. Calculate Benchmarks - Compute national/regional/peer benchmarks
 * 3. Feature Analysis - AutoGluon feature importance
 * 4. Score Explanations - SHAP explanations
 * 5. Monthly Report - Formula health report
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
    description: 'Export data to Parquet files for ML processing',
    script: 'export_backtest_data.py',
    outputs: [
      'geographies.parquet',
      'zillow_historical.parquet',
      'census_latest.parquet',
      'economic.parquet',
    ],
    estimatedTime: '5-10 min',
  },
  {
    id: 'prepare-backtest-data',
    name: 'Prepare Backtest Data',
    description:
      'Create backtest dataset with historical scores and actual outcomes',
    script: 'prepare_backtest_data.py',
    outputs: ['backtest_data.parquet'],
    estimatedTime: '3-5 min',
  },
  {
    id: 'calculate-benchmarks',
    name: 'Calculate Benchmarks',
    description:
      'Compute national, regional, and peer group benchmarks for excess returns',
    script: 'calculate_benchmarks.py',
    outputs: [
      'backtest_with_benchmarks.parquet',
      'benchmarks_national.parquet',
      'benchmarks_regional.parquet',
      'benchmarks_peer.parquet',
    ],
    estimatedTime: '2-5 min',
  },
  {
    id: 'feature-analysis',
    name: 'Feature Analysis (AutoGluon)',
    description: 'ML-based feature importance and optimal weight suggestions',
    script: 'find_optimal_weights.py',
    outputs: ['feature_importance_YYYYMMDD.csv', 'models/autogluon_YYYYMMDD/'],
    estimatedTime: '10-30 min',
  },
  {
    id: 'score-explanations',
    name: 'Score Explanations (SHAP)',
    description:
      'Generate SHAP explanations showing why each score is what it is',
    script: 'generate_shap_explanations.py',
    outputs: ['explanations_YYYYMMDD.json'],
    estimatedTime: '5-15 min',
  },
  {
    id: 'monthly-report',
    name: 'Monthly Report',
    description:
      'Generate formula health report with confidence matrix and recommendations',
    script: 'generate_monthly_report.py',
    outputs: ['monthly_report_YYYY-MM.json', 'monthly_report_YYYY-MM.html'],
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

export default function MLWorkflowPage() {
  const [stepStates, setStepStates] =
    useState<Record<string, StepState>>(DEFAULT_STEP_STATES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRunningFullWorkflow, setIsRunningFullWorkflow] = useState(false);

  // Track polling intervals for cleanup
  const pollingIntervals = useRef<Record<string, NodeJS.Timeout>>({});

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
      // Don't show error on initial load - just use default states
      // setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch status on mount
  useEffect(() => {
    fetchWorkflowStatus();

    // Cleanup polling intervals on unmount
    return () => {
      Object.values(pollingIntervals.current).forEach(clearInterval);
    };
  }, [fetchWorkflowStatus]);

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
          throw new Error(data.error || 'Failed to start step');
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
              <span className="px-3 py-1 text-xs font-medium rounded-full bg-tertiary-container text-on-tertiary-container">
                Admin Access
              </span>
              <button
                onClick={runFullWorkflow}
                disabled={isRunningFullWorkflow || hasRunningStep}
                className={`
                  px-4 py-2 text-sm font-medium rounded-lg transition-colors
                  ${
                    isRunningFullWorkflow || hasRunningStep
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
                disabled={isRunningFullWorkflow || hasRunningStep}
              />
            ))}
          </div>
        )}

        {/* Info Section */}
        <div className="mt-8 p-4 bg-surface-container-low rounded-xl">
          <h2 className="text-sm font-medium text-on-surface mb-2">
            About This Workflow
          </h2>
          <div className="text-xs text-on-surface-variant space-y-1">
            <p>
              <strong>Data Export:</strong> Exports database data to Parquet
              files for fast ML processing.
            </p>
            <p>
              <strong>Benchmarks:</strong> Calculates national, regional, and
              peer group benchmarks for measuring excess returns.
            </p>
            <p>
              <strong>Feature Analysis:</strong> Uses AutoGluon to find which
              metrics best predict outcomes and suggests optimal formula
              weights.
            </p>
            <p>
              <strong>SHAP Explanations:</strong> Generates human-readable
              explanations for why each score is what it is.
            </p>
            <p>
              <strong>Monthly Report:</strong> Produces a comprehensive formula
              health report with confidence metrics and recommendations.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
