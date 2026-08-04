import type { ReactNode } from "react";

export type Column<T> = {
  /** Field name, or a synthetic id for a computed column (rank, row actions). */
  key: string;
  header: ReactNode;
  align?: "left" | "right";
  /** Sortable columns get a pointer cursor and report `aria-sort`. */
  sortable?: boolean;
  /** Tailwind width utility, e.g. `w-11`. */
  width?: string;
  /** Extra classes for this column's cells — per-row colour, min-width. */
  cellClassName?: (row: T) => string;
  render?: (row: T, index: number) => ReactNode;
};

/**
 * One table treatment for every tabular surface — screener results, market
 * rankings, grading breakdowns, report tables. Numerics are monospace and
 * tabular so columns align; the header row sticks so long result sets stay
 * readable.
 *
 * Rows can be interactive: pass `onRowClick` and each row becomes a keyboard
 * -reachable `role="link"`, which is what the screener needs to navigate into
 * a market without losing the row-actions button nested inside it.
 */
// Unconstrained on purpose: `T extends Record<string, unknown>` rejects plain
// interfaces like ScreenerRow, which have no index signature.
export function DataTable<T>({
  columns,
  rows,
  sortKey,
  sortDir,
  onSort,
  rowKey,
  onRowClick,
  rowClassName,
  rowStyle,
  ariaLabel,
  empty,
  scroll = true,
}: {
  columns: Column<T>[];
  rows: T[];
  sortKey?: string;
  sortDir?: "asc" | "desc";
  onSort?: (key: string) => void;
  /** Stable key per row. Falls back to the index, which reorders badly on sort. */
  rowKey?: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T, index: number) => string;
  rowStyle?: (row: T, index: number) => React.CSSProperties;
  ariaLabel?: string;
  /** Rendered in place of the table when there are no rows. */
  empty?: ReactNode;
  /**
   * Wrap the table in an `overflow-x-auto` div. Set false when the consumer
   * supplies its own scroll container — nesting two scrollers on the same
   * axis means the outer one never scrolls and its affordances never fire.
   */
  scroll?: boolean;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;

  const table = (
    <table
      aria-label={ariaLabel}
      className="w-full border-collapse text-[12.5px]"
    >
      <thead>
        <tr>
          {columns.map((col) => {
            const sorted = sortKey === col.key;
            // Sorted state and clickability are independent: a table sorted
            // server-side with no onSort handler must still report aria-sort.
            // Only the pointer affordance depends on onSort.
            const sortable =
              col.sortable !== false &&
              (Boolean(onSort) || sortKey !== undefined);
            const interactive = sortable && Boolean(onSort);
            return (
              <th
                key={col.key}
                scope="col"
                aria-sort={
                  !sortable
                    ? undefined
                    : sorted
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                }
                onClick={
                  interactive && onSort ? () => onSort(col.key) : undefined
                }
                className={`sticky top-0 z-10 whitespace-nowrap border-b border-outline-variant bg-surface-container px-3 py-2.5 text-[9.5px] font-bold uppercase tracking-[0.11em] ${
                  sorted ? "text-primary" : "text-on-surface-variant"
                } ${col.align === "left" ? "text-left" : "text-right"} ${
                  col.width ?? ""
                } ${interactive ? "cursor-pointer select-none hover:text-primary" : ""}`}
              >
                {col.header}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={rowKey ? rowKey(row, i) : i}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            role={onRowClick ? "link" : undefined}
            tabIndex={onRowClick ? 0 : undefined}
            onKeyDown={
              onRowClick
                ? (e) => {
                    if (e.key === "Enter") onRowClick(row);
                  }
                : undefined
            }
            style={rowStyle?.(row, i)}
            className={`border-b border-outline-variant/50 last:border-0 ${
              onRowClick
                ? "cursor-pointer transition-colors duration-100 hover:bg-surface-container-low"
                : ""
            } ${rowClassName?.(row, i) ?? ""}`}
          >
            {columns.map((col) => (
              <td
                key={col.key}
                className={`whitespace-nowrap px-3 py-2.5 ${
                  col.align === "left"
                    ? "text-left text-on-surface"
                    : "text-right font-mono tabular-nums text-on-surface"
                } ${col.cellClassName?.(row) ?? ""}`}
              >
                {col.render
                  ? col.render(row, i)
                  : String(row[col.key as keyof T] ?? "")}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return scroll ? <div className="overflow-x-auto">{table}</div> : table;
}
