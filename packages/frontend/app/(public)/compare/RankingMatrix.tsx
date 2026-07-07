import { Check, Minus, X } from "lucide-react";
import { ROUNDUP_TOOLS } from "@/lib/data/comparisons/roundup";
import {
  ROUNDUP_MATRIX,
  type MatrixCell,
} from "@/lib/data/comparisons/roundup-matrix";

/**
 * The ranking chart: features down the rows, tools across the columns in rank
 * order (PropertyIQ #1 first), with a yes / partial / no cell per pair. The
 * feature column and header row stay pinned while the table scrolls sideways on
 * narrow screens. Pure presentation — data lives in roundup.ts.
 */

function CellIcon({ value }: { value: MatrixCell }) {
  if (value === "yes") {
    return (
      <Check
        className="mx-auto h-4 w-4 text-green-600 dark:text-green-400"
        aria-label="Yes"
      />
    );
  }
  if (value === "partial") {
    return (
      <Minus className="mx-auto h-4 w-4 text-amber-500" aria-label="Partial" />
    );
  }
  return (
    <X className="mx-auto h-4 w-4 text-on-surface-variant/40" aria-label="No" />
  );
}

export function RankingMatrix() {
  return (
    <section className="mt-10">
      <h2 className="mb-1 text-2xl font-medium text-on-surface">
        Feature matrix
      </h2>
      <p className="mb-4 text-sm text-on-surface-variant">
        Every tool, ranked left to right, scored on the capabilities that matter
        for market analysis. Accurate as of June 2026.
      </p>

      <div className="overflow-x-auto rounded-xl border border-outline-variant">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface-container-low">
              <th
                scope="col"
                className="sticky left-0 z-10 bg-surface-container-low px-4 py-3 text-left font-medium text-on-surface"
              >
                Feature
              </th>
              {ROUNDUP_TOOLS.map((tool) => (
                <th
                  key={tool.name}
                  scope="col"
                  className={`min-w-[5.5rem] px-3 py-3 text-center align-bottom ${
                    tool.isPropertyiq ? "bg-primary-container/50" : ""
                  }`}
                >
                  <span className="block text-xs text-on-surface-variant">
                    #{tool.rank}
                  </span>
                  <span className="block font-medium leading-tight text-on-surface">
                    {tool.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {ROUNDUP_MATRIX.map((row) => (
              <tr key={row.feature}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-surface px-4 py-3 text-left font-medium text-on-surface"
                >
                  {row.feature}
                </th>
                {ROUNDUP_TOOLS.map((tool) => (
                  <td
                    key={tool.name}
                    className={`px-3 py-3 text-center ${
                      tool.isPropertyiq ? "bg-primary-container/20" : ""
                    }`}
                  >
                    <CellIcon value={row.cells[tool.name] ?? "no"} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-on-surface-variant">
        <span className="inline-flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
          Full support
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Minus className="h-3.5 w-3.5 text-amber-500" />
          Partial / limited
        </span>
        <span className="inline-flex items-center gap-1.5">
          <X className="h-3.5 w-3.5 text-on-surface-variant/40" />
          Not available
        </span>
      </div>
    </section>
  );
}
