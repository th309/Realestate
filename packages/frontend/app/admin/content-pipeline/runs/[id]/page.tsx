"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { cancelRun, fetchRun, retryRun } from "../../lib/content-pipeline-api";
import { PipelineVisualization } from "./pipeline-visualization";
import { EventLog } from "./event-log";
import { ArtifactsPanel } from "./artifacts-panel";
import { GateReviewCallout } from "./gate-review-callout";

// Stop auto-refetch in these states — polling isn't useful because the run
// either won't advance without operator input (ready_for_review) or has hit
// a terminal state.
const DONE_POLLING = [
  "published",
  "published_partial",
  "failed",
  "rejected",
  "ready_for_review",
  "cancelled",
];

// Cancel is allowed from any non-terminal state, including ready_for_review —
// an operator reviewing a run may decide to abort rather than approve/reject.
const TRULY_TERMINAL = [
  "published",
  "published_partial",
  "failed",
  "rejected",
  "cancelled",
];

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["content-pipeline-run", id],
    queryFn: () => fetchRun(id),
    refetchInterval: (q) =>
      DONE_POLLING.includes(q.state.data?.run?.status ?? "") ? false : 2000,
  });

  const retryMutation = useMutation({
    mutationFn: () => retryRun(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["content-pipeline-run", id] }),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelRun(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["content-pipeline-run", id] }),
  });

  if (!data) return <div className="p-8">Loading...</div>;

  const eventsByType = new Map<string, string>();
  for (const e of data.events as any[]) {
    if (e.event_type === "status_changed" && e.payload?.to) {
      eventsByType.set(
        e.payload.to,
        new Date(e.created_at).toLocaleTimeString(),
      );
    }
  }

  const isFailed = data.run.status === "failed";
  const canCancel = !TRULY_TERMINAL.includes(data.run.status);

  function handleCancelClick() {
    if (
      window.confirm(
        "Cancel this run? In-flight steps will finish their current work but nothing new will run. Assets already produced stay in storage. This can't be undone — a cancelled run cannot be resumed.",
      )
    ) {
      cancelMutation.mutate();
    }
  }

  return (
    <div className="p-8 space-y-6">
      <Link
        href="/admin/content-pipeline"
        className="text-sm text-primary hover:underline inline-block"
      >
        ← Back to dashboard
      </Link>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{data.run.market_query}</h1>
          <p className="text-sm text-outline">
            {data.run.format} | {data.run.approval_mode}
          </p>
          {data.run.status_reason && (
            <p className="text-sm text-error mt-1">
              Reason: {data.run.status_reason}
            </p>
          )}
        </div>
        {isFailed && (
          <button
            type="button"
            onClick={() => retryMutation.mutate()}
            disabled={retryMutation.isPending}
            className="bg-primary text-on-primary rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {retryMutation.isPending ? "Retrying…" : "Retry run"}
          </button>
        )}
      </div>

      <GateReviewCallout
        runId={id}
        status={data.run.status}
        statusReason={data.run.status_reason}
        gates={data.gates}
      />

      <PipelineVisualization
        status={data.run.status}
        eventsByType={eventsByType}
        trailing={
          canCancel ? (
            <button
              type="button"
              onClick={handleCancelClick}
              disabled={cancelMutation.isPending}
              className="bg-error text-on-error rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {cancelMutation.isPending ? "Cancelling…" : "Cancel run"}
            </button>
          ) : null
        }
      />

      <div className="grid grid-cols-[1fr_320px] gap-6">
        <ArtifactsPanel runId={id} assets={data.assets} />
        <div className="rounded-xl bg-surface-container-low p-4 shadow-sm">
          <h3 className="font-semibold mb-3 text-sm">Activity</h3>
          <EventLog events={data.events} />
        </div>
      </div>
    </div>
  );
}
