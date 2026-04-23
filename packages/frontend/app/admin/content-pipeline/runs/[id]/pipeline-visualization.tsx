import { ReactNode } from "react";
import { PipelineStatus } from "../../lib/content-pipeline-api";

const STAGES: Array<{
  label: string;
  matchesStatus: (s: PipelineStatus) => boolean;
}> = [
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

export function PipelineVisualization({
  status,
  eventsByType,
  trailing,
}: {
  status: PipelineStatus;
  eventsByType: Map<string, string>;
  trailing?: ReactNode;
}) {
  const currentIdx = STAGES.findIndex((st) => st.matchesStatus(status));
  return (
    <div className="flex items-center gap-3 overflow-x-auto py-6">
      {STAGES.map((stage, idx) => {
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
            {idx < STAGES.length - 1 && (
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
