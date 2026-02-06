'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Home,
  DollarSign,
  Clock,
  BarChart3,
  Share2,
  Download,
  RefreshCw,
  ChevronRight,
  Sparkles,
  MapPin,
  Users,
  Building2,
  Wallet,
  Shield,
  Activity,
  ExternalLink,
  MessageSquare,
  X,
} from 'lucide-react';
import Link from 'next/link';

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
    state?: string;
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
    median_listing_price?: number;
    days_on_market?: number;
    active_listing_count?: number;
    inventory_yoy?: number;
    cap_rate?: number;
    grm?: number;
    hotness_score?: number;
    population?: number;
    median_income?: number;
  };
  lastUpdated: string;
}

// Animated number component
function AnimatedValue({
  value,
  format = 'number',
  prefix = '',
  suffix = '',
  className = ''
}: {
  value: number | undefined;
  format?: 'currency' | 'percent' | 'number' | 'compact';
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (value === undefined) return;

    const duration = 1000;
    const steps = 30;
    const increment = value / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(current);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  const formatValue = (v: number) => {
    switch (format) {
      case 'currency':
        return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
      case 'percent':
        return `${v.toFixed(1)}%`;
      case 'compact':
        if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
        if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
        return v.toFixed(0);
      default:
        return v.toLocaleString(undefined, { maximumFractionDigits: 1 });
    }
  };

  if (value === undefined) return <span className={className}>—</span>;

  return (
    <span className={className}>
      {prefix}{formatValue(displayValue)}{suffix}
    </span>
  );
}

// Score ring component with animation
function ScoreRing({
  score,
  size = 120,
  label,
  sublabel,
  color = 'primary'
}: {
  score: number;
  size?: number;
  label: string;
  sublabel?: string;
  color?: 'primary' | 'tertiary' | 'secondary';
}) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;

  const colorClasses = {
    primary: 'stroke-primary',
    tertiary: 'stroke-tertiary',
    secondary: 'stroke-secondary',
  };

  const bgColorClasses = {
    primary: 'text-primary',
    tertiary: 'text-tertiary',
    secondary: 'text-secondary',
  };

  return (
    <div className="relative flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-surface-container-highest"
        />
        {/* Animated score circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={colorClasses[color]}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          style={{
            strokeDasharray: circumference,
          }}
        />
      </svg>
      {/* Score value in center */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className={`text-3xl font-bold ${bgColorClasses[color]}`}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          {score}
        </motion.span>
        <span className="text-xs text-on-surface-variant mt-1">/100</span>
      </div>
      {/* Labels below */}
      <div className="mt-3 text-center">
        <p className="text-sm font-medium text-on-surface">{label}</p>
        {sublabel && <p className="text-xs text-on-surface-variant">{sublabel}</p>}
      </div>
    </div>
  );
}

// Metric card with trend indicator
function MetricCard({
  label,
  value,
  change,
  format = 'number',
  icon: Icon,
  delay = 0,
}: {
  label: string;
  value: number | undefined;
  change?: number;
  format?: 'currency' | 'percent' | 'number' | 'compact';
  icon: React.ElementType;
  delay?: number;
}) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;

  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl bg-surface-container p-4 group hover:bg-surface-container-high transition-colors"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
    >
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <Icon className="w-4 h-4 text-on-surface-variant" />
          {change !== undefined && (
            <div className={`flex items-center gap-0.5 text-xs font-medium ${
              isPositive ? 'text-green-500' : isNegative ? 'text-red-500' : 'text-on-surface-variant'
            }`}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : isNegative ? <TrendingDown className="w-3 h-3" /> : null}
              {change > 0 ? '+' : ''}{change.toFixed(1)}%
            </div>
          )}
        </div>
        <AnimatedValue
          value={value}
          format={format}
          className="text-2xl font-semibold text-on-surface block"
        />
        <p className="text-xs text-on-surface-variant mt-1">{label}</p>
      </div>
    </motion.div>
  );
}

