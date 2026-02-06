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
  Sparkles,
  MapPin,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import Link from 'next/link';
import { ScoreDisplay, getScoreLabel } from '@/app/components/scoring/ScoreDisplay';
import { useDataCardBatch, type GeoLevel } from '@/lib/data';
import { getMetricCategories } from '@/app/map/config/metric-categories';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface MarketDashboardProps {
  geographyId: string;
  geographyType: 'metro' | 'county' | 'zip';
  userView: 'investor' | 'homebuyer';
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
  label,
  formattedValue,
  trendPercent,
  trendDirection,
  delay = 0,
}: {
  label: string;
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
          {label}
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
  factorsLoading,
  delay = 0,
}: {
  categoryName: string;
  subtext?: string;
  icon: React.ReactNode;
  metricIds: string[];
  factorsData: Record<string, { formattedValue: string; percentChange: number | null; direction: 'up' | 'down' | 'stable' | null }>;
  factorsLoading: boolean;
  delay?: number;
}) {
  // Get metric names from config
  const { getMetricConfig } = require('@/lib/data');

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
      <div className="grid grid-cols-2 gap-2">
        {metricIds.slice(0, 4).map((metricId, i) => {
          const config = getMetricConfig(metricId);
          const datum = factorsData[metricId];

          return (
            <MetricCard
              key={metricId}
              label={config?.title || metricId.replace(/_/g, ' ')}
              formattedValue={factorsLoading ? '...' : (datum?.formattedValue ?? '--')}
              trendPercent={datum?.percentChange ?? null}
              trendDirection={datum?.direction ?? 'stable'}
              delay={delay + i * 0.05}
            />
          );
        })}
      </div>
    </motion.div>
  );
}

// AI Insight card
function AIInsightCard({ marketName, score, view }: { marketName: string; score: number; view: string }) {
  const getInsight = () => {
    const persona = view === 'investor' ? 'investment' : 'home buying';
    if (score >= 70) {
      return `${marketName} shows strong ${persona} potential. Market fundamentals are solid with favorable conditions for entry.`;
    } else if (score >= 40) {
      return `${marketName} presents moderate opportunities. Careful analysis of specific neighborhoods recommended before committing.`;
    } else {
      return `${marketName} currently faces headwinds for ${persona}. Consider nearby markets or wait for better timing.`;
    }
  };

  return (
    <motion.div
      className="bg-gradient-to-br from-primary/5 via-surface-container to-tertiary/5 rounded-2xl p-6 border border-primary/20"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.6, duration: 0.5 }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 rounded-xl bg-primary/15">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-on-surface">AI Market Analysis</h3>
          <p className="text-xs text-on-surface-variant">Powered by PropertyIQ</p>
        </div>
      </div>
      <p className="text-on-surface-variant leading-relaxed">{getInsight()}</p>
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

export function MarketDashboard({
  geographyId,
  geographyType,
  userView,
}: MarketDashboardProps) {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'investor' | 'homebuyer'>(userView);

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

  // Extract all metric IDs to fetch
  const metricIds = useMemo(() => {
    const ids = new Set<string>();
    categories.forEach(cat => {
      cat.metrics?.slice(0, 4).forEach(m => ids.add(m.id));
    });
    return Array.from(ids);
  }, [categories]);

  // Fetch metric data using the data layer hook
  const { cards: factorsData, isLoading: factorsLoading } = useDataCardBatch(
    metricIds,
    geographyType as GeoLevel,
    geographyId,
    { trendMonths: 6, enabled: !loading && !!data }
  );

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

  const primaryScore = activeView === 'investor' ? data.scores.investoredge : data.scores.homeready;

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-sm border-b border-outline-variant">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4">
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
                {categories.slice(0, 3).map((category, catIndex) => (
                  <MetricCategorySection
                    key={category.id}
                    categoryName={category.name}
                    subtext={category.subtext}
                    icon={category.icon}
                    metricIds={category.metrics?.map(m => m.id) ?? []}
                    factorsData={factorsData}
                    factorsLoading={factorsLoading}
                    delay={catIndex * 0.15}
                  />
                ))}
              </div>
            </div>

            {/* AI Insight */}
            <AIInsightCard
              marketName={data.geography.name}
              score={primaryScore.score}
              view={activeView}
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
                href={`/graphs?geo=${geographyId}&level=${geographyType}`}
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
