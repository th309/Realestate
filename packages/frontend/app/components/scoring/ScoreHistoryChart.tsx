/**
 * ScoreHistoryChart Component
 *
 * Displays 3-year or 5-year score trend with actual returns overlay.
 * Features:
 * - Dual Y-axis: Score (0-100) on left, Returns (%) on right
 * - Primary line: Score over time
 * - Secondary line: Actual returns for scores that have matured
 * - Benchmark comparison line (dashed)
 * - Toggle between 3Y and 5Y views
 *
 * Material Design 3 compliant.
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { fetchAPI } from '@/lib/data';

interface HistoryDataPoint {
  date: string;
  score: number | null;
  actualReturn1Y?: number | null;
  actualReturn3Y?: number | null;
  benchmarkReturn1Y?: number | null;
  benchmarkReturn3Y?: number | null;
  excessReturn3Y?: number | null;
}

interface ExtendedHistory {
  data: HistoryDataPoint[];
  years: number;
  trend: 'up' | 'down' | 'stable';
  scoreChange: number;
}

interface Validation {
  hasOutcomes: boolean;
  excessReturn3Y?: number;
  predictedVsActual?: 'outperformed' | 'underperformed' | 'matched';
}

interface ScoreHistoryChartProps {
  geographyType: string;
  geographyId: string;
  scoreType: 'homeready' | 'investoredge' | 'markethealth';
  initialYears?: 3 | 5;
  className?: string;
}

export function ScoreHistoryChart({
  geographyType,
  geographyId,
  scoreType,
  initialYears = 3,
  className = '',
}: ScoreHistoryChartProps) {
  const [years, setYears] = useState<3 | 5>(initialYears);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ExtendedHistory | null>(null);
  const [validation, setValidation] = useState<Validation | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!geographyId || !geographyType) return;

      setLoading(true);
      setError(null);

      try {
        const endpoint = `/api/scores/${geographyType}/${encodeURIComponent(geographyId)}?historyYears=${years}&includeOutcomes=true`;
        const data = await fetchAPI<any>(endpoint);

        if (!data?.scores) {
          throw new Error('No score data received');
        }

        // Extract the specific score type's history
        const scoreData = data.scores[scoreType];
        if (scoreData?.extendedHistory) {
          setHistory(scoreData.extendedHistory);
        }
        if (scoreData?.validation) {
          setValidation(scoreData.validation);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch history');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [geographyType, geographyId, scoreType, years]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!history?.data) return [];

    // Reverse to show oldest first
    return [...history.data].reverse().map((point) => ({
      date: point.date,
      dateLabel: formatDateLabel(point.date),
      score: point.score,
      actualReturn: years === 3 ? point.actualReturn3Y : point.actualReturn1Y,
      benchmarkReturn: years === 3 ? point.benchmarkReturn3Y : point.benchmarkReturn1Y,
      excessReturn: point.excessReturn3Y,
    }));
  }, [history, years]);

  // Check if we have any return data
  const hasReturnData = useMemo(
    () => chartData.some((d) => d.actualReturn != null),
    [chartData]
  );

  if (loading) {
    return (
      <div className={`bg-surface-container-low border border-outline-variant rounded-xl p-4 ${className}`}>
        <div className="h-4 w-32 bg-outline-variant/30 rounded mb-4 animate-pulse" />
        <div className="h-48 bg-outline-variant/20 rounded animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-surface-container-low border border-outline-variant rounded-xl p-4 ${className}`}>
        <p className="text-sm text-error">{error}</p>
      </div>
    );
  }

  if (!history || chartData.length === 0) {
    return (
      <div className={`bg-surface-container-low border border-outline-variant rounded-xl p-4 ${className}`}>
        <p className="text-sm text-on-surface-variant">No history data available.</p>
      </div>
    );
  }

  const scoreLabel = {
    homeready: 'HomeReady',
    investoredge: 'InvestorEdge',
    markethealth: 'Market Health',
  }[scoreType];

  return (
    <div className={`bg-surface-container-low border border-outline-variant rounded-xl p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-on-surface">
            {scoreLabel} Score History
          </h3>
          <p className="text-xs text-on-surface-variant">
            {history.years}Y trend with actual returns
          </p>
        </div>

        {/* Year Toggle */}
        <div className="flex rounded-lg border border-outline-variant overflow-hidden">
          <button
            onClick={() => setYears(3)}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              years === 3
                ? 'bg-primary text-on-primary'
                : 'bg-surface text-on-surface hover:bg-surface-container'
            }`}
          >
            3Y
          </button>
          <button
            onClick={() => setYears(5)}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              years === 5
                ? 'bg-primary text-on-primary'
                : 'bg-surface text-on-surface hover:bg-surface-container'
            }`}
          >
            5Y
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="flex gap-4 mb-4">
        <div>
          <p className="text-xs text-on-surface-variant">Score Change</p>
          <p className={`text-sm font-semibold ${
            history.scoreChange > 0 ? 'text-green-600' : history.scoreChange < 0 ? 'text-red-600' : 'text-on-surface'
          }`}>
            {history.scoreChange > 0 ? '+' : ''}{history.scoreChange.toFixed(1)} pts
          </p>
        </div>
        {validation?.hasOutcomes && validation.excessReturn3Y != null && (
          <div>
            <p className="text-xs text-on-surface-variant">3Y Excess Return</p>
            <p className={`text-sm font-semibold ${
              validation.excessReturn3Y > 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {validation.excessReturn3Y > 0 ? '+' : ''}{validation.excessReturn3Y.toFixed(2)}%
            </p>
          </div>
        )}
        {validation?.hasOutcomes && validation.predictedVsActual && (
          <div>
            <p className="text-xs text-on-surface-variant">Prediction</p>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              validation.predictedVsActual === 'outperformed'
                ? 'bg-green-100 text-green-800'
                : validation.predictedVsActual === 'underperformed'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-800'
            }`}>
              {validation.predictedVsActual === 'outperformed' && 'Outperformed'}
              {validation.predictedVsActual === 'underperformed' && 'Underperformed'}
              {validation.predictedVsActual === 'matched' && 'Matched'}
            </span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: hasReturnData ? 50 : 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" opacity={0.5} />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 10, fill: 'var(--on-surface-variant)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--outline-variant)' }}
              interval="preserveStartEnd"
            />
            {/* Score Y-Axis (left) */}
            <YAxis
              yAxisId="score"
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: 'var(--on-surface-variant)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--outline-variant)' }}
              width={35}
            />
            {/* Return Y-Axis (right) - only if we have return data */}
            {hasReturnData && (
              <YAxis
                yAxisId="return"
                orientation="right"
                tick={{ fontSize: 10, fill: 'var(--on-surface-variant)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--outline-variant)' }}
                tickFormatter={(v) => `${v}%`}
                width={45}
              />
            )}
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--surface-container)',
                border: '1px solid var(--outline-variant)',
                borderRadius: '8px',
                fontSize: '11px',
              }}
              formatter={(value: number, name: string) => {
                if (name === 'Score') return [value?.toFixed(1), name];
                return [`${value?.toFixed(2)}%`, name];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '11px' }}
              iconType="line"
            />
            {/* Reference line at 50 score */}
            <ReferenceLine yAxisId="score" y={50} stroke="var(--outline)" strokeDasharray="3 3" opacity={0.5} />
            {/* Score line */}
            <Line
              yAxisId="score"
              type="monotone"
              dataKey="score"
              name="Score"
              stroke="#6366f1"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            {/* Actual return line */}
            {hasReturnData && (
              <Line
                yAxisId="return"
                type="monotone"
                dataKey="actualReturn"
                name="Actual Return"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            )}
            {/* Benchmark return line */}
            {hasReturnData && (
              <Line
                yAxisId="return"
                type="monotone"
                dataKey="benchmarkReturn"
                name="State Benchmark"
                stroke="#f59e0b"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Validation Badge */}
      {validation?.hasOutcomes && (
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-container text-on-primary-container">
            Validated
          </span>
          <span className="text-xs text-on-surface-variant">
            Score has 3Y+ of actual return data
          </span>
        </div>
      )}
    </div>
  );
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export default ScoreHistoryChart;
