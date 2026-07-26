"use client";
import type { InfographicRunPlan } from "./helpers/infographic-params";

/**
 * Confirm-step summary for an infographic run — the video summary's counterpart.
 * Reads back the one task the graphic will cover, and where the finished PNG
 * will show up, so nothing about the run is a surprise after submitting.
 */
export function InfographicSummary({
  plan,
  outcomeLine,
}: {
  plan: InfographicRunPlan;
  outcomeLine: string;
}) {
  return (
    <>
      <h1 className="text-2xl font-semibold mb-1">Infographic</h1>
      <p className="text-sm text-on-surface-variant mb-4">{plan.topicTitle}</p>
      <dl className="mb-4 space-y-2 text-sm">
        <div className="flex gap-3">
          <dt className="w-16 shrink-0 text-on-surface-variant">Task</dt>
          <dd className="flex-1 font-medium">
            <span className="mr-2 font-mono text-xs tabular-nums text-on-surface-variant">
              {String(plan.params.task_number).padStart(2, "0")}
            </span>
            {plan.taskLabel}
          </dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-16 shrink-0 text-on-surface-variant">Style</dt>
          <dd className="flex-1 font-medium">{plan.styleLabel}</dd>
        </div>
      </dl>
      <p className="mb-3">We will:</p>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>Cover only this one task — never bundle tasks onto one graphic</li>
        <li>Use only facts from the vetted topic doc</li>
        <li>Generate the graphic on the local worker (this is not instant)</li>
        <li>Put the finished PNG in Review for your check</li>
        <li>{outcomeLine}</li>
      </ul>
    </>
  );
}
