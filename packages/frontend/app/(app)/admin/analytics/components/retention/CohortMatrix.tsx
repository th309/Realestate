/**
 * CohortMatrix
 *
 * Hero visualization for user retention. Rows represent weekly signup cohorts;
 * columns represent weeks since signup (Wk0 through Wk12). Each cell shows
 * the retention percentage with a heat-mapped background.
 */

"use client";

interface CohortRow {
  cohort: string;
  cohortSize: number;
  weeks: number[];
}

interface CohortMatrixProps {
  matrix: CohortRow[];
  onCellClick?: (cohort: string, week: number) => void;
}

function getCellColor(pct: number): string {
  if (pct >= 70) return "bg-green-100 text-green-800";
  if (pct >= 50) return "bg-emerald-50 text-emerald-700";
  if (pct >= 30) return "bg-yellow-50 text-yellow-700";
  if (pct >= 10) return "bg-orange-50 text-orange-700";
  return "bg-red-50 text-red-700";
}

const MAX_WEEKS = 12;

function buildWeekHeaders(): string[] {
  return Array.from({ length: MAX_WEEKS + 1 }, (_, i) => `Wk${i}`);
}

export function CohortMatrix({ matrix, onCellClick }: CohortMatrixProps) {
  const weekHeaders = buildWeekHeaders();

  if (matrix.length === 0) {
    return (
      <div className="bg-surface-container rounded-xl p-6">
        <h3 className="text-base font-medium text-on-surface mb-4">
          Cohort Retention Matrix
        </h3>
        <div className="flex items-center justify-center h-32 text-on-surface-variant text-sm">
          No cohort data available for this period.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-container rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-medium text-on-surface">
          Cohort Retention Matrix
        </h3>
        <div className="flex items-center gap-3 text-xs text-on-surface-variant">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-green-100" />
            &ge;70%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-yellow-50 border border-yellow-200" />
            30–70%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-red-50 border border-red-200" />
            &lt;30%
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-separate border-spacing-0.5">
          <thead>
            <tr>
              <th className="text-left py-1.5 px-2 text-on-surface-variant font-medium whitespace-nowrap min-w-[120px]">
                Cohort
              </th>
              <th className="text-right py-1.5 px-2 text-on-surface-variant font-medium whitespace-nowrap">
                Size
              </th>
              {weekHeaders.map((header) => (
                <th
                  key={header}
                  className="text-center py-1.5 px-1 text-on-surface-variant font-medium whitespace-nowrap min-w-[44px]"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row) => (
              <tr key={row.cohort}>
                <td className="py-1 px-2 text-on-surface font-medium whitespace-nowrap">
                  {row.cohort}
                </td>
                <td className="py-1 px-2 text-right text-on-surface-variant whitespace-nowrap">
                  {row.cohortSize.toLocaleString()}
                </td>
                {weekHeaders.map((_, weekIndex) => {
                  const pct = row.weeks[weekIndex];
                  const hasPct = pct !== undefined && pct !== null;
                  return (
                    <td key={weekIndex} className="py-1 px-0.5">
                      {hasPct ? (
                        <button
                          onClick={() => onCellClick?.(row.cohort, weekIndex)}
                          className={`w-full rounded px-1 py-1 text-center font-medium transition-opacity hover:opacity-80 cursor-pointer ${getCellColor(pct)}`}
                          title={`${row.cohort} Wk${weekIndex}: ${pct.toFixed(1)}%`}
                        >
                          {pct.toFixed(0)}%
                        </button>
                      ) : (
                        <div className="w-full rounded px-1 py-1 text-center text-on-surface-variant/30">
                          —
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
