'use client';

import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  ScatterChart,
  BarChart3,
  Grid3x3,
  LayoutGrid,
  GitCompare,
  Settings2,
  Info,
} from 'lucide-react';
import {
  ScatterPlot,
  BoxPlot,
  Treemap,
  Heatmap,
  CorrelationMatrix,
} from '@/lib/visualizations/d3';
import { M3Card } from './M3Card';
import {
  generateSampleScatterData,
  generateSampleBoxPlotData,
  generateSampleHeatmapData,
  generateSampleTreemapData,
  generateSampleCorrelationData,
} from '../hooks/useMultiMetricData';

type D3VisualizationType = 'scatter' | 'boxplot' | 'treemap' | 'heatmap' | 'correlation';

interface D3VisualizationSectionProps {
  geoLevel: string;
  selectedArea?: string;
  className?: string;
}

const visualizationTypes = [
  {
    type: 'scatter' as D3VisualizationType,
    icon: ScatterChart,
    label: 'Scatter Plot',
    description: 'Compare two metrics across regions',
  },
  {
    type: 'boxplot' as D3VisualizationType,
    icon: BarChart3,
    label: 'Distribution',
    description: 'View statistical distribution',
  },
  {
    type: 'treemap' as D3VisualizationType,
    icon: LayoutGrid,
    label: 'Treemap',
    description: 'Market composition breakdown',
  },
  {
    type: 'heatmap' as D3VisualizationType,
    icon: Grid3x3,
    label: 'Heatmap',
    description: 'Metric patterns over time',
  },
  {
    type: 'correlation' as D3VisualizationType,
    icon: GitCompare,
    label: 'Correlation',
    description: 'Metric relationships',
  },
];

