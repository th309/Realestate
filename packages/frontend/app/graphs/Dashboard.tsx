'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { GeoLevel } from './types';
import { DESCRIPTIONS } from './constants';
import { getInsights } from './services/geminiService';
import { useDashboardState } from './hooks/useDashboardState';
import { useChartData } from './hooks/useChartData';
import { FilterHeader } from './components/FilterHeader';
import { InsightsPanel } from './components/InsightsPanel';
import { ChartSection } from './components/ChartSection';
import { DataFooter } from './components/DataFooter';

export const Dashboard: React.FC = () => {
  const {
    geoLevel,
    setGeoLevel,
    selectedArea,
    setSelectedArea,
    metric,
    setMetric,
    timeFrame,
    setTimeFrame,
    chartType,
    setChartType,
    aiInsight,
    setAiInsight,
    isInsightLoading,
    setIsInsightLoading,
    isDataLoading,
    comparison,
    setComparison,
    baseline,
    setBaseline,
    showMilestones,
    setShowMilestones,
    showForecast,
    setShowForecast,
    visibleSeries,
    toggleSeries,
    primaryOptions,
    baselineOptions,
  } = useDashboardState();

  const chartData = useChartData({
    timeFrame,
    selectedArea,
    comparison,
    baseline,
    showForecast,
  });

  const handleFetchInsights = async () => {
    setIsInsightLoading(true);
    const primaryData = chartData.map((d) => ({
      year: d.year,
      value: d[selectedArea] as number,
    }));
    const result = await getInsights(
      selectedArea,
      metric,
      primaryData,
      comparison.enabled ? comparison.area : undefined
    );
    setAiInsight(result);
    setIsInsightLoading(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-2 md:px-8 py-4 md:py-6">
      <div className="bg-[#f7faf7] rounded-[24px] md:rounded-[32px] shadow-[0_8px_32px_-4px_rgba(0,0,0,0.08)] overflow-hidden border border-[#dee5dd]">
        <FilterHeader
          geoLevel={geoLevel}
          setGeoLevel={setGeoLevel}
          selectedArea={selectedArea}
          setSelectedArea={setSelectedArea}
          metric={metric}
          setMetric={setMetric}
          primaryOptions={primaryOptions}
          comparison={comparison}
          setComparison={setComparison}
          baseline={baseline}
          setBaseline={setBaseline}
          baselineOptions={baselineOptions}
          showMilestones={showMilestones}
          setShowMilestones={setShowMilestones}
          showForecast={showForecast}
          setShowForecast={setShowForecast}
          visibleSeries={visibleSeries}
          toggleSeries={toggleSeries}
        />

        <div className="p-4 md:p-10 relative">
          {isDataLoading && (
            <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] z-20 flex items-center justify-center rounded-3xl">
              <Loader2 className="w-12 h-12 text-[#006d3d] animate-spin" />
            </div>
          )}

          <div className="max-w-4xl mb-6 md:mb-10">
            <h1 className="text-2xl md:text-4xl font-black tracking-tight text-[#1a1c1a] mb-2 md:mb-3 flex flex-wrap items-center gap-2 md:gap-3">
              {selectedArea}
              {comparison.enabled && (
                <>
                  <span className="text-[#717971] font-normal text-lg md:text-2xl px-1">
                    vs
                  </span>
                  <span className="text-[#006a6a]">{comparison.area}</span>
                </>
              )}
              <span className="hidden md:inline text-[#dee5dd] mx-2">|</span>
              <span className="w-full md:w-auto text-[#006d3d]">{metric}</span>
            </h1>
            <p className="text-[#414941] text-sm md:text-lg leading-relaxed max-w-2xl opacity-90">
              {DESCRIPTIONS[metric]}
            </p>
          </div>

          <InsightsPanel
            aiInsight={aiInsight}
            isInsightLoading={isInsightLoading}
            onFetchInsights={handleFetchInsights}
          />

          <ChartSection
            chartData={chartData}
            selectedArea={selectedArea}
            comparison={comparison}
            baseline={baseline}
            metric={metric}
            timeFrame={timeFrame}
            setTimeFrame={setTimeFrame}
            chartType={chartType}
            setChartType={setChartType}
            showMilestones={showMilestones}
            visibleSeries={visibleSeries}
          />

          <DataFooter metric={metric} />
        </div>
      </div>
    </div>
  );
};
