"use client";
import { useMemo, useState } from "react";
import { FixedSizeList as List } from "react-window";
import type { ResolvedMarket } from "../lib/scope-api";

type SortKey = "name" | "population" | "score";

export function ResolvedMarketsList({
  markets,
  truncated,
  checkedIds,
  onToggle,
  onCheckMany,
}: {
  markets: ResolvedMarket[];
  truncated: boolean;
  checkedIds: Set<string>;
  onToggle: (id: string) => void;
  onCheckMany: (ids: string[], next: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = markets;
    if (q) {
      out = out.filter(
        (m) =>
          m.canonical_name.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q),
      );
    }
    out = [...out].sort((a, b) => {
      if (sortKey === "name")
        return a.canonical_name.localeCompare(b.canonical_name);
      if (sortKey === "population")
        return (b.population ?? -1) - (a.population ?? -1);
      return (b.score ?? -1) - (a.score ?? -1);
    });
    return out;
  }, [markets, search, sortKey]);

  const visibleIds = filtered.map((m) => m.id);
  const visibleCheckedCount = visibleIds.filter((id) =>
    checkedIds.has(id),
  ).length;
  const allVisibleChecked =
    filtered.length > 0 && visibleCheckedCount === filtered.length;
  const someVisibleChecked =
    visibleCheckedCount > 0 && visibleCheckedCount < filtered.length;

  return (
    <div className="rounded-xl border border-outline-variant overflow-hidden">
      {truncated && (
        <div className="bg-warning-container/40 text-on-surface text-xs px-4 py-2 border-b border-outline-variant">
          Showing first 2,500 markets. Narrow your scope (e.g. pick a single
          state) to see all results.
        </div>
      )}

      <div className="flex items-center gap-3 px-4 py-3 bg-surface-container-low border-b border-outline-variant">
        <input
          type="checkbox"
          checked={allVisibleChecked}
          ref={(el) => {
            if (el) el.indeterminate = someVisibleChecked;
          }}
          onChange={() => onCheckMany(visibleIds, !allVisibleChecked)}
          className="h-4 w-4"
          aria-label="Select all visible"
        />
        <span className="text-sm">
          <strong>{checkedIds.size}</strong> of {markets.length} selected
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter…"
          className="ml-auto rounded-full border border-outline-variant px-3 py-1 text-sm w-48"
        />
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="text-xs rounded border border-outline-variant px-2 py-1 bg-surface"
        >
          <option value="name">Sort: Name</option>
          <option value="population">Sort: Population</option>
          <option value="score">Sort: Score</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="px-4 py-8 text-sm text-on-surface-variant text-center">
          {search
            ? `No markets match "${search}" in this scope.`
            : "No markets in this scope."}
        </div>
      ) : (
        <List
          height={Math.min(440, filtered.length * 44)}
          itemCount={filtered.length}
          itemSize={44}
          width="100%"
          itemData={{ markets: filtered, checkedIds, onToggle }}
        >
          {Row}
        </List>
      )}

      <div className="px-4 py-2 text-xs text-on-surface-variant border-t border-outline-variant bg-surface-container-low">
        Showing {filtered.length} of {markets.length}
        {search ? " (filtered)" : ""}
      </div>
    </div>
  );
}

function Row({
  index,
  style,
  data,
}: {
  index: number;
  style: React.CSSProperties;
  data: {
    markets: ResolvedMarket[];
    checkedIds: Set<string>;
    onToggle: (id: string) => void;
  };
}) {
  const m = data.markets[index];
  const checked = data.checkedIds.has(m.id);
  return (
    <div
      style={style}
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={() => data.onToggle(m.id)}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          data.onToggle(m.id);
        }
      }}
      className={`flex items-center gap-3 px-4 cursor-pointer hover:bg-surface-container-low ${
        checked ? "bg-secondary-container/30" : ""
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        readOnly
        className="h-4 w-4 pointer-events-none"
        tabIndex={-1}
      />
      <span className="text-sm flex-1 truncate">{m.canonical_name}</span>
      <span className="text-[10px] uppercase tracking-wide text-on-surface-variant font-mono">
        {m.geography}
      </span>
      {m.population != null && (
        <span className="text-xs text-outline w-20 text-right">
          {Intl.NumberFormat("en-US", { notation: "compact" }).format(
            m.population,
          )}
        </span>
      )}
      {m.score != null && (
        <span className="text-xs text-primary font-mono w-10 text-right">
          {Math.round(m.score)}
        </span>
      )}
    </div>
  );
}
