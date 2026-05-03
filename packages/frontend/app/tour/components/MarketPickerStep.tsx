"use client";

import { useMemo } from "react";
import { useUniversalSearch } from "@/app/shared/hooks/useUniversalSearch";
import { useScoreData } from "@/lib/data";
import type { GeoLevel, MarketRef } from "@/lib/data";
import { useTour } from "../TourStateProvider";

const FALLBACK_MARKETS: MarketRef[] = [
  {
    geoLevel: "metro",
    geoId: "16740",
    name: "Charlotte-Concord-Gastonia, NC-SC",
  },
  { geoLevel: "metro", geoId: "38060", name: "Phoenix-Mesa-Chandler, AZ" },
  {
    geoLevel: "metro",
    geoId: "45300",
    name: "Tampa-St. Petersburg-Clearwater, FL",
  },
];

interface SuggestionResult {
  id: string;
  name: string;
  type: string;
  subtitle?: string;
}

export function MarketPickerStep() {
  const { setMarket } = useTour();
  const { searchQuery, searchResults, searchLoading, handleSearch } =
    useUniversalSearch({});

  const visible = useMemo(
    () => (searchResults as SuggestionResult[]).slice(0, 6),
    [searchResults],
  );

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-semibold text-on-surface md:text-3xl">
          What market matters most to you?
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Type your farm zip, county, or metro. We&apos;ll build a real listing
          presentation for it.
        </p>
      </header>

      <input
        autoFocus
        type="search"
        value={searchQuery}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="🔍  Cary, NC"
        className="w-full rounded-full border-2 border-outline-variant bg-white px-5 py-3.5 text-base shadow-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
        aria-label="Search markets"
      />

      {visible.length > 0 && (
        <ul
          className="mt-3 overflow-hidden rounded-xl border border-outline-variant bg-white"
          role="listbox"
        >
          {visible.map((r) => (
            <SuggestionRow
              key={`${r.type}-${r.id}`}
              result={r}
              onSelect={() =>
                setMarket({
                  geoLevel: r.type as MarketRef["geoLevel"],
                  geoId: r.id,
                  name: r.name,
                })
              }
            />
          ))}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {FALLBACK_MARKETS.map((m) => (
          <button
            key={m.geoId}
            type="button"
            onClick={() => setMarket(m)}
            className="rounded-full border border-outline-variant bg-surface-container px-4 py-1.5 text-xs text-on-surface-variant hover:border-primary hover:bg-primary-container hover:text-primary-dark"
          >
            {m.name.split(",")[0]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setMarket(FALLBACK_MARKETS[0])}
          className="rounded-full border border-outline-variant bg-surface-container px-4 py-1.5 text-xs text-on-surface-variant hover:border-primary hover:bg-primary-container hover:text-primary-dark"
        >
          Or skip — show me Charlotte
        </button>
      </div>

      {searchLoading && (
        <p className="mt-4 text-center text-xs text-on-surface-variant">
          Searching…
        </p>
      )}
    </div>
  );
}

function SuggestionRow({
  result,
  onSelect,
}: {
  result: SuggestionResult;
  onSelect: () => void;
}) {
  const { propertyiq } = useScoreData(result.type as GeoLevel, result.id);
  const score = propertyiq?.score;
  const chip =
    typeof score === "number"
      ? scoreChip(score)
      : {
          bg: "bg-outline-variant/30",
          text: "text-on-surface-variant",
          label: "—",
        };

  return (
    <li role="option" aria-selected="false">
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-center justify-between gap-4 border-b border-outline-variant/40 px-4 py-3 text-left last:border-b-0 hover:bg-primary-container/40"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-on-surface">
            {result.name}
          </p>
          <p className="truncate text-xs text-on-surface-variant">
            {result.subtitle ?? result.type}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-xs font-semibold ${chip.bg} ${chip.text}`}
        >
          {chip.label}
        </span>
      </button>
    </li>
  );
}

function scoreChip(score: number) {
  if (score >= 80)
    return {
      bg: "bg-[#00C853]",
      text: "text-white",
      label: `${score} · GREAT`,
    };
  if (score >= 50)
    return { bg: "bg-[#FF8F00]", text: "text-white", label: `${score} · FAIR` };
  return { bg: "bg-[#B3261E]", text: "text-white", label: `${score} · POOR` };
}
