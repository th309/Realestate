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

interface MapToolbarProps {
  searchRef: React.RefObject<HTMLDivElement | null>;
  searchQuery: string;
  searchResults: SearchResult[];
  searchLoading: boolean;
  showSearchResults: boolean;
  onSearch: (query: string) => void;
  onSelectSearchResult: (result: SearchResult) => void;
  onShowSearchResults: (show: boolean) => void;
  mobileMenuOpen: boolean;
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
  mobileMenuOpen,
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
    <div className="bg-surface-container-lowest/80 backdrop-blur-md border-b border-outline-variant px-4 py-3 z-20 shadow-sm">
      <div className="max-w-[1920px] mx-auto flex flex-col md:flex-row items-center gap-4">
        {/* Top Row (Desktop) or Only Row (Mobile) */}
        <div className="flex items-center gap-4 w-full md:w-auto flex-1">
          {/* Breadcrumbs */}
          <Breadcrumbs
            items={[{ label: "Map" }]}
            className="hidden md:flex text-sm"
          />
          <div className="hidden md:block h-5 w-px bg-outline-variant" />

          {/* Sidebar Toggle */}
          <button
            className="p-2.5 text-on-surface-variant hover:bg-surface-container hover:text-on-surface rounded-full transition-all duration-200 active:scale-95 flex-shrink-0"
            onClick={onToggleMobileMenu}
            aria-label="Toggle sidebar"
          >
            <MenuIcon />
          </button>

          {/* Search Bar - Flexible Width */}
          <div className="flex-1 max-w-xl" data-tour="search-bar">
            <SearchWidget
              searchRef={searchRef}
              searchQuery={searchQuery}
              searchResults={searchResults}
              searchLoading={searchLoading}
              showSearchResults={showSearchResults}
              onSearch={onSearch}
              onSelectResult={onSelectSearchResult}
              onFocus={() =>
                searchResults.length > 0 && onShowSearchResults(true)
              }
            />
          </div>
        </div>

        {/* Desktop Geo Pills + Match Toggle — wrap={false} pins the original
            single-line desktop layout now that GeoLevelPills wraps by default */}
        <div className="hidden md:flex items-center gap-3 flex-shrink-0">
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
            sizing); the match toggle stacks below. */}
        <div className="md:hidden w-full space-y-2 px-2 pb-1">
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
      </div>
    </div>
  );
}
