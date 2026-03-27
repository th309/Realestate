"use client";

import { SparklineChart } from "../shared/SparklineChart";

interface HeroStatCardProps {
  label: string;
  value: string;
  subtitle: string;
  sparkline: number[];
  color: string;
  borderAlert?: boolean;
}

export function HeroStatCard({
  label,
  value,
  subtitle,
  sparkline,
  color,
  borderAlert = false,
}: HeroStatCardProps) {
  return (
    <div
      data-testid="hero-stat-card"
      className={`
        flex flex-col gap-1 flex-1 min-w-0
        bg-surface-container-low rounded-xl border shadow-sm
        px-5 py-4
        ${borderAlert ? "border-amber-400" : "border-outline-variant"}
      `}
    >
      <p className="text-sm font-medium text-on-surface-variant tracking-wide truncate">
        {label}
      </p>

      <p
        data-testid="hero-stat-value"
        className="text-3xl font-bold leading-tight"
        style={{ color }}
      >
        {value}
      </p>

      <p className="text-xs text-on-surface-variant truncate">{subtitle}</p>

      <div className="mt-2 flex justify-center">
        <SparklineChart
          data={sparkline}
          width={120}
          height={28}
          color={color}
        />
      </div>
    </div>
  );
}
