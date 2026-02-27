/**
 * FunnelChart
 *
 * Horizontal bar funnel visualization showing conversion through steps.
 * Each bar is proportional to the first step. Shows step-to-step and
 * overall conversion rates.
 */

"use client";

interface FunnelStep {
  name: string;
  count: number;
  rateFromPrevious: number;
  rateFromFirst: number;
}

interface FunnelChartProps {
  steps: FunnelStep[];
}

const FUNNEL_COLORS = [
  "bg-primary",
  "bg-primary/80",
  "bg-primary/60",
  "bg-primary/45",
  "bg-primary/30",
  "bg-primary/20",
] as const;

function formatCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toLocaleString();
}

export function FunnelChart({ steps }: FunnelChartProps) {
  if (steps.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-on-surface-variant">
        No funnel data available
      </div>
    );
  }

  const maxCount = steps[0]?.count || 1;

  return (
    <div className="space-y-3">
      {steps.map((step, index) => {
        const widthPercent = Math.max((step.count / maxCount) * 100, 4);
        const colorClass = FUNNEL_COLORS[index % FUNNEL_COLORS.length];

        return (
          <div key={step.name} className="group">
            {/* Step label row */}
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-on-surface">
                {step.name}
              </span>
              <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                <span className="font-medium tabular-nums">
                  {formatCount(step.count)}
                </span>
                {index > 0 && (
                  <>
                    <span className="text-outline">|</span>
                    <span className="tabular-nums">
                      {step.rateFromPrevious.toFixed(1)}% from prev
                    </span>
                    <span className="text-outline">|</span>
                    <span className="tabular-nums">
                      {step.rateFromFirst.toFixed(1)}% overall
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Bar */}
            <div className="h-8 bg-surface-container rounded-lg overflow-hidden">
              <div
                className={`h-full rounded-lg transition-all duration-300 ${colorClass}`}
                style={{ width: `${widthPercent}%` }}
              />
            </div>

            {/* Drop-off arrow between steps */}
            {index < steps.length - 1 && (
              <div className="flex justify-center py-0.5">
                <span className="text-xs text-on-surface-variant">
                  {((1 - steps[index + 1].count / step.count) * 100).toFixed(1)}
                  % drop-off
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
