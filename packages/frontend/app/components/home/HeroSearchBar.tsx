"use client";

import React, { useRef, useState } from "react";
import { Search, MapPin, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useUniversalSearch } from "@/app/shared/hooks/useUniversalSearch";
import { fetchScore } from "@/lib/data";

import { getScoreColorOnDark } from "@/app/components/scoring/score-color";

function getScoreLabel(score: number): string {
  if (score >= 90) return "VERY STRONG";
  if (score >= 80) return "STRONG";
  if (score >= 70) return "RISING";
  if (score >= 60) return "FIRMING";
  if (score >= 50) return "STEADY";
  if (score >= 40) return "EASING";
  if (score >= 20) return "WEAK";
  return "VERY WEAK";
}

interface SelectedMarket {
  id: string;
  name: string;
  type: string;
  state?: string;
  center?: [number, number];
  score: number | null;
  label: string;
  loading: boolean;
}

export function HeroSearchBar() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<SelectedMarket | null>(null);
  const {
    searchQuery,
    searchResults,
    searchLoading,
    showSearchResults,
    setShowSearchResults,
    searchRef,
    handleSearch,
    clearSearch,
  } = useUniversalSearch({});

  const handleSelectResult = async (result: {
    id: string;
    name: string;
    type: string;
    state?: string;
    center?: [number, number];
  }) => {
    clearSearch();
    setSelected({ ...result, score: null, label: "", loading: true });

    try {
      const scoreData = await fetchScore(result.type, result.id);
      if (scoreData?.scores?.propertyiq) {
        const s = scoreData.scores.propertyiq.score;
        setSelected((prev) =>
          prev
            ? { ...prev, score: s, label: getScoreLabel(s), loading: false }
            : null,
        );
      } else {
        navigateToMap(result);
      }
    } catch {
      navigateToMap(result);
    }
  };

  function navigateToMap(result: {
    id: string;
    name: string;
    type: string;
    state?: string;
    center?: [number, number];
  }) {
    setSelected(null);
    const params = new URLSearchParams({
      geo: result.type,
      id: result.id,
      name: result.name,
    });
    if (result.center) {
      params.set("lng", String(result.center[0]));
      params.set("lat", String(result.center[1]));
    }
    if (result.state) params.set("state", result.state);
    router.push(`/map?${params.toString()}`);
  }

  function handleDismiss() {
    setSelected(null);
    inputRef.current?.focus();
  }

  function handleExploreMap() {
    if (selected) navigateToMap(selected);
  }

  function handleMarketData() {
    if (!selected) return;
    const name = selected.name
      .split(",")[0]
      .trim()
      .split("-")[0]
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
    const state = selected.state?.toLowerCase() || "";
    const slug = state ? `${name}-${state}` : name;
    router.push(`/markets/${slug}`);
  }

  return (
    <div
      ref={searchRef as React.RefObject<HTMLDivElement>}
      className="relative w-full max-w-lg mx-auto"
    >
      <div className="flex items-center bg-surface-container-lowest rounded-full border border-outline-variant shadow-md hover:shadow-lg transition-shadow px-5 py-3.5 gap-3">
        <Search className="w-5 h-5 text-on-surface-variant flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            handleSearch(e.target.value);
            if (selected) setSelected(null);
          }}
          onFocus={() => {
            if (searchQuery.length >= 2) setShowSearchResults(true);
          }}
          placeholder="Search any city, metro, county, or ZIP..."
          className="flex-1 bg-transparent text-base text-on-surface placeholder:text-on-surface-variant/60 outline-none"
        />
      </div>

      {showSearchResults && !selected && (
        <div className="absolute top-full mt-2 w-full bg-surface-container-lowest rounded-2xl shadow-lg border border-outline-variant/30 z-50 overflow-hidden">
          <div className="max-h-72 overflow-y-auto">
            {searchLoading && (
              <div className="flex items-center gap-2 px-4 py-3">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-on-surface-variant">
                  Searching...
                </span>
              </div>
            )}
            {!searchLoading &&
              searchResults.length === 0 &&
              searchQuery.length >= 2 && (
                <p className="px-4 py-3 text-sm text-on-surface-variant text-center">
                  No markets found
                </p>
              )}
            {searchResults.map((result) => (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => handleSelectResult(result)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-container transition-colors"
              >
                <MapPin className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-on-surface">
                    {result.name}
                  </div>
                  {result.subtitle && (
                    <div className="text-xs text-on-surface-variant">
                      {result.subtitle}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-on-surface-variant/60 uppercase tracking-wider flex-shrink-0 bg-surface-container-high px-1.5 py-0.5 rounded">
                  {result.type}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-white">{selected.name}</h3>
              <p className="text-xs text-[#C5CAE9] uppercase tracking-wide mt-0.5">
                {selected.type === "metro"
                  ? "Metropolitan Area"
                  : selected.type === "county"
                    ? "County"
                    : selected.type.toUpperCase()}
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="text-white/40 hover:text-white p-1 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {selected.loading ? (
            <div className="flex items-center gap-2 py-3">
              <div className="w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-[#C5CAE9]">Loading score...</span>
            </div>
          ) : selected.score !== null ? (
            <div className="flex items-center gap-4 mb-4">
              <span
                className="font-[family-name:var(--font-roboto-mono)] text-4xl font-bold"
                style={{ color: getScoreColorOnDark(selected.score) }}
              >
                {selected.score}
              </span>
              <div>
                <p className="text-sm font-semibold text-white">
                  PropertyIQ Score
                </p>
                <p className="text-xs text-[#C5CAE9]">{selected.label}</p>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleExploreMap}
              className="flex-1 px-5 py-2.5 rounded-full bg-white text-[#1A237E] text-sm font-semibold hover:bg-white/90 transition-colors text-center"
            >
              Explore on Map
            </button>
            <button
              onClick={handleMarketData}
              className="flex-1 px-5 py-2.5 rounded-full border border-white/30 text-white text-sm font-semibold hover:bg-white/10 transition-colors text-center"
            >
              See Full Market Data
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
