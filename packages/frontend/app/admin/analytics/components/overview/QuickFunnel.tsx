"use client";

/**
 * QuickFunnel — Card wrapper around FunnelChart for the overview panel.
 * Shows the default signup funnel from the overview data.
 */

import { FunnelChart } from "../shared/FunnelChart";
import type { FunnelStep } from "@/lib/data/fetchers/admin-analytics.types";

interface QuickFunnelProps {
  steps: FunnelStep[];
}

export function QuickFunnel({ steps }: QuickFunnelProps) {
  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-medium text-on-surface">Quick Funnel</h2>
        <p className="text-xs text-on-surface-variant mt-0.5">
          Signup conversion flow
        </p>
      </div>
      <FunnelChart steps={steps} />
    </div>
  );
}
