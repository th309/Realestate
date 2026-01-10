'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { api, State, MarketStats } from '@/lib/api/client';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

// Color scale for choropleth (blue to purple gradient like Reventure)
const getColorForValue = (value: number, min: number, max: number): string => {
  const normalized = (value - min) / (max - min);
  const colors = [
    '#e8f4f8', // lightest
    '#b8d4e3',
    '#8bb8d0',
    '#5e9aba',
    '#3d7a9e',
    '#2d5a7b',
    '#1d3d5c', // darkest
  ];
  const index = Math.min(Math.floor(normalized * colors.length), colors.length - 1);
  return colors[index];
};

// Mock home values by state (we'll replace with real data later)
const stateHomeValues: Record<string, number> = {
  'AL': 147393, 'AK': 293334, 'AZ': 738334, 'AR': 148030, 'CA': 754304,
  'CO': 724321, 'CT': 798254, 'DE': 273899, 'FL': 274058, 'GA': 211738,
  'HI': 17036, 'ID': 773078, 'IL': 139228, 'IN': 236332, 'IA': 120303,
  'KS': 174818, 'KY': 193339, 'LA': 114833, 'ME': 73899, 'MD': 284038,
  'MA': 727955, 'MI': 196044, 'MN': 774878, 'MS': 145044, 'MO': 174033,
  'MT': 176373, 'NE': 126038, 'NV': 777333, 'NH': 169206, 'NJ': 798254,
  'NM': 777070, 'NY': 727955, 'NC': 199038, 'ND': 143036, 'OH': 192665,
  'OK': 137004, 'OR': 773864, 'PA': 175332, 'RI': 173273, 'SC': 199038,
  'SD': 178034, 'TN': 176161, 'TX': 296038, 'UT': 173385, 'VT': 169206,
  'VA': 717238, 'WA': 754304, 'WV': 113096, 'WI': 169031, 'WY': 173147,
};

type GeoLevel = 'national' | 'state' | 'metro' | 'county' | 'zip';
type MetricType = 'home_value' | 'inventory' | 'days_on_market' | 'price_growth';

interface MetricCategory {
  name: string;
  icon: string;
  metrics: { id: MetricType; name: string }[];
}

const metricCategories: MetricCategory[] = [
  {
    name: 'Home Value',
    icon: '🏠',
    metrics: [
      { id: 'home_value', name: 'Home Value' },
      { id: 'price_growth', name: 'Price Growth (YoY)' },
    ],
  },
  {
    name: 'For Sale Inventory',
    icon: '📋',
    metrics: [
      { id: 'inventory', name: 'For Sale Inventory' },
    ],
  },
  {
    name: 'Days on Market',
    icon: '📅',
    metrics: [
      { id: 'days_on_market', name: 'Days on Market' },
    ],
  },
];

