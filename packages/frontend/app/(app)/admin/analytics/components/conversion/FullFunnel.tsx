/**
 * FullFunnel
 *
 * Wide horizontal funnel rendered by the shared FunnelChart.
 *
 * Stage names, counts and rates are whatever the API returns — nothing here
 * knows or checks what the stages are called, so the backend is free to change
 * them (it recently moved to Visited / Signed up / Used a Pro feature / Paid)
 * without a frontend edit. Do not reintroduce a hardcoded stage list.
 *
 * The click-to-drill-down overlay was removed. It positioned invisible buttons
 * over the chart using a guessed 68px-per-step constant, so the hit targets
 * drifted out of alignment with the bars they claimed to represent; and the
 * `funnelStep` filter it emitted is not a real filter — buildQueryString in
 * lib/data/fetchers/admin-analytics.ts sends only tier, device, source, dates
 * and traffic, and AnalyticsQueryDto has no funnelStep field. The click
 * refetched the same numbers and added a chip that filtered nothing.
 */

"use client";

import { FunnelChart } from "../shared/FunnelChart";
import type { FunnelStep } from "@/lib/data/fetchers/admin-analytics.types";

interface FullFunnelProps {
  steps: FunnelStep[];
}

export function FullFunnel({ steps }: FullFunnelProps) {
  if (!steps || steps.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-on-surface-variant">
        No funnel data available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <FunnelChart steps={steps} />
      <p className="text-xs text-on-surface-variant">
        Each stage is counted independently rather than as a strict subset of
        the one above it, and the paid stage reflects current active
        subscriptions rather than upgrades inside the selected window. Read the
        step-to-step rates as indicative, not as exact conversion rates.
      </p>
    </div>
  );
}
