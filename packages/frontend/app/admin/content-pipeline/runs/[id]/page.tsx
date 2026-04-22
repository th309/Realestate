"use client";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { fetchRun } from "../../lib/content-pipeline-api";
import { PipelineVisualization } from "./pipeline-visualization";
import { EventLog } from "./event-log";
import { ArtifactsPanel } from "./artifacts-panel";

const TERMINAL = [
  "published",
  "published_partial",
  "failed",
  "rejected",
  "ready_for_review",
];

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data } = useQuery({
    queryKey: ["content-pipeline-run", id],
    queryFn: () => fetchRun(id),
    refetchInterval: (q) =>
      TERMINAL.includes(q.state.data?.run?.status ?? "") ? false : 2000,
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

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{data.run.market_query}</h1>
        <p className="text-sm text-outline">
          {data.run.format} | {data.run.approval_mode}
        </p>
      </div>

      <PipelineVisualization
        status={data.run.status}
        eventsByType={eventsByType}
      />

      <div className="grid grid-cols-[1fr_320px] gap-6">
        <ArtifactsPanel assets={data.assets} />
        <div className="rounded-xl bg-surface-container-low p-4 shadow-sm">
          <h3 className="font-semibold mb-3 text-sm">Activity</h3>
          <EventLog events={data.events} />
        </div>
      </div>
    </div>
  );
}
