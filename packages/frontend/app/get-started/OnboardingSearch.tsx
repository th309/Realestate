"use client";

import { useEffect } from "react";
import { SearchWidget } from "@/app/map/components/SearchWidget";
import { useUniversalSearch } from "@/app/shared/hooks/useUniversalSearch";
import type { SearchResult } from "@/app/map/types";
import { trackEvent } from "@/lib/analytics/tracker";

interface OnboardingSearchProps {
  placeholder: string;
  onMarketSelect: (result: SearchResult) => void;
}

export function OnboardingSearch({
  placeholder,
  onMarketSelect,
}: OnboardingSearchProps) {
  const {
    searchQuery,
    searchResults,
    searchLoading,
    showSearchResults,
    searchRef,
    handleSearch,
  } = useUniversalSearch({});

  // Auto-focus the search input when this component mounts
  useEffect(() => {
    const input = searchRef.current?.querySelector("input");
    if (input) {
      input.focus();
    }
  }, [searchRef]);

  return (
    <div className="space-y-6 text-center">
      <div>
        <h2 className="text-2xl font-light text-on-surface">
          Pick your first market
        </h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          You can explore more markets anytime
        </p>
      </div>
      <SearchWidget
        searchQuery={searchQuery}
        searchResults={searchResults}
        searchLoading={searchLoading}
        showSearchResults={showSearchResults}
        searchRef={searchRef}
        onSearch={handleSearch}
        onSelectResult={(result) => {
          trackEvent("onboarding.get_started_search", {
            geoLevel: result.type,
            geoId: result.id,
            geoName: result.name,
          });
          onMarketSelect(result);
        }}
        onFocus={() => {}}
        placeholder={placeholder}
        showFavorites={false}
        className="max-w-md mx-auto"
      />
    </div>
  );
}
