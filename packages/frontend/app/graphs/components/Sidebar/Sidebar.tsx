'use client';

import React from 'react';
import type { UseGraphsStateReturn } from '../../hooks/useGraphsState';
import type { TimeFrame, WaterfallPreset, ScoreTypeOption, RadarPreset, BarSort, BarCount, ScaleType } from '../../hooks/useGraphsState';
import { ChartTypePills } from '../ChartTypePills';
import { MarketSlots } from '../MarketSlots';
import { ScopeMiniMap } from '../ScopeMiniMap';
import { MetricPicker } from '../MetricPicker';
import { WATERFALL_PRESETS, WATERFALL_PRESET_ORDER } from '../../constants/waterfallConfigs';
import { RADAR_PROFILES, RADAR_PRESET_ORDER } from '../../constants/radarProfiles';
import type { GeoLevel } from '@/lib/data';

// ── Constants ────────────────────────────────────────────────────────────────

const TIME_FRAMES: TimeFrame[] = ['1Y', '3Y', '5Y', '10Y', 'Max'];

const SCORE_TYPE_OPTIONS: { value: ScoreTypeOption; label: string }[] = [
  { value: 'homeready', label: 'HomeReady' },
  { value: 'investoredge', label: 'InvestorEdge' },
  { value: 'markethealth', label: 'Market Health' },
];

const BAR_COUNT_OPTIONS: BarCount[] = [10, 25];

// ── Sidebar Props ────────────────────────────────────────────────────────────

interface SidebarProps {
  state: UseGraphsStateReturn;
}

// ── Sidebar Component ────────────────────────────────────────────────────────

export function Sidebar({ state }: SidebarProps) {
  const {
    chartType, setChartType,
    markets, addMarket, removeMarket,
    activeMetric, setActiveMetric,
    timeFrame, setTimeFrame,
    scope, setScope,
    baselineType, setBaselineType,
    // Scatter
    scatterXMetric, setScatterXMetric,
    scatterYMetric, setScatterYMetric,
    scatterXScaleType, setScatterXScaleType,
    scatterYScaleType, setScatterYScaleType,
    showRegression, setShowRegression,
    showQuadrants, setShowQuadrants,
    // Waterfall
    waterfallPreset, setWaterfallPreset,
    scoreType, setScoreType,
    // Radar
    radarPreset, setRadarPreset,
    // Bar
    barMetric, setBarMetric,
    barSort, setBarSort,
    barCount, setBarCount,
    raceMode, setRaceMode,
  } = state;

  // ── Visibility flags ─────────────────────────────────────────────────────

  const maxMarketSlots = ['timeseries', 'radar'].includes(chartType) ? 3 : 2;
  const showMiniMap = ['timeseries', 'scatter', 'bar'].includes(chartType);
  const showSingleMetric = ['timeseries', 'bar'].includes(chartType);
  const showScatterMetrics = chartType === 'scatter';
  const showTimeFrame = chartType === 'timeseries';
  const showScatterToggles = chartType === 'scatter';
  const showWaterfallPresets = chartType === 'waterfall';
  const showScoreType = chartType === 'waterfall' && waterfallPreset === 'score';
  const showRadarPresets = chartType === 'radar';
  const showBarControls = chartType === 'bar';
  const showRaceToggle = ['bar', 'scatter', 'radar'].includes(chartType);

  // ── Derived values ───────────────────────────────────────────────────────

  const primaryState = markets[0]?.state;
  const geoLevel: GeoLevel = (markets[0]?.type as GeoLevel) || 'metro';

  return (
    <aside className="w-[200px] flex-shrink-0 flex flex-col gap-5 overflow-y-auto">
      {/* Market Slots */}
      <MarketSlots
        markets={markets}
        maxSlots={maxMarketSlots}
        onAdd={addMarket}
        onRemove={removeMarket}
      />

      {/* Chart Type */}
      <SidebarSection label="Chart Type">
        <ChartTypePills activeType={chartType} onChange={setChartType} vertical />
      </SidebarSection>

      {/* Scope / Comparison Baseline */}
      {showMiniMap && chartType === 'timeseries' && (
        <ScopeMiniMap
          scope={baselineType}
          onScopeChange={setBaselineType as (v: string) => void}
          primaryState={primaryState}
          mode="baseline"
        />
      )}
      {showMiniMap && chartType !== 'timeseries' && (
        <ScopeMiniMap
          scope={scope}
          onScopeChange={setScope as (v: string) => void}
          primaryState={primaryState}
          mode="scope"
        />
      )}

      {/* Single Metric Picker (timeseries + bar) */}
      {showSingleMetric && (
        <SidebarSection label="Metric">
          <MetricPicker
            value={chartType === 'bar' ? barMetric : activeMetric}
            onChange={chartType === 'bar' ? setBarMetric : setActiveMetric}
            geoLevel={geoLevel}
            fullWidth
          />
        </SidebarSection>
      )}

      {/* Scatter: X + Y Metric Pickers */}
      {showScatterMetrics && (
        <>
          <SidebarSection label="X Metric">
            <MetricPicker
              value={scatterXMetric}
              onChange={setScatterXMetric}
              geoLevel={geoLevel}
              fullWidth
            />
          </SidebarSection>
          <SidebarSection label="Y Metric">
            <MetricPicker
              value={scatterYMetric}
              onChange={setScatterYMetric}
              geoLevel={geoLevel}
              fullWidth
            />
          </SidebarSection>
        </>
      )}

      {/* Time Frame (timeseries only) */}
      {showTimeFrame && (
        <SidebarSection label="Time Range">
          <TimeFrameButtons value={timeFrame} onChange={setTimeFrame} />
        </SidebarSection>
      )}

      {/* Scatter Toggles */}
      {showScatterToggles && (
        <>
          <ToggleRow label="Regression" checked={showRegression} onChange={setShowRegression} />
          <ToggleRow label="Quadrants" checked={showQuadrants} onChange={setShowQuadrants} />
          <SidebarSection label="Scale">
            <ScaleTypePicker
              xScale={scatterXScaleType}
              yScale={scatterYScaleType}
              onXChange={setScatterXScaleType}
              onYChange={setScatterYScaleType}
            />
          </SidebarSection>
        </>
      )}

      {/* Waterfall Presets */}
      {showWaterfallPresets && (
        <SidebarSection label="Preset">
          <WaterfallPresetPills value={waterfallPreset} onChange={setWaterfallPreset} />
        </SidebarSection>
      )}

      {/* Score Type (waterfall + score preset) */}
      {showScoreType && (
        <SidebarSection label="Score Type">
          <ScoreTypeSelector value={scoreType} onChange={setScoreType} />
        </SidebarSection>
      )}

      {/* Radar Presets */}
      {showRadarPresets && (
        <SidebarSection label="Profile">
          <RadarPresetPills value={radarPreset} onChange={setRadarPreset} />
        </SidebarSection>
      )}

      {/* Animate toggle (bar, scatter, radar) */}
      {showRaceToggle && (
        <ToggleRow label="Animate" checked={raceMode} onChange={setRaceMode} />
      )}

      {/* Bar Controls: Sort + Count */}
      {showBarControls && (
        <>
          <SidebarSection label="Sort">
            <SortToggle value={barSort} onChange={setBarSort} />
          </SidebarSection>
          <SidebarSection label="Count">
            <CountPicker value={barCount} onChange={setBarCount} />
          </SidebarSection>
        </>
      )}
    </aside>
  );
}

