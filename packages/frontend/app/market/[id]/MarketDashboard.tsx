'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Home,
  Share2,
  Download,
  RefreshCw,
  ChevronLeft,
  MapPin,
  ArrowUpRight,
  ArrowDownRight,
  Lock,
} from 'lucide-react';
import Link from 'next/link';
import { ScoreDisplay, getScoreLabel } from '@/app/components/scoring/ScoreDisplay';
import { useDataCardBatch, type GeoLevel, isMetricSupportedForGeo, getMetricConfig } from '@/lib/data';
import { Breadcrumbs } from '@/components/navigation';
import { getMetricCategories } from '@/app/map/config/metric-categories';
import { MetricTitle } from '@/app/components/MetricTitle';
import { useEntitlements } from '@/lib/entitlements';
import { AIMarketAnalysis } from './AIMarketAnalysis';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface MarketDashboardProps {
  geographyId: string;
  geographyType: 'metro' | 'county' | 'zip';
  userView: 'investor' | 'homebuyer';
  stateFilter?: string;
}

interface MarketData {
  geography: {
    id: string;
    name: string;
    type: string;
  };
  scores: {
    homeready: { score: number; grade: string; components?: Record<string, number> };
    investoredge: { score: number; grade: string; components?: Record<string, number> };
    markethealth: { score: number; grade: string };
  };
  metrics: {
    zhvi?: number;
    zhvi_yoy?: number;
    zori?: number;
    zori_yoy?: number;
    cap_rate?: number;
    grm?: number;
    gross_yield?: number;
    [key: string]: number | undefined;
  };
  lastUpdated: string;
}

// Trend direction helper
function getTrendDirection(percent: number | null): 'up' | 'down' | 'stable' {
  if (percent == null) return 'stable';
  if (percent > 0.5) return 'up';
  if (percent < -0.5) return 'down';
  return 'stable';
}

// Metric card with animation - uses data from useDataCardBatch
function MetricCard({
  metricId,
  formattedValue,
  trendPercent,
  trendDirection,
  delay = 0,
}: {
  metricId: string;
  formattedValue: string;
  trendPercent: number | null;
  trendDirection: 'up' | 'down' | 'stable';
  delay?: number;
}) {
  return (
    <motion.div
      className="bg-surface-container rounded-xl p-4 border border-outline-variant/30 hover:shadow-md hover:border-outline-variant/50 transition-all"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wide truncate">
          <MetricTitle metricId={metricId} />
        </span>
        {trendPercent != null && (
          <div className={`flex items-center gap-0.5 text-xs font-medium ${
            trendDirection === 'up' ? 'text-green-600' :
            trendDirection === 'down' ? 'text-red-600' :
            'text-on-surface-variant'
          }`}>
            {trendDirection === 'up' && <ArrowUpRight className="w-3.5 h-3.5" />}
            {trendDirection === 'down' && <ArrowDownRight className="w-3.5 h-3.5" />}
            {trendPercent >= 0 ? '+' : ''}{trendPercent.toFixed(1)}%
          </div>
        )}
      </div>
      <div className="text-xl font-bold text-on-surface">{formattedValue}</div>
    </motion.div>
  );
}

