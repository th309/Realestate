"use client";

import Link from "next/link";
import { DiffViewer } from "../../review/diff-viewer";
import { useResumePipelineFromReview } from "../../lib/use-run-mutations";

type GateRow = {
  gate: string;
  result: string;
  details?: {
    violations?: unknown[];
    confidence_violations?: unknown[];
    waived_violations?: unknown[];
  };
};

function latestFailedGate(
  gates: GateRow[] | undefined,
  gateId: string,
): GateRow | undefined {
  if (!gates?.length) return undefined;
  for (let i = gates.length - 1; i >= 0; i--) {
    const g = gates[i];
    if (g?.gate === gateId && g.result === "failed") return g;
  }
  return undefined;
}

export function GateReviewCallout({
  runId,
  status,
  statusReason,
  gates,
}: {
  runId: string;
  status: string;
  statusReason: string | null | undefined;
  gates: GateRow[] | undefined;
}) {
  const resumeMut = useResumePipelineFromReview();

  if (status !== "ready_for_review") return null;

  const gateAFail = latestFailedGate(gates, "data_verifier");
  const gateBFail = latestFailedGate(gates, "brand_voice_linter");
  if (!gateAFail && !gateBFail) return null;

  const reviewHref = `/admin/content-pipeline/review?run=${encodeURIComponent(runId)}`;

  return (
    <section
      className="rounded-xl border border-outline-variant bg-surface-container-low p-5 shadow-sm space-y-4"
      aria-labelledby="gate-review-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="gate-review-heading"
            className="text-base font-semibold text-on-surface"
          >
            Review required before the pipeline can continue
          </h2>
          {statusReason ? (
            <p className="text-sm text-on-surface-variant mt-1">
              Status reason:{" "}
              <span className="font-mono text-on-surface">{statusReason}</span>
            </p>
          ) : null}
          <p className="text-sm text-on-surface mt-2 max-w-2xl">
            Open the review queue to edit lines that failed automated checks, or
            continue without edits to re-queue fact-check (if the latest data
            gate failed) or voice lint on the current script.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={resumeMut.isPending}
            onClick={() => resumeMut.mutate(runId)}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary hover:bg-primary/90 transition-colors duration-200 disabled:opacity-50"
          >
            {resumeMut.isPending ? "Continuing…" : "Continue pipeline"}
          </button>
          <Link
            href={reviewHref}
            className="rounded-full border border-outline-variant bg-surface-container-high px-5 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container-highest transition-colors duration-200"
          >
            Open in review queue
          </Link>
        </div>
      </div>

      {gateAFail ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-on-surface">
            Fact check (Gate A)
          </h3>
          <DiffViewer
            violations={(gateAFail.details?.violations ?? []) as any}
            confidenceViolations={
              gateAFail.details?.confidence_violations as any
            }
            waivedViolations={gateAFail.details?.waived_violations as any}
          />
        </div>
      ) : null}

      {gateBFail ? (
        <div className="rounded-xl border border-error bg-error/5 p-4">
          <h3 className="text-sm font-medium text-error mb-2">
            Brand voice (Gate B)
          </h3>
          <ul className="text-sm space-y-1 text-on-surface">
            {(gateBFail.details?.violations ?? []).map((v: any, i: number) => (
              <li key={i}>
                &quot;{v.claim?.quote ?? v.quote ?? JSON.stringify(v)}&quot;
                {v.claim?.subject ? ` (${v.claim.subject})` : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
