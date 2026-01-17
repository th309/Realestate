// Map page types and constants

// GeoLevel is defined in config/metrics.ts to avoid circular imports
import type { GeoLevel as GeoLevelType } from './config/metrics';
export type GeoLevel = GeoLevelType;
export type ForecastHorizon = '1m' | '3m' | '12m';
export type RentIndexType = 'all' | 'sfr' | 'mfr';
export type RenterDemandType = 'all' | 'sfr' | 'mfr';

// Map data entries can be simple numbers or objects with value and date
export type MapDataEntry = number | { value: number; date?: string };
export type MapData = Record<string, MapDataEntry>;

// Legacy aliases for backward compatibility (deprecated - use MapData/MapDataEntry)
export type HomeValueEntry = MapDataEntry;
export type HomeValues = MapData;

// Helper to extract numeric value from MapDataEntry
export function getValueFromEntry(entry: MapDataEntry | undefined | null): number | null {
  if (entry == null) return null;
  if (typeof entry === 'number') return entry;
  return entry.value;
}

// Helper to extract date from HomeValueEntry
export function getDateFromEntry(entry: HomeValueEntry | undefined | null): string | undefined {
  if (entry == null) return undefined;
  if (typeof entry === 'number') return undefined;
  return entry.date;
}
export type ViewMode = 'homebuyer' | 'investor';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
}

// Data source types for metrics
export type DataSource = 'realtor' | 'zillow' | 'calculated' | 'census' | 'fred';

export interface Metric {
  id: string;
  name: string;
  isPremium?: boolean;
  isNew?: boolean;
  dataSource?: DataSource;
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
  subtext?: string; // User-centric question (e.g., "Can I afford to live here?")
  isDivider?: boolean; // If true, renders as a visual divider
}

export interface SearchResult {
  id: string;
  name: string;
  type: 'state' | 'metro' | 'county' | 'zip' | 'city';
  center?: [number, number];
  bbox?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  state?: string;
}

// Selected geography for benchmark comparison panel
export interface SelectedGeography {
  id: string;
  name: string;
  geoLevel: GeoLevel;
  value: number | null;
  stateAbbr?: string;
}

// GeoJSON sources - re-exported from central config
export { GEOJSON_SOURCES } from './config/metrics';

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

// State abbreviation to FIPS code mapping (inverse of FIPS_TO_STATE)
export const STATE_ABBR_TO_FIPS: Record<string, string> = {
  'AL': '01', 'AK': '02', 'AZ': '04', 'AR': '05', 'CA': '06',
  'CO': '08', 'CT': '09', 'DE': '10', 'DC': '11', 'FL': '12',
  'GA': '13', 'HI': '15', 'ID': '16', 'IL': '17', 'IN': '18',
  'IA': '19', 'KS': '20', 'KY': '21', 'LA': '22', 'ME': '23',
  'MD': '24', 'MA': '25', 'MI': '26', 'MN': '27', 'MS': '28',
  'MO': '29', 'MT': '30', 'NE': '31', 'NV': '32', 'NH': '33',
  'NJ': '34', 'NM': '35', 'NY': '36', 'NC': '37', 'ND': '38',
  'OH': '39', 'OK': '40', 'OR': '41', 'PA': '42', 'RI': '44',
  'SC': '45', 'SD': '46', 'TN': '47', 'TX': '48', 'UT': '49',
  'VT': '50', 'VA': '51', 'WA': '53', 'WV': '54', 'WI': '55',
  'WY': '56', 'PR': '72',
};

// State name to FIPS code mapping (for benchmark lookups)
export const STATE_NAME_TO_FIPS: Record<string, string> = {
  'Alabama': '01', 'Alaska': '02', 'Arizona': '04', 'Arkansas': '05', 'California': '06',
  'Colorado': '08', 'Connecticut': '09', 'Delaware': '10', 'District of Columbia': '11', 'Florida': '12',
  'Georgia': '13', 'Hawaii': '15', 'Idaho': '16', 'Illinois': '17', 'Indiana': '18',
  'Iowa': '19', 'Kansas': '20', 'Kentucky': '21', 'Louisiana': '22', 'Maine': '23',
  'Maryland': '24', 'Massachusetts': '25', 'Michigan': '26', 'Minnesota': '27', 'Mississippi': '28',
  'Missouri': '29', 'Montana': '30', 'Nebraska': '31', 'Nevada': '32', 'New Hampshire': '33',
  'New Jersey': '34', 'New Mexico': '35', 'New York': '36', 'North Carolina': '37', 'North Dakota': '38',
  'Ohio': '39', 'Oklahoma': '40', 'Oregon': '41', 'Pennsylvania': '42', 'Rhode Island': '44',
  'South Carolina': '45', 'South Dakota': '46', 'Tennessee': '47', 'Texas': '48', 'Utah': '49',
  'Vermont': '50', 'Virginia': '51', 'Washington': '53', 'West Virginia': '54', 'Wisconsin': '55',
  'Wyoming': '56',
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

// Zoom levels - re-exported from central config
export { GEO_ZOOM_LEVELS, getDefaultZoom } from './config/metrics';