// Category section with metrics
function MetricCategorySection({
  categoryName,
  subtext,
  icon,
  metricIds,
  factorsData,
  delay = 0,
}: {
  categoryName: string;
  subtext?: string;
  icon: React.ReactNode;
  metricIds: string[];
  factorsData: Record<string, { formattedValue: string; percentChange: number | null; direction: 'up' | 'down' | 'stable' | null; isLoading?: boolean }>;
  delay?: number;
}) {
  return (
    <motion.div
      className="space-y-3"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <h4 className="text-sm font-semibold text-on-surface">{categoryName}</h4>
          {subtext && <p className="text-xs text-on-surface-variant">{subtext}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {metricIds.map((metricId, i) => {
          const datum = factorsData[metricId];

          return (
            <MetricCard
              key={metricId}
              metricId={metricId}
              formattedValue={datum?.isLoading ? '...' : (datum?.formattedValue ?? '--')}
              trendPercent={datum?.percentChange ?? null}
              trendDirection={datum?.direction ?? 'stable'}
              delay={delay + i * 0.03}
            />
          );
        })}
      </div>
    </motion.div>
  );
}

// Small score badge
function ScoreBadge({ label, score }: { label: string; score: number }) {
  return (
    <motion.div
      className="flex items-center gap-4 bg-surface-container rounded-xl p-4 border border-outline-variant/30"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <ScoreDisplay
        value={score}
        size={60}
        strokeWidth={5}
        showGrade={true}
        showLabel={false}
      />
      <div className="flex-1">
        <div className="text-sm font-medium text-on-surface">{label}</div>
        <div className="text-xs text-on-surface-variant">{getScoreLabel(score)}</div>
      </div>
    </motion.div>
  );
}

// Premium geography levels that require entitlements
const PREMIUM_GEO_LEVELS = ['county', 'zip', 'tract'];

export function MarketDashboard({
  geographyId,
  geographyType,
  userView,
  stateFilter,
}: MarketDashboardProps) {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'investor' | 'homebuyer'>(userView);

  // Check entitlements for geography level
  const { getAccess, trackPaywallView } = useEntitlements();
  const geoAccess = getAccess('geo', geographyType);
  const hasGeoAccess = geoAccess.level === 'full' || geoAccess.level === 'preview' || !PREMIUM_GEO_LEVELS.includes(geographyType);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const [scoresRes, metricsRes] = await Promise.all([
        fetch(`${API_URL}/api/scores/${geographyType}/${geographyId}`),
        fetch(`${API_URL}/api/metrics/investment/${geographyType}/${geographyId}`),
      ]);

      if (!scoresRes.ok) throw new Error('Failed to fetch market data');
      const scoresData = await scoresRes.json();

      let investmentMetrics: Record<string, number> = {};
      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        if (metricsData.success && metricsData.data) {
          investmentMetrics = metricsData.data;
        }
      }

      setData({
        geography: {
          id: scoresData.location_id,
          name: scoresData.location_name || `${geographyType} ${geographyId}`,
          type: scoresData.geography,
        },
        scores: {
          homeready: {
            score: Math.round(scoresData.scores.homeready.score),
            grade: scoresData.scores.homeready.grade,
            components: scoresData.scores.homeready.components,
          },
          investoredge: {
            score: Math.round(scoresData.scores.investoredge.score),
            grade: scoresData.scores.investoredge.grade,
            components: scoresData.scores.investoredge.components,
          },
          markethealth: {
            score: Math.round(scoresData.scores.markethealth.score),
            grade: scoresData.scores.markethealth.grade,
          },
        },
        metrics: {
          zhvi: scoresData.median_price,
          cap_rate: investmentMetrics.cap_rate,
          grm: investmentMetrics.grm,
          gross_yield: investmentMetrics.gross_yield,
          ...investmentMetrics,
        },
        lastUpdated: scoresData.score_date || new Date().toISOString(),
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [geographyId, geographyType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get metric categories for the current view (must be called before early returns)
  const categories = useMemo(() => {
    const viewMode = activeView === 'investor' ? 'investor' : 'homebuyer';
    return getMetricCategories(viewMode).filter(cat => !cat.isDivider && cat.id !== 'scores');
  }, [activeView]);

  // Derive state filter: use URL param if available, otherwise extract from geography name
  // Note: metros don't use state filter - they can span state boundaries and
  // a mismatched state param causes data to be excluded from Zillow responses
  const effectiveStateFilter = useMemo(() => {
    if (geographyType === 'metro') return undefined;
    if (stateFilter) {
      return stateFilter;
    }
    if (geographyType !== 'zip' && geographyType !== 'county') return undefined;
    // Extract state from location name (e.g., "21701, Frederick, MD" -> "MD")
    const name = data?.geography?.name;
    if (!name) return undefined;
    const parts = name.split(',');
    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1].trim().toUpperCase();
      if (lastPart.length === 2) return lastPart;
    }
    return undefined;
  }, [stateFilter, geographyType, data?.geography?.name]);

  // Fixed set of all metrics - MUST be stable to avoid hook order issues
  // This list never changes length - includes all metrics from both views
  // Unsupported metrics will just return null values
  const metricIds = useMemo(() => [
    // Core metrics for AI insights
    'home_value', 'home_value_yoy', 'home_value_mom', 'days_on_market', 'for_sale_inventory',
    'inventory_yoy', 'rent_index', 'cap_rate', 'price_cut_pct',
    // Homebuyer view metrics
    'listing_price', 'income_to_buy', 'affordable_home_price', 'price_per_sqft',
    'new_listings_yoy', 'hotness_score', 'pending_ratio', 'sale_to_list',
    'years_to_save', 'income_to_rent',
    'price_increase_pct', 'new_listings', 'inventory_surplus',
    'home_price_forecast', 'pending_listings', 'home_sales', 'home_sales_yoy',
    'market_heat', 'supply_score', 'demand_score',
    // Investor view metrics
    'gross_yield', 'rent_for_houses', 'grm', 'rent_to_price_ratio',
    'home_value_5yr', 'overvalued_pct',
    // Shared: Area Profile
    'population', 'population_growth', 'median_income', 'income_growth',
    'median_age', 'homeownership_rate',
    // Shared: Local Economy
    'unemployment_rate', 'job_growth', 'gdp_growth', 'cost_of_living',
    // Shared: New Construction
    'sf_permits', 'mf_permits', 'total_permits', 'permits_yoy',
    'sf_mf_ratio', 'permit_value_per_unit',
    'new_construction_sales', 'new_construction_price', 'new_construction_ppsf',
    // PropertyIQ scores
    'homeready_score', 'investoredge_score', 'market_health_score',
  ], []);

  // Fetch metric data using the data layer hook
  const { cards: factorsData } = useDataCardBatch(
    metricIds,
    geographyType as GeoLevel,
    geographyId,
    { trendMonths: 6, enabled: !loading && !!data, stateFilter: effectiveStateFilter }
  );

  // Apply metric fallbacks: home_value falls back to listing_price (Realtor) when ZHVI is unavailable
  const displayData = useMemo(() => {
    const result = { ...factorsData };
    if (!result['home_value']?.value && result['listing_price']?.value) {
      result['home_value'] = { ...result['listing_price'] };
    }
    return result;
  }, [factorsData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="w-12 h-12 border-4 border-surface-container-high border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-on-surface-variant">Loading market data...</p>
        </motion.div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 mx-auto bg-error/10 rounded-2xl flex items-center justify-center mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-xl font-semibold text-on-surface mb-2">Unable to Load Market Data</h2>
          <p className="text-on-surface-variant mb-6">{error}</p>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-full hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Check geography access after loading data
  if (!hasGeoAccess) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-on-surface mb-2">
            {geographyType.charAt(0).toUpperCase() + geographyType.slice(1)} Level Data
          </h2>
          <p className="text-on-surface-variant mb-6">
            Access detailed {geographyType}-level market data with a Pro subscription. Get granular insights to make more informed decisions.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/pricing#data-depth"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-full hover:bg-primary/90 transition-colors"
            >
              Upgrade to Pro
            </Link>
            <Link
              href="/map"
              className="text-sm text-primary hover:underline"
            >
              ← Back to Map
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const primaryScore = activeView === 'investor' ? data.scores.investoredge : data.scores.homeready;

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-sm border-b border-outline-variant">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4">
          <Breadcrumbs
            items={[
              { label: 'Markets', href: '/market' },
              { label: data.geography.name },
            ]}
            className="mb-3"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/map"
                className="p-2 -ml-2 rounded-xl hover:bg-surface-container transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-on-surface-variant" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <h1 className="text-xl font-semibold text-on-surface">{data.geography.name}</h1>
                </div>
                <p className="text-sm text-on-surface-variant">
                  {geographyType.charAt(0).toUpperCase() + geographyType.slice(1)} • Updated {new Date(data.lastUpdated).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchData}
                className="p-2.5 rounded-xl hover:bg-surface-container transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5 text-on-surface-variant" />
              </button>
              <button className="p-2.5 rounded-xl hover:bg-surface-container transition-colors" title="Share">
                <Share2 className="w-5 h-5 text-on-surface-variant" />
              </button>
              <button className="p-2.5 rounded-xl hover:bg-surface-container transition-colors" title="Download">
                <Download className="w-5 h-5 text-on-surface-variant" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8">
        {/* View Toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center bg-surface-container rounded-full p-1 border border-outline-variant/50">
            <button
              onClick={() => setActiveView('homebuyer')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                activeView === 'homebuyer'
                  ? 'bg-primary text-on-primary shadow-md'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <Home className="w-4 h-4" />
              Homebuyer
            </button>
            <button
              onClick={() => setActiveView('investor')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                activeView === 'investor'
                  ? 'bg-tertiary text-on-tertiary shadow-md'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Investor
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column - Score */}
          <div className="lg:col-span-4 space-y-6">
            {/* Main Score Card */}
            <motion.div
              className="bg-surface-container rounded-3xl p-8 border border-outline-variant/30 text-center"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <motion.div
                key={activeView}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="flex justify-center mb-4"
              >
                <ScoreDisplay
                  value={primaryScore.score}
                  size={160}
                  strokeWidth={10}
                  showGrade={true}
                  showLabel={true}
                />
              </motion.div>

              <p className="text-on-surface-variant">
                {activeView === 'investor' ? 'InvestorEdge' : 'HomeReady'} Score
              </p>
            </motion.div>

            {/* Market Health Badge */}
            <ScoreBadge
              label="Market Health"
              score={data.scores.markethealth.score}
            />
          </div>

          {/* Right Column - Details */}
          <div className="lg:col-span-8 space-y-6">
            {/* Market Metrics by Category */}
            <div>
              <h3 className="text-sm font-medium text-on-surface-variant mb-4 uppercase tracking-wide">
                Market Metrics
              </h3>
              <div className="space-y-6">
                {categories.map((category, catIndex) => {
                  const supportedMetrics = category.metrics?.filter(m => isMetricSupportedForGeo(m.id, geographyType as GeoLevel)).map(m => m.id) ?? [];
                  if (supportedMetrics.length === 0) return null;

                  // Add divider between view-specific (first 3) and shared categories
                  const showDivider = catIndex === 3;

                  return (
                    <React.Fragment key={category.id}>
                      {showDivider && (
                        <hr className="border-outline-variant/40 my-2" />
                      )}
                      <MetricCategorySection
                        categoryName={category.name}
                        subtext={category.subtext}
                        icon={category.icon}
                        metricIds={supportedMetrics}
                        factorsData={displayData}
                        delay={catIndex * 0.1}
                      />
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* AI Market Analysis / Market Overview (handles entitlement internally) */}
            <AIMarketAnalysis
              geoType={geographyType}
              geoId={geographyId}
              marketName={data.geography.name}
              view={activeView}
              metrics={Object.fromEntries(
                Object.entries(displayData).map(([key, card]) => [
                  key,
                  {
                    value: card.value,
                    formattedValue: card.formattedValue,
                    percentChange: card.percentChange,
                  }
                ])
              )}
              scores={data.scores}
              lastUpdated={data.lastUpdated}
            />

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href={`/reports?geography=${geographyId}&type=${geographyType}`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary font-medium rounded-full hover:bg-primary/90 transition-colors shadow-md"
              >
                Generate Full Report
              </Link>
              <Link
                href={`/graphs?geo=${geographyId}&level=${geographyType}&name=${encodeURIComponent(data.geography.name)}&metric=listing_price`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-surface-container text-on-surface font-medium rounded-full hover:bg-surface-container-high transition-colors border border-outline-variant"
              >
                <TrendingUp className="w-4 h-4" />
                View Trends
              </Link>
              <Link
                href={`/map?focus=${geographyId}`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-surface-container text-on-surface font-medium rounded-full hover:bg-surface-container-high transition-colors border border-outline-variant"
              >
                <MapPin className="w-4 h-4" />
                Explore Map
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Bottom Toggle */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 md:hidden z-20">
        <div className="flex items-center bg-surface-container-high rounded-full p-1 shadow-xl border border-outline-variant">
          <button
            onClick={() => setActiveView('homebuyer')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeView === 'homebuyer'
                ? 'bg-primary text-on-primary'
                : 'text-on-surface-variant'
            }`}
          >
            Buyer
          </button>
          <button
            onClick={() => setActiveView('investor')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeView === 'investor'
                ? 'bg-tertiary text-on-tertiary'
                : 'text-on-surface-variant'
            }`}
          >
            Investor
          </button>
        </div>
      </div>
    </div>
  );
}