export const D3VisualizationSection: React.FC<D3VisualizationSectionProps> = ({
  geoLevel,
  selectedArea,
  className = '',
}) => {
  const [visualizationType, setVisualizationType] = useState<D3VisualizationType>('scatter');
  const [showSettings, setShowSettings] = useState(false);

  // Settings for each visualization type
  const [scatterSettings, setScatterSettings] = useState({
    showRegression: true,
    showQuadrants: true,
    colorByCategory: true,
  });

  const [boxPlotSettings, setBoxPlotSettings] = useState({
    showOutliers: true,
    horizontal: false,
  });

  const [treemapSettings, setTreemapSettings] = useState({
    colorBy: 'colorValue' as 'value' | 'colorValue',
  });

  const [heatmapSettings, setHeatmapSettings] = useState({
    colorScheme: 'purple' as 'purple' | 'bluePurple' | 'warm' | 'cool',
    showValues: true,
  });

  const [correlationSettings, setCorrelationSettings] = useState({
    colorScale: 'diverging' as 'diverging' | 'absolute',
    showValues: true,
  });

  // Generate sample data (in production, this would come from useMultiMetricData)
  const scatterData = useMemo(() => generateSampleScatterData(30), []);
  const boxPlotData = useMemo(() => generateSampleBoxPlotData(), []);
  const heatmapData = useMemo(() => generateSampleHeatmapData(), []);
  const treemapData = useMemo(() => generateSampleTreemapData(), []);
  const correlationData = useMemo(() => generateSampleCorrelationData(), []);

  const renderVisualization = () => {
    switch (visualizationType) {
      case 'scatter':
        return (
          <ScatterPlot
            data={scatterData}
            xLabel="Median Home Price ($)"
            yLabel="Year-over-Year Appreciation (%)"
            xFormat="currency"
            yFormat="percent"
            showRegression={scatterSettings.showRegression}
            showQuadrants={scatterSettings.showQuadrants}
            colorByCategory={scatterSettings.colorByCategory}
            height={500}
            onPointClick={(point) => console.log('Clicked:', point)}
          />
        );
      case 'boxplot':
        return (
          <BoxPlot
            data={boxPlotData}
            yLabel="Median Home Price ($)"
            yFormat="currency"
            showOutliers={boxPlotSettings.showOutliers}
            horizontal={boxPlotSettings.horizontal}
            height={500}
          />
        );
      case 'treemap':
        return (
          <Treemap
            data={treemapData}
            colorBy={treemapSettings.colorBy}
            valueFormat="number"
            colorFormat="percent"
            height={500}
            onNodeClick={(node, path) => console.log('Clicked:', node, path)}
          />
        );
      case 'heatmap':
        return (
          <Heatmap
            data={heatmapData}
            xLabel="Month"
            yLabel="Metro Area"
            colorScheme={heatmapSettings.colorScheme}
            showValues={heatmapSettings.showValues}
            valueFormat="number"
            height={400}
            onCellClick={(cell) => console.log('Clicked:', cell)}
          />
        );
      case 'correlation':
        return (
          <CorrelationMatrix
            data={correlationData}
            colorScale={correlationSettings.colorScale}
            showValues={correlationSettings.showValues}
            height={450}
            onCellClick={(m1, m2, corr) => console.log('Correlation:', m1, m2, corr)}
          />
        );
      default:
        return null;
    }
  };

  const renderSettings = () => {
    switch (visualizationType) {
      case 'scatter':
        return (
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={scatterSettings.showRegression}
                onChange={(e) =>
                  setScatterSettings((s) => ({ ...s, showRegression: e.target.checked }))
                }
                className="rounded border-outline text-primary focus:ring-primary"
              />
              <span className="text-sm text-on-surface">Show regression line</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={scatterSettings.showQuadrants}
                onChange={(e) =>
                  setScatterSettings((s) => ({ ...s, showQuadrants: e.target.checked }))
                }
                className="rounded border-outline text-primary focus:ring-primary"
              />
              <span className="text-sm text-on-surface">Show quadrant labels</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={scatterSettings.colorByCategory}
                onChange={(e) =>
                  setScatterSettings((s) => ({ ...s, colorByCategory: e.target.checked }))
                }
                className="rounded border-outline text-primary focus:ring-primary"
              />
              <span className="text-sm text-on-surface">Color by category</span>
            </label>
          </div>
        );
      case 'boxplot':
        return (
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={boxPlotSettings.showOutliers}
                onChange={(e) =>
                  setBoxPlotSettings((s) => ({ ...s, showOutliers: e.target.checked }))
                }
                className="rounded border-outline text-primary focus:ring-primary"
              />
              <span className="text-sm text-on-surface">Show outliers</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={boxPlotSettings.horizontal}
                onChange={(e) =>
                  setBoxPlotSettings((s) => ({ ...s, horizontal: e.target.checked }))
                }
                className="rounded border-outline text-primary focus:ring-primary"
              />
              <span className="text-sm text-on-surface">Horizontal orientation</span>
            </label>
          </div>
        );
      case 'treemap':
        return (
          <div className="space-y-3">
            <div>
              <label className="text-sm text-on-surface-variant mb-1 block">Color by</label>
              <select
                value={treemapSettings.colorBy}
                onChange={(e) =>
                  setTreemapSettings((s) => ({
                    ...s,
                    colorBy: e.target.value as 'value' | 'colorValue',
                  }))
                }
                className="w-full px-3 py-2 rounded-lg border border-outline bg-surface text-on-surface text-sm focus:ring-2 focus:ring-primary"
              >
                <option value="value">Size (Value)</option>
                <option value="colorValue">Performance (Change)</option>
              </select>
            </div>
          </div>
        );
      case 'heatmap':
        return (
          <div className="space-y-3">
            <div>
              <label className="text-sm text-on-surface-variant mb-1 block">Color scheme</label>
              <select
                value={heatmapSettings.colorScheme}
                onChange={(e) =>
                  setHeatmapSettings((s) => ({
                    ...s,
                    colorScheme: e.target.value as typeof heatmapSettings.colorScheme,
                  }))
                }
                className="w-full px-3 py-2 rounded-lg border border-outline bg-surface text-on-surface text-sm focus:ring-2 focus:ring-primary"
              >
                <option value="purple">Purple</option>
                <option value="bluePurple">Blue-Purple</option>
                <option value="warm">Warm</option>
                <option value="cool">Cool</option>
              </select>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={heatmapSettings.showValues}
                onChange={(e) =>
                  setHeatmapSettings((s) => ({ ...s, showValues: e.target.checked }))
                }
                className="rounded border-outline text-primary focus:ring-primary"
              />
              <span className="text-sm text-on-surface">Show values</span>
            </label>
          </div>
        );
      case 'correlation':
        return (
          <div className="space-y-3">
            <div>
              <label className="text-sm text-on-surface-variant mb-1 block">Color scale</label>
              <select
                value={correlationSettings.colorScale}
                onChange={(e) =>
                  setCorrelationSettings((s) => ({
                    ...s,
                    colorScale: e.target.value as 'diverging' | 'absolute',
                  }))
                }
                className="w-full px-3 py-2 rounded-lg border border-outline bg-surface text-on-surface text-sm focus:ring-2 focus:ring-primary"
              >
                <option value="diverging">Diverging (Red-Blue)</option>
                <option value="absolute">Absolute (Blue)</option>
              </select>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={correlationSettings.showValues}
                onChange={(e) =>
                  setCorrelationSettings((s) => ({ ...s, showValues: e.target.checked }))
                }
                className="rounded border-outline text-primary focus:ring-primary"
              />
              <span className="text-sm text-on-surface">Show correlation values</span>
            </label>
          </div>
        );
      default:
        return null;
    }
  };

  const currentVizInfo = visualizationTypes.find((v) => v.type === visualizationType);

  return (
    <M3Card variant="elevated" size="lg" className={`overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-medium text-on-surface">Advanced Analysis</h3>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-2 rounded-lg transition-colors ${
            showSettings
              ? 'bg-primary-container text-on-primary-container'
              : 'text-on-surface-variant hover:bg-surface-container'
          }`}
          title="Visualization settings"
        >
          <Settings2 className="w-5 h-5" />
        </button>
      </div>

      {/* Visualization Type Selector */}
      <div className="flex flex-wrap gap-2 mb-4">
        {visualizationTypes.map(({ type, icon: Icon, label }) => (
          <button
            key={type}
            onClick={() => setVisualizationType(type)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              visualizationType === type
                ? 'bg-primary text-on-primary elevation-1'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Info Banner */}
      {currentVizInfo && (
        <div className="flex items-center gap-2 px-3 py-2 mb-4 rounded-xl bg-surface-container-low border border-outline-variant">
          <Info className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm text-on-surface-variant">{currentVizInfo.description}</span>
        </div>
      )}

      {/* Settings Panel (collapsible) */}
      {showSettings && (
        <div className="mb-4 p-4 rounded-xl bg-surface-container border border-outline-variant">
          <h4 className="text-sm font-medium text-on-surface mb-3">
            {currentVizInfo?.label} Settings
          </h4>
          {renderSettings()}
        </div>
      )}

      {/* Visualization Container */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-4">
        {renderVisualization()}
      </div>

      {/* Data Source */}
      <div className="text-[10px] text-on-surface-variant text-center mt-2">
        Sample data for demonstration • Real data available in production
      </div>
    </M3Card>
  );
};

export default D3VisualizationSection;
