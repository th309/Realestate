'use client';

import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { useMyMarkets } from '../../hooks/useMyMarkets';
import { useGraphsState } from '../../hooks/useGraphsState';
import { MyMarketsBar } from '../MyMarketsBar';
import { HeroComparison } from '../HeroComparison';
import { ExplorationSidebar } from '../ExplorationSidebar';

/**
 * GraphsPage - Main graphs page with three-zone layout
 * - Top: MyMarketsBar with user's saved markets
 * - Center: HeroComparison with score showdown and visualizations
 * - Right: ExplorationSidebar with questions, insights, and metrics
 */
export function GraphsPage() {
  const [showMarketSearch, setShowMarketSearch] = useState(false);

  // Graphs state with URL sync
  const {
    primaryMarket,
    comparisonMarket,
    chartType: activeTemplate,
    chartType: vizType,
    activeMetric,
    userType,
    selectMarket,
    setChartType: setActiveTemplate,
    setChartType: setVizType,
    setActiveMetric,
  } = useGraphsState() as any;

  // User's markets hook
  const {
    markets,
    loading: marketsLoading,
    addMarket,
  } = useMyMarkets({ userType, maxMarkets: 6 });

  // Selected markets for the bar
  const selectedMarkets = [primaryMarket, comparisonMarket].filter(Boolean) as typeof markets;

  // Handle add market button click
  const handleAddMarket = () => {
    setShowMarketSearch(true);
    // TODO: Open market search modal
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Page Header */}
      <header className="bg-surface-container-lowest border-b border-outline-variant">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-medium text-on-surface">Market Explorer</h1>
              <p className="text-sm text-on-surface-variant mt-0.5">
                Compare markets side by side to find your best fit
              </p>
            </div>

            {/* User Type Toggle */}
            <div className="flex items-center gap-2 bg-surface-container rounded-full p-1">
              <button
                onClick={() => {/* setUserType('homebuyer') */}}
                className={`
                  px-4 py-2 rounded-full text-sm font-medium transition-all
                  ${userType === 'homebuyer'
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:text-on-surface'
                  }
                `}
              >
                Homebuyer
              </button>
              <button
                onClick={() => {/* setUserType('investor') */}}
                className={`
                  px-4 py-2 rounded-full text-sm font-medium transition-all
                  ${userType === 'investor'
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:text-on-surface'
                  }
                `}
              >
                Investor
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-6 py-6">
        {/* Top Zone: My Markets Bar */}
        <MyMarketsBar
          markets={markets}
          selectedMarkets={selectedMarkets}
          onSelectMarket={selectMarket}
          onAddMarket={handleAddMarket}
          loading={marketsLoading}
        />

        {/* Content Grid: Hero (center) + Sidebar (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,360px] gap-6">
          {/* Center Zone: Hero Comparison */}
          <HeroComparison
            primaryMarket={primaryMarket}
            comparisonMarket={comparisonMarket}
            activeTemplate={activeTemplate}
            vizType={vizType}
            userType={userType}
            onTemplateChange={setActiveTemplate}
            onVizTypeChange={setVizType}
          />

          {/* Right Zone: Exploration Sidebar */}
          <ExplorationSidebar
            primaryMarket={primaryMarket}
            comparisonMarket={comparisonMarket}
            template={activeTemplate}
            activeMetric={activeMetric}
            onMetricChange={setActiveMetric}
            userType={userType}
          />
        </div>
      </main>

      {/* Market Search Modal */}
      {showMarketSearch && (
        <MarketSearchModal
          onClose={() => setShowMarketSearch(false)}
          onSelectMarket={(market) => {
            addMarket(market);
            selectMarket({ ...market, score: null });
            setShowMarketSearch(false);
          }}
        />
      )}
    </div>
  );
}

interface MarketSearchModalProps {
  onClose: () => void;
  onSelectMarket: (market: { id: string; name: string; type: 'metro' | 'county' | 'zip'; state?: string }) => void;
}

function MarketSearchModal({ onClose, onSelectMarket }: MarketSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ id: string; name: string; type: 'metro' | 'county' | 'zip'; state: string }>>([]);

  // Simulated search results (replace with actual API call)
  const handleSearch = (value: string) => {
    setQuery(value);
    if (value.length < 2) {
      setResults([]);
      return;
    }

    // Mock results - replace with actual search
    const mockResults = [
      { id: 'phoenix-az', name: 'Phoenix, AZ', type: 'metro' as const, state: 'AZ' },
      { id: 'raleigh-nc', name: 'Raleigh, NC', type: 'metro' as const, state: 'NC' },
      { id: 'tampa-fl', name: 'Tampa, FL', type: 'metro' as const, state: 'FL' },
      { id: 'charlotte-nc', name: 'Charlotte, NC', type: 'metro' as const, state: 'NC' },
      { id: 'atlanta-ga', name: 'Atlanta, GA', type: 'metro' as const, state: 'GA' },
    ].filter(m => m.name.toLowerCase().includes(value.toLowerCase()));

    setResults(mockResults);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-scrim/40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg bg-surface-container-lowest rounded-[28px] shadow-lg overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-outline-variant">
          <Search className="w-5 h-5 text-on-surface-variant" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search markets (city, county, or ZIP)..."
            className="flex-1 bg-transparent text-on-surface placeholder:text-on-surface-variant outline-none"
            autoFocus
          />
          <button
            onClick={onClose}
            className="text-sm font-medium text-primary hover:underline"
          >
            Cancel
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {results.length === 0 && query.length >= 2 ? (
            <p className="p-4 text-sm text-on-surface-variant text-center">
              No markets found for "{query}"
            </p>
          ) : (
            <ul>
              {results.map((result) => (
                <li key={result.id}>
                  <button
                    onClick={() => onSelectMarket(result)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-primary-container transition-colors"
                  >
                    <span className="text-on-surface">{result.name}</span>
                    <span className="text-xs text-on-surface-variant capitalize">
                      {result.type}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {query.length < 2 && (
            <p className="p-4 text-sm text-on-surface-variant text-center">
              Type at least 2 characters to search
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default GraphsPage;
