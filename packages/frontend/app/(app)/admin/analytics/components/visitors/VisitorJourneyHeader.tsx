/**
 * VisitorJourneyHeader
 *
 * The summary above a visitor's timeline: where they came from, who they are
 * to us, and what the relationship adds up to.
 *
 * Acquisition leads, because it is the question the tab exists to answer. Every
 * value here comes from the visitor row — nothing personal is inferred, and the
 * two identifiers are shown truncated with the full value in a tooltip.
 */

"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { VisitorSummary } from "@/lib/data/fetchers/admin-analytics.types";
import {
  formatEngagedTime,
  formatRelationshipSpan,
  formatTimestamp,
  humanizeToken,
  truncateIdentifier,
} from "../../utils/visitorJourneyFormat";

interface VisitorJourneyHeaderProps {
  visitor: VisitorSummary;
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-lg font-medium text-on-surface tabular-nums leading-tight">
        {value}
      </p>
      <p className="text-xs text-on-surface-variant">{label}</p>
    </div>
  );
}

export function VisitorJourneyHeader({ visitor }: VisitorJourneyHeaderProps) {
  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 shadow-sm">
      <div className="flex items-start gap-3 flex-wrap mb-4">
        <div className="min-w-0">
          {/* The acquisition story, stated as a sentence rather than a table. */}
          <p className="flex items-center gap-2 flex-wrap text-sm text-on-surface-variant">
            <span>Arrived from</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary-container text-on-primary-container">
              {visitor.source
                ? humanizeToken(visitor.source)
                : "Unknown source"}
            </span>
            {visitor.entryType && visitor.entryType !== visitor.source && (
              <span className="text-xs opacity-70">
                ({humanizeToken(visitor.entryType)})
              </span>
            )}
            <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          </p>
          <p
            className="font-mono text-sm text-on-surface mt-1 break-all"
            title={visitor.landingPage ?? undefined}
          >
            {visitor.landingPage ?? "No landing page recorded"}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {visitor.converted && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-tertiary-container text-on-tertiary-container">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              Converted
            </span>
          )}
          {visitor.userTier && (
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-surface-container-high text-on-surface-variant">
              {humanizeToken(visitor.userTier)}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 pt-3 border-t border-outline-variant">
        <Figure value={visitor.sessions.toLocaleString()} label="Sessions" />
        <Figure value={visitor.pageviews.toLocaleString()} label="Pageviews" />
        <Figure
          value={visitor.interactions.toLocaleString()}
          label="Interactions"
        />
        <Figure
          value={formatEngagedTime(visitor.totalSeconds)}
          label="Engaged time"
        />
        <Figure value={formatRelationshipSpan(visitor)} label="Relationship" />
      </div>

      <div className="flex gap-x-4 gap-y-1 flex-wrap mt-3 pt-3 border-t border-outline-variant text-xs text-on-surface-variant">
        <span>
          <span className="opacity-70">First seen </span>
          {formatTimestamp(visitor.firstSeen)}
        </span>
        <span>
          <span className="opacity-70">Last seen </span>
          {formatTimestamp(visitor.lastSeen)}
        </span>
        <span className="font-mono" title={visitor.visitorId}>
          <span className="opacity-70 font-sans">Visitor </span>
          {truncateIdentifier(visitor.visitorId)}
        </span>
        {visitor.userId && (
          <span className="font-mono" title={visitor.userId}>
            <span className="opacity-70 font-sans">Account </span>
            {truncateIdentifier(visitor.userId)}
          </span>
        )}
      </div>
    </div>
  );
}
