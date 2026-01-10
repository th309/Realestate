'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { api, MarketStats } from '@/lib/api/client';

mapboxgl.accessToken = 'pk.eyJ1IjoidHJveWhvdXN0b24iLCJhIjoiY21hZzFzaXJjMGEzcDJqcHByb29xM2lndSJ9.sataRzk3HaLNolfOnIc7Jw';

// GeoJSON sources for different geography levels
const GEOJSON_SOURCES = {
  state: 'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json',
  county: 'https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json',
  metro: '/geojson/cbsa_2023.json', // 2023 Census CBSA boundaries (converted from shapefile)
  // ZIP codes use Mapbox's built-in tileset
};

type GeoLevel = 'national' | 'state' | 'metro' | 'county' | 'zip';
type HomeValues = Record<string, number>;

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
}

interface MetricCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  expanded?: boolean;
  metrics?: { id: string; name: string }[];
}

// Material 3 Icons as SVG components
const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
    <path d="M240-200h120v-240h240v240h120v-360L480-740 240-560v360Zm-80 80v-480l320-240 320 240v480H520v-240h-80v240H160Zm320-350Z"/>
  </svg>
);

const MapIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
    <path d="M480-480q33 0 56.5-23.5T560-560q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560q0 33 23.5 56.5T480-480Zm0 294q122-112 181-203.5T720-552q0-109-69.5-178.5T480-800q-101 0-170.5 69.5T240-552q0 71 59 162.5T480-186Zm0 106Q319-217 239.5-334.5T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 100-79.5 217.5T480-80Zm0-480Z"/>
  </svg>
);

const GraphIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
    <path d="M280-280h80v-280h-80v280Zm160 0h80v-400h-80v400Zm160 0h80v-160h-80v160ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z"/>
  </svg>
);

const ReportIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
    <path d="M320-240h320v-80H320v80Zm0-160h320v-80H320v80ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z"/>
  </svg>
);

const InfoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
    <path d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>
  </svg>
);

const PricingIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
    <path d="M560-440q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35ZM280-320q-33 0-56.5-23.5T200-400v-320q0-33 23.5-56.5T280-800h560q33 0 56.5 23.5T920-720v320q0 33-23.5 56.5T840-320H280Zm80-80h400q0-33 23.5-56.5T840-480v-160q-33 0-56.5-23.5T760-720H360q0 33-23.5 56.5T280-640v160q33 0 56.5 23.5T360-400Zm440 240H120q-33 0-56.5-23.5T40-240v-440h80v440h680v80ZM280-400v-320 320Z"/>
  </svg>
);

const HomeValueIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
    <path d="M240-200h120v-240h240v240h120v-360L480-740 240-560v360Zm-80 80v-480l320-240 320 240v480H520v-240h-80v240H160Zm320-350Z"/>
  </svg>
);

const InventoryIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
    <path d="M200-80q-33 0-56.5-23.5T120-160v-480q0-33 23.5-56.5T200-720h80v-80q0-33 23.5-56.5T360-880h240q33 0 56.5 23.5T680-800v80h80q33 0 56.5 23.5T840-640v480q0 33-23.5 56.5T760-80H200Zm160-640h240v-80H360v80ZM200-160h560v-480H200v480Zm280-240Z"/>
  </svg>
);

const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
    <path d="M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Zm0 0v-80 80Zm280 240q-17 0-28.5-11.5T440-440q0-17 11.5-28.5T480-480q17 0 28.5 11.5T520-440q0 17-11.5 28.5T480-400Zm-160 0q-17 0-28.5-11.5T280-440q0-17 11.5-28.5T320-480q17 0 28.5 11.5T360-440q0 17-11.5 28.5T320-400Zm320 0q-17 0-28.5-11.5T600-440q0-17 11.5-28.5T640-480q17 0 28.5 11.5T680-440q0 17-11.5 28.5T640-400ZM480-240q-17 0-28.5-11.5T440-280q0-17 11.5-28.5T480-320q17 0 28.5 11.5T520-280q0 17-11.5 28.5T480-240Zm-160 0q-17 0-28.5-11.5T280-280q0-17 11.5-28.5T320-320q17 0 28.5 11.5T360-280q0 17-11.5 28.5T320-240Zm320 0q-17 0-28.5-11.5T600-280q0-17 11.5-28.5T640-320q17 0 28.5 11.5T680-280q0 17-11.5 28.5T640-240Z"/>
  </svg>
);

const TrendingIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
    <path d="m136-240-56-56 296-298 160 160 208-206H640v-80h240v240h-80v-104L536-320 376-480 136-240Z"/>
  </svg>
);

const PeopleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
    <path d="M40-160v-112q0-34 17.5-62.5T104-378q62-31 126-46.5T360-440q66 0 130 15.5T616-378q29 15 46.5 43.5T680-272v112H40Zm720 0v-120q0-44-24.5-84.5T666-434q51 6 96 20.5t84 35.5q36 20 55 44.5t19 53.5v120H760ZM360-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm400-160q0 66-47 113t-113 47q-11 0-28-2.5t-28-5.5q27-32 41.5-71t14.5-81q0-42-14.5-81T544-792q14-5 28-6.5t28-1.5q66 0 113 47t47 113ZM120-240h480v-32q0-11-5.5-20T580-306q-54-27-109-40.5T360-360q-56 0-111 13.5T140-306q-9 5-14.5 14t-5.5 20v32Zm240-320q33 0 56.5-23.5T440-640q0-33-23.5-56.5T360-720q-33 0-56.5 23.5T280-640q0 33 23.5 56.5T360-560Zm0 320Zm0-400Z"/>
  </svg>
);

const TableIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
    <path d="M120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200q-33 0-56.5-23.5T120-200Zm80-400h560v-160H200v160Zm213 200h134v-120H413v120Zm0 200h134v-120H413v120ZM200-400h133v-120H200v120Zm427 0h133v-120H627v120ZM200-200h133v-120H200v120Zm427 0h133v-120H627v120Z"/>
  </svg>
);

const MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
    <path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z"/>
  </svg>
);

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
    <path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z"/>
  </svg>
);

const ChevronDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor">
    <path d="M480-344 240-584l56-56 184 184 184-184 56 56-240 240Z"/>
  </svg>
);

// FIPS code to state name mapping for counties
const FIPS_TO_STATE: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA',
  '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL',
  '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN',
  '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME',
  '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS',
  '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
  '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
  '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
  '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI',
  '56': 'WY',
};

// US States list for dropdown
const US_STATES = [
  { abbrev: 'AL', name: 'Alabama' }, { abbrev: 'AK', name: 'Alaska' },
  { abbrev: 'AZ', name: 'Arizona' }, { abbrev: 'AR', name: 'Arkansas' },
  { abbrev: 'CA', name: 'California' }, { abbrev: 'CO', name: 'Colorado' },
  { abbrev: 'CT', name: 'Connecticut' }, { abbrev: 'DE', name: 'Delaware' },
  { abbrev: 'DC', name: 'District of Columbia' }, { abbrev: 'FL', name: 'Florida' },
  { abbrev: 'GA', name: 'Georgia' }, { abbrev: 'HI', name: 'Hawaii' },
  { abbrev: 'ID', name: 'Idaho' }, { abbrev: 'IL', name: 'Illinois' },
  { abbrev: 'IN', name: 'Indiana' }, { abbrev: 'IA', name: 'Iowa' },
  { abbrev: 'KS', name: 'Kansas' }, { abbrev: 'KY', name: 'Kentucky' },
  { abbrev: 'LA', name: 'Louisiana' }, { abbrev: 'ME', name: 'Maine' },
  { abbrev: 'MD', name: 'Maryland' }, { abbrev: 'MA', name: 'Massachusetts' },
  { abbrev: 'MI', name: 'Michigan' }, { abbrev: 'MN', name: 'Minnesota' },
  { abbrev: 'MS', name: 'Mississippi' }, { abbrev: 'MO', name: 'Missouri' },
  { abbrev: 'MT', name: 'Montana' }, { abbrev: 'NE', name: 'Nebraska' },
  { abbrev: 'NV', name: 'Nevada' }, { abbrev: 'NH', name: 'New Hampshire' },
  { abbrev: 'NJ', name: 'New Jersey' }, { abbrev: 'NM', name: 'New Mexico' },
  { abbrev: 'NY', name: 'New York' }, { abbrev: 'NC', name: 'North Carolina' },
  { abbrev: 'ND', name: 'North Dakota' }, { abbrev: 'OH', name: 'Ohio' },
  { abbrev: 'OK', name: 'Oklahoma' }, { abbrev: 'OR', name: 'Oregon' },
  { abbrev: 'PA', name: 'Pennsylvania' }, { abbrev: 'RI', name: 'Rhode Island' },
  { abbrev: 'SC', name: 'South Carolina' }, { abbrev: 'SD', name: 'South Dakota' },
  { abbrev: 'TN', name: 'Tennessee' }, { abbrev: 'TX', name: 'Texas' },
  { abbrev: 'UT', name: 'Utah' }, { abbrev: 'VT', name: 'Vermont' },
  { abbrev: 'VA', name: 'Virginia' }, { abbrev: 'WA', name: 'Washington' },
  { abbrev: 'WV', name: 'West Virginia' }, { abbrev: 'WI', name: 'Wisconsin' },
  { abbrev: 'WY', name: 'Wyoming' },
];

