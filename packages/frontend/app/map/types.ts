// Map page types and constants

export type GeoLevel = 'national' | 'state' | 'metro' | 'county' | 'city' | 'zip' | 'tract';
export type ForecastHorizon = '1m' | '3m' | '12m';
export type RentIndexType = 'all' | 'sfr' | 'mfr';
export type RenterDemandType = 'all' | 'sfr' | 'mfr';
export type HomeValues = Record<string, number>;
export type ViewMode = 'homebuyer' | 'investor';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
}

export interface Metric {
  id: string;
  name: string;
  isPremium?: boolean;
  isNew?: boolean;
}

export interface SubSection {
  id: string;
  name: string;
  metrics: Metric[];
}

export interface MetricCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  expanded?: boolean;
  isNew?: boolean;
  metrics?: Metric[];
  subSections?: SubSection[];
  viewMode?: ViewMode; // If set, only shows in this view mode
}

export interface SearchResult {
  id: string;
  name: string;
  type: 'state' | 'metro' | 'county' | 'zip' | 'city';
  center?: [number, number];
  bbox?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  state?: string;
}

// GeoJSON sources for different geography levels
export const GEOJSON_SOURCES = {
  state: 'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json',
  county: 'https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json',
  metro: '/geojson/cbsa_2023.json',
};

// FIPS code to state abbreviation mapping
export const FIPS_TO_STATE: Record<string, string> = {
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
export const US_STATES = [
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

// State center coordinates for map navigation
export const STATE_CENTERS: Record<string, { lat: number; lng: number; zoom: number }> = {
  AL: { lat: 32.806671, lng: -86.79113, zoom: 6.5 },
  AK: { lat: 61.370716, lng: -152.404419, zoom: 4 },
  AZ: { lat: 33.729759, lng: -111.431221, zoom: 6 },
  AR: { lat: 34.969704, lng: -92.373123, zoom: 6.5 },
  CA: { lat: 36.116203, lng: -119.681564, zoom: 5.5 },
  CO: { lat: 39.059811, lng: -105.311104, zoom: 6 },
  CT: { lat: 41.597782, lng: -72.755371, zoom: 8 },
  DE: { lat: 39.318523, lng: -75.507141, zoom: 8 },
  DC: { lat: 38.897438, lng: -77.026817, zoom: 11 },
  FL: { lat: 27.766279, lng: -81.686783, zoom: 6 },
  GA: { lat: 33.040619, lng: -83.643074, zoom: 6.5 },
  HI: { lat: 21.094318, lng: -157.498337, zoom: 6.5 },
  ID: { lat: 44.240459, lng: -114.478828, zoom: 5.5 },
  IL: { lat: 40.349457, lng: -88.986137, zoom: 6 },
  IN: { lat: 39.849426, lng: -86.258278, zoom: 6.5 },
  IA: { lat: 42.011539, lng: -93.210526, zoom: 6.5 },
  KS: { lat: 38.5266, lng: -96.726486, zoom: 6.5 },
  KY: { lat: 37.66814, lng: -84.670067, zoom: 6.5 },
  LA: { lat: 31.169546, lng: -91.867805, zoom: 6.5 },
  ME: { lat: 44.693947, lng: -69.381927, zoom: 6.5 },
  MD: { lat: 39.063946, lng: -76.802101, zoom: 7 },
  MA: { lat: 42.230171, lng: -71.530106, zoom: 7.5 },
  MI: { lat: 43.326618, lng: -84.536095, zoom: 6 },
  MN: { lat: 45.694454, lng: -93.900192, zoom: 6 },
  MS: { lat: 32.741646, lng: -89.678696, zoom: 6.5 },
  MO: { lat: 38.456085, lng: -92.288368, zoom: 6.5 },
  MT: { lat: 46.921925, lng: -110.454353, zoom: 5.5 },
  NE: { lat: 41.12537, lng: -98.268082, zoom: 6.5 },
  NV: { lat: 38.313515, lng: -117.055374, zoom: 5.5 },
  NH: { lat: 43.452492, lng: -71.563896, zoom: 7 },
  NJ: { lat: 40.298904, lng: -74.521011, zoom: 7.5 },
  NM: { lat: 34.840515, lng: -106.248482, zoom: 6 },
  NY: { lat: 42.165726, lng: -74.948051, zoom: 6 },
  NC: { lat: 35.630066, lng: -79.806419, zoom: 6.5 },
  ND: { lat: 47.528912, lng: -99.784012, zoom: 6 },
  OH: { lat: 40.388783, lng: -82.764915, zoom: 6.5 },
  OK: { lat: 35.565342, lng: -96.928917, zoom: 6.5 },
  OR: { lat: 44.572021, lng: -122.070938, zoom: 6 },
  PA: { lat: 40.590752, lng: -77.209755, zoom: 6.5 },
  RI: { lat: 41.680893, lng: -71.51178, zoom: 9 },
  SC: { lat: 33.856892, lng: -80.945007, zoom: 7 },
  SD: { lat: 44.299782, lng: -99.438828, zoom: 6 },
  TN: { lat: 35.747845, lng: -86.692345, zoom: 6.5 },
  TX: { lat: 31.054487, lng: -97.563461, zoom: 5.5 },
  UT: { lat: 40.150032, lng: -111.862434, zoom: 6 },
  VT: { lat: 44.045876, lng: -72.710686, zoom: 7 },
  VA: { lat: 37.769337, lng: -78.169968, zoom: 6.5 },
  WA: { lat: 47.400902, lng: -121.490494, zoom: 6 },
  WV: { lat: 38.491226, lng: -80.954453, zoom: 7 },
  WI: { lat: 44.268543, lng: -89.616508, zoom: 6 },
  WY: { lat: 42.755966, lng: -107.30249, zoom: 6 },
};

// Zoom levels by geography type
export const GEO_ZOOM_LEVELS: Record<GeoLevel, number> = {
  national: 3.5,
  state: 3.5,
  metro: 4,
  county: 4.5,
  city: 5,
  zip: 5,
  tract: 6,
};
