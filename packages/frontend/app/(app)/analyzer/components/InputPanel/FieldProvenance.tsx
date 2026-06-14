"use client";

import { ConfidenceDisplay } from "@/app/components/scoring";
import type { FieldProvenance as FieldProvenanceData } from "../../lib/use-analyzer-state";

interface FieldProvenanceProps {
  data: FieldProvenanceData | undefined;
  /** Current field value, for the divergence warning. */
  current: number | null;
  divergent: boolean;
}

function freshnessDays(asOf: string | null): number {
  if (!asOf) return 999;
  const d = /^\d{4}$/.test(asOf) ? new Date(`${asOf}-12-31`) : new Date(asOf);
  if (Number.isNaN(d.getTime())) return 999;
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 86_400_000));
}

export function FieldProvenance({
  data,
  current,
  divergent,
}: FieldProvenanceProps) {
  if (!data) return null;
  const isEstimate = data.kind === "estimate";

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
      <ConfidenceDisplay
        level={data.confidence.grade}
        percentage={data.confidence.pct}
        metricsAvailable={data.value == null ? 0 : 1}
        metricsTotal={1}
        freshnessInDays={freshnessDays(data.asOf)}
        size="sm"
      />
      <span
        className={
          isEstimate
            ? "text-on-surface-variant italic"
            : "text-on-surface-variant"
        }
      >
        {isEstimate ? "Estimate" : data.source}
        {data.asOf && !isEstimate ? ` · as of ${data.asOf}` : ""}
        {data.inherited ? " · inherited" : ""}
      </span>
      {divergent && (
        <span className="text-warning font-medium">
          {data.baseline != null
            ? `${Math.abs((current ?? 0) / data.baseline).toFixed(1)}× the ${
                isEstimate ? "estimate" : "market value"
              }`
            : "differs sharply from market"}
        </span>
      )}
    </div>
  );
}
