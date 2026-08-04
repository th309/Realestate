"use client";

import type { GeoLevel, SearchResult } from "./types";
import {
  MenuIcon,
  SearchWidget,
  GeoLevelPills,
  ScoreTypeToggle,
  type ScoreViewMode,
} from "./components";
import { Breadcrumbs } from "@/components/navigation";
import { EntitlementGate } from "@/components/entitlements";
import { ControlBar } from "@/app/components/app-shell";

interface MapToolbarProps {
  searchRef: React.RefObject<HTMLDivElement | null>;
  searchQuery: string;
  searchResults: SearchResult[];
  searchLoading: boolean;
  showSearchResults: boolean;
  onSearch: (query: string) => void;
  onSelectSearchResult: (result: SearchResult) => void;
  onShowSearchResults: (show: boolean) => void;
  onToggleMobileMenu: () => void;
  geoLevel: GeoLevel;
  selectedMetric: string;
  selectedState: string;
  onGeoLevelChange: (level: GeoLevel) => void;
  onStateChange: (state: string) => void;
  quizCompleted: boolean;
  scoreViewMode: ScoreViewMode;
  onScoreViewModeChange: (mode: ScoreViewMode) => void;
}

/**
 * Top controls bar for the map page: breadcrumbs, sidebar toggle, search, and
 * the geo-level pills + market-match toggle (desktop and mobile layouts).
 * Pure presentational — all state lives in the page via useMapPage hooks.
 */
export function MapToolbar({
  searchRef,
  searchQuery,
  searchResults,
  searchLoading,
  showSearchResults,
  onSearch,
  onSelectSearchResult,
  onShowSearchResults,
  onToggleMobileMenu,
  geoLevel,
  selectedMetric,
  selectedState,
  onGeoLevelChange,
  onStateChange,
  quizCompleted,
  scoreViewMode,
  onScoreViewModeChange,
}: MapToolbarProps) {
  return (
    <ControlBar>
      <Breadcrumbs
        items={[{ label: "Map" }]}
        className="hidden md:flex text-sm"
      />
      <div className="hidden md:block h-5 w-px bg-outline-variant" />

      {/* Sidebar Toggle */}
      <button
        className="flex-shrink-0 rounded-full p-2 text-on-surface-variant transition-all duration-200 hover:bg-surface-container hover:text-on-surface active:scale-95"
        onClick={onToggleMobileMenu}
        aria-label="Toggle sidebar"
      >
        <MenuIcon />
      </button>

      {/* Search — takes the slack so the geo pills sit hard right. */}
      <div className="min-w-[200px] flex-1 max-w-xl" data-tour="search-bar">
        <SearchWidget
          searchRef={searchRef}
          searchQuery={searchQuery}
          searchResults={searchResults}
          searchLoading={searchLoading}
          showSearchResults={showSearchResults}
          onSearch={onSearch}
          onSelectResult={onSelectSearchResult}
          onFocus={() => searchResults.length > 0 && onShowSearchResults(true)}
        />
      </div>

      {/* Desktop Geo Pills + Match Toggle — wrap={false} pins the original
          single-line desktop layout now that GeoLevelPills wraps by default */}
      <div className="hidden flex-shrink-0 items-center gap-3 md:flex">
        <GeoLevelPills
          wrap={false}
          geoLevel={geoLevel}
          selectedMetric={selectedMetric}
          selectedState={selectedState}
          onGeoLevelChange={onGeoLevelChange}
          onStateChange={onStateChange}
        />
        {quizCompleted && (
          <EntitlementGate type="feature" id="market_match">
            <ScoreTypeToggle
              activeMode={scoreViewMode}
              onChange={onScoreViewModeChange}
            />
          </EntitlementGate>
        )}
      </div>

      {/* Mobile Geo Pills + Match Toggle — wrap, never scroll horizontally.
          isMobile makes GeoLevelPills wrap its own chips (flex-wrap + compact
          sizing); the match toggle stacks below. `basis-full` gives them their
          own line inside the wrapping ControlBar. */}
      <div className="w-full basis-full space-y-2 md:hidden">
        <GeoLevelPills
          isMobile
          excludeLevels={["city"]}
          geoLevel={geoLevel}
          selectedMetric={selectedMetric}
          selectedState={selectedState}
          onGeoLevelChange={onGeoLevelChange}
          onStateChange={onStateChange}
        />
        {quizCompleted && (
          <EntitlementGate type="feature" id="market_match">
            <ScoreTypeToggle
              activeMode={scoreViewMode}
              onChange={onScoreViewModeChange}
            />
          </EntitlementGate>
        )}
      </div>
    </ControlBar>
  );
}
