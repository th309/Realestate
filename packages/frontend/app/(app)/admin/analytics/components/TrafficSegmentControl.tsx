/**
 * Which population the dashboard is describing.
 *
 * Deliberately NOT a filter chip. Tier / Device / Source narrow a population;
 * this one decides which population exists at all, and the same tile reads 790
 * or 48,643 depending on it. A collapsed dropdown would hide the answer to
 * "what am I looking at?", so this is a segmented control that always shows the
 * current scope, with the counts stated underneath.
 *
 * The counts are the point. A filtered number and a broken number look
 * identical unless you say what was removed — which is exactly how ~46,000
 * crawler sessions sat on this page for months reading as visitors.
 *
 * Internal is our own browsing, and it is the one segment worth stating even
 * when you never select it: it is human by every behavioural test, so before it
 * was subtracted roughly one in eight "people" on this page was us.
 */

"use client";

import type {
  TrafficSegment,
  TrafficSegmentCounts,
} from "@/lib/data/fetchers/admin-analytics.types";

const SEGMENTS: {
  value: TrafficSegment;
  label: string;
  hint: string;
}[] = [
  {
    value: "human",
    label: "People",
    hint: "Verified human on evidence, excluding our own browsing",
  },
  { value: "bot", label: "Bots", hint: "Classified automated traffic" },
  {
    value: "unclassified",
    label: "Unclassified",
    hint: "Recorded before traffic classification existed — genuinely unknown",
  },
  {
    value: "internal",
    label: "Internal",
    hint: "Our own browsing — admins and the owner, signed in",
  },
  {
    value: "all",
    label: "Everything",
    hint: "All recorded traffic, including our own",
  },
];

function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

export function TrafficSegmentControl({
  value,
  counts,
  onChange,
}: {
  value: TrafficSegment;
  counts?: TrafficSegmentCounts;
  onChange: (segment: TrafficSegment) => void;
}) {
  const active = value ?? "human";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
          Showing
        </span>

        <div
          role="radiogroup"
          aria-label="Traffic segment"
          className="inline-flex rounded-full border border-outline-variant overflow-hidden"
        >
          {SEGMENTS.map((seg) => {
            const isActive = seg.value === active;
            return (
              <button
                key={seg.value}
                type="button"
                role="radio"
                aria-checked={isActive}
                title={seg.hint}
                onClick={() => onChange(seg.value)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  isActive
                    ? "bg-secondary-container text-on-secondary-container"
                    : "bg-surface text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                {seg.label}
              </button>
            );
          })}
        </div>
      </div>

      {counts && counts.total > 0 && (
        <p className="text-xs text-on-surface-variant">
          <SegmentCount
            label="people"
            n={counts.human}
            emphasised={active === "human"}
          />
          {" · "}
          <SegmentCount
            label="bots"
            n={counts.bot}
            emphasised={active === "bot"}
          />
          {" · "}
          <SegmentCount
            label="unclassified"
            n={counts.unclassified}
            emphasised={active === "unclassified"}
          />
          {" · "}
          <SegmentCount
            label="internal"
            n={counts.internal}
            emphasised={active === "internal"}
          />
          <span className="ml-1.5 text-on-surface-variant/70">
            of {formatCount(counts.total)} sessions
          </span>
        </p>
      )}
    </div>
  );
}

function SegmentCount({
  label,
  n,
  emphasised,
}: {
  label: string;
  n: number;
  emphasised: boolean;
}) {
  return (
    <span className={emphasised ? "font-semibold text-on-surface" : undefined}>
      {formatCount(n)} {label}
    </span>
  );
}
