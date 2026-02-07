'use client';

import React, { useState } from 'react';
import { Loader2, TrendingUp, LineChart, Sparkles } from 'lucide-react';
import { Breadcrumbs } from '@/components/navigation';
import { getMetricDescription } from './constants';
import { getMetricTitle } from '@/lib/data';
import { getInsights } from './services/geminiService';
import { useDashboardState } from './hooks/useDashboardState';
import { useChartData } from './hooks/useChartData';
import { FilterHeader } from './components/FilterHeader';
import { InsightsPanel } from './components/InsightsPanel';
import { ChartSection } from './components/ChartSection';
import { ScoreCards } from './components/ScoreCards';
import { D3VisualizationSection } from './components/D3VisualizationSection';
import { ScoreVisualization } from './components/ScoreVisualization';
import { EntitlementGate, InsightsPaywall } from '@/components/entitlements';

type VisualizationMode = 'timeSeries' | 'advanced';

export const Dashboard: React.FC = () => {
  const [visualizationMode, setVisualizationMode] = useState<VisualizationMode>('timeSeries');

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

  const { data: chartData, loading: chartLoading, error: chartError, isScore } = useChartData({
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

        {/* Breadcrumbs */}
        <Breadcrumbs items={[{ label: 'Analytics' }]} className="mb-4" />

        {/* Page Header */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-2">
            <div>
              <div className="flex items-center gap-2 text-primary mb-1">
                <TrendingUp className="w-5 h-5" />
                <span className="text-xs font-medium uppercase tracking-wider">Market Analytics</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-medium text-on-surface tracking-tight">
                {selectedArea || 'Select a Location'}
                {comparison.enabled && (
                  <span className="text-on-surface-variant font-normal mx-2">vs</span>
                )}
                {comparison.enabled && (
                  <span className="text-secondary">{comparison.area}</span>
                )}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              {/* Visualization Mode Toggle */}
              <div className="flex items-center bg-surface-container p-1 rounded-xl">
                <button
                  onClick={() => setVisualizationMode('timeSeries')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    visualizationMode === 'timeSeries'
                      ? 'bg-primary text-on-primary elevation-1'
                      : 'text-on-surface-variant hover:text-primary'
                  }`}
                >
                  <LineChart className="w-4 h-4" />
                  <span className="hidden sm:inline">Time Series</span>
                </button>
                <button
                  onClick={() => setVisualizationMode('advanced')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    visualizationMode === 'advanced'
                      ? 'bg-primary text-on-primary elevation-1'
                      : 'text-on-surface-variant hover:text-primary'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span className="hidden sm:inline">Advanced</span>
                </button>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-on-surface-variant hidden sm:inline">Analyzing</span>
                <span className="bg-primary text-on-primary px-4 py-1.5 rounded-full text-sm font-medium">
                  {metricDisplayName}
                </span>
              </div>
            </div>
          </div>
          <p className="text-on-surface-variant text-sm md:text-base max-w-3xl">
            {visualizationMode === 'timeSeries'
              ? getMetricDescription(metric)
              : 'Explore advanced visualizations including scatter plots, distributions, treemaps, heatmaps, and correlation analysis.'}
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="space-y-6">
          {/* Filter Cards Row - Only show for time series mode */}
          {visualizationMode === 'timeSeries' && (
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
          )}

          {/* Chart error message - Only show for time series mode */}
          {visualizationMode === 'timeSeries' && chartError && (
            <div className="rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-on-surface-variant text-sm">
              Could not load data for this selection. Try a different location, metric, or time range.
            </div>
          )}

          {/* Time Series Mode: Two Column Layout */}
          {visualizationMode === 'timeSeries' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Chart Card - Takes 2 columns on xl */}
              <div className="xl:col-span-2">
                {isScore ? (
                  /* Score metrics get specialized visualization */
                  <ScoreVisualization
                    scoreType={metric as 'homeready_score' | 'investoredge_score' | 'market_health_score'}
                    geoLevel={geoLevel}
                    selectedArea={selectedArea}
                    selectedAreaId={selectedAreaId}
                  />
                ) : (
                  /* Regular time series chart */
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
                )}
              </div>

              {/* Right Column: Score Cards + Insights Panel - Takes 1 column on xl */}
              <div className="xl:col-span-1 flex flex-col gap-4">
                <ScoreCards geoLevel={geoLevel} selectedArea={selectedAreaId} isAdmin={true} />
                <EntitlementGate
                  type="feature"
                  id="ai_insights"
                  fallback={<InsightsPaywall compact />}
                >
                  <InsightsPanel
                    aiInsight={aiInsight}
                    isInsightLoading={isInsightLoading}
                    onFetchInsights={handleFetchInsights}
                  />
                </EntitlementGate>
              </div>
            </div>
          )}

          {/* Advanced Mode: D3 Visualizations */}
          {visualizationMode === 'advanced' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* D3 Visualization Section - Takes 2 columns on xl */}
              <div className="xl:col-span-2">
                <D3VisualizationSection
                  geoLevel={geoLevel}
                  selectedArea={selectedArea}
                  onFocusGeography={(geoId, geoName) => {
                    setSelectedAreaId(geoId);
                    setSelectedArea(geoName);
                    // Switch to time series mode to show the focused geography's data
                    setVisualizationMode('timeSeries');
                  }}
                />
              </div>

              {/* Right Column: Score Cards + Insights Panel - Takes 1 column on xl */}
              <div className="xl:col-span-1 flex flex-col gap-4">
                <ScoreCards geoLevel={geoLevel} selectedArea={selectedAreaId} isAdmin={true} />
                <EntitlementGate
                  type="feature"
                  id="ai_insights"
                  fallback={<InsightsPaywall compact />}
                >
                  <InsightsPanel
                    aiInsight={aiInsight}
                    isInsightLoading={isInsightLoading}
                    onFetchInsights={handleFetchInsights}
                  />
                </EntitlementGate>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
