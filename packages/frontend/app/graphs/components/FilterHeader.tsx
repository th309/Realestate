'use client';

import React from 'react';
import {
  Plus,
  X,
  Layers,
  Activity,
  History,
  TrendingUp,
  Eye,
  EyeOff,
} from 'lucide-react';
import { GeoLevel, MetricType, ComparisonConfig } from '../types';
import { M3Select } from './M3Select';

interface BaselineConfig {
  enabled: boolean;
  level: GeoLevel;
  area: string;
}

interface FilterHeaderProps {
  geoLevel: GeoLevel;
  setGeoLevel: (level: GeoLevel) => void;
  selectedArea: string;
  setSelectedArea: (area: string) => void;
  metric: MetricType;
  setMetric: (metric: MetricType) => void;
  primaryOptions: string[];
  comparison: ComparisonConfig;
  setComparison: React.Dispatch<React.SetStateAction<ComparisonConfig>>;
  baseline: BaselineConfig;
  setBaseline: React.Dispatch<React.SetStateAction<BaselineConfig>>;
  baselineOptions: string[];
  showMilestones: boolean;
  setShowMilestones: (show: boolean) => void;
  showForecast: boolean;
  setShowForecast: (show: boolean) => void;
  visibleSeries: Record<string, boolean>;
  toggleSeries: (key: string) => void;
}

