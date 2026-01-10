'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { api, MarketStats } from '@/lib/api/client';

// Set token directly
mapboxgl.accessToken = 'pk.eyJ1IjoidHJveWhvdXN0b24iLCJhIjoiY21hZzFzaXJjMGEzcDJqcHByb29xM2lndSJ9.sataRzk3HaLNolfOnIc7Jw';

// US States GeoJSON URL (free, public)
const US_STATES_GEOJSON = 'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json';

// Mock home values by state
const stateHomeValues: Record<string, number> = {
  'Alabama': 147393, 'Alaska': 293334, 'Arizona': 338334, 'Arkansas': 148030, 'California': 754304,
  'Colorado': 524321, 'Connecticut': 398254, 'Delaware': 273899, 'Florida': 374058, 'Georgia': 281738,
  'Hawaii': 817036, 'Idaho': 373078, 'Illinois': 239228, 'Indiana': 206332, 'Iowa': 180303,
  'Kansas': 174818, 'Kentucky': 183339, 'Louisiana': 184833, 'Maine': 323899, 'Maryland': 384038,
  'Massachusetts': 527955, 'Michigan': 196044, 'Minnesota': 274878, 'Mississippi': 145044, 'Missouri': 194033,
  'Montana': 366373, 'Nebraska': 226038, 'Nevada': 377333, 'New Hampshire': 369206, 'New Jersey': 458254,
  'New Mexico': 247070, 'New York': 427955, 'North Carolina': 269038, 'North Dakota': 223036, 'Ohio': 192665,
  'Oklahoma': 157004, 'Oregon': 443864, 'Pennsylvania': 235332, 'Rhode Island': 373273, 'South Carolina': 249038,
  'South Dakota': 248034, 'Tennessee': 276161, 'Texas': 296038, 'Utah': 473385, 'Vermont': 319206,
  'Virginia': 367238, 'Washington': 554304, 'West Virginia': 133096, 'Wisconsin': 239031, 'Wyoming': 273147,
};

type GeoLevel = 'national' | 'state' | 'metro' | 'county' | 'zip';
type MetricType = 'home_value' | 'inventory' | 'days_on_market' | 'price_growth';

const metricCategories = [
  {
    name: 'Home Value',
    icon: '🏠',
    metrics: [
      { id: 'home_value' as MetricType, name: 'Home Value' },
      { id: 'price_growth' as MetricType, name: 'Price Growth (YoY)' },
    ],
  },
  {
    name: 'For Sale Inventory',
    icon: '📋',
    metrics: [
      { id: 'inventory' as MetricType, name: 'For Sale Inventory' },
    ],
  },
  {
    name: 'Days on Market',
    icon: '📅',
    metrics: [
      { id: 'days_on_market' as MetricType, name: 'Days on Market' },
    ],
  },
];