export default function MapPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const popup = useRef<mapboxgl.Popup | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [geoLevel, setGeoLevel] = useState<GeoLevel>('state');
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedMetric, setSelectedMetric] = useState('home_value');
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [homeValues, setHomeValues] = useState<HomeValues>({});
  const [dataLoading, setDataLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['home_value']);
  const pathname = usePathname();

  const navItems: NavItem[] = [
    { id: 'home', label: 'Home', icon: <HomeIcon />, href: '/' },
    { id: 'maps', label: 'Maps', icon: <MapIcon />, href: '/map' },
    { id: 'graphs', label: 'Graphs', icon: <GraphIcon />, href: '/graphs' },
    { id: 'reports', label: 'Reports', icon: <ReportIcon />, href: '/reports' },
    { id: 'about', label: 'About Us', icon: <InfoIcon />, href: '/about' },
    { id: 'pricing', label: 'Pricing', icon: <PricingIcon />, href: '/pricing' },
  ];

  const metricCategories: MetricCategory[] = [
    {
      id: 'home_value',
      name: 'Home Value',
      icon: <HomeValueIcon />,
      metrics: [
        { id: 'home_value', name: 'Home Value' },
        { id: 'price_sqft', name: 'Price per Sq Ft' },
      ],
    },
    {
      id: 'inventory',
      name: 'For Sale Inventory',
      icon: <InventoryIcon />,
      metrics: [
        { id: 'inventory', name: 'Active Listings' },
        { id: 'new_listings', name: 'New Listings' },
      ],
    },
    {
      id: 'days_on_market',
      name: 'Days on Market',
      icon: <CalendarIcon />,
      metrics: [
        { id: 'dom', name: 'Median Days on Market' },
      ],
    },
    {
      id: 'investor_metrics',
      name: 'Investor Metrics',
      icon: <TrendingIcon />,
      metrics: [
        { id: 'cap_rate', name: 'Cap Rate' },
        { id: 'rent_yield', name: 'Rent Yield' },
      ],
    },
    {
      id: 'demographics',
      name: 'Demographics',
      icon: <PeopleIcon />,
      metrics: [
        { id: 'population', name: 'Population' },
        { id: 'income', name: 'Median Income' },
      ],
    },
  ];

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  // Fetch home values based on geo level
  const fetchHomeValues = useCallback(async (level: GeoLevel, state?: string) => {
    setDataLoading(true);
    try {
      let data: HomeValues = {};
      switch (level) {
        case 'state':
        case 'national':
          data = await api.getStateHomeValues();
          break;
        case 'metro':
          data = await api.getMetroHomeValues();
          break;
        case 'county':
          data = await api.getCountyHomeValues();
          break;
        case 'zip':
          if (state) {
            data = await api.getZipHomeValues(state);
          }
          break;
      }
      setHomeValues(data);
    } catch (err) {
      console.error('Error loading home values:', err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  // Load initial data
  useEffect(() => {
    api.getStats().then(setStats).catch(console.error);
    fetchHomeValues(geoLevel);
  }, []);

  // Reload data when geo level or selected state changes
  useEffect(() => {
    if (mapLoaded) {
      if (geoLevel === 'zip') {
        if (selectedState) {
          fetchHomeValues(geoLevel, selectedState);
        } else {
          // Clear data when ZIP selected but no state chosen
          setHomeValues({});
          setDataLoading(false);
        }
      } else {
        fetchHomeValues(geoLevel);
      }
    }
  }, [geoLevel, selectedState, fetchHomeValues, mapLoaded]);

  // Color scale function
  const getColorScale = (level: GeoLevel) => {
    // Adjust scale based on geography level
    if (level === 'zip' || level === 'county') {
      return [
        'interpolate', ['linear'], ['get', 'value'],
        0, '#f3f4f6',
        100000, '#dbeafe',
        200000, '#93c5fd',
        350000, '#3b82f6',
        500000, '#1d4ed8',
        750000, '#1e3a8a',
      ];
    }
    return [
      'interpolate', ['linear'], ['get', 'value'],
      100000, '#dbeafe',
      250000, '#93c5fd',
      400000, '#3b82f6',
      600000, '#1d4ed8',
      800000, '#1e3a8a',
    ];
  };

  // Update map layers when data changes
  const updateMapLayers = useCallback(async () => {
    if (!map.current || !mapLoaded) return;

    // Remove existing layers and sources
    const layersToRemove = ['geo-fills', 'geo-borders', 'geo-labels'];
    layersToRemove.forEach(layerId => {
      if (map.current!.getLayer(layerId)) {
        map.current!.removeLayer(layerId);
      }
    });
    if (map.current.getSource('geo-data')) {
      map.current.removeSource('geo-data');
    }

    // Load appropriate GeoJSON
    let geojsonUrl: string | null = null;

    if (geoLevel === 'state' || geoLevel === 'national') {
      geojsonUrl = GEOJSON_SOURCES.state;
    } else if (geoLevel === 'county') {
      geojsonUrl = GEOJSON_SOURCES.county;
    } else if (geoLevel === 'metro') {
      geojsonUrl = GEOJSON_SOURCES.metro;
    } else if (geoLevel === 'zip' && selectedState) {
      // Load state-specific ZCTA GeoJSON
      geojsonUrl = `/geojson/zcta/${selectedState.toLowerCase()}.json`;
    }

    if (!geojsonUrl) {
      // For zip without state, show message
      if (geoLevel === 'zip' && !selectedState) {
        console.log('Please select a state to view ZIP codes');
      }
      return;
    }

    try {
      const response = await fetch(geojsonUrl);
      const geojson = await response.json();

      // Add values to features
      if (geoLevel === 'state' || geoLevel === 'national') {
        geojson.features.forEach((feature: any) => {
          const name = feature.properties.name;
          feature.properties.value = homeValues[name] || 0;
        });
      } else if (geoLevel === 'county') {
        geojson.features.forEach((feature: any) => {
          const fips = feature.id || feature.properties.id;
          // Try to match with Zillow region_id format
          const value = homeValues[fips] || homeValues[String(parseInt(fips, 10))] || 0;
          feature.properties.value = value;
          feature.properties.id = fips;
          // Add county name for display
          const stateFips = fips?.substring(0, 2);
          const stateAbbr = FIPS_TO_STATE[stateFips] || '';
          feature.properties.displayName = `${feature.properties.NAME || 'County'}, ${stateAbbr}`;
        });
      } else if (geoLevel === 'metro') {
        geojson.features.forEach((feature: any) => {
          // Metro GeoJSON uses CBSAFP or GEOID for CBSA code
          const cbsaCode = feature.properties.CBSAFP || feature.properties.GEOID;
          const value = homeValues[cbsaCode] || 0;
          feature.properties.value = value;
          feature.properties.id = cbsaCode;
          // Use NAME property for display (e.g., "San Jose-Sunnyvale-Santa Clara, CA")
          feature.properties.displayName = feature.properties.NAME || feature.properties.NAMELSAD || 'Metro Area';
        });
      } else if (geoLevel === 'zip') {
        geojson.features.forEach((feature: any) => {
          // ZCTA GeoJSON uses ZCTA5CE20 or GEOID20 for ZIP code
          const zipCode = feature.properties.ZCTA5CE20 || feature.properties.GEOID20;
          const value = homeValues[zipCode] || 0;
          feature.properties.value = value;
          feature.properties.id = zipCode;
          feature.properties.displayName = zipCode;
        });
      }

      map.current!.addSource('geo-data', {
        type: 'geojson',
        data: geojson,
      });

      // Fill layer
      map.current!.addLayer({
        id: 'geo-fills',
        type: 'fill',
        source: 'geo-data',
        paint: {
          'fill-color': getColorScale(geoLevel) as any,
          'fill-opacity': 0.6,
        },
      });

      // Border layer
      map.current!.addLayer({
        id: 'geo-borders',
        type: 'line',
        source: 'geo-data',
        paint: {
          'line-color': '#ffffff',
          'line-width': geoLevel === 'zip' ? 0.3 : geoLevel === 'county' ? 0.5 : geoLevel === 'metro' ? 0.8 : 1.5,
        },
      });

      // Labels only for state level (too many for county)
      if (geoLevel === 'state' || geoLevel === 'national') {
        map.current!.addLayer({
          id: 'geo-labels',
          type: 'symbol',
          source: 'geo-data',
          layout: {
            'text-field': [
              'format',
              ['get', 'name'],
              { 'font-scale': 0.85, 'text-font': ['literal', ['DIN Pro Medium', 'Arial Unicode MS Regular']] },
              '\n', {},
              ['concat', '$', ['number-format', ['get', 'value'], { 'min-fraction-digits': 0, 'max-fraction-digits': 0 }]],
              { 'font-scale': 0.75, 'text-font': ['literal', ['DIN Pro Regular', 'Arial Unicode MS Regular']] },
            ],
            'text-size': 11,
            'text-anchor': 'center',
            'text-max-width': 8,
          },
          paint: {
            'text-color': '#1a1a2e',
            'text-halo-color': 'rgba(255, 255, 255, 0.9)',
            'text-halo-width': 1.5,
          },
        });
      }

      // Setup hover interactions
      map.current!.on('mouseenter', 'geo-fills', () => {
        map.current!.getCanvas().style.cursor = 'pointer';
      });

      map.current!.on('mouseleave', 'geo-fills', () => {
        map.current!.getCanvas().style.cursor = '';
        popup.current?.remove();
      });

      map.current!.on('mousemove', 'geo-fills', (e) => {
        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          let name = feature.properties?.name || feature.properties?.displayName || feature.properties?.NAME || 'Unknown';
          const value = feature.properties?.value || 0;

          if (!popup.current) {
            popup.current = new mapboxgl.Popup({
              closeButton: false,
              closeOnClick: false,
            });
          }

          popup.current
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="font-family: 'Google Sans', Roboto, sans-serif; padding: 8px 12px;">
                <div style="font-weight: 500; font-size: 14px; color: #1a1a2e;">${name}</div>
                <div style="font-size: 20px; font-weight: 600; color: #6750a4;">
                  ${value > 0 ? '$' + value.toLocaleString() : 'No data'}
                </div>
              </div>
            `)
            .addTo(map.current!);
        }
      });

    } catch (err) {
      console.error('Error loading GeoJSON:', err);
    }
  }, [geoLevel, homeValues, mapLoaded, selectedState]);

  // Update layers when homeValues or geoLevel changes
  useEffect(() => {
    if (mapLoaded && Object.keys(homeValues).length > 0) {
      updateMapLayers();
    }
  }, [homeValues, geoLevel, mapLoaded, updateMapLayers]);

  // Initialize map
  useEffect(() => {
    if (map.current) return;
    if (!mapContainer.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-96, 37.8],
      zoom: 3.5,
    });

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    map.current.on('error', (e) => {
      console.error('Map error:', e);
      setMapError('Map failed to load');
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // State center coordinates for zoom behavior
  const STATE_CENTERS: Record<string, { lng: number; lat: number; zoom: number }> = {
    AL: { lng: -86.9, lat: 32.8, zoom: 6 }, AK: { lng: -153.5, lat: 64.2, zoom: 4 },
    AZ: { lng: -111.4, lat: 34.0, zoom: 6 }, AR: { lng: -92.3, lat: 34.8, zoom: 6.5 },
    CA: { lng: -119.4, lat: 36.8, zoom: 5.5 }, CO: { lng: -105.5, lat: 39.0, zoom: 6 },
    CT: { lng: -72.8, lat: 41.6, zoom: 8 }, DE: { lng: -75.5, lat: 39.0, zoom: 8 },
    DC: { lng: -77.0, lat: 38.9, zoom: 10 }, FL: { lng: -81.5, lat: 27.7, zoom: 6 },
    GA: { lng: -83.5, lat: 32.7, zoom: 6.5 }, HI: { lng: -155.5, lat: 19.9, zoom: 6.5 },
    ID: { lng: -114.5, lat: 44.1, zoom: 5.5 }, IL: { lng: -89.4, lat: 40.0, zoom: 6 },
    IN: { lng: -86.1, lat: 39.8, zoom: 6.5 }, IA: { lng: -93.2, lat: 41.9, zoom: 6 },
    KS: { lng: -98.5, lat: 38.5, zoom: 6 }, KY: { lng: -84.9, lat: 37.8, zoom: 6.5 },
    LA: { lng: -92.1, lat: 30.9, zoom: 6.5 }, ME: { lng: -69.4, lat: 45.3, zoom: 6 },
    MD: { lng: -76.6, lat: 39.0, zoom: 7 }, MA: { lng: -71.5, lat: 42.2, zoom: 7.5 },
    MI: { lng: -84.5, lat: 44.3, zoom: 6 }, MN: { lng: -94.6, lat: 46.4, zoom: 5.5 },
    MS: { lng: -89.7, lat: 32.7, zoom: 6.5 }, MO: { lng: -92.6, lat: 38.5, zoom: 6 },
    MT: { lng: -110.4, lat: 47.0, zoom: 5.5 }, NE: { lng: -99.9, lat: 41.5, zoom: 6 },
    NV: { lng: -117.1, lat: 38.8, zoom: 5.5 }, NH: { lng: -71.6, lat: 43.2, zoom: 7 },
    NJ: { lng: -74.4, lat: 40.1, zoom: 7.5 }, NM: { lng: -106.2, lat: 34.5, zoom: 6 },
    NY: { lng: -75.5, lat: 43.0, zoom: 6 }, NC: { lng: -79.4, lat: 35.5, zoom: 6 },
    ND: { lng: -100.5, lat: 47.5, zoom: 6 }, OH: { lng: -82.8, lat: 40.4, zoom: 6.5 },
    OK: { lng: -97.5, lat: 35.5, zoom: 6 }, OR: { lng: -120.6, lat: 44.0, zoom: 6 },
    PA: { lng: -77.2, lat: 41.2, zoom: 6.5 }, RI: { lng: -71.5, lat: 41.7, zoom: 9 },
    SC: { lng: -81.0, lat: 33.8, zoom: 7 }, SD: { lng: -100.0, lat: 44.5, zoom: 6 },
    TN: { lng: -86.5, lat: 35.8, zoom: 6.5 }, TX: { lng: -99.9, lat: 31.5, zoom: 5.5 },
    UT: { lng: -111.5, lat: 39.3, zoom: 6 }, VT: { lng: -72.6, lat: 44.0, zoom: 7 },
    VA: { lng: -79.4, lat: 37.5, zoom: 6.5 }, WA: { lng: -120.5, lat: 47.4, zoom: 6 },
    WV: { lng: -80.5, lat: 38.9, zoom: 7 }, WI: { lng: -89.6, lat: 44.5, zoom: 6 },
    WY: { lng: -107.5, lat: 43.0, zoom: 6 },
  };

  // Adjust zoom for different geo levels
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // For ZIP level with a selected state, fly to that state
    if (geoLevel === 'zip' && selectedState && STATE_CENTERS[selectedState]) {
      const center = STATE_CENTERS[selectedState];
      map.current.flyTo({
        center: [center.lng, center.lat],
        zoom: center.zoom,
        duration: 800,
      });
      return;
    }

    const zoomLevels: Record<GeoLevel, number> = {
      national: 3.5,
      state: 3.5,
      metro: 4,
      county: 4.5,
      zip: 5,
    };

    map.current.flyTo({
      center: [-96, 37.8],
      zoom: zoomLevels[geoLevel],
      duration: 500,
    });
  }, [geoLevel, selectedState, mapLoaded]);

  const recordCount = Object.keys(homeValues).length;

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: '#f7f2fa', fontFamily: "'Google Sans', Roboto, sans-serif" }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <MenuIcon />
          </button>
          <h1 className="text-xl font-medium text-gray-900">PropertyIQ</h1>
        </div>

        <div className="flex-1 max-w-2xl mx-8">
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
              <SearchIcon />
            </div>
            <input
              type="text"
              placeholder="Search city, zip, or address"
              className="w-full pl-12 pr-4 py-3 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Geo Level Pills */}
        <div className="flex gap-2 items-center">
          {(['National', 'State', 'Metro', 'County', 'Zip'] as const).map((level) => {
            const levelKey = level.toLowerCase() as GeoLevel;
            const isActive = geoLevel === levelKey;
            return (
              <button
                key={level}
                onClick={() => setGeoLevel(levelKey)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gray-900 text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {level}
              </button>
            );
          })}

          {/* State selector for ZIP level */}
          {geoLevel === 'zip' && (
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="ml-2 px-4 py-2 rounded-full text-sm font-medium border border-gray-300 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select State...</option>
              {US_STATES.map((state) => (
                <option key={state.abbrev} value={state.abbrev}>
                  {state.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="flex bg-white shadow-lg">
          <div className="w-20 border-r border-gray-200 flex flex-col items-center py-4 gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`w-16 py-3 rounded-2xl flex flex-col items-center gap-1 transition-all ${
                    isActive
                      ? 'bg-purple-100 text-purple-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className={isActive ? 'text-purple-700' : 'text-gray-600'}>
                    {item.icon}
                  </span>
                  <span className="text-xs font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="w-64 overflow-y-auto p-4">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Market Trends</h2>

            {/* Data summary */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">
                Showing <span className="font-medium text-gray-900">{recordCount.toLocaleString()}</span> {geoLevel === 'state' ? 'states' : geoLevel === 'metro' ? 'metros' : geoLevel === 'county' ? 'counties' : geoLevel === 'zip' ? 'ZIP codes' : 'areas'}
              </div>
            </div>

            <div className="space-y-1">
              {metricCategories.map((category) => {
                const isExpanded = expandedCategories.includes(category.id);
                return (
                  <div key={category.id}>
                    <button
                      onClick={() => toggleCategory(category.id)}
                      className="w-full flex items-center justify-between p-3 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-gray-600">{category.icon}</span>
                        <span className="font-medium text-sm text-gray-800">{category.name}</span>
                      </div>
                      <span className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                        <ChevronDownIcon />
                      </span>
                    </button>

                    {isExpanded && category.metrics && (
                      <div className="ml-10 mt-1 mb-2 space-y-1">
                        {category.metrics.map((metric) => (
                          <button
                            key={metric.id}
                            onClick={() => setSelectedMetric(metric.id)}
                            className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                              selectedMetric === metric.id
                                ? 'bg-purple-100 text-purple-700 font-medium'
                                : 'text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            {metric.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Map */}
        <main className="flex-1 relative" style={{ minHeight: '100%' }}>
          {mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-50 z-10">
              <p className="text-red-600 font-medium">{mapError}</p>
            </div>
          )}
          {dataLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 z-10">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
                <p className="text-gray-600">Loading {geoLevel} data...</p>
              </div>
            </div>
          )}
          <div ref={mapContainer} className="absolute inset-0" style={{ width: '100%', height: '100%' }} />

          {/* Legend */}
          <div className="absolute bottom-6 left-6 bg-white rounded-xl shadow-lg p-4 z-10">
            <div className="text-sm font-medium text-gray-700 mb-2">Home Value</div>
            <div className="flex items-center gap-1">
              <div className="w-6 h-4 rounded" style={{ backgroundColor: '#dbeafe' }}></div>
              <div className="w-6 h-4 rounded" style={{ backgroundColor: '#93c5fd' }}></div>
              <div className="w-6 h-4 rounded" style={{ backgroundColor: '#3b82f6' }}></div>
              <div className="w-6 h-4 rounded" style={{ backgroundColor: '#1d4ed8' }}></div>
              <div className="w-6 h-4 rounded" style={{ backgroundColor: '#1e3a8a' }}></div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>$100K</span>
              <span>$800K+</span>
            </div>
          </div>

          <button className="absolute bottom-6 right-6 bg-white shadow-lg rounded-2xl px-5 py-3 flex items-center gap-3 hover:shadow-xl transition-shadow z-10 border border-gray-200">
            <TableIcon />
            <span className="font-medium text-gray-800">Table View</span>
          </button>
        </main>
      </div>
    </div>
  );
}
