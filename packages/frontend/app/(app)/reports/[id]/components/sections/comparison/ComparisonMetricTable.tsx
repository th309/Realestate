"use client";

import { Check } from "lucide-react";
import { formatMetricValue } from "@/lib/data";
import { type MarketBundle, shortMarketName } from "./marketBundles";
import {
  type ComparisonSectionDef,
  rowValue,
  winningIndices,
} from "./comparisonSections";

/**
 * ComparisonMetricTable — one report section rendered side by side: markets are
 * columns, metrics are rows, the leading value in each directional row is
 * highlighted. Scales 2–4 markets (just more columns). On narrow screens the
 * table scrolls horizontally with the metric-label column pinned, so four
 * markets stay readable on a phone.
 *
 * Rows where NO market has a value are dropped, and if a whole section has no
 * data the section renders nothing — no walls of em-dashes.
 */
export function ComparisonMetricTable({
  markets,
  section,
}: {
  markets: MarketBundle[];
  section: ComparisonSectionDef;
}) {
  const rows = section.rows
    .map((row) => {
      const values = markets.map((m) => rowValue(m, row));
      return { row, values, winners: winningIndices(values, row.direction) };
    })
    .filter((r) => r.values.some((v) => v !== null));

  if (rows.length === 0) return null;

  const Icon = section.icon;

  return (
    <section className="report-section report-animate-in mb-10">
      <header className="report-section-header">
        <div className="report-section-icon">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="report-heading-md">{section.title}</h2>
      </header>

      {section.blurb && (
        <p className="-mt-2 mb-4 text-sm text-on-surface-variant">
          {section.blurb}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[440px] border-collapse">
          <thead>
            <tr>
              {/* Spacer above the metric-label column */}
              <th className="sticky left-0 z-10 bg-white py-2 pr-3" />
              {markets.map((m) => (
                <th
                  key={m.id}
                  scope="col"
                  className="px-2 py-2 text-right align-bottom text-xs font-semibold text-on-surface"
                >
                  {shortMarketName(m.name)}
                  {m.isPrimary && (
                    <span className="ml-1 align-middle text-[9px] font-medium uppercase tracking-wide text-on-surface-variant">
                      ·&nbsp;primary
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ row, values, winners }) => (
              <tr
                key={row.metricId}
                className="border-t border-outline-variant/40"
              >
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-white py-2.5 pr-3 text-left text-[13px] font-medium text-on-surface-variant"
                >
                  {row.label}
                </th>
                {values.map((v, i) => {
                  const isWin = winners.includes(i);
                  return (
                    <td key={markets[i].id} className="px-1 py-1.5 text-right">
                      <span
                        className={`inline-flex items-center justify-end gap-1 rounded-md px-2 py-1 font-mono text-[15px] font-semibold tabular-nums ${
                          isWin
                            ? "bg-[var(--report-success-bg)] text-[var(--report-success)]"
                            : "text-on-surface"
                        }`}
                      >
                        {isWin && (
                          <Check
                            className="h-3 w-3"
                            role="img"
                            aria-label="leads"
                          />
                        )}
                        {formatMetricValue(v, row.format)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default ComparisonMetricTable;
