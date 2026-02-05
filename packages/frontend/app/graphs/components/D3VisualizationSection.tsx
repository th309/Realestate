'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Sparkles,
  ScatterChart,
  BarChart3,
  Grid3x3,
  LayoutGrid,
  GitCompare,
  Settings2,
  Info,
  Loader2,
  AlertCircle,
  X,
  MapPin,
  TrendingUp,
  DollarSign,
  Home,
  Target,
} from 'lucide-react';
import {
  ScatterPlot,
  BoxPlot,
  Treemap,
  Heatmap,
  CorrelationMatrix,
} from '@/lib/visualizations/d3';
import { M3Card } from './M3Card';
import { fetchSnapshotData, getMetricTitle, getMetricFormat, METRICS, type GeoLevel } from '@/lib/data';
import { isMetricAvailableForGeo } from '@/app/map/config/metric-availability';
import type { ScatterDataPoint, BoxPlotDataPoint, HeatmapDataPoint, TreemapNode, CorrelationMetric } from '../hooks/useMultiMetricData';

type D3VisualizationType = 'scatter' | 'boxplot' | 'treemap' | 'heatmap' | 'correlation';

interface D3VisualizationSectionProps {
  geoLevel: GeoLevel;
  selectedArea?: string;
  className?: string;
  onFocusGeography?: (geoId: string, geoName: string) => void;
}

const visualizationTypes = [
  {
    type: 'scatter' as D3VisualizationType,
    icon: ScatterChart,
    label: 'Scatter Plot',
    description: 'Compare two metrics across all regions',
  },
  {
    type: 'boxplot' as D3VisualizationType,
    icon: BarChart3,
    label: 'Distribution',
    description: 'View statistical distribution of a metric',
  },
  {
    type: 'treemap' as D3VisualizationType,
    icon: LayoutGrid,
    label: 'Treemap',
    description: 'Market composition by size and performance',
  },
  {
    type: 'heatmap' as D3VisualizationType,
    icon: Grid3x3,
    label: 'Heatmap',
    description: 'Compare multiple metrics across regions',
  },
  {
    type: 'correlation' as D3VisualizationType,
    icon: GitCompare,
    label: 'Correlation',
    description: 'Discover relationships between metrics',
  },
];

// Layman's terms explanations for each visualization
const VISUALIZATION_INSIGHTS: Record<D3VisualizationType, {
  whatItShows: string;
  howToRead: string;
  lookFor: string[];
}> = {
  scatter: {
    whatItShows: 'Each bubble represents a geographic area. The position shows how it performs on two different metrics at once.',
    howToRead: 'Bubbles in the upper-right corner are high on both metrics. Bubble size shows a third metric, and color shows market category.',
    lookFor: [
      'Clusters of similar markets',
      'Outliers that stand out from the crowd',
      'The trend line shows if the two metrics move together',
    ],
  },
  boxplot: {
    whatItShows: 'Shows how values are spread out across all areas. The box shows where most values fall, and dots are unusual outliers.',
    howToRead: 'The middle line is the median (typical value). The box covers the middle 50% of all areas. Whiskers show the range.',
    lookFor: [
      'Wide boxes mean high variation between areas',
      'Outlier dots are areas performing very differently',
      'Compare boxes to see which groups perform better',
    ],
  },
  treemap: {
    whatItShows: 'Each rectangle is a market. Bigger rectangles have higher values for the size metric. Color intensity shows the color metric.',
    howToRead: 'Area size = one metric value, Color darkness = another metric value. Click rectangles to explore.',
    lookFor: [
      'Large dark boxes = high on both metrics',
      'Large light boxes = big market, lower on color metric',
      'Small dark boxes = smaller market outperforming on color metric',
    ],
  },
  heatmap: {
    whatItShows: 'A grid comparing multiple metrics across many areas at once. Each row is an area, each column is a metric.',
    howToRead: 'Darker purple = higher relative value for that metric. Colors are normalized per column so you can compare across different metric types.',
    lookFor: [
      'Rows with many dark cells = areas strong across multiple metrics',
      'Columns with variation = metrics where areas differ most',
      'Patterns of dark/light help identify market types',
    ],
  },
  correlation: {
    whatItShows: 'Shows how strongly different metrics move together. Blue means they rise together, red means one rises when the other falls.',
    howToRead: 'Numbers from -1 to +1. Near +1 (dark blue) = strong positive relationship. Near -1 (dark red) = strong negative relationship. Near 0 = no relationship.',
    lookFor: [
      'Strong positive (blue): When one goes up, so does the other',
      'Strong negative (red): When one goes up, the other goes down',
      'Use this to understand which metrics predict others',
    ],
  },
};

