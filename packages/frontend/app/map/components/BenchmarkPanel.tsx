'use client';

import { useMemo, useState, useEffect } from 'react';
import type { SelectedGeography, GeoLevel } from '../types';

// API URL for backend
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// State abbreviation to FIPS mapping
const STATE_ABBR_TO_FIPS: Record<string, string> = {
  'AL': '01', 'AK': '02', 'AZ': '04', 'AR': '05', 'CA': '06', 'CO': '08', 'CT': '09', 'DE': '10',
  'DC': '11', 'FL': '12', 'GA': '13', 'HI': '15', 'ID': '16', 'IL': '17', 'IN': '18', 'IA': '19',
  'KS': '20', 'KY': '21', 'LA': '22', 'ME': '23', 'MD': '24', 'MA': '25', 'MI': '26', 'MN': '27',
  'MS': '28', 'MO': '29', 'MT': '30', 'NE': '31', 'NV': '32', 'NH': '33', 'NJ': '34', 'NM': '35',
  'NY': '36', 'NC': '37', 'ND': '38', 'OH': '39', 'OK': '40', 'OR': '41', 'PA': '42', 'RI': '44',
  'SC': '45', 'SD': '46', 'TN': '47', 'TX': '48', 'UT': '49', 'VT': '50', 'VA': '51', 'WA': '53',
  'WV': '54', 'WI': '55', 'WY': '56', 'PR': '72'
};

interface BenchmarkPanelProps {
  selectedGeography: SelectedGeography;
  selectedMetric: string;
  geoLevel: GeoLevel;
  onClose: () => void;
}

interface MetricConfig {
  id: string;
  label: string;
  description: string;
  format: 'currency' | 'percent' | 'days' | 'number' | 'ratio' | 'months';
  lowerIsBetter: boolean;
  category: 'homebuyer' | 'investor';
}

interface BenchmarkData {
  location: Record<string, number | null>;
  state: Record<string, number | null>;
  national: Record<string, number | null>;
  locationName: string;
  stateName: string | null;
}

// Metric configurations
// lowerIsBetter: indicates if lower values are better for the user
// Homebuyers: lower prices, lower appreciation (not rising fast), higher DOM (less competition)
// Investors: lower inventory growth (supply constraint), higher appreciation
const METRIC_CONFIGS: MetricConfig[] = [
  // Homebuyer metrics - what's good for BUYERS (5 metrics)
  { id: 'home_value', label: 'Median Home Value', description: 'Median listing price', format: 'currency', lowerIsBetter: true, category: 'homebuyer' },
  { id: 'home_value_yoy', label: 'YoY Appreciation', description: '12-month price change', format: 'percent', lowerIsBetter: true, category: 'homebuyer' }, // Lower appreciation = prices not rising fast
  { id: 'days_on_market', label: 'Days on Market', description: 'Median listing duration', format: 'days', lowerIsBetter: false, category: 'homebuyer' }, // Higher DOM = more time to shop, less competition
  { id: 'months_of_supply', label: 'Months of Supply', description: 'Inventory ÷ pending sales', format: 'months', lowerIsBetter: false, category: 'homebuyer' }, // >6 = buyer's market, <3 = seller's market
  { id: 'price_cut_pct', label: 'Listings with Price Cuts', description: 'Share of reduced listings', format: 'percent', lowerIsBetter: false, category: 'homebuyer' }, // More price cuts = buyer advantage
  // Investor metrics - what's good for INVESTORS (4 metrics)
  { id: 'inventory_yoy', label: 'Inventory Growth', description: 'YoY inventory change', format: 'percent', lowerIsBetter: true, category: 'investor' }, // Lower inventory growth = constrained supply = price support
  { id: 'new_listings', label: 'New Listings', description: 'New listings this month', format: 'number', lowerIsBetter: false, category: 'investor' }, // More new listings = opportunities
  { id: 'pending_listings', label: 'Pending Listings', description: 'Under contract listings', format: 'number', lowerIsBetter: false, category: 'investor' }, // More pending = active market
  { id: 'home_value_mom', label: 'MoM Price Change', description: 'Month-over-month change', format: 'percent', lowerIsBetter: false, category: 'investor' }, // Higher MoM = appreciation
];

