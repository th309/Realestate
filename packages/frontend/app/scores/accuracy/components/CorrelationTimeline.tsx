/**
 * Correlation Timeline
 *
 * Line chart showing correlation across 24 monthly validation windows.
 * Includes competitor reference line for comparison.
 * Client component.
 */

'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useValidationTimeSeries } from '@/lib/data';

export function CorrelationTimeline() {
  const { data: rawData, isLoading, error } = useValidationTimeSeries({
    geography: 'metro',
    scoreType: 'homeready',
  });

  const chartData = useMemo(() => {
    if (!rawData) return [];
    return rawData.map((p) => ({
      date: new Date(p.date).toLocaleDateString('en-US', {
        month: 'short',
        year: '2-digit',
      }),
      fullDate: p.date,
      correlation: p.correlation,
      hitRate: p.hitRate,
      sampleSize: p.sampleSize,
    }));
  }, [rawData]);

  // Find peak
  const peak = useMemo(() => {
    if (chartData.length === 0) return null;
    return chartData.reduce((best, curr) =>
      curr.correlation > best.correlation ? curr : best
    );
  }, [chartData]);

  // Average
  const avgCorrelation = useMemo(() => {
    if (chartData.length === 0) return 0;
    return chartData.reduce((sum, d) => sum + d.correlation, 0) / chartData.length;
  }, [chartData]);

  if (isLoading) {
    return (
      <section>
        <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-6">
          <div className="h-4 w-60 bg-outline-variant/30 rounded animate-pulse mb-4" />
          <div className="h-72 bg-outline-variant/20 rounded animate-pulse" />
        </div>
      </section>
    );
  }

  if (error || chartData.length === 0) {
    return (
      <section>
        <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-6">
          <p className="text-sm text-on-surface-variant">
            {error ? 'Failed to load timeline data.' : 'No time series data available.'}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
        Consistency Over Time
      </p>
      <h2 className="text-2xl font-[var(--font-source-serif)] text-on-surface mt-2">
        Our Best Window Beats Theirs. And We Show All {chartData.length}.
      </h2>
      <p className="text-on-surface-variant mt-2 max-w-2xl">
        The competition publishes one cherry-picked window. Here are all {chartData.length} of ours.
        Consistency matters more than a single data point.
      </p>

      <div className="mt-8 bg-surface-container-low border border-outline-variant rounded-2xl p-6">
        {/* Summary stats */}
        <div className="flex gap-4 mb-6">
          <div>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Windows</p>
            <p className="text-lg font-bold text-on-surface">{chartData.length}</p>
          </div>
          <div>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Avg Correlation</p>
            <p className="text-lg font-bold text-on-surface">{avgCorrelation.toFixed(3)}</p>
          </div>
          {peak && (
            <div>
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Peak</p>
              <p className="text-lg font-bold text-primary">{peak.correlation.toFixed(3)}</p>
            </div>
          )}
        </div>

        {/* Chart */}
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" opacity={0.5} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'var(--on-surface-variant)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--outline-variant)' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--outline-variant)' }}
                domain={[0, 'auto']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--surface-container)',
                  border: '1px solid var(--outline-variant)',
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
                formatter={(value: number) => [value.toFixed(3), 'Correlation']}
                labelFormatter={(label, payload) => {
                  const item = payload?.[0]?.payload;
                  return item ? `${item.fullDate} (n=${item.sampleSize})` : label;
                }}
              />
              {/* Competitor reference line */}
              <ReferenceLine
                y={0.72}
                stroke="#f97316"
                strokeDasharray="8 4"
                label={{
                  value: "Competitor's best (r=0.72)",
                  position: 'right',
                  fontSize: 10,
                  fill: '#f97316',
                }}
              />
              <Line
                type="monotone"
                dataKey="correlation"
                stroke="var(--primary)"
                strokeWidth={2.5}
                dot={{ fill: 'var(--primary)', r: 3 }}
                activeDot={{ r: 5, fill: 'var(--primary)' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="mt-3 flex justify-center gap-6 text-xs text-on-surface-variant">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0.5 bg-[var(--primary)] rounded" />
            <span>PropertyIQ Correlation</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0.5 border-t-2 border-dashed border-orange-500" />
            <span>Competitor&apos;s Published Best</span>
          </div>
        </div>
      </div>
    </section>
  );
}
