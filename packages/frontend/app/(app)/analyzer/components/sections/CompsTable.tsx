"use client";

import { useMemo, useState } from "react";
import { piq } from "../primitives/piqTokens";

export interface CompRow {
  address: string;
  kind: "sale" | "rent";
  price?: number | null;
  rent?: number | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  distance?: number;
}

type SortKey = "kind" | "address" | "beds" | "sqft" | "value" | "distance";
type SortDir = "asc" | "desc";

const KIND_ORDER: Record<string, number> = { sale: 0, rent: 1 };

function rowValue(row: CompRow): number {
  return row.kind === "sale" ? (row.price ?? 0) : (row.rent ?? 0);
}

function sortRows(rows: CompRow[], key: SortKey, dir: SortDir): CompRow[] {
  const sorted = [...rows].sort((a, b) => {
    let cmp = 0;
    if (key === "kind") {
      cmp = (KIND_ORDER[a.kind] ?? 99) - (KIND_ORDER[b.kind] ?? 99);
    } else if (key === "address") {
      cmp = a.address.localeCompare(b.address);
    } else if (key === "beds") {
      cmp = (a.beds ?? 0) - (b.beds ?? 0);
    } else if (key === "sqft") {
      cmp = (a.sqft ?? 0) - (b.sqft ?? 0);
    } else if (key === "value") {
      cmp = rowValue(a) - rowValue(b);
    } else if (key === "distance") {
      cmp = (a.distance ?? Infinity) - (b.distance ?? Infinity);
    }
    return dir === "asc" ? cmp : -cmp;
  });
  return sorted;
}

interface HeaderCellProps {
  label: string;
  sortKey: SortKey;
  active: SortKey | null;
  dir: SortDir;
  onSort: (k: SortKey) => void;
}

function HeaderCell({ label, sortKey, active, dir, onSort }: HeaderCellProps) {
  const isActive = sortKey === active;
  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{
        cursor: "pointer",
        textAlign: "left",
        padding: 8,
        fontSize: "11px",
        fontWeight: 600,
        color: piq.textMuted,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        borderBottom: `0.5px solid ${piq.border}`,
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
    >
      {label}
      {isActive && (
        <span aria-hidden style={{ marginLeft: 4, fontSize: "9px" }}>
          {dir === "asc" ? "▲" : "▼"}
        </span>
      )}
    </th>
  );
}

interface CompsTableProps {
  rows: CompRow[];
  /** Total comps available before capping for display. Surfaces 'top N of M' when rows is a subset. */
  totalAvailable?: number;
}

/**
 * Sortable comp table. Tabular numerics + alternating subtle indigo-tinted row
 * backgrounds + 0.5px horizontal borders only.
 *
 * Open by default. This used to start collapsed behind a small muted "Comp
 * details" link, which meant a card titled "Comparable Sales & Rentals" showed
 * a histogram and a map and no comps — the individual sales and rentals, which
 * are the thing the section is named for and the only place their addresses,
 * beds, sqft and distances appear, were one unlabelled disclosure away. The
 * toggle stays for collapsing it back.
 */
export function CompsTable({ rows, totalAvailable }: CompsTableProps) {
  const isCapped =
    totalAvailable != null && totalAvailable > rows.length && rows.length > 0;
  const countLabel = isCapped
    ? `top ${rows.length} of ${totalAvailable}`
    : `${rows.length}`;
  const [open, setOpen] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const display = useMemo(
    () => (sortKey ? sortRows(rows, sortKey, sortDir) : rows),
    [rows, sortKey, sortDir],
  );

  const cellStyle = {
    padding: 8,
    borderBottom: `0.5px solid ${piq.border}`,
    fontVariantNumeric: "tabular-nums" as const,
  };

  return (
    <div data-comps-table>
      {/* Left-aligned and labelled like the other section eyebrows, not a
          muted link floating at the right margin — it heads the table it
          controls, so it reads as that table's title. */}
      <div className="flex items-center justify-between gap-3 border-b border-piq-line pb-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-[10px] font-bold uppercase tracking-[0.11em] text-piq-muted transition-colors hover:text-piq-ink focus-visible:outline-2 focus-visible:outline-piq-indigo"
        >
          <span aria-hidden className="inline-block w-3 text-center">
            {open ? "▾" : "▸"}
          </span>
          Comp details
        </button>
        <span className="text-[10px] font-bold uppercase tracking-[0.11em] text-piq-muted">
          {countLabel}
        </span>
      </div>
      {open && (
        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "13px",
              color: piq.textPrimary,
            }}
          >
            <thead>
              <tr>
                <HeaderCell
                  label="Type"
                  sortKey="kind"
                  active={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
                <HeaderCell
                  label="Address"
                  sortKey="address"
                  active={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
                <HeaderCell
                  label="BR/BA"
                  sortKey="beds"
                  active={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
                <HeaderCell
                  label="SqFt"
                  sortKey="sqft"
                  active={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
                <HeaderCell
                  label="Price/Rent"
                  sortKey="value"
                  active={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
                <HeaderCell
                  label="Dist"
                  sortKey="distance"
                  active={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
              </tr>
            </thead>
            <tbody>
              {display.map((row, i) => {
                const isSale = row.kind === "sale";
                const chipColor = isSale ? piq.green : piq.amber;
                const chipBg = isSale
                  ? "rgba(0, 200, 83, 0.12)"
                  : "rgba(255, 179, 0, 0.12)";
                const valueText = isSale
                  ? row.price
                    ? `$${Math.round(row.price / 1000)}K`
                    : "—"
                  : row.rent
                    ? `$${row.rent}/mo`
                    : "—";
                return (
                  <tr
                    key={`${row.kind}-${i}-${row.address}`}
                    style={{
                      background:
                        i % 2 === 1 ? "rgba(57, 73, 171, 0.02)" : "transparent",
                    }}
                  >
                    <td style={cellStyle}>
                      <span
                        style={{
                          background: chipBg,
                          color: chipColor,
                          fontSize: "10px",
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 999,
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.kind}
                      </span>
                    </td>
                    <td
                      style={{
                        ...cellStyle,
                        maxWidth: 220,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={row.address}
                    >
                      {row.address}
                    </td>
                    <td style={cellStyle}>
                      {row.beds ?? "—"}/{row.baths ?? "—"}
                    </td>
                    <td style={cellStyle}>
                      {row.sqft != null ? row.sqft.toLocaleString() : "—"}
                    </td>
                    <td style={cellStyle}>{valueText}</td>
                    <td style={cellStyle}>
                      {row.distance != null
                        ? `${row.distance.toFixed(1)}mi`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