export function BenchmarkPanel({
  selectedGeography,
  geoLevel,
  onClose
}: BenchmarkPanelProps) {
  const [animateIn, setAnimateIn] = useState(false);
  const [activeTab, setActiveTab] = useState<'homebuyer' | 'investor'>('homebuyer');
  const [hoveredMetric, setHoveredMetric] = useState<string | null>(null);
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(true);

  // Animation trigger
  useEffect(() => {
    const timer = setTimeout(() => setAnimateIn(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Fetch benchmark data
  useEffect(() => {
    async function fetchBenchmarks() {
      setLoading(true);
      try {
        // Determine state ID from the selected geography
        // Priority: 1) Extract from name (most reliable), 2) From county FIPS, 3) From stateAbbr property
        let stateId: string | undefined;

        // First: extract state from name (e.g., "Flagstaff, AZ" -> "AZ")
        // This is the most reliable method since the name clearly shows the state
        if (selectedGeography.name.includes(', ')) {
          const parts = selectedGeography.name.split(', ');
          const lastPart = parts[parts.length - 1].trim().toUpperCase();
          if (lastPart.length === 2 && STATE_ABBR_TO_FIPS[lastPart]) {
            stateId = STATE_ABBR_TO_FIPS[lastPart];
          }
        }

        // Second: for county, extract from FIPS (first 2 digits)
        if (!stateId && geoLevel === 'county' && selectedGeography.id.length >= 2) {
          stateId = selectedGeography.id.substring(0, 2);
        }

        // Third: fallback to stateAbbr property if available
        if (!stateId && selectedGeography.stateAbbr) {
          const abbr = selectedGeography.stateAbbr.toUpperCase();
          if (STATE_ABBR_TO_FIPS[abbr]) {
            stateId = STATE_ABBR_TO_FIPS[abbr];
          }
        }

        const params = new URLSearchParams({
          geoLevel,
          regionId: selectedGeography.id,
        });
        if (stateId) {
          params.append('stateId', stateId);
        }

        console.log(`[BenchmarkPanel] Fetching: geoLevel=${geoLevel}, regionId=${selectedGeography.id}, stateId=${stateId}`);
        const response = await fetch(`${API_URL}/api/realtor/benchmarks?${params}`);
        if (response.ok) {
          const data = await response.json();

          // Calculate derived metrics: Months of Supply = inventory / pending_listings
          // This is a normalized metric comparable across geo levels
          const calcMonthsOfSupply = (obj: Record<string, number | null>) => {
            const inventory = obj?.for_sale_inventory;
            const pending = obj?.pending_listings;
            if (inventory && pending && pending > 0) {
              return inventory / pending;
            }
            return null;
          };

          if (data.location) data.location.months_of_supply = calcMonthsOfSupply(data.location);
          if (data.state) data.state.months_of_supply = calcMonthsOfSupply(data.state);
          if (data.national) data.national.months_of_supply = calcMonthsOfSupply(data.national);

          console.log('[BenchmarkPanel] API Response:', {
            locationMetrics: Object.keys(data.location || {}).filter(k => data.location[k] !== null).length,
            stateMetrics: Object.keys(data.state || {}).filter(k => data.state[k] !== null).length,
            nationalMetrics: Object.keys(data.national || {}).filter(k => data.national[k] !== null).length,
            months_of_supply: { local: data.location?.months_of_supply, state: data.state?.months_of_supply, national: data.national?.months_of_supply }
          });
          setBenchmarkData(data);
        } else {
          console.error('[BenchmarkPanel] API Error:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('Error fetching benchmarks:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchBenchmarks();
  }, [selectedGeography.id, selectedGeography.stateAbbr, geoLevel]);

  // Filter metrics by category
  const metrics = useMemo(() => {
    return METRIC_CONFIGS.filter(m => m.category === activeTab);
  }, [activeTab]);

  // Get state name or abbreviation - prioritize extracting from name which is most reliable
  const stateName = useMemo(() => {
    // First: extract from name (e.g., "Flagstaff, AZ" -> "AZ")
    if (selectedGeography.name.includes(', ')) {
      const parts = selectedGeography.name.split(', ');
      const lastPart = parts[parts.length - 1].trim().toUpperCase();
      if (lastPart.length === 2) {
        return lastPart;
      }
    }
    // Second: use API response
    if (benchmarkData?.stateName) return benchmarkData.stateName;
    // Third: fallback to stateAbbr property
    if (selectedGeography.stateAbbr) return selectedGeography.stateAbbr.toUpperCase();
    return null;
  }, [selectedGeography.name, benchmarkData?.stateName, selectedGeography.stateAbbr]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (!benchmarkData) return { beatState: 0, beatNational: 0, total: 0 };

    let beatState = 0;
    let beatNational = 0;
    let total = 0;

    console.log('[SummaryStats] Calculating for metrics:', metrics.map(m => m.id));
    console.log('[SummaryStats] benchmarkData.location:', benchmarkData.location);
    console.log('[SummaryStats] benchmarkData.national:', benchmarkData.national);

    for (const metric of metrics) {
      const local = benchmarkData.location[metric.id];
      const state = benchmarkData.state[metric.id];
      const national = benchmarkData.national[metric.id];

      if (local === null || local === undefined) {
        console.log(`[SummaryStats] ${metric.id}: local is null/undefined, skipping`);
        continue;
      }
      total++;

      if (state !== null && state !== undefined) {
        const isBetter = metric.lowerIsBetter ? local < state : local > state;
        if (isBetter) beatState++;
      }

      if (national !== null && national !== undefined) {
        const isBetter = metric.lowerIsBetter ? local < national : local > national;
        console.log(`[SummaryStats] ${metric.id}: local=${local}, national=${national}, lowerIsBetter=${metric.lowerIsBetter}, isBetter=${isBetter}`);
        if (isBetter) beatNational++;
      } else {
        console.log(`[SummaryStats] ${metric.id}: national is null/undefined`);
      }
    }

    return { beatState, beatNational, total };
  }, [benchmarkData, metrics]);

  const primaryColor = activeTab === 'homebuyer' ? '#f97316' : '#10b981';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-2 md:p-4 pointer-events-none">
      <div
        className="pointer-events-auto w-full max-w-md rounded-xl shadow-2xl bg-white"
        style={{
          border: '1px solid rgba(0, 0, 0, 0.08)',
          opacity: animateIn ? 1 : 0,
          transform: animateIn ? 'translateX(0)' : 'translateX(20px)',
          transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
      >
        {/* Header */}
        <div className="p-3 border-b border-gray-100 bg-white rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900">{selectedGeography.name}</h1>
              {stateName && (
                <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-slate-100 text-slate-600 rounded-full uppercase">
                  {stateName}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              aria-label="Close panel"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          {/* Tab Toggle */}
          <div className="flex items-center mt-2">
            <div className="inline-flex p-0.5 bg-gray-100 rounded-lg">
              <button
                onClick={() => setActiveTab('homebuyer')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-300 ${
                  activeTab === 'homebuyer'
                    ? 'bg-orange-500 text-white shadow'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Homebuyer
              </button>
              <button
                onClick={() => setActiveTab('investor')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-300 ${
                  activeTab === 'investor'
                    ? 'bg-emerald-500 text-white shadow'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Investor
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-3">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-200 border-t-orange-500"></div>
            </div>
          ) : benchmarkData ? (
            <>
              {/* Summary Card */}
              <SummaryCard
                beatState={summaryStats.beatState}
                beatNational={summaryStats.beatNational}
                total={summaryStats.total}
                metrics={metrics}
                benchmarkData={benchmarkData}
                animateIn={animateIn}
                locationName={selectedGeography.name}
              />

              {/* Benchmark Bars */}
              <div className="space-y-2 mt-3">
                {metrics.map((metric, index) => (
                  <BenchmarkBar
                    key={metric.id}
                    metric={metric}
                    index={index}
                    localValue={benchmarkData.location[metric.id]}
                    stateValue={benchmarkData.state[metric.id]}
                    nationalValue={benchmarkData.national[metric.id]}
                    animateIn={animateIn}
                    isHovered={hoveredMetric === metric.id}
                    onHover={() => setHoveredMetric(metric.id)}
                    onLeave={() => setHoveredMetric(null)}
                    primaryColor={primaryColor}
                  />
                ))}
              </div>

              {/* Footer */}
              <div className="mt-3 pt-2 border-t border-gray-100 text-[10px] text-slate-400">
                Source: Realtor.com
              </div>
            </>
          ) : (
            <div className="text-center py-6 text-slate-500 text-sm">
              No benchmark data available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Summary Card Component
interface SummaryCardProps {
  beatState: number;
  beatNational: number;
  total: number;
  metrics: MetricConfig[];
  benchmarkData: BenchmarkData;
  animateIn: boolean;
  locationName: string;
}

function SummaryCard({ beatState, beatNational, total, metrics, benchmarkData, animateIn }: SummaryCardProps) {
  return (
    <div
      className="p-2.5 rounded-xl border border-gray-200 bg-gradient-to-br from-slate-50 to-white"
      style={{
        opacity: animateIn ? 1 : 0,
        transform: animateIn ? 'translateY(0)' : 'translateY(-10px)',
        transition: 'all 0.5s ease-out'
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700">Market Position</span>
        <div className="flex gap-3">
          <div className="flex items-center gap-1">
            <span className="text-lg font-bold text-amber-500">{beatState}/{total}</span>
            <span className="text-[9px] text-slate-400">State</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-lg font-bold text-slate-500">{beatNational}/{total}</span>
            <span className="text-[9px] text-slate-400">National</span>
          </div>
        </div>
      </div>

      {/* Mini visualization */}
      <div className="mt-2 flex gap-0.5">
        {metrics.map((m, i) => {
          const local = benchmarkData.location[m.id];
          const state = benchmarkData.state[m.id];
          const national = benchmarkData.national[m.id];

          if (local === null || local === undefined) return (
            <div key={i} className="flex-1 h-1.5 rounded-full bg-gray-200" />
          );

          const beatStateVal = state !== null && state !== undefined && (m.lowerIsBetter ? local < state : local > state);
          const beatNationalVal = national !== null && national !== undefined && (m.lowerIsBetter ? local < national : local > national);

          return (
            <div
              key={i}
              className="flex-1 h-1.5 rounded-full transition-all duration-500"
              style={{
                backgroundColor: beatStateVal && beatNationalVal
                  ? '#10b981'
                  : beatStateVal || beatNationalVal
                    ? '#fbbf24'
                    : '#ef4444',
                opacity: animateIn ? 1 : 0.3,
                transitionDelay: `${0.1 + i * 0.05}s`
              }}
              title={m.label}
            />
          );
        })}
      </div>
    </div>
  );
}

// Benchmark Bar Component
interface BenchmarkBarProps {
  metric: MetricConfig;
  index: number;
  localValue: number | null;
  stateValue: number | null;
  nationalValue: number | null;
  animateIn: boolean;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  primaryColor: string;
}

function BenchmarkBar({
  metric,
  index,
  localValue,
  stateValue,
  nationalValue,
  animateIn,
  isHovered,
  onHover,
  onLeave,
  primaryColor
}: BenchmarkBarProps) {
  // Format value based on metric type
  const formatValue = (value: number | null | undefined, format: string): string => {
    if (value === null || value === undefined) return 'N/A';
    switch (format) {
      case 'currency':
        if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
        return `$${value.toFixed(0)}`;
      case 'percent':
        // Handle decimal percentages (0.05 = 5%)
        const pctValue = Math.abs(value) < 1 ? value * 100 : value;
        return `${pctValue.toFixed(1)}%`;
      case 'days':
        return `${Math.round(value)} days`;
      case 'months':
        return `${value.toFixed(1)} mo`;
      case 'number':
        return value.toLocaleString();
      case 'ratio':
        return `${value.toFixed(1)}x`;
      default:
        return String(value);
    }
  };

  // If no local value, show placeholder
  if (localValue === null || localValue === undefined) {
    return (
      <div className="p-2 rounded-lg bg-gray-50 opacity-50">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-600">{metric.label}</span>
          <span className="text-slate-400 text-xs">No data</span>
        </div>
      </div>
    );
  }

  // Calculate positions for markers
  const allValues = [localValue, stateValue, nationalValue].filter((v): v is number => v !== null && v !== undefined);
  const minVal = Math.min(...allValues) * 0.85;
  const maxVal = Math.max(...allValues) * 1.15;
  const range = maxVal - minVal || 1;

  const getPosition = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 50;
    return Math.max(5, Math.min(95, ((value - minVal) / range) * 100));
  };

  const localPos = getPosition(localValue);
  const statePos = stateValue !== null && stateValue !== undefined ? getPosition(stateValue) : null;
  const nationalPos = nationalValue !== null && nationalValue !== undefined ? getPosition(nationalValue) : null;

  // Determine comparison results
  const isBetterThanState = stateValue !== null && stateValue !== undefined && (metric.lowerIsBetter
    ? localValue < stateValue
    : localValue > stateValue);
  const isBetterThanNational = nationalValue !== null && nationalValue !== undefined && (metric.lowerIsBetter
    ? localValue < nationalValue
    : localValue > nationalValue);

  // Debug logging for comparison issues
  if (metric.id === 'home_value' || metric.id === 'days_on_market') {
    console.log(`[BenchmarkBar] ${metric.id}:`, {
      localValue,
      nationalValue,
      stateValue,
      lowerIsBetter: metric.lowerIsBetter,
      isBetterThanNational,
      isBetterThanState,
      comparison: metric.lowerIsBetter ? `${localValue} < ${nationalValue}` : `${localValue} > ${nationalValue}`
    });
  }

  const isTop = isBetterThanState && isBetterThanNational;

  return (
    <div
      className={`relative p-2.5 rounded-xl transition-all duration-300 cursor-pointer border ${
        isHovered ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-100 hover:border-gray-200'
      }`}
      style={{
        opacity: animateIn ? 1 : 0,
        transform: animateIn ? 'translateX(0)' : 'translateX(-20px)',
        transition: `all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${index * 0.05}s`
      }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-800">{metric.label}</span>
          {isTop && (
            <span className="px-1 py-0.5 text-[8px] font-bold bg-emerald-100 text-emerald-600 rounded uppercase">
              Top
            </span>
          )}
        </div>
        <span className="text-sm font-bold text-slate-900">
          {formatValue(localValue, metric.format)}
        </span>
      </div>

      {/* Bar Container */}
      <div className="relative h-6">
        {/* Background track with gradient zones */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background: metric.lowerIsBetter
                ? 'linear-gradient(to right, rgba(16, 185, 129, 0.3), rgba(251, 191, 36, 0.3), rgba(239, 68, 68, 0.3))'
                : 'linear-gradient(to right, rgba(239, 68, 68, 0.3), rgba(251, 191, 36, 0.3), rgba(16, 185, 129, 0.3))'
            }}
          />
        </div>

        {/* National marker (diamond) */}
        {nationalPos !== null && (
          <div
            className="absolute z-10"
            style={{
              left: `${nationalPos}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)'
            }}
          >
            <div
              className="w-3 h-3 bg-slate-500"
              style={{
                transform: `rotate(45deg) ${animateIn ? 'scale(1)' : 'scale(0)'}`,
                transition: `transform 0.3s ease-out ${0.2 + index * 0.05}s`
              }}
            />
          </div>
        )}

        {/* State marker (circle outline) */}
        {statePos !== null && (
          <div
            className="absolute z-10"
            style={{
              left: `${statePos}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)'
            }}
          >
            <div
              className="w-4 h-4 rounded-full border-2 border-amber-500 bg-amber-100"
              style={{
                transform: animateIn ? 'scale(1)' : 'scale(0)',
                transition: `transform 0.3s ease-out ${0.25 + index * 0.05}s`
              }}
            />
          </div>
        )}

        {/* Local value marker */}
        <div
          className="absolute z-20"
          style={{
            left: `${localPos}%`,
            top: '50%',
            transform: `translate(-50%, -50%) ${animateIn ? 'scale(1)' : 'scale(0)'}`,
            transition: `transform 0.3s ease-out ${0.3 + index * 0.05}s`
          }}
        >
          <div
            className="w-4 h-4 rounded-full flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor === '#f97316' ? '#ea580c' : '#059669'})`
            }}
          >
            <div className="w-1 h-1 rounded-full bg-white" />
          </div>
        </div>
      </div>

      {/* Compact comparison indicators */}
      <div className="flex items-center justify-end gap-2 mt-1 text-[9px]">
        {stateValue !== null && stateValue !== undefined && (
          <span className={isBetterThanState ? 'text-emerald-600' : 'text-rose-500'}>
            {isBetterThanState ? '▲' : '▼'} State
          </span>
        )}
        {nationalValue !== null && nationalValue !== undefined && (
          <span className={isBetterThanNational ? 'text-emerald-600' : 'text-rose-500'}>
            {isBetterThanNational ? '▲' : '▼'} Nat'l
          </span>
        )}
      </div>
    </div>
  );
}
