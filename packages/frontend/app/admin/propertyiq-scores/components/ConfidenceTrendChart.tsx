/**
 * ConfidenceTrendChart Component
 *
 * Displays a line chart showing confidence trends over time.
 * Features:
 * - Multiple series support (by score type)
 * - Threshold lines (70% healthy, 55% monitor, 40% broken)
 * - Hover tooltips with exact values
 * - Date range selection
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchAPIRaw } from '@/lib/data';

interface TrendDataPoint {
  date: string;
  confidence: number;
  status: string;
}

interface ConfidenceTrendChartProps {
  scoreType: string;
  horizon: string;
  geographyType: string;
  months?: number;
}

const SCORE_TYPE_COLORS: Record<string, string> = {
  market_health: '#10b981',
  homeready: '#3b82f6',
  investoredge: '#8b5cf6',
};

const SCORE_TYPE_LABELS: Record<string, string> = {
  market_health: 'Market Health',
  homeready: 'HomeReady',
  investoredge: 'InvestorEdge',
};

export function ConfidenceTrendChart({
  scoreType,
  horizon,
  geographyType,
  months = 12,
}: ConfidenceTrendChartProps) {
  const [data, setData] = useState<TrendDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        scoreType,
        horizon,
        geographyType,
        months: months.toString(),
      });

      const res = await fetchAPIRaw(`/api/admin/backtest-runs/confidence/trend?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to fetch trend data');
      }

      const result = await res.json();
      if (result.success) {
        setData(result.data);
      } else {
        throw new Error(result.error || 'Failed to fetch data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [scoreType, horizon, geographyType, months]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate chart dimensions and scales
  const chartConfig = useMemo(() => {
    const width = 600;
    const height = 300;
    const padding = { top: 20, right: 30, bottom: 40, left: 50 };

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Y scale (0-100 for confidence)
    const yMin = 0;
    const yMax = 100;
    const yScale = (value: number) =>
      padding.top + chartHeight - ((value - yMin) / (yMax - yMin)) * chartHeight;

    // X scale (date range)
    const xScale = (index: number) =>
      padding.left + (index / Math.max(data.length - 1, 1)) * chartWidth;

    return { width, height, padding, chartWidth, chartHeight, yScale, xScale };
  }, [data.length]);

  // Generate path for the line
  const linePath = useMemo(() => {
    if (data.length === 0) return '';

    return data
      .map((point, index) => {
        const x = chartConfig.xScale(index);
        const y = chartConfig.yScale(point.confidence);
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  }, [data, chartConfig]);

  // Generate threshold lines
  const thresholdLines = [
    { value: 70, label: 'Healthy', color: '#10b981' },
    { value: 55, label: 'Monitor', color: '#f59e0b' },
    { value: 40, label: 'Review', color: '#ef4444' },
  ];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      year: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-error-container text-on-error-container rounded-lg text-sm">
        {error}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="p-8 text-center text-on-surface-variant text-sm">
        No trend data available for this combination.
      </div>
    );
  }

  const color = SCORE_TYPE_COLORS[scoreType] || '#6b7280';
  const label = SCORE_TYPE_LABELS[scoreType] || scoreType;

  return (
    <div className="bg-surface-container rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="font-medium text-on-surface">
            {label} Confidence Trend
          </h4>
          <p className="text-sm text-on-surface-variant">
            {geographyType} / {horizon} - Last {months} months
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: color }}
          ></span>
          <span className="text-on-surface-variant">{label}</span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${chartConfig.width} ${chartConfig.height}`}
        className="w-full h-auto"
        style={{ maxHeight: '300px' }}
      >
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((value) => (
          <g key={value}>
            <line
              x1={chartConfig.padding.left}
              y1={chartConfig.yScale(value)}
              x2={chartConfig.width - chartConfig.padding.right}
              y2={chartConfig.yScale(value)}
              stroke="currentColor"
              strokeOpacity={0.1}
              strokeDasharray="4 4"
            />
            <text
              x={chartConfig.padding.left - 8}
              y={chartConfig.yScale(value)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-current text-on-surface-variant"
              fontSize={10}
            >
              {value}%
            </text>
          </g>
        ))}

        {/* Threshold lines */}
        {thresholdLines.map((threshold) => (
          <g key={threshold.value}>
            <line
              x1={chartConfig.padding.left}
              y1={chartConfig.yScale(threshold.value)}
              x2={chartConfig.width - chartConfig.padding.right}
              y2={chartConfig.yScale(threshold.value)}
              stroke={threshold.color}
              strokeWidth={1}
              strokeDasharray="6 3"
              strokeOpacity={0.5}
            />
            <text
              x={chartConfig.width - chartConfig.padding.right + 4}
              y={chartConfig.yScale(threshold.value)}
              dominantBaseline="middle"
              fill={threshold.color}
              fontSize={9}
            >
              {threshold.label}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {data.map((point, index) => {
          // Only show labels for every few points to avoid crowding
          const showLabel = index === 0 || index === data.length - 1 ||
            (data.length > 6 ? index % Math.ceil(data.length / 6) === 0 : true);
          if (!showLabel) return null;

          return (
            <text
              key={index}
              x={chartConfig.xScale(index)}
              y={chartConfig.height - 10}
              textAnchor="middle"
              className="fill-current text-on-surface-variant"
              fontSize={10}
            >
              {formatDate(point.date)}
            </text>
          );
        })}

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {data.map((point, index) => (
          <g key={index}>
            <circle
              cx={chartConfig.xScale(index)}
              cy={chartConfig.yScale(point.confidence)}
              r={hoveredPoint === index ? 6 : 4}
              fill={color}
              stroke="white"
              strokeWidth={2}
              className="cursor-pointer transition-all"
              onMouseEnter={() => setHoveredPoint(index)}
              onMouseLeave={() => setHoveredPoint(null)}
            />

            {/* Tooltip */}
            {hoveredPoint === index && (
              <g>
                <rect
                  x={chartConfig.xScale(index) - 50}
                  y={chartConfig.yScale(point.confidence) - 45}
                  width={100}
                  height={38}
                  rx={4}
                  fill="rgb(30, 41, 59)"
                  opacity={0.95}
                />
                <text
                  x={chartConfig.xScale(index)}
                  y={chartConfig.yScale(point.confidence) - 30}
                  textAnchor="middle"
                  fill="white"
                  fontSize={11}
                  fontWeight="500"
                >
                  {point.confidence.toFixed(1)}%
                </text>
                <text
                  x={chartConfig.xScale(index)}
                  y={chartConfig.yScale(point.confidence) - 15}
                  textAnchor="middle"
                  fill="rgb(156, 163, 175)"
                  fontSize={10}
                >
                  {formatDate(point.date)} · {point.status}
                </text>
              </g>
            )}
          </g>
        ))}

        {/* Y-axis line */}
        <line
          x1={chartConfig.padding.left}
          y1={chartConfig.padding.top}
          x2={chartConfig.padding.left}
          y2={chartConfig.height - chartConfig.padding.bottom}
          stroke="currentColor"
          strokeOpacity={0.2}
        />

        {/* X-axis line */}
        <line
          x1={chartConfig.padding.left}
          y1={chartConfig.height - chartConfig.padding.bottom}
          x2={chartConfig.width - chartConfig.padding.right}
          y2={chartConfig.height - chartConfig.padding.bottom}
          stroke="currentColor"
          strokeOpacity={0.2}
        />
      </svg>

      {/* Summary stats */}
      <div className="mt-4 grid grid-cols-4 gap-4 text-center text-sm">
        <div>
          <div className="text-on-surface-variant">Current</div>
          <div className="font-medium text-on-surface">
            {data[data.length - 1]?.confidence.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-on-surface-variant">Average</div>
          <div className="font-medium text-on-surface">
            {(data.reduce((sum, p) => sum + p.confidence, 0) / data.length).toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-on-surface-variant">Min</div>
          <div className="font-medium text-on-surface">
            {Math.min(...data.map(p => p.confidence)).toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-on-surface-variant">Max</div>
          <div className="font-medium text-on-surface">
            {Math.max(...data.map(p => p.confidence)).toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Multi-series trend chart comparing multiple score types
 */
export function MultiSeriesTrendChart({
  scoreTypes,
  horizon,
  geographyType,
  months = 12,
}: {
  scoreTypes: string[];
  horizon: string;
  geographyType: string;
  months?: number;
}) {
  const [seriesData, setSeriesData] = useState<Record<string, TrendDataPoint[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllSeries = async () => {
      try {
        setLoading(true);
        setError(null);

        const results: Record<string, TrendDataPoint[]> = {};

        await Promise.all(
          scoreTypes.map(async (scoreType) => {
            const params = new URLSearchParams({
              scoreType,
              horizon,
              geographyType,
              months: months.toString(),
            });

            const res = await fetchAPIRaw(`/api/admin/backtest-runs/confidence/trend?${params}`, {
              credentials: 'include',
            });
            if (res.ok) {
              const result = await res.json();
              if (result.success) {
                results[scoreType] = result.data;
              }
            }
          }),
        );

        setSeriesData(results);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchAllSeries();
  }, [scoreTypes, horizon, geographyType, months]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-error-container text-on-error-container rounded-lg text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="bg-surface-container rounded-lg p-4">
      <div className="mb-4">
        <h4 className="font-medium text-on-surface">Confidence Comparison</h4>
        <p className="text-sm text-on-surface-variant">
          {geographyType} / {horizon} - Last {months} months
        </p>
      </div>

      <div className="flex flex-wrap gap-4 mb-4">
        {scoreTypes.map((scoreType) => (
          <div key={scoreType} className="flex items-center gap-2 text-sm">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: SCORE_TYPE_COLORS[scoreType] || '#6b7280' }}
            ></span>
            <span className="text-on-surface-variant">
              {SCORE_TYPE_LABELS[scoreType] || scoreType}
            </span>
            {seriesData[scoreType]?.length > 0 && (
              <span className="text-on-surface font-medium">
                ({seriesData[scoreType][seriesData[scoreType].length - 1]?.confidence.toFixed(0)}%)
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Render individual charts stacked */}
      <div className="space-y-4">
        {scoreTypes.map((scoreType) => (
          <ConfidenceTrendChart
            key={scoreType}
            scoreType={scoreType}
            horizon={horizon}
            geographyType={geographyType}
            months={months}
          />
        ))}
      </div>
    </div>
  );
}
