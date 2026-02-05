/**
 * Quintile Performance Chart
 *
 * Bar chart showing returns by score quintile.
 * Demonstrates that higher scores lead to higher returns.
 */

'use client';

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { fetchAPI } from '@/lib/data';

interface QuintileData {
  quintile: number;
  label: string;
  scoreMin: number;
  scoreMax: number;
  avgScore: number;
  count: number;
  avgReturn1y: number | null;
  avgReturn3y: number | null;
  avgExcessVsState1y: number | null;
  avgExcessVsState3y: number | null;
  avgExcessVsNational1y: number | null;
  avgExcessVsNational3y: number | null;
}

interface Props {
  scoreType?: string;
  geography?: string;
  horizon: '1y' | '3y';
}

export function QuintilePerformanceChart({ scoreType, geography, horizon }: Props) {
  const [data, setData] = useState<QuintileData[]>([]);
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
        params.append('horizon', horizon);

        const queryString = params.toString();
        const endpoint = `/api/admin/scores/validation/quintile-analysis?${queryString}`;

        const result = await fetchAPI<QuintileData[]>(endpoint);
        setData(result || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch quintile data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [scoreType, geography, horizon]);

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
        <h3 className="text-sm font-semibold text-on-surface mb-2">Quintile Performance</h3>
        <p className="text-sm text-error">{error}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4">
        <h3 className="text-sm font-semibold text-on-surface mb-2">Quintile Performance</h3>
        <p className="text-sm text-on-surface-variant">No quintile data available.</p>
      </div>
    );
  }

  // Prepare chart data
  const chartData = data.map((q) => ({
    name: q.label,
    scoreRange: `${q.scoreMin.toFixed(0)}-${q.scoreMax.toFixed(0)}`,
    avgScore: q.avgScore,
    return: horizon === '1y' ? q.avgReturn1y : q.avgReturn3y,
    excessVsState: horizon === '1y' ? q.avgExcessVsState1y : q.avgExcessVsState3y,
    count: q.count,
  }));

  // Calculate spread between top and bottom quintiles
  const topReturn = chartData[chartData.length - 1]?.excessVsState ?? 0;
  const bottomReturn = chartData[0]?.excessVsState ?? 0;
  const spread = topReturn - bottomReturn;

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-on-surface">
            Quintile Performance ({horizon === '1y' ? '1-Year' : '3-Year'} Horizon)
          </h3>
          <p className="text-xs text-on-surface-variant">
            Average excess return vs state benchmark by score quintile
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-on-surface-variant">Top-Bottom Spread</p>
          <p className={`text-lg font-semibold ${spread > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {spread > 0 ? '+' : ''}{spread.toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" opacity={0.5} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--outline-variant)' }}
            />
            <YAxis
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
              formatter={(value: number) => [`${value?.toFixed(2)}%`, 'Excess Return']}
              labelFormatter={(label, payload) => {
                const item = payload?.[0]?.payload;
                return `${label} (Score: ${item?.scoreRange}, n=${item?.count})`;
              }}
            />
            <ReferenceLine y={0} stroke="var(--outline)" strokeDasharray="3 3" />
            <Bar
              dataKey="excessVsState"
              name="Excess Return"
              fill="#6366f1"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex justify-center gap-6 text-xs text-on-surface-variant">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-[#6366f1]" />
          <span>Excess Return vs State</span>
        </div>
      </div>
    </div>
  );
}