// ── Sidebar Section Wrapper ──────────────────────────────────────────────────

function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2 px-1">
        {label}
      </div>
      {children}
    </div>
  );
}

// ── Time Frame Buttons ───────────────────────────────────────────────────────

function TimeFrameButtons({
  value,
  onChange,
}: {
  value: TimeFrame;
  onChange: (tf: TimeFrame) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {TIME_FRAMES.map((tf) => (
        <button
          key={tf}
          onClick={() => onChange(tf)}
          className={`
            px-2 py-1 rounded-lg text-[10px] font-medium transition-all duration-150
            ${value === tf
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }
          `}
        >
          {tf}
        </button>
      ))}
    </div>
  );
}

// ── Toggle Row ───────────────────────────────────────────────────────────────

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between px-1 cursor-pointer group"
      onClick={() => onChange(!checked)}
    >
      <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">
        {label}
      </span>
      <span
        role="switch"
        aria-checked={checked}
        className="relative w-7 h-4 rounded-full bg-surface-container-high flex-shrink-0"
      >
        <span
          className={`
            absolute top-1 w-2 h-2 rounded-full transition-all duration-200
            ${checked ? 'left-4 bg-primary' : 'left-1 bg-outline-variant'}
          `}
        />
      </span>
    </div>
  );
}

// ── Waterfall Preset Pills ───────────────────────────────────────────────────

