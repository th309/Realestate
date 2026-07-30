/**
 * VisitorTimelineSession
 *
 * One session inside a visitor's journey: a header stating how the session
 * began, then its events on a vertical rail.
 */

"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Eye,
  Flag,
  Lock,
  LogIn,
  MousePointerClick,
} from "lucide-react";
import type { VisitorTimelineEntry } from "@/lib/data/fetchers/admin-analytics.types";
import {
  describeTimelineEntry,
  formatClockTime,
  formatGapBetween,
  formatEngagedTime,
  formatTimestamp,
  humanizeToken,
  isConversionEntry,
  readSessionMeta,
  type SessionGroup,
} from "../../utils/visitorJourneyFormat";

interface VisitorTimelineSessionProps {
  group: SessionGroup;
  /** End of the previous session, for the "N days later" gap. */
  previousSessionEndedAt: string | null;
  /** The last session in the timeline — its final event is the drop-off point. */
  isLastSession: boolean;
}

type NodeTone = "neutral" | "primary" | "conversion" | "warning" | "error";

const TONE_CLASSES: Record<NodeTone, string> = {
  neutral: "bg-surface-container-high text-on-surface-variant",
  primary: "bg-primary-container text-on-primary-container",
  conversion: "bg-tertiary-container text-on-tertiary-container",
  warning: "bg-warning-container text-on-warning-container",
  error: "bg-error-container text-on-error-container",
};

function nodeAppearance(entry: VisitorTimelineEntry): {
  Icon: React.ComponentType<{ className?: string }>;
  tone: NodeTone;
} {
  if (isConversionEntry(entry))
    return { Icon: CheckCircle2, tone: "conversion" };

  switch (entry.eventCategory) {
    case "pageview":
      return { Icon: Eye, tone: "neutral" };
    case "feature":
      return { Icon: MousePointerClick, tone: "primary" };
    case "paywall":
      return { Icon: Lock, tone: "warning" };
    case "error":
      return { Icon: AlertTriangle, tone: "error" };
    case "auth":
      return { Icon: LogIn, tone: "primary" };
    default:
      return { Icon: Circle, tone: "neutral" };
  }
}

/** One fact in the session header. Rendered only when the value is real. */
function MetaItem({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <span className="text-xs text-on-surface-variant">
      <span className="opacity-70">{label} </span>
      <span className="text-on-surface">{value}</span>
    </span>
  );
}

export function VisitorTimelineSession({
  group,
  previousSessionEndedAt,
  isLastSession,
}: VisitorTimelineSessionProps) {
  const meta = readSessionMeta(group.sessionStart);
  const gap = previousSessionEndedAt
    ? formatGapBetween(previousSessionEndedAt, group.startedAt)
    : "";
  const landingPage = group.sessionStart?.pagePath ?? null;
  const device = [meta.deviceType, meta.browser].filter(Boolean).join(" · ");

  return (
    <li className="relative">
      {gap && (
        <p className="text-xs text-on-surface-variant italic pl-2 pb-2">
          {gap}
        </p>
      )}

      <div className="rounded-xl border border-outline-variant bg-surface-container-low overflow-hidden">
        <header className="px-4 py-3 bg-surface-container border-b border-outline-variant">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h4 className="text-sm font-medium text-on-surface">
              Session {group.index}
            </h4>
            <time
              className="text-xs text-on-surface-variant"
              dateTime={group.startedAt}
            >
              {formatTimestamp(group.startedAt)}
            </time>
            {meta.entryType && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary-container text-on-primary-container">
                {humanizeToken(meta.entryType)}
              </span>
            )}
          </div>

          {landingPage && (
            <p
              className="font-mono text-xs text-on-surface mt-1.5 truncate"
              title={landingPage}
            >
              Landed on {landingPage}
            </p>
          )}

          <div className="flex gap-x-4 gap-y-1 flex-wrap mt-1.5">
            <MetaItem label="From" value={meta.referrerDomain} />
            <MetaItem label="Campaign" value={meta.utmSource} />
            <MetaItem label="On" value={device || null} />
            <MetaItem
              label="Lasted"
              value={
                meta.durationSeconds !== null
                  ? formatEngagedTime(meta.durationSeconds)
                  : null
              }
            />
          </div>

          {/* Absent when the row cap cut off the session's opening row. Said
              plainly, because a missing header is not the same as a direct visit. */}
          {!group.sessionStart && (
            <p className="text-xs text-on-surface-variant mt-1.5 italic">
              Session start not in range — showing activity only.
            </p>
          )}
        </header>

        <ol className="px-4 py-3 space-y-0">
          {group.nodes.length === 0 && (
            <li className="text-xs text-on-surface-variant py-1">
              No events recorded in this session.
            </li>
          )}

          {group.nodes.map((node, index) => {
            const { Icon, tone } = nodeAppearance(node.entry);
            const description = describeTimelineEntry(node.entry);
            const isLastNode = index === group.nodes.length - 1;
            const isDropOff = isLastSession && isLastNode;

            return (
              <li key={node.key} className="relative flex gap-3 pb-3 last:pb-0">
                {/* Rail. Stops at the final node so the journey visibly ends. */}
                {!isLastNode && (
                  <span
                    aria-hidden="true"
                    className="absolute left-3 top-6 bottom-0 w-px bg-outline-variant"
                  />
                )}

                <span
                  className={`relative z-10 shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${TONE_CLASSES[tone]}`}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                </span>

                <div className="min-w-0 flex-1 flex items-baseline gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-on-surface">
                      {description.title}
                      {node.repeatCount > 1 && (
                        <span className="ml-1.5 text-xs text-on-surface-variant tabular-nums">
                          ×{node.repeatCount}
                        </span>
                      )}
                      {isConversionEntry(node.entry) && (
                        <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-tertiary-container text-on-tertiary-container">
                          Conversion
                        </span>
                      )}
                    </p>
                    {description.path && (
                      <p
                        className="font-mono text-xs text-on-surface-variant truncate"
                        title={description.path}
                      >
                        {description.path}
                      </p>
                    )}
                    {isDropOff && (
                      <p className="inline-flex items-center gap-1 mt-1 text-xs text-on-surface-variant">
                        <Flag className="w-3 h-3" aria-hidden="true" />
                        Last recorded activity
                      </p>
                    )}
                  </div>

                  <time
                    className="shrink-0 text-xs text-on-surface-variant tabular-nums"
                    dateTime={node.entry.occurredAt}
                  >
                    {formatClockTime(node.entry.occurredAt)}
                  </time>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </li>
  );
}
