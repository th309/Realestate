'use client';

import { useMemo, useState, useEffect } from 'react';
import type { SelectedGeography, HomeValues, GeoLevel } from '../types';
import { getMetricFormat, getMetricTitle, formatValue } from '../utils';

// API URL for backend
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface BenchmarkPanelProps {
  selectedGeography: SelectedGeography;
  selectedMetric: string;
  homeValues: HomeValues;
  geoLevel: GeoLevel;
  onClose: () => void;
}

export function BenchmarkPanel({
  selectedGeography,
  selectedMetric,
  homeValues,
  geoLevel,
  onClose
}: BenchmarkPanelProps) {
  const [nationalAverage, setNationalAverage] = useState<number | null>(null);

  const metricFormat = getMetricFormat(selectedMetric);
  const metricTitle = getMetricTitle(selectedMetric);

  // Fetch national average from API
  useEffect(() => {
    async function fetchNationalAverage() {
      try {
        const response = await fetch(
          `${API_URL}/api/realtor/national-average?metric=${selectedMetric}`
        );
        if (response.ok) {
          const data = await response.json();
          setNationalAverage(data.value);
        }
      } catch (error) {
        console.error('Error fetching national average:', error);
      }
    }

    fetchNationalAverage();
  }, [selectedMetric]);

  // Calculate all benchmark statistics from the existing homeValues data
  // This uses the SAME data that's displayed on the map - no separate API call
  const benchmarkStats = useMemo(() => {
    const allValues = Object.values(homeValues).filter(
      (v): v is number => typeof v === 'number' && !isNaN(v) && v !== 0
    );

    if (allValues.length === 0) {
      return null;
    }

    const sorted = [...allValues].sort((a, b) => a - b);
    const sum = allValues.reduce((a, b) => a + b, 0);
    const count = allValues.length;

    // Calculate statistics
    const average = sum / count;
    const median = count % 2 === 0
      ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
      : sorted[Math.floor(count / 2)];
    const min = sorted[0];
    const max = sorted[count - 1];

    // Calculate percentile rank for the selected value
    let percentileRank: number | null = null;
    if (selectedGeography.value !== null) {
      const belowCount = sorted.filter(v => v < selectedGeography.value!).length;
      percentileRank = Math.round((belowCount / count) * 100);
    }

    // Calculate percentile values (25th, 75th)
    const p25Index = Math.floor(count * 0.25);
    const p75Index = Math.floor(count * 0.75);
    const p25 = sorted[p25Index];
    const p75 = sorted[p75Index];

    return {
      average: Math.round(average),
      median: Math.round(median),
      min: Math.round(min),
      max: Math.round(max),
      p25: Math.round(p25),
      p75: Math.round(p75),
      count,
      percentileRank
    };
  }, [homeValues, selectedGeography.value]);

  // Get geo level display name
  const geoLevelName = {
    national: 'National',
    state: 'State',
    metro: 'Metro Area',
    county: 'County',
    city: 'City',
    zip: 'ZIP Code',
    tract: 'Census Tract'
  }[selectedGeography.geoLevel] || selectedGeography.geoLevel;

  // Determine comparison label based on current view
  const getComparisonLabel = () => {
    switch (geoLevel) {
      case 'state':
      case 'national':
        return 'All States';
      case 'metro':
        return 'All Metros';
      case 'county':
        return 'All Counties';
      case 'city':
        return 'All Cities';
      case 'zip':
        return 'All ZIP Codes';
      case 'tract':
        return 'All Tracts';
      default:
        return 'All Regions';
    }
  };

  // Calculate bar widths based on values
  const getBarWidth = (value: number | null, max: number) => {
    if (value === null || max === 0) return 0;
    return Math.min(100, Math.max(5, (value / max) * 100));
  };

  const maxValue = useMemo(() => {
    if (!benchmarkStats || selectedGeography.value === null) return 1;
    const values = [selectedGeography.value, benchmarkStats.average, benchmarkStats.median];
    if (nationalAverage !== null) values.push(nationalAverage);
    return Math.max(...values);
  }, [benchmarkStats, selectedGeography.value, nationalAverage]);

  return (
    <div className="absolute top-3 right-3 md:top-6 md:right-6 bg-white rounded-xl shadow-lg z-20 w-80 md:w-96 overflow-hidden animate-slideIn">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-4 py-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base truncate">{selectedGeography.name}</h3>
            <p className="text-slate-300 text-xs mt-0.5">{geoLevelName} • {metricTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-2 p-1 hover:bg-white/10 rounded transition-colors flex-shrink-0"
            aria-label="Close panel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Main Value */}
        <div className="text-center mb-4 pb-4 border-b border-gray-100">
          <div className="text-3xl font-bold text-slate-900">
            {selectedGeography.value !== null
              ? formatValue(selectedGeography.value, metricFormat)
              : 'No data'}
          </div>
          {benchmarkStats && benchmarkStats.percentileRank !== null && (
            <div className="text-sm text-slate-500 mt-1">
              Ranks in the <span className="font-medium text-cyan-600">
                {benchmarkStats.percentileRank === 0 ? '1st' :
                 benchmarkStats.percentileRank === 1 ? '1st' :
                 benchmarkStats.percentileRank === 2 ? '2nd' :
                 benchmarkStats.percentileRank === 3 ? '3rd' :
                 `${benchmarkStats.percentileRank}th`}
              </span> percentile of {benchmarkStats.count.toLocaleString()} {geoLevel}s
            </div>
          )}
        </div>

        {benchmarkStats ? (
          <>
            {/* Benchmark Bars */}
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Comparison
              </h4>

              {/* This Location Bar */}
              <BenchmarkBar
                label="This Location"
                value={selectedGeography.value}
                metricFormat={metricFormat}
                barWidth={getBarWidth(selectedGeography.value, maxValue)}
                color="bg-cyan-500"
                isHighlighted
              />

              {/* National Average Bar */}
              <BenchmarkBar
                label="US National"
                value={nationalAverage}
                metricFormat={metricFormat}
                barWidth={getBarWidth(nationalAverage, maxValue)}
                color="bg-violet-500"
              />

              {/* Geo Level Average Bar */}
              <BenchmarkBar
                label={`${getComparisonLabel()} Avg`}
                value={benchmarkStats.average}
                metricFormat={metricFormat}
                barWidth={getBarWidth(benchmarkStats.average, maxValue)}
                color="bg-emerald-500"
              />

              {/* Median Bar */}
              <BenchmarkBar
                label={`${getComparisonLabel()} Median`}
                value={benchmarkStats.median}
                metricFormat={metricFormat}
                barWidth={getBarWidth(benchmarkStats.median, maxValue)}
                color="bg-amber-400"
              />
            </div>

            {/* Range Info */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-500">Min:</span>{' '}
                  <span className="font-medium text-slate-700">
                    {formatValue(benchmarkStats.min, metricFormat)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Max:</span>{' '}
                  <span className="font-medium text-slate-700">
                    {formatValue(benchmarkStats.max, metricFormat)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">25th %:</span>{' '}
                  <span className="font-medium text-slate-700">
                    {formatValue(benchmarkStats.p25, metricFormat)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">75th %:</span>{' '}
                  <span className="font-medium text-slate-700">
                    {formatValue(benchmarkStats.p75, metricFormat)}
                  </span>
                </div>
              </div>
            </div>

            {/* Comparison Summary */}
            {selectedGeography.value !== null && nationalAverage !== null && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <ComparisonSummary
                  localValue={selectedGeography.value}
                  nationalValue={nationalAverage}
                  metricFormat={metricFormat}
                />
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-4 text-slate-500 text-sm">
            No comparison data available
          </div>
        )}
      </div>
    </div>
  );
}

interface BenchmarkBarProps {
  label: string;
  value: number | null;
  metricFormat: ReturnType<typeof getMetricFormat>;
  barWidth: number;
  color: string;
  isHighlighted?: boolean;
}

function BenchmarkBar({ label, value, metricFormat, barWidth, color, isHighlighted }: BenchmarkBarProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className={`text-sm ${isHighlighted ? 'font-medium text-slate-900' : 'text-slate-600'}`}>
          {label}
        </span>
        <span className={`text-sm font-medium ${isHighlighted ? 'text-cyan-600' : 'text-slate-700'}`}>
          {value !== null ? formatValue(value, metricFormat) : 'N/A'}
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
}

interface ComparisonSummaryProps {
  localValue: number;
  nationalValue: number;
  metricFormat: ReturnType<typeof getMetricFormat>;
}

function ComparisonSummary({ localValue, nationalValue, metricFormat }: ComparisonSummaryProps) {
  const diff = localValue - nationalValue;
  const pctDiff = nationalValue !== 0 ? (diff / nationalValue) * 100 : 0;
  const isHigher = diff > 0;

  // For some metrics like days on market, lower is better
  const lowerIsBetter = metricFormat === 'days';
  const isPositive = lowerIsBetter ? !isHigher : isHigher;

  return (
    <div className={`text-sm ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
      <span className="font-medium">
        {Math.abs(pctDiff).toFixed(1)}% {isHigher ? 'above' : 'below'}
      </span>
      {' '}US national average
    </div>
  );
}
