"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Lock } from "lucide-react";
import { useScreener, type ScreenerQuery, type ScreenerRow } from "@/lib/data";
import type { ScreenerGeoLevel, MoverWindow } from "@/lib/data";
import { trackEvent } from "@/lib/analytics/tracker";
import { useEntitlements } from "@/lib/entitlements";
import { GeoLockCard } from "@/components/entitlements/GeoLockCard";
import { downloadCsv } from "@/lib/export";
import { GeoSegmentedControl } from "./components/GeoSegmentedControl";
import { PresetChips, PRESETS } from "./components/PresetChips";
import type { PresetId, Preset } from "./components/PresetChips";
import { FilterRail } from "./components/FilterRail";
import { ScreenerTable } from "./components/ScreenerTable";
import { Pagination } from "./components/Pagination";
import { StateSelect } from "./components/StateSelect";
import { ScreenerTabs } from "./components/ScreenerTabs";
import { MoversTab } from "./components/MoversTab";
import { WindowSelector } from "./components/WindowSelector";
import {
  readGeo,
  readState,
  readPreset,
  readSortBy,
  readSortOrder,
  readPage,
  readFilters,
  readTab,
  readWindow,
  buildScreenerUrl,
  type SortBy,
  type ScreenerTab,
} from "./lib/screener-url-state";
import { summarizeScreenerFilters } from "./lib/screener-filter-summary";
import { WINDOW_TO_COLUMN, WINDOW_META } from "./lib/score-change";

// ---------------------------------------------------------------------------
// URL ↔ state serialisation helpers
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50;

