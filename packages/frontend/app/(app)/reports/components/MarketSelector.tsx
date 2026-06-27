"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Plus, X, Sparkles, Info } from "lucide-react";
import { useUniversalSearch } from "@/app/shared/hooks/useUniversalSearch";
import { SearchWidget } from "@/app/map/components/SearchWidget";
import type { SearchResult } from "@/app/map/types";
import type { Market } from "./reportBuilderTypes";

interface MarketSelectorProps {
  markets: Market[];
  onAdd: (market: Market) => void;
  onRemove: (id: string) => void;
  maxMarkets?: number;
  accentColor?: "primary" | "tertiary";
}

export function MarketSelector({
  markets,
  onAdd,
  onRemove,
  maxMarkets = 5,
  accentColor = "primary",
}: MarketSelectorProps) {
  const [showSearch, setShowSearch] = useState(false);

  // Like-geo restriction: the first market picked locks the geo level so a
  // comparison never mixes metros with ZIPs (the report compares like-for-like).
  // Enforced in three places: the backend search filter, the dropdown filter,
  // and the add handler (belt-and-suspenders).
  const lockedGeoLevel = markets.length > 0 ? markets[0].type : undefined;

  const {
    searchQuery,
    searchResults,
    searchLoading,
    showSearchResults,
    searchRef,
    handleSearch,
    clearSearch,
    setShowSearchResults,
  } = useUniversalSearch({ filterByGeoLevel: lockedGeoLevel });

  const handleSelectResult = useCallback(
    (result: SearchResult) => {
      // Reject a mismatched geo level (the dropdown is already filtered, but a
      // stale result could slip through) so all compared markets stay same-level.
      if (markets.length > 0 && result.type !== markets[0].type) {
        return;
      }

      const market: Market = {
        id: result.id,
        name: result.name,
        type: result.type,
        center: result.center,
        state: result.state,
      };

      if (!markets.find((m) => m.id === market.id)) {
        onAdd(market);
      }

      clearSearch();
      setShowSearch(false);
    },
    [markets, onAdd, clearSearch],
  );

  const handleFocus = useCallback(() => {
    if (searchQuery.length >= 2) {
      setShowSearchResults(true);
    }
  }, [searchQuery, setShowSearchResults]);

  return (
    <div className="space-y-4">
      {/* Selected markets */}
      <div className="flex flex-wrap gap-2">
        <AnimatePresence mode="popLayout">
          {markets.map((market, index) => (
            <motion.div
              key={market.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              layout
              className={`
                group flex items-center gap-2 pl-4 pr-2 py-2 rounded-full
                border transition-all duration-200
                ${
                  index === 0
                    ? accentColor === "primary"
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-tertiary/10 border-tertiary/30 text-tertiary"
                    : "bg-surface-container border-outline-variant/50 text-on-surface"
                }
              `}
            >
              <MapPin className="w-4 h-4 opacity-60" />
              <span className="text-sm font-medium">{market.name}</span>
              {index === 0 && (
                <span className="text-xs opacity-60 ml-1">Primary</span>
              )}
              <button
                onClick={() => onRemove(market.id)}
                className="w-6 h-6 rounded-full flex items-center justify-center
                  hover:bg-error/20 hover:text-error transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {markets.length < maxMarkets && !showSearch && (
          <motion.button
            onClick={() => setShowSearch(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full
              border-2 border-dashed border-outline-variant/50
              text-on-surface-variant transition-all duration-200
              ${
                accentColor === "primary"
                  ? "hover:border-primary/50 hover:text-primary"
                  : "hover:border-tertiary/50 hover:text-tertiary"
              }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">Add market</span>
          </motion.button>
        )}
      </div>

      {/* Comparison hint */}
      {markets.length === 1 && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-sm text-on-surface-variant"
        >
          <Info
            className={`w-4 h-4 ${accentColor === "primary" ? "text-primary" : "text-tertiary"}`}
          />
          Add another market to see a side-by-side comparison
        </motion.p>
      )}

      {markets.length >= 2 && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-2 text-sm ${accentColor === "primary" ? "text-primary" : "text-tertiary"}`}
        >
          <Sparkles className="w-4 h-4" />
          Comparison mode: We&apos;ll show how these markets stack up
        </motion.p>
      )}

      {/* Search Widget */}
      <AnimatePresence>
        {(showSearch || markets.length === 0) &&
          markets.length < maxMarkets && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <SearchWidget
                searchQuery={searchQuery}
                searchResults={searchResults.filter(
                  (r) =>
                    !markets.find((m) => m.id === r.id) &&
                    (lockedGeoLevel == null || r.type === lockedGeoLevel),
                )}
                searchLoading={searchLoading}
                showSearchResults={showSearchResults}
                searchRef={searchRef}
                onSearch={handleSearch}
                onSelectResult={handleSelectResult}
                onFocus={handleFocus}
                className="w-full"
                placeholder="Search for a city, metro, ZIP, or county..."
              />
            </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
}
