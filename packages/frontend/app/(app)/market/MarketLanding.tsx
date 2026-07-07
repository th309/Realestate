"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  MapPin,
  Building2,
  Clock,
  Star,
  ChevronRight,
  Scale,
} from "lucide-react";
import Link from "next/link";
import { PageHeaderWithBreadcrumbs } from "@/components/navigation";
import { SearchWidget } from "@/app/map/components/SearchWidget";
import { useUniversalSearch } from "@/app/shared/hooks/useUniversalSearch";
import type { SearchResult } from "@/app/map/types";
import { TopMarketsSection } from "./TopMarketsSection";
import {
  getRecentMarkets,
  addRecentMarket,
  type RecentMarket,
} from "./recent-markets";
import { MarketComparison } from "./compare/MarketComparison";
import { titleCaseLocationName } from "@/lib/data";
import { PeerSearchBox, type PickedMarket } from "./compare/PeerSearchBox";
import { useEntitlements } from "@/lib/entitlements";
import { PaywallCard } from "@/components/entitlements/PaywallCard";

// Popular metros to display as quick links
const POPULAR_METROS = [
  { id: "35620", name: "New York-Newark-Jersey City, NY-NJ-PA", state: "NY" },
  { id: "31080", name: "Los Angeles-Long Beach-Anaheim, CA", state: "CA" },
  { id: "16980", name: "Chicago-Naperville-Elgin, IL-IN-WI", state: "IL" },
  { id: "19100", name: "Dallas-Fort Worth-Arlington, TX", state: "TX" },
  { id: "26420", name: "Houston-The Woodlands-Sugar Land, TX", state: "TX" },
  { id: "12420", name: "Austin-Round Rock-San Marcos, TX", state: "TX" },
  { id: "33100", name: "Miami-Fort Lauderdale-Pompano Beach, FL", state: "FL" },
  { id: "38060", name: "Phoenix-Mesa-Chandler, AZ", state: "AZ" },
  { id: "41860", name: "San Francisco-Oakland-Berkeley, CA", state: "CA" },
  { id: "42660", name: "Seattle-Tacoma-Bellevue, WA", state: "WA" },
  {
    id: "47900",
    name: "Washington-Arlington-Alexandria, DC-VA-MD-WV",
    state: "DC",
  },
  { id: "14460", name: "Boston-Cambridge-Newton, MA-NH", state: "MA" },
];