// URL <-> state helpers live in ./lib/screener-url-state

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ScreenerPageInner() {
  const router = useRouter();
  const params = useSearchParams();

  // Read initial state from URL
  const [geo, setGeoState] = useState<ScreenerGeoLevel>(() => readGeo(params));
  const [stateFilter, setStateFilterState] = useState<string>(() =>
    readState(params),
  );
  const [activePreset, setActivePreset] = useState<PresetId | null>(() =>
    readPreset(params),
  );
  const [filters, setFiltersState] = useState<Partial<ScreenerQuery>>(() =>
    readFilters(params),
  );
  const [sortBy, setSortByState] = useState<SortBy>(() => readSortBy(params));
  const [sortOrder, setSortOrderState] = useState<"asc" | "desc">(() =>
    readSortOrder(params),
  );
  const [page, setPageState] = useState(() => readPage(params));
  const [tab, setTabState] = useState<ScreenerTab>(() => readTab(params));
  const [changeWindow, setChangeWindowState] = useState<MoverWindow>(() =>
    readWindow(params),
  );

  // Entitlements
  const { canAccess } = useEntitlements();
  const canExport = canAccess("feature", "export_csv");
  const canViewZip = canAccess("geo", "zip");
  const isZipLocked = geo === "zip" && !canViewZip;

  // Build the query sent to the hook
  const query: ScreenerQuery = {
    ...filters,
    state: stateFilter || undefined,
    sortBy,
    sortOrder,
    changeWindow,
    page,
    pageSize: PAGE_SIZE,
  };

  const { data, isFetching } = useScreener(geo, query, {
    enabled: !isZipLocked && tab === "screener",
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const hasMore = data?.hasMore ?? false;

  // Plain-English list of active constraints, surfaced in the empty state so a
  // no-results view reads as "filters are narrow", not "the screener is broken".
  const activeFilters = summarizeScreenerFilters(filters, stateFilter);

  // Push URL updates (replace, not push — avoids polluting history)
  const pushUrl = useCallback(
    (
      nextGeo: ScreenerGeoLevel,
      nextState: string,
      nextPreset: PresetId | null,
      nextFilters: Partial<ScreenerQuery>,
      nextSortBy: SortBy,
      nextSortOrder: "asc" | "desc",
      nextPage: number,
      nextTab: ScreenerTab,
      nextWindow: MoverWindow,
    ) => {
      const qs = buildScreenerUrl(
        nextGeo,
        nextState,
        nextPreset,
        nextFilters,
        nextSortBy,
        nextSortOrder,
        nextPage,
        nextTab,
        nextWindow,
      );
      router.replace(`/screener?${qs}`, { scroll: false });
    },
    [router],
  );

  // Sync state → URL whenever anything changes
  useEffect(() => {
    pushUrl(
      geo,
      stateFilter,
      activePreset,
      filters,
      sortBy,
      sortOrder,
      page,
      tab,
      changeWindow,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    geo,
    stateFilter,
    activePreset,
    filters,
    sortBy,
    sortOrder,
    page,
    tab,
    changeWindow,
  ]);

  // --- Handlers ---

  const handleGeoChange = useCallback((next: ScreenerGeoLevel) => {
    setGeoState(next);
    setPageState(0);
  }, []);

  const handleStateChange = useCallback((next: string) => {
    setStateFilterState(next);
    setPageState(0);
  }, []);

  const handlePresetSelect = useCallback(
    (preset: Preset) => {
      setActivePreset(preset.id);
      if (preset.windowSorted) {
        // Gainers/Losers: sort by the ACTIVE window's Δ column.
        setSortByState(WINDOW_TO_COLUMN[changeWindow]);
        setSortOrderState(preset.windowSorted);
        setFiltersState({});
      } else {
        const {
          sortBy: pSortBy,
          sortOrder: pSortOrder,
          ...pFilters
        } = preset.query;
        if (pSortBy) setSortByState(pSortBy);
        if (pSortOrder) setSortOrderState(pSortOrder);
        setFiltersState(pFilters);
      }
      setPageState(0);
    },
    [changeWindow],
  );

  const handleWindowChange = useCallback(
    (next: MoverWindow) => {
      setChangeWindowState(next);
      setPageState(0);
      if (activePreset === "gainers" || activePreset === "losers") {
        setSortByState(WINDOW_TO_COLUMN[next]);
      }
    },
    [activePreset],
  );

  const handleFilterChange = useCallback((patch: Partial<ScreenerQuery>) => {
    trackEvent("feature.screener_filter", { keys: Object.keys(patch) });
    setFiltersState((prev) => ({ ...prev, ...patch }));
    setActivePreset(null);
    setPageState(0);
  }, []);

  // Full reset: clears every active filter the empty state lists as a chip
  // (state, score/price, preset) so "Clear filters" does exactly what it says.
  const handleFilterReset = useCallback(() => {
    setStateFilterState("");
    setFiltersState({});
    setActivePreset("hottest");
    setSortByState("score");
    setSortOrderState("desc");
    setPageState(0);
  }, []);

  const handleSort = useCallback(
    (col: SortBy) => {
      if (sortBy === col) {
        setSortOrderState((o) => (o === "asc" ? "desc" : "asc"));
      } else {
        setSortByState(col);
        setSortOrderState("desc");
      }
      setActivePreset(null);
      setPageState(0);
    },
    [sortBy],
  );

  const handleExport = useCallback(() => {
    if (!canExport || rows.length === 0) return;
    const changeCol = WINDOW_TO_COLUMN[changeWindow];
    const columns = [
      { key: "region_name", label: "Market" },
      { key: "state_code", label: "State" },
      { key: "score", label: "PIQ Score" },
      { key: "grade", label: "Grade" },
      { key: changeCol, label: `Score Δ (${WINDOW_META[changeWindow].label})` },
      { key: "median_price", label: "Median Price" },
      { key: "rent", label: "Rent (ZORI)" },
      { key: "cap_rate", label: "Cap Rate %" },
      { key: "gross_yield", label: "Gross Yield %" },
      { key: "months_of_supply", label: "Months of Supply" },
      { key: "overvalued_pct", label: "Overvalued %" },
      { key: "as_of", label: "As Of" },
    ];
    downloadCsv(
      rows as unknown as Record<string, unknown>[],
      columns,
      `screener-${geo}`,
    );
  }, [canExport, rows, geo, changeWindow]);

  // Default to "Hottest Markets" preset if nothing in URL on first load
  useEffect(() => {
    if (
      activePreset === null &&
      Object.keys(filters).every(
        (k) => filters[k as keyof typeof filters] === undefined,
      )
    ) {
      const hottest = PRESETS.find((p) => p.id === "hottest");
      if (hottest) handlePresetSelect(hottest);
    }
    // Run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
            Market Intelligence
          </p>
          <h1 className="text-3xl font-bold text-on-surface mt-1 tracking-tight">
            Market Screener
          </h1>
          <p className="text-on-surface-variant mt-1 text-sm">
            Screen and rank markets by score, price, cash-flow, and supply.
          </p>
        </div>

        {/* Export button */}
        <div className="flex-shrink-0">
          {canExport ? (
            <button
              type="button"
              onClick={handleExport}
              disabled={rows.length === 0}
              className="
                inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium
                border border-outline transition-all duration-200
                text-on-surface-variant hover:border-primary hover:text-primary hover:bg-primary-container/20
                disabled:opacity-40 disabled:cursor-not-allowed
              "
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          ) : (
            <button
              type="button"
              disabled
              title="Upgrade to Pro to export"
              className="
                inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium
                border border-outline-variant text-on-surface-variant/50 cursor-not-allowed
              "
            >
              <Lock className="w-4 h-4" />
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs + window selector ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <ScreenerTabs tab={tab} onChange={setTabState} />
        <WindowSelector value={changeWindow} onChange={handleWindowChange} />
      </div>

      {/* ── Geo selector + (screener-only) preset chips ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <GeoSegmentedControl value={geo} onChange={handleGeoChange} />
        <StateSelect value={stateFilter} onChange={handleStateChange} />
        {tab === "screener" && (
          <PresetChips
            activePreset={activePreset}
            onSelect={handlePresetSelect}
          />
        )}
      </div>

      {/* ── ZIP lock gate ── */}
      {isZipLocked ? (
        <GeoLockCard
          geoName="ZIP Code Markets"
          geoLevel="zip"
          className="max-w-md mx-auto mt-8"
        />
      ) : tab === "movers" ? (
        <MoversTab
          geo={geo}
          moverWindow={changeWindow}
          stateFilter={stateFilter}
          enabled={!isZipLocked}
        />
      ) : (
        <>
          <FilterRail
            filters={filters}
            changeWindow={changeWindow}
            onChange={handleFilterChange}
            onReset={handleFilterReset}
          />
          <ScreenerTable
            rows={rows}
            sortBy={sortBy}
            sortOrder={sortOrder}
            page={page}
            pageSize={PAGE_SIZE}
            isFetching={isFetching}
            onSort={handleSort}
            changeWindow={changeWindow}
            activeFilters={activeFilters}
            onClearFilters={handleFilterReset}
          />
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            hasMore={hasMore}
            onPageChange={setPageState}
          />
        </>
      )}
    </div>
  );
}