// Build metrics list dynamically from the registry
// For percent metrics with asPercent: true, the fetcher already multiplied by 100,
// so we use 'percentAbs' (just adds %) instead of 'percent' (which would multiply by 100 again)
const ALL_METRICS = Object.entries(METRICS).map(([id, config]) => ({
  id,
  label: config.title,
  format: (config.format === 'currency' ? 'currency' :
           config.format === 'percent' ? (config.asPercent ? 'percentAbs' : 'percent') :
           'number') as 'currency' | 'percent' | 'percentAbs' | 'number',
})).sort((a, b) => a.label.localeCompare(b.label));

// Categories for bubble colors - thresholds for common metrics
const CATEGORY_THRESHOLDS: Record<string, { max: number; label: string; color: string }[]> = {
  'market_heat': [
    { max: 40, label: 'Cold Market', color: '#3b82f6' },
    { max: 60, label: 'Balanced', color: '#a855f7' },
    { max: Infinity, label: 'Hot Market', color: '#f97316' },
  ],
  'home_value_yoy': [
    { max: 0, label: 'Declining', color: '#ef4444' },
    { max: 5, label: 'Stable', color: '#a855f7' },
    { max: Infinity, label: 'Growing', color: '#22c55e' },
  ],
  'home_value_mom': [
    { max: -0.5, label: 'Declining', color: '#ef4444' },
    { max: 0.5, label: 'Stable', color: '#a855f7' },
    { max: Infinity, label: 'Growing', color: '#22c55e' },
  ],
  'cap_rate': [
    { max: 4, label: 'Low Yield', color: '#3b82f6' },
    { max: 6, label: 'Moderate', color: '#a855f7' },
    { max: Infinity, label: 'High Yield', color: '#22c55e' },
  ],
  'gross_yield': [
    { max: 5, label: 'Low Yield', color: '#3b82f6' },
    { max: 8, label: 'Moderate', color: '#a855f7' },
    { max: Infinity, label: 'High Yield', color: '#22c55e' },
  ],
  'days_on_market': [
    { max: 30, label: 'Fast Moving', color: '#f97316' },
    { max: 60, label: 'Moderate', color: '#a855f7' },
    { max: Infinity, label: 'Slow Market', color: '#3b82f6' },
  ],
  'inventory_yoy': [
    { max: -10, label: 'Shrinking', color: '#f97316' },
    { max: 10, label: 'Stable', color: '#a855f7' },
    { max: Infinity, label: 'Growing', color: '#3b82f6' },
  ],
  'price_cut_pct': [
    { max: 10, label: 'Few Cuts', color: '#22c55e' },
    { max: 20, label: 'Moderate', color: '#a855f7' },
    { max: Infinity, label: 'Many Cuts', color: '#ef4444' },
  ],
  'homeready_score': [
    { max: 40, label: 'Poor', color: '#ef4444' },
    { max: 60, label: 'Average', color: '#a855f7' },
    { max: Infinity, label: 'Good', color: '#22c55e' },
  ],
  'investoredge_score': [
    { max: 40, label: 'Poor', color: '#ef4444' },
    { max: 60, label: 'Average', color: '#a855f7' },
    { max: Infinity, label: 'Good', color: '#22c55e' },
  ],
  'market_health_score': [
    { max: 40, label: 'Weak', color: '#ef4444' },
    { max: 60, label: 'Average', color: '#a855f7' },
    { max: Infinity, label: 'Strong', color: '#22c55e' },
  ],
  'hotness_score': [
    { max: 33, label: 'Cold Market', color: '#3b82f6' },
    { max: 66, label: 'Balanced', color: '#a855f7' },
    { max: Infinity, label: 'Hot Market', color: '#f97316' },
  ],
  'demand_score': [
    { max: 33, label: 'Low Demand', color: '#3b82f6' },
    { max: 66, label: 'Moderate', color: '#a855f7' },
    { max: Infinity, label: 'High Demand', color: '#f97316' },
  ],
  'supply_score': [
    { max: 33, label: 'Low Supply', color: '#f97316' },
    { max: 66, label: 'Balanced', color: '#a855f7' },
    { max: Infinity, label: 'High Supply', color: '#3b82f6' },
  ],
};

interface MetricData {
  [regionId: string]: { value: number; name?: string; displayName?: string };
}

