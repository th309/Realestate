"use client";

import { Info } from "lucide-react";

/**
 * Explicit "this is a mock, not live data" label for the pricing feature
 * showcase.
 *
 * The showcase renders sample Nashville product panels — prices, days on
 * market, PropertyIQ Scores, and a metro → county → ZIP drill-down — as static
 * JSX. Those figures are hand-written examples, NOT values fetched from
 * `@/lib/data`, so every panel that contains one must carry this label. A
 * marketing page charging for institutional-grade analysis cannot present
 * invented numbers as if they were live readings.
 *
 * If a panel is ever wired to real data via `@/lib/data`, drop this note from
 * it rather than leaving a misleading disclaimer behind.
 */
export function IllustrativeNote({ detail }: { detail?: string }) {
  return (
    <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-surface-container-high px-2.5 py-1.5 text-[10px] leading-snug text-on-surface-variant/70">
      <Info className="w-3 h-3 shrink-0 mt-px" aria-hidden="true" />
      <span>
        <strong className="font-semibold">Illustrative example.</strong>{" "}
        {detail ??
          "Sample figures, not live Nashville data — open the market page for current numbers."}
      </span>
    </p>
  );
}
