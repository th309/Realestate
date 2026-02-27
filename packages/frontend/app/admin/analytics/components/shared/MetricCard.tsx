/**
 * MetricCard
 *
 * KPI card with value, trend arrow, and optional sparkline.
 * Uses M3 elevated card pattern.
 */

"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  trend?: number;
  sparkline?: number[];
  loading?: boolean;
}

function TrendBadge({ trend }: { trend: number }) {
  if (trend === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-on-surface-variant">
        <Minus className="w-3 h-3" />
        0%
      </span>
    );
  }

  const isPositive = trend > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        isPositive ? "text-green-600" : "text-red-600"
      }`}
    >
      {isPositive ? (
        <TrendingUp className="w-3 h-3" />
      ) : (
        <TrendingDown className="w-3 h-3" />
      )}
      {isPositive ? "+" : ""}
      {trend.toFixed(1)}%
    </span>
  );
}

function MiniSparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const height = 24;
  const width = 64;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-primary"
      />
    </svg>
  );
}

export function MetricCard({
  title,
  value,
  trend,
  sparkline,
  loading,
}: MetricCardProps) {
  if (loading) {
    return (
      <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 shadow-sm">
        <div className="h-3 w-20 bg-outline-variant/30 rounded animate-pulse mb-3" />
        <div className="h-6 w-16 bg-outline-variant/30 rounded animate-pulse mb-2" />
        <div className="h-3 w-12 bg-outline-variant/30 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 shadow-sm">
      <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-1">
        {title}
      </p>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold text-on-surface">{value}</p>
          {trend !== undefined && (
            <div className="mt-1">
              <TrendBadge trend={trend} />
            </div>
          )}
        </div>
        {sparkline && sparkline.length > 1 && (
          <MiniSparkline data={sparkline} />
        )}
      </div>
    </div>
  );
}
