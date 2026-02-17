/**
 * BacktestingTab Component
 *
 * Enhanced backtesting dashboard with sub-tab navigation.
 * Sub-tabs:
 * 1. Confidence Summary - Matrix view of confidence by score/horizon/geo
 * 2. Component Analysis - Per-component breakdown
 * 3. Trends - Historical confidence trends
 * 4. Results - Detailed backtest results table
 *
 * Material Design 3 compliant.
 */

'use client';

import { useState, useEffect } from 'react';
import { fetchAPIRaw } from '@/lib/data';
import { ConfidenceMatrix } from './ConfidenceMatrix';
import { ConfidenceTrendChart } from './ConfidenceTrendChart';
import { ComponentAnalysis } from './ComponentAnalysis';

interface Geography {
  type: 'state' | 'metro' | 'county' | 'zip';
  id: string;
  name: string;
}

interface BacktestingTabProps {
  geography: Geography | null;
}

type SubTabId = 'summary' | 'components' | 'trends' | 'results';

interface SubTab {
  id: SubTabId;
  label: string;
}

const SUB_TABS: SubTab[] = [
  { id: 'summary', label: 'Confidence Summary' },
  { id: 'components', label: 'Component Analysis' },
  { id: 'trends', label: 'Trends' },
  { id: 'results', label: 'Results' },
];

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
  const [activeSubTab, setActiveSubTab] = useState<SubTabId>('summary');
  const [results, setResults] = useState<BacktestResult[]>([]);
  const [confidence, setConfidence] = useState<ConfidenceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [selectedScoreType, setSelectedScoreType] = useState<string>('all');
  const [selectedHorizon, setSelectedHorizon] = useState<string>('all');

  // Trend configuration
  const [trendScoreType, setTrendScoreType] = useState('homeready');
  const [trendHorizon, setTrendHorizon] = useState('1y');
  const [trendGeoType, setTrendGeoType] = useState('metro');

  useEffect(() => {
    if (activeSubTab === 'results') {
      fetchData();
    }
  }, [geography, activeSubTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const geoFilter = geography?.id
        ? `&geographyType=${geography.type}`
        : '';

      const [resultsRes, confidenceRes] = await Promise.all([
        fetchAPIRaw(`/api/admin/backtests?limit=50${geoFilter}`, { credentials: 'include' }),
        fetchAPIRaw(`/api/admin/confidence${geoFilter ? `?${geoFilter.substring(1)}` : ''}`, { credentials: 'include' }),
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
      const response = await fetchAPIRaw(`/api/admin/backtests/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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

  const renderSubTabContent = () => {
    switch (activeSubTab) {
      case 'summary':
        return <ConfidenceMatrix />;

      case 'components':
        return <ComponentAnalysis geography={geography} />;

      case 'trends':
        return (
          <div className="space-y-6">
            {/* Trend configuration */}
            <div className="flex flex-wrap gap-4 p-4 bg-surface-container rounded-lg">
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">Score Type</label>
                <select
                  value={trendScoreType}
                  onChange={(e) => setTrendScoreType(e.target.value)}
                  className="px-3 py-2 border border-outline rounded-lg bg-surface text-on-surface"
                >
                  <option value="market_health">Market Health</option>
                  <option value="homeready">HomeReady</option>
                  <option value="investoredge">InvestorEdge</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">Horizon</label>
                <select
                  value={trendHorizon}
                  onChange={(e) => setTrendHorizon(e.target.value)}
                  className="px-3 py-2 border border-outline rounded-lg bg-surface text-on-surface"
                >
                  <option value="6m">6 Months</option>
                  <option value="1y">1 Year</option>
                  <option value="3y">3 Years</option>
                  <option value="5y">5 Years</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">Geography Type</label>
                <select
                  value={trendGeoType}
                  onChange={(e) => setTrendGeoType(e.target.value)}
                  className="px-3 py-2 border border-outline rounded-lg bg-surface text-on-surface"
                >
                  <option value="state">State</option>
                  <option value="metro">Metro</option>
                  <option value="county">County</option>
                  <option value="zip">ZIP</option>
                </select>
              </div>
            </div>

            <ConfidenceTrendChart
              scoreType={trendScoreType}
              horizon={trendHorizon}
              geographyType={trendGeoType}
              months={12}
            />
          </div>
        );

      case 'results':
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

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-tab navigation */}
      <div className="flex gap-1 border-b border-outline-variant">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`
              px-4 py-2 text-sm font-medium
              border-b-2 transition-colors
              ${
                activeSubTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {renderSubTabContent()}
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
