'use client';

import React from 'react';
import { Loader2, TrendingUp } from 'lucide-react';
import { getMetricDescription } from './constants';
import { getMetricTitle } from '@/lib/data';
import { getInsights } from './services/geminiService';
import { useDashboardState } from './hooks/useDashboardState';
import { useChartData } from './hooks/useChartData';
import { FilterHeader } from './components/FilterHeader';
import { InsightsPanel } from './components/InsightsPanel';
import { ChartSection } from './components/ChartSection';
import { ScoreCards } from './components/ScoreCards';

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
    selectedAreaId,
    setSelectedAreaId,
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
    metricOptions,
  } = useDashboardState();

  const { data: chartData, loading: chartLoading, error: chartError } = useChartData({
    metric,
    geoLevel,
    timeFrame,
    selectedArea: selectedAreaId,
    comparison,
    baseline,
    showForecast,
  });

  const handleFetchInsights = async () => {
    setIsInsightLoading(true);
    const primaryData = chartData.map((d) => ({
      year: new Date(d.date).getFullYear(), // Parse year from date string
      value: d[selectedAreaId] as number, // Use the ID for lookup in chartData keys
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

  const metricDisplayName = getMetricTitle(metric);

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
        {/* Loading Overlay */}
        {(isDataLoading || chartLoading) && (
          <div className="fixed inset-0 bg-surface/60 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-surface-container-high rounded-[28px] elevation-3 p-6 flex items-center gap-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <span className="text-on-surface font-medium">Loading data...</span>
            </div>
          </div>
        )}

        {/* Page Header */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-2">
            <div>
              <div className="flex items-center gap-2 text-primary mb-1">
                <TrendingUp className="w-5 h-5" />
                <span className="text-xs font-medium uppercase tracking-wider">Market Analytics</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-medium text-on-surface tracking-tight">
                {selectedArea}
                {comparison.enabled && (
                  <span className="text-on-surface-variant font-normal mx-2">vs</span>
                )}
                {comparison.enabled && (
                  <span className="text-secondary">{comparison.area}</span>
                )}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-on-surface-variant">Analyzing</span>
              <span className="bg-primary text-on-primary px-4 py-1.5 rounded-full text-sm font-medium">
                {metricDisplayName}
              </span>
            </div>
          </div>
          <p className="text-on-surface-variant text-sm md:text-base max-w-3xl">
            {getMetricDescription(metric)}
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="space-y-6">
          {/* Filter Cards Row */}
          <FilterHeader
            geoLevel={geoLevel}
            setGeoLevel={setGeoLevel}
            selectedArea={selectedArea}
            setSelectedArea={setSelectedArea}
            selectedAreaId={selectedAreaId}
            setSelectedAreaId={setSelectedAreaId}
            metric={metric}
            setMetric={setMetric}
            metricOptions={metricOptions}
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

          {/* Chart error message */}
          {chartError && (
            <div className="rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-on-surface-variant text-sm">
              Could not load data for this selection. Try a different location, metric, or time range.
            </div>
          )}

          {/* Two Column Layout: Chart + Insights */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Chart Card - Takes 2 columns on xl */}
            <div className="xl:col-span-2">
              <ChartSection
                chartData={chartData}
                selectedArea={selectedArea}
                selectedAreaId={selectedAreaId}
                comparison={comparison}
                baseline={baseline}
                metric={metric}
                timeFrame={timeFrame}
                setTimeFrame={setTimeFrame}
                chartType={chartType}
                setChartType={setChartType}
                showMilestones={showMilestones}
                setShowMilestones={setShowMilestones}
                showForecast={showForecast}
                setShowForecast={setShowForecast}
                visibleSeries={visibleSeries}
                toggleSeries={toggleSeries}
              />
            </div>

            {/* Right Column: Score Cards + Insights Panel - Takes 1 column on xl */}
            <div className="xl:col-span-1 flex flex-col gap-4">
              <ScoreCards geoLevel={geoLevel} selectedArea={selectedAreaId} isAdmin={true} />
              <InsightsPanel
                aiInsight={aiInsight}
                isInsightLoading={isInsightLoading}
                onFetchInsights={handleFetchInsights}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
