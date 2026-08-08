"use client";

import type { ComponentProps } from "react";
import { GradingResultPanel } from "./GradingResultPanel";

type PanelProps = ComponentProps<typeof GradingResultPanel>;

interface GradingBlockProps extends Omit<PanelProps, "result"> {
  /** Undefined until the grading query resolves. */
  result: PanelProps["result"] | undefined;
  isLoading: boolean;
}

/**
 * Loading wrapper around `GradingResultPanel`, which renders the pulse
 * skeleton while the grading query is in flight. The `verdict`, `grading` and
 * `improve` jump-bar anchors live inside the panel itself, on the exact blocks
 * they name. Extracted from `AnalyzerClient.tsx` to keep that component under
 * the §1.3 400-line cap.
 */
export function GradingBlock({
  result,
  isLoading,
  ...panelProps
}: GradingBlockProps) {
  return (
    <div>
      {result ? (
        <GradingResultPanel result={result} {...panelProps} />
      ) : isLoading ? (
        <div
          className="rounded-2xl border border-outline-variant bg-surface p-6 animate-pulse"
          aria-busy="true"
          role="status"
        >
          <div className="h-24 w-24 rounded-xl bg-surface-container-high" />
          <div className="mt-4 h-6 w-32 rounded bg-surface-container-high" />
          <div className="mt-2 h-4 w-64 rounded bg-surface-container-high" />
        </div>
      ) : null}
    </div>
  );
}
