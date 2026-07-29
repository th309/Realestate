import { ReactNode } from "react";
import { PipelineStatus } from "../../lib/content-pipeline-api";

interface Stage {
  label: string;
  /**
   * Raw pipeline statuses this stage covers. Kept as data rather than a
   * predicate so the same list can resolve the stage's timestamp out of
   * `eventsByType`, which is keyed by raw status.
   */
  statuses: PipelineStatus[];
}

/**
 * Statuses where the run has stopped and will not advance on its own. None of
 * them belong to a stage — they describe how a run left the track, not where it
 * is on it — so progress is read from the event history instead.
 */
const HALTED_STATUSES: Record<
  string,
  { tone: "error" | "waiting"; note: string }
> = {
  ready_for_review: { tone: "waiting", note: "Waiting on you" },
  failed: { tone: "error", note: "Failed" },
  rejected: { tone: "error", note: "Rejected" },
  cancelled: { tone: "error", note: "Cancelled" },
};

/**
 * The infographic lane is a different pipeline, not a shorter video one: no
 * script, no voice, no render, and it ends on the local worker rather than at a
 * platform. Given the video stages it would draw seven inert dots and read as a
 * run stalled before "Writing script", so it gets its own track.
 */
const INFOGRAPHIC_STAGES: Stage[] = [
  { label: "Starting up", statuses: ["queued"] },
  { label: "Generating graphic", statuses: ["generating_infographic"] },
  { label: "Graphic ready", statuses: ["infographic_ready"] },
];

const VIDEO_STAGES: Stage[] = [
  { label: "Starting up", statuses: ["queued", "fetching_data"] },
  { label: "Writing script", statuses: ["scripting"] },
  { label: "Fact-checking", statuses: ["verifying_data", "linting_voice"] },
  { label: "Recording voice", statuses: ["rendering_voice"] },
  {
    label: "Rendering video",
    statuses: ["timing_captions", "rendering_video"],
  },
  { label: "Uploading", statuses: ["publishing"] },
  { label: "Live", statuses: ["published", "published_partial"] },
];

/**
 * Which track a run is on. Format decides it rather than status, so a queued
 * infographic run shows its own lane from the first paint instead of starting
 * on the video track and jumping across once the worker picks it up.
 */
function stagesForRun(format: string | undefined, status: PipelineStatus) {
  if (format === "infographic") return INFOGRAPHIC_STAGES;
  return INFOGRAPHIC_STAGES.some((stage) => stage.statuses.includes(status)) &&
    status !== "queued"
    ? INFOGRAPHIC_STAGES
    : VIDEO_STAGES;
}

/** One status the run entered, and when. Chronological, oldest first. */
export interface StatusEntry {
  status: PipelineStatus;
  at: string;
}

/** Most recent time each stage was entered — stages can repeat after an edit. */
function stageTimestamps(
  stages: Stage[],
  history: StatusEntry[],
): Map<string, string> {
  const byStage = new Map<string, string>();
  for (const entry of history) {
    const stage = stages.find((st) => st.statuses.includes(entry.status));
    if (stage) byStage.set(stage.label, entry.at);
  }
  return byStage;
}

/**
 * How far the run actually got.
 *
 * While the run is live its status matches a stage directly. Once it halts
 * (`failed`, `ready_for_review`, …) nothing matches, and the track used to
 * render every dot inert — a run that had rendered video and was sitting in
 * review looked identical to one that had never started.
 *
 * For halted runs the position comes from the LAST stage entered
 * chronologically, not the furthest one reached. Those differ now that an
 * operator edit can send a run backwards: a run that got to "Rendering video",
 * was edited back to fact-check, and then failed during voice lint halted at
 * "Fact-checking" even though "Rendering video" appears in its history. Ordering
 * by stage index would point at the wrong dot.
 */
function resolveProgress(
  stages: Stage[],
  status: PipelineStatus,
  history: StatusEntry[],
): { currentIdx: number; halted: boolean } {
  const liveIdx = stages.findIndex((st) => st.statuses.includes(status));
  if (liveIdx !== -1) return { currentIdx: liveIdx, halted: false };

  for (let i = history.length - 1; i >= 0; i--) {
    const idx = stages.findIndex((st) =>
      st.statuses.includes(history[i].status),
    );
    if (idx !== -1) return { currentIdx: idx, halted: true };
  }
  return { currentIdx: -1, halted: true };
}

export function PipelineVisualization({
  status,
  format,
  statusHistory,
  trailing,
}: {
  status: PipelineStatus;
  /** Run format — picks the stage track. */
  format?: string;
  /** Every status the run entered, oldest first, from its status_changed events. */
  statusHistory: StatusEntry[];
  trailing?: ReactNode;
}) {
  const stages = stagesForRun(format, status);
  const { currentIdx, halted } = resolveProgress(stages, status, statusHistory);
  const timestamps = stageTimestamps(stages, statusHistory);
  const haltInfo = HALTED_STATUSES[status];

  return (
    <div className="flex items-center gap-3 overflow-x-auto py-6">
      {stages.map((stage, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        // A halted run stopped ON this stage rather than working through it, so
        // it reads as error/attention, never as the pulsing in-progress dot.
        const dotTone =
          active && halted && haltInfo
            ? haltInfo.tone === "error"
              ? "bg-error"
              : "bg-warning"
            : active
              ? "bg-primary animate-pulse"
              : done
                ? "bg-accent"
                : "bg-outline";
        return (
          <div key={stage.label} className="flex items-center gap-3">
            <div className="flex flex-col items-center">
              <div className={`h-4 w-4 rounded-full ${dotTone}`} />
              <div className="mt-2 whitespace-nowrap text-xs font-medium">
                {stage.label}
              </div>
              <div className="text-xs text-outline">
                {timestamps.get(stage.label) ?? ""}
              </div>
            </div>
            {idx < stages.length - 1 && (
              <div
                className={`h-0.5 w-16 ${done ? "bg-accent" : "bg-outline"}`}
              />
            )}
          </div>
        );
      })}
      {halted && haltInfo && (
        <div
          className={`ml-2 shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
            haltInfo.tone === "error"
              ? "bg-error-container text-on-surface"
              : "bg-warning-container text-on-surface"
          }`}
        >
          {haltInfo.note}
        </div>
      )}
      {trailing && <div className="ml-4 shrink-0">{trailing}</div>}
    </div>
  );
}