export function MarketLanding() {
  const router = useRouter();
  const [recentMarkets, setRecentMarkets] = useState<RecentMarket[]>([]);
  const [compareSource, setCompareSource] = useState<PickedMarket | null>(null);

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

  // Market comparison is a Pro feature. Wait for entitlements to resolve so a
  // Pro user never flashes the paywall (tier is SSR-seeded for logged-in users).
  const { tier, loading: entitlementsLoading } = useEntitlements();
  const canCompare = tier !== "free";

  useEffect(() => {
    setRecentMarkets(getRecentMarkets());
  }, []);

  const handleSelectResult = (result: SearchResult) => {
    addRecentMarket({
      id: result.id,
      name: result.name,
      type: result.type as "metro" | "county" | "zip",
    });
    const params = new URLSearchParams({ type: result.type, view: "investor" });
    if (result.state) params.set("state", result.state);
    router.push(`/market/${result.id}?${params.toString()}`);
    clearSearch();
  };

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
        <PageHeaderWithBreadcrumbs
          breadcrumbs={[{ label: "Markets" }]}
          title="Explore Markets"
          description="AI-powered market analysis for metros, counties, and zip codes"
          icon={<TrendingUp className="w-5 h-5" />}
          className="mb-8"
        />

        {/* Search Section */}
        <div className="bg-surface-container rounded-3xl p-8 md:p-12 mb-8 border border-outline-variant">
          <div className="max-w-2xl mx-auto text-center mb-6">
            <h2 className="text-xl font-medium text-on-surface mb-2">
              Find Your Market
            </h2>
            <p className="text-on-surface-variant text-sm">
              Search by city, metro area, county, or zip code
            </p>
          </div>
          <div className="max-w-xl mx-auto">
            <SearchWidget
              searchQuery={searchQuery}
              searchResults={searchResults}
              searchLoading={searchLoading}
              showSearchResults={showSearchResults}
              searchRef={searchRef}
              onSearch={handleSearch}
              onSelectResult={handleSelectResult}
              onFocus={() => setShowSearchResults(true)}
              placeholder="Search city, metro, county, or zip..."
              className="w-full"
            />
          </div>
        </div>

        {/* Recent Markets */}
        {recentMarkets.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 text-on-surface-variant mb-4">
              <Clock className="w-5 h-5" />
              <h2 className="text-lg font-medium text-on-surface">
                Recently Viewed
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentMarkets.slice(0, 6).map((market) => (
                <Link
                  key={market.id}
                  href={`/market/${market.id}?type=${market.type}&view=investor`}
                  className="group flex items-center gap-3 p-4 bg-surface-container rounded-xl border border-outline-variant hover:bg-surface-container-high hover:border-outline transition-all"
                >
                  <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
                    {market.type === "metro" ? (
                      <Building2 className="w-4 h-4" />
                    ) : (
                      <MapPin className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-on-surface truncate">
                      {titleCaseLocationName(market.name.split(",")[0])}
                    </div>
                    <div className="text-xs text-on-surface-variant capitalize">
                      {market.type}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-on-surface-variant group-hover:text-primary transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Compare Markets — pick a market and see it beside its closest peer,
            or search a second market to override the suggested peer. */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-on-surface-variant mb-4">
            <Scale className="w-5 h-5" />
            <h2 className="text-lg font-medium text-on-surface">
              Compare Markets
            </h2>
          </div>
          {entitlementsLoading ? (
            <div className="bg-surface-container rounded-2xl border border-outline-variant p-6 text-center text-sm text-on-surface-variant">
              Loading…
            </div>
          ) : canCompare ? (
            <div className="bg-surface-container rounded-2xl border border-outline-variant p-6">
              <p className="text-sm text-on-surface-variant mb-4 text-center">
                Pick a market to see it side by side with its closest peer.
              </p>
              <div className="max-w-md mx-auto">
                <PeerSearchBox
                  placeholder="🔍  Search a metro, county, or zip to compare"
                  onPick={setCompareSource}
                />
              </div>
              {compareSource && (
                <div className="mt-6">
                  <MarketComparison source={compareSource} />
                </div>
              )}
            </div>
          ) : (
            <PaywallCard
              type="feature"
              id="market_comparison"
              title="Compare markets side by side"
              description="Pick any market and see it next to its closest peer: scores, prices, rents, and momentum side by side. Available on Pro."
            />
          )}
        </div>

        <TopMarketsSection />

        {/* Popular Markets */}
        <div>
          <div className="flex items-center gap-2 text-on-surface-variant mb-4">
            <Star className="w-5 h-5" />
            <h2 className="text-lg font-medium text-on-surface">
              Popular Markets
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {POPULAR_METROS.map((metro) => (
              <Link
                key={metro.id}
                href={`/market/${metro.id}?type=metro&view=investor`}
                onClick={() =>
                  addRecentMarket({
                    id: metro.id,
                    name: metro.name,
                    type: "metro",
                  })
                }
                className="group flex items-center gap-3 p-4 bg-surface-container rounded-xl border border-outline-variant hover:bg-surface-container-high hover:border-outline transition-all"
              >
                <div className="p-2 rounded-lg bg-tertiary/10 text-tertiary group-hover:bg-tertiary/15 transition-colors">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-on-surface truncate">
                    {metro.name.split(",")[0]}
                  </div>
                  <div className="text-xs text-on-surface-variant">
                    {metro.state} • Metro
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-on-surface-variant group-hover:text-tertiary transition-colors" />
              </Link>
            ))}
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-12 pt-8 border-t border-outline-variant">
          <h3 className="text-sm font-medium text-on-surface-variant uppercase tracking-wide mb-6 text-center">
            What You'll Find
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-6">
              <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <h4 className="font-medium text-on-surface mb-2">
                Market Scores
              </h4>
              <p className="text-sm text-on-surface-variant">
                PropertyIQ scores for every geography level
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-tertiary/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-tertiary" />
              </div>
              <h4 className="font-medium text-on-surface mb-2">Key Metrics</h4>
              <p className="text-sm text-on-surface-variant">
                Real-time data on prices, rents, inventory, and market dynamics
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-secondary/10 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-secondary" />
              </div>
              <h4 className="font-medium text-on-surface mb-2">AI Insights</h4>
              <p className="text-sm text-on-surface-variant">
                Tailored analysis for homebuyers and investors
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
