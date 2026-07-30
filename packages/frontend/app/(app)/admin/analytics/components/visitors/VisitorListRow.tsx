/**
 * VisitorListRow
 *
 * One selectable visitor in the master pane. A button rather than a table row:
 * the pane is narrow, the facts are three lines of mixed weight, and a button
 * is focusable and Enter/Space-activated without reimplementing any of it.
 */

"use client";

import { CheckCircle2, MousePointerClick, Clock, Layers } from "lucide-react";
import type { VisitorSummary } from "@/lib/data/fetchers/admin-analytics.types";
import {
  formatEngagedTime,
  formatRelativeFromNow,
  humanizeToken,
  truncateIdentifier,
} from "../../utils/visitorJourneyFormat";

interface VisitorListRowProps {
  visitor: VisitorSummary;
  isSelected: boolean;
  onSelect: (visitorId: string) => void;
}

/** Acquisition source, the first thing worth knowing about a visitor. */
function SourceChip({ source }: { source: string | null }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-container text-on-primary-container max-w-[10rem] truncate">
      {source ? humanizeToken(source) : "Unknown source"}
    </span>
  );
}

function TierChip({ tier }: { tier: string | null }) {
  // No tier is a real state (an anonymous visitor), not missing data.
  if (!tier) return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface-container-high text-on-surface-variant">
      {humanizeToken(tier)}
    </span>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1" title={label}>
      <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
      <span className="tabular-nums">{value}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function VisitorListRow({
  visitor,
  isSelected,
  onSelect,
}: VisitorListRowProps) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(visitor.visitorId)}
        aria-current={isSelected}
        className={`w-full text-left px-4 py-3 transition-colors border-l-[3px] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
          isSelected
            ? "bg-primary-container/40 border-primary"
            : "border-transparent hover:bg-surface-container"
        }`}
      >
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <SourceChip source={visitor.source} />
          <TierChip tier={visitor.userTier} />
          {visitor.converted && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-tertiary-container text-on-tertiary-container">
              <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
              Converted
            </span>
          )}
          <span className="ml-auto text-xs text-on-surface-variant shrink-0">
            {formatRelativeFromNow(visitor.lastSeen)}
          </span>
        </div>

        <p
          className="font-mono text-xs text-on-surface truncate mb-1.5"
          title={visitor.landingPage ?? undefined}
        >
          {visitor.landingPage ?? "No landing page recorded"}
        </p>

        <div className="flex items-center gap-3 text-xs text-on-surface-variant flex-wrap">
          <Stat
            icon={Layers}
            value={visitor.sessions.toLocaleString()}
            label="sessions"
          />
          <Stat
            icon={MousePointerClick}
            value={`${visitor.pageviews.toLocaleString()} / ${visitor.interactions.toLocaleString()}`}
            label="pageviews and interactions"
          />
          <Stat
            icon={Clock}
            value={formatEngagedTime(visitor.totalSeconds)}
            label="engaged time"
          />
          <span
            className="ml-auto font-mono opacity-60"
            title={visitor.visitorId}
          >
            {truncateIdentifier(visitor.visitorId)}
          </span>
        </div>
      </button>
    </li>
  );
}
