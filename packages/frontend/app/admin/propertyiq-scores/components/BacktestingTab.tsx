/**
 * BacktestingTab Component
 *
 * Displays backtest results and allows running new backtests.
 * Shows confidence metrics, correlation charts, and historical trends.
 *
 * Material Design 3 compliant.
 */

'use client';

import { useState, useEffect } from 'react';

interface Geography {
  type: 'state' | 'metro' | 'county' | 'zip';
  id: string;
  name: string;
}

interface BacktestingTabProps {
  geography: Geography | null;
}

interface BacktestResult {
  runId: string;
  scoreType: string;
  geographyType: string;
  formulaVersion: string;
  outcomeHorizon: string;
  sampleCount: number;
  rSquared: number | null;
  pearsonCorrelation: number | null;
  spearmanCorrelation: number | null;
  meanAbsoluteError: number | null;
  hitRate: number | null;
  decileSpread: number | null;
  createdAt: string;
}

interface ConfidenceData {
  scoreType: string;
  geographyType: string;
  confidenceScore: number;
  status: string;
  rSquaredContribution: number;
  sampleSizeContribution: number;
  recencyContribution: number;
  lastUpdated: string;
}

export function BacktestingTab({ geography }: BacktestingTabProps) {
  const [results, setResults] = useState<BacktestResult[]>([]);
  const [confidence, setConfidence] = useState<ConfidenceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [selectedScoreType, setSelectedScoreType] = useState<string>('all');
  const [selectedHorizon, setSelectedHorizon] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, [geography]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const geoFilter = geography?.id
        ? `&geographyType=${geography.type}`
        : '';

      const [resultsRes, confidenceRes] = await Promise.all([
        fetch(`${apiUrl}/api/admin/backtests?limit=50${geoFilter}`),
        fetch(`${apiUrl}/api/admin/confidence${geoFilter ? `?${geoFilter.substring(1)}` : ''}`),
      ]);

      if (resultsRes.ok) {
        const data = await resultsRes.json();
        setResults(data.results || []);
      }

      if (confidenceRes.ok) {
        const data = await confidenceRes.json();
        setConfidence(data.confidence || []);
      }
    } catch (error) {
      console.error('Error fetching backtest data:', error);
    } finally {
      setLoading(false);
    }
  };

  const runBacktest = async () => {
    if (!geography?.id) return;

    setRunning(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/admin/backtests/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geographyType: geography.type,
          scoreType: selectedScoreType === 'all' ? undefined : selectedScoreType,
        }),
      });

      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Error running backtest:', error);
    } finally {
      setRunning(false);
    }
  };

  const filteredResults = results.filter((r) => {
    if (selectedScoreType !== 'all' && r.scoreType !== selectedScoreType) return false;
    if (selectedHorizon !== 'all' && r.outcomeHorizon !== selectedHorizon) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-surface-container rounded-xl">
        <div className="flex items-center gap-2">
          <label className="text-sm text-on-surface-variant">Score Type:</label>
          <select
            value={selectedScoreType}
            onChange={(e) => setSelectedScoreType(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-outline bg-surface text-on-surface"
          >
            <option value="all">All Scores</option>
            <option value="market_health">Market Health</option>
            <option value="homeready">HomeReady</option>
            <option value="investoredge">InvestorEdge</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-on-surface-variant">Horizon:</label>
          <select
            value={selectedHorizon}
            onChange={(e) => setSelectedHorizon(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-outline bg-surface text-on-surface"
          >
            <option value="all">All Horizons</option>
            <option value="6m">6 Months</option>
            <option value="1y">1 Year</option>
            <option value="3y">3 Years</option>
            <option value="5y">5 Years</option>
          </select>
        </div>

        <div className="flex-1" />

        <button
          onClick={runBacktest}
          disabled={running || !geography?.id}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-on-primary disabled:opacity-50"
        >
          {running ? 'Running...' : 'Run Backtest'}
        </button>
      </div>

      {/* Confidence Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {['market_health', 'homeready', 'investoredge'].map((scoreType) => {
          const conf = confidence.find((c) => c.scoreType === scoreType);
          return (
            <ConfidenceCard key={scoreType} scoreType={scoreType} data={conf} />
          );
        })}
      </div>

      {/* Results Table */}
      <div className="bg-surface-container rounded-xl overflow-hidden">
        <div className="p-4 border-b border-outline-variant">
          <h3 className="font-medium text-on-surface">Recent Backtest Results</h3>
        </div>

        {loading ? (
          <div className="p-8 text-center text-on-surface-variant">Loading...</div>
        ) : filteredResults.length === 0 ? (
          <div className="p-8 text-center text-on-surface-variant">
            No backtest results found. Run a backtest to see results.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-container-high">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase">
                    Score Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase">
                    Geography
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase">
                    Horizon
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-on-surface-variant uppercase">
                    R²
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-on-surface-variant uppercase">
                    Correlation
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-on-surface-variant uppercase">
                    Hit Rate
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-on-surface-variant uppercase">
                    Samples
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {filteredResults.map((result) => (
                  <tr key={result.runId} className="hover:bg-surface-container-low">
                    <td className="px-4 py-3 text-sm text-on-surface">
                      {formatScoreType(result.scoreType)}
                    </td>
                    <td className="px-4 py-3 text-sm text-on-surface capitalize">
                      {result.geographyType}
                    </td>
                    <td className="px-4 py-3 text-sm text-on-surface">
                      {result.outcomeHorizon}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono">
                      <MetricBadge value={result.rSquared} format="percent" />
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono">
                      <MetricBadge value={result.pearsonCorrelation} format="decimal" />
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono">
                      <MetricBadge value={result.hitRate} format="percent" />
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-on-surface-variant">
                      {result.sampleCount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ConfidenceCard({
  scoreType,
  data,
}: {
  scoreType: string;
  data: ConfidenceData | undefined;
}) {
  const statusColors = {
    healthy: 'bg-green-100 text-green-800 border-green-200',
    monitor: 'bg-amber-100 text-amber-800 border-amber-200',
    review: 'bg-orange-100 text-orange-800 border-orange-200',
    broken: 'bg-red-100 text-red-800 border-red-200',
  };

  const status = (data?.status || 'unknown') as keyof typeof statusColors;

  return (
    <div className="p-4 rounded-xl bg-surface-container">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-on-surface">
          {formatScoreType(scoreType)}
        </span>
        {data && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}
          >
            {status}
          </span>
        )}
      </div>

      {data ? (
        <>
          <div className="text-3xl font-bold text-on-surface mb-2">
            {Math.round(data.confidenceScore)}%
          </div>
          <div className="space-y-1 text-xs text-on-surface-variant">
            <div className="flex justify-between">
              <span>R² contribution</span>
              <span>{data.rSquaredContribution.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span>Sample size</span>
              <span>{data.sampleSizeContribution.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span>Recency</span>
              <span>{data.recencyContribution.toFixed(1)}</span>
            </div>
          </div>
        </>
      ) : (
        <div className="text-sm text-on-surface-variant">No confidence data</div>
      )}
    </div>
  );
}

function MetricBadge({
  value,
  format,
}: {
  value: number | null;
  format: 'percent' | 'decimal';
}) {
  if (value === null) {
    return <span className="text-on-surface-variant">--</span>;
  }

  const displayValue = format === 'percent' ? `${(value * 100).toFixed(1)}%` : value.toFixed(3);

  const getColor = () => {
    const threshold = format === 'percent' ? value : value;
    if (threshold >= 0.7) return 'text-green-600';
    if (threshold >= 0.5) return 'text-amber-600';
    return 'text-red-600';
  };

  return <span className={getColor()}>{displayValue}</span>;
}

function formatScoreType(type: string): string {
  const labels: Record<string, string> = {
    market_health: 'Market Health',
    homeready: 'HomeReady',
    investoredge: 'InvestorEdge',
  };
  return labels[type] || type;
}
