/**
 * Score vs Return Scatter Plot
 *
 * Scatter chart showing relationship between scores and actual returns.
 * Includes trendline to visualize correlation.
 */

'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { fetchAPI } from '@/lib/data';

interface ScatterPoint {
  geographyId: string;
  geographyName: string;
  scoreDate: string;
  score: number;
  return1y: number | null;
  return3y: number | null;
  excessVsState1y: number | null;
  excessVsState3y: number | null;
}

interface Props {
  scoreType?: string;
  geography?: string;
  horizon: '1y' | '3y';
}

export function ScoreVsReturnScatter({ scoreType, geography, horizon }: Props) {
  const [data, setData] = useState<ScatterPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (scoreType) params.append('score_type', scoreType);
        if (geography) params.append('geography', geography);
        params.append('limit', '500');

        const queryString = params.toString();
        const endpoint = `/api/admin/scores/validation/scatter?${queryString}`;

        const result = await fetchAPI<ScatterPoint[]>(endpoint);
        setData(result || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch scatter data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [scoreType, geography]);

  // Prepare chart data
  const chartData = useMemo(() => {
    return data
      .filter((p) => {
        const returnValue = horizon === '1y' ? p.excessVsState1y : p.excessVsState3y;
        return p.score != null && returnValue != null;
      })
      .map((p) => ({
        x: p.score,
        y: horizon === '1y' ? p.excessVsState1y : p.excessVsState3y,
        id: p.geographyId,
        name: p.geographyName,
        date: p.scoreDate,
      }));
  }, [data, horizon]);

  // Calculate simple linear regression for trendline
  const trendline = useMemo(() => {
    if (chartData.length < 2) return null;

    const n = chartData.length;
    const sumX = chartData.reduce((a, p) => a + p.x, 0);
    const sumY = chartData.reduce((a, p) => a + (p.y ?? 0), 0);
    const sumXY = chartData.reduce((a, p) => a + p.x * (p.y ?? 0), 0);
    const sumX2 = chartData.reduce((a, p) => a + p.x * p.x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const meanY = sumY / n;
    const ssTotal = chartData.reduce((a, p) => a + Math.pow((p.y ?? 0) - meanY, 2), 0);
    const ssResidual = chartData.reduce((a, p) => {
      const predicted = slope * p.x + intercept;
      return a + Math.pow((p.y ?? 0) - predicted, 2);
    }, 0);
    const rSquared = 1 - ssResidual / ssTotal;

    return { slope, intercept, rSquared };
  }, [chartData]);

  if (loading) {
    return (
      <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4">
        <div className="h-4 w-40 bg-outline-variant/30 rounded mb-4 animate-pulse" />
        <div className="h-64 bg-outline-variant/20 rounded animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4">
        <h3 className="text-sm font-semibold text-on-surface mb-2">Score vs Return</h3>
        <p className="text-sm text-error">{error}</p>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4">
        <h3 className="text-sm font-semibold text-on-surface mb-2">Score vs Return</h3>
        <p className="text-sm text-on-surface-variant">No scatter data available.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-on-surface">
            Score vs Excess Return ({horizon === '1y' ? '1-Year' : '3-Year'})
          </h3>
          <p className="text-xs text-on-surface-variant">
            Each point is a location's score vs its excess return
          </p>
        </div>
        {trendline && (
          <div className="text-right">
            <p className="text-xs text-on-surface-variant">R-squared</p>
            <p className={`text-lg font-semibold ${trendline.rSquared > 0.1 ? 'text-green-600' : 'text-amber-600'}`}>
              {trendline.rSquared.toFixed(3)}
            </p>
          </div>
        )}
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" opacity={0.5} />
            <XAxis
              type="number"
              dataKey="x"
              name="Score"
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--outline-variant)' }}
              label={{ value: 'Score', position: 'bottom', fontSize: 11, fill: 'var(--on-surface-variant)' }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Excess Return"
              tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--outline-variant)' }}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--surface-container)',
                border: '1px solid var(--outline-variant)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value: number, name: string) => {
                if (name === 'Score') return [value.toFixed(1), name];
                return [`${value?.toFixed(2)}%`, 'Excess Return'];
              }}
              labelFormatter={(_, payload) => {
                const item = payload?.[0]?.payload;
                return item ? `${item.name} (${item.date})` : '';
              }}
            />
            <ReferenceLine y={0} stroke="var(--outline)" strokeDasharray="3 3" />
            <Scatter
              name="Locations"
              data={chartData}
              fill="#6366f1"
              fillOpacity={0.6}
              shape="circle"
            />
            {/* Trendline */}
            {trendline && (
              <ReferenceLine
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="5 5"
                segment={[
                  { x: 0, y: trendline.intercept },
                  { x: 100, y: trendline.slope * 100 + trendline.intercept },
                ]}
              />
            )}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex justify-center gap-6 text-xs text-on-surface-variant">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#6366f1]" />
          <span>Locations ({chartData.length})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0.5 bg-[#ef4444]" style={{ borderStyle: 'dashed' }} />
          <span>Trendline</span>
        </div>
      </div>
    </div>
  );
}
