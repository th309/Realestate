'use client';

import React, { useState, useMemo } from 'react';
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
import { useMarketSnapshot, type GeoLevel, isMetricSupportedForGeo } from '@/lib/data';
import { Breadcrumbs } from '@/components/navigation';
import { getMetricCategories } from '@/app/map/config/metric-categories';
import { MetricTitle } from '@/app/components/MetricTitle';
import { useEntitlements } from '@/lib/entitlements';
import { AIMarketAnalysis } from './AIMarketAnalysis';
import { useQueryClient } from '@tanstack/react-query';
import { BenchmarkBadge } from '@/components/benchmarks';
import { useBenchmarks, getBenchmarkForMetric } from '@/lib/benchmarks/hooks';

interface MarketDashboardProps {
  geographyId: string;
  geographyType: 'metro' | 'county' | 'zip';
  userView: 'investor' | 'homebuyer';
  stateFilter?: string;
}

// Trend direction helper
function getTrendDirection(percent: number | null): 'up' | 'down' | 'stable' {
  if (percent == null) return 'stable';
  if (percent > 0.5) return 'up';
  if (percent < -0.5) return 'down';
  return 'stable';
}

// Metric card with animation - uses data from useMarketSnapshot
function MetricCard({
  metricId,
  formattedValue,
  trendPercent,
  trendDirection,
  benchmark,
  delay = 0,
}: {
  metricId: string;
  formattedValue: string;
  trendPercent: number | null;
  trendDirection: 'up' | 'down' | 'stable';
  benchmark?: { diff: number; direction: 'better' | 'worse' | 'similar'; parentGeoName: string } | null;
  delay?: number;
}) {
  return (
    <motion.div
      className="bg-surface-container rounded-xl p-4 border border-outline-variant/30 hover:shadow-md hover:border-outline-variant/50 transition-all"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-xs font-medium text-on-surface-variant uppercase tracking-wide min-w-0">
          <MetricTitle metricId={metricId} />
        </div>
        {trendPercent != null && (
          <div className={`flex items-center gap-0.5 text-xs font-medium shrink-0 ${
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
      {benchmark && (
        <div className="mt-2">
          <BenchmarkBadge
            diff={benchmark.diff}
            direction={benchmark.direction}
            parentGeoName={benchmark.parentGeoName}
          />
        </div>
      )}
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
  benchmarks = [],
  hasBenchmarkAccess = false,
  delay = 0,
}: {
  categoryName: string;
  subtext?: string;
  icon: React.ReactNode;
  metricIds: string[];
  factorsData: Record<string, { formattedValue: string; percentChange: number | null; direction: 'up' | 'down' | 'stable' | null; isLoading?: boolean }>;
  benchmarks?: import('@/lib/benchmarks/api').BenchmarkResult[];
  hasBenchmarkAccess?: boolean;
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
          const benchmarkData = hasBenchmarkAccess ? getBenchmarkForMetric(benchmarks, metricId) : null;
          const benchmarkProp = benchmarkData?.diff != null && benchmarkData?.direction && benchmarkData?.parentGeo
            ? { diff: benchmarkData.diff, direction: benchmarkData.direction, parentGeoName: benchmarkData.parentGeo.name }
            : null;

          return (
            <MetricCard
              key={metricId}
              metricId={metricId}
              formattedValue={datum?.isLoading ? '...' : (datum?.formattedValue ?? '--')}
              trendPercent={datum?.percentChange ?? null}
              trendDirection={datum?.direction ?? 'stable'}
              benchmark={benchmarkProp}
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
  const [activeView, setActiveView] = useState<'investor' | 'homebuyer'>(userView);
  const queryClient = useQueryClient();

  // Check entitlements for geography level
  const { getAccess, trackPaywallView } = useEntitlements();
  const geoAccess = getAccess('geo', geographyType);
  const hasGeoAccess = geoAccess.level === 'full' || geoAccess.level === 'preview' || !PREMIUM_GEO_LEVELS.includes(geographyType);

  // Derive state filter: use URL param if available
  // Note: metros don't use state filter - they can span state boundaries
  const effectiveStateFilter = useMemo(() => {
    if (geographyType === 'metro') return undefined;
    if (stateFilter) return stateFilter;
    if (geographyType !== 'zip' && geographyType !== 'county') return undefined;
    return undefined;
  }, [stateFilter, geographyType]);

  // Single hook replaces fetchData() + useDataCardBatch() — 2 HTTP calls instead of 116
  const { cards, scores, geography, lastUpdated, isLoading, error } = useMarketSnapshot(
    geographyType,
    geographyId,
    { state: effectiveStateFilter, trendMonths: 6 },
  );

  // Get metric categories for the current view (must be called before early returns)
  const categories = useMemo(() => {
    const viewMode = activeView === 'investor' ? 'investor' : 'homebuyer';
    return getMetricCategories(viewMode).filter(cat => !cat.isDivider && cat.id !== 'scores');
  }, [activeView]);

  // Collect all displayed metric IDs for benchmarking
  const allMetricIds = useMemo(() => {
    return categories.flatMap(cat =>
      (cat.metrics || [])
        .filter(m => isMetricSupportedForGeo(m.id, geographyType as GeoLevel))
        .map(m => m.id)
    );
  }, [categories, geographyType]);

  const { benchmarks, hasAccess: hasBenchmarkAccess } = useBenchmarks(
    geographyType,
    geographyId,
    allMetricIds,
  );

  // Apply metric fallbacks: home_value falls back to listing_price when ZHVI is unavailable
  const displayData = useMemo(() => {
    const result = { ...cards };
    if (!result['home_value']?.value && result['listing_price']?.value) {
      result['home_value'] = { ...result['listing_price'] };
    }
    return result;
  }, [cards]);

  // Refresh handler
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['market-snapshot', geographyType, geographyId] });
    queryClient.invalidateQueries({ queryKey: ['market-snapshot-trends', geographyType, geographyId] });
  };

  if (isLoading) {
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

  if (error || !geography) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 mx-auto bg-error/10 rounded-2xl flex items-center justify-center mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-xl font-semibold text-on-surface mb-2">Unable to Load Market Data</h2>
          <p className="text-on-surface-variant mb-6">{error?.message ?? 'Unknown error'}</p>
          <button
            onClick={handleRefresh}
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
      <div data-testid="geo-gate-wall" className="min-h-screen bg-surface flex items-center justify-center">
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

  const primaryScore = activeView === 'investor'
    ? scores?.investoredge
    : scores?.homeready;

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-sm border-b border-outline-variant">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4">
          <Breadcrumbs
            items={[
              { label: 'Markets', href: '/market' },
              { label: geography.name },
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
                  <h1 className="text-xl font-semibold text-on-surface">{geography.name}</h1>
                </div>
                <p className="text-sm text-on-surface-variant">
                  {geographyType.charAt(0).toUpperCase() + geographyType.slice(1)} • Updated {new Date(lastUpdated ?? Date.now()).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
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
                  value={primaryScore?.score ?? 0}
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
            {scores?.markethealth && (
              <ScoreBadge
                label="Market Health"
                score={scores.markethealth.score}
              />
            )}
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
                  // Only show metrics that have actual data (data layer filters nulls)
                  const metricsWithData = supportedMetrics.filter(id => displayData[id] !== undefined);
                  if (metricsWithData.length === 0) return null;

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
                        metricIds={metricsWithData}
                        factorsData={displayData}
                        benchmarks={benchmarks}
                        hasBenchmarkAccess={hasBenchmarkAccess}
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
              marketName={geography.name}
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
              scores={scores ? {
                homeready: scores.homeready ?? { score: 0, grade: 'N/A' },
                investoredge: scores.investoredge ?? { score: 0, grade: 'N/A' },
                markethealth: scores.markethealth ?? { score: 0, grade: 'N/A' },
              } : { homeready: { score: 0, grade: 'N/A' }, investoredge: { score: 0, grade: 'N/A' }, markethealth: { score: 0, grade: 'N/A' } }}
              lastUpdated={lastUpdated ?? new Date().toISOString()}
            />

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href={`/reports?rtype=${userView}&mid=${geographyId}&mname=${encodeURIComponent(geography.name)}&mtype=${geographyType}${stateFilter ? `&mstate=${stateFilter}` : ''}`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary font-medium rounded-full hover:bg-primary/90 transition-colors shadow-md"
              >
                Generate Full Report
              </Link>
              <Link
                href={`/graphs?mid=${geographyId}&mname=${encodeURIComponent(geography.name)}&mtype=${geographyType}${stateFilter ? `&mstate=${stateFilter}` : ''}`}
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