export default function MapPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [geoLevel, setGeoLevel] = useState<GeoLevel>('state');
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('home_value');
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string>('Home Value');

  // Load stats
  useEffect(() => {
    api.getStats().then(setStats).catch(console.error);
  }, []);

  // Initialize map
  useEffect(() => {
    if (map.current) return;
    if (!mapContainer.current) {
      console.error('Map container not found');
      return;
    }

    console.log('Initializing map...');
    
    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [-96, 37.8],
        zoom: 3,
      });

      map.current.on('load', async () => {
        console.log('Map loaded, fetching GeoJSON...');
        setMapLoaded(true);

        try {
          // Fetch GeoJSON
          const response = await fetch(US_STATES_GEOJSON);
          const geojson = await response.json();
          console.log('GeoJSON loaded:', geojson.features?.length, 'features');

          // Add values to properties
          geojson.features.forEach((feature: any) => {
            const stateName = feature.properties.name;
            feature.properties.value = stateHomeValues[stateName] || 0;
          });

          // Add source
          map.current!.addSource('states', {
            type: 'geojson',
            data: geojson,
          });

          // Get min/max values
          const values = Object.values(stateHomeValues);
          const minValue = Math.min(...values);
          const maxValue = Math.max(...values);

          // Add fill layer
          map.current!.addLayer({
            id: 'state-fills',
            type: 'fill',
            source: 'states',
            paint: {
              'fill-color': [
                'interpolate',
                ['linear'],
                ['get', 'value'],
                minValue, '#cce5ff',
                maxValue * 0.25, '#99caff',
                maxValue * 0.5, '#66b0ff',
                maxValue * 0.75, '#3395ff',
                maxValue, '#0066cc',
              ],
              'fill-opacity': 0.7,
            },
          });

          // Add borders
          map.current!.addLayer({
            id: 'state-borders',
            type: 'line',
            source: 'states',
            paint: {
              'line-color': '#ffffff',
              'line-width': 1,
            },
          });

          // Add labels with values
          map.current!.addLayer({
            id: 'state-labels',
            type: 'symbol',
            source: 'states',
            layout: {
              'text-field': ['concat', ['get', 'name'], '\n$', ['to-string', ['get', 'value']]],
              'text-size': 10,
              'text-anchor': 'center',
            },
            paint: {
              'text-color': '#333',
              'text-halo-color': '#fff',
              'text-halo-width': 1,
            },
          });

          console.log('Layers added successfully');
        } catch (err) {
          console.error('Error loading GeoJSON:', err);
          setMapError('Failed to load map data');
        }
      });

      map.current.on('error', (e) => {
        console.error('Map error:', e);
        setMapError('Map failed to load');
      });

    } catch (err) {
      console.error('Error initializing map:', err);
      setMapError('Failed to initialize map');
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
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

        <div className="flex gap-2">
          {(['national', 'state', 'metro', 'county', 'zip'] as GeoLevel[]).map((level) => (
            <button
              key={level}
              onClick={() => setGeoLevel(level)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                geoLevel === level ? 'bg-gray-800 text-white' : 'bg-white border hover:bg-gray-50'
              }`}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 bg-white shadow-lg overflow-y-auto flex-shrink-0">
          <div className="flex">
            <div className="w-14 bg-gray-50 border-r flex flex-col items-center py-4 gap-2">
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
                  className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center text-xs ${
                    item.active ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  <span className="text-[10px]">{item.label}</span>
                </button>
              ))}
            </div>

            <div className="flex-1 p-4">
              <h2 className="text-lg font-semibold mb-4">Market Trends</h2>
              
              {metricCategories.map((category) => (
                <div key={category.name} className="mb-2">
                  <button
                    onClick={() => setExpandedCategory(expandedCategory === category.name ? '' : category.name)}
                    className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span>{category.icon}</span>
                      <span className="font-medium text-sm">{category.name}</span>
                    </div>
                    <svg
                      className={`w-4 h-4 transition-transform ${expandedCategory === category.name ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {expandedCategory === category.name && (
                    <div className="ml-8 mt-1 space-y-1">
                      {category.metrics.map((metric) => (
                        <button
                          key={metric.id}
                          onClick={() => setSelectedMetric(metric.id)}
                          className={`w-full text-left px-3 py-1.5 rounded text-sm ${
                            selectedMetric === metric.id ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-50'
                          }`}
                        >
                          {metric.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              <div className="border-t mt-4 pt-4">
                {[
                  { icon: '📈', name: 'Investor Metrics' },
                  { icon: '👥', name: 'Demographics' },
                ].map((item) => (
                  <button
                    key={item.name}
                    className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg mb-2"
                  >
                    <div className="flex items-center gap-2">
                      <span>{item.icon}</span>
                      <span className="font-medium text-sm">{item.name}</span>
                    </div>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Map */}
        <main className="flex-1 relative">
          {mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-50">
              <p className="text-red-600">{mapError}</p>
            </div>
          )}
          {!mapLoaded && !mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <p className="text-gray-600">Loading map...</p>
            </div>
          )}
          <div ref={mapContainer} className="absolute inset-0" style={{ width: '100%', height: '100%' }} />

          <button className="absolute bottom-6 right-6 bg-white shadow-lg rounded-lg px-4 py-3 flex items-center gap-2 hover:bg-gray-50 z-10">
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