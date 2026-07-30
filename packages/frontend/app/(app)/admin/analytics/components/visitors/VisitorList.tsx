/**
 * VisitorList
 *
 * The master pane: who came, in order of most recent activity. Owns the
 * loading, error, empty and truncated states for its own pane so the detail
 * pane can render independently of them.
 */

"use client";

import { Users } from "lucide-react";
import type { VisitorSummary } from "@/lib/data/fetchers/admin-analytics.types";
import { EmptyState } from "../shared/EmptyState";
import { VisitorListRow } from "./VisitorListRow";

interface VisitorListProps {
  visitors: VisitorSummary[];
  selectedVisitorId: string | null;
  onSelect: (visitorId: string) => void;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  truncated: boolean;
  limit: number;
  onlyConverted: boolean;
  onOnlyConvertedChange: (value: boolean) => void;
}

function ListSkeleton() {
  return (
    <ul className="divide-y divide-outline-variant/50">
      {Array.from({ length: 6 }).map((_, index) => (
        <li key={index} className="px-4 py-3">
          <div className="flex gap-2 mb-2">
            <div className="h-4 w-20 rounded-full bg-outline-variant/30 animate-pulse" />
            <div className="h-4 w-14 rounded-full bg-outline-variant/20 animate-pulse" />
          </div>
          <div className="h-3 w-2/3 rounded bg-outline-variant/30 animate-pulse mb-2" />
          <div className="h-3 w-1/2 rounded bg-outline-variant/20 animate-pulse" />
        </li>
      ))}
    </ul>
  );
}

export function VisitorList({
  visitors,
  selectedVisitorId,
  onSelect,
  isLoading,
  isError,
  errorMessage,
  truncated,
  limit,
  onlyConverted,
  onOnlyConvertedChange,
}: VisitorListProps) {
  return (
    <section
      aria-label="Visitors"
      className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden flex flex-col"
    >
      <header className="px-4 py-3 border-b border-outline-variant flex items-center gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-on-surface">Visitors</h3>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {isLoading
              ? "Loading…"
              : `${visitors.length.toLocaleString()} most recently active`}
          </p>
        </div>

        {/* A filter chip, M3-style: pressed state carries the meaning. */}
        <button
          type="button"
          onClick={() => onOnlyConvertedChange(!onlyConverted)}
          aria-pressed={onlyConverted}
          className={`ml-auto shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            onlyConverted
              ? "bg-secondary-container text-on-secondary-container border-transparent"
              : "border-outline text-on-surface-variant hover:bg-surface-container"
          }`}
        >
          Converted only
        </button>
      </header>

      <div className="overflow-y-auto max-h-[36rem] lg:max-h-[calc(100vh-20rem)]">
        {isLoading ? (
          <ListSkeleton />
        ) : isError ? (
          <EmptyState
            title="Could not load visitors"
            description={
              errorMessage ?? "The visitor list request failed. Try again."
            }
          />
        ) : visitors.length === 0 ? (
          <EmptyState
            icon={<Users className="w-6 h-6" />}
            title={onlyConverted ? "No conversions yet" : "No visitors"}
            description={
              onlyConverted
                ? "Nobody completed a signup in this window. Clear the converted filter to see everyone who visited."
                : "No visitors matched this window and traffic segment. Try a longer date range, or switch the traffic segment above."
            }
          />
        ) : (
          <ul className="divide-y divide-outline-variant/50">
            {visitors.map((visitor) => (
              <VisitorListRow
                key={visitor.visitorId}
                visitor={visitor}
                isSelected={visitor.visitorId === selectedVisitorId}
                onSelect={onSelect}
              />
            ))}
          </ul>
        )}
      </div>

      {truncated && !isLoading && (
        <p className="px-4 py-2 text-xs text-on-surface-variant border-t border-outline-variant bg-surface-container-low">
          Showing the {limit.toLocaleString()} most recently active. More
          visitors exist in this window.
        </p>
      )}
    </section>
  );
}