export const D3VisualizationSection: React.FC<D3VisualizationSectionProps> = ({
  geoLevel,
  selectedArea,
  className = '',
  onFocusGeography,
}) => {
  const [visualizationType, setVisualizationType] = useState<D3VisualizationType>('scatter');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<ScatterDataPoint | null>(null);
  const [showInsight, setShowInsight] = useState(true); // Default to showing insight

  // Filter metrics based on what's available at the current geo level
  const availableMetrics = useMemo(() => {
    return ALL_METRICS.filter(m => isMetricAvailableForGeo(m.id, geoLevel));
  }, [geoLevel]);

  // Metric selections - use first available metric as defaults
  const [xMetric, setXMetric] = useState('home_value');
  const [yMetric, setYMetric] = useState('home_value_yoy');
  const [sizeMetric, setSizeMetric] = useState('for_sale_inventory');
  const [colorMetric, setColorMetric] = useState('market_heat');
  const [distributionMetric, setDistributionMetric] = useState('home_value');

  // Multi-select for heatmap and correlation
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);

  // Update metric selections when geoLevel changes (if current selection becomes unavailable)
  useEffect(() => {
    const availableIds = availableMetrics.map(m => m.id);

    // Update single selectors if their current value is not available
    if (!availableIds.includes(xMetric) && availableIds.length > 0) {
      setXMetric(availableIds[0]);
    }
    if (!availableIds.includes(yMetric) && availableIds.length > 1) {
      setYMetric(availableIds[1] || availableIds[0]);
    }
    if (!availableIds.includes(sizeMetric) && availableIds.length > 2) {
      setSizeMetric(availableIds[2] || availableIds[0]);
    }
    if (!availableIds.includes(colorMetric) && availableIds.length > 3) {
      setColorMetric(availableIds[3] || availableIds[0]);
    }
    if (!availableIds.includes(distributionMetric) && availableIds.length > 0) {
      setDistributionMetric(availableIds[0]);
    }

    // Update multi-select to only include available metrics
    setSelectedMetrics(prev => {
      const filtered = prev.filter(id => availableIds.includes(id));
      // If we have less than 2, select first 6 available
      if (filtered.length < 2) {
        return availableIds.slice(0, Math.min(6, availableIds.length));
      }
      return filtered;
    });

    // Clear the cache when geo level changes
    setMetricDataCache({});
  }, [geoLevel, availableMetrics]);

  // Data state
  const [metricDataCache, setMetricDataCache] = useState<Record<string, MetricData>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    regionLimit: 50 as number | 'all',
  });

  const [correlationSettings, setCorrelationSettings] = useState({
    colorScale: 'diverging' as 'diverging' | 'absolute',
    showValues: true,
  });

  // Key metrics to always load for the popup detail view
  const POPUP_KEY_METRICS = ['home_value', 'home_value_yoy', 'median_rent', 'cap_rate', 'market_heat', 'for_sale_inventory'];

  // Determine which metrics we need based on visualization type
  const requiredMetrics = useMemo(() => {
    // For scatter plots, also include popup key metrics
    const popupMetrics = visualizationType === 'scatter'
      ? POPUP_KEY_METRICS.filter(m => isMetricAvailableForGeo(m, geoLevel))
      : [];

    switch (visualizationType) {
      case 'scatter':
        return [...new Set([xMetric, yMetric, sizeMetric, colorMetric, ...popupMetrics].filter(Boolean))];
      case 'boxplot':
        return [distributionMetric, colorMetric];
      case 'treemap':
        return [xMetric, yMetric]; // size and color
      case 'heatmap':
      case 'correlation':
        return selectedMetrics;
      default:
        return [];
    }
  }, [visualizationType, xMetric, yMetric, sizeMetric, colorMetric, distributionMetric, selectedMetrics, geoLevel]);

  // Fetch data for required metrics
  useEffect(() => {
    if (geoLevel === 'national') return;

    const metricsToFetch = requiredMetrics.filter(m => !metricDataCache[m]);
    if (metricsToFetch.length === 0) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    async function fetchData() {
      try {
        const results: Record<string, MetricData> = {};

        for (const metricId of metricsToFetch) {
          const data = await fetchSnapshotData(metricId, geoLevel);
          const transformed: MetricData = {};

          Object.entries(data).forEach(([key, entry]) => {
            if (entry && typeof entry === 'object' && 'value' in entry && entry.value != null) {
              // Use the human-readable name from API, fallback to key
              const displayName = (entry as any).name || key;
              transformed[key] = { value: entry.value as number, name: key, displayName };
            }
          });

          results[metricId] = transformed;
        }

        if (isMounted) {
          setMetricDataCache(prev => ({ ...prev, ...results }));
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch metric data:', err);
        if (isMounted) {
          setError('Failed to load data. Try a different geography level.');
          setLoading(false);
        }
      }
    }

    fetchData();
    return () => { isMounted = false; };
  }, [geoLevel, requiredMetrics, metricDataCache]);

  // Transform data for scatter plot
  const scatterData = useMemo((): ScatterDataPoint[] => {
    const xData = metricDataCache[xMetric];
    const yData = metricDataCache[yMetric];
    const sData = metricDataCache[sizeMetric];
    const cData = metricDataCache[colorMetric];

    if (!xData || !yData) return [];

    const regions = Object.keys(xData).filter(k => yData[k]);

    // Calculate color value distribution for generic categorization
    const colorValues: number[] = [];
    if (cData && !CATEGORY_THRESHOLDS[colorMetric]) {
      regions.forEach(region => {
        const v = cData[region]?.value;
        if (v != null) colorValues.push(v);
      });
    }
    colorValues.sort((a, b) => a - b);
    const p33 = colorValues[Math.floor(colorValues.length * 0.33)] ?? 33;
    const p66 = colorValues[Math.floor(colorValues.length * 0.66)] ?? 66;

    const result: ScatterDataPoint[] = [];

    regions.forEach(region => {
      const x = xData[region]?.value;
      const y = yData[region]?.value;
      if (x == null || y == null) return;

      // Use human-readable name for display
      const displayName = xData[region]?.displayName || yData[region]?.displayName || region;

      // Determine category based on color metric
      let category = 'No Data';
      const colorValue = cData?.[region]?.value;

      if (colorValue != null && CATEGORY_THRESHOLDS[colorMetric]) {
        // Use predefined thresholds for this metric
        const thresholds = CATEGORY_THRESHOLDS[colorMetric];
        for (const t of thresholds) {
          if (colorValue <= t.max) {
            category = t.label;
            break;
          }
        }
      } else if (colorValue != null) {
        // Generic categorization using data-driven percentiles
        if (colorValue <= p33) category = 'Low';
        else if (colorValue <= p66) category = 'Medium';
        else category = 'High';
      }

      result.push({
        id: region,
        label: displayName,
        x,
        y,
        size: sData?.[region]?.value ?? 10,
        color: colorValue,
        category,
      });
    });

    return result;
  }, [metricDataCache, xMetric, yMetric, sizeMetric, colorMetric]);

  // Transform data for box plot
  const boxPlotData = useMemo((): BoxPlotDataPoint[] => {
    const distData = metricDataCache[distributionMetric];
    const cData = metricDataCache[colorMetric];
    if (!distData) return [];

    // Group by category
    const groups: Record<string, number[]> = {};
    const thresholds = CATEGORY_THRESHOLDS[colorMetric as keyof typeof CATEGORY_THRESHOLDS];

    Object.entries(distData).forEach(([region, data]) => {
      const value = data.value;
      if (value == null) return;

      let category = 'All Regions';
      if (cData?.[region] && thresholds) {
        const cv = cData[region].value;
        for (const t of thresholds) {
          if (cv <= t.max) {
            category = t.label;
            break;
          }
        }
      }

      if (!groups[category]) groups[category] = [];
      groups[category].push(value);
    });

    return Object.entries(groups).map(([category, values]) => ({
      category,
      values,
    }));
  }, [metricDataCache, distributionMetric, colorMetric]);

  // Transform data for treemap
  const treemapData = useMemo((): TreemapNode => {
    const sizeData = metricDataCache[xMetric];
    const colorData = metricDataCache[yMetric];
    if (!sizeData) return { name: 'root', children: [] };

    // Group by first letter of display name
    const groups: Record<string, TreemapNode[]> = {};

    Object.entries(sizeData).forEach(([region, data]) => {
      const value = data.value;
      if (value == null || value <= 0) return;

      // Use human-readable display name
      const displayName = data.displayName || region;
      const group = displayName.charAt(0).toUpperCase();
      if (!groups[group]) groups[group] = [];

      groups[group].push({
        name: displayName,
        value: Math.abs(value),
        colorValue: colorData?.[region]?.value,
      });
    });

    return {
      name: 'Markets',
      children: Object.entries(groups)
        .filter(([, items]) => items.length > 0)
        .slice(0, 10) // Limit groups
        .map(([name, children]) => ({
          name,
          children: children.slice(0, 15), // Limit items per group
        })),
    };
  }, [metricDataCache, xMetric, yMetric]);

  // Transform data for heatmap
  const { heatmapData, totalHeatmapRegions } = useMemo(() => {
    const metricsForHeatmap = selectedMetrics
      .map(id => ALL_METRICS.find(m => m.id === id))
      .filter((m): m is typeof ALL_METRICS[0] => !!m);

    if (metricsForHeatmap.length === 0) return { heatmapData: [] as HeatmapDataPoint[], totalHeatmapRegions: 0 };

    const regions = new Set<string>();

    // Find all regions that have data for at least one metric
    metricsForHeatmap.forEach(m => {
      const data = metricDataCache[m.id];
      if (data) Object.keys(data).forEach(r => regions.add(r));
    });

    // Sort regions alphabetically
    const allRegions = Array.from(regions).sort();
    const totalRegions = allRegions.length;

    // Apply limit if set
    const regionLimit = heatmapSettings.regionLimit;
    const regionList = regionLimit === 'all'
      ? allRegions
      : allRegions.slice(0, regionLimit);

    const result: HeatmapDataPoint[] = [];
    regionList.forEach(region => {
      // Get display name from first metric that has this region
      let displayName = region;
      for (const m of metricsForHeatmap) {
        const entry = metricDataCache[m.id]?.[region];
        if (entry?.displayName) {
          displayName = entry.displayName;
          break;
        }
      }

      metricsForHeatmap.forEach(m => {
        const value = metricDataCache[m.id]?.[region]?.value;
        if (value != null) {
          result.push({
            x: m.label.substring(0, 15),
            y: displayName.substring(0, 25),
            value,
          });
        }
      });
    });

    return { heatmapData: result, totalHeatmapRegions: totalRegions };
  }, [metricDataCache, selectedMetrics, heatmapSettings.regionLimit]);

  // Count unique regions shown in heatmap (may be limited)
  const heatmapRegionCount = useMemo(() => {
    return new Set(heatmapData.map(d => d.y)).size;
  }, [heatmapData]);

  // Transform data for correlation matrix
  const correlationData = useMemo((): CorrelationMetric[] => {
    const metricsForCorr = selectedMetrics
      .map(id => ALL_METRICS.find(m => m.id === id))
      .filter((m): m is typeof ALL_METRICS[0] => !!m);

    if (metricsForCorr.length < 2) return [];

    const regions = new Set<string>();

    // Find common regions
    metricsForCorr.forEach(m => {
      const data = metricDataCache[m.id];
      if (data) Object.keys(data).forEach(r => regions.add(r));
    });

    const regionList = Array.from(regions);

    return metricsForCorr.map(m => ({
      id: m.id,
      label: m.label.substring(0, 12),
      values: regionList.map(r => metricDataCache[m.id]?.[r]?.value ?? 0),
    })).filter(m => m.values.some(v => v !== 0));
  }, [metricDataCache, selectedMetrics]);

  // Get format for metric
  const getMetricFormat = (metricId: string) => {
    return ALL_METRICS.find(m => m.id === metricId)?.format ?? 'number';
  };

  const renderVisualization = () => {
    if (geoLevel === 'national') {
      return (
        <div className="flex flex-col items-center justify-center h-[400px] text-center">
          <Info className="w-12 h-12 text-on-surface-variant mb-4" />
          <h3 className="text-lg font-semibold text-on-surface mb-2">Select a Geography Level</h3>
          <p className="text-sm text-on-surface-variant max-w-md">
            Advanced visualizations compare data across multiple regions.
            Select State, Metro, County, or ZIP to see comparisons.
          </p>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-[400px]">
          <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
          <p className="text-sm text-on-surface-variant">Loading {geoLevel} data...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-[400px] text-center">
          <AlertCircle className="w-12 h-12 text-error mb-4" />
          <h3 className="text-lg font-semibold text-on-surface mb-2">Data Unavailable</h3>
          <p className="text-sm text-on-surface-variant max-w-md">{error}</p>
        </div>
      );
    }

    switch (visualizationType) {
      case 'scatter':
        if (scatterData.length === 0) {
          return <EmptyState message="No data available for selected metrics" />;
        }
        return (
          <ScatterPlot
            data={scatterData}
            xLabel={getMetricTitle(xMetric)}
            yLabel={getMetricTitle(yMetric)}
            xFormat={getMetricFormat(xMetric)}
            yFormat={getMetricFormat(yMetric)}
            showRegression={scatterSettings.showRegression}
            showQuadrants={scatterSettings.showQuadrants}
            colorByCategory={scatterSettings.colorByCategory}
            height={500}
            onPointClick={(point) => setSelectedPoint(point)}
          />
        );
      case 'boxplot':
        if (boxPlotData.length === 0) {
          return <EmptyState message="No data available for distribution" />;
        }
        return (
          <BoxPlot
            data={boxPlotData}
            yLabel={getMetricTitle(distributionMetric)}
            yFormat={getMetricFormat(distributionMetric)}
            showOutliers={boxPlotSettings.showOutliers}
            horizontal={boxPlotSettings.horizontal}
            height={500}
          />
        );
      case 'treemap':
        if (!treemapData.children?.length) {
          return <EmptyState message="No data available for treemap" />;
        }
        return (
          <Treemap
            data={treemapData}
            colorBy={treemapSettings.colorBy}
            valueFormat="currency"
            colorFormat="percent"
            height={500}
            onNodeClick={(node, path) => console.log('Clicked:', node, path)}
          />
        );
      case 'heatmap':
        if (heatmapData.length === 0) {
          return <EmptyState message="No data available for heatmap" />;
        }
        return (
          <Heatmap
            data={heatmapData}
            xLabel="Metric"
            yLabel="Region"
            colorScheme={heatmapSettings.colorScheme}
            showValues={heatmapSettings.showValues}
            valueFormat="number"
            height={400}
            onCellClick={(cell) => console.log('Clicked:', cell)}
          />
        );
      case 'correlation':
        if (correlationData.length < 2) {
          return <EmptyState message="Need at least 2 metrics for correlation" />;
        }
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

  const renderMetricSelectors = () => {
    if (geoLevel === 'national') return null;

    switch (visualizationType) {
      case 'scatter':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <MetricSelector
              label="X-Axis"
              value={xMetric}
              onChange={setXMetric}
              options={availableMetrics}
            />
            <MetricSelector
              label="Y-Axis"
              value={yMetric}
              onChange={setYMetric}
              options={availableMetrics}
            />
            <MetricSelector
              label="Bubble Size"
              value={sizeMetric}
              onChange={setSizeMetric}
              options={availableMetrics}
            />
            <MetricSelector
              label="Color By"
              value={colorMetric}
              onChange={setColorMetric}
              options={availableMetrics}
            />
          </div>
        );
      case 'boxplot':
        return (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <MetricSelector
              label="Distribution Metric"
              value={distributionMetric}
              onChange={setDistributionMetric}
              options={availableMetrics}
            />
            <MetricSelector
              label="Group By"
              value={colorMetric}
              onChange={setColorMetric}
              options={availableMetrics}
            />
          </div>
        );
      case 'treemap':
        return (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <MetricSelector
              label="Box Size"
              value={xMetric}
              onChange={setXMetric}
              options={availableMetrics}
            />
            <MetricSelector
              label="Box Color"
              value={yMetric}
              onChange={setYMetric}
              options={availableMetrics}
            />
          </div>
        );
      case 'heatmap':
      case 'correlation':
        return (
          <div className="mb-4">
            <label className="text-xs font-medium text-on-surface-variant mb-2 block">
              Select Metrics to Compare ({selectedMetrics.length} selected, min 2)
            </label>
            <div className="flex flex-wrap gap-2">
              {availableMetrics.map((m) => {
                const isSelected = selectedMetrics.includes(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      if (isSelected) {
                        // Don't allow less than 2 metrics
                        if (selectedMetrics.length > 2) {
                          setSelectedMetrics(prev => prev.filter(id => id !== m.id));
                        }
                      } else {
                        // Max 8 metrics for readability
                        if (selectedMetrics.length < 8) {
                          setSelectedMetrics(prev => [...prev, m.id]);
                        }
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                    } ${!isSelected && selectedMetrics.length >= 8 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-on-surface-variant mt-2">
              Click to toggle metrics. {visualizationType === 'heatmap' ? 'Shows values across regions.' : 'Shows correlation strength between metrics.'}
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  const renderLegend = () => {
    if (geoLevel === 'national' || loading) return null;

    if (visualizationType === 'scatter' && scatterData.length > 0) {
      const categories = [...new Set(scatterData.map(d => d.category).filter((c): c is string => !!c))];
      const colorMap: Record<string, string> = {
        'Hot Market': 'bg-orange-500',
        'Balanced': 'bg-purple-500',
        'Cold Market': 'bg-blue-500',
        'Growing': 'bg-green-500',
        'Stable': 'bg-purple-500',
        'Declining': 'bg-red-500',
        'High': 'bg-green-500',
        'Medium': 'bg-purple-500',
        'Low': 'bg-blue-500',
      };

      return (
        <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-outline-variant">
          <span className="text-xs font-medium text-on-surface-variant">Legend:</span>
          {categories.map(cat => (
            <div key={cat} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-full ${colorMap[cat] || 'bg-gray-500'}`} />
              <span className="text-xs text-on-surface-variant">{cat}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 ml-4">
            <div className="w-2 h-2 rounded-full bg-on-surface-variant" />
            <div className="w-3 h-3 rounded-full bg-on-surface-variant" />
            <div className="w-4 h-4 rounded-full bg-on-surface-variant" />
            <span className="text-xs text-on-surface-variant ml-1">= {getMetricTitle(sizeMetric)}</span>
          </div>
        </div>
      );
    }

    return null;
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
              <span className="text-sm text-on-surface">Show trend line</span>
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
              <label className="text-sm text-on-surface-variant mb-1 block">
                Show regions {totalHeatmapRegions > 0 && <span className="text-xs opacity-70">({totalHeatmapRegions} available)</span>}
              </label>
              <select
                value={heatmapSettings.regionLimit}
                onChange={(e) =>
                  setHeatmapSettings((s) => ({
                    ...s,
                    regionLimit: e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10),
                  }))
                }
                className="w-full px-3 py-2 rounded-lg border border-outline bg-surface text-on-surface text-sm focus:ring-2 focus:ring-primary"
              >
                <option value={10}>Top 10</option>
                <option value={20}>Top 20</option>
                <option value={50}>Top 50</option>
                <option value={100}>Top 100</option>
                <option value={200}>Top 200</option>
                <option value="all">All ({totalHeatmapRegions})</option>
              </select>
            </div>
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
  // Count regions/areas, not cells
  const dataCount = visualizationType === 'scatter' ? scatterData.length :
                    visualizationType === 'boxplot' ? boxPlotData.reduce((acc, g) => acc + g.values.length, 0) :
                    visualizationType === 'heatmap' ? heatmapRegionCount :
                    visualizationType === 'correlation' ? correlationData.length : 0;

  // For heatmap, show "X of Y" when limited
  const isHeatmapLimited = visualizationType === 'heatmap' && heatmapRegionCount < totalHeatmapRegions;

  // Pluralize geography level correctly
  const geoLevelPlural = geoLevel === 'metro' ? 'metros' :
                         geoLevel === 'county' ? 'counties' :
                         geoLevel === 'zip' ? 'ZIP codes' :
                         geoLevel === 'state' ? 'states' :
                         `${geoLevel}s`;

  return (
    <M3Card variant="elevated" size="lg" className={`overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-medium text-on-surface">Advanced Analysis</h3>
          {dataCount > 0 && !loading && (
            <span className="text-xs text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">
              {isHeatmapLimited
                ? `Showing ${heatmapRegionCount} of ${totalHeatmapRegions} ${geoLevelPlural}`
                : `Comparing all ${dataCount} ${geoLevelPlural}`}
            </span>
          )}
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

      {/* Context Note - explains scope of comparison */}
      {geoLevel !== 'national' && !loading && dataCount > 0 && (
        <div className="text-xs text-on-surface-variant bg-surface-container/50 px-3 py-2 rounded-lg mb-4">
          <strong>Scope:</strong> This chart compares <em>all</em> {geoLevelPlural} nationwide, not just areas within {selectedArea || 'your selection'}.
          {selectedArea && (
            <span className="ml-1">
              To see areas within {selectedArea}, change the geography level to a more specific type (e.g., County or ZIP).
            </span>
          )}
        </div>
      )}

      {/* Metric Selectors */}
      {renderMetricSelectors()}

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

      {/* Legend */}
      {renderLegend()}

      {/* Insight Panel - explains the chart in layman's terms */}
      {geoLevel !== 'national' && !loading && dataCount > 0 && (
        <InsightPanel
          visualizationType={visualizationType}
          isExpanded={showInsight}
          onToggle={() => setShowInsight(!showInsight)}
        />
      )}

      {/* Data Source */}
      {!loading && dataCount > 0 && (
        <div className="text-[10px] text-on-surface-variant text-center mt-2">
          Live data from PropertyIQ • Comparing {dataCount} {geoLevelPlural} nationwide
        </div>
      )}

      {/* Geography Detail Popup */}
      {selectedPoint && (
        <GeographyPopup
          point={selectedPoint}
          geoLevel={geoLevel}
          metricDataCache={metricDataCache}
          onClose={() => setSelectedPoint(null)}
          onFocus={onFocusGeography}
        />
      )}
    </M3Card>
  );
};

// Helper Components
const MetricSelector: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; label: string }[];
}> = ({ label, value, onChange, options }) => (
  <div>
    <label className="text-xs font-medium text-on-surface-variant mb-1 block">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-lg border border-outline bg-surface text-on-surface text-sm focus:ring-2 focus:ring-primary"
    >
      {options.map((opt) => (
        <option key={opt.id} value={opt.id}>{opt.label}</option>
      ))}
    </select>
  </div>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center h-[400px] text-center">
    <Info className="w-10 h-10 text-on-surface-variant mb-3" />
    <p className="text-sm text-on-surface-variant">{message}</p>
  </div>
);

// Insight Panel - explains the visualization in layman's terms
const InsightPanel: React.FC<{
  visualizationType: D3VisualizationType;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ visualizationType, isExpanded, onToggle }) => {
  const insight = VISUALIZATION_INSIGHTS[visualizationType];

  return (
    <div className="mt-4 rounded-xl bg-primary-container/30 border border-primary/20 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-primary-container/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-on-surface">What does this chart show?</span>
        </div>
        <span className="text-xs text-primary font-medium">
          {isExpanded ? 'Hide' : 'Show'}
        </span>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* What it shows */}
          <div>
            <h4 className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">
              What You're Looking At
            </h4>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              {insight.whatItShows}
            </p>
          </div>

          {/* How to read */}
          <div>
            <h4 className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">
              How to Read It
            </h4>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              {insight.howToRead}
            </p>
          </div>

          {/* What to look for */}
          <div>
            <h4 className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">
              What to Look For
            </h4>
            <ul className="space-y-1.5">
              {insight.lookFor.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant">
                  <span className="text-primary mt-1">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

// Geography Detail Popup Component
interface GeographyPopupProps {
  point: ScatterDataPoint;
  geoLevel: GeoLevel;
  metricDataCache: Record<string, MetricData>;
  onClose: () => void;
  onFocus?: (geoId: string, geoName: string) => void;
}

const GeographyPopup: React.FC<GeographyPopupProps> = ({
  point,
  geoLevel,
  metricDataCache,
  onClose,
  onFocus,
}) => {
  // Get key metrics for this geography
  const keyMetrics = [
    { id: 'home_value', label: 'Home Value', icon: Home, format: 'currency' as const },
    { id: 'home_value_yoy', label: 'YoY Change', icon: TrendingUp, format: 'percent' as const },
    { id: 'median_rent', label: 'Median Rent', icon: DollarSign, format: 'currency' as const },
    { id: 'cap_rate', label: 'Cap Rate', icon: Target, format: 'percent' as const },
    { id: 'market_heat', label: 'Market Heat', icon: TrendingUp, format: 'number' as const },
    { id: 'for_sale_inventory', label: 'Inventory', icon: Home, format: 'number' as const },
  ];

  const formatValue = (value: number | undefined, format: 'currency' | 'percent' | 'number') => {
    if (value === undefined || value === null) return 'N/A';
    switch (format) {
      case 'currency':
        return value >= 1000000
          ? `$${(value / 1000000).toFixed(2)}M`
          : value >= 1000
            ? `$${(value / 1000).toFixed(0)}K`
            : `$${value.toLocaleString()}`;
      case 'percent':
        return `${value.toFixed(1)}%`;
      default:
        return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-surface-container-high rounded-3xl elevation-3 p-6 max-w-md w-full mx-4 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary-container">
              <MapPin className="w-5 h-5 text-on-primary-container" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-on-surface">{point.label}</h3>
              <p className="text-sm text-on-surface-variant capitalize">{geoLevel}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Badge */}
        {point.category && (
          <div className="mb-4">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
              point.category === 'Hot Market' || point.category === 'Growing' || point.category === 'High'
                ? 'bg-green-500/20 text-green-700 dark:text-green-400'
                : point.category === 'Cold Market' || point.category === 'Declining' || point.category === 'Low'
                  ? 'bg-blue-500/20 text-blue-700 dark:text-blue-400'
                  : 'bg-purple-500/20 text-purple-700 dark:text-purple-400'
            }`}>
              {point.category}
            </span>
          </div>
        )}

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {keyMetrics.map(({ id, label, icon: Icon, format }) => {
            const value = metricDataCache[id]?.[point.id]?.value;
            return (
              <div key={id} className="bg-surface-container rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="w-3.5 h-3.5 text-on-surface-variant" />
                  <span className="text-xs text-on-surface-variant">{label}</span>
                </div>
                <div className="text-base font-semibold text-on-surface">
                  {formatValue(value, format)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Current Selection Info */}
        <div className="bg-surface-container-low rounded-xl p-3 mb-4 border border-outline-variant">
          <p className="text-xs text-on-surface-variant mb-2">Selected in chart:</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-on-surface-variant">X:</span>{' '}
              <span className="font-medium text-on-surface">{point.x.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-on-surface-variant">Y:</span>{' '}
              <span className="font-medium text-on-surface">{point.y.toLocaleString()}</span>
            </div>
            {point.size !== undefined && (
              <div>
                <span className="text-on-surface-variant">Size:</span>{' '}
                <span className="font-medium text-on-surface">{point.size.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl bg-surface-container text-on-surface font-medium text-sm hover:bg-surface-container-high transition-colors"
          >
            Close
          </button>
          {onFocus && (
            <button
              onClick={() => {
                onFocus(point.id, point.label);
                onClose();
              }}
              className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-on-primary font-medium text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Target className="w-4 h-4" />
              Focus on this {geoLevel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default D3VisualizationSection;
