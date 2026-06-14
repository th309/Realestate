/**
 * FullFunnel
 *
 * Wide horizontal funnel using the shared FunnelChart component.
 * Wraps FunnelChart with click-to-drill-down via an overlay interaction layer.
 * Each step can be clicked to trigger onStepClick for drill-down filtering.
 */

'use client';

import { FunnelChart } from '../shared/FunnelChart';
import type { FunnelStep } from '@/lib/data/fetchers/admin-analytics.types';

interface FullFunnelProps {
  steps: FunnelStep[];
  onStepClick?: (stepName: string) => void;
}

export function FullFunnel({ steps, onStepClick }: FullFunnelProps) {
  if (!steps || steps.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-on-surface-variant">
        No funnel data available
      </div>
    );
  }

  if (!onStepClick) {
    return <FunnelChart steps={steps} />;
  }

  // When drill-down is available, wrap each step in a clickable row.
  // We render FunnelChart for visuals but overlay invisible click targets
  // aligned to each step using the same step count.
  const stepHeightPx = 68; // approximate height per step including label + bar + gap
  const totalHeight = steps.length * stepHeightPx;

  return (
    <div className="relative">
      <FunnelChart steps={steps} />

      {/* Click overlay: invisible buttons positioned over each step */}
      <div
        className="absolute inset-0 flex flex-col"
        style={{ height: totalHeight }}
        aria-label="Funnel step drill-down controls"
      >
        {steps.map((step) => (
          <button
            key={step.name}
            onClick={() => onStepClick(step.name)}
            className="flex-1 w-full opacity-0 cursor-pointer"
            aria-label={`Drill down into ${step.name}`}
            title={`Filter by: ${step.name}`}
          />
        ))}
      </div>
    </div>
  );
}