export const FilterHeader: React.FC<FilterHeaderProps> = ({
  geoLevel,
  setGeoLevel,
  selectedArea,
  setSelectedArea,
  metric,
  setMetric,
  primaryOptions,
  comparison,
  setComparison,
  baseline,
  setBaseline,
  baselineOptions,
  showMilestones,
  setShowMilestones,
  showForecast,
  setShowForecast,
  visibleSeries,
  toggleSeries,
}) => {
  return (
    <div className="p-4 md:p-8 bg-[#f1f5f1] border-b border-[#dee5dd]">
      <div className="flex flex-col gap-6 md:gap-8 mb-6 md:mb-8">
        <div className="grid grid-cols-1 md:flex md:flex-row gap-4">
          <M3Select
            label="Geography Level"
            value={geoLevel}
            onChange={(val) => setGeoLevel(val as GeoLevel)}
            options={Object.values(GeoLevel)}
            isPrimary
          />
          <M3Select
            label="Primary Target"
            value={selectedArea}
            onChange={setSelectedArea}
            options={primaryOptions}
            disabled={geoLevel === GeoLevel.NATIONAL}
          />
          <M3Select
            label="Market Metric"
            value={metric}
            onChange={(val) => setMetric(val as MetricType)}
            options={Object.values(MetricType)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <button
            onClick={() => setComparison((prev) => ({ ...prev, enabled: !prev.enabled }))}
            disabled={geoLevel === GeoLevel.NATIONAL}
            className={`flex items-center justify-center gap-2.5 px-4 md:px-6 py-3 md:py-3.5 rounded-2xl text-xs md:text-sm font-black transition-all border ${
              comparison.enabled
                ? 'bg-[#006d3d] text-white border-[#006d3d] shadow-md'
                : 'bg-white text-[#414941] border-[#717971] hover:bg-[#e7ece7]'
            } ${geoLevel === GeoLevel.NATIONAL ? 'opacity-30 grayscale cursor-not-allowed' : ''}`}
          >
            {comparison.enabled ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {comparison.enabled ? 'Remove Comparison' : 'Compare Another'}
          </button>

          {comparison.enabled && (
            <div className="w-full md:flex-1 md:max-w-[280px] animate-in slide-in-from-left-4 duration-300">
              <M3Select
                label="Secondary Target"
                value={comparison.area}
                onChange={(val) => setComparison((prev) => ({ ...prev, area: val }))}
                options={primaryOptions.filter((s) => s !== selectedArea)}
              />
            </div>
          )}

          <div className="hidden md:block h-8 w-[1px] bg-[#dee5dd] mx-2" />

          <button
            onClick={() => setBaseline((prev) => ({ ...prev, enabled: !prev.enabled }))}
            className={`flex items-center justify-center gap-2.5 px-4 md:px-6 py-3 md:py-3.5 rounded-2xl text-xs md:text-sm font-black transition-all border ${
              baseline.enabled
                ? 'bg-[#006a6a] text-white border-[#006a6a] shadow-md'
                : 'bg-white text-[#414941] border-[#717971] hover:bg-[#e7ece7]'
            }`}
          >
            {baseline.enabled ? (
              <Layers className="w-4 h-4" />
            ) : (
              <Activity className="w-4 h-4" />
            )}
            {baseline.enabled ? 'Hide Baseline' : 'Overlay Baseline'}
          </button>

          {baseline.enabled && (
            <div className="flex flex-col md:flex-row items-center gap-3 animate-in fade-in duration-300 w-full md:w-auto">
              <div className="w-full md:w-[150px]">
                <M3Select
                  label="Base Level"
                  value={baseline.level}
                  onChange={(val) => setBaseline((prev) => ({ ...prev, level: val as GeoLevel }))}
                  options={Object.values(GeoLevel)}
                />
              </div>
              <div className="w-full md:w-[150px]">
                <M3Select
                  label="Base Area"
                  value={baseline.area}
                  onChange={(val) => setBaseline((prev) => ({ ...prev, area: val }))}
                  options={baselineOptions}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 md:gap-4 pt-2">
          <span className="text-[9px] md:text-[10px] font-black uppercase text-[#717971] tracking-widest mr-1 md:mr-2">
            Quick Toggles:
          </span>
          <button
            onClick={() => setShowMilestones(!showMilestones)}
            className={`px-3 md:px-5 py-2 md:py-2.5 rounded-xl text-[10px] md:text-[11px] font-black border transition-all flex items-center gap-2 ${
              showMilestones
                ? 'bg-[#9a6b00] text-white border-[#9a6b00]'
                : 'bg-white text-[#414941] border-[#717971]'
            }`}
          >
            <History className="w-3.5 md:w-4 h-3.5 md:h-4" />
            Events
          </button>
          <button
            onClick={() => setShowForecast(!showForecast)}
            className={`px-3 md:px-5 py-2 md:py-2.5 rounded-xl text-[10px] md:text-[11px] font-black border transition-all flex items-center gap-2 ${
              showForecast
                ? 'bg-emerald-800 text-white border-emerald-800 shadow-sm'
                : 'bg-white text-[#414941] border-[#717971]'
            }`}
          >
            <TrendingUp className="w-3.5 md:w-4 h-3.5 md:h-4" />
            Forecast
          </button>

          <div className="flex-1 md:flex-none" />

          <div className="flex flex-wrap items-center gap-2 bg-white/50 p-1.5 rounded-xl border border-[#dee5dd]">
            <button
              onClick={() => toggleSeries('primary')}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black transition-all ${
                visibleSeries.primary ? 'text-[#006d3d]' : 'opacity-40'
              }`}
            >
              {visibleSeries.primary ? (
                <Eye className="w-3 h-3" />
              ) : (
                <EyeOff className="w-3 h-3" />
              )}
              {selectedArea}
            </button>
            {comparison.enabled && (
              <button
                onClick={() => toggleSeries('comparison')}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black transition-all ${
                  visibleSeries.comparison ? 'text-[#006a6a]' : 'opacity-40'
                }`}
              >
                {visibleSeries.comparison ? (
                  <Eye className="w-3 h-3" />
                ) : (
                  <EyeOff className="w-3 h-3" />
                )}
                {comparison.area}
              </button>
            )}
            {baseline.enabled && (
              <button
                onClick={() => toggleSeries('baseline')}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black transition-all ${
                  visibleSeries.baseline ? 'text-[#717971]' : 'opacity-40'
                }`}
              >
                {visibleSeries.baseline ? (
                  <Eye className="w-3 h-3" />
                ) : (
                  <EyeOff className="w-3 h-3" />
                )}
                Baseline
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
