/**
 * PaywallEffectiveness
 *
 * Gate | Surface | Gate views | People | CTA clicks | CTR, ordered by views.
 *
 * The panel used to render exactly one row labelled "unknown", because it
 * grouped on `event_label` — which is NULL on every paywall event ever emitted.
 * The gate identity was in `properties` the whole time (`feature`, `trigger`,
 * `geoLevel`), with `page_path` as a fallback; analytics_paywall_effectiveness
 * resolves it there and returns the surface separately, so the same gate on two
 * pages is two rows rather than one blur.
 *
 * Honesty constraints driven by what is actually measurable:
 *
 * - There is NO conversions column. No event links an upgrade back to the gate
 *   that prompted it. The old column was initialised to 0 and never
 *   incremented, so it asserted "this gate converted nobody" on every row
 *   forever. A column that can never be populated is worse than an absent one.
 * - CTR is null when there were no gate views. It used to fall back to 0 and
 *   render "0.0%" in red, so a surface with clicks and no recorded gate view
 *   looked like the worst performer on the page.
 * - Views and clicks come from different event families, so CTR is a ratio
 *   between two counts, not a step in one funnel — it can legitimately exceed
 *   100%.
 * - Developer surfaces are excluded upstream: /dev-paywalls carried 14 events
 *   per variant against 1-3 for the real gates, so the test harness read as the
 *   site's dominant conversion surface.
 */

"use client";

import type { PaywallMetric } from "@/lib/data/fetchers/admin-analytics.types";

interface PaywallEffectivenessProps {
  data: PaywallMetric[];
}

const EM_DASH = "—";

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Semantic tokens, not raw Tailwind palette (CLAUDE.md §8.2). The previous
 * text-red-600 / text-amber-600 / text-green-600 were fixed light-mode values;
 * red-600 on the dark card surface fails contrast, and it was applied to
 * exactly the rows a reader most needs to see.
 */
function ctrToneClass(ctr: number): string {
  if (ctr >= 0.05) return "text-tertiary font-medium";
  if (ctr >= 0.02) return "text-warning font-medium";
  return "text-error font-medium";
}

/**
 * Turn a raw gate key into something readable without inventing meaning.
 *
 * Tolerates a missing value rather than throwing. A cached response from before
 * this panel's shape changed (`resource` -> `gate`) deserialises into the new
 * type without complaint — JSON has no types at runtime — and used to crash the
 * whole Conversion tab on first property access. Degrading to one honest row is
 * strictly better than white-screening the page while a cache entry expires.
 */
function gateLabel(gate: string | undefined): string {
  if (!gate) return "Unlabelled gate";
  if (gate === "unattributed") return "Unattributed gate";
  return gate.replace(/_/g, " ");
}

export function PaywallEffectiveness({ data }: PaywallEffectivenessProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-surface-container-low rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-medium text-on-surface mb-1">
          Paywall effectiveness
        </h3>
        <p className="text-sm text-on-surface-variant mt-4">
          No upgrade gates were shown in this window.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-low rounded-xl p-5 shadow-sm">
      <h3 className="text-sm font-medium text-on-surface mb-4">
        Paywall effectiveness
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-on-surface-variant border-b border-outline-variant">
              <th className="text-left font-medium py-2 pr-4">Gate</th>
              <th className="text-left font-medium py-2 pr-4">Surface</th>
              <th className="text-right font-medium py-2 pr-4">Views</th>
              <th className="text-right font-medium py-2 pr-4">People</th>
              <th className="text-right font-medium py-2 pr-4">CTA clicks</th>
              <th className="text-right font-medium py-2">CTR</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={`${row.gate ?? "?"}::${row.surface ?? "?"}`}
                className="border-b border-outline-variant last:border-0"
              >
                <td className="py-2.5 pr-4 text-on-surface capitalize">
                  {gateLabel(row.gate)}
                </td>
                <td className="py-2.5 pr-4 text-on-surface-variant font-mono text-xs">
                  {row.surface ?? "—"}
                </td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-on-surface">
                  {(row.views ?? 0).toLocaleString("en-US")}
                </td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-on-surface-variant">
                  {(row.viewers ?? 0).toLocaleString("en-US")}
                </td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-on-surface">
                  {(row.ctaClicks ?? 0).toLocaleString("en-US")}
                </td>
                <td className="py-2.5 text-right tabular-nums">
                  {row.ctr === null || row.ctr === undefined ? (
                    <span className="text-on-surface-variant">{EM_DASH}</span>
                  ) : (
                    <span className={ctrToneClass(row.ctr)}>
                      {formatPercent(row.ctr)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-on-surface-variant mt-4">
        Gate views and CTA clicks come from separate events, so CTR is a ratio
        between them rather than a step in one funnel and can exceed 100%. No
        event links an upgrade back to the gate that prompted it, so conversions
        per gate are unmeasurable and are not shown. Developer pages are
        excluded.
      </p>
    </div>
  );
}
