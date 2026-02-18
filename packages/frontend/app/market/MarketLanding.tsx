'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, MapPin, Building2, Clock, Star, ChevronRight, Trophy, Hash } from 'lucide-react';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/navigation';
import { SearchWidget } from '@/app/map/components/SearchWidget';
import { useUniversalSearch } from '@/app/shared/hooks/useUniversalSearch';
import { useTopMarkets } from '@/lib/data/hooks/useTopMarkets';
import type { SearchResult } from '@/app/map/types';
import type { TopMarketsGeo, TopMarketsScoreType } from '@/lib/data';

// Popular metros to display as quick links
const POPULAR_METROS = [
  { id: '35620', name: 'New York-Newark-Jersey City, NY-NJ-PA', state: 'NY' },
  { id: '31080', name: 'Los Angeles-Long Beach-Anaheim, CA', state: 'CA' },
  { id: '16980', name: 'Chicago-Naperville-Elgin, IL-IN-WI', state: 'IL' },
  { id: '19100', name: 'Dallas-Fort Worth-Arlington, TX', state: 'TX' },
  { id: '26420', name: 'Houston-The Woodlands-Sugar Land, TX', state: 'TX' },
  { id: '12420', name: 'Austin-Round Rock-San Marcos, TX', state: 'TX' },
  { id: '33100', name: 'Miami-Fort Lauderdale-Pompano Beach, FL', state: 'FL' },
  { id: '38060', name: 'Phoenix-Mesa-Chandler, AZ', state: 'AZ' },
  { id: '41860', name: 'San Francisco-Oakland-Berkeley, CA', state: 'CA' },
  { id: '42660', name: 'Seattle-Tacoma-Bellevue, WA', state: 'WA' },
  { id: '47900', name: 'Washington-Arlington-Alexandria, DC-VA-MD-WV', state: 'DC' },
  { id: '14460', name: 'Boston-Cambridge-Newton, MA-NH', state: 'MA' },
];

// Recent markets storage key
const RECENT_MARKETS_KEY = 'propertyiq-recent-markets';

interface RecentMarket {
  id: string;
  name: string;
  type: 'metro' | 'county' | 'zip';
  visitedAt: number;
}

