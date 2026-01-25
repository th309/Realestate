'use client';

/**
 * Chart Renderer for Analytics Assistant
 *
 * Renders various chart types based on structured data from the backend.
 */

import React from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';

export type ChartType = 'bar' | 'line' | 'scatter' | 'distribution';

export interface ChartDataPoint {
  name: string;
  value: number;
  label?: string;
  color?: string;
  [key: string]: string | number | undefined;
}

export interface ChartConfig {
  type: ChartType;
  title?: string;
  xLabel?: string;
  yLabel?: string;
  data: ChartDataPoint[];
  highlightIndex?: number;
  referenceLine?: number;
  referenceLabel?: string;
  colorScale?: 'score' | 'appreciation' | 'neutral';
}

// Color scales
const SCORE_COLORS = {
  high: '#22c55e', // green
  mid: '#eab308', // yellow
  low: '#ef4444', // red
};

const APPRECIATION_COLORS = {
  positive: '#22c55e',
  neutral: '#6b7280',
  negative: '#ef4444',
};

function getScoreColor(value: number): string {
  if (value >= 70) return SCORE_COLORS.high;
  if (value >= 40) return SCORE_COLORS.mid;
  return SCORE_COLORS.low;
}

function getAppreciationColor(value: number): string {
  if (value > 0.02) return APPRECIATION_COLORS.positive;
  if (value < -0.02) return APPRECIATION_COLORS.negative;
  return APPRECIATION_COLORS.neutral;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: ChartDataPoint }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;
  return (
    <div className="bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2 shadow-lg">
      <p className="font-medium text-on-surface text-sm">
        {data.label || data.name}
      </p>
      <p className="text-on-surface-variant text-sm">
        {typeof data.value === 'number'
          ? data.value < 1 && data.value > -1
            ? `${(data.value * 100).toFixed(1)}%`
            : data.value.toFixed(1)
          : data.value}
      </p>
    </div>
  );
}

export function ChartRenderer({ config }: { config: ChartConfig }) {
  const { type, title, xLabel, yLabel, data, referenceLine, referenceLabel, colorScale } =
    config;

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 bg-surface-container rounded-lg">
        <p className="text-on-surface-variant text-sm">No data available</p>
      </div>
    );
  }

  const getColor = (point: ChartDataPoint, index: number): string => {
    if (point.color) return point.color;
    if (colorScale === 'score') return getScoreColor(point.value);
    if (colorScale === 'appreciation') return getAppreciationColor(point.value);
    // Default gradient based on position
    const hue = 220 + (index * 20) % 60;
    return `hsl(${hue}, 70%, 50%)`;
  };

  const commonProps = {
    margin: { top: 10, right: 10, left: 10, bottom: 20 },
  };

  return (
    <div className="w-full">
      {title && (
        <h4 className="text-sm font-medium text-on-surface mb-2">{title}</h4>
      )}
      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {type === 'bar' || type === 'distribution' ? (
            <BarChart data={data} {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: 'var(--on-surface-variant)' }}
                axisLine={{ stroke: 'var(--outline-variant)' }}
                tickLine={false}
                label={
                  xLabel
                    ? {
                        value: xLabel,
                        position: 'bottom',
                        fontSize: 11,
                        fill: 'var(--on-surface-variant)',
                      }
                    : undefined
                }
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--on-surface-variant)' }}
                axisLine={{ stroke: 'var(--outline-variant)' }}
                tickLine={false}
                label={
                  yLabel
                    ? {
                        value: yLabel,
                        angle: -90,
                        position: 'insideLeft',
                        fontSize: 11,
                        fill: 'var(--on-surface-variant)',
                      }
                    : undefined
                }
              />
              <Tooltip content={<CustomTooltip />} />
              {referenceLine !== undefined && (
                <ReferenceLine
                  y={referenceLine}
                  stroke="var(--primary)"
                  strokeDasharray="5 5"
                  label={{
                    value: referenceLabel || 'Avg',
                    position: 'right',
                    fontSize: 10,
                    fill: 'var(--primary)',
                  }}
                />
              )}
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getColor(entry, index)} />
                ))}
              </Bar>
            </BarChart>
          ) : type === 'line' ? (
            <LineChart data={data} {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: 'var(--on-surface-variant)' }}
                axisLine={{ stroke: 'var(--outline-variant)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--on-surface-variant)' }}
                axisLine={{ stroke: 'var(--outline-variant)' }}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              {referenceLine !== undefined && (
                <ReferenceLine
                  y={referenceLine}
                  stroke="var(--primary)"
                  strokeDasharray="5 5"
                />
              )}
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={{ fill: 'var(--primary)', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, fill: 'var(--primary)' }}
              />
            </LineChart>
          ) : (
            <ScatterChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" />
              <XAxis
                dataKey="x"
                type="number"
                tick={{ fontSize: 10, fill: 'var(--on-surface-variant)' }}
                axisLine={{ stroke: 'var(--outline-variant)' }}
                tickLine={false}
                label={
                  xLabel
                    ? {
                        value: xLabel,
                        position: 'bottom',
                        fontSize: 11,
                        fill: 'var(--on-surface-variant)',
                      }
                    : undefined
                }
              />
              <YAxis
                dataKey="y"
                type="number"
                tick={{ fontSize: 10, fill: 'var(--on-surface-variant)' }}
                axisLine={{ stroke: 'var(--outline-variant)' }}
                tickLine={false}
                label={
                  yLabel
                    ? {
                        value: yLabel,
                        angle: -90,
                        position: 'insideLeft',
                        fontSize: 11,
                        fill: 'var(--on-surface-variant)',
                      }
                    : undefined
                }
              />
              <Tooltip content={<CustomTooltip />} />
              <Scatter data={data} fill="var(--primary)">
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getColor(entry, index)} />
                ))}
              </Scatter>
            </ScatterChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
