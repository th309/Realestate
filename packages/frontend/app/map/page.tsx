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
type ForecastHorizon = '1m' | '3m' | '12m';
type RentIndexType = 'all' | 'sfr' | 'mfr';
type RenterDemandType = 'all' | 'sfr' | 'mfr';
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
  isNew?: boolean;
  metrics?: { id: string; name: string; isPremium?: boolean; isNew?: boolean }[];
}

// Material 3 Icons as SVG components
const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
    <path d="M240-200h120v-240h240v240h120v-360L480-740 240-560v360Zm-80 80v-480l320-240 320 240v480H520v-240h-80v240H160Zm320-350Z" />
  </svg>
);

const MapIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
    <path d="M480-480q33 0 56.5-23.5T560-560q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560q0 33 23.5 56.5T480-480Zm0 294q122-112 181-203.5T720-552q0-109-69.5-178.5T480-800q-101 0-170.5 69.5T240-552q0 71 59 162.5T480-186Zm0 106Q319-217 239.5-334.5T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 100-79.5 217.5T480-80Zm0-480Z" />
  </svg>
);

const GraphIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
    <path d="M280-280h80v-280h-80v280Zm160 0h80v-400h-80v400Zm160 0h80v-160h-80v160ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z" />
  </svg>
);

const ReportIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
    <path d="M320-240h320v-80H320v80Zm0-160h320v-80H320v80ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z" />
  </svg>
);

const InfoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
    <path d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z" />
  </svg>
);

const PricingIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
    <path d="M560-440q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35ZM280-320q-33 0-56.5-23.5T200-400v-320q0-33 23.5-56.5T280-800h560q33 0 56.5 23.5T920-720v320q0 33-23.5 56.5T840-320H280Zm80-80h400q0-33 23.5-56.5T840-480v-160q-33 0-56.5-23.5T760-720H360q0 33-23.5 56.5T280-640v160q33 0 56.5 23.5T360-400Zm440 240H120q-33 0-56.5-23.5T40-240v-440h80v440h680v80ZM280-400v-320 320Z" />
  </svg>
);


const TrendingIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
    <path d="m136-240-56-56 296-298 160 160 208-206H640v-80h240v240h-80v-104L536-320 376-480 136-240Z" />
  </svg>
);

const PeopleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
    <path d="M40-160v-112q0-34 17.5-62.5T104-378q62-31 126-46.5T360-440q66 0 130 15.5T616-378q29 15 46.5 43.5T680-272v112H40Zm720 0v-120q0-44-24.5-84.5T666-434q51 6 96 20.5t84 35.5q36 20 55 44.5t19 53.5v120H760ZM360-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm400-160q0 66-47 113t-113 47q-11 0-28-2.5t-28-5.5q27-32 41.5-71t14.5-81q0-42-14.5-81T544-792q14-5 28-6.5t28-1.5q66 0 113 47t47 113ZM120-240h480v-32q0-11-5.5-20T580-306q-54-27-109-40.5T360-360q-56 0-111 13.5T140-306q-9 5-14.5 14t-5.5 20v32Zm240-320q33 0 56.5-23.5T440-640q0-33-23.5-56.5T360-720q-33 0-56.5 23.5T280-640q0 33 23.5 56.5T360-560Zm0 320Zm0-400Z" />
  </svg>
);

const TableIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
    <path d="M120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200q-33 0-56.5-23.5T120-200Zm80-400h560v-160H200v160Zm213 200h134v-120H413v120Zm0 200h134v-120H413v120ZM200-400h133v-120H200v120Zm427 0h133v-120H627v120ZM200-200h133v-120H200v120Zm427 0h133v-120H627v120Z" />
  </svg>
);

const MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
    <path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z" />
  </svg>
);

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
    <path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor">
    <path d="M480-344 240-584l56-56 184 184 184-184 56 56-240 240Z" />
  </svg>
);

const StarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
    <path d="m354-287 126-76 126 77-33-144 111-96-146-13-58-136-58 135-146 13 111 97-33 143ZM233-120l65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Zm247-350Z" />
  </svg>
);

const AttachMoneyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
    <path d="M441-120v-86q-53-12-91.5-46T293-348l74-30q15 48 44.5 73t77.5 25q41 0 69.5-18.5T587-356q0-35-22-55.5T463-458q-86-27-118-64.5T313-614q0-65 42-101t86-41v-84h80v84q50 8 82.5 36.5T651-650l-74 32q-12-32-34-48t-60-16q-44 0-67 19.5T393-614q0 33 30 52t104 40q69 20 104.5 63.5T667-358q0 71-42 108t-104 46v84h-80Z" />
  </svg>
);

const ShowChartIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
    <path d="m136-240-56-56 296-298 160 160 208-206h-64v-80h200v200h-80v-66L536-320 376-480 136-240Z" />
  </svg>
);

const AnalyticsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
    <path d="M280-280h80v-280h-80v280Zm160 0h80v-400h-80v400Zm160 0h80v-160h-80v160ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z" />
  </svg>
);

const PremiumIcon = () => (
  <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
    PRO
  </span>
);

const InfoSmallIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="14" viewBox="0 -960 960 960" width="14" fill="currentColor" className="opacity-40">
    <path d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z" />
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
  const [forecastHorizon, setForecastHorizon] = useState<ForecastHorizon>('12m');
  const [rentIndexType, setRentIndexType] = useState<RentIndexType>('all');
  const [renterDemandType, setRenterDemandType] = useState<RenterDemandType>('all');
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [homeValues, setHomeValues] = useState<HomeValues>({});
  const [dataLoading, setDataLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['popular']);
  const [sidebarWidth, setSidebarWidth] = useState(256); // 256px = w-64
  const isResizing = useRef(false);
  const pathname = usePathname();

  // Sidebar resize handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    // Auto-switch to Metro for Rent Index if on restricted level
    const isRentIndexMode = selectedMetric === 'rent_index';
    const isRenterDemandMode = selectedMetric === 'rent_for_houses';

    if (isRentIndexMode && ['national', 'state'].includes(geoLevel)) {
      setGeoLevel('metro');
    }
    // ZORDI (Renter Demand) only available for Metro
    if (isRenterDemandMode && geoLevel !== 'metro') {
      setGeoLevel('metro');
    }
  }, [selectedMetric, geoLevel]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      // Calculate new width (accounting for 80px nav bar)
      const newWidth = e.clientX - 80;
      // Clamp between min and max
      const clampedWidth = Math.min(Math.max(newWidth, 200), 500);
      setSidebarWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

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
      id: 'popular',
      name: 'Popular Data',
      icon: <StarIcon />,
      metrics: [
        { id: 'home_value', name: 'Home Value' },
        { id: 'home_value_yoy', name: 'Home Value Growth (YoY)' },
        { id: 'for_sale_inventory', name: 'For Sale Inventory' },
        { id: 'home_price_forecast', name: 'Home Price Forecast', isPremium: true },
        { id: 'home_value_5yr', name: 'Home Value Growth (5-Year)', isPremium: true },
        { id: 'home_value_mom', name: 'Home Value Growth (MoM)', isPremium: true },
        { id: 'overvalued_pct', name: 'Overvalued %', isPremium: true },
        { id: 'days_on_market', name: 'Days on Market' },
        { id: 'home_sales', name: 'Home Sales', isPremium: true },
        { id: 'cap_rate', name: 'Cap Rate' },
        { id: 'long_term_growth', name: 'Long-Term Growth Score', isPremium: true, isNew: true },
      ],
    },
    {
      id: 'home_price_affordability',
      name: 'Home Price & Affordability',
      icon: <AttachMoneyIcon />,
      metrics: [
        { id: 'home_value', name: 'Home Value' },
        { id: 'home_value_yoy', name: 'Home Value Growth (YoY)' },
        { id: 'home_value_5yr', name: 'Home Value Growth (5-Year)', isPremium: true },
        { id: 'overvalued_pct', name: 'Overvalued %', isPremium: true },
        { id: 'sfh_value', name: 'Single Family Value', isPremium: true },
        { id: 'sfh_value_yoy', name: 'Single Family Value Growth (YoY)', isPremium: true },
        { id: 'condo_value', name: 'Condo Value', isPremium: true },
        { id: 'condo_value_yoy', name: 'Condo Value Growth (YoY)', isPremium: true },
        { id: 'value_income_ratio', name: 'Value / Income Ratio', isPremium: true },
        { id: 'mortgage_payment', name: 'Mortgage Payment', isPremium: true },
        { id: 'salary_to_afford', name: 'Salary to Afford a House', isPremium: true },
        { id: 'mtg_pct_income', name: 'Mtg Payment as % of Income', isPremium: true },
        { id: 'property_tax_annual', name: 'Property Tax Annual', isPremium: true },
        { id: 'property_tax_rate', name: 'Property Tax Rate', isPremium: true },
        { id: 'insurance_annual', name: 'Insurance Premium Annual', isPremium: true },
        { id: 'insurance_pct', name: 'Insurance Premium %', isPremium: true },
        { id: 'buy_v_rent', name: 'Buy v Rent Differential', isPremium: true },
        { id: 'change_from_peak', name: '% Change from 2022 Peak', isPremium: true },
        { id: 'crash_2007', name: '% Crash from 2007-12', isPremium: true },
        { id: 'home_value_mom', name: 'Home Value Growth (MoM)', isPremium: true },
      ],
    },
    {
      id: 'market_trends',
      name: 'Market Trends',
      icon: <ShowChartIcon />,
      metrics: [
        { id: 'for_sale_inventory', name: 'For Sale Inventory' },
        { id: 'inventory_yoy', name: 'Sale Inventory Growth (YoY)' },
        { id: 'inventory_surplus', name: 'Inventory Surplus/Deficit', isPremium: true },
        { id: 'home_sales', name: 'Home Sales', isPremium: true },
        { id: 'home_sales_yoy', name: 'Home Sales Growth (YoY)', isPremium: true },
        { id: 'sales_surplus', name: 'Home Sales Surplus/Deficit', isPremium: true },
        { id: 'price_cut_pct', name: 'Price Cut %', isPremium: true },
        { id: 'days_on_market', name: 'Days on Market' },
        { id: 'dom_yoy', name: 'Days on Market Growth (YoY)', isPremium: true },
        { id: 'inventory_pct_houses', name: 'Inventory as % of Houses', isPremium: true },
        { id: 'median_listing_price', name: 'Median Listing Price', isPremium: true },
        { id: 'listing_price_yoy', name: 'Median Listing Price (YoY)', isPremium: true },
        { id: 'new_listing_count', name: 'New Listing Count', isPremium: true },
        { id: 'new_listing_yoy', name: 'New Listing Count (YoY)', isPremium: true },
        { id: 'inventory_mom', name: 'Sale Inventory Growth (MoM)', isPremium: true },
      ],
    },
    {
      id: 'demographic',
      name: 'Demographic',
      icon: <PeopleIcon />,
      metrics: [
        { id: 'population', name: 'Population' },
        { id: 'median_income', name: 'Median Household Income' },
        { id: 'population_growth', name: 'Population Growth', isPremium: true },
        { id: 'income_growth', name: 'Income Growth', isPremium: true },
        { id: 'population_density', name: 'Population Density', isPremium: true },
        { id: 'avg_temperature', name: 'Weather (Avg Temperature)', isPremium: true },
        { id: 'remote_work_pct', name: 'Remote Work %', isPremium: true },
        { id: 'college_degree_rate', name: 'College Degree Rate', isPremium: true },
        { id: 'homeownership_rate', name: 'Homeownership Rate', isPremium: true },
        { id: 'homeowners_25_44', name: 'Homeowners 25-44 %', isPremium: true },
        { id: 'homeowners_75_plus', name: 'Homeowners 75+ %', isPremium: true },
        { id: 'mortgaged_home_pct', name: 'Mortgaged Home %', isPremium: true },
        { id: 'median_age', name: 'Median Age', isPremium: true },
        { id: 'poverty_rate', name: 'Poverty Rate', isPremium: true },
        { id: 'family_households_pct', name: 'Family Households %', isPremium: true },
        { id: 'single_households_pct', name: 'Single Households %', isPremium: true },
        { id: 'housing_units', name: 'Housing Units', isPremium: true },
        { id: 'housing_unit_growth', name: 'Housing Unit Growth Rate', isPremium: true },
        { id: 'building_permits', name: 'Building Permits', isPremium: true },
        { id: 'birth_death_ratio', name: 'Birth / Death Ratio', isPremium: true },
        { id: 'vote_republican', name: 'Vote Republican %', isPremium: true },
        { id: 'vote_democrat', name: 'Vote Democrat %', isPremium: true },
      ],
    },
    {
      id: 'investor_metrics',
      name: 'Investor Metrics',
      icon: <TrendingIcon />,
      metrics: [
        { id: 'rent_index', name: 'Rent Index' },
        { id: 'rent_for_houses', name: 'Renter Demand Index' },
        { id: 'cap_rate', name: 'Cap Rate', isPremium: true },
        { id: 'vacancy_rate', name: 'Vacancy Rate', isPremium: true },
        { id: 'domestic_migration', name: 'Domestic Migration', isPremium: true },
        { id: 'domestic_migration_pct', name: 'Domestic Migration %', isPremium: true },
        { id: 'value_to_rent_ratio', name: 'Home Value to Rent Ratio', isPremium: true },
        { id: 'rent_pct_income', name: 'Rent as % of Income', isPremium: true },
        { id: 'shadow_inventory', name: 'Shadow Inventory %', isPremium: true },
      ],
    },
    {
      id: 'scores',
      name: 'PropertyIQ Scores',
      icon: <AnalyticsIcon />,
      isNew: true,
      metrics: [
        { id: 'home_price_forecast', name: 'Home Price Forecast', isPremium: true },
        { id: 'long_term_growth', name: 'Long-Term Growth Score', isPremium: true, isNew: true },
      ],
    },
  ];

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  // Fetch home values based on geo level and metric
  const fetchHomeValues = useCallback(async (level: GeoLevel, state?: string, metric?: string, horizon?: ForecastHorizon) => {
    setDataLoading(true);
    try {
      let data: HomeValues = {};

      // Check if we're fetching forecast data
      const isForecast = metric === 'home_price_forecast';
      // Check if we're fetching rent index data (ZORI)
      const isRentIndex = metric === 'rent_index';
      // Check if we're fetching renter demand index data (ZORDI)
      const isRenterDemand = metric === 'rent_for_houses';

      switch (level) {
        case 'state':
        case 'national':
          if (isRentIndex || isRenterDemand) {
            // Rent/demand data not available for states
            data = {};
          } else {
            // Forecast data not available for states - show regular home values
            data = await api.getStateHomeValues();
          }
          break;
        case 'metro':
          if (isForecast) {
            data = await api.getMetroForecast(horizon);
          } else if (isRentIndex) {
            data = await api.getMetroRent(rentIndexType);
          } else if (isRenterDemand) {
            data = await api.getMetroRenterDemand(renterDemandType);
          } else {
            data = await api.getMetroHomeValues();
          }
          break;
        case 'county':
          if (isRentIndex) {
            data = await api.getCountyRent(rentIndexType);
          } else if (isRenterDemand) {
            // ZORDI county data not available - show empty or fallback
            data = {};
          } else {
            // Forecast data not available for counties - show regular home values
            data = await api.getCountyHomeValues();
          }
          break;
        case 'zip':
          if (state) {
            if (isForecast) {
              data = await api.getZipForecast(state, horizon);
            } else if (isRentIndex) {
              data = await api.getZipRent(state, rentIndexType);
            } else if (isRenterDemand) {
              data = await api.getZipRenterDemand(state, renterDemandType);
            } else {
              data = await api.getZipHomeValues(state);
            }
          }
          break;
      }
      setHomeValues(data);
    } catch (err) {
      console.error('Error loading home values:', err);
    } finally {
      setDataLoading(false);
    }
  }, [renterDemandType, rentIndexType]);

  // Load stats on mount
  useEffect(() => {
    api.getStats().then(setStats).catch(console.error);
  }, []);

  // Reload data when geo level, selected state, metric, or forecast horizon changes
  useEffect(() => {
    if (mapLoaded) {
      if (geoLevel === 'zip') {
        if (selectedState) {
          fetchHomeValues(geoLevel, selectedState, selectedMetric, forecastHorizon);
        } else {
          // Clear data when ZIP selected but no state chosen
          setHomeValues({});
          setDataLoading(false);
        }
      } else {
        fetchHomeValues(geoLevel, undefined, selectedMetric, forecastHorizon);
      }
    }
  }, [geoLevel, selectedState, selectedMetric, forecastHorizon, fetchHomeValues, mapLoaded]);

  // Color scale function
  const getColorScale = (level: GeoLevel, isForecast: boolean = false, min?: number, max?: number, isRenterDemand: boolean = false) => {
    // Forecast uses percentage scale (typically -5% to +10%)
    if (isForecast) {
      return [
        'interpolate', ['linear'], ['get', 'value'],
        -5, '#ef4444',    // Red for negative growth
        -2, '#f97316',    // Orange
        0, '#fbbf24',     // Yellow for flat
        2, '#84cc16',     // Light green
        5, '#22c55e',     // Green for positive growth
        10, '#059669',    // Dark green for strong growth
      ];
    }

    // ZORDI (Renter Demand) - green scale for index values
    if (isRenterDemand && min !== undefined && max !== undefined) {
      const step = (max - min) / 5;
      return [
        'interpolate', ['linear'], ['get', 'value'],
        min, '#f3f4f6',        // Lightest (lowest demand)
        min + step, '#bbf7d0',
        min + step * 2, '#86efac',
        min + step * 3, '#4ade80',
        min + step * 4, '#22c55e',
        max, '#16a34a',        // Darkest green (highest demand)
      ];
    }

    // Dynamic scale if min/max provided (used for Rent Index - blue)
    if (min !== undefined && max !== undefined) {
      const step = (max - min) / 5;
      return [
        'interpolate', ['linear'], ['get', 'value'],
        min, '#f3f4f6',      // Lightest (lowest rent)
        min + step, '#dbeafe',
        min + step * 2, '#93c5fd',
        min + step * 3, '#3b82f6',
        min + step * 4, '#1d4ed8',
        max, '#1e3a8a',      // Darkest (highest rent)
      ];
    }

    // Adjust scale based on geography level for home values
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
      const isForecast = selectedMetric === 'home_price_forecast';
      const isRentIndex = selectedMetric === 'rent_index';
      const isRenterDemand = selectedMetric === 'rent_for_houses';
      let minVal, maxVal;

      if (isRentIndex || isRenterDemand) {
        const values = Object.values(homeValues).filter(v => typeof v === 'number' && v > 0).sort((a, b) => a - b);
        if (values.length > 0) {
          minVal = values[0];
          // Use 95th percentile for max to avoid skew from outliers
          const p95Index = Math.min(Math.floor(values.length * 0.95), values.length - 1);
          maxVal = values[p95Index];
        }
      }

      map.current!.addLayer({
        id: 'geo-fills',
        type: 'fill',
        source: 'geo-data',
        paint: {
          'fill-color': getColorScale(geoLevel, isForecast, minVal, maxVal, isRenterDemand) as any,
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

          // Format value based on metric type
          let displayValue: string;
          let valueColor = '#6750a4';
          const isRenterDemandMetric = selectedMetric === 'rent_for_houses';

          if (isForecast) {
            if (value !== 0) {
              const sign = value > 0 ? '+' : '';
              displayValue = `${sign}${value.toFixed(1)}%`;
              valueColor = value > 0 ? '#059669' : value < 0 ? '#ef4444' : '#6b7280';
            } else {
              displayValue = 'No data';
            }
          } else if (isRenterDemandMetric) {
            // ZORDI is an index value (0-100), not currency
            displayValue = value > 0 ? value.toFixed(0) : 'No data';
            valueColor = '#16a34a'; // Green for demand index
          } else {
            // Whole dollars for currency
            displayValue = value > 0
              ? value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
              : 'No data';
          }

          // Get forecast horizon label
          const horizonLabel = forecastHorizon === '1m' ? '1-month' : forecastHorizon === '3m' ? '3-month' : '12-month';

          popup.current
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="font-family: 'Google Sans', Roboto, sans-serif; padding: 8px 12px;">
                <div style="font-weight: 500; font-size: 14px; color: #1a1a2e;">${name}</div>
                <div style="font-size: 20px; font-weight: 600; color: ${valueColor};">
                  ${displayValue}
                </div>
                ${isForecast ? `<div style="font-size: 11px; color: #6b7280;">${horizonLabel} forecast</div>` : ''}
              </div>
            `)
            .addTo(map.current!);
        }
      });

    } catch (err) {
      console.error('Error loading GeoJSON:', err);
    }
  }, [geoLevel, homeValues, mapLoaded, selectedState, selectedMetric, forecastHorizon]);

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

            // Forecast data only available for Metro and ZIP
            const isForecastMode = selectedMetric === 'home_price_forecast';
            const isDisabledForForecast = isForecastMode && ['national', 'state', 'county'].includes(levelKey);

            // Rent Index (ZORI) data restricted to Metro, County, and Zip (National/State not currently available)
            const isRentIndexMode = selectedMetric === 'rent_index';
            const isDisabledForRentIndex = isRentIndexMode && ['national', 'state'].includes(levelKey);

            // Renter Demand (ZORDI) data only available for Metro (Zillow doesn't provide ZIP level)
            const isRenterDemandMode = selectedMetric === 'rent_for_houses';
            const isDisabledForRenterDemand = isRenterDemandMode && ['national', 'state', 'county', 'zip'].includes(levelKey);

            const isDisabled = isDisabledForForecast || isDisabledForRentIndex || isDisabledForRenterDemand;
            const disabledTitle = isDisabledForForecast
              ? 'Forecast data not available for this geography level'
              : isDisabledForRentIndex
                ? 'Rent Index data available for Metro, County, and Zip levels only'
                : isDisabledForRenterDemand
                  ? 'Renter Demand Index data available for Metro level only'
                  : undefined;

            return (
              <button
                key={level}
                onClick={() => !isDisabled && setGeoLevel(levelKey)}
                disabled={isDisabled}
                title={disabledTitle}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${isDisabled
                  ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                  : isActive
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
                  className={`w-16 py-3 rounded-2xl flex flex-col items-center gap-1 transition-all ${isActive
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

          <div className="overflow-y-auto p-4" style={{ width: sidebarWidth }}>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Market Trends</h2>

            {/* Data summary */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">
                Showing <span className="font-medium text-gray-900">{recordCount.toLocaleString()}</span> {geoLevel === 'state' ? 'states' : geoLevel === 'metro' ? 'metros' : geoLevel === 'county' ? 'counties' : geoLevel === 'zip' ? 'ZIP codes' : 'areas'}
              </div>
              {geoLevel === 'county' && (
                <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                  ~58% of US counties have Zillow home value data. Rural counties with limited housing transactions may show "No data."
                </div>
              )}
              {geoLevel === 'zip' && !selectedState && (
                <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-amber-600">
                  Select a state to view ZIP code data
                </div>
              )}
            </div>

            {/* Search box */}
            <div className="mb-4">
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 -960 960 960" width="16" fill="currentColor">
                    <path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search data points"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="space-y-1">
              {metricCategories.map((category) => {
                const isExpanded = expandedCategories.includes(category.id);
                return (
                  <div key={category.id}>
                    <button
                      onClick={() => toggleCategory(category.id)}
                      className="w-full flex items-center justify-between p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-gray-600 flex-shrink-0">{category.icon}</span>
                        <span className="font-medium text-xs text-gray-800 truncate">{category.name}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {category.isNew && (
                          <span className="text-[10px] text-rose-500 font-medium">New</span>
                        )}
                        <span className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                          <ChevronDownIcon />
                        </span>
                      </div>
                    </button>

                    {isExpanded && category.metrics && (
                      <div className="ml-6 mt-1 mb-2 space-y-0.5">
                        {category.metrics.map((metric) => (
                          <div key={metric.id}>
                            <button
                              onClick={() => {
                                setSelectedMetric(metric.id);
                                // Auto-switch to Metro when forecast is selected (forecast data only available for Metro/ZIP)
                                if (metric.id === 'home_price_forecast' && !['metro', 'zip'].includes(geoLevel)) {
                                  setGeoLevel('metro');
                                }
                              }}
                              className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors ${selectedMetric === metric.id
                                ? 'bg-purple-100 text-purple-700 font-medium'
                                : 'text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                              <span className="flex items-center gap-1.5 min-w-0">
                                <span className="truncate">{metric.name}</span>
                                {metric.isNew && (
                                  <span className="text-[10px] text-rose-500 font-medium flex-shrink-0">New</span>
                                )}
                              </span>
                              <span className="flex items-center gap-0.5 flex-shrink-0 ml-1">
                                {metric.isPremium && <PremiumIcon />}
                                <InfoSmallIcon />
                              </span>
                            </button>
                            {/* Forecast Horizon Selector - show below the forecast metric when selected */}
                            {metric.id === 'home_price_forecast' && selectedMetric === 'home_price_forecast' && (
                              <div className="mt-1 ml-2 p-2 bg-purple-50 rounded-lg border border-purple-200">
                                <div className="text-[10px] font-medium text-purple-800 mb-1.5">Forecast Horizon</div>
                                <div className="flex gap-1">
                                  {([
                                    { value: '1m', label: '1M' },
                                    { value: '3m', label: '3M' },
                                    { value: '12m', label: '12M' },
                                  ] as const).map((option) => (
                                    <button
                                      key={option.value}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setForecastHorizon(option.value);
                                      }}
                                      className={`flex-1 px-2 py-1 text-[10px] font-medium rounded transition-all ${forecastHorizon === option.value
                                        ? 'bg-purple-600 text-white shadow-sm'
                                        : 'bg-white text-purple-700 border border-purple-300 hover:bg-purple-100'
                                        }`}
                                    >
                                      {option.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            {/* Rent Index Type Selector - show below the rent index metric when selected */}
                            {metric.id === 'rent_index' && selectedMetric === 'rent_index' && (
                              <div className="mt-1 ml-2 p-2 bg-purple-50 rounded-lg border border-purple-200">
                                <div className="text-[10px] font-medium text-purple-800 mb-1.5 min-h-[15px] flex items-center justify-between">
                                  <span>Property Type</span>
                                </div>
                                <div className="flex gap-1">
                                  {([
                                    { value: 'all', label: 'All Homes' },
                                    { value: 'sfr', label: 'Single Family' },
                                    { value: 'mfr', label: 'Multi-Family' },
                                  ] as const).map((option) => {
                                    // Disable SFR and MFR for County and Zip levels
                                    const isDisabled = (option.value === 'sfr' || option.value === 'mfr') && (geoLevel === 'county' || geoLevel === 'zip');

                                    return (
                                      <button
                                        key={option.value}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (!isDisabled) {
                                            setRentIndexType(option.value);
                                          }
                                        }}
                                        disabled={isDisabled}
                                        title={isDisabled ? "Not available for County/Zip level" : ""}
                                        className={`flex-1 px-2 py-1 text-[10px] font-medium rounded transition-all 
                                      ${isDisabled
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                                            : rentIndexType === option.value
                                              ? 'bg-purple-600 text-white shadow-sm'
                                              : 'bg-white text-purple-700 border border-purple-300 hover:bg-purple-100'
                                          }`}
                                      >
                                        {option.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            {/* Renter Demand Index Type Selector */}
                            {metric.id === 'rent_for_houses' && selectedMetric === 'rent_for_houses' && (
                              <div className="mt-1 ml-2 p-2 bg-green-50 rounded-lg border border-green-200">
                                <div className="text-[10px] font-medium text-green-800 mb-1.5 min-h-[15px] flex items-center justify-between">
                                  <span>Property Type</span>
                                </div>
                                <div className="flex gap-1">
                                  {([
                                    { value: 'all', label: 'All Homes' },
                                    { value: 'sfr', label: 'Single Family' },
                                    { value: 'mfr', label: 'Multi-Family' },
                                  ] as const).map((option) => {
                                    // Disable SFR and MFR for County and Zip levels
                                    const isDisabled = (option.value === 'sfr' || option.value === 'mfr') && (geoLevel === 'county' || geoLevel === 'zip');

                                    return (
                                      <button
                                        key={option.value}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (!isDisabled) {
                                            setRenterDemandType(option.value);
                                          }
                                        }}
                                        disabled={isDisabled}
                                        title={isDisabled ? "Not available for County/Zip level" : ""}
                                        className={`flex-1 px-2 py-1 text-[10px] font-medium rounded transition-all 
                                        ${isDisabled
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                                            : renterDemandType === option.value
                                              ? 'bg-green-600 text-white shadow-sm'
                                              : 'bg-white text-green-700 border border-green-300 hover:bg-green-100'
                                          }`}
                                      >
                                        {option.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Explore link */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <a href="#" className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1">
                Explore Data Points
                <svg xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 -960 960 960" width="16" fill="currentColor">
                  <path d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Resize handle */}
          <div
            onMouseDown={handleMouseDown}
            className="w-1 hover:w-1.5 bg-transparent hover:bg-purple-300 cursor-col-resize transition-all flex-shrink-0 group"
            title="Drag to resize sidebar"
          >
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-0.5 h-8 bg-gray-300 group-hover:bg-purple-500 rounded-full transition-colors" />
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
            {(() => {
              // Helper to calculate ranges and titles
              const isForecast = selectedMetric === 'home_price_forecast';
              const isRentIndex = selectedMetric === 'rent_index';
              const isRenterDemand = selectedMetric === 'rent_for_houses';

              let legendTitle = 'Home Value';
              if (isForecast) {
                legendTitle = forecastHorizon === '1m' ? '1-Month Forecast' : forecastHorizon === '3m' ? '3-Month Forecast' : '12-Month Forecast';
              } else if (isRentIndex) {
                legendTitle = 'Rent Index';
              } else if (isRenterDemand) {
                legendTitle = 'Renter Demand Index';
              } else if (selectedMetric === 'for_sale_inventory') {
                legendTitle = 'Inventory';
              }

              if (isForecast) {
                return (
                  <>
                    <div className="text-sm font-medium text-gray-700 mb-2">
                      {legendTitle}
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-6 h-4 rounded" style={{ backgroundColor: '#ef4444' }}></div>
                      <div className="w-6 h-4 rounded" style={{ backgroundColor: '#f97316' }}></div>
                      <div className="w-6 h-4 rounded" style={{ backgroundColor: '#fbbf24' }}></div>
                      <div className="w-6 h-4 rounded" style={{ backgroundColor: '#84cc16' }}></div>
                      <div className="w-6 h-4 rounded" style={{ backgroundColor: '#22c55e' }}></div>
                      <div className="w-6 h-4 rounded" style={{ backgroundColor: '#059669' }}></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>-5%</span>
                      <span>+10%</span>
                    </div>
                    {/* Info about available geo levels */}
                    {(geoLevel === 'state' || geoLevel === 'national' || geoLevel === 'county') && (
                      <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-amber-600">
                        Forecast data available for Metro and ZIP levels
                      </div>
                    )}
                  </>
                );
              }

              // ZORDI (Renter Demand) - index values 0-100
              if (isRenterDemand) {
                const values = Object.values(homeValues).filter(v => typeof v === 'number' && v > 0).sort((a, b) => a - b);
                let minVal = 0;
                let maxVal = 100;
                if (values.length > 0) {
                  minVal = Math.floor(values[0]);
                  const p95Index = Math.min(Math.floor(values.length * 0.95), values.length - 1);
                  maxVal = Math.ceil(values[p95Index]);
                }

                return (
                  <>
                    <div className="text-sm font-medium text-gray-700 mb-2">{legendTitle}</div>
                    <div className="flex items-center gap-1">
                      <div className="w-6 h-4 rounded" style={{ backgroundColor: '#f3f4f6' }}></div>
                      <div className="w-6 h-4 rounded" style={{ backgroundColor: '#bbf7d0' }}></div>
                      <div className="w-6 h-4 rounded" style={{ backgroundColor: '#86efac' }}></div>
                      <div className="w-6 h-4 rounded" style={{ backgroundColor: '#4ade80' }}></div>
                      <div className="w-6 h-4 rounded" style={{ backgroundColor: '#22c55e' }}></div>
                      <div className="w-6 h-4 rounded" style={{ backgroundColor: '#16a34a' }}></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{minVal}</span>
                      <span>{maxVal}+</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
                      Higher = stronger renter demand
                    </div>
                  </>
                );
              }

              // Dynamic Range Calculation for currency metrics
              let minLabel = '$100K';
              let maxLabel = '$800K+';

              if (isRentIndex) {
                // Calculate min/max from loaded data
                const values = Object.values(homeValues).filter(v => typeof v === 'number' && v > 0).sort((a, b) => a - b);
                if (values.length > 0) {
                  const minVal = values[0];
                  // Use 95th percentile for max to avoid skew
                  const p95Index = Math.min(Math.floor(values.length * 0.95), values.length - 1);
                  const maxVal = values[p95Index];

                  // Format logic
                  const formatMoney = (val: number) => {
                    return val.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
                  };
                  minLabel = formatMoney(minVal);
                  maxLabel = formatMoney(maxVal) + '+';
                } else {
                  minLabel = '$0';
                  maxLabel = 'N/A';
                }
              }

              return (
                <>
                  <div className="text-sm font-medium text-gray-700 mb-2">{legendTitle}</div>
                  <div className="flex items-center gap-1">
                    <div className="w-6 h-4 rounded" style={{ backgroundColor: '#f3f4f6' }}></div>
                    <div className="w-6 h-4 rounded" style={{ backgroundColor: '#dbeafe' }}></div>
                    <div className="w-6 h-4 rounded" style={{ backgroundColor: '#93c5fd' }}></div>
                    <div className="w-6 h-4 rounded" style={{ backgroundColor: '#3b82f6' }}></div>
                    <div className="w-6 h-4 rounded" style={{ backgroundColor: '#1d4ed8' }}></div>
                    <div className="w-6 h-4 rounded" style={{ backgroundColor: '#1e3a8a' }}></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{minLabel}</span>
                    <span>{maxLabel}</span>
                  </div>
                </>
              );
            })()}
            {/* No data indicator */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
              <div className="w-6 h-4 rounded border border-gray-300" style={{ backgroundColor: '#f3f4f6' }}></div>
              <span className="text-xs text-gray-500">No data available</span>
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
