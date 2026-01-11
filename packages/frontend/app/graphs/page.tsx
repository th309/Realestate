
'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { MetricGraph } from '@/src/components/graphs/MetricGraph';
import { METRIC_REGISTRY } from '@/src/config/metric-registry';
import { MetricSidebar } from '@/src/components/sidebar/MetricSidebar';
import { GeographySelector } from '@/src/components/selectors/GeographySelector';
import { RegionCompare } from '@/src/components/graphs/RegionCompare';

import { GraphSearchBar, SearchResult } from '@/src/components/graphs/GraphSearchBar';

type GeoLevel = 'national' | 'state' | 'metro' | 'county' | 'zip' | 'city';

function GraphsContent() {
  const searchParams = useSearchParams();

  // Get initial metric from URL or default to ZHVI
  const initialMetric = searchParams.get('metric') || 'zhvi';
  const initialRegion = searchParams.get('region') || 'national';
  const initialGeoLevel = (searchParams.get('geoLevel') as GeoLevel) || 'national';

  const [selectedMetric, setSelectedMetric] = useState(initialMetric);
  const [selectedRegion, setSelectedRegion] = useState({
    id: initialRegion,
    name: initialRegion === 'national' ? 'United States' : initialRegion,
  });
  const [geoLevel, setGeoLevel] = useState<GeoLevel>(initialGeoLevel);
  const [compareRegions, setCompareRegions] = useState<string[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const metric = METRIC_REGISTRY[selectedMetric];

  // Update URL when selections change
  const updateURL = (metric: string, region: string, level: GeoLevel) => {
    const params = new URLSearchParams();
    params.set('metric', metric);
    params.set('region', region);
    params.set('geoLevel', level);
    window.history.replaceState({}, '', `?${params.toString()}`);
  };

  const handleMetricSelect = (metricId: string) => {
    setSelectedMetric(metricId);
    updateURL(metricId, selectedRegion.id, geoLevel);
  };

  const handleRegionSelect = (region: { id: string; name: string }, level: GeoLevel) => {
    setSelectedRegion(region);
    setGeoLevel(level);
    updateURL(selectedMetric, region.id, level);
  };

  const handleSearchSelect = (result: SearchResult) => {
    // Types are already normalized in GraphSearchBar
    const level = result.type as GeoLevel;
    handleRegionSelect({ id: result.id, name: result.name }, level);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar with metric selection */}
      <MetricSidebar
        selectedMetric={selectedMetric}
        onMetricSelect={handleMetricSelect}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6">
          {/* Header Section */}
          <div className="mb-6 space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {metric?.name || 'Select a Metric'}
              </h1>
              <p className="text-gray-500 mt-1">{metric?.description}</p>
            </div>

            <div className="flex flex-col gap-4 max-w-xl">
              {/* Search Bar */}
              <GraphSearchBar onSelect={handleSearchSelect} />

              {/* Geography Selector */}
              <GeographySelector
                currentLevel={geoLevel}
                currentRegion={selectedRegion}
                availableLevels={metric?.geoLevels || ['national']}
                onSelect={handleRegionSelect}
              />
            </div>
          </div>

          {/* Main Graph */}
          {metric && (
            <MetricGraph
              metricId={selectedMetric}
              regionId={selectedRegion.id}
              regionName={selectedRegion.name}
              geoLevel={geoLevel}
              compareRegions={compareRegions}
            />
          )}

          {/* Region Comparison */}
          <div className="mt-8">
            <RegionCompare
              metricId={selectedMetric}
              currentRegion={selectedRegion}
              geoLevel={geoLevel}
              compareRegions={compareRegions}
              onAddRegion={(region) => setCompareRegions([...compareRegions, region])}
              onRemoveRegion={(region) =>
                setCompareRegions(compareRegions.filter(r => r !== region))
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GraphsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <GraphsContent />
    </Suspense>
  );
}
