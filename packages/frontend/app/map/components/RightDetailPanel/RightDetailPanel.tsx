/**
 * RightDetailPanel Component
 *
 * Analysis view panel that slides in from the right when a region is clicked.
 * Layout based on design mockup:
 * - Large score gauge with confidence badge and trend
 * - Contextual data cards (Pricing, Inventory, Insight)
 * - Market Factors grid (2x2)
 *
 * Material Design 3 compliant.
 */

'use client';

import { useEffect, useCallback, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, X, Settings, Check } from 'lucide-react';
import type { ViewMode, SelectedGeography, GeoLevel } from '../../types';
import { api } from '@/lib/api/client';
import { getMetricConfig } from '../../config/metrics';
import { getMetricCategories } from '../../config/metric-categories';
import { formatValue, getMetricFormat } from '../../utils/metricUtils';

interface RightDetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  viewMode: ViewMode;
  geography: SelectedGeography | null;
  geoLevel: GeoLevel;
  isAdmin?: boolean;
}

// Score color gradient (red to green)
function getScoreColor(value: number): string {
  const percentage = Math.min(Math.max(value / 100, 0), 1);
  const hue = percentage * 120;
  return `hsl(${hue}, 70%, 45%)`;
}

// Letter grade from score
function getLetterGrade(score: number): string {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 70) return 'C-';
  if (score >= 67) return 'D+';
  if (score >= 63) return 'D';
  if (score >= 60) return 'D-';
  return 'F';
}

// Default market factors with their metric mappings
const DEFAULT_MARKET_FACTORS = [
  { id: 'appreciation', label: 'Appreciation', metricId: 'home_value_yoy' },
  { id: 'yield', label: 'Yield Potential', metricId: 'cap_rate' },
  { id: 'risk', label: 'Risk Level', metricId: 'price_volatility' },
  { id: 'demand', label: 'Demand', metricId: 'pending_ratio' },
];

const STORAGE_KEY = 'rightpanel-market-factors';

function loadMarketFactors(): typeof DEFAULT_MARKET_FACTORS {
  if (typeof window === 'undefined') return DEFAULT_MARKET_FACTORS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to load market factors:', e);
  }
  return DEFAULT_MARKET_FACTORS;
}

function saveMarketFactors(factors: typeof DEFAULT_MARKET_FACTORS) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(factors));
  } catch (e) {
    console.error('Failed to save market factors:', e);
  }
}

// Get available metrics for selection
function getAvailableMetrics(viewMode: ViewMode) {
  const categories = getMetricCategories(viewMode);
  const metrics: { id: string; name: string; category: string }[] = [];
  const seen = new Set<string>();

  for (const cat of categories) {
    if (cat.isDivider || !cat.metrics) continue;
    for (const m of cat.metrics) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        metrics.push({ id: m.id, name: m.name, category: cat.name });
      }
    }
  }
  return metrics.sort((a, b) => a.name.localeCompare(b.name));
}

