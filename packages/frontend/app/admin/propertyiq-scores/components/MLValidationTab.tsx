/**
 * MLValidationTab Component
 *
 * Compare formula-based scores against AutoGluon ML predictions.
 * Shows performance comparison, feature importance, and suggested weights.
 *
 * Material Design 3 compliant.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchAPIRaw } from '@/lib/data';

interface MLValidationConfig {
  scoreType: 'homeready' | 'investoredge' | 'market_health';
  geographyType: 'metro' | 'county' | 'zip';
  horizon: '6m' | '1y' | '3y' | '5y';
  trainPeriodStart: string;
  trainPeriodEnd: string;
  testPeriodStart: string;
  testPeriodEnd: string;
  mlPreset: 'medium_quality' | 'best_quality' | 'high_quality';
  timeLimitSeconds: number;
}

interface FeatureImportance {
  feature: string;
  importance: number;
  currentWeight: number | null;
  component: string | null;
  status: 'aligned' | 'missing' | 'overweight' | 'underweight';
}

interface WeightSuggestion {
  component: string;
  currentWeight: number;
  suggestedWeight: number;
  change: number;
  rationale: string;
}

interface MetricSuggestion {
  metric: string;
  mlImportance: number;
  suggestedComponent: string;
  rationale: string;
}

interface SubgroupSegment {
  name: string;
  formulaR2: number;
  mlR2: number;
  gap: number;
  sampleSize: number;
  status: 'ok' | 'review' | 'action_required';
}

interface SubgroupAnalysis {
  dimension: string;
  segments: SubgroupSegment[];
}

interface LeaderboardEntry {
  rank: number;
  model: string;
  score: number;
  predictTime: number;
  fitTime: number;
}

interface MLValidationResult {
  id: string;
  scoreType: string;
  geographyType: string;
  horizon: string;
  formulaR2: number | null;
  formulaDirectionalAccuracy: number | null;
  formulaMae: number | null;
  formulaRmse: number | null;
  formulaQuintileSpread: number | null;
  mlR2: number | null;
  mlDirectionalAccuracy: number | null;
  mlMae: number | null;
  mlRmse: number | null;
  mlQuintileSpread: number | null;
  featureImportance: FeatureImportance[];
  suggestedWeights: WeightSuggestion[];
  suggestedMetrics: MetricSuggestion[];
  subgroupAnalysis: SubgroupAnalysis[];
  mlLeaderboard: LeaderboardEntry[];
  trainingTimeSeconds: number | null;
  testSamples: number | null;
  featuresUsed: number | null;
  status: 'ok' | 'review' | 'action_required';
  createdAt: string;
}

interface JobStatus {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  result: { validationId?: string } | null;
  error: string | null;
}

const DEFAULT_CONFIG: MLValidationConfig = {
  scoreType: 'homeready',
  geographyType: 'metro',
  horizon: '1y',
  trainPeriodStart: '2019-01-01',
  trainPeriodEnd: '2023-12-31',
  testPeriodStart: '2024-01-01',
  testPeriodEnd: '2024-12-31',
  mlPreset: 'best_quality',
  timeLimitSeconds: 300,
};

export function MLValidationTab() {
  const [config, setConfig] = useState<MLValidationConfig>(DEFAULT_CONFIG);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [result, setResult] = useState<MLValidationResult | null>(null);
  const [previousResults, setPreviousResults] = useState<MLValidationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch previous results on mount
  useEffect(() => {
    fetchPreviousResults();
  }, []);

  // Poll for job status when job is running
  useEffect(() => {
    if (!jobId) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetchAPIRaw(`/api/admin/ml-validation/status/${jobId}`, {
          credentials: 'include',
        });

        if (response.ok) {
          const status: JobStatus = await response.json();
          setJobStatus(status);

          if (status.status === 'completed' && status.result?.validationId) {
            clearInterval(interval);
            setJobId(null);
            // Fetch the full result
            await fetchValidationResult(status.result.validationId);
            await fetchPreviousResults();
          } else if (status.status === 'failed') {
            clearInterval(interval);
            setJobId(null);
            setError(status.error || 'ML Validation failed');
          }
        }
      } catch (err) {
        console.error('Error polling job status:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [jobId]);

  const fetchPreviousResults = async () => {
    try {
      const response = await fetchAPIRaw(`/api/admin/ml-validation/results?limit=10`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setPreviousResults(data.validations || []);
      }
    } catch (err) {
      console.error('Error fetching previous results:', err);
    }
  };

  const fetchValidationResult = async (validationId: string) => {
    try {
      const response = await fetchAPIRaw(`/api/admin/ml-validation/${validationId}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setResult(data);
      }
    } catch (err) {
      console.error('Error fetching validation result:', err);
    }
  };

  const runValidation = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetchAPIRaw(`/api/admin/ml-validation/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(config),
      });

      if (response.ok) {
        const data = await response.json();
        setJobId(data.jobId);
        setJobStatus({ id: data.jobId, status: 'queued', progress: 0, result: null, error: null });
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to start ML validation');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const applySuggestions = async (applyWeights: boolean, applyMetrics: boolean) => {
    if (!result) return;

    try {
      const response = await fetchAPIRaw(`/api/admin/ml-validation/apply-suggestions/${result.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ applyWeights, applyMetrics }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Draft formula created: ${data.draftVersion}`);
      } else {
        alert('Failed to apply suggestions');
      }
    } catch (err) {
      alert('Failed to apply suggestions');
    }
  };

  const getGapStatus = (formulaValue: number | null, mlValue: number | null): string => {
    if (formulaValue === null || mlValue === null) return '';
    const gap = mlValue - formulaValue;
    const relativeGap = gap / Math.max(formulaValue, 0.01);

    if (relativeGap > 0.25) return 'action_required';
    if (relativeGap > 0.10) return 'review';
    return 'ok';
  };

  const formatMetricValue = (value: number | null, isPercent = false): string => {
    if (value === null) return '--';
    return isPercent ? `${(value * 100).toFixed(1)}%` : value.toFixed(4);
  };

  return (
    <div className="space-y-6">
      {/* Settings Panel */}
      <div className="bg-surface-container rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-on-surface">ML Validation Settings</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-on-surface-variant mb-1">Score Type</label>
            <select
              value={config.scoreType}
              onChange={(e) => setConfig({ ...config, scoreType: e.target.value as MLValidationConfig['scoreType'] })}
              className="w-full px-3 py-2 rounded-lg border border-outline bg-surface text-on-surface"
            >
              <option value="homeready">HomeReady</option>
              <option value="investoredge">InvestorEdge</option>
              <option value="market_health">Market Health</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-on-surface-variant mb-1">Geography</label>
            <select
              value={config.geographyType}
              onChange={(e) => setConfig({ ...config, geographyType: e.target.value as MLValidationConfig['geographyType'] })}
              className="w-full px-3 py-2 rounded-lg border border-outline bg-surface text-on-surface"
            >
              <option value="metro">Metro</option>
              <option value="county">County</option>
              <option value="zip">ZIP</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-on-surface-variant mb-1">Horizon</label>
            <select
              value={config.horizon}
              onChange={(e) => setConfig({ ...config, horizon: e.target.value as MLValidationConfig['horizon'] })}
              className="w-full px-3 py-2 rounded-lg border border-outline bg-surface text-on-surface"
            >
              <option value="6m">6 Months</option>
              <option value="1y">1 Year</option>
              <option value="3y">3 Years</option>
              <option value="5y">5 Years</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-on-surface-variant mb-1">ML Preset</label>
            <select
              value={config.mlPreset}
              onChange={(e) => setConfig({ ...config, mlPreset: e.target.value as MLValidationConfig['mlPreset'] })}
              className="w-full px-3 py-2 rounded-lg border border-outline bg-surface text-on-surface"
            >
              <option value="medium_quality">Medium Quality (faster)</option>
              <option value="best_quality">Best Quality</option>
              <option value="high_quality">High Quality</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-on-surface-variant mb-1">Training Start</label>
            <input
              type="date"
              value={config.trainPeriodStart}
              onChange={(e) => setConfig({ ...config, trainPeriodStart: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-outline bg-surface text-on-surface"
            />
          </div>

          <div>
            <label className="block text-sm text-on-surface-variant mb-1">Training End</label>
            <input
              type="date"
              value={config.trainPeriodEnd}
              onChange={(e) => setConfig({ ...config, trainPeriodEnd: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-outline bg-surface text-on-surface"
            />
          </div>

          <div>
            <label className="block text-sm text-on-surface-variant mb-1">Test Start</label>
            <input
              type="date"
              value={config.testPeriodStart}
              onChange={(e) => setConfig({ ...config, testPeriodStart: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-outline bg-surface text-on-surface"
            />
          </div>

          <div>
            <label className="block text-sm text-on-surface-variant mb-1">Test End</label>
            <input
              type="date"
              value={config.testPeriodEnd}
              onChange={(e) => setConfig({ ...config, testPeriodEnd: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-outline bg-surface text-on-surface"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 pt-2">
          <button
            onClick={runValidation}
            disabled={loading || !!jobId}
            className="px-6 py-2 rounded-lg bg-primary text-on-primary font-medium disabled:opacity-50"
          >
            {loading ? 'Starting...' : jobId ? 'Running...' : 'Run ML Validation'}
          </button>

          {previousResults.length > 0 && (
            <select
              onChange={(e) => {
                if (e.target.value) {
                  fetchValidationResult(e.target.value);
                }
              }}
              className="px-3 py-2 rounded-lg border border-outline bg-surface text-on-surface"
            >
              <option value="">Load Previous Results</option>
              {previousResults.map((r) => (
                <option key={r.id} value={r.id}>
                  {formatScoreType(r.scoreType)} @ {r.geographyType} @ {r.horizon} ({new Date(r.createdAt).toLocaleDateString()})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Job Status */}
      {jobStatus && jobStatus.status !== 'completed' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
            <div>
              <p className="font-medium text-blue-900">
                ML Validation {jobStatus.status === 'running' ? 'running' : 'queued'}...
              </p>
              <p className="text-sm text-blue-700">
                Progress: {jobStatus.progress.toFixed(0)}% | Job ID: {jobStatus.id.slice(0, 8)}...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Performance Comparison */}
          <PerformanceComparison result={result} />

          {/* Feature Importance */}
          <FeatureImportanceTable
            featureImportance={result.featureImportance}
            scoreType={result.scoreType}
          />

          {/* Suggested Weights */}
          {result.suggestedWeights.length > 0 && (
            <SuggestedWeights
              weights={result.suggestedWeights}
              metrics={result.suggestedMetrics}
              onApply={applySuggestions}
            />
          )}

          {/* Subgroup Analysis */}
          {result.subgroupAnalysis.length > 0 && (
            <SubgroupAnalysisTable analysis={result.subgroupAnalysis} />
          )}

          {/* ML Leaderboard */}
          {result.mlLeaderboard.length > 0 && (
            <MLLeaderboard leaderboard={result.mlLeaderboard} trainingTime={result.trainingTimeSeconds} />
          )}
        </>
      )}
    </div>
  );
}

function PerformanceComparison({ result }: { result: MLValidationResult }) {
  const metrics = [
    { name: 'R²', formula: result.formulaR2, ml: result.mlR2, format: 'decimal' },
    { name: 'Directional Accuracy', formula: result.formulaDirectionalAccuracy, ml: result.mlDirectionalAccuracy, format: 'percent' },
    { name: 'MAE', formula: result.formulaMae, ml: result.mlMae, format: 'percent', invert: true },
    { name: 'RMSE', formula: result.formulaRmse, ml: result.mlRmse, format: 'percent', invert: true },
    { name: 'Quintile Spread', formula: result.formulaQuintileSpread, ml: result.mlQuintileSpread, format: 'percent' },
  ];

  const getGapColor = (gap: number, invert = false) => {
    const adjustedGap = invert ? -gap : gap;
    if (adjustedGap > 0.02) return 'text-red-600';
    if (adjustedGap > 0.01) return 'text-amber-600';
    return 'text-green-600';
  };

  const statusColors = {
    ok: 'bg-green-100 text-green-800',
    review: 'bg-amber-100 text-amber-800',
    action_required: 'bg-red-100 text-red-800',
  };

  return (
    <div className="bg-surface-container rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-on-surface">
          Formula vs ML Performance
        </h3>
        <span className={`text-sm px-3 py-1 rounded-full ${statusColors[result.status]}`}>
          {result.status === 'ok' ? 'Healthy' : result.status === 'review' ? 'Review Needed' : 'Action Required'}
        </span>
      </div>

      <p className="text-sm text-on-surface-variant mb-4">
        {formatScoreType(result.scoreType)} @ {result.geographyType.toUpperCase()} @ {result.horizon} Horizon
      </p>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-outline-variant">
              <th className="text-left py-2 text-sm text-on-surface-variant">Metric</th>
              <th className="text-right py-2 text-sm text-on-surface-variant">Your Formula</th>
              <th className="text-right py-2 text-sm text-on-surface-variant">AutoGluon ML</th>
              <th className="text-right py-2 text-sm text-on-surface-variant">Gap</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => {
              const gap = (m.ml || 0) - (m.formula || 0);
              const formatValue = (v: number | null) => {
                if (v === null) return '--';
                return m.format === 'percent' ? `${(v * 100).toFixed(1)}%` : v.toFixed(4);
              };
              return (
                <tr key={m.name} className="border-b border-outline-variant/50">
                  <td className="py-3 text-on-surface">{m.name}</td>
                  <td className="py-3 text-right font-mono text-on-surface">{formatValue(m.formula)}</td>
                  <td className="py-3 text-right font-mono text-on-surface">{formatValue(m.ml)}</td>
                  <td className={`py-3 text-right font-mono ${getGapColor(gap, m.invert)}`}>
                    {gap >= 0 ? '+' : ''}{m.format === 'percent' ? `${(gap * 100).toFixed(1)}%` : gap.toFixed(4)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-on-surface-variant">
        <p>Gap Thresholds: OK (&lt;10% relative) | Review (10-25% relative) | Action Required (&gt;25% relative)</p>
        <p className="mt-1">Test Samples: {result.testSamples?.toLocaleString()} | Features: {result.featuresUsed} | Training Time: {result.trainingTimeSeconds?.toFixed(0)}s</p>
      </div>
    </div>
  );
}

function FeatureImportanceTable({
  featureImportance,
  scoreType,
}: {
  featureImportance: FeatureImportance[];
  scoreType: string;
}) {
  const statusColors = {
    aligned: 'bg-green-100 text-green-800',
    missing: 'bg-amber-100 text-amber-800',
    overweight: 'bg-blue-100 text-blue-800',
    underweight: 'bg-orange-100 text-orange-800',
  };

  return (
    <div className="bg-surface-container rounded-xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4">
        ML Feature Importance vs Your Weights
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant">
              <th className="text-left py-2 text-on-surface-variant">Rank</th>
              <th className="text-left py-2 text-on-surface-variant">Feature</th>
              <th className="text-right py-2 text-on-surface-variant">ML Importance</th>
              <th className="text-right py-2 text-on-surface-variant">Your Weight</th>
              <th className="text-left py-2 text-on-surface-variant">Component</th>
              <th className="text-left py-2 text-on-surface-variant">Status</th>
            </tr>
          </thead>
          <tbody>
            {featureImportance.slice(0, 15).map((fi, i) => (
              <tr key={fi.feature} className="border-b border-outline-variant/50">
                <td className="py-2 text-on-surface-variant">{i + 1}</td>
                <td className="py-2 text-on-surface font-mono">{fi.feature}</td>
                <td className="py-2 text-right font-mono text-on-surface">
                  {(fi.importance * 100).toFixed(1)}%
                </td>
                <td className="py-2 text-right font-mono text-on-surface">
                  {fi.currentWeight !== null ? `${(fi.currentWeight * 100).toFixed(1)}%` : '--'}
                </td>
                <td className="py-2 text-on-surface-variant capitalize">
                  {fi.component?.replace('_', ' ') || '--'}
                </td>
                <td className="py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[fi.status]}`}>
                    {fi.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-on-surface-variant">
        <p>Aligned = Weight matches ML importance | Missing = Not in formula | Overweight/Underweight = Weight vs ML mismatch</p>
      </div>
    </div>
  );
}

function SuggestedWeights({
  weights,
  metrics,
  onApply,
}: {
  weights: WeightSuggestion[];
  metrics: MetricSuggestion[];
  onApply: (applyWeights: boolean, applyMetrics: boolean) => void;
}) {
  return (
    <div className="bg-surface-container rounded-xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4">
        ML Suggested Adjustments
      </h3>

      {weights.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-on-surface-variant mb-2">Weight Changes</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant">
                  <th className="text-left py-2 text-on-surface-variant">Component</th>
                  <th className="text-right py-2 text-on-surface-variant">Current</th>
                  <th className="text-right py-2 text-on-surface-variant">Suggested</th>
                  <th className="text-right py-2 text-on-surface-variant">Change</th>
                  <th className="text-left py-2 text-on-surface-variant">Rationale</th>
                </tr>
              </thead>
              <tbody>
                {weights.map((w) => (
                  <tr key={w.component} className="border-b border-outline-variant/50">
                    <td className="py-2 text-on-surface capitalize">{w.component.replace('_', ' ')}</td>
                    <td className="py-2 text-right font-mono text-on-surface">{(w.currentWeight * 100).toFixed(0)}%</td>
                    <td className="py-2 text-right font-mono text-on-surface">{(w.suggestedWeight * 100).toFixed(0)}%</td>
                    <td className={`py-2 text-right font-mono ${w.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {w.change >= 0 ? '+' : ''}{(w.change * 100).toFixed(0)}%
                    </td>
                    <td className="py-2 text-on-surface-variant">{w.rationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {metrics.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-on-surface-variant mb-2">Metrics to Consider Adding</h4>
          <div className="space-y-2">
            {metrics.map((m) => (
              <div key={m.metric} className="p-3 rounded-lg bg-surface-container-low">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-on-surface">{m.metric}</span>
                  <span className="text-sm text-on-surface-variant">
                    ML importance: {(m.mlImportance * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="text-sm text-on-surface-variant mt-1">
                  Suggested for: {m.suggestedComponent.replace('_', ' ')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => onApply(true, false)}
          className="px-4 py-2 text-sm rounded-lg bg-primary text-on-primary"
        >
          Apply Weight Changes
        </button>
        <button
          onClick={() => onApply(true, true)}
          className="px-4 py-2 text-sm rounded-lg bg-secondary text-on-secondary"
        >
          Apply All Suggestions
        </button>
      </div>
    </div>
  );
}

function SubgroupAnalysisTable({ analysis }: { analysis: SubgroupAnalysis[] }) {
  const statusColors = {
    ok: 'text-green-600',
    review: 'text-amber-600',
    action_required: 'text-red-600',
  };

  return (
    <div className="bg-surface-container rounded-xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4">
        Subgroup Performance Analysis
      </h3>

      {analysis.map((group) => (
        <div key={group.dimension} className="mb-6 last:mb-0">
          <h4 className="text-sm font-medium text-on-surface-variant mb-2 capitalize">
            By {group.dimension.replace('_', ' ')}
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant">
                  <th className="text-left py-2 text-on-surface-variant">Segment</th>
                  <th className="text-right py-2 text-on-surface-variant">Formula R²</th>
                  <th className="text-right py-2 text-on-surface-variant">ML R²</th>
                  <th className="text-right py-2 text-on-surface-variant">Gap</th>
                  <th className="text-right py-2 text-on-surface-variant">Samples</th>
                </tr>
              </thead>
              <tbody>
                {group.segments.map((seg) => (
                  <tr key={seg.name} className="border-b border-outline-variant/50">
                    <td className="py-2 text-on-surface capitalize">{seg.name.replace('_', ' ')}</td>
                    <td className="py-2 text-right font-mono text-on-surface">{seg.formulaR2.toFixed(4)}</td>
                    <td className="py-2 text-right font-mono text-on-surface">{seg.mlR2.toFixed(4)}</td>
                    <td className={`py-2 text-right font-mono ${statusColors[seg.status]}`}>
                      {seg.gap >= 0 ? '+' : ''}{seg.gap.toFixed(4)}
                    </td>
                    <td className="py-2 text-right text-on-surface-variant">{seg.sampleSize.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function MLLeaderboard({
  leaderboard,
  trainingTime,
}: {
  leaderboard: LeaderboardEntry[];
  trainingTime: number | null;
}) {
  return (
    <div className="bg-surface-container rounded-xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4">
        AutoGluon Model Leaderboard
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant">
              <th className="text-left py-2 text-on-surface-variant">Rank</th>
              <th className="text-left py-2 text-on-surface-variant">Model</th>
              <th className="text-right py-2 text-on-surface-variant">Score (R²)</th>
              <th className="text-right py-2 text-on-surface-variant">Pred Time</th>
              <th className="text-right py-2 text-on-surface-variant">Fit Time</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((entry) => (
              <tr key={entry.model} className="border-b border-outline-variant/50">
                <td className="py-2 text-on-surface">{entry.rank}</td>
                <td className="py-2 text-on-surface font-mono">{entry.model}</td>
                <td className="py-2 text-right font-mono text-on-surface">{entry.score.toFixed(4)}</td>
                <td className="py-2 text-right text-on-surface-variant">{entry.predictTime.toFixed(2)}s</td>
                <td className="py-2 text-right text-on-surface-variant">{entry.fitTime.toFixed(0)}s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-on-surface-variant">
        Total Training Time: {trainingTime?.toFixed(0)}s
      </div>
    </div>
  );
}

function formatScoreType(type: string): string {
  const labels: Record<string, string> = {
    market_health: 'Market Health',
    homeready: 'HomeReady',
    investoredge: 'InvestorEdge',
  };
  return labels[type] || type;
}
