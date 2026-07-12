"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { ScreenerHeader } from "./components/ScreenerHeader";
import { MoversTab } from "./components/MoversTab";
import { WindowSelector } from "./components/WindowSelector";
import { MarketSizeToggle } from "./components/MarketSizeToggle";
import { populationFloorFor } from "./lib/market-size";
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
  readHideSmallMarkets,
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
  // De-noise (#26/#29): hide micro-markets by default; user-clearable. Resolves to
  // a geo-appropriate population floor sent to both the screener and movers queries.
  const [hideSmallMarkets, setHideSmallMarketsState] = useState<boolean>(() =>
    readHideSmallMarkets(params),
  );
  const populationMin = populationFloorFor(geo, hideSmallMarkets);

  // Entitlements
  const { canAccess } = useEntitlements();
  const canExport = canAccess("feature", "export_csv");
  const canViewZip = canAccess("geo", "zip");
  const isZipLocked = geo === "zip" && !canViewZip;

  // Build the query sent to the hook
  const query: ScreenerQuery = {
    ...filters,
    state: stateFilter || undefined,
    populationMin,
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
  // Snapshot freshness: rows share one monthly as_of date. Surface it so users
  // can see how current the screener is (previously only the CSV carried it).
  const dataAsOf = rows[0]?.as_of ?? null;

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
      nextHideSmall: boolean,
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
        nextHideSmall,
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
      hideSmallMarkets,
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
    hideSmallMarkets,
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

  const handleHideSmallMarketsChange = useCallback((next: boolean) => {
    trackEvent("feature.screener_market_size", { hideSmall: next });
    setHideSmallMarketsState(next);
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
    // w-full is load-bearing: AppShell's <main> is a flex column, and mx-auto
    // disables flex stretch — without an explicit width this container sizes
    // to the table's intrinsic width and blows out the mobile viewport.
    <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* ── Page header ── */}
      <ScreenerHeader
        dataAsOf={dataAsOf}
        canExport={canExport}
        exportDisabled={rows.length === 0}
        onExport={handleExport}
      />

      {/* ── Tabs + window selector ── */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-4">
        <ScreenerTabs tab={tab} onChange={setTabState} />
        <WindowSelector value={changeWindow} onChange={handleWindowChange} />
      </div>

      {/* ── Geo selector + (screener-only) preset chips ── */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-4">
        <GeoSegmentedControl value={geo} onChange={handleGeoChange} />
        <StateSelect value={stateFilter} onChange={handleStateChange} />
        <MarketSizeToggle
          geo={geo}
          hideSmallMarkets={hideSmallMarkets}
          onChange={handleHideSmallMarketsChange}
        />
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
          populationMin={populationMin}
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