function getRecentMarkets(): RecentMarket[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(RECENT_MARKETS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentMarket(market: Omit<RecentMarket, 'visitedAt'>) {
  if (typeof window === 'undefined') return;
  try {
    const recent = getRecentMarkets().filter(m => m.id !== market.id);
    recent.unshift({ ...market, visitedAt: Date.now() });
    localStorage.setItem(RECENT_MARKETS_KEY, JSON.stringify(recent.slice(0, 10)));
  } catch {
    // Ignore storage errors
  }
}

// ============================================================================
// TOP MARKETS SECTION
// ============================================================================

const GEO_TABS: { value: TopMarketsGeo; label: string }[] = [
  { value: 'metro', label: 'Metros' },
  { value: 'county', label: 'Counties' },
  { value: 'zip', label: 'Zips' },
];

const SCORE_TABS: { value: TopMarketsScoreType; label: string }[] = [
  { value: 'investoredge', label: 'InvestorEdge' },
  { value: 'homeready', label: 'HomeReady' },
  { value: 'markethealth', label: 'Market Health' },
];

const LIMIT_OPTIONS = [10, 25, 50, 100] as const;

function getGradeColor(grade: string): string {
  if (!grade) return 'text-on-surface-variant';
  const g = grade.toUpperCase();
  if (g.startsWith('A')) return 'text-green-600 dark:text-green-400';
  if (g.startsWith('B')) return 'text-blue-600 dark:text-blue-400';
  if (g.startsWith('C')) return 'text-amber-600 dark:text-amber-400';
  if (g.startsWith('D')) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-green-500/10';
  if (score >= 60) return 'bg-blue-500/10';
  if (score >= 40) return 'bg-amber-500/10';
  if (score >= 20) return 'bg-orange-500/10';
  return 'bg-red-500/10';
}

function getScoreTextColor(score: number): string {
  if (score >= 80) return 'text-green-700 dark:text-green-400';
  if (score >= 60) return 'text-blue-700 dark:text-blue-400';
  if (score >= 40) return 'text-amber-700 dark:text-amber-400';
  if (score >= 20) return 'text-orange-700 dark:text-orange-400';
  return 'text-red-700 dark:text-red-400';
}

function TopMarketsSection() {
  const [geo, setGeo] = useState<TopMarketsGeo>('metro');
  const [scoreType, setScoreType] = useState<TopMarketsScoreType>('investoredge');
  const [limit, setLimit] = useState<number>(10);

  const { data, isLoading, error } = useTopMarkets({
    geography: geo,
    scoreType,
    limit,
  });

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center gap-2 text-on-surface-variant mb-4">
        <Trophy className="w-5 h-5" />
        <h2 className="text-lg font-medium text-on-surface">Top Markets</h2>
      </div>

      {/* Controls */}
      <div className="bg-surface-container rounded-2xl border border-outline-variant overflow-hidden">
        {/* Top bar: geo tabs + score type + limit */}
        <div className="p-4 border-b border-outline-variant space-y-3">
          {/* Geography tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mr-1">Geography</span>
            <div className="flex bg-surface-container-high rounded-lg p-0.5">
              {GEO_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setGeo(tab.value)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                    geo === tab.value
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-outline-variant mx-1 hidden sm:block" />

            {/* Score type tabs */}
            <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mr-1 hidden sm:inline">Score</span>
            <div className="flex bg-surface-container-high rounded-lg p-0.5">
              {SCORE_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setScoreType(tab.value)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                    scoreType === tab.value
                      ? 'bg-tertiary text-on-tertiary shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Limit selector */}
          <div className="flex items-center gap-2">
            <Hash className="w-3.5 h-3.5 text-on-surface-variant" />
            <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wide">Show</span>
            <div className="flex bg-surface-container-high rounded-lg p-0.5">
              {LIMIT_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => setLimit(n)}
                  className={`px-2.5 py-1 text-sm font-medium rounded-md transition-all ${
                    limit === n
                      ? 'bg-secondary text-on-secondary shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="divide-y divide-outline-variant">
          {isLoading ? (
            // Skeleton loading
            Array.from({ length: Math.min(limit, 10) }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                <div className="w-8 h-8 rounded-lg bg-surface-container-high" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-48 bg-surface-container-high rounded" />
                  <div className="h-3 w-24 bg-surface-container-high rounded" />
                </div>
                <div className="h-6 w-12 bg-surface-container-high rounded" />
              </div>
            ))
          ) : error ? (
            <div className="px-4 py-8 text-center text-on-surface-variant text-sm">
              Failed to load rankings. Please try again.
            </div>
          ) : data.length === 0 ? (
            <div className="px-4 py-8 text-center text-on-surface-variant text-sm">
              No ranked markets available for this selection.
            </div>
          ) : (
            data.map((market, index) => (
              <Link
                key={market.location_id}
                href={`/market/${market.location_id}?type=${geo}&view=investor`}
                onClick={() =>
                  addRecentMarket({
                    id: market.location_id,
                    name: market.location_name,
                    type: geo,
                  })
                }
                className="group flex items-center gap-3 px-4 py-3 hover:bg-surface-container-high transition-colors"
              >
                {/* Rank */}
                <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-sm font-semibold text-on-surface-variant group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                  {index + 1}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-on-surface truncate">
                    {market.location_name}
                  </div>
                </div>

                {/* Score */}
                <div className={`px-2.5 py-1 rounded-lg text-sm font-semibold tabular-nums ${getScoreBgColor(market.score)} ${getScoreTextColor(market.score)}`}>
                  {market.score.toFixed(1)}
                </div>

                {/* Grade */}
                <div className={`text-sm font-bold w-8 text-center ${getGradeColor(market.grade)}`}>
                  {market.grade}
                </div>

                <ChevronRight className="w-4 h-4 text-on-surface-variant group-hover:text-primary transition-colors shrink-0" />
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function MarketLanding() {
  const router = useRouter();
  const [recentMarkets, setRecentMarkets] = useState<RecentMarket[]>([]);

  // Initialize search
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

  // Load recent markets on mount
  useEffect(() => {
    setRecentMarkets(getRecentMarkets());
  }, []);

  // Handle search result selection
  const handleSelectResult = (result: SearchResult) => {
    // Save to recent markets
    addRecentMarket({
      id: result.id,
      name: result.name,
      type: result.type as 'metro' | 'county' | 'zip',
    });

    // Navigate to market detail page (include state for ZIP-level filtering)
    const params = new URLSearchParams({ type: result.type, view: 'investor' });
    if (result.state) params.set('state', result.state);
    router.push(`/market/${result.id}?${params.toString()}`);
    clearSearch();
  };

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
        {/* Breadcrumbs */}
        <Breadcrumbs items={[{ label: 'Markets' }]} className="mb-4" />

        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-primary mb-1">
            <TrendingUp className="w-5 h-5" />
            <span className="text-xs font-medium uppercase tracking-wider">
              Market Intelligence
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-medium text-on-surface tracking-tight">
            Explore Markets
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">
            AI-powered market analysis for metros, counties, and zip codes
          </p>
        </div>

        {/* Search Section - Hero */}
        <div className="bg-surface-container rounded-3xl p-8 md:p-12 mb-8 border border-outline-variant">
          <div className="max-w-2xl mx-auto text-center mb-6">
            <h2 className="text-xl font-medium text-on-surface mb-2">
              Find Your Market
            </h2>
            <p className="text-on-surface-variant text-sm">
              Search by city, metro area, county, or zip code
            </p>
          </div>

          {/* Search Widget */}
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
              <h2 className="text-lg font-medium text-on-surface">Recently Viewed</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentMarkets.slice(0, 6).map((market) => (
                <Link
                  key={market.id}
                  href={`/market/${market.id}?type=${market.type}&view=investor`}
                  className="group flex items-center gap-3 p-4 bg-surface-container rounded-xl border border-outline-variant hover:bg-surface-container-high hover:border-outline transition-all"
                >
                  <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
                    {market.type === 'metro' ? (
                      <Building2 className="w-4 h-4" />
                    ) : (
                      <MapPin className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-on-surface truncate">
                      {market.name.split(',')[0]}
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

        {/* Top Markets Rankings */}
        <TopMarketsSection />

        {/* Popular Markets */}
        <div>
          <div className="flex items-center gap-2 text-on-surface-variant mb-4">
            <Star className="w-5 h-5" />
            <h2 className="text-lg font-medium text-on-surface">Popular Markets</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {POPULAR_METROS.map((metro) => (
              <Link
                key={metro.id}
                href={`/market/${metro.id}?type=metro&view=investor`}
                onClick={() => addRecentMarket({ id: metro.id, name: metro.name, type: 'metro' })}
                className="group flex items-center gap-3 p-4 bg-surface-container rounded-xl border border-outline-variant hover:bg-surface-container-high hover:border-outline transition-all"
              >
                <div className="p-2 rounded-lg bg-tertiary/10 text-tertiary group-hover:bg-tertiary/15 transition-colors">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-on-surface truncate">
                    {metro.name.split(',')[0]}
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
              <h4 className="font-medium text-on-surface mb-2">Market Scores</h4>
              <p className="text-sm text-on-surface-variant">
                InvestorEdge, HomeReady, and Market Health scores for every geography
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
