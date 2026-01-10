'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { api, State, MarketStats } from '@/lib/api/client';

mapboxgl.accessToken = 'pk.eyJ1IjoidHJveWhvdXN0b24iLCJhIjoiY21hZzFzaXJjMGEzcDJqcHByb29xM2lndSJ9.sataRzk3HaLNolfOnIc7Jw';

// US States GeoJSON URL (free, public)
const US_STATES_GEOJSON = 'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json';

// Mock home values by state (we'll replace with real data later)
const stateHomeValues: Record<string, number> = {
  'Alabama': 147393, 'Alaska': 293334, 'Arizona': 738334, 'Arkansas': 148030, 'California': 754304,
  'Colorado': 724321, 'Connecticut': 798254, 'Delaware': 273899, 'Florida': 274058, 'Georgia': 211738,
  'Hawaii': 817036, 'Idaho': 373078, 'Illinois': 239228, 'Indiana': 236332, 'Iowa': 220303,
  'Kansas': 174818, 'Kentucky': 193339, 'Louisiana': 214833, 'Maine': 373899, 'Maryland': 384038,
  'Massachusetts': 527955, 'Michigan': 196044, 'Minnesota': 274878, 'Mississippi': 145044, 'Missouri': 174033,
  'Montana': 376373, 'Nebraska': 226038, 'Nevada': 377333, 'New Hampshire': 369206, 'New Jersey': 498254,
  'New Mexico': 277070, 'New York': 427955, 'North Carolina': 299038, 'North Dakota': 243036, 'Ohio': 192665,
  'Oklahoma': 137004, 'Oregon': 473864, 'Pennsylvania': 275332, 'Rhode Island': 373273, 'South Carolina': 299038,
  'South Dakota': 278034, 'Tennessee': 276161, 'Texas': 296038, 'Utah': 473385, 'Vermont': 369206,
  'Virginia': 417238, 'Washington': 554304, 'West Virginia': 113096, 'Wisconsin': 269031, 'Wyoming': 273147,
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
  const popup = useRef<mapboxgl.Popup | null>(null);
  const [geoLevel, setGeoLevel] = useState<GeoLevel>('state');
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('home_value');
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string>('Home Value');

  // Load initial data
  useEffect(() => {
    async function loadData() {
      try {
        const statsData = await api.getStats();
        setStats(statsData);
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
    });

    popup.current = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
    });

    map.current.on('load', async () => {
      if (!map.current) return;

      // Fetch GeoJSON
      const response = await fetch(US_STATES_GEOJSON);
      const geojson = await response.json();

      // Add values to GeoJSON properties
      geojson.features.forEach((feature: any) => {
        const stateName = feature.properties.name;
        feature.properties.value = stateHomeValues[stateName] || 0;
      });

      // Add source
      map.current.addSource('states', {
        type: 'geojson',
        data: geojson,
      });

      // Calculate min/max for color scale
      const values = Object.values(stateHomeValues);
      const minValue = Math.min(...values);
      const maxValue = Math.max(...values);

      // Add choropleth fill layer
      map.current.addLayer({
        id: 'state-fills',
        type: 'fill',
        source: 'states',
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['get', 'value'],
            minValue, '#e8f4f8',
            minValue + (maxValue - minValue) * 0.2, '#b8d4e3',
            minValue + (maxValue - minValue) * 0.4, '#7eb8da',
            minValue + (maxValue - minValue) * 0.6, '#4a9cc7',
            minValue + (maxValue - minValue) * 0.8, '#2d7a9e',
            maxValue, '#1a5276',
          ],
          'fill-opacity': 0.8,
        },
      });

      // Add state borders
      map.current.addLayer({
        id: 'state-borders',
        type: 'line',
        source: 'states',
        paint: {
          'line-color': '#627BC1',
          'line-width': 1,
        },
      });

      // Add state labels
      map.current.addLayer({
        id: 'state-labels',
        type: 'symbol',
        source: 'states',
        layout: {
          'text-field': [
            'format',
            ['get', 'name'],
            { 'font-scale': 0.8 },
            '\n',
            {},
            ['concat', '$', ['number-format', ['get', 'value'], { 'min-fraction-digits': 0, 'max-fraction-digits': 0 }]],
            { 'font-scale': 0.7 },
          ],
          'text-size': 11,
          'text-anchor': 'center',
        },
        paint: {
          'text-color': '#1a1a2e',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
      });

      // Hover effects
      map.current.on('mousemove', 'state-fills', (e) => {
        if (!map.current || !e.features || e.features.length === 0) return;
        
        map.current.getCanvas().style.cursor = 'pointer';
        
        const feature = e.features[0];
        const stateName = feature.properties?.name;
        const value = feature.properties?.value;

        if (popup.current && stateName) {
          popup.current
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="padding: 8px;">
                <strong>${stateName}</strong><br/>
                <span style="font-size: 18px; font-weight: bold; color: #1a5276;">
                  $${value?.toLocaleString()}
                </span>
              </div>
            `)
            .addTo(map.current);
        }
      });

      map.current.on('mouseleave', 'state-fills', () => {
        if (!map.current) return;
        map.current.getCanvas().style.cursor = '';
        popup.current?.remove();
      });
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

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