// Market pulse animation - the "heartbeat" of the market
function MarketPulse({ health }: { health: number }) {
  const pulseColor = health >= 70 ? 'bg-green-500' : health >= 40 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div className={`w-3 h-3 rounded-full ${pulseColor}`} />
        <motion.div
          className={`absolute inset-0 rounded-full ${pulseColor}`}
          animate={{ scale: [1, 1.8, 1], opacity: [0.8, 0, 0.8] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <span className="text-sm text-on-surface-variant">Live</span>
    </div>
  );
}

// AI Insight card with typing animation
function AIInsightCard({
  insight,
  isLoading
}: {
  insight?: string;
  isLoading: boolean;
}) {
  return (
    <motion.div
      className="rounded-2xl bg-gradient-to-br from-primary/10 via-surface-container to-tertiary/10 p-6 border border-outline-variant/50"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.8 }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-xl bg-primary/20">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <h3 className="font-semibold text-on-surface">AI Market Analysis</h3>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-4 bg-surface-container-high rounded animate-pulse w-full" />
          <div className="h-4 bg-surface-container-high rounded animate-pulse w-5/6" />
          <div className="h-4 bg-surface-container-high rounded animate-pulse w-4/6" />
        </div>
      ) : insight ? (
        <p className="text-on-surface-variant leading-relaxed">{insight}</p>
      ) : (
        <p className="text-on-surface-variant italic">Analysis not available</p>
      )}

      <button className="mt-4 text-sm text-primary hover:underline flex items-center gap-1">
        Ask a question <MessageSquare className="w-3 h-3" />
      </button>
    </motion.div>
  );
}

