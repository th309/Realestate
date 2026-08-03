import type { ReactNode } from "react";

export type Column<T> = {
  key: keyof T & string;
  header: string;
  align?: "left" | "right";
  render?: (row: T) => ReactNode;
};

/**
 * One table treatment for every tabular surface — screener results, market
 * rankings, grading breakdowns, report tables. Numerics are monospace and
 * tabular so columns align; the header row sticks so long result sets stay
 * readable.
 */
export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  sortKey,
  sortDir,
  onSort,
}: {
  columns: Column<T>[];
  rows: T[];
  sortKey?: string;
  sortDir?: "asc" | "desc";
  onSort?: (key: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            {columns.map((col) => {
              const sorted = sortKey === col.key;
              return (
                <th
                  key={col.key}
                  aria-sort={
                    sorted
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                  onClick={onSort ? () => onSort(col.key) : undefined}
                  className={`sticky top-0 z-10 border-b border-outline-variant bg-surface px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.11em] text-on-surface-variant ${
                    col.align === "left" ? "text-left" : "text-right"
                  } ${onSort ? "cursor-pointer select-none" : ""}`}
                >
                  {col.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-outline-variant/50">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-3 py-2.5 ${
                    col.align === "left"
                      ? "text-left text-on-surface-variant"
                      : "text-right font-mono tabular-nums text-on-surface"
                  }`}
                >
                  {col.render ? col.render(row) : String(row[col.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