function WaterfallPresetPills({
  value,
  onChange,
}: {
  value: WaterfallPreset;
  onChange: (preset: WaterfallPreset) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {WATERFALL_PRESET_ORDER.map((presetId) => {
        const preset = WATERFALL_PRESETS[presetId];
        const isActive = value === presetId;
        return (
          <button
            key={presetId}
            onClick={() => onChange(presetId)}
            title={preset.description}
            className={`
              w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150
              ${isActive
                ? 'bg-primary text-on-primary'
                : 'text-on-surface-variant hover:bg-surface-container-high'
              }
            `}
          >
            {preset.title.replace(' Breakdown', '').replace(' vs National Average', '')}
            {preset.proOnly && !isActive && (
              <span className="ml-1 text-[9px] text-on-surface-variant/50 uppercase">Pro</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Score Type Selector ──────────────────────────────────────────────────────

function ScoreTypeSelector({
  value,
  onChange,
}: {
  value: ScoreTypeOption;
  onChange: (scoreType: ScoreTypeOption) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {SCORE_TYPE_OPTIONS.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`
              w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150
              ${isActive
                ? 'bg-primary text-on-primary'
                : 'text-on-surface-variant hover:bg-surface-container-high'
              }
            `}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Radar Preset Pills ───────────────────────────────────────────────────────

function RadarPresetPills({
  value,
  onChange,
}: {
  value: RadarPreset;
  onChange: (preset: RadarPreset) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {RADAR_PRESET_ORDER.map((presetId) => {
        const profile = RADAR_PROFILES[presetId];
        const isActive = value === presetId;
        return (
          <button
            key={presetId}
            onClick={() => onChange(presetId)}
            className={`
              w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150
              ${isActive
                ? 'bg-primary text-on-primary'
                : 'text-on-surface-variant hover:bg-surface-container-high'
              }
            `}
          >
            {profile.title}
          </button>
        );
      })}
      {/* Custom option */}
      <button
        onClick={() => onChange('custom')}
        className={`
          w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150
          ${value === 'custom'
            ? 'bg-primary text-on-primary'
            : 'text-on-surface-variant hover:bg-surface-container-high'
          }
        `}
      >
        Custom
      </button>
    </div>
  );
}

// ── Sort Toggle ──────────────────────────────────────────────────────────────

function SortToggle({
  value,
  onChange,
}: {
  value: BarSort;
  onChange: (sort: BarSort) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={() => onChange('desc')}
        className={`
          w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150
          ${value === 'desc'
            ? 'bg-primary text-on-primary'
            : 'text-on-surface-variant hover:bg-surface-container-high'
          }
        `}
      >
        Highest First
      </button>
      <button
        onClick={() => onChange('asc')}
        className={`
          w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150
          ${value === 'asc'
            ? 'bg-primary text-on-primary'
            : 'text-on-surface-variant hover:bg-surface-container-high'
          }
        `}
      >
        Lowest First
      </button>
    </div>
  );
}

// ── Count Picker ─────────────────────────────────────────────────────────────

function CountPicker({
  value,
  onChange,
}: {
  value: BarCount;
  onChange: (count: BarCount) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {BAR_COUNT_OPTIONS.map((count) => (
        <button
          key={count}
          onClick={() => onChange(count)}
          className={`
            w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150
            ${value === count
              ? 'bg-primary text-on-primary'
              : 'text-on-surface-variant hover:bg-surface-container-high'
            }
          `}
        >
          Top {count}
        </button>
      ))}
    </div>
  );
}

// ── Scale Type Picker ────────────────────────────────────────────────────────

function ScaleTypePicker({
  xScale,
  yScale,
  onXChange,
  onYChange,
}: {
  xScale: ScaleType;
  yScale: ScaleType;
  onXChange: (type: ScaleType) => void;
  onYChange: (type: ScaleType) => void;
}) {
  const SCALE_OPTIONS = ['auto', 'linear', 'log'] as const;
  const scaleLabel = (t: ScaleType) => t === 'auto' ? 'Auto' : t === 'linear' ? 'Lin' : 'Log';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-on-surface-variant">X Axis</span>
        <div className="flex gap-0.5">
          {SCALE_OPTIONS.map((t) => (
            <button
              key={`x-${t}`}
              onClick={() => onXChange(t)}
              className={`
                px-2 py-0.5 rounded-md text-[10px] font-medium transition-all duration-150
                ${xScale === t
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
                }
              `}
            >
              {scaleLabel(t)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-on-surface-variant">Y Axis</span>
        <div className="flex gap-0.5">
          {SCALE_OPTIONS.map((t) => (
            <button
              key={`y-${t}`}
              onClick={() => onYChange(t)}
              className={`
                px-2 py-0.5 rounded-md text-[10px] font-medium transition-all duration-150
                ${yScale === t
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
                }
              `}
            >
              {scaleLabel(t)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
