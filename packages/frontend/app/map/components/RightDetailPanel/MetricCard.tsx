/**
 * MetricCard Component
 *
 * Displays a metric value with M3 linear progress indicator and trend.
 *
 * Layout:
 * ┌────────────────────┐
 * │ $385K              │
 * │ Median Home Value  │
 * │ ████████░░ 78%     │  ← Linear progress bar
 * │ ↓ 2.1% vs avg      │
 * └────────────────────┘
 */

import { ScoreProgress } from './ScoreProgress';
import { TrendArrow, TrendDirection } from '../sidebar-components';

interface MetricCardProps {
  value: string; // Formatted value, e.g., "$385K", "18 days"
  label: string; // Metric name, e.g., "Median Home Value"
  percentile?: number; // 0-100, where this region ranks vs national/state
  trend?: {
    direction: TrendDirection;
    value: string; // e.g., "2.1%"
    comparison: string; // e.g., "vs avg", "YoY"
  };
  color?: 'purple' | 'emerald'; // Theme color for progress bar
  invertColors?: boolean; // For metrics where lower is better (e.g., DOM)
}

export function MetricCard({
  value,
  label,
  percentile,
  trend,
  color = 'purple',
  invertColors = false,
}: MetricCardProps) {
  return (
    <div className="bg-surface-container rounded-xl p-3 flex flex-col gap-1.5">
      {/* Value */}
      <span className="text-lg font-semibold text-on-surface leading-tight">
        {value}
      </span>

      {/* Label */}
      <span className="text-xs text-on-surface-variant leading-tight">
        {label}
      </span>

      {/* Progress bar with percentile */}
      {percentile !== undefined && (
        <div className="flex items-center gap-2 mt-0.5">
          <div className="flex-1">
            <ScoreProgress percentile={percentile} color={color} />
          </div>
          <span className="text-[10px] text-on-surface-variant font-medium">
            {percentile}%
          </span>
        </div>
      )}

      {/* Trend */}
      {trend && (
        <div className="flex items-center gap-1 mt-0.5">
          <TrendArrow
            direction={trend.direction}
            value={trend.value}
            label={trend.comparison}
            invertColors={invertColors}
            size="sm"
          />
        </div>
      )}
    </div>
  );
}

/**
 * MetricCardGrid - Layout helper for 2x2 metric cards
 */
interface MetricCardGridProps {
  children: React.ReactNode;
}

export function MetricCardGrid({ children }: MetricCardGridProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {children}
    </div>
  );
}