// Score component breakdown
function ScoreBreakdown({
  components,
  type,
}: {
  components?: Record<string, number>;
  type: 'investor' | 'homebuyer';
}) {
  const labels = type === 'investor'
    ? { cash_flow: 'Cash Flow', appreciation: 'Appreciation', risk: 'Risk', liquidity: 'Liquidity' }
    : { affordability: 'Affordability', stability: 'Stability', value: 'Value', competition: 'Competition' };

  const icons = type === 'investor'
    ? { cash_flow: Wallet, appreciation: TrendingUp, risk: Shield, liquidity: Activity }
    : { affordability: DollarSign, stability: Shield, value: Home, competition: Users };

  if (!components) return null;

  return (
    <div className="grid grid-cols-2 gap-3 mt-4">
      {Object.entries(labels).map(([key, label], index) => {
        const value = components[key];
        const Icon = icons[key as keyof typeof icons];
        if (value === undefined) return null;

        return (
          <motion.div
            key={key}
            className="flex items-center gap-2 p-3 rounded-xl bg-surface-container"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + index * 0.1 }}
          >
            <Icon className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs text-on-surface-variant truncate">{label}</span>
                <span className="text-sm font-medium text-on-surface">{value}</span>
              </div>
              <div className="h-1.5 bg-surface-container-highest rounded-full mt-1 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${
                    value >= 70 ? 'bg-green-500' : value >= 40 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${value}%` }}
                  transition={{ delay: 0.5 + index * 0.1, duration: 0.8 }}
                />
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
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
  const [aiInsight, setAiInsight] = useState<string | undefined>();
  const [aiLoading, setAiLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Fetch market data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch scores and investment metrics in parallel
      const [scoresRes, metricsRes] = await Promise.all([
        fetch(`${API_URL}/api/scores/${geographyType}/${geographyId}`),
        fetch(`${API_URL}/api/metrics/investment/${geographyType}/${geographyId}`),
      ]);

      if (!scoresRes.ok) throw new Error('Failed to fetch scores');
      const scoresData = await scoresRes.json();

      // Get investment metrics (optional - may not exist for all geographies)
      let investmentMetrics: Record<string, number> = {};
      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        if (metricsData.success && metricsData.data) {
          investmentMetrics = metricsData.data;
        }
      }

      // Construct market data from response
      // The scoring API returns location_name, location_id, geography, median_price, scores
      const marketData: MarketData = {
        geography: {
          id: scoresData.location_id,
          name: scoresData.location_name || `${geographyType} ${geographyId}`,
          type: scoresData.geography,
        },
        scores: {
          homeready: {
            score: scoresData.scores.homeready.score,
            grade: scoresData.scores.homeready.grade,
            components: scoresData.scores.homeready.components,
          },
          investoredge: {
            score: scoresData.scores.investoredge.score,
            grade: scoresData.scores.investoredge.grade,
            components: scoresData.scores.investoredge.components,
          },
          markethealth: {
            score: scoresData.scores.markethealth.score,
            grade: scoresData.scores.markethealth.grade,
          },
        },
        metrics: {
          zhvi: scoresData.median_price,
          cap_rate: investmentMetrics.cap_rate,
          grm: investmentMetrics.grm,
          // Additional metrics from investment data
          ...investmentMetrics,
        },
        lastUpdated: scoresData.score_date || new Date().toISOString(),
      };

      setData(marketData);
      setLastRefresh(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load market data');
    } finally {
      setLoading(false);
    }
  }, [geographyId, geographyType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Generate AI insight on demand
  const generateInsight = async () => {
    if (!data) return;

    setAiLoading(true);
    try {
      // This would call your Claude/AI endpoint
      // For now, simulate with a delay
      await new Promise(r => setTimeout(r, 2000));

      const score = activeView === 'investor'
        ? data.scores.investoredge.score
        : data.scores.homeready.score;

      // Simulated insight based on score
      const insights = {
        high: `${data.geography.name} shows strong ${activeView === 'investor' ? 'investment' : 'buying'} potential with a score of ${score}/100. The market fundamentals are solid with ${data.metrics.zhvi_yoy && data.metrics.zhvi_yoy > 0 ? 'positive' : 'stable'} price trends and healthy inventory levels.`,
        medium: `${data.geography.name} presents moderate opportunities for ${activeView === 'investor' ? 'investors' : 'homebuyers'}. With a score of ${score}/100, careful analysis of specific neighborhoods and property types is recommended.`,
        low: `${data.geography.name} currently shows challenging conditions for ${activeView === 'investor' ? 'investment' : 'home purchases'}. Consider exploring nearby markets or waiting for better entry points.`,
      };

      setAiInsight(score >= 70 ? insights.high : score >= 40 ? insights.medium : insights.low);
    } catch {
      setAiInsight('Unable to generate analysis at this time.');
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (data && !aiInsight) {
      generateInsight();
    }
  }, [data, activeView]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-surface-container-high" />
            <motion.div
              className="absolute inset-0 w-16 h-16 rounded-full border-4 border-primary border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          </div>
          <p className="text-on-surface-variant">Loading market data...</p>
        </motion.div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 mx-auto bg-error/10 rounded-full flex items-center justify-center mb-4">
            <X className="w-8 h-8 text-error" />
          </div>
          <h2 className="text-xl font-semibold text-on-surface mb-2">
            Unable to Load Market Data
          </h2>
          <p className="text-on-surface-variant mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-full hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const primaryScore = activeView === 'investor'
    ? data.scores.investoredge
    : data.scores.homeready;
  const primaryScoreComponents = activeView === 'investor'
    ? data.scores.investoredge.components
    : data.scores.homeready.components;

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-lg border-b border-outline-variant">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Back & Location */}
            <div className="flex items-center gap-4">
              <Link
                href="/map"
                className="p-2 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <h1 className="text-lg font-semibold text-on-surface">
                    {data.geography.name}
                  </h1>
                </div>
                <p className="text-xs text-on-surface-variant">
                  {geographyType.charAt(0).toUpperCase() + geographyType.slice(1)} • Updated {lastRefresh.toLocaleTimeString()}
                </p>
              </div>
            </div>

            {/* Center: View Toggle */}
            <div className="hidden md:flex items-center bg-surface-container rounded-full p-1">
              <button
                onClick={() => setActiveView('homebuyer')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  activeView === 'homebuyer'
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <Home className="w-4 h-4 inline-block mr-1.5" />
                Homebuyer
              </button>
              <button
                onClick={() => setActiveView('investor')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  activeView === 'investor'
                    ? 'bg-tertiary text-on-tertiary'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <TrendingUp className="w-4 h-4 inline-block mr-1.5" />
                Investor
              </button>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              <MarketPulse health={data.scores.markethealth.score} />
              <button
                onClick={fetchData}
                className="p-2 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant"
                title="Refresh data"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                className="p-2 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant"
                title="Share"
              >
                <Share2 className="w-5 h-5" />
              </button>
              <button
                className="p-2 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant"
                title="Download"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Score & Breakdown */}
          <div className="lg:col-span-1 space-y-6">
            {/* Primary Score Card */}
            <motion.div
              className="rounded-3xl bg-surface-container p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex justify-center mb-4">
                <ScoreRing
                  score={primaryScore.score}
                  size={140}
                  label={activeView === 'investor' ? 'InvestorEdge' : 'HomeReady'}
                  sublabel={`Grade: ${primaryScore.grade}`}
                  color={activeView === 'investor' ? 'tertiary' : 'primary'}
                />
              </div>
              <ScoreBreakdown components={primaryScoreComponents} type={activeView} />
            </motion.div>

            {/* Secondary Score */}
            <motion.div
              className="rounded-2xl bg-surface-container p-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-secondary/10">
                    <Activity className="w-4 h-4 text-secondary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-on-surface">Market Health</p>
                    <p className="text-xs text-on-surface-variant">Overall conditions</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-on-surface">{data.scores.markethealth.score}</p>
                  <p className="text-xs text-on-surface-variant">{data.scores.markethealth.grade}</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Metrics & Insights */}
          <div className="lg:col-span-2 space-y-6">
            {/* Key Metrics Grid */}
            <div>
              <h2 className="text-sm font-medium text-on-surface-variant mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Key Metrics
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard
                  label="Home Value"
                  value={data.metrics.zhvi}
                  change={data.metrics.zhvi_yoy}
                  format="currency"
                  icon={Home}
                  delay={0.1}
                />
                <MetricCard
                  label="Monthly Rent"
                  value={data.metrics.zori}
                  change={data.metrics.zori_yoy}
                  format="currency"
                  icon={Building2}
                  delay={0.2}
                />
                <MetricCard
                  label="Days on Market"
                  value={data.metrics.days_on_market}
                  icon={Clock}
                  delay={0.3}
                />
                <MetricCard
                  label="Active Listings"
                  value={data.metrics.active_listing_count}
                  change={data.metrics.inventory_yoy}
                  format="compact"
                  icon={BarChart3}
                  delay={0.4}
                />
              </div>
            </div>

            {/* Investment Metrics (show for investors) */}
            {activeView === 'investor' && (
              <div>
                <h2 className="text-sm font-medium text-on-surface-variant mb-3 flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  Investment Metrics
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <MetricCard
                    label="Cap Rate"
                    value={data.metrics.cap_rate}
                    format="percent"
                    icon={TrendingUp}
                    delay={0.5}
                  />
                  <MetricCard
                    label="Gross Rent Multiplier"
                    value={data.metrics.grm}
                    icon={DollarSign}
                    delay={0.6}
                  />
                  <MetricCard
                    label="Market Heat"
                    value={data.metrics.hotness_score}
                    icon={Activity}
                    delay={0.7}
                  />
                </div>
              </div>
            )}

            {/* Demographics */}
            <div>
              <h2 className="text-sm font-medium text-on-surface-variant mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Demographics
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  label="Population"
                  value={data.metrics.population}
                  format="compact"
                  icon={Users}
                  delay={0.8}
                />
                <MetricCard
                  label="Median Income"
                  value={data.metrics.median_income}
                  format="currency"
                  icon={DollarSign}
                  delay={0.9}
                />
              </div>
            </div>

            {/* AI Insight */}
            <AIInsightCard insight={aiInsight} isLoading={aiLoading} />

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/reports?geography=${geographyId}&type=${geographyType}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Generate Full Report
                <ExternalLink className="w-4 h-4" />
              </Link>
              <Link
                href={`/graphs?geo=${geographyId}&level=${geographyType}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-surface-container text-on-surface rounded-full text-sm font-medium hover:bg-surface-container-high transition-colors"
              >
                View Trends
                <TrendingUp className="w-4 h-4" />
              </Link>
              <Link
                href={`/map?focus=${geographyId}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-surface-container text-on-surface rounded-full text-sm font-medium hover:bg-surface-container-high transition-colors"
              >
                Explore Map
                <MapPin className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile View Toggle */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 md:hidden">
        <div className="flex items-center bg-surface-container-high rounded-full p-1 shadow-lg border border-outline-variant">
          <button
            onClick={() => setActiveView('homebuyer')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeView === 'homebuyer'
                ? 'bg-primary text-on-primary'
                : 'text-on-surface-variant'
            }`}
          >
            Homebuyer
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
