/**
 * VisitorJourneyPanel
 *
 * The detail pane: one visitor's whole relationship, session by session.
 *
 * Fetches through useVisitorTimeline from @/lib/data — the hook owns the query
 * key, so reopening a visitor resolves from cache rather than re-pulling a
 * 500-row timeline.
 */

"use client";

import { ArrowLeft, MousePointer2, Route } from "lucide-react";
import { useMemo } from "react";
import { useVisitorTimeline } from "@/lib/data";
import type { VisitorSummary } from "@/lib/data/fetchers/admin-analytics.types";
import { EmptyState } from "../shared/EmptyState";
import { SkeletonLoader } from "../shared/SkeletonLoader";
import { VisitorJourneyHeader } from "./VisitorJourneyHeader";
import { VisitorTimelineSession } from "./VisitorTimelineSession";
import { groupTimelineBySession } from "../../utils/visitorJourneyFormat";

interface VisitorJourneyPanelProps {
  visitor: VisitorSummary | null;
  /** Shown on small screens, where the two panes take turns. */
  onBack: () => void;
}

export function VisitorJourneyPanel({
  visitor,
  onBack,
}: VisitorJourneyPanelProps) {
  const { data, isLoading, isError, error } = useVisitorTimeline(
    visitor?.visitorId ?? null,
  );

  const sessions = useMemo(
    () => groupTimelineBySession(data?.entries ?? []),
    [data],
  );

  if (!visitor) {
    return (
      <div className="bg-surface-container-low border border-outline-variant rounded-xl">
        <EmptyState
          icon={<MousePointer2 className="w-6 h-6" />}
          title="Select a visitor"
          description="Pick someone from the list to follow their journey end to end — where they arrived from, every session since, and where they stopped."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        All visitors
      </button>

      <VisitorJourneyHeader visitor={visitor} />

      {isLoading ? (
        <div className="space-y-4">
          <SkeletonLoader variant="table" />
          <SkeletonLoader variant="table" />
        </div>
      ) : isError ? (
        <div className="bg-surface-container-low border border-outline-variant rounded-xl">
          <EmptyState
            title="Could not load this journey"
            description={
              error instanceof Error
                ? error.message
                : "The timeline request failed. Try selecting the visitor again."
            }
          />
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-surface-container-low border border-outline-variant rounded-xl">
          <EmptyState
            icon={<Route className="w-6 h-6" />}
            title="No recorded activity"
            description="This visitor has a session but no events attached to it, so there is nothing to sequence."
          />
        </div>
      ) : (
        <>
          <ol className="space-y-4" aria-label="Visitor journey">
            {sessions.map((group, index) => (
              <VisitorTimelineSession
                key={group.sessionId}
                group={group}
                previousSessionEndedAt={
                  index > 0 ? lastMomentOf(sessions[index - 1]) : null
                }
                isLastSession={index === sessions.length - 1}
              />
            ))}
          </ol>

          {/* The RPC orders ascending then caps, so a full page means the
              journey continues. Saying so keeps a cut-off relationship from
              reading as a completed one. */}
          {data?.truncated && (
            <p className="text-xs text-on-surface-variant text-center py-2">
              Showing the first {data.limit.toLocaleString()} moments of this
              journey. It continues beyond this point.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** When a session's activity stopped, for the gap to the next one. */
function lastMomentOf(group: {
  startedAt: string;
  nodes: { entry: { occurredAt: string } }[];
}): string {
  return group.nodes.length > 0
    ? group.nodes[group.nodes.length - 1].entry.occurredAt
    : group.startedAt;
}
