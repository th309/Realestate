import { ReactNode } from "react";
import { PipelineStatus } from "../../lib/content-pipeline-api";

interface Stage {
  label: string;
  matchesStatus: (s: PipelineStatus) => boolean;
}

/**
 * The infographic lane is a different pipeline, not a shorter video one: no
 * script, no voice, no render, and it ends on the local worker rather than at a
 * platform. Given the video stages it would draw seven inert dots and read as a
 * run stalled before "Writing script", so it gets its own track.
 */
const INFOGRAPHIC_STAGES: Stage[] = [
  { label: "Starting up", matchesStatus: (s) => s === "queued" },
  {
    label: "Generating graphic",
    matchesStatus: (s) => s === "generating_infographic",
  },
  { label: "Graphic ready", matchesStatus: (s) => s === "infographic_ready" },
];

const VIDEO_STAGES: Stage[] = [
  {
    label: "Starting up",
    matchesStatus: (s) => s === "queued" || s === "fetching_data",
  },
  { label: "Writing script", matchesStatus: (s) => s === "scripting" },
  {
    label: "Fact-checking",
    matchesStatus: (s) => s === "verifying_data" || s === "linting_voice",
  },
  { label: "Recording voice", matchesStatus: (s) => s === "rendering_voice" },
  {
    label: "Rendering video",
    matchesStatus: (s) => s === "timing_captions" || s === "rendering_video",
  },
  { label: "Uploading", matchesStatus: (s) => s === "publishing" },
  {
    label: "Live",
    matchesStatus: (s) => s === "published" || s === "published_partial",
  },
];

/**
 * Which track a run is on. Format decides it rather than status, so a queued
 * infographic run shows its own lane from the first paint instead of starting
 * on the video track and jumping across once the worker picks it up.
 */
function stagesForRun(format: string | undefined, status: PipelineStatus) {
  if (format === "infographic") return INFOGRAPHIC_STAGES;
  return INFOGRAPHIC_STAGES.some((stage) => stage.matchesStatus(status)) &&
    status !== "queued"
    ? INFOGRAPHIC_STAGES
    : VIDEO_STAGES;
}

export function PipelineVisualization({
  status,
  format,
  eventsByType,
  trailing,
}: {
  status: PipelineStatus;
  /** Run format — picks the stage track. */
  format?: string;
  eventsByType: Map<string, string>;
  trailing?: ReactNode;
}) {
  const stages = stagesForRun(format, status);
  const currentIdx = stages.findIndex((st) => st.matchesStatus(status));
  return (
    <div className="flex items-center gap-3 overflow-x-auto py-6">
      {stages.map((stage, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <div key={stage.label} className="flex items-center gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`w-4 h-4 rounded-full ${done ? "bg-accent" : active ? "bg-primary animate-pulse" : "bg-outline"}`}
              />
              <div className="text-xs mt-2 font-medium whitespace-nowrap">
                {stage.label}
              </div>
              <div className="text-xs text-outline">
                {eventsByType.get(stage.label) ?? ""}
              </div>
            </div>
            {idx < stages.length - 1 && (
              <div
                className={`w-16 h-0.5 ${done ? "bg-accent" : "bg-outline"}`}
              />
            )}
          </div>
        );
      })}
      {trailing && <div className="ml-4 shrink-0">{trailing}</div>}
    </div>
  );
}