export default function MapPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [geoLevel, setGeoLevel] = useState<GeoLevel>('state');
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('home_value');
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [states, setStates] = useState<State[]>([]);
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string>('Home Value');

  // Load initial data
  useEffect(() => {
    async function loadData() {
      try {
        const [statsData, statesData] = await Promise.all([
          api.getStats(),
          api.getStates(),
        ]);
        setStats(statsData);
        setStates(statesData);
      } catch (err) {
        console.error('Failed to load data:', err);
      }
    }
    loadData();
  }, []);

  // Initialize map
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-98.5795, 39.8283],
      zoom: 3.5,
      projection: 'mercator',
    });

    map.current.on('load', () => {
      if (!map.current) return;

      // Add state boundaries source
      map.current.addSource('states', {
        type: 'vector',
        url: 'mapbox://mapbox.boundaries-adm1-v4',
      });

      // Add choropleth fill layer
      map.current.addLayer({
        id: 'state-fills',
        type: 'fill',
        source: 'states',
        'source-layer': 'boundaries_admin_1',
        filter: ['==', ['get', 'iso_3166_1'], 'US'],
        paint: {
          'fill-color': [
            'match',
            ['get', 'iso_3166_1_alpha_2'],
            ...Object.entries(stateHomeValues).flatMap(([state, value]) => [
              `US-${state}`,
              getColorForValue(value, 100000, 800000),
            ]),
            '#e8f4f8', // default
          ],
          'fill-opacity': 0.8,
        },
      });

      // Add state borders
      map.current.addLayer({
        id: 'state-borders',
        type: 'line',
        source: 'states',
        'source-layer': 'boundaries_admin_1',
        filter: ['==', ['get', 'iso_3166_1'], 'US'],
        paint: {
          'line-color': '#627BC1',
          'line-width': 1,
        },
      });

      // Add hover effect
      map.current.on('mousemove', 'state-fills', (e) => {
        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          const stateCode = feature.properties?.iso_3166_1_alpha_2?.replace('US-', '');
          setHoveredState(stateCode);
        }
      });

      map.current.on('mouseleave', 'state-fills', () => {
        setHoveredState(null);
      });
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  const formatValue = (value: number, metric: MetricType): string => {
    if (metric === 'home_value') {
      return `$${value.toLocaleString()}`;
    }
    return value.toLocaleString();
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-gray-100 rounded">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-xl font-semibold">REI Platform</h1>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-xl mx-8">
          <div className="relative">
            <input
              type="text"
              placeholder="Search city, zip, or address"
              className="w-full pl-10 pr-4 py-2 border rounded-full bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Geo Level Selector */}
        <div className="flex gap-2">
          {(['national', 'state', 'metro', 'county', 'zip'] as GeoLevel[]).map((level) => (
            <button
              key={level}
              onClick={() => setGeoLevel(level)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                geoLevel === level
                  ? 'bg-gray-800 text-white'
                  : 'bg-white border hover:bg-gray-50'
              }`}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Sidebar */}
        <aside className="w-80 bg-white shadow-lg overflow-y-auto">
          {/* Left Nav Icons */}
          <div className="flex">
            <div className="w-16 bg-gray-50 border-r flex flex-col items-center py-4 gap-2">
              {[
                { icon: '🏠', label: 'Home' },
                { icon: '📍', label: 'Maps', active: true },
                { icon: '📊', label: 'Graphs' },
                { icon: '📄', label: 'Reports' },
                { icon: 'ℹ️', label: 'About' },
                { icon: '💰', label: 'Pricing' },
              ].map((item) => (
                <button
                  key={item.label}
                  className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center text-xs ${
                    item.active ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            {/* Metric Selector */}
            <div className="flex-1 p-4">
              <h2 className="text-xl font-semibold mb-4">Market Trends</h2>

              {metricCategories.map((category) => (
                <div key={category.name} className="mb-2">
                  <button
                    onClick={() => setExpandedCategory(expandedCategory === category.name ? '' : category.name)}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{category.icon}</span>
                      <span className="font-medium">{category.name}</span>
                    </div>
                    <svg
                      className={`w-5 h-5 transition-transform ${expandedCategory === category.name ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {expandedCategory === category.name && (
                    <div className="ml-10 mt-1 space-y-1">
                      {category.metrics.map((metric) => (
                        <button
                          key={metric.id}
                          onClick={() => setSelectedMetric(metric.id)}
                          className={`w-full text-left px-3 py-2 rounded text-sm ${
                            selectedMetric === metric.id
                              ? 'bg-blue-100 text-blue-700'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          {metric.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Additional categories */}
              <div className="border-t mt-4 pt-4">
                {[
                  { icon: '📈', name: 'Investor Metrics' },
                  { icon: '👥', name: 'Demographics' },
                ].map((item) => (
                  <button
                    key={item.name}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg mb-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{item.icon}</span>
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Map Container */}
        <main className="flex-1 relative">
          <div ref={mapContainer} className="absolute inset-0" />

          {/* Hover Tooltip */}
          {hoveredState && stateHomeValues[hoveredState] && (
            <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4">
              <div className="font-semibold">{hoveredState}</div>
              <div className="text-2xl font-bold text-blue-600">
                {formatValue(stateHomeValues[hoveredState], selectedMetric)}
              </div>
            </div>
          )}

          {/* Table View Toggle */}
          <button className="absolute bottom-6 right-6 bg-white shadow-lg rounded-lg px-4 py-3 flex items-center gap-2 hover:bg-gray-50">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className="font-medium">Table View</span>
          </button>
        </main>
      </div>
    </div>
  );
}
