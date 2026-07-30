/**
 * Feature use → signup rate.
 *
 * The previous panel plotted "share of converters who used X" against "share of
 * non-converters who used X" and ranked by a signed difference it called signal
 * strength: two bars whose difference is the point, in a chart where the
 * difference is the hardest thing to read. It rendered a single "unknown" row
 * regardless, because the query behind it selected a column that does not exist
 * and so returned nothing on every load since it shipped.
 *
 * The question people actually ask is "of the people who used this, how many
 * signed up?", so that is the number, with the site-wide rate beside it.
 *
 * SAMPLE SIZE IS THE DESIGN CONSTRAINT. In live data the highest rate is one
 * visitor who signed up: 1 user, 1 signup, 100%. Sorted by rate, that leads the
 * panel and means nothing. Rows are therefore ordered by users, the count is
 * always visible, and anything under LOW_CONFIDENCE_USERS is marked rather than
 * quietly presented as comparable.
 *
 * Plain divs rather than recharts: these are proportional bars against a fixed
 * reference line, and a charting library adds a dependency, a tooltip and a
 * legend without adding meaning.
 */

"use client";

import type { FeatureConvMetric } from "@/lib/data/fetchers/admin-analytics.types";

/** Below this, a rate is an anecdote. Shown, but never presented as a finding. */
const LOW_CONFIDENCE_USERS = 20;

/** Human labels for the raw event actions the RPC groups on. */
const FEATURE_LABELS: Record<string, string> = {
  analyzer_grade: "Analyzer — graded a deal",
  report_view: "Opened a report",
  report_export: "Exported a report",
  search: "Searched",
  region_select: "Selected a market",
  map_filter: "Filtered the map",
  screener_market_size: "Screener — market size",
  mcp_connected: "Connected MCP",
  score_view: "Viewed a score",
  pro_feature_used: "Used a Pro feature",
};

interface FeatureCorrelationChartProps {
  data: FeatureConvMetric[];
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** Tolerates a missing value for the same stale-cache reason as gateLabel. */
function label(feature: string | undefined): string {
  if (!feature) return "Unlabelled feature";
  return FEATURE_LABELS[feature] ?? feature.replace(/_/g, " ");
}

export function FeatureCorrelationChart({
  data,
}: FeatureCorrelationChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-surface-container-low rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-medium text-on-surface mb-1">
          Feature use → signup rate
        </h3>
        <p className="text-sm text-on-surface-variant mt-4">
          No feature interactions recorded in this window.
        </p>
      </div>
    );
  }

  // Ordered by evidence, not by rate. See the sample-size note above.
  const rows = [...data].sort((a, b) => (b.users ?? 0) - (a.users ?? 0));
  const baseline = rows[0]?.baselineRate ?? 0;
  const widest = Math.max(
    ...rows.map((r) => r.conversionRate ?? 0),
    baseline,
    // Floor keeps the bar widths finite when every rate is 0.
    0.01,
  );

  return (
    <div className="bg-surface-container-low rounded-xl p-5 shadow-sm">
      <h3 className="text-sm font-medium text-on-surface mb-1">
        Feature use → signup rate
      </h3>
      <p className="text-xs text-on-surface-variant mb-4">
        Of the people who used each feature, the share that went on to sign up.
        Site-wide rate is {formatPct(baseline)}.
      </p>

      <div className="space-y-3">
        {rows.map((row) => {
          const thin = (row.users ?? 0) < LOW_CONFIDENCE_USERS;
          return (
            <div key={row.feature}>
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <span className="text-sm text-on-surface truncate">
                  {label(row.feature)}
                </span>
                <span className="text-xs text-on-surface-variant shrink-0 tabular-nums">
                  {row.converted ?? 0}/{row.users ?? 0} ·{" "}
                  <span className="font-medium text-on-surface">
                    {formatPct(row.conversionRate ?? 0)}
                  </span>
                  {/* `!== null` alone still admits undefined from a stale
                      cached payload, and .toFixed then throws. */}
                  {typeof row.lift === "number" && !thin && (
                    <span className="ml-1.5 text-tertiary">
                      {row.lift.toFixed(1)}x baseline
                    </span>
                  )}
                </span>
              </div>

              <div className="relative h-2 rounded-full bg-surface-container-high overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    thin ? "bg-outline" : "bg-primary"
                  }`}
                  style={{
                    width: `${Math.min(100, ((row.conversionRate ?? 0) / widest) * 100)}%`,
                  }}
                />
                {/* Baseline marker — the comparison that makes a rate mean something. */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-on-surface-variant"
                  style={{
                    left: `${Math.min(100, (baseline / widest) * 100)}%`,
                  }}
                  aria-hidden="true"
                />
              </div>

              {thin && (
                <p className="text-xs text-on-surface-variant mt-1">
                  Only {row.users ?? 0}{" "}
                  {(row.users ?? 0) === 1 ? "person has" : "people have"} used
                  this —
                  too few to read as a rate.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-on-surface-variant mt-4">
        Ordered by number of users, not by rate — a high rate over a handful of
        people is noise. The vertical line marks the site-wide rate. Correlation
        only: this does not show that a feature caused a signup.
      </p>
    </div>
  );
}