export function RightDetailPanel({
  isOpen,
  onClose,
  viewMode,
  geography,
  geoLevel,
  isAdmin = false,
}: RightDetailPanelProps) {
  const [scores, setScores] = useState<{
    main: number | null;
    marketHealth: number | null;
    confidence: string;
  }>({ main: null, marketHealth: null, confidence: 'B' });
  const [loading, setLoading] = useState(false);
  const [metricData, setMetricData] = useState<Record<string, { value: number | null; trend: number | null }>>({});
  const [marketFactors, setMarketFactors] = useState(loadMarketFactors);
  const [editingFactor, setEditingFactor] = useState<string | null>(null);

  const scoreName = viewMode === 'homebuyer' ? 'HomeReady Score' : 'InvestorEdge Score';

  // Escape key handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) onClose();
  }, [isOpen, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Fetch scores and metrics
  useEffect(() => {
    if (!geography || !isOpen) return;
    let isMounted = true;

    async function fetchData() {
      setLoading(true);
      try {
        // Fetch scores
        const scoreRes = await api.getScore(geoLevel, geography.id);
        if (isMounted) {
          const mainScore = viewMode === 'homebuyer' ? scoreRes.homereadyScore : scoreRes.investoredgeScore;
          setScores({
            main: mainScore ?? null,
            marketHealth: scoreRes.components?.homeready?.marketHealth ?? null,
            confidence: getLetterGrade(mainScore ?? 0),
          });
        }

        // Fetch metric data for market factors and contextual cards
        const metricIds = [
          ...marketFactors.map(f => f.metricId),
          'median_sale_price', 'months_supply', 'hotness_score'
        ];
        const uniqueIds = [...new Set(metricIds)];

        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 4);
        const startDateStr = startDate.toISOString().split('T')[0];

        const results: Record<string, { value: number | null; trend: number | null }> = {};

        await Promise.all(uniqueIds.map(async (metricId) => {
          try {
            const res = await api.getTimeSeries(metricId, geoLevel, geography.id, startDateStr, endDate);
            if (res.success && res.data.length > 0) {
              const sorted = [...res.data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
              const current = sorted[0].value;
              const previous = sorted.length > 1 ? sorted[Math.min(3, sorted.length - 1)].value : null;
              const trend = previous ? ((current - previous) / Math.abs(previous)) * 100 : null;
              results[metricId] = { value: current, trend };
            } else {
              results[metricId] = { value: null, trend: null };
            }
          } catch {
            results[metricId] = { value: null, trend: null };
          }
        }));

        if (isMounted) setMetricData(results);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchData();
    return () => { isMounted = false; };
  }, [geography, geoLevel, isOpen, viewMode, marketFactors]);

  // Update a market factor's metric
  const handleFactorChange = (factorId: string, newMetricId: string) => {
    const updated = marketFactors.map(f =>
      f.id === factorId ? { ...f, metricId: newMetricId } : f
    );
    setMarketFactors(updated);
    saveMarketFactors(updated);
    setEditingFactor(null);
  };

  // Format metric value for display
  const formatMetricValue = (metricId: string, value: number | null): string => {
    if (value === null) return '--';
    const format = getMetricFormat(metricId);
    return formatValue(value, format);
  };

  // Get rating label from value
  const getRatingLabel = (value: number | null, metricId: string): string => {
    if (value === null) return '--';
    // Different scales for different metrics
    if (metricId === 'cap_rate' || metricId === 'home_value_yoy') {
      if (value >= 8) return 'High';
      if (value >= 4) return 'Medium';
      return 'Low';
    }
    if (metricId === 'price_volatility') {
      if (value >= 15) return 'High Risk';
      if (value >= 8) return 'Medium Risk';
      return 'Low Risk';
    }
    if (metricId === 'pending_ratio') {
      if (value >= 0.8) return 'Very Strong';
      if (value >= 0.5) return 'Strong';
      if (value >= 0.3) return 'Moderate';
      return 'Weak';
    }
    // Generic percentage-based
    if (value >= 75) return 'High';
    if (value >= 50) return 'Medium';
    if (value >= 25) return 'Low';
    return 'Very Low';
  };

  if (!isOpen || !geography) return null;

  const mainScore = scores.main ?? 0;
  const trendValue = metricData['home_value_yoy']?.trend;
  const availableMetrics = getAvailableMetrics(viewMode);

  // SVG gauge dimensions
  const size = 180;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min(mainScore / 100, 1);
  const strokeDashoffset = circumference - percentage * circumference;
  const strokeColor = getScoreColor(mainScore);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-on-surface/40 z-40 sm:bg-on-surface/20"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={`
          fixed z-50 bg-surface elevation-3 overflow-y-auto
          inset-0 sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[580px]
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
        role="dialog"
        aria-modal="true"
        aria-label={`${geography.name} analysis`}
      >
        {/* Header */}
        <div className="bg-surface border-b border-outline-variant px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium text-primary uppercase tracking-widest mb-1">Analysis View</p>
            <h2 className="text-xl font-bold text-on-surface">{geography.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface-container transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-on-surface-variant" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Main Layout: Score + Contextual Cards */}
          <div className="flex gap-4 mb-6">
            {/* Score Gauge Card */}
            <div className="flex-1 bg-surface-container-low rounded-2xl p-6 flex flex-col items-center border border-outline-variant">
              {/* Confidence Badge */}
              <div className="self-end mb-2">
                <span className="text-[9px] font-medium text-on-surface-variant uppercase tracking-wide">Confidence</span>
                <div className="bg-primary text-on-primary w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mt-1">
                  {scores.confidence}
                </div>
              </div>

              {/* Gauge */}
              <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} className="transform -rotate-90">
                  <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth}
                  />
                  {!loading && (
                    <circle
                      cx={size / 2} cy={size / 2} r={radius}
                      fill="none" stroke={strokeColor} strokeWidth={strokeWidth}
                      strokeLinecap="round" strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      className="transition-all duration-700 ease-out"
                    />
                  )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-bold text-on-surface">
                    {loading ? '--' : Math.round(mainScore)}
                  </span>
                  {trendValue != null && !loading && (
                    <div className={`flex items-center gap-1 mt-1 text-sm font-semibold ${trendValue >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {trendValue >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {trendValue >= 0 ? '+' : ''}{trendValue.toFixed(1)}%
                    </div>
                  )}
                </div>
              </div>

              {/* Score Label */}
              <h3 className="text-lg font-bold text-on-surface mt-4">{scoreName}</h3>
              <p className="text-xs text-on-surface-variant text-center mt-2 max-w-[200px]">
                {viewMode === 'homebuyer'
                  ? 'Buyer opportunity score based on pricing, inventory, and market dynamics.'
                  : 'Investment potential based on yields, appreciation, and risk factors.'}
              </p>
              <button className="mt-4 text-primary text-sm font-semibold flex items-center gap-1 hover:gap-2 transition-all">
                View Calculation Methodology
                <span>→</span>
              </button>
            </div>

            {/* Contextual Cards Stack */}
            <div className="w-[220px] flex flex-col gap-3">
              {/* Pricing Momentum */}
              <div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wide">Pricing Momentum</span>
                  <div className="w-6 h-6 bg-primary/10 rounded flex items-center justify-center">
                    <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  </div>
                </div>
                <p className="text-lg font-bold text-on-surface">
                  {formatMetricValue('median_sale_price', metricData['median_sale_price']?.value)}
                </p>
                <div className="w-full h-1.5 bg-surface-container-highest rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: '65%' }} />
                </div>
                <p className="text-[10px] text-on-surface-variant mt-2">
                  {metricData['median_sale_price']?.trend != null
                    ? `${metricData['median_sale_price'].trend >= 0 ? 'Up' : 'Down'} ${Math.abs(metricData['median_sale_price'].trend).toFixed(0)}% vs last quarter`
                    : 'Trend data unavailable'}
                </p>
              </div>

              {/* Inventory Levels */}
              <div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wide">Inventory Levels</span>
                  <div className="w-6 h-6 bg-amber-500/10 rounded flex items-center justify-center">
                    <Minus className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                </div>
                <p className="text-lg font-bold text-on-surface">
                  {metricData['months_supply']?.value != null
                    ? `${metricData['months_supply'].value < 4 ? 'Low' : metricData['months_supply'].value < 6 ? 'Balanced' : 'High'} (${metricData['months_supply'].value.toFixed(1)} mo)`
                    : '--'}
                </p>
                <div className="w-full h-1.5 bg-surface-container-highest rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min((metricData['months_supply']?.value ?? 0) / 12 * 100, 100)}%` }} />
                </div>
                <p className="text-[10px] text-on-surface-variant mt-2">
                  {metricData['months_supply']?.value != null
                    ? metricData['months_supply'].value < 4 ? "Trending towards seller's market" : "Balanced market conditions"
                    : 'Data unavailable'}
                </p>
              </div>

              {/* Investment Insight */}
              <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl p-4 border border-primary/20">
                <span className="text-[10px] font-medium text-primary uppercase tracking-wide">Investment Insight</span>
                <p className="text-xs text-on-surface mt-2 leading-relaxed">
                  "{geography.name} shows {mainScore >= 70 ? 'strong' : mainScore >= 50 ? 'moderate' : 'developing'} fundamentals.
                  {viewMode === 'investor'
                    ? ' Current yield metrics suggest favorable entry points for rental investments.'
                    : ' Market conditions favor prepared buyers with competitive offers.'}
                  "
                </p>
              </div>
            </div>
          </div>

          {/* Market Factors Grid */}
          <div className="bg-surface-container-low rounded-2xl p-5 border border-outline-variant">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-bold text-on-surface">Market Factors</h4>
                <p className="text-[10px] text-on-surface-variant mt-0.5">Key elements influencing the score</p>
              </div>
              {isAdmin && (
                <span className="text-[9px] text-on-surface-variant bg-surface-container px-2 py-1 rounded">
                  Click factors to edit
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {marketFactors.map((factor) => {
                const data = metricData[factor.metricId];
                const isEditing = editingFactor === factor.id;

                return (
                  <div
                    key={factor.id}
                    className={`bg-surface rounded-xl p-4 border transition-all ${
                      isEditing ? 'border-primary ring-2 ring-primary/20' : 'border-outline-variant'
                    } ${isAdmin && !isEditing ? 'cursor-pointer hover:border-primary/50' : ''}`}
                    onClick={() => isAdmin && !isEditing && setEditingFactor(factor.id)}
                  >
                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-on-surface">{factor.label}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingFactor(null); }}
                            className="p-1 hover:bg-surface-container rounded"
                          >
                            <X className="w-3 h-3 text-on-surface-variant" />
                          </button>
                        </div>
                        <select
                          value={factor.metricId}
                          onChange={(e) => handleFactorChange(factor.id, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full text-xs bg-surface-container border border-outline-variant rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          {availableMetrics.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          factor.id === 'appreciation' ? 'bg-green-500/10' :
                          factor.id === 'yield' ? 'bg-blue-500/10' :
                          factor.id === 'risk' ? 'bg-purple-500/10' :
                          'bg-amber-500/10'
                        }`}>
                          {factor.id === 'appreciation' && <TrendingUp className="w-5 h-5 text-green-600" />}
                          {factor.id === 'yield' && <span className="text-blue-600 font-bold text-sm">%</span>}
                          {factor.id === 'risk' && <span className="text-purple-600 text-lg">◆</span>}
                          {factor.id === 'demand' && <TrendingUp className="w-5 h-5 text-amber-600" />}
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wide block">
                            {factor.label}
                          </span>
                          <p className="text-sm font-bold text-on-surface mt-0.5">
                            {getRatingLabel(data?.value ?? null, factor.metricId)}
                            {data?.value != null && (
                              <span className="text-on-surface-variant font-normal ml-1">
                                ({formatMetricValue(factor.metricId, data?.value)})
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
