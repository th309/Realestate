'use client';

import React, { useMemo } from 'react';
import * as d3 from 'd3';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useTimeSeriesData, formatMetricValue, getMetricFormat } from '@/lib/data';
import { MetricTitle } from '@/app/components/MetricTitle';
import type { MyMarket } from '../hooks/useMyMarkets';

interface MetricQuickCardsProps {
  primaryMarket: MyMarket;
  activeMetric: string;
  onMetricSelect: (metricId: string) => void;
  /** Render as vertical stack (sidebar) vs horizontal scroll (bottom row) */
  vertical?: boolean;
}

const QUICK_METRICS = [
  'home_value',
  'listing_price',
  'days_on_market',
  'for_sale_inventory',
  'home_value_yoy',
  'rent_index',
];

export function MetricQuickCards({ primaryMarket, activeMetric, onMetricSelect, vertical = false }: MetricQuickCardsProps) {
  return (
    <div className={vertical
      ? 'flex flex-col gap-2'
      : 'flex gap-3 overflow-x-auto pb-1 scrollbar-thin'
    }>
      {QUICK_METRICS.map(metricId => (
        <QuickCard
          key={metricId}
          metricId={metricId}
          market={primaryMarket}
          isActive={activeMetric === metricId}
          onSelect={() => onMetricSelect(metricId)}
          compact={vertical}
        />
      ))}
    </div>
  );
}

function QuickCard({
  metricId,
  market,
  isActive,
  onSelect,
  compact = false,
}: {
  metricId: string;
  market: MyMarket;
  isActive: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  const { data, current, trendChange, isLoading } = useTimeSeriesData(
    metricId,
    market.type,
    market.id,
    { historyMonths: 6 }
  );

  const format = getMetricFormat(metricId);
  const formattedValue = current != null ? formatMetricValue(current, format) : '--';

  const trendDir = trendChange != null
    ? trendChange > 0.5 ? 'up' : trendChange < -0.5 ? 'down' : 'stable'
    : null;

  if (compact) {
    return (
      <button
        onClick={onSelect}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-xl w-full text-left
          transition-all duration-200
          ${isActive
            ? 'bg-primary-container ring-1 ring-primary/60'
            : 'bg-surface-container/60 hover:bg-surface-container-high'
          }
        `}
      >
        {/* Sparkline on the left */}
        {data.length > 1 && (
          <Sparkline data={data.map(d => d.value)} trend={trendDir} width={36} height={16} />
        )}

        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-medium text-on-surface-variant uppercase tracking-wider truncate">
            <MetricTitle metricId={metricId} />
          </div>
          <div className="flex items-center gap-1.5">
            {isLoading ? (
              <div className="h-4 w-10 bg-surface-container-high rounded animate-pulse" />
            ) : (
              <span className={`text-xs font-semibold ${isActive ? 'text-on-primary-container' : 'text-on-surface'}`}>
                {formattedValue}
              </span>
            )}
            {trendDir && trendChange != null && (
              <span className={`text-[9px] font-medium ${
                trendDir === 'up' ? 'text-green-600' :
                trendDir === 'down' ? 'text-red-500' :
                'text-on-surface-variant'
              }`}>
                {trendChange > 0 ? '+' : ''}{trendChange.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onSelect}
      className={`
        flex-shrink-0 flex flex-col gap-1.5 p-3 rounded-2xl min-w-[130px]
        transition-all duration-200
        ${isActive
          ? 'bg-primary-container ring-2 ring-primary shadow-sm'
          : 'bg-surface-container hover:bg-surface-container-high'
        }
      `}
    >
      <div className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wider truncate">
        <MetricTitle metricId={metricId} />
      </div>

      <div className="flex items-end justify-between gap-2">
        <div>
          {isLoading ? (
            <div className="h-5 w-14 bg-surface-container-high rounded animate-pulse" />
          ) : (
            <span className={`text-base font-semibold ${isActive ? 'text-on-primary-container' : 'text-on-surface'}`}>
              {formattedValue}
            </span>
          )}
        </div>

        {/* Mini sparkline */}
        {data.length > 1 && (
          <Sparkline data={data.map(d => d.value)} trend={trendDir} />
        )}
      </div>

      {/* Trend indicator */}
      {trendDir && trendChange != null && (
        <div className={`flex items-center gap-0.5 text-[10px] font-medium ${
          trendDir === 'up' ? 'text-green-600' :
          trendDir === 'down' ? 'text-red-500' :
          'text-on-surface-variant'
        }`}>
          {trendDir === 'up' && <TrendingUp className="w-3 h-3" />}
          {trendDir === 'down' && <TrendingDown className="w-3 h-3" />}
          {trendDir === 'stable' && <Minus className="w-3 h-3" />}
          <span>{trendChange > 0 ? '+' : ''}{trendChange.toFixed(1)}%</span>
        </div>
      )}
    </button>
  );
}

/** Tiny SVG sparkline rendered with D3 */
function Sparkline({ data, trend, width = 56, height = 20 }: { data: number[]; trend: string | null; width?: number; height?: number }) {
  const pathD = useMemo(() => {
    if (data.length < 2) return '';

    const xScale = d3.scaleLinear().domain([0, data.length - 1]).range([1, width - 1]);
    const yExtent = d3.extent(data) as [number, number];
    const yScale = d3.scaleLinear().domain(yExtent).range([height - 2, 2]);

    const lineGen = d3.line<number>()
      .x((_, i) => xScale(i))
      .y(d => yScale(d))
      .curve(d3.curveMonotoneX);

    return lineGen(data) || '';
  }, [data, width, height]);

  const color = trend === 'up' ? '#16a34a' : trend === 'down' ? '#dc2626' : '#0891b2';

  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

export default MetricQuickCards;
